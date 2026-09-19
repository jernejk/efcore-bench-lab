using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using EfCoreBenchLab.LogInsights;
using LLama;
using LLama.Common;
using LLama.Native;
using LLama.Sampling;

// efinsights — Aspire / EF Core log investigations.
// Deterministic code locates and measures; a judgement backend annotates.
//
//   efinsights <command> <log-file> [--backend none|local|jev]
//              [--model base.gguf] [--adapter a.gguf]
//              [--slow-ms 200] [--top 5] [--nplusone 5] [--confidence 0.75] [--json out.json]
//
//   backends:  none   deterministic facts only
//              local  tiny LFM2.5 + sql-smell LoRA, offline (requires --model)
//              jev    hosted TypeSafe decision model, facts-in / verdicts-out

NativeLibraryConfig.All.WithLogCallback((level, message) => { });

var opts = Args.Parse(args);
if (opts.LogFile is null)
{
    Console.Error.WriteLine("usage: efinsights [slow|nplusone|all] <log-file> [--backend none|local|jev] [--model base.gguf] [--slow-ms 200] [--top 5] [--nplusone 5] [--confidence 0.75]");
    return 1;
}

var (entries, planOps) = LogParser.LoadWithPlans(opts.LogFile);
Console.WriteLine($"\nScanned {entries.Count} EF command(s) from {Path.GetFileName(opts.LogFile)}  ·  investigation: {opts.Command}  ·  backend: {opts.Backend}");

SmellModel? model = null;
if (opts.Backend == "local")
{
    if (opts.ModelPath is null) Console.WriteLine("  ⚠ backend 'local' needs --model <base.gguf> — continuing with facts only.");
    else
    {
        Console.WriteLine($"Loading {Path.GetFileName(opts.ModelPath)} + {Path.GetFileName(opts.AdapterPath ?? "(no adapter)")} …");
        model = SmellModel.Load(opts.ModelPath, opts.AdapterPath);
    }
}

JevClient? jev = null;
if (opts.Backend == "jev")
{
    var root = FindSpikeRoot();
    jev = new JevClient(Path.Combine(root, ".jev-cache"), new SpendLedger(Path.Combine(root, "jev-ledger.jsonl"), opts.SpendCap), JevClient.LoadKey());
    if (jev.DisabledReason is not null)
        Console.WriteLine($"  ⚠ jev backend unavailable ({jev.DisabledReason}) — reporting deterministic facts only.");
}

var report = new JsonArray();

if (opts.Command is "slow" or "all") await Investigations.SlowQueries(entries, planOps, opts, model, jev, report);
if (opts.Command is "nplusone" or "all") await Investigations.NPlusOne(entries, planOps, opts, model, jev, report);

if (jev is not null)
{
    var l = jev.Stats.Latencies;
    Console.WriteLine($"\n── jev usage ──");
    Console.WriteLine($"  network calls {jev.Stats.NetCalls}  ·  cache hits {jev.Stats.CacheHits}  ·  withheld answers {jev.Stats.Withheld}  ·  failures {jev.Stats.Failures}");
    if (l.Count > 0)
    {
        var s = l.OrderBy(x => x).ToArray();
        Console.WriteLine($"  latency p50 {s[(int)(s.Length * 0.5).ClampIdx(s.Length)]:N0} ms  ·  p95 {s[(int)(s.Length * 0.95).ClampIdx(s.Length)]:N0} ms");
    }
    Console.WriteLine($"  input tokens {jev.Stats.InputTokens:N0}  ·  session cost ${jev.Stats.Cost:F6}");
    if (jev.DisabledReason is not null) Console.WriteLine($"  note: {jev.DisabledReason}");
}

if (opts.JsonOut is not null)
{
    var root = new JsonObject
    {
        ["log"] = opts.LogFile,
        ["backend"] = opts.Backend,
        ["ef_commands"] = entries.Count,
        ["findings"] = report,
    };
    if (jev is not null)
        root["jev"] = new JsonObject
        {
            ["net_calls"] = jev.Stats.NetCalls,
            ["cache_hits"] = jev.Stats.CacheHits,
            ["withheld"] = jev.Stats.Withheld,
            ["failures"] = jev.Stats.Failures,
            ["cost"] = jev.Stats.Cost,
            ["input_tokens"] = jev.Stats.InputTokens,
            ["latencies_ms"] = new JsonArray(jev.Stats.Latencies.Select(x => (JsonNode?)Math.Round(x, 1)).ToArray()),
            ["disabled_reason"] = jev.DisabledReason,
        };
    File.WriteAllText(opts.JsonOut, root.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
}

model?.Dispose();
jev?.Dispose();
return 0;


static string FindSpikeRoot()
{
    var d = new DirectoryInfo(AppContext.BaseDirectory);
    while (d is not null && !File.Exists(Path.Combine(d.FullName, "SPIKE-ROOT"))) d = d.Parent;
    return d?.FullName ?? Directory.GetCurrentDirectory();
}


static class Investigations
{
    const string SmellSystem =
        "You classify the dominant performance smell in one SQL statement. Respond with ONLY JSON: " +
        "{\"smell\":\"leading_wildcard|function_on_column|select_star|missing_where|implicit_cast|" +
        "cartesian_join|offset_paging|none\",\"sargable\":true|false,\"severity\":\"low|medium|high\"," +
        "\"fix_hint\":\"add_index|rewrite_predicate|add_filter|limit_columns|use_keyset|none\"}";

    // 1) Slow app queries: deterministic locate (duration + source, skip infra) → backend annotation.
    public static async Task SlowQueries(List<LogEntry> entries, IReadOnlyList<string> planOps, Args o,
                                         SmellModel? model, JevClient? jev, JsonArray report)
    {
        var appOwned = entries.Where(e => e.DurationMs >= o.SlowMs && e.Source is not null).ToList();
        var shapes = ShapeAggregator.Aggregate(appOwned, planOps)
                                    .OrderByDescending(s => s.MaxMs).Take(o.Top).ToList();

        Console.WriteLine($"\n── slow queries (> {o.SlowMs:N0} ms, app-owned) ── {shapes.Count} distinct shape(s)");
        if (shapes.Count == 0) { Console.WriteLine("  none — healthy run ✅"); return; }

        var rank = 1;
        foreach (var s in shapes)
        {
            var dot = s.MaxMs >= 1000 ? "🔴" : s.MaxMs >= 300 ? "🟠" : "🟡";
            Console.WriteLine($"{dot} #{rank++}  {s.MaxMs,8:N0} ms max  ·  {s.Executions}×  ·  {s.TotalMs:N0} ms total   {s.Source}");
            if (s.RequestPath is not null) Console.WriteLine($"       path: {s.RequestPath}");
            Console.WriteLine($"       facts: p50 {s.P50Ms:N0} ms · p95 {s.P95Ms:N0} ms · tables {s.Sql.TableCount} · joins {s.Sql.InnerJoins + s.Sql.OuterJoins} · cols {s.Sql.ProjectedColumns}"
                            + $"{(s.Sql.HasWhere ? "" : " · NO WHERE")}{(s.Sql.LeadingWildcardLike ? " · leading-wildcard LIKE" : "")}"
                            + $"{(s.Sql.HasOffsetFetch ? (s.Sql.OffsetParameterised ? " · OFFSET/FETCH paging (offset parameterised)" : $" · OFFSET {s.Sql.OffsetRows:N0}") : "")}{(s.Sql.InListSize > 20 ? $" · IN list {s.Sql.InListSize:N0}" : "")}"
                            + $"{(s.Sql.CorrelatedSubquery ? " · correlated subquery" : "")}{(s.MaxRepeatsInOneRequest >= o.NPlusOne ? $" · repeats {s.MaxRepeatsInOneRequest}× in one request" : "")}");
            Console.WriteLine($"       sql:  {Trunc(s.SampleSql, 110)}");
            await Annotate("slow", s, o, model, jev, report);
        }
    }

    // 2) N+1: deterministic — within one request, the same query SHAPE fired many times.
    public static async Task NPlusOne(List<LogEntry> entries, IReadOnlyList<string> planOps, Args o,
                                      SmellModel? model, JevClient? jev, JsonArray report)
    {
        Console.WriteLine($"\n── N+1 query patterns (same shape ≥ {o.NPlusOne}× in one request) ──");
        var shapes = ShapeAggregator.Aggregate(entries.Where(e => e.RequestId is not null), planOps)
                                    .Where(s => s.MaxRepeatsInOneRequest >= o.NPlusOne)
                                    .OrderByDescending(s => s.MaxRepeatsInOneRequest).ToList();
        if (shapes.Count == 0) { Console.WriteLine("  none detected ✅"); return; }

        foreach (var s in shapes)
        {
            Console.WriteLine($"🔁 {s.MaxRepeatsInOneRequest}× the same shape in one request  ({s.TotalMs:N0} ms total over {s.Executions} execution(s))   {s.Source ?? s.RequestPath ?? "(unattributed)"}");
            Console.WriteLine($"       sql:  {Trunc(s.SampleSql, 110)}");
            Console.WriteLine($"       likely an unbatched loop — project with a join / Include, or batch the lookups.");
            await Annotate("nplusone", s, o, model, jev, report);
        }
    }

    static async Task Annotate(string investigation, ShapeFacts s, Args o, SmellModel? model, JevClient? jev, JsonArray report)
    {
        var row = new JsonObject
        {
            ["investigation"] = investigation,
            ["source"] = s.Source,
            ["shape_sha"] = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(s.Shape)))[..12],
            ["executions"] = s.Executions,
            ["max_repeats_in_one_request"] = s.MaxRepeatsInOneRequest,
            ["p50_ms"] = Math.Round(s.P50Ms, 1),
            ["p95_ms"] = Math.Round(s.P95Ms, 1),
            ["max_ms"] = Math.Round(s.MaxMs, 1),
            ["total_ms"] = Math.Round(s.TotalMs, 1),
            ["sql_sample"] = Trunc(s.SampleSql, 600),
        };

        if (model is not null)
        {
            // The 350M expert has a 1024-token window; real captures carry statements far past it.
            try
            {
                var text = await model.Classify(SmellSystem, s.SampleSql);
                Console.WriteLine($"       🧠 local: {text}");
                row["local"] = text;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"       ⚠ local: no verdict ({ex.GetType().Name})");
                row["local_error"] = ex.GetType().Name;
            }
        }

        if (jev is not null)
        {
            Dictionary<string, JevVerdict>? verdicts = null;
            try { verdicts = await jev.Decide(JevQuestions.BuildPayload(s), JevQuestions.CacheLabel(s), o.ConfidenceFloor); }
            catch (Exception ex) { Console.WriteLine($"       ⚠ jev annotation skipped ({ex.GetType().Name}: {ex.Message})"); }
            if (verdicts is null)
            {
                Console.WriteLine($"       🧠 jev: no verdict ({jev.DisabledReason ?? "call failed"}) — facts above stand on their own.");
            }
            else
            {
                var obj = new JsonObject();
                var parts = new List<string>();
                foreach (var key in new[] { "cause", "severity", "owner", "fix" })
                {
                    if (!verdicts.TryGetValue(key, out var v)) continue;
                    obj[key] = new JsonObject { ["choice"] = v.Choice, ["confidence"] = Math.Round(v.Confidence, 3), ["withheld"] = v.Withheld };
                    parts.Add(v.Withheld
                        ? $"{key}=— (withheld, conf {v.Confidence:F2} < {o.ConfidenceFloor:F2})"
                        : $"{key}={v.Choice} ({v.Confidence:F2})");
                }
                Console.WriteLine($"       🧠 jev: {string.Join("  ·  ", parts)}");
                row["jev"] = obj;
            }
        }

        report.Add(row);
    }

    static string Trunc(string s, int n)
    {
        var flat = System.Text.RegularExpressions.Regex.Replace(s, @"\s+", " ").Trim();
        return flat.Length <= n ? flat : flat[..n] + "…";
    }
}


static class Ext
{
    public static int ClampIdx(this double i, int len) => Math.Clamp((int)i, 0, len - 1);
}


// ---- tiny model (LLamaSharp + LoRA) ---------------------------------------

sealed class SmellModel : IDisposable
{
    readonly LLamaWeights _weights;
    readonly ModelParams _params;
    readonly LoraAdapter? _adapter;

    SmellModel(LLamaWeights w, ModelParams p, LoraAdapter? a) { _weights = w; _params = p; _adapter = a; }

    public static SmellModel Load(string modelPath, string? adapterPath)
    {
        var p = new ModelParams(modelPath) { ContextSize = 1024, GpuLayerCount = 99 };
        var w = LLamaWeights.LoadFromFile(p);
        LoraAdapter? a = adapterPath is not null ? w.NativeHandle.LoadLoraFromFile(adapterPath) : null;
        return new SmellModel(w, p, a);
    }

    public async Task<string> Classify(string system, string user)
    {
        var tmpl = new LLamaTemplate(_weights);
        tmpl.Add("system", system);
        tmpl.Add("user", user);
        tmpl.AddAssistant = true;
        var prompt = Encoding.UTF8.GetString(tmpl.Apply());

        using var ctx = _weights.CreateContext(_params);
        if (_adapter is { } ad) ctx.NativeHandle.SetLoraAdapters([(ad, 1.0f)]);
        var exec = new InteractiveExecutor(ctx);
        var infer = new InferenceParams
        {
            MaxTokens = 64,
            AntiPrompts = ["<|im_end|>", "\n\n"],
            SamplingPipeline = new DefaultSamplingPipeline { Temperature = 0f },
        };
        var sb = new StringBuilder();
        await foreach (var tok in exec.InferAsync(prompt, infer)) sb.Append(tok);
        var text = sb.ToString();
        var start = text.IndexOf('{');
        var end = start < 0 ? -1 : text.IndexOf('}', start);
        return start >= 0 && end > start ? text[start..(end + 1)] : text.Trim();
    }

    public void Dispose() => _weights.Dispose();
}


// ---- args ------------------------------------------------------------------

record Args(string Command, string? LogFile, string Backend, string? ModelPath, string? AdapterPath,
            double SlowMs, int Top, int NPlusOne, double ConfidenceFloor, double SpendCap, string? JsonOut)
{
    static readonly string[] Commands = ["slow", "nplusone", "all"];
    static readonly string[] Backends = ["none", "local", "jev"];

    public static Args Parse(string[] a)
    {
        string cmd = "all"; string? log = null, model = null, adapter = null, json = null;
        string backend = "none";
        double slow = 200, conf = 0.75, cap = 0.50; int top = 5, nplus = 5;
        var backendGiven = false;
        for (int i = 0; i < a.Length; i++)
        {
            switch (a[i])
            {
                case "--backend": backend = a[++i]; backendGiven = true; break;
                case "--model": model = a[++i]; break;
                case "--adapter": adapter = a[++i]; break;
                case "--slow-ms": slow = double.Parse(a[++i], CultureInfo.InvariantCulture); break;
                case "--top": top = int.Parse(a[++i]); break;
                case "--nplusone": nplus = int.Parse(a[++i]); break;
                case "--confidence": conf = double.Parse(a[++i], CultureInfo.InvariantCulture); break;
                case "--spend-cap": cap = double.Parse(a[++i], CultureInfo.InvariantCulture); break;
                case "--json": json = a[++i]; break;
                default:
                    if (Commands.Contains(a[i])) cmd = a[i];
                    else log ??= a[i];
                    break;
            }
        }
        // Back-compatible: --model without --backend keeps meaning "use the local tiny model".
        if (!backendGiven && model is not null) backend = "local";
        if (!Backends.Contains(backend)) backend = "none";
        if (model is not null && adapter is null)
        {
            var def = Path.Combine(AppContext.BaseDirectory, "models", "sql-smell.gguf");
            if (File.Exists(def)) adapter = def;
        }
        return new Args(cmd, log, backend, model, adapter, slow, top, nplus, conf, cap, json);
    }
}
