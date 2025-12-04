using System.Collections.Concurrent;
using System.Data.Common;
using System.Diagnostics;
using EFCorePerf.Api.Services;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace EFCorePerf.Api.Data.Interceptors;

/// <summary>
/// Intercepts database commands to capture telemetry data including SQL, duration, and row counts.
/// </summary>
public class TelemetryInterceptor : DbCommandInterceptor
{
    private readonly IQueryLogService _queryLogService;
    private readonly ConcurrentDictionary<Guid, Stopwatch> _commandTimers = new();
    
    public TelemetryInterceptor(IQueryLogService queryLogService)
    {
        _queryLogService = queryLogService;
    }
    
    public override InterceptionResult<DbDataReader> ReaderExecuting(
        DbCommand command,
        CommandEventData eventData,
        InterceptionResult<DbDataReader> result)
    {
        StartTimer(command);
        return base.ReaderExecuting(command, eventData, result);
    }
    
    public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
        DbCommand command,
        CommandEventData eventData,
        InterceptionResult<DbDataReader> result,
        CancellationToken cancellationToken = default)
    {
        StartTimer(command);
        return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
    }
    
    public override DbDataReader ReaderExecuted(
        DbCommand command,
        CommandExecutedEventData eventData,
        DbDataReader result)
    {
        RecordQuery(command, eventData);
        return base.ReaderExecuted(command, eventData, result);
    }
    
    public override ValueTask<DbDataReader> ReaderExecutedAsync(
        DbCommand command,
        CommandExecutedEventData eventData,
        DbDataReader result,
        CancellationToken cancellationToken = default)
    {
        RecordQuery(command, eventData);
        return base.ReaderExecutedAsync(command, eventData, result, cancellationToken);
    }
    
    public override int NonQueryExecuted(
        DbCommand command,
        CommandExecutedEventData eventData,
        int result)
    {
        RecordQuery(command, eventData, result);
        return base.NonQueryExecuted(command, eventData, result);
    }
    
    public override ValueTask<int> NonQueryExecutedAsync(
        DbCommand command,
        CommandExecutedEventData eventData,
        int result,
        CancellationToken cancellationToken = default)
    {
        RecordQuery(command, eventData, result);
        return base.NonQueryExecutedAsync(command, eventData, result, cancellationToken);
    }
    
    public override object? ScalarExecuted(
        DbCommand command,
        CommandExecutedEventData eventData,
        object? result)
    {
        RecordQuery(command, eventData);
        return base.ScalarExecuted(command, eventData, result);
    }
    
    public override ValueTask<object?> ScalarExecutedAsync(
        DbCommand command,
        CommandExecutedEventData eventData,
        object? result,
        CancellationToken cancellationToken = default)
    {
        RecordQuery(command, eventData);
        return base.ScalarExecutedAsync(command, eventData, result, cancellationToken);
    }
    
    private void StartTimer(DbCommand command)
    {
        var commandId = command.GetHashCode();
        var stopwatch = Stopwatch.StartNew();
        _commandTimers[Guid.NewGuid()] = stopwatch;
    }
    
    private void RecordQuery(DbCommand command, CommandExecutedEventData eventData, int? rowsAffected = null)
    {
        var durationMs = eventData.Duration.TotalMilliseconds;
        
        // Extract parameters
        var parameters = new Dictionary<string, object?>();
        foreach (DbParameter param in command.Parameters)
        {
            parameters[param.ParameterName] = param.Value;
        }
        
        var queryLog = new QueryLogEntry
        {
            Sql = command.CommandText,
            DurationMs = durationMs,
            Parameters = parameters,
            RowsAffected = rowsAffected,
            Timestamp = DateTime.UtcNow,
            CommandType = eventData.CommandSource.ToString()
        };
        
        _queryLogService.AddQuery(queryLog);
    }
}

