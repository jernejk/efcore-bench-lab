using EFCorePerf.Api.Data;
using EFCorePerf.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EFCorePerf.Api.Controllers;

/// <summary>
/// Meta endpoints for query logs, metrics, and health checks.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class MetaController : ControllerBase
{
    private readonly IQueryLogService _queryLogService;
    private readonly SalesDbContext _dbContext;

    public MetaController(IQueryLogService queryLogService, SalesDbContext dbContext)
    {
        _queryLogService = queryLogService;
        _dbContext = dbContext;
    }
    
    /// <summary>
    /// Health check endpoint.
    /// </summary>
    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new { 
            status = "healthy", 
            timestamp = DateTime.UtcNow,
            version = "1.0.0"
        });
    }
    
    /// <summary>
    /// Get queries for a specific request ID.
    /// </summary>
    [HttpGet("query-log/{requestId}")]
    public IActionResult GetQueryLog(string requestId)
    {
        var queries = _queryLogService.GetQueriesForRequest(requestId);
        var metrics = _queryLogService.GetMetricsForRequest(requestId);
        
        return Ok(new
        {
            requestId,
            metrics,
            queries
        });
    }
    
    /// <summary>
    /// Get recent queries across all requests.
    /// </summary>
    [HttpGet("query-log")]
    public IActionResult GetRecentQueries([FromQuery] int count = 100)
    {
        var queries = _queryLogService.GetRecentQueries(Math.Min(count, 1000));
        return Ok(queries);
    }
    
    /// <summary>
    /// Clear all query logs.
    /// </summary>
    [HttpDelete("query-log")]
    public IActionResult ClearQueryLog()
    {
        _queryLogService.Clear();
        return Ok(new { message = "Query log cleared" });
    }
    
    /// <summary>
    /// Get server information.
    /// </summary>
    [HttpGet("info")]
    public IActionResult GetInfo()
    {
        return Ok(new
        {
            runtime = System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription,
            os = System.Runtime.InteropServices.RuntimeInformation.OSDescription,
            architecture = System.Runtime.InteropServices.RuntimeInformation.OSArchitecture.ToString(),
            processorCount = Environment.ProcessorCount,
            workingSet = Environment.WorkingSet,
            timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Get database table statistics.
    /// </summary>
    [HttpGet("db-stats")]
    public async Task<IActionResult> GetDatabaseStats()
    {
        try
        {
            // Get row counts using LINQ
            var customersCount = await _dbContext.Customers.CountAsync();
            var productsCount = await _dbContext.Products.CountAsync();
            var employeesCount = await _dbContext.Employees.CountAsync();
            var salesCount = await _dbContext.Sales.CountAsync();

            // Get basic column information from EF model
            var tableStats = new List<object>
            {
                new
                {
                    tableName = "Customers",
                    rowCount = customersCount,
                    columns = new[]
                    {
                        new { Name = "CustomerId", Type = "int", IsKey = true },
                        new { Name = "FirstName", Type = "nvarchar(100)", IsKey = false },
                        new { Name = "LastName", Type = "nvarchar(100)", IsKey = false },
                        new { Name = "Email", Type = "nvarchar(255)", IsKey = false },
                        new { Name = "Phone", Type = "nvarchar(20)", IsKey = false },
                        new { Name = "Address", Type = "nvarchar(500)", IsKey = false },
                        new { Name = "City", Type = "nvarchar(100)", IsKey = false },
                        new { Name = "State", Type = "nvarchar(100)", IsKey = false },
                        new { Name = "Country", Type = "nvarchar(100)", IsKey = false },
                        new { Name = "CreatedAt", Type = "datetime2", IsKey = false }
                    }
                },
                new
                {
                    tableName = "Products",
                    rowCount = productsCount,
                    columns = new[]
                    {
                        new { Name = "ProductId", Type = "int", IsKey = true },
                        new { Name = "Name", Type = "nvarchar(200)", IsKey = false },
                        new { Name = "Description", Type = "nvarchar(2000)", IsKey = false },
                        new { Name = "Price", Type = "decimal(18,2)", IsKey = false },
                        new { Name = "Category", Type = "nvarchar(100)", IsKey = false },
                        new { Name = "StockQuantity", Type = "int", IsKey = false },
                        new { Name = "CreatedAt", Type = "datetime2", IsKey = false }
                    }
                },
                new
                {
                    tableName = "Employees",
                    rowCount = employeesCount,
                    columns = new[]
                    {
                        new { Name = "EmployeeId", Type = "int", IsKey = true },
                        new { Name = "FirstName", Type = "nvarchar(100)", IsKey = false },
                        new { Name = "LastName", Type = "nvarchar(100)", IsKey = false },
                        new { Name = "Email", Type = "nvarchar(255)", IsKey = false },
                        new { Name = "Department", Type = "nvarchar(100)", IsKey = false },
                        new { Name = "HireDate", Type = "datetime2", IsKey = false },
                        new { Name = "Salary", Type = "decimal(18,2)", IsKey = false }
                    }
                },
                new
                {
                    tableName = "Sales",
                    rowCount = salesCount,
                    columns = new[]
                    {
                        new { Name = "SalesId", Type = "int", IsKey = true },
                        new { Name = "CustomerId", Type = "int", IsKey = false },
                        new { Name = "ProductId", Type = "int", IsKey = false },
                        new { Name = "SalesPersonId", Type = "int", IsKey = false },
                        new { Name = "Quantity", Type = "int", IsKey = false },
                        new { Name = "UnitPrice", Type = "decimal(18,2)", IsKey = false },
                        new { Name = "TotalAmount", Type = "decimal(18,2)", IsKey = false },
                        new { Name = "SaleDate", Type = "datetime2", IsKey = false }
                    }
                }
            };

            return Ok(new
            {
                database = "SalesDB",
                timestamp = DateTime.UtcNow,
                tables = tableStats
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }
}

