using EFCorePerf.Api.Data;
using EFCorePerf.Api.Data.Entities;
using EFCorePerf.Api.Models;
using EFCorePerf.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EFCorePerf.Api.Controllers.Scenarios;

/// <summary>
/// Demonstrates the critical difference between in-memory pagination and SQL pagination.
/// Loading all data then paginating in memory can be catastrophic for performance.
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
    /// Naive pagination: Load ALL data then paginate in memory.
    /// This downloads millions of rows when you only need a page!
    /// </summary>
    [HttpGet("naive-pagination")]
    public async Task<ActionResult<ScenarioResponse<PaginatedResult<SalesWithSalesPerson>>>> NaivePagination(
        [FromQuery] int salesPersonId = 1,
        [FromQuery] int page = 0,
        [FromQuery] int pageSize = 10,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "pagination",
            "naive-pagination",
            $"Naive pagination - loads ALL data for SalesPersonId {salesPersonId}, then paginates in memory (page {page}, size {pageSize})",
            async () =>
            {
                // DANGER: This loads the entire table!
                var dbResult = await _context.Sales
                    .AsNoTracking()
                    .Include(x => x.SalesPerson)
                    .Where(x => x.SalesPersonId == salesPersonId)
                    .ToListAsync(ct);

                // Paginate in memory after loading everything
                var paginatedData = dbResult
                    .Skip(page * pageSize)
                    .Take(pageSize)
                    .Select(x => new SalesWithSalesPerson
                    {
                        CustomerId = x.CustomerId,
                        SalesId = x.SalesPersonId,
                        ProductId = x.ProductId,
                        Quantity = x.Quantity,
                        SalesPersonId = x.SalesPersonId,
                        SalesPersonFirstName = x.SalesPerson.FirstName,
                        SalesPersonLastName = x.SalesPerson.LastName
                    })
                    .ToList();

                return new PaginatedResult<SalesWithSalesPerson>
                {
                    Data = paginatedData,
                    Page = page,
                    PageSize = pageSize,
                    TotalCount = dbResult.Count,
                    TotalPages = (int)Math.Ceiling(dbResult.Count / (double)pageSize)
                };
            },
            includeExecutionPlan);

        return Ok(response);
    }

    /// <summary>
    /// Smart pagination: Filter and paginate directly in SQL.
    /// Only transfers the data you actually need.
    /// </summary>
    [HttpGet("sql-pagination")]
    public async Task<ActionResult<ScenarioResponse<PaginatedResult<SalesWithSalesPerson>>>> SqlPagination(
        [FromQuery] int salesPersonId = 1,
        [FromQuery] int page = 0,
        [FromQuery] int pageSize = 10,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "pagination",
            "sql-pagination",
            $"SQL pagination - filters and paginates in database for SalesPersonId {salesPersonId} (page {page}, size {pageSize})",
            async () =>
            {
                // Build query with projection
                var query = _context.Sales
                    .AsNoTracking()
                    .Where(x => x.SalesPersonId == salesPersonId)
                    .Select(x => new SalesWithSalesPerson
                    {
                        CustomerId = x.CustomerId,
                        SalesId = x.SalesPersonId,
                        ProductId = x.ProductId,
                        Quantity = x.Quantity,
                        SalesPersonId = x.SalesPersonId,
                        SalesPersonFirstName = x.SalesPerson.FirstName,
                        SalesPersonLastName = x.SalesPerson.LastName
                    });

                // Count total records
                var totalCount = await query.CountAsync(ct);

                // Apply pagination in SQL
                var paginatedData = await query
                    .Skip(page * pageSize)
                    .Take(pageSize)
                    .ToListAsync(ct);

                return new PaginatedResult<SalesWithSalesPerson>
                {
                    Data = paginatedData,
                    Page = page,
                    PageSize = pageSize,
                    TotalCount = totalCount,
                    TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
                };
            },
            includeExecutionPlan);

        return Ok(response);
    }
}