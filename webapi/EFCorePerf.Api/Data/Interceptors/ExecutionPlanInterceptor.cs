using System.Data.Common;
using EFCorePerf.Api.Services;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace EFCorePerf.Api.Data.Interceptors;

/// <summary>
/// Intercepts database commands to capture actual execution plans when requested.
/// Based on: https://gist.github.com/jernejk/f52e314f68b073b8649fe78a4e0272ad
/// 
/// Usage: Tag your query with "IncludeExecutionPlan" to capture the execution plan.
/// Example: context.Sales.TagWith("IncludeExecutionPlan").ToListAsync()
/// 
/// WARNING: This significantly slows down queries. Use only for analysis, not benchmarks.
/// </summary>
public class ExecutionPlanInterceptor : DbCommandInterceptor
{
    private const string ExecutionPlanTag = "-- IncludeExecutionPlan";
    private readonly IQueryLogService _queryLogService;
    
    public ExecutionPlanInterceptor(IQueryLogService queryLogService)
    {
        _queryLogService = queryLogService;
    }
    
    public override DbCommand CommandInitialized(CommandEndEventData eventData, DbCommand result)
    {
        if (result.CommandText.Contains(ExecutionPlanTag))
        {
            // Inject SET STATISTICS XML ON to get actual execution plan
            result.CommandText = $@"SET STATISTICS XML ON;

{result.CommandText}";
        }
        
        return base.CommandInitialized(eventData, result);
    }
    
    public override InterceptionResult DataReaderClosing(
        DbCommand command,
        DataReaderClosingEventData eventData,
        InterceptionResult result)
    {
        TryExtractExecutionPlan(command, eventData);
        return base.DataReaderClosing(command, eventData, result);
    }
    
    public override ValueTask<InterceptionResult> DataReaderClosingAsync(
        DbCommand command,
        DataReaderClosingEventData eventData,
        InterceptionResult result)
    {
        TryExtractExecutionPlan(command, eventData);
        return base.DataReaderClosingAsync(command, eventData, result);
    }
    
    private void TryExtractExecutionPlan(DbCommand command, DataReaderClosingEventData eventData)
    {
        // Only process if we injected the execution plan request
        if (!command.CommandText.Contains("SET STATISTICS XML ON"))
        {
            return;
        }
        
        try
        {
            var dataReader = eventData.DataReader;
            
            // Check if reader is still open and has more result sets
            if (!dataReader.IsClosed && dataReader.NextResult() && dataReader.Read())
            {
                var executionPlan = dataReader.GetString(0);
                
                // Store in DbContext if it implements IExecutionPlanDbContext
                if (eventData.Context is IExecutionPlanDbContext dbContext)
                {
                    dbContext.LastExecutionPlan = executionPlan;
                }
                
                // Also store in query log service for the current request
                _queryLogService.SetLastExecutionPlan(executionPlan);
            }
        }
        catch (Exception)
        {
            // Silently ignore errors - execution plan capture is best effort
        }
    }
}

