using EfCoreBenchLab.LogInsights;

namespace EfCoreBenchLab.LogInsights.Tests;

public class JevBackendTests
{
    [Fact]
    public void LoadKey_reads_only_the_environment()
    {
        var previous = Environment.GetEnvironmentVariable("OPENROUTER_API_KEY");
        try
        {
            Environment.SetEnvironmentVariable("OPENROUTER_API_KEY", null);
            Assert.Null(JevClient.LoadKey());

            Environment.SetEnvironmentVariable("OPENROUTER_API_KEY", "  sk-test-value  ");
            Assert.Equal("sk-test-value", JevClient.LoadKey());
        }
        finally { Environment.SetEnvironmentVariable("OPENROUTER_API_KEY", previous); }
    }

    [Fact]
    public async Task A_client_without_a_key_degrades_instead_of_throwing()
    {
        var dir = NewTempDir();
        using var client = new JevClient(dir, new SpendLedger(Path.Combine(dir, "ledger.jsonl"), 0.50), key: null);

        Assert.Equal("OPENROUTER_API_KEY is not set", client.DisabledReason);
        Assert.Null(await client.Decide([], "label", 0.75));
        Assert.Equal(0, client.Stats.NetCalls);
    }

    [Fact]
    public void The_ledger_stops_reserving_once_the_cap_is_reached()
    {
        var path = Path.Combine(NewTempDir(), "ledger.jsonl");
        var ledger = new SpendLedger(path, 0.10);

        Assert.True(ledger.TryReserve());
        ledger.Record("shape-a", 1000, 0.04, estimated: false);
        Assert.True(ledger.TryReserve());
        ledger.Record("shape-b", 2000, 0.07, estimated: false);
        Assert.False(ledger.TryReserve());

        Assert.Equal(0.11, new SpendLedger(path, 0.10).Total, 6);
    }

    [Fact]
    public void Plan_operators_are_recovered_from_a_capture_message()
    {
        var ops = SqlFactExtractor.PlanOperatorsFrom(
            "<RelOp PhysicalOp=\"Clustered Index Scan\" /><RelOp PhysicalOp=\"Sort\" /><RelOp PhysicalOp=\"Sort\" />");

        Assert.Equal(["Clustered Index Scan", "Sort"], ops);
    }

    static string NewTempDir()
    {
        var dir = Path.Combine(Path.GetTempPath(), "efinsights-tests", Guid.NewGuid().ToString("n"));
        Directory.CreateDirectory(dir);
        return dir;
    }
}
