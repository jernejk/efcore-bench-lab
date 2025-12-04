using System.Data.Common;
using EFCorePerf.Api.Services;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace EFCorePerf.Api.Data.Interceptors;

/// <summary>
/// Intercepts database commands to capture ACTUAL execution plans using SET STATISTICS XML ON.
/// 
/// ⚠️ IMPORTANT: This interceptor does NOT work when EnableRetryOnFailure is enabled!
/// 
/// The SqlServerExecutionStrategy (used with EnableRetryOnFailure) uses a BufferedDataReader
/// that reads ahead into result sets. When SET STATISTICS XML ON adds an extra result set
/// (the XML plan), EF Core's BufferedDataReader reads into it expecting query data columns,
/// causing: "The underlying reader doesn't have as many fields as expected. Expected: N, actual: 1."
/// 
/// Solution: Remove EnableRetryOnFailure from DbContext options when using this interceptor.
/// 
/// This interceptor captures actual execution plans with real runtime statistics including:
/// - ActualRows (real rows processed, not estimates)
/// - ActualElapsedms (real execution time)
/// - ActualLogicalReads (real I/O statistics)
/// - ActualScans (real scan count)
/// 
/// Based on: https://gist.github.com/jernejk/f52e314f68b073b8649fe78a4e0272ad
/// 
/// Usage: Enable via IQueryLogService.SetExecutionPlanEnabled(true) before executing queries.
/// The ScenarioExecutor handles this automatically when includeExecutionPlan=true is passed.
/// </summary>
public class ActualExecutionPlanInterceptor : DbCommandInterceptor
{
    private readonly IQueryLogService _queryLogService;
    
    public ActualExecutionPlanInterceptor(IQueryLogService queryLogService)
    {
        _queryLogService = queryLogService;
    }
    
    public override DbCommand CommandInitialized(CommandEndEventData eventData, DbCommand result)
    {
        // Only inject SET STATISTICS XML ON if execution plan capture is enabled
        if (_queryLogService.IsExecutionPlanEnabled())
        {
            // Prepend SET STATISTICS XML ON to capture actual execution plan
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
        TryExtractActualExecutionPlan(command, eventData);
        return base.DataReaderClosing(command, eventData, result);
    }
    
    public override ValueTask<InterceptionResult> DataReaderClosingAsync(
        DbCommand command,
        DataReaderClosingEventData eventData,
        InterceptionResult result)
    {
        TryExtractActualExecutionPlan(command, eventData);
        return base.DataReaderClosingAsync(command, eventData, result);
    }
    
    private void TryExtractActualExecutionPlan(DbCommand command, DataReaderClosingEventData eventData)
    {
        // Only process if execution plan capture is enabled
        if (!_queryLogService.IsExecutionPlanEnabled())
        {
            return;
        }
        
        try
        {
            var reader = eventData.DataReader;
            
            // The execution plan is in the next result set after the query results
            // Only attempt if the reader is not closed
            if (!reader.IsClosed && reader.NextResult() && reader.Read())
            {
                string executionPlan = reader.GetString(0);
                
                // Also store in query log service for the current request
                _queryLogService.SetLastExecutionPlan(executionPlan);
            }
        }
        catch (Exception ex)
        {
            // Log but don't fail the main query - execution plan capture is best effort
            Console.WriteLine($"[ActualExecutionPlanInterceptor] Failed to capture execution plan: {ex.Message}");
        }
    }
}
