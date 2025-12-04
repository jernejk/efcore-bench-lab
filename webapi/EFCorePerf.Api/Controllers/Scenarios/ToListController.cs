using EFCorePerf.Api.Data;
using EFCorePerf.Api.Data.Entities;
using EFCorePerf.Api.Extensions;
using EFCorePerf.Api.Models;
using EFCorePerf.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EFCorePerf.Api.Controllers.Scenarios;

/// <summary>
/// Demonstrates the IQueryable to IEnumerable trap - client-side evaluation disaster.
/// </summary>
[ApiController]
[Route("api/scenarios/tolist")]
public class ToListController : ControllerBase
{
    private readonly SalesDbContext _context;
    private readonly IScenarioExecutor _executor;

    public ToListController(SalesDbContext context, IScenarioExecutor executor)
    {
        _context = context;
        _executor = executor;
    }

    /// <summary>
    /// Worst case: ToList() before filtering.
    /// Downloads ALL rows then filters in C# memory.
    /// </summary>
    [HttpGet("tolist-before-filter")]
    public async Task<ActionResult<ScenarioResponse<CountResult>>> ToListBeforeFilter(
        [FromQuery] decimal minPrice = 500m,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "tolist",
            "tolist-before-filter",
            "ToList() before Where - downloads ALL data, filters in memory",
            async () =>
            {
                // DANGER: This downloads the entire table!
                var allProducts = await _context.Products
                    .TagWithExecutionPlan(includeExecutionPlan)
                    .ToListAsync(ct);

                // Filter happens in C# memory
                var expensiveProducts = allProducts
                    .Where(p => p.Price > minPrice)
                    .ToList();

                return new CountResult
                {
                    TotalInTable = allProducts.Count,
                    FilteredCount = expensiveProducts.Count,
                    FilterApplied = $"Price > {minPrice}"
                };
            });

        return Ok(response);
    }

    /// <summary>
    /// Good case: Filter in SQL then materialize.
    /// Only matching rows are downloaded.
    /// </summary>
    [HttpGet("filter-before-tolist")]
    public async Task<ActionResult<ScenarioResponse<CountResult>>> FilterBeforeToList(
        [FromQuery] decimal minPrice = 500m,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "tolist",
            "filter-before-tolist",
            "Where before ToList - filter in SQL, download only matching rows",
            async () =>
            {
                // Get total count first (separate query)
                var totalCount = await _context.Products.CountAsync(ct);

                // Filter in SQL - only matching rows downloaded
                var expensiveProducts = await _context.Products
                    .Where(p => p.Price > minPrice)
                    .TagWithExecutionPlan(includeExecutionPlan)
                    .ToListAsync(ct);

                return new CountResult
                {
                    TotalInTable = totalCount,
                    FilteredCount = expensiveProducts.Count,
                    FilterApplied = $"Price > {minPrice}"
                };
            });

        return Ok(response);
    }

    /// <summary>
    /// Best case: Use CountAsync for counting.
    /// No data transferred, just a number.
    /// </summary>
    [HttpGet("count-in-sql")]
    public async Task<ActionResult<ScenarioResponse<CountResult>>> CountInSql(
        [FromQuery] decimal minPrice = 500m,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "tolist",
            "count-in-sql",
            "CountAsync - count in SQL, only number transferred",
            async () =>
            {
                var totalCount = await _context.Products.CountAsync(ct);

                var filteredCount = await _context.Products
                    .Where(p => p.Price > minPrice)
                    .TagWithExecutionPlan(includeExecutionPlan)
                    .CountAsync(ct);

                return new CountResult
                {
                    TotalInTable = totalCount,
                    FilteredCount = filteredCount,
                    FilterApplied = $"Price > {minPrice}"
                };
            });

        return Ok(response);
    }

    /// <summary>
    /// IEnumerable trap: Method returns IEnumerable instead of IQueryable.
    /// Subsequent filters happen client-side.
    /// </summary>
    [HttpGet("ienumerable-trap")]
    public async Task<ActionResult<ScenarioResponse<SalesAnalysis>>> IEnumerableTrap(
        [FromQuery] int year = 2024,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "tolist",
            "ienumerable-trap",
            "IEnumerable return type - forces client-side evaluation",
            async () =>
            {
                // This simulates a common mistake: method returns IEnumerable
                IEnumerable<Sale> GetSales() => _context.Sales;

                // DANGER: This filter happens in C# after ALL sales are loaded!
                var salesThisYear = GetSales()
                    .Where(s => s.SaleDate.Year == year)
                    .ToList();

                return new SalesAnalysis
                {
                    Year = year,
                    SalesCount = salesThisYear.Count,
                    TotalRevenue = salesThisYear.Sum(s => s.TotalAmount),
                    Note = "Filter executed client-side - entire table was loaded"
                };
            });

        return Ok(response);
    }

    /// <summary>
    /// IQueryable correct usage: Filter stays in SQL.
    /// </summary>
    [HttpGet("iqueryable-correct")]
    public async Task<ActionResult<ScenarioResponse<SalesAnalysis>>> IQueryableCorrect(
        [FromQuery] int year = 2024,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "tolist",
            "iqueryable-correct",
            "IQueryable return type - filter stays in SQL",
            async () =>
            {
                // Correct: method returns IQueryable
                IQueryable<Sale> GetSales() => _context.Sales;

                // Filter is translated to SQL WHERE clause
                var salesThisYear = await GetSales()
                    .Where(s => s.SaleDate.Year == year)
                    .TagWithExecutionPlan(includeExecutionPlan)
                    .ToListAsync(ct);

                return new SalesAnalysis
                {
                    Year = year,
                    SalesCount = salesThisYear.Count,
                    TotalRevenue = salesThisYear.Sum(s => s.TotalAmount),
                    Note = "Filter executed in SQL - only matching rows downloaded"
                };
            });

        return Ok(response);
    }

    /// <summary>
    /// Projection with SQL aggregates - best for analytics.
    /// </summary>
    [HttpGet("aggregates-in-sql")]
    public async Task<ActionResult<ScenarioResponse<SalesAnalysis>>> AggregatesInSql(
        [FromQuery] int year = 2024,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "tolist",
            "aggregates-in-sql",
            "Aggregates in SQL - only results transferred, not raw data",
            async () =>
            {
                // All aggregation happens in SQL
                var result = await _context.Sales
                    .Where(s => s.SaleDate.Year == year)
                    .GroupBy(_ => 1) // Group all into one
                    .Select(g => new
                    {
                        Count = g.Count(),
                        TotalRevenue = g.Sum(s => s.TotalAmount)
                    })
                    .TagWithExecutionPlan(includeExecutionPlan)
                    .FirstOrDefaultAsync(ct);

                return new SalesAnalysis
                {
                    Year = year,
                    SalesCount = result?.Count ?? 0,
                    TotalRevenue = result?.TotalRevenue ?? 0,
                    Note = "Aggregates calculated in SQL - minimal data transferred"
                };
            });

        return Ok(response);
    }
}

public class CountResult
{
    public int TotalInTable { get; set; }
    public int FilteredCount { get; set; }
    public string FilterApplied { get; set; } = string.Empty;
}

public class SalesAnalysis
{
    public int Year { get; set; }
    public int SalesCount { get; set; }
    public decimal TotalRevenue { get; set; }
    public string Note { get; set; } = string.Empty;
}

