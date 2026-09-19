using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace EfCoreBenchLab.LogInsights;

public record LogEntry(double DurationMs, string? Source, string? TagContext, string? RequestPath, string? RequestId, string Sql);

public static partial class LogParser
{
    static readonly Regex Line = BuildRegex();
    // Structured messages keep the statement's newlines, so a `-- efbench.context:` comment stays line-scoped.
    static readonly Regex MultiLine = new(
        @"duration_ms=(?<dur>[\d.]+).*?tag_context=(?<tag>\S.*?)\s+source=(?<src>\S+)\s+sql=(?<sql>[\s\S]+)$",
        RegexOptions.Compiled);
    static readonly Regex PathRx = new(@"request_path=(?<p>\S+)", RegexOptions.Compiled);
    static readonly Regex RidRx = new(@"request_id=(?<r>\S+)", RegexOptions.Compiled);

    /// Aspire exports structured logs as JSON, where line mode both miscounts compact captures and
    /// flattens each statement onto its `-- efbench.context:` comment line. `.log` files stay on line mode.
    public static List<LogEntry> Load(string path) => LoadWithPlans(path).Entries;

    public static (List<LogEntry> Entries, List<string> PlanOperators) LoadWithPlans(string path)
    {
        var text = File.ReadAllText(path);
        if (LooksLikeJson(text))
        {
            try { return FromJson(text); } catch (JsonException) { /* malformed — fall back to line mode */ }
        }
        return (Parse(text.Split('\n')), []);
    }

    static bool LooksLikeJson(string text)
    {
        var trimmed = text.TrimStart();
        return trimmed.StartsWith('[') || trimmed.StartsWith('{');
    }

    static (List<LogEntry>, List<string>) FromJson(string text)
    {
        using var doc = JsonDocument.Parse(text);
        var entries = new List<LogEntry>();
        var plans = new List<string>();
        if (doc.RootElement.ValueKind != JsonValueKind.Array) return (entries, plans);

        foreach (var el in doc.RootElement.EnumerateArray())
        {
            if (el.ValueKind != JsonValueKind.Object) continue;
            if (!el.TryGetProperty("message", out var msg) || msg.ValueKind != JsonValueKind.String) continue;

            var raw = msg.GetString()!;
            if (raw.Contains("PhysicalOp=", StringComparison.Ordinal))
                plans.AddRange(SqlFactExtractor.PlanOperatorsFrom(raw));

            var m = MultiLine.Match(raw);
            if (!m.Success) continue;
            entries.Add(new LogEntry(
                double.Parse(m.Groups["dur"].Value, CultureInfo.InvariantCulture),
                Null(m.Groups["src"].Value), Null(m.Groups["tag"].Value),
                Cap(PathRx, raw), Cap(RidRx, raw), m.Groups["sql"].Value.Trim()));
        }
        return (entries, plans.Distinct().Take(12).ToList());
    }

    public static List<LogEntry> Parse(IEnumerable<string> lines)
    {
        var outp = new List<LogEntry>();
        foreach (var raw in lines)
        {
            var m = Line.Match(raw);
            if (!m.Success) continue;
            var dur = double.Parse(m.Groups["dur"].Value, CultureInfo.InvariantCulture);
            var sql = m.Groups["sql"].Value.Replace("\\n", " ").Trim();
            outp.Add(new LogEntry(dur, Null(m.Groups["src"].Value), Null(m.Groups["tag"].Value),
                Cap(PathRx, raw), Cap(RidRx, raw), sql));
        }
        return outp;
    }

    static string? Cap(Regex rx, string s) { var m = rx.Match(s); return m.Success ? Null(m.Groups[1].Value) : null; }
    static string? Null(string v) => string.IsNullOrEmpty(v) || v == "(null)" ? null : v;

    [GeneratedRegex(
        @"duration_ms=(?<dur>[\d.]+).*?tag_context=(?<tag>\S.*?)\s+source=(?<src>\S+)\s+sql=(?<sql>.+)$",
        RegexOptions.Compiled)]
    private static partial Regex BuildRegex();
}
