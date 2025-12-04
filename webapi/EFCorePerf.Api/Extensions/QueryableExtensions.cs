using Microsoft.EntityFrameworkCore;

namespace EFCorePerf.Api.Extensions;

public static class QueryableExtensions
{
    /// <summary>
    /// Conditionally applies TagWith only when includeExecutionPlan is true.
    /// </summary>
    public static IQueryable<T> TagWithExecutionPlan<T>(this IQueryable<T> query, bool includeExecutionPlan)
    {
        return includeExecutionPlan 
            ? query.TagWith("IncludeExecutionPlan") 
            : query;
    }
}

