using EFCorePerf.Api.Data;
using EFCorePerf.Api.Data.Entities;
using EFCorePerf.Api.Models;
using EFCorePerf.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EFCorePerf.Api.Controllers.Scenarios;

/// <summary>
/// Demonstrates pagination approaches - offset vs keyset pagination.
/// </summary>
[ApiController]
[Route("api/scenarios/pagination")]
public class PaginationController : ControllerBase
{
    private readonly SalesDbContext _context;
    private readonly IScenarioExecutor _executor;

    public PaginationController(SalesDbContext context, IScenarioExecutor executor)
    {
        _context = context;
        _executor = executor;
    }

    /// <summary>
    /// Worst case: Load ALL data then paginate in memory.
    /// Never do this - can cause OOM with large datasets.
    /// </summary>
    [HttpGet("in-memory")]
    public async Task<ActionResult<ScenarioResponse<List<SaleDto>>>> InMemoryPagination(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "pagination",
            "in-memory",
            "Loading ALL data then paginating in C# - extremely inefficient",
            async () =>
            {
                // DANGER: This loads the entire table!
                var allSales = await _context.Sales
                    .ToListAsync(ct);

                // Then paginate in memory
                return allSales
                    .OrderByDescending(s => s.SaleDate)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(s => new SaleDto
                    {
                        SalesId = s.SalesId,
                        SaleDate = s.SaleDate,
                        TotalAmount = s.TotalAmount
                    })
                    .ToList();
            },
            includeExecutionPlan);

        return Ok(response);
    }

    /// <summary>
    /// Bad case: Offset pagination using Skip/Take.
    /// Performance degrades as page number increases (O(n) complexity).
    /// </summary>
    [HttpGet("offset")]
    public async Task<ActionResult<ScenarioResponse<List<SaleDto>>>> OffsetPagination(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "pagination",
            "offset",
            $"Offset pagination (page {page}) - gets slower as page increases",
            async () =>
            {
                return await _context.Sales
                    .AsNoTracking()
                    .OrderByDescending(s => s.SaleDate)
                    .ThenByDescending(s => s.SalesId)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(s => new SaleDto
                    {
                        SalesId = s.SalesId,
                        SaleDate = s.SaleDate,
                        TotalAmount = s.TotalAmount
                    })
                    .ToListAsync(ct);
            },
            includeExecutionPlan);

        return Ok(response);
    }

    /// <summary>
    /// Good case: Keyset (cursor) pagination.
    /// Constant performance regardless of how deep you paginate (O(1) complexity).
    /// </summary>
    [HttpGet("keyset")]
    public async Task<ActionResult<ScenarioResponse<KeysetPageResult>>> KeysetPagination(
        [FromQuery] DateTime? lastSaleDate = null,
        [FromQuery] int? lastSalesId = null,
        [FromQuery] int pageSize = 20,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "pagination",
            "keyset",
            "Keyset pagination - constant time regardless of position",
            async () =>
            {
                var query = _context.Sales.AsNoTracking();

                // Apply keyset filter if we have a cursor
                if (lastSaleDate.HasValue && lastSalesId.HasValue)
                {
                    query = query.Where(s =>
                        s.SaleDate < lastSaleDate.Value ||
                        (s.SaleDate == lastSaleDate.Value && s.SalesId < lastSalesId.Value));
                }

                var sales = await query
                    .OrderByDescending(s => s.SaleDate)
                    .ThenByDescending(s => s.SalesId)
                    .Take(pageSize)
                    .Select(s => new SaleDto
                    {
                        SalesId = s.SalesId,
                        SaleDate = s.SaleDate,
                        TotalAmount = s.TotalAmount
                    })
                    .ToListAsync(ct);

                // Return cursor for next page
                var lastItem = sales.LastOrDefault();
                return new KeysetPageResult
                {
                    Data = sales,
                    NextCursor = lastItem != null
                        ? new PageCursor { SaleDate = lastItem.SaleDate, SalesId = lastItem.SalesId }
                        : null,
                    HasMore = sales.Count == pageSize
                };
            },
            includeExecutionPlan);

        return Ok(response);
    }

    /// <summary>
    /// Performance comparison helper - run offset at different depths.
    /// </summary>
    [HttpGet("offset-benchmark")]
    public async Task<ActionResult<ScenarioResponse<PaginationBenchmark>>> OffsetBenchmark(
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "pagination",
            "offset-benchmark",
            "Benchmark offset pagination at various page depths",
            async () =>
            {
                var results = new PaginationBenchmark { PageSize = pageSize };
                var pages = new[] { 1, 10, 100, 500, 1000, 2000 };

                foreach (var page in pages)
                {
                    var sw = System.Diagnostics.Stopwatch.StartNew();
                    
                    await _context.Sales
                        .AsNoTracking()
                        .OrderByDescending(s => s.SaleDate)
                        .Skip((page - 1) * pageSize)
                        .Take(pageSize)
                        .Select(s => s.SalesId)
                        .ToListAsync(ct);
                    
                    sw.Stop();
                    results.PageTimes.Add(new PageTimeSample { Page = page, DurationMs = sw.Elapsed.TotalMilliseconds });
                }

                return results;
            });

        return Ok(response);
    }
}

public class SaleDto
{
    public int SalesId { get; set; }
    public DateTime SaleDate { get; set; }
    public decimal TotalAmount { get; set; }
}

public class KeysetPageResult
{
    public List<SaleDto> Data { get; set; } = new();
    public PageCursor? NextCursor { get; set; }
    public bool HasMore { get; set; }
}

public class PageCursor
{
    public DateTime SaleDate { get; set; }
    public int SalesId { get; set; }
}

public class PaginationBenchmark
{
    public int PageSize { get; set; }
    public List<PageTimeSample> PageTimes { get; set; } = new();
}

public class PageTimeSample
{
    public int Page { get; set; }
    public double DurationMs { get; set; }
}

