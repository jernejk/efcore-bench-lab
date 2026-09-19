using EfCoreBenchLab.LogInsights;

namespace EfCoreBenchLab.LogInsights.Tests;

public class LogParserTests
{
    static string Fixture(string name) => Path.Combine(AppContext.BaseDirectory, "fixtures", name);

    [Fact]
    public void Load_reads_every_command_in_an_aspire_json_capture()
    {
        var entries = LogParser.Load(Fixture("aspire-capture.json"));

        Assert.Equal(3, entries.Count);
        Assert.Equal(
            ["OrderSearchRepository:SearchByOverFetchingAsync:79", "OrderSearchRepository:GetDeeplyPaginatedOrdersAsync:284", null],
            entries.Select(e => e.Source));
    }

    [Fact]
    public void Line_mode_over_a_json_capture_sees_one_command_and_flattens_its_sql()
    {
        var entries = LogParser.Parse(File.ReadAllText(Fixture("aspire-capture.json")).Split('\n'));

        Assert.Single(entries);
        // Flattened, every statement line hides behind the leading `-- efbench.context:` comment.
        Assert.DoesNotContain("\n", entries[0].Sql);
    }

    [Fact]
    public void Load_keeps_statement_newlines_so_a_leading_comment_does_not_swallow_the_sql()
    {
        var entries = LogParser.Load(Fixture("aspire-capture.json"));

        var deepPagination = entries.Single(e => e.Source == "OrderSearchRepository:GetDeeplyPaginatedOrdersAsync:284");
        Assert.Contains("\n", deepPagination.Sql);
        Assert.Contains("OFFSET 40000 ROWS", deepPagination.Sql);
    }

    [Fact]
    public void Load_reads_request_scoped_fields_from_the_capture()
    {
        var entries = LogParser.Load(Fixture("aspire-capture.json"));

        var first = entries[0];
        Assert.Equal(812.30, first.DurationMs);
        Assert.Equal("/scenarios/bad/over-fetching", first.RequestPath);
        Assert.Equal("0HNTESTCAP0001:00000001", first.RequestId);
        Assert.Equal(3, entries.Select(e => e.RequestId).Distinct().Count());
    }

    [Fact]
    public void Load_still_reads_line_oriented_logs()
    {
        var entries = LogParser.Load(Fixture("sample-aspire.log"));

        Assert.Equal(12, entries.Count);
        Assert.Equal(6, entries.Count(e => e.RequestId == "0HNN1PLUSREQ:00000010"));
    }

    [Fact]
    public void Load_falls_back_to_line_mode_when_the_json_is_malformed()
    {
        var entries = LogParser.Load(Fixture("malformed-capture.json"));

        Assert.Single(entries);
    }
}
