namespace EfCoreBenchLab.Api.Features.Orders;

public sealed record OrderSearchResult(
    long OrderId,
    string Customer,
    string Region,
    string Product,
    string Category,
    int Quantity,
    decimal Total,
    DateTimeOffset OrderedAt,
    string Status,
    string SalesPerson);

public sealed record ScenarioResult(
    string Scenario,
    string Search,
    int Page,
    int PageSize,
    int Returned,
    double ElapsedMs,
    string? DiagnosticsRequestId,
    IReadOnlyDictionary<string, object?> Metrics,
    IReadOnlyList<OrderSearchResult> Rows);

public sealed record CustomerOrderCountResult(
    int CustomerId,
    string Customer,
    string Region,
    int ActiveOrderCount,
    DateTimeOffset? LatestOrderAt);

public sealed record NPlusOneScenarioResult(
    string Scenario,
    string Region,
    int CustomerCount,
    int QueryCountEstimate,
    double ElapsedMs,
    string? DiagnosticsRequestId,
    IReadOnlyList<CustomerOrderCountResult> Rows);
