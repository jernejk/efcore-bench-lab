using EFCorePerf.Api.Data;
using EFCorePerf.Api.Models;
using EFCorePerf.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EFCorePerf.Api.Controllers.Scenarios;

/// <summary>
/// Demonstrates efficient bulk update patterns using ExecuteUpdate vs traditional approaches.
/// </summary>
[ApiController]
[Route("api/scenarios/updates")]
public class UpdatesController : ControllerBase
{
    private readonly SalesDbContext _context;
    private readonly IScenarioExecutor _executor;

    public UpdatesController(SalesDbContext context, IScenarioExecutor executor)
    {
        _context = context;
        _executor = executor;
    }

    /// <summary>
    /// Worst case: Load all entities, modify in loop, save.
    /// Results in N SELECT + N UPDATE statements.
    /// </summary>
    [HttpGet("select-update-save")]
    public async Task<ActionResult<ScenarioResponse<UpdateResult>>> SelectUpdateSave(
        [FromQuery] string category = "Electronics",
        [FromQuery] decimal priceIncrease = 1.00m,
        [FromQuery] int limit = 100,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "updates",
            "select-update-save",
            "Load entities, modify in loop, save - N SELECT + N UPDATE queries",
            async () =>
            {
                // Load all matching products
                var products = await _context.Products
                    .Where(p => p.Category == category)
                    .Take(limit)
                    .ToListAsync(ct);

                // Update each in memory
                foreach (var product in products)
                {
                    product.Price += priceIncrease;
                }

                // Save changes - generates N UPDATE statements
                await _context.SaveChangesAsync(ct);

                return new UpdateResult
                {
                    RowsAffected = products.Count,
                    Operation = "Price increased by " + priceIncrease
                };
            },
            includeExecutionPlan);

        return Ok(response);
    }

    /// <summary>
    /// Good case: ExecuteUpdate - single SQL UPDATE statement.
    /// EF Core 7+ feature - no entity loading required.
    /// </summary>
    [HttpGet("execute-update")]
    public async Task<ActionResult<ScenarioResponse<UpdateResult>>> ExecuteUpdate(
        [FromQuery] string category = "Electronics",
        [FromQuery] decimal priceIncrease = 1.00m,
        [FromQuery] int limit = 100,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "updates",
            "execute-update",
            "ExecuteUpdate - single SQL UPDATE, no entity loading",
            async () =>
            {
                // Get IDs to limit the update (EF Core ExecuteUpdate doesn't support Take directly in all cases)
                var productIds = await _context.Products
                    .Where(p => p.Category == category)
                    .Take(limit)
                    .Select(p => p.ProductId)
                    .ToListAsync(ct);

                // Single UPDATE statement
                var rowsAffected = await _context.Products
                    .Where(p => productIds.Contains(p.ProductId))
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(p => p.Price, p => p.Price + priceIncrease), ct);

                return new UpdateResult
                {
                    RowsAffected = rowsAffected,
                    Operation = "Price increased by " + priceIncrease
                };
            },
            includeExecutionPlan);

        return Ok(response);
    }

    /// <summary>
    /// Delete example - traditional approach.
    /// </summary>
    [HttpDelete("select-delete")]
    public async Task<ActionResult<ScenarioResponse<UpdateResult>>> SelectDelete(
        [FromQuery] int maxQuantity = 1,
        [FromQuery] int limit = 50,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "updates",
            "select-delete",
            "Load entities then remove - N SELECT + N DELETE queries",
            async () =>
            {
                var salesToDelete = await _context.Sales
                    .Where(s => s.Quantity <= maxQuantity)
                    .Take(limit)
                    .ToListAsync(ct);

                _context.Sales.RemoveRange(salesToDelete);
                await _context.SaveChangesAsync(ct);

                return new UpdateResult
                {
                    RowsAffected = salesToDelete.Count,
                    Operation = $"Deleted sales with quantity <= {maxQuantity}"
                };
            });

        return Ok(response);
    }

    /// <summary>
    /// Delete example - ExecuteDelete.
    /// </summary>
    [HttpDelete("execute-delete")]
    public async Task<ActionResult<ScenarioResponse<UpdateResult>>> ExecuteDelete(
        [FromQuery] int maxQuantity = 1,
        [FromQuery] int limit = 50,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "updates",
            "execute-delete",
            "ExecuteDelete - single DELETE statement",
            async () =>
            {
                // Get IDs to limit the delete
                var saleIds = await _context.Sales
                    .Where(s => s.Quantity <= maxQuantity)
                    .Take(limit)
                    .Select(s => s.SalesId)
                    .ToListAsync(ct);

                var rowsAffected = await _context.Sales
                    .Where(s => saleIds.Contains(s.SalesId))
                    .ExecuteDeleteAsync(ct);

                return new UpdateResult
                {
                    RowsAffected = rowsAffected,
                    Operation = $"Deleted sales with quantity <= {maxQuantity}"
                };
            });

        return Ok(response);
    }

    /// <summary>
    /// Reset prices to restore test data.
    /// </summary>
    [HttpGet("reset-prices")]
    public async Task<ActionResult<ScenarioResponse<UpdateResult>>> ResetPrices(
        [FromQuery] string category = "Electronics",
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "updates",
            "reset-prices",
            "Reset prices to original values",
            async () =>
            {
                // Simple reset - set all prices in category to a base value
                var rowsAffected = await _context.Products
                    .Where(p => p.Category == category)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(p => p.Price, p => 99.99m + (p.ProductId % 100)), ct);

                return new UpdateResult
                {
                    RowsAffected = rowsAffected,
                    Operation = "Prices reset"
                };
            });

        return Ok(response);
    }
}

public class UpdateResult
{
    public int RowsAffected { get; set; }
    public string Operation { get; set; } = string.Empty;
}

