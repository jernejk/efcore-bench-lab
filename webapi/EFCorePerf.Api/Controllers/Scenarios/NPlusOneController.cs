using EFCorePerf.Api.Data;
using EFCorePerf.Api.Extensions;
using EFCorePerf.Api.Models;
using EFCorePerf.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EFCorePerf.Api.Controllers.Scenarios;

/// <summary>
/// Demonstrates the N+1 query problem - one of the most common EF Core performance issues.
/// </summary>
[ApiController]
[Route("api/scenarios/nplusone")]
public class NPlusOneController : ControllerBase
{
    private readonly SalesDbContext _context;
    private readonly IScenarioExecutor _executor;

    public NPlusOneController(SalesDbContext context, IScenarioExecutor executor)
    {
        _context = context;
        _executor = executor;
    }

    /// <summary>
    /// Worst case: Explicit loop with separate queries for each customer's sales.
    /// Results in 1 + N queries (1 for customers, N for sales).
    /// </summary>
    [HttpGet("explicit-loop")]
    public async Task<ActionResult<ScenarioResponse<List<CustomerSalesSummary>>>> ExplicitLoop(
        [FromQuery] int take = 50,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "nplusone",
            "explicit-loop",
            "Fetching related data in a foreach loop - causes N+1 queries",
            async () =>
            {
                // First query: Get customers
                var customers = await _context.Customers
                    .Take(take)
                    .TagWithExecutionPlan(includeExecutionPlan)
                    .ToListAsync(ct);

                var result = new List<CustomerSalesSummary>();

                // N more queries: Get sales for EACH customer separately
                foreach (var customer in customers)
                {
                    var sales = await _context.Sales
                        .Where(s => s.CustomerId == customer.CustomerId)
                        .ToListAsync(ct);

                    result.Add(new CustomerSalesSummary
                    {
                        CustomerId = customer.CustomerId,
                        CustomerName = $"{customer.FirstName} {customer.LastName}",
                        SalesCount = sales.Count,
                        TotalAmount = sales.Sum(s => s.TotalAmount)
                    });
                }

                return result;
            });

        return Ok(response);
    }

    /// <summary>
    /// Bad case: Using Include but still loading more data than needed.
    /// Single query but may cause cartesian explosion with multiple includes.
    /// </summary>
    [HttpGet("eager-loading")]
    public async Task<ActionResult<ScenarioResponse<List<CustomerSalesSummary>>>> EagerLoading(
        [FromQuery] int take = 50,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "nplusone",
            "eager-loading",
            "Using Include to eager load - single query but loads all columns",
            async () =>
            {
                var customers = await _context.Customers
                    .Include(c => c.Sales)
                    .Take(take)
                    .TagWithExecutionPlan(includeExecutionPlan)
                    .ToListAsync(ct);

                return customers.Select(c => new CustomerSalesSummary
                {
                    CustomerId = c.CustomerId,
                    CustomerName = $"{c.FirstName} {c.LastName}",
                    SalesCount = c.Sales.Count,
                    TotalAmount = c.Sales.Sum(s => s.TotalAmount)
                }).ToList();
            });

        return Ok(response);
    }

    /// <summary>
    /// Good case: Using projection to load only what's needed.
    /// EF Core translates aggregates to SQL - highly efficient.
    /// </summary>
    [HttpGet("projection")]
    public async Task<ActionResult<ScenarioResponse<List<CustomerSalesSummary>>>> Projection(
        [FromQuery] int take = 50,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "nplusone",
            "projection",
            "Using Select projection - single optimized query with SQL aggregates",
            async () =>
            {
                return await _context.Customers
                    .Take(take)
                    .Select(c => new CustomerSalesSummary
                    {
                        CustomerId = c.CustomerId,
                        CustomerName = c.FirstName + " " + c.LastName,
                        SalesCount = c.Sales.Count,
                        TotalAmount = c.Sales.Sum(s => s.TotalAmount)
                    })
                    .TagWithExecutionPlan(includeExecutionPlan)
                    .ToListAsync(ct);
            });

        return Ok(response);
    }

    /// <summary>
    /// Best case: Projection with AsNoTracking for read-only scenarios.
    /// Minimal memory usage, maximum performance.
    /// </summary>
    [HttpGet("projection-notracking")]
    public async Task<ActionResult<ScenarioResponse<List<CustomerSalesSummary>>>> ProjectionNoTracking(
        [FromQuery] int take = 50,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "nplusone",
            "projection-notracking",
            "Projection with AsNoTracking - best performance for read-only",
            async () =>
            {
                return await _context.Customers
                    .AsNoTracking()
                    .Take(take)
                    .Select(c => new CustomerSalesSummary
                    {
                        CustomerId = c.CustomerId,
                        CustomerName = c.FirstName + " " + c.LastName,
                        SalesCount = c.Sales.Count,
                        TotalAmount = c.Sales.Sum(s => s.TotalAmount)
                    })
                    .TagWithExecutionPlan(includeExecutionPlan)
                    .ToListAsync(ct);
            });

        return Ok(response);
    }
}

public class CustomerSalesSummary
{
    public int CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public int SalesCount { get; set; }
    public decimal TotalAmount { get; set; }
}

