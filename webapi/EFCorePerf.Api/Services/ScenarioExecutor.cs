using System.Diagnostics;
using EFCorePerf.Api.Models;

namespace EFCorePerf.Api.Services;

/// <summary>
/// Helper service to execute scenarios and build standardized responses.
/// </summary>
public interface IScenarioExecutor
{
    Task<ScenarioResponse<T>> ExecuteAsync<T>(
        string scenario,
        string variant,
        string? description,
        Func<Task<T>> action);
}

public class ScenarioExecutor : IScenarioExecutor
{
    private readonly IQueryLogService _queryLogService;
    
    public ScenarioExecutor(IQueryLogService queryLogService)
    {
        _queryLogService = queryLogService;
    }
    
    public async Task<ScenarioResponse<T>> ExecuteAsync<T>(
        string scenario,
        string variant,
        string? description,
        Func<Task<T>> action)
    {
        var requestId = _queryLogService.GetCurrentRequestId() ?? Guid.NewGuid().ToString("N");
        var startMemory = GC.GetTotalMemory(false);
        var stopwatch = Stopwatch.StartNew();
        
        // Execute the scenario
        var result = await action();
        
        stopwatch.Stop();
        var endMemory = GC.GetTotalMemory(false);
        
        // Get query logs for this request
        var queries = _queryLogService.GetQueriesForRequest(requestId);
        var metrics = _queryLogService.GetMetricsForRequest(requestId);
        
        // Calculate rows returned (if result is IEnumerable, count it)
        var rowsReturned = result switch
        {
            System.Collections.ICollection collection => collection.Count,
            System.Collections.IEnumerable enumerable => enumerable.Cast<object>().Count(),
            _ => 1
        };
        
        return new ScenarioResponse<T>
        {
            RequestId = requestId,
            Scenario = scenario,
            Variant = variant,
            VariantDescription = description,
            Result = result,
            Metrics = new ScenarioMetrics
            {
                DurationMs = stopwatch.Elapsed.TotalMilliseconds,
                QueryCount = metrics?.QueryCount ?? queries.Count,
                RowsReturned = rowsReturned,
                MemoryAllocatedBytes = Math.Max(0, endMemory - startMemory)
            },
            Queries = queries.Select(q => new QueryInfo
            {
                Sql = q.Sql,
                DurationMs = q.DurationMs,
                Parameters = q.Parameters,
                ExecutionPlan = q.ExecutionPlan
            }).ToList()
        };
    }
}

