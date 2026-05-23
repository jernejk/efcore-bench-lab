# EF Core Aspire Log Investigator

Use this skill when investigating EF Core query performance in an Aspire-hosted ASP.NET Core API that has EF Core Bench Lab diagnostics installed.

Prefer the target project's real endpoints. Use this lab's demo endpoints only when the current repository is `efcore-bench-lab` or the user explicitly asks to validate the lab.

## Start and discover

Always use the Aspire CLI as the control plane. Start the app if needed, then discover resource names and endpoints:

```bash
aspire run --apphost <path-to-apphost> --non-interactive --nologo
aspire ps --format Json
aspire describe --format Json
```

Use the API endpoint reported by `aspire describe`. Record the API resource name; the log commands need it.

## Trigger execution-plan capture

Choose one real endpoint that exercises the tagged EF Core query. Run it once without the header and once with the header.

Generic pattern:

```bash
curl "http://localhost:<api-port>/<real-endpoint>"
curl -H "X-EF-Include-Execution-Plan: true" \
  "http://localhost:<api-port>/<real-endpoint>"
```

Lab endpoints, only for this repository:

- `/scenarios/normal/customer-orders?customerId=42&pageSize=25`
- `/scenarios/normal/recent-paid-orders?page=0&pageSize=25`
- `/scenarios/bad/wildcard-search?search=road&page=25&pageSize=25`
- `/scenarios/bad/over-fetching?search=road&fetchCount=20000&page=0&pageSize=25`
- `/scenarios/bad/n-plus-one?region=Queensland&customerCount=8`

## Inspect logs and OpenTelemetry

Use Aspire logs first:

```bash
aspire logs api --tail 200 --timestamps
```

Then inspect structured telemetry:

```bash
aspire otel logs api --limit 100 --format Json
aspire otel spans api --limit 100 --format Json
```

Look for fields named `request_id`, `include_execution_plan`, `tag_context`, `source`, and `execution_plan_xml`. The Aspire logs and OpenTelemetry records are the diagnostic source of truth; there is no in-memory query-log endpoint.

## Diagnosis patterns

- Non-sargable text search often appears as `LOWER(...)`, `LIKE '%...%'`, functions around columns, broad scans, or high rows read.
- Sort-before-page often appears as a Sort operator over many rows before `OFFSET/FETCH` returns a small page.
- Repeated lookups often appear as high execution counts on seek/lookup operators.
- Over-fetching often has a broad SQL query plus application metrics where fetched rows greatly exceed returned rows.
- N+1 usually appears as many EF command logs with similar tags under one request id.

Lab-specific tags:

- `DeepBadOrderSearch` usually means broad joined text search, computed string predicates, and sorting before paging.
- `OverFetchingOrders` usually means the SQL is broad but the API response metrics prove filtering/paging happened after materialization.
- `NPlusOneCustomers`, `NPlusOneOrderCount`, and `NPlusOneLatestOrder` in the same request usually mean a per-row loop is executing database calls.
- Healthy routes should have one bounded EF command with `HealthyCustomerOrderLookup` or `HealthyRecentPaidOrders`.

When reporting, include the request id, query tags, source locations, plan symptoms, and the smallest code change to replace the pattern.
