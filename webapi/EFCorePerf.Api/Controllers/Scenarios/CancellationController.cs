using EFCorePerf.Api.Data;
using EFCorePerf.Api.Models;
using EFCorePerf.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EFCorePerf.Api.Controllers.Scenarios;

/// <summary>
/// Demonstrates the importance of CancellationToken usage to prevent resource waste.
/// </summary>
[ApiController]
[Route("api/scenarios/cancellation")]
public class CancellationController : ControllerBase
{
    private readonly SalesDbContext _context;
    private readonly IScenarioExecutor _executor;
    private readonly ILogger<CancellationController> _logger;

    public CancellationController(
        SalesDbContext context, 
        IScenarioExecutor executor,
        ILogger<CancellationController> logger)
    {
        _context = context;
        _executor = executor;
        _logger = logger;
    }

    /// <summary>
    /// Bad case: Heavy query without cancellation token.
    /// If user cancels request, query keeps running on SQL Server.
    /// </summary>
    [HttpGet("without-token")]
    public async Task<ActionResult<ScenarioResponse<HeavyReportResult>>> WithoutCancellationToken(
        [FromQuery] bool includeExecutionPlan = false)
    {
        // NOTE: Intentionally NOT using the CancellationToken from the request!
        var response = await _executor.ExecuteAsync(
            "cancellation",
            "without-token",
            "No CancellationToken - query runs even if request is cancelled",
            async () =>
            {
                _logger.LogInformation("Starting heavy query WITHOUT cancellation token...");

                // Simulate a heavy query - cross-join creates many rows
                var result = await _context.Sales
                    .Include(s => s.Customer)
                    .Include(s => s.Product)
                    .Include(s => s.SalesPerson)
                    .GroupBy(s => new { s.SalesPerson.Department, s.Product.Category })
                    .Select(g => new DepartmentCategorySales
                    {
                        Department = g.Key.Department ?? "Unknown",
                        Category = g.Key.Category ?? "Unknown",
                        TotalSales = g.Count(),
                        TotalRevenue = g.Sum(s => s.TotalAmount),
                        AverageOrderValue = g.Average(s => s.TotalAmount)
                    })
                    .ToListAsync(); // No CancellationToken!

                _logger.LogInformation("Heavy query completed (without token)");

                return new HeavyReportResult
                {
                    DepartmentSales = result,
                    QueryCompleted = true
                };
            },
            includeExecutionPlan);

        return Ok(response);
    }

    /// <summary>
    /// Good case: Heavy query with cancellation token.
    /// When request is cancelled, SQL Server query is also cancelled.
    /// </summary>
    [HttpGet("with-token")]
    public async Task<ActionResult<ScenarioResponse<HeavyReportResult>>> WithCancellationToken(
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken cancellationToken = default)
    {
        var response = await _executor.ExecuteAsync(
            "cancellation",
            "with-token",
            "With CancellationToken - query stops when request is cancelled",
            async () =>
            {
                _logger.LogInformation("Starting heavy query WITH cancellation token...");

                try
                {
                    var result = await _context.Sales
                        .Include(s => s.Customer)
                        .Include(s => s.Product)
                        .Include(s => s.SalesPerson)
                        .GroupBy(s => new { s.SalesPerson.Department, s.Product.Category })
                        .Select(g => new DepartmentCategorySales
                        {
                            Department = g.Key.Department ?? "Unknown",
                            Category = g.Key.Category ?? "Unknown",
                            TotalSales = g.Count(),
                            TotalRevenue = g.Sum(s => s.TotalAmount),
                            AverageOrderValue = g.Average(s => s.TotalAmount)
                        })
                    .ToListAsync(cancellationToken); // WITH CancellationToken!

                    _logger.LogInformation("Heavy query completed (with token)");

                    return new HeavyReportResult
                    {
                        DepartmentSales = result,
                        QueryCompleted = true
                    };
                }
                catch (OperationCanceledException)
                {
                    _logger.LogWarning("Query was cancelled by client");
                    throw;
                }
            },
            includeExecutionPlan);

        return Ok(response);
    }

    /// <summary>
    /// Simulated slow query for demonstration.
    /// Use this to test cancellation behavior.
    /// </summary>
    [HttpGet("slow-query")]
    public async Task<ActionResult<ScenarioResponse<SlowQueryResult>>> SlowQuery(
        [FromQuery] int delaySeconds = 10,
        CancellationToken cancellationToken = default)
    {
        var response = await _executor.ExecuteAsync(
            "cancellation",
            "slow-query",
            $"Slow query simulation ({delaySeconds}s) - test cancellation behavior",
            async () =>
            {
                _logger.LogInformation($"Starting slow query ({delaySeconds} seconds)...");
                
                var startTime = DateTime.UtcNow;
                
                // Check cancellation periodically
                for (int i = 0; i < delaySeconds * 10; i++)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    await Task.Delay(100, cancellationToken);
                }

                // Run a simple query at the end
                var count = await _context.Sales.CountAsync(cancellationToken);

                var duration = DateTime.UtcNow - startTime;
                _logger.LogInformation($"Slow query completed after {duration.TotalSeconds:F1}s");

                return new SlowQueryResult
                {
                    RecordCount = count,
                    DurationSeconds = duration.TotalSeconds,
                    WasCancelled = false
                };
            });

        return Ok(response);
    }
}

public class HeavyReportResult
{
    public List<DepartmentCategorySales> DepartmentSales { get; set; } = new();
    public bool QueryCompleted { get; set; }
}

public class DepartmentCategorySales
{
    public string Department { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public int TotalSales { get; set; }
    public decimal TotalRevenue { get; set; }
    public decimal AverageOrderValue { get; set; }
}

public class SlowQueryResult
{
    public int RecordCount { get; set; }
    public double DurationSeconds { get; set; }
    public bool WasCancelled { get; set; }
}

