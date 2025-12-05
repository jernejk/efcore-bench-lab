using EFCorePerf.Api.Data;
using EFCorePerf.Api.Data.Entities;
using EFCorePerf.Api.Models;
using EFCorePerf.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EFCorePerf.Api.Controllers.Scenarios;

/// <summary>
/// Demonstrates when to use AsSplitQuery() to avoid cartesian explosion.
/// Cartesian explosion occurs when JOINs create massive result sets.
/// </summary>
[ApiController]
[Route("api/scenarios/split-query")]
public class SplitQueryController : ControllerBase
{
    private readonly SalesDbContext _context;
    private readonly IScenarioExecutor _executor;

    public SplitQueryController(SalesDbContext context, IScenarioExecutor executor)
    {
        _context = context;
        _executor = executor;
    }

    /// <summary>
    /// Bad approach: Single query with cartesian explosion.
    /// When an employee has many sales, this creates a massive result set.
    /// </summary>
    [HttpGet("cartesian-explosion")]
    public async Task<ActionResult<ScenarioResponse<List<EmployerStats>>>> CartesianExplosion(
        [FromQuery] int employeeId = 1,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "split-query",
            "cartesian-explosion",
            $"Cartesian explosion - single query creates massive result set for EmployeeId {employeeId}",
            async () =>
            {
                // This creates a cartesian explosion: for each sale, the employee data is repeated
                var result = await _context.Employees
                    .AsNoTracking()
                    .Where(x => x.EmployeeId == employeeId)
                    .Select(x => new EmployerStats
                    {
                        FirstName = x.FirstName,
                        LastName = x.LastName,
                        TotalSales = x.Sales.Count,
                        Sales = x.Sales.Select(s => new SaleModel
                        {
                            SaleId = s.SalesId,
                            ProductName = s.Product.Name,
                            Quantity = s.Quantity
                        }).ToList()
                    })
                    .ToListAsync(ct);

                return result;
            },
            includeExecutionPlan);

        return Ok(response);
    }

    /// <summary>
    /// Good approach: AsSplitQuery() avoids cartesian explosion.
    /// Executes separate queries for main data and collections.
    /// </summary>
    [HttpGet("split-query")]
    public async Task<ActionResult<ScenarioResponse<List<EmployerStats>>>> SplitQuery(
        [FromQuery] int employeeId = 1,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "split-query",
            "split-query",
            $"AsSplitQuery() - separate queries avoid cartesian explosion for EmployeeId {employeeId}",
            async () =>
            {
                // AsSplitQuery() executes separate queries: one for employee, one for sales
                var result = await _context.Employees
                    .AsNoTracking()
                    .AsSplitQuery()
                    .Where(x => x.EmployeeId == employeeId)
                    .Select(x => new EmployerStats
                    {
                        FirstName = x.FirstName,
                        LastName = x.LastName,
                        TotalSales = x.Sales.Count,
                        Sales = x.Sales.Select(s => new SaleModel
                        {
                            SaleId = s.SalesId,
                            ProductName = s.Product.Name,
                            Quantity = s.Quantity
                        }).ToList()
                    })
                    .ToListAsync(ct);

                return result;
            },
            includeExecutionPlan);

        return Ok(response);
    }
}
