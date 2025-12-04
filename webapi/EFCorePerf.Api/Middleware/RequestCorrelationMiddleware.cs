using System.Diagnostics;
using EFCorePerf.Api.Services;

namespace EFCorePerf.Api.Middleware;

/// <summary>
/// Middleware to track request correlation IDs and memory allocation per request.
/// </summary>
public class RequestCorrelationMiddleware
{
    private readonly RequestDelegate _next;
    
    public RequestCorrelationMiddleware(RequestDelegate next)
    {
        _next = next;
    }
    
    public async Task InvokeAsync(HttpContext context, IQueryLogService queryLogService)
    {
        // Get or generate request ID
        var requestId = context.Request.Headers["X-Request-Id"].FirstOrDefault()
            ?? Guid.NewGuid().ToString("N");
        
        // Set response header so client can correlate
        context.Response.Headers["X-Request-Id"] = requestId;
        
        // Track memory at start
        var startMemory = GC.GetTotalMemory(false);
        var stopwatch = Stopwatch.StartNew();
        
        // Start request tracking
        queryLogService.StartRequest(requestId);
        
        try
        {
            await _next(context);
        }
        finally
        {
            stopwatch.Stop();
            var endMemory = GC.GetTotalMemory(false);
            
            // End request tracking
            queryLogService.EndRequest(requestId);
            
            // Update metrics with memory info
            var metrics = queryLogService.GetMetricsForRequest(requestId);
            if (metrics != null)
            {
                metrics.MemoryAllocatedBytes = Math.Max(0, endMemory - startMemory);
            }
        }
    }
}

public static class RequestCorrelationMiddlewareExtensions
{
    public static IApplicationBuilder UseRequestCorrelation(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<RequestCorrelationMiddleware>();
    }
}

