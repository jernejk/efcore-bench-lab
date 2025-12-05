using EFCorePerf.Api.Data;
using EFCorePerf.Api.Data.Entities;
using EFCorePerf.Api.Models;
using EFCorePerf.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EFCorePerf.Api.Controllers.Scenarios;

/// <summary>
/// Demonstrates Include vs Select projection patterns.
/// Include loads full entities, Select projects only needed data.
/// </summary>
[ApiController]
[Route("api/scenarios/implicit-include")]
public class ImplicitIncludeController : ControllerBase
{
    private readonly SalesDbContext _context;
    private readonly IScenarioExecutor _executor;

    public ImplicitIncludeController(SalesDbContext context, IScenarioExecutor executor)
    {
        _context = context;
        _executor = executor;
    }

    /// <summary>
    /// Bad approach: Include() then Select() in memory.
    /// Downloads full SalesPerson entities, then maps in C#.
    /// </summary>
    [HttpGet("with-include-no-select")]
    public async Task<ActionResult<ScenarioResponse<List<SalesWithSalesPerson>>>> WithIncludeNoSelect(
        [FromQuery] int salesPersonId = 1,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "implicit-include",
            "with-include-no-select",
            $"Include + Select in memory - downloads full SalesPerson entities for SalesPersonId {salesPersonId}",
            async () =>
            {
                // DANGER: Include loads full SalesPerson entities
                var dbResult = await _context.Sales
                    .AsNoTracking()
                    .Include(x => x.SalesPerson)
                    .Where(x => x.SalesPersonId == salesPersonId)
                    .ToListAsync(ct);

                // Mapping happens in C# memory
                var result = dbResult
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

                return result;
            },
            includeExecutionPlan);

        return Ok(response);
    }

    /// <summary>
    /// Good approach: Select projection directly in SQL.
    /// Only transfers the data you actually need.
    /// </summary>
    [HttpGet("without-include-with-mapping")]
    public async Task<ActionResult<ScenarioResponse<List<SalesWithSalesPerson>>>> WithoutIncludeWithMapping(
        [FromQuery] int salesPersonId = 1,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "implicit-include",
            "without-include-with-mapping",
            $"Select projection - only transfers needed data for SalesPersonId {salesPersonId}",
            async () =>
            {
                // GOOD: Project directly in SQL - no Include needed
                var result = await _context.Sales
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
                    })
                    .ToListAsync(ct);

                return result;
            },
            includeExecutionPlan);

        return Ok(response);
    }
}
