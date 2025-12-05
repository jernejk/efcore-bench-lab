using EFCorePerf.Api.Data;
using EFCorePerf.Api.Models;
using EFCorePerf.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EFCorePerf.Api.Controllers.Scenarios;

/// <summary>
/// Demonstrates the critical difference between IQueryable and IEnumerable operations.
/// IQueryable builds SQL, IEnumerable forces client-side evaluation.
/// </summary>
[ApiController]
[Route("api/scenarios/iqueryable-vs-ienumerable")]
public class IQueryableVsIEnumerableController : ControllerBase
{
    private readonly SalesDbContext _context;
    private readonly IScenarioExecutor _executor;

    public IQueryableVsIEnumerableController(SalesDbContext context, IScenarioExecutor executor)
    {
        _context = context;
        _executor = executor;
    }

    /// <summary>
    /// Naive approach: ToList().Count() - downloads ALL sales records then counts in memory.
    /// This is a disaster for performance - transfers millions of rows for just a count!
    /// </summary>
    [HttpGet("naive-count")]
    public async Task<ActionResult<ScenarioResponse<CountResult>>> NaiveCount(
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "iqueryable-vs-ienumerable",
            "naive-count",
            "ToList().Count() - downloads ALL rows, filters in C# memory (DANGER!)",
            async () =>
            {
                // DANGER: This downloads the entire Sales table!
                var allSales = await _context.Sales
                    .ToListAsync(ct);

                // Count happens in C# memory after downloading everything
                return new CountResult
                {
                    // TotalInTable = await _context.Sales.CountAsync(ct),
                    FilteredCount = allSales.Count,
                    FilterApplied = "Count all sales (but downloaded entire table)"
                };
            },
            includeExecutionPlan);

        return Ok(response);
    }

    /// <summary>
    /// Smart approach: .Count() - executes COUNT(*) in SQL, only transfers the number.
    /// This is the correct way to count records.
    /// </summary>
    [HttpGet("sql-count")]
    public async Task<ActionResult<ScenarioResponse<CountResult>>> SqlCount(
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "iqueryable-vs-ienumerable",
            "sql-count",
            "Count() - executes COUNT(*) in SQL, only number transferred",
            async () =>
            {
                var totalCount = await _context.Sales.CountAsync(ct);

                return new CountResult
                {
                    TotalInTable = totalCount,
                    FilteredCount = totalCount,
                    FilterApplied = "COUNT(*) in SQL - no data transfer"
                };
            },
            includeExecutionPlan);

        return Ok(response);
    }
}
