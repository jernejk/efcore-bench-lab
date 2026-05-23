# EF Core Diagnostics Install

Use this skill when adding EF Core Bench Lab diagnostics to another ASP.NET Core API so an agent can later investigate EF Core performance through Aspire logs.

Do not add the demo endpoints from this repository to the target project. Keep the integration to package reference, DI, DbContext interceptor registration, middleware, retry-buffering guard, and targeted query tags.

## Preflight

Before editing a target project:

1. Locate the Web API startup file, usually `Program.cs`.
2. Locate each SQL Server `DbContext` registration.
3. Check whether the app is hosted by Aspire and whether it uses `EnrichSqlServerDbContext`.
4. Find the high-value LINQ queries to tag. Prefer repository/service methods that are user-facing, slow, or likely to be investigated later.
5. Confirm logs are exported to Aspire/OpenTelemetry. The skills inspect logs, not an in-memory query-log endpoint.

## Package setup

1. Reference `EfCoreBenchLab.Diagnostics` from the target Web API.
2. Register services:

```csharp
builder.Services.AddEfCoreBenchLabDiagnostics(options =>
{
    options.ExecutionPlanHeaderName = "X-EF-Include-Execution-Plan";
});
```

3. Register the interceptor in each target `DbContext` that should support request-scoped actual-plan capture:

```csharp
builder.Services.AddDbContextPool<AppDbContext>((serviceProvider, options) =>
{
    options.UseSqlServer(builder.Configuration.GetConnectionString("database"), sqlOptions =>
    {
        sqlOptions.CommandTimeout(120);

        // NOTE: EnableRetryOnFailure is incompatible with SET STATISTICS XML ON because
        // retry buffering can read ahead into the Showplan XML result set.
        // sqlOptions.EnableRetryOnFailure(3);
    });

    options.UseEfCoreBenchLabDiagnostics(serviceProvider);
});
```

4. If using Aspire SQL Server EF Core enrichment, disable SQL Server retry buffering for contexts that capture actual plans:

```csharp
builder.EnrichSqlServerDbContext<AppDbContext>(settings =>
{
    settings.DisableRetry = true;
});
```

5. Add middleware before request endpoints:

```csharp
app.UseEfCoreBenchLabDiagnostics();
```

## Query tagging

Tag queries that may need investigation. Use stable, searchable context names that describe the business operation and suspected query shape:

```csharp
var rows = await db.Orders
    .TagWithContext("OrdersSearch: user-facing order search")
    .Where(order => order.Status != "Cancelled")
    .ToListAsync(cancellationToken);
```

`TagWithContext` adds source class, member, and line comments to the generated SQL without emitting absolute build-machine paths.

## Verification

After integration:

```bash
dotnet build
aspire run --apphost <path-to-apphost> --non-interactive --nologo
aspire describe --format Json
curl -H "X-EF-Include-Execution-Plan: true" "http://localhost:<api-port>/<real-endpoint>"
aspire logs <api-resource-name> --tail 200 --timestamps
```

Confirm the logs contain `include_execution_plan=true`, a query `tag_context`, a `source`, and an `execution_plan_xml` entry for the tagged query.
