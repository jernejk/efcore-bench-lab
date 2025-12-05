using EFCorePerf.Api.Data;
using EFCorePerf.Api.Data.Entities;
using EFCorePerf.Api.Models;
using EFCorePerf.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EFCorePerf.Api.Controllers.Scenarios;

/// <summary>
/// Demonstrates the difference between loop updating and ExecuteUpdate.
/// ExecuteUpdate performs updates directly in SQL without loading entities.
/// </summary>
[ApiController]
[Route("api/scenarios/update")]
public class UpdateController : ControllerBase
{
    private readonly SalesDbContext _context;
    private readonly IScenarioExecutor _executor;

    public UpdateController(SalesDbContext context, IScenarioExecutor executor)
    {
        _context = context;
        _executor = executor;
    }

    /// <summary>
    /// Bad approach: Load entities into memory, update in loop, then save.
    /// This loads all data into memory and executes multiple round trips.
    /// </summary>
    [HttpGet("loop-update")]
    public async Task<ActionResult<ScenarioResponse<UpdateResult>>> LoopUpdate(
        [FromQuery] bool isLoadFriendly = true,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "update",
            "loop-update",
            $"Loop update - loads entities into memory, updates in loop for loadFriendly={isLoadFriendly}",
            async () =>
            {
                var query = GetBaseQuery(isLoadFriendly);

                // Load all entities into memory
                var employees = await query.ToListAsync(ct);

                // Update in memory loop
                foreach (var employee in employees)
                {
                    string firstName = employee.FirstName;
                    employee.FirstName = employee.LastName;
                    employee.LastName = firstName;
                }

                // Save changes
                var affectedRows = await _context.SaveChangesAsync(ct);

                return new UpdateResult
                {
                    RowsAffected = affectedRows,
                    Operation = "SaveChanges"
                };
            },
            includeExecutionPlan);

        return Ok(response);
    }

    /// <summary>
    /// Good approach: Use ExecuteUpdate to update directly in SQL.
    /// No entities loaded into memory, single SQL statement.
    /// </summary>
    [HttpGet("execute-update")]
    public async Task<ActionResult<ScenarioResponse<UpdateResult>>> ExecuteUpdate(
        [FromQuery] bool isLoadFriendly = true,
        [FromQuery] bool includeExecutionPlan = false,
        CancellationToken ct = default)
    {
        var response = await _executor.ExecuteAsync(
            "update",
            "execute-update",
            $"ExecuteUpdate - updates directly in SQL for loadFriendly={isLoadFriendly}",
            async () =>
            {
                var query = GetBaseQuery(isLoadFriendly);

                // Update directly in SQL
                var affectedRows = await query
                    .TagWith("Swap first and last name")
                    .ExecuteUpdateAsync(x => x
                        .SetProperty(p => p.FirstName, b => b.LastName)
                        .SetProperty(p => p.LastName, b => b.FirstName), ct);

                return new UpdateResult
                {
                    RowsAffected = affectedRows,
                    Operation = "ExecuteUpdate"
                };
            },
            includeExecutionPlan);

        return Ok(response);
    }

    /// <summary>
    /// Helper method to get the base query with optional filtering.
    /// </summary>
    private IQueryable<Employee> GetBaseQuery(bool isLoadFriendly)
    {
        var query = _context.Employees.AsQueryable();

        if (isLoadFriendly)
        {
            // Only update employees with even IDs for demo purposes
            query = query.Where(x => x.EmployeeId % 2 == 0);
        }

        return query;
    }
}
