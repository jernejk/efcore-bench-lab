using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;

namespace EFCorePerf.Api.Controllers;

/// <summary>
/// Provides real-time system metrics for monitoring during benchmarks.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class MetricsController : ControllerBase
{
    private static readonly Process CurrentProcess = Process.GetCurrentProcess();
    private static DateTime _lastCpuCheck = DateTime.UtcNow;
    private static TimeSpan _lastTotalProcessorTime = TimeSpan.Zero;
    private static double _lastCpuUsage = 0;

    /// <summary>
    /// Get current CPU and memory usage of the WebAPI process.
    /// </summary>
    [HttpGet]
    public IActionResult GetMetrics()
    {
        CurrentProcess.Refresh();
        
        var cpuUsage = CalculateCpuUsage();
        var memoryBytes = CurrentProcess.WorkingSet64;
        var privateMemoryBytes = CurrentProcess.PrivateMemorySize64;
        var gcMemory = GC.GetTotalMemory(false);
        
        return Ok(new
        {
            timestamp = DateTime.UtcNow,
            cpu = new
            {
                usagePercent = Math.Round(cpuUsage, 2),
                processorCount = Environment.ProcessorCount
            },
            memory = new
            {
                workingSetBytes = memoryBytes,
                workingSetMB = Math.Round(memoryBytes / 1024.0 / 1024.0, 2),
                privateMemoryBytes = privateMemoryBytes,
                privateMemoryMB = Math.Round(privateMemoryBytes / 1024.0 / 1024.0, 2),
                gcMemoryBytes = gcMemory,
                gcMemoryMB = Math.Round(gcMemory / 1024.0 / 1024.0, 2)
            },
            gc = new
            {
                gen0Collections = GC.CollectionCount(0),
                gen1Collections = GC.CollectionCount(1),
                gen2Collections = GC.CollectionCount(2)
            }
        });
    }

    /// <summary>
    /// Force garbage collection (for testing purposes only).
    /// </summary>
    [HttpPost("gc")]
    public IActionResult ForceGC()
    {
        var before = GC.GetTotalMemory(false);
        GC.Collect();
        GC.WaitForPendingFinalizers();
        GC.Collect();
        var after = GC.GetTotalMemory(true);
        
        return Ok(new
        {
            beforeBytes = before,
            afterBytes = after,
            freedBytes = before - after,
            freedMB = Math.Round((before - after) / 1024.0 / 1024.0, 2)
        });
    }

    private double CalculateCpuUsage()
    {
        var currentTime = DateTime.UtcNow;
        var currentTotalProcessorTime = CurrentProcess.TotalProcessorTime;
        
        var timeDiff = (currentTime - _lastCpuCheck).TotalMilliseconds;
        if (timeDiff < 100) // Minimum 100ms between measurements
        {
            return _lastCpuUsage;
        }
        
        var cpuTimeDiff = (currentTotalProcessorTime - _lastTotalProcessorTime).TotalMilliseconds;
        var cpuUsage = (cpuTimeDiff / timeDiff) * 100.0 / Environment.ProcessorCount;
        
        _lastCpuCheck = currentTime;
        _lastTotalProcessorTime = currentTotalProcessorTime;
        _lastCpuUsage = Math.Max(0, Math.Min(100, cpuUsage));
        
        return _lastCpuUsage;
    }
}

