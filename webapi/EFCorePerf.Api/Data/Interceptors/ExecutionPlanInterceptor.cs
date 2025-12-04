using System.Data.Common;
using System.Text.RegularExpressions;
using EFCorePerf.Api.Services;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace EFCorePerf.Api.Data.Interceptors;

/// <summary>
/// Intercepts database commands to capture estimated execution plans when requested.
/// 
/// The approach: After a query executes, if execution plan capture is enabled via
/// IQueryLogService.IsExecutionPlanEnabled(), we run a separate query to get the
/// estimated execution plan using SET SHOWPLAN_XML.
/// 
/// Usage: Enable execution plan capture via IQueryLogService.SetExecutionPlanEnabled(true)
/// before executing queries. The ScenarioExecutor handles this automatically when
/// includeExecutionPlan=true is passed.
/// 
/// Note: This returns estimated execution plans, not actual execution plans.
/// SET STATISTICS XML ON (actual plans) conflicts with EF Core's buffered reader
/// because it adds an extra result set that confuses the reader.
/// </summary>
public class ExecutionPlanInterceptor : DbCommandInterceptor
{
    private readonly IQueryLogService _queryLogService;
    private readonly string _connectionString;
    
    public ExecutionPlanInterceptor(IQueryLogService queryLogService, string connectionString)
    {
        _queryLogService = queryLogService;
        _connectionString = connectionString;
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
        // Only process if execution plan capture is enabled
        if (!_queryLogService.IsExecutionPlanEnabled())
        {
            return;
        }
        
        try
        {
            // Get the execution plan using a separate connection to avoid conflicts
            var executionPlan = GetExecutionPlanForQuery(command);
            
            if (!string.IsNullOrEmpty(executionPlan))
            {
                // Store in DbContext if it implements IExecutionPlanDbContext
                if (eventData.Context is IExecutionPlanDbContext dbContext)
                {
                    dbContext.LastExecutionPlan = executionPlan;
                }
                
                // Also store in query log service for the current request
                _queryLogService.SetLastExecutionPlan(executionPlan);
            }
        }
        catch (Exception ex)
        {
            // Log but don't fail the main query - execution plan capture is best effort
            Console.WriteLine($"[ExecutionPlanInterceptor] Failed to capture execution plan: {ex.Message}");
        }
    }
    
    private string? GetExecutionPlanForQuery(DbCommand originalCommand)
    {
        // Create a new SQL connection with our stored connection string (which includes password)
        using var connection = new SqlConnection(_connectionString);
        connection.Open();
        
        try
        {
            // Use the SQL as-is (no need to strip tags anymore)
            var sqlForPlan = originalCommand.CommandText;
            
            // For SHOWPLAN_XML, we need to inline the parameter values because
            // SHOWPLAN mode doesn't actually execute the query, it just parses it
            // Parameters need to be declared inline for the plan to work
            sqlForPlan = InlineParameters(sqlForPlan, originalCommand.Parameters);
            
            // Use SET SHOWPLAN_XML ON to get estimated execution plan
            // This returns the plan without actually executing the query
            using var showPlanOnCommand = connection.CreateCommand();
            showPlanOnCommand.CommandText = "SET SHOWPLAN_XML ON";
            showPlanOnCommand.ExecuteNonQuery();
            
            try
            {
                using var planCommand = connection.CreateCommand();
                planCommand.CommandTimeout = 30;
                planCommand.CommandText = sqlForPlan;
                
                using var reader = planCommand.ExecuteReader();
                if (reader.Read())
                {
                    return reader.GetString(0);
                }
            }
            finally
            {
                // Turn off showplan mode
                using var showPlanOffCommand = connection.CreateCommand();
                showPlanOffCommand.CommandText = "SET SHOWPLAN_XML OFF";
                showPlanOffCommand.ExecuteNonQuery();
            }
        }
        finally
        {
            connection.Close();
        }
        
        return null;
    }
    
    private static string InlineParameters(string sql, DbParameterCollection parameters)
    {
        var result = sql;
        
        foreach (DbParameter param in parameters)
        {
            var paramName = param.ParameterName;
            if (!paramName.StartsWith("@"))
                paramName = "@" + paramName;
            
            var value = FormatParameterValue(param);
            
            // Replace parameter with its value (word boundary match to avoid partial matches)
            var pattern = Regex.Escape(paramName) + @"(?![a-zA-Z0-9_])";
            result = Regex.Replace(result, pattern, value, RegexOptions.IgnoreCase);
        }
        
        return result;
    }
    
    private static string FormatParameterValue(DbParameter param)
    {
        if (param.Value == null || param.Value == DBNull.Value)
            return "NULL";
        
        return param.DbType switch
        {
            System.Data.DbType.String or 
            System.Data.DbType.StringFixedLength or 
            System.Data.DbType.AnsiString or
            System.Data.DbType.AnsiStringFixedLength => $"'{param.Value.ToString()?.Replace("'", "''")}'",
            
            System.Data.DbType.DateTime or 
            System.Data.DbType.DateTime2 or 
            System.Data.DbType.DateTimeOffset => $"'{param.Value}'",
            
            System.Data.DbType.Boolean => (bool)param.Value ? "1" : "0",
            
            System.Data.DbType.Decimal or
            System.Data.DbType.Double or
            System.Data.DbType.Single or
            System.Data.DbType.Currency => param.Value.ToString()?.Replace(",", ".") ?? "0",
            
            _ => param.Value.ToString() ?? "NULL"
        };
    }
}
