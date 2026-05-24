using System.Data.Common;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using EfCoreBenchLab.Diagnostics.Options;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EfCoreBenchLab.Diagnostics.EntityFrameworkCore;

/// <summary>
/// Intercepts EF Core commands so opted-in HTTP requests can capture SQL Server actual execution plans.
/// </summary>
/// <remarks>
/// This interceptor uses <c>SET STATISTICS XML ON</c>, which appends the actual execution plan as an
/// extra result set after the query result. SQL Server retry buffering, including
/// <c>EnableRetryOnFailure</c>, is not compatible with this because EF Core's buffered reader can read
/// ahead into the plan result set while expecting the original query shape.
///
/// Actual execution plans are valuable because they include runtime facts such as actual rows, elapsed
/// time, logical reads, and scan counts. Capture is best-effort and must never break the application
/// query if SQL Server or the provider changes the result-set shape.
/// </remarks>
public sealed class EfDiagnosticsInterceptor(
    EfDiagnosticsContextAccessor contextAccessor,
    IOptions<EfDiagnosticsOptions> options,
    ILogger<EfDiagnosticsInterceptor> logger) : DbCommandInterceptor
{
    public override InterceptionResult<DbDataReader> ReaderExecuting(
        DbCommand command,
        CommandEventData eventData,
        InterceptionResult<DbDataReader> result)
    {
        EnableActualExecutionPlan(command);
        return base.ReaderExecuting(command, eventData, result);
    }

    public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
        DbCommand command,
        CommandEventData eventData,
        InterceptionResult<DbDataReader> result,
        CancellationToken cancellationToken = default)
    {
        EnableActualExecutionPlan(command);
        return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
    }

    public override DbDataReader ReaderExecuted(
        DbCommand command,
        CommandExecutedEventData eventData,
        DbDataReader result)
    {
        RecordCommand(command, eventData);
        return base.ReaderExecuted(command, eventData, result);
    }

    public override ValueTask<DbDataReader> ReaderExecutedAsync(
        DbCommand command,
        CommandExecutedEventData eventData,
        DbDataReader result,
        CancellationToken cancellationToken = default)
    {
        RecordCommand(command, eventData);
        return base.ReaderExecutedAsync(command, eventData, result, cancellationToken);
    }

    public override int NonQueryExecuted(
        DbCommand command,
        CommandExecutedEventData eventData,
        int result)
    {
        RecordCommand(command, eventData);
        return base.NonQueryExecuted(command, eventData, result);
    }

    public override ValueTask<int> NonQueryExecutedAsync(
        DbCommand command,
        CommandExecutedEventData eventData,
        int result,
        CancellationToken cancellationToken = default)
    {
        RecordCommand(command, eventData);
        return base.NonQueryExecutedAsync(command, eventData, result, cancellationToken);
    }

    public override object? ScalarExecuted(
        DbCommand command,
        CommandExecutedEventData eventData,
        object? result)
    {
        RecordCommand(command, eventData);
        return base.ScalarExecuted(command, eventData, result);
    }

    public override ValueTask<object?> ScalarExecutedAsync(
        DbCommand command,
        CommandExecutedEventData eventData,
        object? result,
        CancellationToken cancellationToken = default)
    {
        RecordCommand(command, eventData);
        return base.ScalarExecutedAsync(command, eventData, result, cancellationToken);
    }

    public override InterceptionResult DataReaderClosing(
        DbCommand command,
        DataReaderClosingEventData eventData,
        InterceptionResult result)
    {
        CaptureExecutionPlan(command, eventData.CommandId, eventData.DataReader);
        return base.DataReaderClosing(command, eventData, result);
    }

    public override ValueTask<InterceptionResult> DataReaderClosingAsync(
        DbCommand command,
        DataReaderClosingEventData eventData,
        InterceptionResult result)
    {
        CaptureExecutionPlan(command, eventData.CommandId, eventData.DataReader);
        return base.DataReaderClosingAsync(command, eventData, result);
    }

    private void EnableActualExecutionPlan(DbCommand command)
    {
        if (!ShouldCaptureExecutionPlan() || command.CommandText.StartsWith("SET STATISTICS XML ON;", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        // SET STATISTICS XML ON returns the actual execution plan as an extra result set after
        // the normal query results. Capture must later drain the user result set before reading it.
        command.CommandText = $"SET STATISTICS XML ON;{Environment.NewLine}{Environment.NewLine}{command.CommandText}";
    }

    private bool ShouldCaptureExecutionPlan()
    {
        return options.Value.EnableExecutionPlanCapture
            && contextAccessor.Current?.IncludeExecutionPlan == true;
    }

    private void RecordCommand(DbCommand command, CommandExecutedEventData eventData)
    {
        var requestContext = contextAccessor.Current;
        var tagContext = TryGetTagValue(command.CommandText, "efbench.context:");
        var sourceLocation = QuerySourceLocation.Parse(TryGetTagValue(command.CommandText, "efbench.source:"));

        if (requestContext is null && tagContext is null)
        {
            return;
        }

        Activity.Current?.SetTag("efbench.request_id", requestContext?.RequestId);
        Activity.Current?.SetTag("efbench.include_execution_plan", requestContext?.IncludeExecutionPlan ?? false);
        Activity.Current?.SetTag("efbench.query_context", tagContext);
        Activity.Current?.SetTag("efbench.source", sourceLocation?.ToString());

        if (options.Value.IncludeSqlInLogs)
        {
            logger.LogInformation(
                "EF command executed request_id={request_id} include_execution_plan={include_execution_plan} command_id={command_id} duration_ms={duration_ms} tag_context={tag_context} source={source} sql={sql}",
                requestContext?.RequestId,
                requestContext?.IncludeExecutionPlan ?? false,
                eventData.CommandId,
                eventData.Duration.TotalMilliseconds,
                tagContext,
                sourceLocation,
                command.CommandText);
        }
        else
        {
            logger.LogInformation(
                "EF command executed request_id={request_id} include_execution_plan={include_execution_plan} command_id={command_id} duration_ms={duration_ms} tag_context={tag_context} source={source}",
                requestContext?.RequestId,
                requestContext?.IncludeExecutionPlan ?? false,
                eventData.CommandId,
                eventData.Duration.TotalMilliseconds,
                tagContext,
                sourceLocation);
        }
    }

    private void CaptureExecutionPlan(DbCommand command, Guid commandId, DbDataReader reader)
    {
        if (!ShouldCaptureExecutionPlan() || reader.IsClosed)
        {
            return;
        }

        try
        {
            // EF Core hands us the reader while the application result may still be open. The plan is
            // not available until all prior result sets are drained and the Showplan result set is reached.
            var executionPlanXml = TryReadExecutionPlan(reader);
            if (string.IsNullOrWhiteSpace(executionPlanXml))
            {
                return;
            }

            var requestContext = contextAccessor.Current;
            var tagContext = TryGetTagValue(command.CommandText, "efbench.context:");
            var sourceLocation = QuerySourceLocation.Parse(TryGetTagValue(command.CommandText, "efbench.source:"));

            Activity.Current?.SetTag("efbench.execution_plan_captured", true);

            var chunks = ChunkExecutionPlan(executionPlanXml, options.Value.ExecutionPlanLogChunkSize);
            var executionPlanHash = ComputeSha256(executionPlanXml);

            logger.LogInformation(
                "EF actual execution plan captured request_id={request_id} command_id={command_id} tag_context={tag_context} source={source} execution_plan_length={execution_plan_length} execution_plan_sha256={execution_plan_sha256} execution_plan_chunk_count={execution_plan_chunk_count}",
                requestContext?.RequestId,
                commandId,
                tagContext,
                sourceLocation,
                executionPlanXml.Length,
                executionPlanHash,
                chunks.Length);

            for (var index = 0; index < chunks.Length; index++)
            {
                logger.LogInformation(
                    "EF actual execution plan chunk request_id={request_id} command_id={command_id} tag_context={tag_context} source={source} execution_plan_sha256={execution_plan_sha256} execution_plan_chunk_index={execution_plan_chunk_index} execution_plan_chunk_count={execution_plan_chunk_count} execution_plan_xml_chunk={execution_plan_xml_chunk}",
                    requestContext?.RequestId,
                    commandId,
                    tagContext,
                    sourceLocation,
                    executionPlanHash,
                    index,
                    chunks.Length,
                    chunks[index]);
            }
        }
        catch (Exception ex)
        {
            // Execution-plan capture is diagnostic-only. The application query has already completed,
            // so provider quirks here should be logged without turning an investigation into an outage.
            logger.LogWarning(ex, "Failed to capture EF actual execution plan for command_id={CommandId}", commandId);
        }
    }

    private static string? TryReadExecutionPlan(DbDataReader reader)
    {
        string? executionPlanXml = null;

        do
        {
            if (IsExecutionPlanResultSet(reader))
            {
                if (reader.Read())
                {
                    executionPlanXml = reader.GetString(0);
                }

                continue;
            }

            while (reader.Read())
            {
            }
        }
        while (reader.NextResult());

        return executionPlanXml;
    }

    private static bool IsExecutionPlanResultSet(DbDataReader reader)
    {
        return reader.FieldCount == 1
            && reader.GetName(0).Contains("Showplan", StringComparison.OrdinalIgnoreCase);
    }

    private static string[] ChunkExecutionPlan(string executionPlanXml, int chunkSize)
    {
        var safeChunkSize = Math.Max(1_000, chunkSize);
        var chunks = new string[(int)Math.Ceiling(executionPlanXml.Length / (double)safeChunkSize)];

        for (var index = 0; index < chunks.Length; index++)
        {
            var start = index * safeChunkSize;
            var length = Math.Min(safeChunkSize, executionPlanXml.Length - start);
            chunks[index] = executionPlanXml.Substring(start, length);
        }

        return chunks;
    }

    private static string ComputeSha256(string value)
    {
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
    }

    private static string? TryGetTagValue(string sql, string prefix)
    {
        foreach (var line in sql.Split('\n', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
        {
            if (line.StartsWith($"-- {prefix}", StringComparison.Ordinal))
            {
                return line[$"-- {prefix}".Length..].Trim();
            }
        }

        return null;
    }
}
