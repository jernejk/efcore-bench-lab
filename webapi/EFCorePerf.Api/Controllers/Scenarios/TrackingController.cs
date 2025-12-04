using EFCorePerf.Api.Data;
using EFCorePerf.Api.Extensions;
using EFCorePerf.Api.Models;
using EFCorePerf.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EFCorePerf.Api.Controllers.Scenarios;

/// <summary>
/// Demonstrates the impact of change tracking on read-only queries.
/// </summary>
[ApiController]
[Route("api/scenarios/tracking")]
public class TrackingController : ControllerBase
{
    private readonly SalesDbContext _context;
    private readonly IScenarioExecutor _executor;

    public TrackingController(SalesDbContext context, IScenarioExecutor executor)
    {
        _context = context;
        _executor = executor;
    }

    /// <summary>
    /// Default behavior: Change tracking enabled.
    /// EF Core creates snapshots of all entities for change detection.
    /// </summary>
    [HttpGet("tracked")]
    public async Task<ActionResult<ScenarioResponse<List<ProductDto>>>> WithTracking(
        [FromQuery] int take = 500,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "tracking",
            "tracked",
            "Default tracking - EF creates snapshots for change detection",
            async () =>
            {
                var products = await _context.Products
                    .Take(take)
                    .TagWithExecutionPlan(includeExecutionPlan)
                    .ToListAsync(ct);

                return products.Select(p => new ProductDto
                {
                    ProductId = p.ProductId,
                    Name = p.Name,
                    Price = p.Price,
                    Category = p.Category
                }).ToList();
            });

        return Ok(response);
    }

    /// <summary>
    /// Good case: AsNoTracking for read-only queries.
    /// Significantly faster and uses less memory.
    /// </summary>
    [HttpGet("no-tracking")]
    public async Task<ActionResult<ScenarioResponse<List<ProductDto>>>> NoTracking(
        [FromQuery] int take = 500,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "tracking",
            "no-tracking",
            "AsNoTracking - skips change tracking for read-only data",
            async () =>
            {
                var products = await _context.Products
                    .AsNoTracking()
                    .Take(take)
                    .TagWithExecutionPlan(includeExecutionPlan)
                    .ToListAsync(ct);

                return products.Select(p => new ProductDto
                {
                    ProductId = p.ProductId,
                    Name = p.Name,
                    Price = p.Price,
                    Category = p.Category
                }).ToList();
            });

        return Ok(response);
    }

    /// <summary>
    /// Best case: Projection directly to DTO.
    /// No entity objects created, minimal memory, optimal performance.
    /// </summary>
    [HttpGet("projection")]
    public async Task<ActionResult<ScenarioResponse<List<ProductDto>>>> Projection(
        [FromQuery] int take = 500,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "tracking",
            "projection",
            "Direct projection to DTO - best performance, minimal memory",
            async () =>
            {
                return await _context.Products
                    .Take(take)
                    .Select(p => new ProductDto
                    {
                        ProductId = p.ProductId,
                        Name = p.Name,
                        Price = p.Price,
                        Category = p.Category
                    })
                    .TagWithExecutionPlan(includeExecutionPlan)
                    .ToListAsync(ct);
            });

        return Ok(response);
    }

    /// <summary>
    /// With related data: Tracking vs NoTracking comparison.
    /// Impact is more visible with Includes.
    /// </summary>
    [HttpGet("tracked-with-relations")]
    public async Task<ActionResult<ScenarioResponse<List<ProductWithSalesDto>>>> TrackedWithRelations(
        [FromQuery] int take = 100,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "tracking",
            "tracked-with-relations",
            "Tracking with Include - more memory overhead with related entities",
            async () =>
            {
                var products = await _context.Products
                    .Include(p => p.Sales)
                    .Take(take)
                    .TagWithExecutionPlan(includeExecutionPlan)
                    .ToListAsync(ct);

                return products.Select(p => new ProductWithSalesDto
                {
                    ProductId = p.ProductId,
                    Name = p.Name,
                    Price = p.Price,
                    SalesCount = p.Sales.Count,
                    TotalRevenue = p.Sales.Sum(s => s.TotalAmount)
                }).ToList();
            });

        return Ok(response);
    }

    /// <summary>
    /// NoTracking with related data.
    /// </summary>
    [HttpGet("notracking-with-relations")]
    public async Task<ActionResult<ScenarioResponse<List<ProductWithSalesDto>>>> NoTrackingWithRelations(
        [FromQuery] int take = 100,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "tracking",
            "notracking-with-relations",
            "AsNoTracking with Include - faster and less memory",
            async () =>
            {
                var products = await _context.Products
                    .AsNoTracking()
                    .Include(p => p.Sales)
                    .Take(take)
                    .TagWithExecutionPlan(includeExecutionPlan)
                    .ToListAsync(ct);

                return products.Select(p => new ProductWithSalesDto
                {
                    ProductId = p.ProductId,
                    Name = p.Name,
                    Price = p.Price,
                    SalesCount = p.Sales.Count,
                    TotalRevenue = p.Sales.Sum(s => s.TotalAmount)
                }).ToList();
            });

        return Ok(response);
    }

    /// <summary>
    /// Projection with aggregates - best approach for reporting data.
    /// </summary>
    [HttpGet("projection-with-aggregates")]
    public async Task<ActionResult<ScenarioResponse<List<ProductWithSalesDto>>>> ProjectionWithAggregates(
        [FromQuery] int take = 100,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "tracking",
            "projection-with-aggregates",
            "Projection with SQL aggregates - best for reporting",
            async () =>
            {
                return await _context.Products
                    .Take(take)
                    .Select(p => new ProductWithSalesDto
                    {
                        ProductId = p.ProductId,
                        Name = p.Name,
                        Price = p.Price,
                        SalesCount = p.Sales.Count,
                        TotalRevenue = p.Sales.Sum(s => s.TotalAmount)
                    })
                    .TagWithExecutionPlan(includeExecutionPlan)
                    .ToListAsync(ct);
            });

        return Ok(response);
    }
}

public class ProductDto
{
    public int ProductId { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string? Category { get; set; }
}

public class ProductWithSalesDto
{
    public int ProductId { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int SalesCount { get; set; }
    public decimal TotalRevenue { get; set; }
}

