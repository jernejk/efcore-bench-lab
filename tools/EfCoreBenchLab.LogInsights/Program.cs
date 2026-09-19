using System.Globalization;
using EfCoreBenchLab.LogInsights;
using System.Text;
using System.Text.RegularExpressions;
using LLama;
using LLama.Common;
using LLama.Native;
using LLama.Sampling;

// efinsights — Aspire / EF Core log investigations.
// Each investigation pairs deterministic code (parse, scan, group, count) with a
// tiny local LFM2.5 LoRA expert for the judgement call. Fully offline, $0.
//
//   efinsights <command> <log-file> [--model base.gguf] [--adapter a.gguf]
//              [--slow-ms 200] [--top 5] [--nplusone 5]
//
//   commands:  slow       top slow app queries + SQL-smell + fix hint
//              nplusone   requests firing the same query many times (N+1) + fix
//              all        run every investigation (default)

NativeLibraryConfig.All.WithLogCallback((level, message) => { });

var opts = Args.Parse(args);
if (opts.LogFile is null)
{
    Console.Error.WriteLine("usage: efinsights [slow|nplusone|all] <log-file> [--model base.gguf] [--slow-ms 200] [--top 5] [--nplusone 5]");
    return 1;
}

var entries = LogParser.Load(opts.LogFile);
Console.WriteLine($"\nScanned {entries.Count} EF command(s) from {Path.GetFileName(opts.LogFile)}  ·  investigation: {opts.Command}");

SmellModel? model = null;
if (opts.ModelPath is not null)
{
    Console.WriteLine($"Loading {Path.GetFileName(opts.ModelPath)} + {Path.GetFileName(opts.AdapterPath ?? "(no adapter)")} …");
    model = SmellModel.Load(opts.ModelPath, opts.AdapterPath);
}

if (opts.Command is "slow" or "all") await Investigations.SlowQueries(entries, opts, model);
if (opts.Command is "nplusone" or "all") await Investigations.NPlusOne(entries, opts, model);

model?.Dispose();
return 0;


static class Investigations
{
    const string SmellSystem =
        "You classify the dominant performance smell in one SQL statement. Respond with ONLY JSON: " +
        "{\"smell\":\"leading_wildcard|function_on_column|select_star|missing_where|implicit_cast|" +
        "cartesian_join|offset_paging|none\",\"sargable\":true|false,\"severity\":\"low|medium|high\"," +
        "\"fix_hint\":\"add_index|rewrite_predicate|add_filter|limit_columns|use_keyset|none\"}";

    // 1) Slow app queries: deterministic locate (duration + source, skip infra) → model smell.
    public static async Task SlowQueries(List<LogEntry> entries, Args o, SmellModel? model)
    {
        var slow = entries
            .Where(e => e.DurationMs >= o.SlowMs && e.Source is not null)
            .OrderByDescending(e => e.DurationMs).Take(o.Top).ToList();

        Console.WriteLine($"\n── slow queries (> {o.SlowMs:N0} ms, app-owned) ──");
        if (slow.Count == 0) { Console.WriteLine("  none — healthy run ✅"); return; }

        int rank = 1;
        foreach (var e in slow)
        {
            var dot = e.DurationMs >= 1000 ? "🔴" : e.DurationMs >= 300 ? "🟠" : "🟡";
            Console.WriteLine($"{dot} #{rank++}  {e.DurationMs,8:N0} ms   {e.Source}");
            if (e.RequestPath is not null) Console.WriteLine($"       path: {e.RequestPath}");
            Console.WriteLine($"       sql:  {Trunc(e.Sql, 110)}");
            if (model is not null) Console.WriteLine($"       🧠 {await model.Classify(SmellSystem, e.Sql)}");
        }
    }

    // 2) N+1: deterministic — within one request, the same query SHAPE fired many times.
    //    Pure code finds the pattern (group + normalize + count); the model explains the query.
    public static async Task NPlusOne(List<LogEntry> entries, Args o, SmellModel? model)
    {
        Console.WriteLine($"\n── N+1 query patterns (same shape ≥ {o.NPlusOne}× in one request) ──");
        var clusters =
            from e in entries
            where e.RequestId is not null
            group e by (e.RequestId, Shape: Normalize(e.Sql)) into g
            where g.Count() >= o.NPlusOne
            select new { g.Key.RequestId, g.Key.Shape, Count = g.Count(),
                         TotalMs = g.Sum(x => x.DurationMs), Sample = g.First() };

        var found = clusters.OrderByDescending(c => c.Count).ToList();
        if (found.Count == 0) { Console.WriteLine("  none detected ✅"); return; }

        foreach (var c in found)
        {
            Console.WriteLine($"🔁 {c.Count}× the same query  ({c.TotalMs:N0} ms total)   {c.Sample.Source ?? c.Sample.RequestPath ?? c.RequestId}");
            Console.WriteLine($"       sql:  {Trunc(c.Sample.Sql, 110)}");
            Console.WriteLine($"       likely an unbatched loop — project with a join / Include, or batch the lookups.");
            if (model is not null) Console.WriteLine($"       🧠 {await model.Classify(SmellSystem, c.Sample.Sql)}");
        }
    }

    static string Trunc(string s, int n) => s.Length <= n ? s : s[..n] + "…";

    // Normalize a SQL statement to its shape: strip literals/params so Id=1 and Id=2 match.
    static readonly Regex Lit = new(@"@p\d+|'[^']*'|\b\d+\b", RegexOptions.Compiled);
    static readonly Regex Ws = new(@"\s+", RegexOptions.Compiled);
    static string Normalize(string sql) => Ws.Replace(Lit.Replace(sql, "?"), " ").Trim().ToLowerInvariant();
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

record Args(string Command, string? LogFile, string? ModelPath, string? AdapterPath, double SlowMs, int Top, int NPlusOne)
{
    static readonly string[] Commands = ["slow", "nplusone", "all"];

    public static Args Parse(string[] a)
    {
        string cmd = "all"; string? log = null, model = null, adapter = null;
        double slow = 200; int top = 5, nplus = 5;
        for (int i = 0; i < a.Length; i++)
        {
            switch (a[i])
            {
                case "--model": model = a[++i]; break;
                case "--adapter": adapter = a[++i]; break;
                case "--slow-ms": slow = double.Parse(a[++i], CultureInfo.InvariantCulture); break;
                case "--top": top = int.Parse(a[++i]); break;
                case "--nplusone": nplus = int.Parse(a[++i]); break;
                default:
                    if (Commands.Contains(a[i])) cmd = a[i];
                    else log ??= a[i];
                    break;
            }
        }
        if (model is not null && adapter is null)
        {
            var def = Path.Combine(AppContext.BaseDirectory, "models", "sql-smell.gguf");
            if (File.Exists(def)) adapter = def;
        }
        return new Args(cmd, log, model, adapter, slow, top, nplus);
    }
}
