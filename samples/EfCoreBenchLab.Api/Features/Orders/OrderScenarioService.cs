using System.Diagnostics;
using EfCoreBenchLab.Diagnostics;

namespace EfCoreBenchLab.Api.Features.Orders;

public sealed class OrderScenarioService(
    OrderSearchRepository repository,
    EfDiagnosticsContextAccessor diagnosticsContextAccessor)
{
    public async Task<ScenarioResult> RunRecentPaidOrdersAsync(
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();
        var rows = await repository.GetRecentPaidOrdersAsync(page, pageSize, cancellationToken);
        stopwatch.Stop();

        return new ScenarioResult(
            "normal-recent-paid-orders",
            "Paid",
            page,
            pageSize,
            rows.Count,
            stopwatch.Elapsed.TotalMilliseconds,
            diagnosticsContextAccessor.Current?.RequestId,
            new Dictionary<string, object?>
            {
                ["expectedShape"] = "single bounded SQL query with server-side filter, order, skip, and take"
            },
            rows);
    }

    public async Task<ScenarioResult> RunBadQueryAsync(
        string search,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();
        var rows = await repository.SearchWithKnownPerformanceProblemAsync(search, page, pageSize, cancellationToken);
        stopwatch.Stop();

        return new ScenarioResult(
            "deep-bad-query",
            search,
            page,
            pageSize,
            rows.Count,
            stopwatch.Elapsed.TotalMilliseconds,
            diagnosticsContextAccessor.Current?.RequestId,
            new Dictionary<string, object?>
            {
                ["expectedProblem"] = "wildcard LIKE over computed joined text plus sort before paging"
            },
            rows);
    }

    public async Task<ScenarioResult> RunOverFetchingQueryAsync(
        string search,
        int page,
        int pageSize,
        int fetchCount,
        CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();
        var result = await repository.SearchByOverFetchingAsync(search, page, pageSize, fetchCount, cancellationToken);
        stopwatch.Stop();

        return new ScenarioResult(
            "bad-over-fetching",
            search,
            page,
            pageSize,
            result.ReturnedRows.Count,
            stopwatch.Elapsed.TotalMilliseconds,
            diagnosticsContextAccessor.Current?.RequestId,
            new Dictionary<string, object?>
            {
                ["expectedProblem"] = "fetches a broad joined row set and filters/pages in application memory",
                ["fetchedRows"] = result.FetchedRows,
                ["matchedRowsAfterClientFilter"] = result.MatchedRows
            },
            result.ReturnedRows);
    }

    public async Task<ScenarioResult> RunHealthyQueryAsync(
        int customerId,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();
        var rows = await repository.SearchWithIndexedPathAsync(customerId, pageSize, cancellationToken);
        stopwatch.Stop();

        return new ScenarioResult(
            "healthy-query",
            customerId.ToString(),
            0,
            pageSize,
            rows.Count,
            stopwatch.Elapsed.TotalMilliseconds,
            diagnosticsContextAccessor.Current?.RequestId,
            new Dictionary<string, object?>
            {
                ["expectedShape"] = "single bounded SQL query using CustomerId and OrderedAt index"
            },
            rows);
    }

    public async Task<NPlusOneScenarioResult> RunNPlusOneQueryAsync(
        string region,
        int customerCount,
        CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();
        var rows = await repository.CountOrdersWithNPlusOneAsync(region, customerCount, cancellationToken);
        stopwatch.Stop();

        return new NPlusOneScenarioResult(
            "bad-n-plus-one",
            region,
            rows.Count,
            1 + rows.Count * 2,
            stopwatch.Elapsed.TotalMilliseconds,
            diagnosticsContextAccessor.Current?.RequestId,
            rows);
    }
}
