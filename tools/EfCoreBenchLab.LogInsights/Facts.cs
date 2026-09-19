using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace EfCoreBenchLab.LogInsights;

/// Deterministic evidence. Everything the model is later asked about is computed here first;
/// the model never counts, compares or arithmetics.
public sealed record ShapeFacts(
    string Shape,
    string? Source,
    string? TagContext,
    string? RequestPath,
    string SampleSql,
    int Executions,
    int DistinctRequests,
    int MaxRepeatsInOneRequest,
    double P50Ms,
    double P95Ms,
    double MaxMs,
    double TotalMs,
    SqlShapeFacts Sql);

public sealed record SqlShapeFacts(
    string Statement,
    int ProjectedColumns,
    int TableCount,
    IReadOnlyList<string> Tables,
    int InnerJoins,
    int OuterJoins,
    bool HasWhere,
    bool LeadingWildcardLike,
    bool FunctionOnFilteredColumn,
    bool ImplicitCastInPredicate,
    bool HasOffsetFetch,
    bool OffsetParameterised,
    long OffsetRows,
    int InListSize,
    bool HasDistinct,
    bool HasGroupBy,
    bool HasOrderBy,
    long TopRows,
    bool CorrelatedSubquery,
    int SubqueryCount,
    bool SelectsAllColumnsOfMultipleTables,
    bool PlanSeen,
    IReadOnlyList<string> PlanOperators);

public static class SqlFactExtractor
{
    static readonly Regex Lit = new(@"@p\d+|@__\w+|'[^']*'|\b\d+\b", RegexOptions.Compiled);
    static readonly Regex Ws = new(@"\s+", RegexOptions.Compiled);
    static readonly Regex Comment = new(@"--[^\n]*", RegexOptions.Compiled);
    static readonly Regex TableRx = new(@"(?:from|join)\s+\[(?<t>[A-Za-z0-9_]+)\]", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    static readonly Regex OffsetRx = new(@"offset\s+(?:(?<n>\d+)|@\w+)\s+rows", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    static readonly Regex SubSelectRx = new(@"\(\s*select\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    static readonly Regex TopRx = new(@"top\s*\(\s*(?<n>\d+)\s*\)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    static readonly Regex InRx = new(@"\bin\s*\(\s*(?<body>[^()]{0,20000}?)\)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    static readonly Regex ColRx = new(@"\[[A-Za-z0-9_]+\]\.\[[A-Za-z0-9_]+\]", RegexOptions.Compiled);
    static readonly Regex FuncOnCol = new(@"\b(lower|upper|ltrim|rtrim|convert|cast|datepart|year|month|day|substring|left|right|isnull|coalesce)\s*\(\s*\[", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    static readonly Regex PlanOp = new(@"PhysicalOp=""(?<op>[^""]+)""", RegexOptions.Compiled);

    /// Shape key: literals and parameters stripped. Doubles as the injection guard and the cache key.
    static readonly Regex SessionPrelude = new(@"^\s*(set\s+(statistics\s+xml|nocount|implicit_transactions)\s+\w+\s*;\s*)+", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static string Normalize(string sql)
    {
        var noComments = Comment.Replace(sql, " ");
        var body = SessionPrelude.Replace(noComments.TrimStart(), "");
        return Ws.Replace(Lit.Replace(body, "?"), " ").Trim().ToLowerInvariant();
    }

    public static SqlShapeFacts Extract(string rawSql, IReadOnlyList<string> planOperators)
    {
        var sql = Comment.Replace(rawSql, " ");
        var lower = sql.ToLowerInvariant();
        var head = lower.Length > 40000 ? lower[..40000] : lower;

        var statement = head.TrimStart() switch
        {
            var s when s.StartsWith("select") || s.Contains("select ") && s.IndexOf("select ", StringComparison.Ordinal) < 200 => "select",
            var s when s.StartsWith("insert") => "insert",
            var s when s.StartsWith("update") => "update",
            var s when s.StartsWith("delete") => "delete",
            var s when s.StartsWith("merge") || s.Contains("merge [") => "merge",
            _ => "other",
        };

        var whereIdx = head.IndexOf(" where ", StringComparison.Ordinal);
        var predicate = whereIdx >= 0 ? head[whereIdx..] : "";

        var tables = TableRx.Matches(sql).Select(m => m.Groups["t"].Value).Distinct(StringComparer.OrdinalIgnoreCase)
                            .OrderBy(t => t, StringComparer.OrdinalIgnoreCase).ToList();

        var selectListEnd = head.IndexOf("\nfrom", StringComparison.Ordinal);
        if (selectListEnd < 0) selectListEnd = head.IndexOf(" from ", StringComparison.Ordinal);
        var selectList = selectListEnd > 0 ? sql[..Math.Min(selectListEnd, sql.Length)] : sql[..Math.Min(400, sql.Length)];

        long offset = 0;
        var om = OffsetRx.Match(sql);
        var offsetParameterised = om.Success && !om.Groups["n"].Success;
        if (om.Success && om.Groups["n"].Success) offset = long.Parse(om.Groups["n"].Value, CultureInfo.InvariantCulture);
        long top = 0;
        var tm = TopRx.Match(sql); if (tm.Success) top = long.Parse(tm.Groups["n"].Value, CultureInfo.InvariantCulture);

        var inSize = LargestInListSize(sql);

        var subqueries = Math.Max(0, CountOccurrences(head, "select") - 1);
        var correlated = false;
        if (subqueries > 0)
        {
            // A nested SELECT that references an alias bound by the outer query.
            var aliases = Regex.Matches(sql, @"\bas\s+\[(?<a>[a-z][a-z0-9]{0,3})\]", RegexOptions.IgnoreCase)
                               .Select(m => m.Groups["a"].Value.ToLowerInvariant()).Distinct().ToList();
            foreach (Match sub in SubSelectRx.Matches(head))
            {
                var seg = BalancedSpan(head, sub.Index);
                var outerAliasUse = aliases.Any(a => seg.Contains($"[{a}].[", StringComparison.Ordinal)
                                                  && !seg.Contains($"as [{a}]", StringComparison.Ordinal));
                if (outerAliasUse) { correlated = true; break; }
            }
        }

        var entitiesFullyProjected = Regex.Matches(selectList, @"\[(?<a>[A-Za-z0-9_]+)\]\.\[Id\d*\]")
                                          .Select(m => m.Groups["a"].Value).Distinct().Count();

        return new SqlShapeFacts(
            Statement: statement,
            ProjectedColumns: ColRx.Matches(selectList).Count,
            TableCount: tables.Count,
            Tables: tables,
            InnerJoins: CountOccurrences(head, "inner join"),
            OuterJoins: CountOccurrences(head, "left join") + CountOccurrences(head, "outer join"),
            HasWhere: whereIdx >= 0,
            LeadingWildcardLike: Regex.IsMatch(sql, @"like\s+(?:n?'%|@\w+)", RegexOptions.IgnoreCase)
                                 && (sql.Contains("'%", StringComparison.Ordinal) || Regex.IsMatch(sql, @"like\s+@", RegexOptions.IgnoreCase)),
            FunctionOnFilteredColumn: predicate.Length > 0 && FuncOnCol.IsMatch(predicate),
            ImplicitCastInPredicate: predicate.Contains("convert(", StringComparison.Ordinal) || predicate.Contains("cast(", StringComparison.Ordinal),
            HasOffsetFetch: om.Success,
            OffsetParameterised: offsetParameterised,
            OffsetRows: offset,
            InListSize: inSize,
            HasDistinct: head.Contains("select distinct", StringComparison.Ordinal),
            HasGroupBy: head.Contains("group by", StringComparison.Ordinal),
            HasOrderBy: head.Contains("order by", StringComparison.Ordinal),
            TopRows: top,
            CorrelatedSubquery: correlated,
            SubqueryCount: subqueries,
            SelectsAllColumnsOfMultipleTables: entitiesFullyProjected > 1 && ColRx.Matches(selectList).Count >= 12,
            PlanSeen: planOperators.Count > 0,
            PlanOperators: planOperators);
    }

    public static IReadOnlyList<string> PlanOperatorsFrom(string text) =>
        PlanOp.Matches(text).Select(m => m.Groups["op"].Value).Distinct().Take(12).ToList();

    /// Widest literal IN (...) list, counted by scanning rather than a length-capped regex.
    static int LargestInListSize(string sql)
    {
        var best = 0;
        for (var i = 0; (i = sql.IndexOf("IN (", i, StringComparison.OrdinalIgnoreCase)) >= 0; i += 4)
        {
            var depth = 0; var commas = 1; var sawSelect = false;
            for (var j = i + 3; j < sql.Length; j++)
            {
                var c = sql[j];
                if (c == '(') depth++;
                else if (c == ')') { if (--depth == 0) break; }
                else if (c == ',' && depth == 1) commas++;
                else if (depth == 1 && c is 'S' or 's' && j + 6 <= sql.Length
                         && sql.AsSpan(j, 6).Equals("SELECT", StringComparison.OrdinalIgnoreCase)) { sawSelect = true; break; }
            }
            if (!sawSelect) best = Math.Max(best, commas);
        }
        return best;
    }

    /// The subquery text only, from its opening paren to the matching close.
    static string BalancedSpan(string text, int open)
    {
        var depth = 0;
        for (var i = open; i < text.Length; i++)
        {
            if (text[i] == '(') depth++;
            else if (text[i] == ')' && --depth == 0) return text[open..(i + 1)];
        }
        return text[open..];
    }

    static int CountOccurrences(string h, string needle)
    {
        int n = 0, i = 0;
        while ((i = h.IndexOf(needle, i, StringComparison.Ordinal)) >= 0) { n++; i += needle.Length; }
        return n;
    }

    static IEnumerable<int> AllIndexes(string h, string needle)
    {
        int i = 0;
        while ((i = h.IndexOf(needle, i, StringComparison.Ordinal)) >= 0) { yield return i; i += needle.Length; }
    }
}

public static class ShapeAggregator
{
    public static List<ShapeFacts> Aggregate(IEnumerable<LogEntry> entries, IReadOnlyList<string> planOperators)
    {
        var groups = entries.GroupBy(e => SqlFactExtractor.Normalize(e.Sql));
        var result = new List<ShapeFacts>();
        foreach (var g in groups)
        {
            var list = g.ToList();
            var durations = list.Select(e => e.DurationMs).OrderBy(d => d).ToArray();
            var byRequest = list.Where(e => e.RequestId is not null).GroupBy(e => e.RequestId!);
            var maxRepeat = byRequest.Any() ? byRequest.Max(r => r.Count()) : 1;
            var sample = list.OrderByDescending(e => e.DurationMs).First();
            result.Add(new ShapeFacts(
                Shape: g.Key,
                Source: list.Select(e => e.Source).FirstOrDefault(s => s is not null),
                TagContext: list.Select(e => e.TagContext).FirstOrDefault(s => s is not null),
                RequestPath: list.Select(e => e.RequestPath).FirstOrDefault(s => s is not null),
                SampleSql: sample.Sql,
                Executions: list.Count,
                DistinctRequests: byRequest.Count(),
                MaxRepeatsInOneRequest: maxRepeat,
                P50Ms: Percentile(durations, 0.50),
                P95Ms: Percentile(durations, 0.95),
                MaxMs: durations[^1],
                TotalMs: durations.Sum(),
                Sql: SqlFactExtractor.Extract(sample.Sql, planOperators)));
        }
        return result.OrderByDescending(s => s.TotalMs).ToList();
    }

    static double Percentile(double[] sorted, double q)
    {
        if (sorted.Length == 0) return 0;
        var idx = (int)Math.Ceiling(q * sorted.Length) - 1;
        return sorted[Math.Clamp(idx, 0, sorted.Length - 1)];
    }
}
