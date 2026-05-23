# EF Core Bench Lab

EF Core Bench Lab is a small Aspire-driven demo for collecting EF Core query telemetry through Aspire logs and OpenTelemetry.

The useful part is the diagnostics package and the agent skills. The lab app is only a proving ground: the intended workflow is to add the package to another ASP.NET Core + EF Core project, tag suspicious queries, trigger actual-plan capture with an HTTP header, then let an AI agent inspect Aspire logs and trace the bad plan back to source code.

The repository is split so the package is the product and the runnable app is a consumer sample:

- `src/EfCoreBenchLab.Diagnostics` is a packable NuGet-style class library with:
  - ASP.NET Core middleware that reads `X-EF-Include-Execution-Plan`.
  - an EF Core SQL Server interceptor that captures actual execution plans only for opted-in requests.
  - `TagWithContext(...)` query tagging that records source file, member, and line in SQL comments.
- `samples/EfCoreBenchLab.AppHost` orchestrates SQL Server and the sample API with Aspire 13.3.5.
- `samples/EfCoreBenchLab.Api` shows how an application wires the diagnostics package, exposes demo endpoints, and seeds deterministic SQL Server data.
- `samples/EfCoreBenchLab.ServiceDefaults` contains the Aspire/OpenTelemetry defaults for the sample host.
- `skills/` contains operator skills for AI agents.

## Documentation

- [Docs index](docs/README.md)
- [Adoption guide](docs/adoption-guide.md) - add the diagnostics package to another ASP.NET Core + EF Core project.
- [Investigation workflow](docs/investigation-workflow.md) - use Aspire logs/OpenTelemetry to diagnose a captured request.
- [Sample diagnosis](docs/sample-wildcard-search-diagnosis.md) - explain the intentionally bad wildcard-search query.

## Add To Another Project

Use the diagnostics package in the target Web API, not the demo API. The minimum integration is:

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

        // Do not enable retry buffering for contexts that capture actual plans.
        // sqlOptions.EnableRetryOnFailure(3);
    });

    options.UseEfCoreBenchLabDiagnostics(serviceProvider);
});

app.UseEfCoreBenchLabDiagnostics();
```

If the target project uses Aspire SQL Server EF Core enrichment, disable retry buffering for the instrumented context:

```csharp
builder.EnrichSqlServerDbContext<AppDbContext>(settings =>
{
    settings.DisableRetry = true;
});
```

Tag queries that should be easy to find later:

```csharp
var rows = await db.Orders
    .TagWithContext("Orders search")
    .Where(order => order.Status != "Cancelled")
    .ToListAsync(cancellationToken);
```

Then run the real application through Aspire and call a real endpoint with the capture header:

```bash
curl -H "X-EF-Include-Execution-Plan: true" "https://localhost:<port>/<real-endpoint>"
aspire logs <api-resource-name> --tail 200 --timestamps
aspire otel logs <api-resource-name> --limit 100 --format Json
aspire otel spans <api-resource-name> --limit 100 --format Json
```

The fields the skills expect are:

- `request_id`
- `include_execution_plan`
- `tag_context`
- `source`
- `execution_plan_xml`

Use the repo-local skills in this order:

1. `skills/efcore-diagnostics-install` - add the middleware, interceptor, retry-buffering guard, and query tags to the target project.
2. `skills/efcore-aspire-log-investigator` - trigger the real endpoint with the header and inspect Aspire logs/OpenTelemetry.
3. `skills/efcore-source-locator` - map `efbench.source` back to the file/member/line and explain the code shape.
4. `skills/efcore-scenario-tester` - smoke-test this lab or adapt the same checks to the target project's endpoints.

## Run

```bash
dotnet restore
dotnet build
aspire run --apphost samples/EfCoreBenchLab.AppHost/EfCoreBenchLab.AppHost.csproj --non-interactive --nologo
```

The API is exposed by Aspire. Use `aspire describe --format Json` to discover the exact endpoint.

## Scenario Endpoints

Normal scenarios:

- `/scenarios/normal/customer-orders?customerId=42&pageSize=25`
- `/scenarios/normal/recent-paid-orders?page=0&pageSize=25`

Bad scenarios:

- `/scenarios/bad/wildcard-search?search=road&page=25&pageSize=25` - computed text search across joined tables, then sort/page.
- `/scenarios/bad/over-fetching?search=road&fetchCount=20000&page=0&pageSize=25` - broad joined fetch, then application-side filter/page.
- `/scenarios/bad/n-plus-one?region=Queensland&customerCount=8` - one customer query, then two order queries per customer.

Legacy aliases are still available:

- `/scenarios/healthy-query?customerId=42&pageSize=25`
- `/scenarios/deep-bad-query?search=road&page=25&pageSize=25`

## Trigger the demo

Call the bad query without the header:

```bash
curl "http://localhost:<api-port>/scenarios/bad/wildcard-search?search=road&page=25&pageSize=25"
```

Call it with actual execution-plan capture:

```bash
curl -H "X-EF-Include-Execution-Plan: true" \
  "http://localhost:<api-port>/scenarios/bad/wildcard-search?search=road&page=25&pageSize=25"
```

Then inspect logs and telemetry:

```bash
aspire logs api --tail 200 --timestamps
aspire otel logs api --limit 100 --format Json
aspire otel spans api --limit 100 --format Json
```

The important log fields are:

- `request_id`
- `include_execution_plan`
- `tag_context`
- `source`
- `execution_plan_xml`

The source tag narrows the bad query to the file/member/line that called `TagWithContext(...)`.

## Expected Diagnosis Signals

- Wildcard search: execution plan shows broad scans, computed `LOWER(...) LIKE '%term%'`, sort before paging, and a source tag for `DeepBadOrderSearch`.
- Over-fetching: one broad joined query returns thousands of rows; API metrics show `fetchedRows` much larger than returned rows.
- N+1: a single request has many EF command logs with repeated `NPlusOneOrderCount` and `NPlusOneLatestOrder` tags.
