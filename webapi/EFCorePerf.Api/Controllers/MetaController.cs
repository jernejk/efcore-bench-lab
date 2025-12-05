using System.Diagnostics;
using System.Runtime.InteropServices;
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
    /// Get detailed hardware information (CPU, GPU, etc.)
    /// </summary>
    [HttpGet("hardware")]
    public IActionResult GetHardwareInfo()
    {
        var hardware = new Dictionary<string, object>
        {
            ["os"] = RuntimeInformation.OSDescription,
            ["architecture"] = RuntimeInformation.OSArchitecture.ToString(),
            ["processorCount"] = Environment.ProcessorCount,
            ["runtime"] = RuntimeInformation.FrameworkDescription
        };

        try
        {
            if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
            {
                // Get CPU brand
                var cpuBrand = RunCommand("sysctl", "-n machdep.cpu.brand_string");
                if (!string.IsNullOrEmpty(cpuBrand))
                    hardware["cpuBrand"] = cpuBrand.Trim();

                // Get performance cores
                var perfCores = RunCommand("sysctl", "-n hw.perflevel0.physicalcpu");
                if (int.TryParse(perfCores, out var pCores))
                    hardware["performanceCores"] = pCores;

                // Get efficiency cores
                var effCores = RunCommand("sysctl", "-n hw.perflevel1.physicalcpu");
                if (int.TryParse(effCores, out var eCores))
                    hardware["efficiencyCores"] = eCores;

                // Get memory
                var memBytes = RunCommand("sysctl", "-n hw.memsize");
                if (long.TryParse(memBytes, out var mem))
                    hardware["memoryGB"] = mem / (1024 * 1024 * 1024);

                // Get GPU cores via ioreg
                var gpuInfo = RunCommand("sh", "-c \"ioreg -l | grep 'gpu-core-count' | head -1\"");
                if (!string.IsNullOrEmpty(gpuInfo))
                {
                    var match = System.Text.RegularExpressions.Regex.Match(gpuInfo, @"(\d+)");
                    if (match.Success && int.TryParse(match.Groups[1].Value, out var gpuCores))
                        hardware["gpuCores"] = gpuCores;
                }

                // Get L2 cache sizes
                var perfL2 = RunCommand("sysctl", "-n hw.perflevel0.l2cachesize");
                if (long.TryParse(perfL2, out var l2Perf))
                    hardware["performanceL2CacheMB"] = l2Perf / (1024 * 1024);

                var effL2 = RunCommand("sysctl", "-n hw.perflevel1.l2cachesize");
                if (long.TryParse(effL2, out var l2Eff))
                    hardware["efficiencyL2CacheMB"] = l2Eff / (1024 * 1024);
            }
            else if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                // Windows: use WMIC or PowerShell
                var cpuName = RunCommand("cmd", "/c wmic cpu get name /value");
                if (!string.IsNullOrEmpty(cpuName))
                {
                    var match = System.Text.RegularExpressions.Regex.Match(cpuName, @"Name=(.+)");
                    if (match.Success)
                        hardware["cpuBrand"] = match.Groups[1].Value.Trim();
                }

                var cores = RunCommand("cmd", "/c wmic cpu get NumberOfCores /value");
                if (!string.IsNullOrEmpty(cores))
                {
                    var match = System.Text.RegularExpressions.Regex.Match(cores, @"NumberOfCores=(\d+)");
                    if (match.Success && int.TryParse(match.Groups[1].Value, out var coreCount))
                        hardware["physicalCores"] = coreCount;
                }

                var threads = RunCommand("cmd", "/c wmic cpu get NumberOfLogicalProcessors /value");
                if (!string.IsNullOrEmpty(threads))
                {
                    var match = System.Text.RegularExpressions.Regex.Match(threads, @"NumberOfLogicalProcessors=(\d+)");
                    if (match.Success && int.TryParse(match.Groups[1].Value, out var threadCount))
                        hardware["logicalProcessors"] = threadCount;
                }

                // Memory
                var memInfo = RunCommand("cmd", "/c wmic ComputerSystem get TotalPhysicalMemory /value");
                if (!string.IsNullOrEmpty(memInfo))
                {
                    var match = System.Text.RegularExpressions.Regex.Match(memInfo, @"TotalPhysicalMemory=(\d+)");
                    if (match.Success && long.TryParse(match.Groups[1].Value, out var memBytes))
                        hardware["memoryGB"] = memBytes / (1024 * 1024 * 1024);
                }
            }
            else if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
            {
                // Linux: read from /proc
                var cpuInfo = RunCommand("sh", "-c \"cat /proc/cpuinfo | grep 'model name' | head -1\"");
                if (!string.IsNullOrEmpty(cpuInfo))
                {
                    var match = System.Text.RegularExpressions.Regex.Match(cpuInfo, @"model name\s*:\s*(.+)");
                    if (match.Success)
                        hardware["cpuBrand"] = match.Groups[1].Value.Trim();
                }

                var memInfo = RunCommand("sh", "-c \"cat /proc/meminfo | grep MemTotal\"");
                if (!string.IsNullOrEmpty(memInfo))
                {
                    var match = System.Text.RegularExpressions.Regex.Match(memInfo, @"MemTotal:\s*(\d+)");
                    if (match.Success && long.TryParse(match.Groups[1].Value, out var memKB))
                        hardware["memoryGB"] = memKB / (1024 * 1024);
                }
            }
        }
        catch (Exception ex)
        {
            hardware["error"] = ex.Message;
        }

        hardware["timestamp"] = DateTime.UtcNow;
        return Ok(hardware);
    }

    private static string? RunCommand(string command, string arguments)
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = command,
                Arguments = arguments,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var process = Process.Start(psi);
            if (process == null) return null;

            var output = process.StandardOutput.ReadToEnd();
            process.WaitForExit(5000);
            return output;
        }
        catch
        {
            return null;
        }
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

