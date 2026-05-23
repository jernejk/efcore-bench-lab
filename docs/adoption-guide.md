# Adoption Guide

Use this guide when adding `EfCoreBenchLab.Diagnostics` to an existing ASP.NET Core API that uses EF Core with SQL Server and is observable through Aspire logs/OpenTelemetry.

The intended production-like behavior is:

1. Execution-plan capture is off by default.
2. A diagnostic HTTP header opts in one request.
3. EF Core commands in that request are tagged with query context and source class/member/line.
4. Aspire logs/OpenTelemetry contain the request id, SQL tag, source class/member/line, and execution-plan XML.
5. An agent uses the emitted data to find the LINQ query that caused the problem.

## Install

Reference the diagnostics package from the target Web API. In this repository, the sample uses a project reference while the package is still local:

```xml
<ProjectReference Include="../../src/EfCoreBenchLab.Diagnostics/EfCoreBenchLab.Diagnostics.csproj" />
```

In a consuming application, this should become a package reference once the library is published:

```xml
<PackageReference Include="EfCoreBenchLab.Diagnostics" Version="x.y.z" />
```

## Register Services

Register the diagnostics services in `Program.cs`:

```csharp
builder.Services.AddEfCoreBenchLabDiagnostics(options =>
{
    options.ExecutionPlanHeaderName = "X-EF-Include-Execution-Plan";
});
```

If SQL text should appear in logs for the investigation environment, enable it explicitly:

```csharp
builder.Services.AddEfCoreBenchLabDiagnostics(options =>
{
    options.ExecutionPlanHeaderName = "X-EF-Include-Execution-Plan";
    options.IncludeSqlInLogs = true;
});
```

Use `IncludeSqlInLogs` carefully. SQL text can include sensitive schema, predicates, and values depending on EF Core logging settings.

## Register The DbContext Interceptor

Add the interceptor to each SQL Server `DbContext` that should support request-scoped actual-plan capture:

```csharp
builder.Services.AddDbContextPool<AppDbContext>((serviceProvider, options) =>
{
    options.UseSqlServer(builder.Configuration.GetConnectionString("database"), sqlOptions =>
    {
        sqlOptions.CommandTimeout(120);

        // Do not enable retry buffering for contexts that capture actual plans.
        // sqlOptions.EnableRetryOnFailure(3);
    });

    options.UseEfCoreBenchLabDiagnostics(serviceProvider);
});
```

## Add Middleware

Add the middleware before request endpoints:

```csharp
app.UseEfCoreBenchLabDiagnostics();
```

The middleware reads the configured header, creates a request id, and makes the request-scoped diagnostics context available to the EF Core interceptor.

## Disable Retry Buffering For Captured Contexts

Actual-plan capture uses SQL Server `SET STATISTICS XML ON`, which returns the Showplan XML as an extra result set after the query results. SQL Server retry buffering, including `EnableRetryOnFailure`, can read ahead into that extra result set while EF Core still expects the original query shape.

If the application uses Aspire SQL Server EF Core enrichment, disable retry buffering for the instrumented context:

```csharp
builder.EnrichSqlServerDbContext<AppDbContext>(settings =>
{
    settings.DisableRetry = true;
    settings.CommandTimeout = 120;
});
```

## Tag High-Value Queries

Add `TagWithContext` to queries that are user-facing, expensive, or likely to be investigated later:

```csharp
var rows = await db.Orders
    .TagWithContext("OrdersSearch: user-facing order search")
    .AsNoTracking()
    .Where(order => order.Status != "Cancelled")
    .OrderByDescending(order => order.OrderedAt)
    .Take(50)
    .ToListAsync(cancellationToken);
```

`TagWithContext` emits SQL comments with:

- `efbench.context` - a stable, searchable operation name.
- `efbench.source` - source class, member, and line.

This is the link between the execution plan and the original LINQ query.

## Production Guardrails

- Keep execution-plan capture disabled by default.
- Restrict who can send the diagnostic header in production, for example at an internal gateway, support tool, or temporary allowlist.
- Prefer short, targeted investigations because actual-plan capture adds work to the request.
- Do not enable retry buffering on the same context that captures actual plans.
- Prefer Aspire logs/OpenTelemetry as the diagnostic record. The package does not keep an in-memory query log.

## Verify

Run the application with Aspire, call a real endpoint with the header, and inspect logs:

```bash
aspire run --apphost samples/EfCoreBenchLab.AppHost/EfCoreBenchLab.AppHost.csproj --non-interactive --nologo
aspire describe --format Json

curl -H "X-EF-Include-Execution-Plan: true" "http://localhost:<api-port>/<real-endpoint>"

aspire logs <api-resource-name> --tail 200 --timestamps
aspire otel logs <api-resource-name> --limit 100 --format Json
aspire otel spans <api-resource-name> --limit 100 --format Json
```

Confirm the emitted records include:

- `request_id`
- `include_execution_plan=true`
- `tag_context`
- `source`
- `execution_plan_xml`
