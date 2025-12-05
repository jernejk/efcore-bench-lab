using EFCorePerf.Api.Data;
using EFCorePerf.Api.Models;
using EFCorePerf.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EFCorePerf.Api.Controllers.Scenarios;

/// <summary>
/// Demonstrates the performance impact of AsNoTracking() for read-only queries.
/// Without AsNoTracking, EF Core tracks changes to entities in memory.
/// </summary>
[ApiController]
[Route("api/scenarios/asnotracking")]
public class AsNoTrackingController : ControllerBase
{
    private readonly SalesDbContext _context;
    private readonly IScenarioExecutor _executor;

    public AsNoTrackingController(SalesDbContext context, IScenarioExecutor executor)
    {
        _context = context;
        _executor = executor;
    }

    /// <summary>
    /// With tracking: EF Core tracks all entities for change detection.
    /// This uses more memory and CPU, especially for large result sets.
    /// </summary>
    [HttpGet("with-tracking")]
    public async Task<ActionResult<ScenarioResponse<CountResult>>> WithTracking(
        [FromQuery] int customerId = 7,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "asnotracking",
            "with-tracking",
            $"With tracking - EF tracks entities for CustomerId {customerId} (uses more memory)",
            async () =>
            {
                // Without AsNoTracking - EF Core tracks all entities
                var salesCount = await _context.Sales
                    .Where(x => x.CustomerId == customerId)
                    .CountAsync(ct);

                return new CountResult
                {
                    TotalInTable = await _context.Sales.CountAsync(ct),
                    FilteredCount = salesCount,
                    FilterApplied = $"CustomerId == {customerId} (with change tracking)"
                };
            },
            includeExecutionPlan);

        return Ok(response);
    }

    /// <summary>
    /// No tracking: AsNoTracking() tells EF Core not to track entities.
    /// This is faster and uses less memory for read-only queries.
    /// </summary>
    [HttpGet("no-tracking")]
    public async Task<ActionResult<ScenarioResponse<CountResult>>> NoTracking(
        [FromQuery] int customerId = 7,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "asnotracking",
            "no-tracking",
            $"AsNoTracking() - no change tracking for CustomerId {customerId} (faster, less memory)",
            async () =>
            {
                // With AsNoTracking - EF Core doesn't track entities
                var salesCount = await _context.Sales
                    .AsNoTracking()
                    .Where(x => x.CustomerId == customerId)
                    .CountAsync(ct);

                return new CountResult
                {
                    TotalInTable = await _context.Sales.CountAsync(ct),
                    FilteredCount = salesCount,
                    FilterApplied = $"CustomerId == {customerId} (no change tracking)"
                };
            },
            includeExecutionPlan);

        return Ok(response);
    }
}
