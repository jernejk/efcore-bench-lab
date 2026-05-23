using System.Diagnostics;
using EfCoreBenchLab.Diagnostics.Options;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EfCoreBenchLab.Diagnostics.AspNetCore;

public sealed class EfDiagnosticsMiddleware(
    RequestDelegate next,
    EfDiagnosticsContextAccessor contextAccessor,
    IOptions<EfDiagnosticsOptions> options,
    ILogger<EfDiagnosticsMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext httpContext)
    {
        var requestId = httpContext.TraceIdentifier;
        var headerValue = httpContext.Request.Headers[options.Value.ExecutionPlanHeaderName].FirstOrDefault();
        var includeExecutionPlan = options.Value.IsExecutionPlanRequest(headerValue);
        var traceId = Activity.Current?.TraceId.ToString();

        var context = new EfDiagnosticsRequestContext(
            requestId,
            includeExecutionPlan,
            headerValue,
            httpContext.Request.Path,
            traceId);

        httpContext.Response.Headers[options.Value.RequestIdHeaderName] = requestId;

        Activity.Current?.SetTag("efbench.request_id", requestId);
        Activity.Current?.SetTag("efbench.include_execution_plan", includeExecutionPlan);
        Activity.Current?.AddBaggage("efbench.request_id", requestId);

        using (contextAccessor.Push(context))
        {
            if (includeExecutionPlan)
            {
                logger.LogInformation(
                    "EF execution-plan capture enabled for request request_id={RequestId} path={Path} header={HeaderName}",
                    requestId,
                    httpContext.Request.Path.Value,
                    options.Value.ExecutionPlanHeaderName);
            }

            await next(httpContext);
        }
    }
}
