# EfCoreBenchLab.Diagnostics

Packable ASP.NET Core and EF Core SQL Server diagnostics helpers for on-demand execution-plan capture.

## When To Use

Use this package in an existing ASP.NET Core API that uses EF Core with SQL Server and is observable through Aspire logs/OpenTelemetry. It is designed for production-like investigations where actual execution-plan capture should be off by default and activated only for a request carrying a diagnostic header.

## Install Into A Web API

Reference the package from the target Web API and wire it into DI:

```csharp
builder.Services.AddEfCoreBenchLabDiagnostics(options =>
{
    options.ExecutionPlanHeaderName = "X-EF-Include-Execution-Plan";
});

builder.Services.AddDbContextPool<AppDbContext>((serviceProvider, options) =>
{
    options.UseSqlServer(builder.Configuration.GetConnectionString("database"), sqlOptions =>
    {
        sqlOptions.CommandTimeout(120);

        // Leave retry buffering disabled for contexts that capture actual plans.
        // sqlOptions.EnableRetryOnFailure(3);
    });

    options.UseEfCoreBenchLabDiagnostics(serviceProvider);
});

app.UseEfCoreBenchLabDiagnostics();
```

If the target project uses Aspire SQL Server EF Core enrichment, also disable retry buffering there:

```csharp
builder.EnrichSqlServerDbContext<AppDbContext>(settings =>
{
    settings.DisableRetry = true;
});
```

## Tag Queries

Tag important queries:

```csharp
var rows = await db.Orders
    .TagWithContext("Orders search")
    .Where(order => order.Status != "Cancelled")
    .ToListAsync();
```

`TagWithContext` adds SQL comments containing the investigation context plus source class, member, and line. The source comment is what lets an AI agent narrow a bad plan back to the original LINQ query without leaking absolute build-machine paths.

## Investigate With Aspire

Send `X-EF-Include-Execution-Plan: true` on a request to capture SQL Server actual execution plans for EF Core reader commands on that request. Inspect the emitted structured logs or OpenTelemetry records in Aspire; the package does not keep an in-memory query log.

```bash
curl -H "X-EF-Include-Execution-Plan: true" "https://localhost:<port>/<real-endpoint>"
aspire logs <api-resource-name> --tail 200 --timestamps
aspire otel logs <api-resource-name> --limit 100 --format Json
aspire otel spans <api-resource-name> --limit 100 --format Json
```

Look for `request_id`, `include_execution_plan`, `tag_context`, `source`, and `execution_plan_xml`.

## Important EF Core Limitation

When actual execution-plan capture is enabled, do not enable SQL Server retry buffering for the same `DbContext`; `SET STATISTICS XML ON` adds an additional result set that must be consumed by the interceptor. `EnableRetryOnFailure` uses a buffered reader that can read ahead into the Showplan XML result set while EF Core is still expecting the original query columns.
