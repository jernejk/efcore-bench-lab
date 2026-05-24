using EfCoreBenchLab.Api.Features.Orders;

namespace EfCoreBenchLab.Api.Features.Scenarios;

public static class ScenarioEndpointExtensions
{
    public static IEndpointRouteBuilder MapOrderScenarioEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var scenarios = endpoints.MapGroup("/scenarios");

        scenarios.MapGet("/deep-bad-query", async (
            string? search,
            int? page,
            int? pageSize,
            OrderScenarioService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.RunBadQueryAsync(
                string.IsNullOrWhiteSpace(search) ? "road" : search,
                Math.Max(0, page ?? 25),
                Math.Clamp(pageSize ?? 25, 1, 100),
                cancellationToken);

            return Results.Ok(result);
        });

        scenarios.MapGet("/normal/recent-paid-orders", async (
            int? page,
            int? pageSize,
            OrderScenarioService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.RunRecentPaidOrdersAsync(
                Math.Max(0, page ?? 0),
                Math.Clamp(pageSize ?? 25, 1, 100),
                cancellationToken);

            return Results.Ok(result);
        });

        scenarios.MapGet("/healthy-query", async (
            int? customerId,
            int? pageSize,
            OrderScenarioService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.RunHealthyQueryAsync(
                Math.Max(1, customerId ?? 42),
                Math.Clamp(pageSize ?? 25, 1, 100),
                cancellationToken);

            return Results.Ok(result);
        });

        scenarios.MapGet("/normal/customer-orders", async (
            int? customerId,
            int? pageSize,
            OrderScenarioService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.RunHealthyQueryAsync(
                Math.Max(1, customerId ?? 42),
                Math.Clamp(pageSize ?? 25, 1, 100),
                cancellationToken);

            return Results.Ok(result);
        });

        scenarios.MapGet("/bad/wildcard-search", async (
            string? search,
            int? page,
            int? pageSize,
            OrderScenarioService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.RunBadQueryAsync(
                string.IsNullOrWhiteSpace(search) ? "road" : search,
                Math.Max(0, page ?? 25),
                Math.Clamp(pageSize ?? 25, 1, 100),
                cancellationToken);

            return Results.Ok(result);
        });

        scenarios.MapGet("/bad/over-fetching", async (
            string? search,
            int? page,
            int? pageSize,
            int? fetchCount,
            OrderScenarioService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.RunOverFetchingQueryAsync(
                string.IsNullOrWhiteSpace(search) ? "road" : search,
                Math.Max(0, page ?? 0),
                Math.Clamp(pageSize ?? 25, 1, 100),
                Math.Clamp(fetchCount ?? 5_000, 1_000, 5_000),
                cancellationToken);

            return Results.Ok(result);
        });

        scenarios.MapGet("/bad/n-plus-one", async (
            string? region,
            int? customerCount,
            OrderScenarioService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.RunNPlusOneQueryAsync(
                string.IsNullOrWhiteSpace(region) ? "Queensland" : region,
                Math.Clamp(customerCount ?? 8, 1, 25),
                cancellationToken);

            return Results.Ok(result);
        });

        endpoints.MapGet("/", () => Results.Ok(new
        {
            application = "EF Core Bench Lab",
            normalScenarios = new[]
            {
                "/scenarios/normal/customer-orders?customerId=42&pageSize=25",
                "/scenarios/normal/recent-paid-orders?page=0&pageSize=25"
            },
            badScenarios = new[]
            {
                "/scenarios/bad/wildcard-search?search=road&page=25&pageSize=25",
                "/scenarios/bad/over-fetching?search=road&fetchCount=5000&page=0&pageSize=25",
                "/scenarios/bad/n-plus-one?region=Queensland&customerCount=8"
            },
            executionPlanHeader = "X-EF-Include-Execution-Plan: true",
            diagnostics = "Use Aspire logs or OpenTelemetry records for request_id, tag_context, source, and execution_plan_xml_chunk."
        }));

        return endpoints;
    }
}
