using Microsoft.EntityFrameworkCore;

namespace EFCorePerf.Api.Extensions;

public static class QueryableExtensions
{
    /// <summary>
    /// [DEPRECATED] This method is no longer needed.
    /// Execution plan capture is now handled automatically by ScenarioExecutor.
    /// Pass includeExecutionPlan to ExecuteAsync() instead.
    /// </summary>
    [Obsolete("Use ScenarioExecutor.ExecuteAsync with includeExecutionPlan parameter instead")]
    public static IQueryable<T> TagWithExecutionPlan<T>(this IQueryable<T> query, bool includeExecutionPlan)
    {
        // No longer adds tags - execution plan capture is controlled by ScenarioExecutor
        return query;
    }
}

