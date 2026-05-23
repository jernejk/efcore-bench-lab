# Investigation Workflow

Use this workflow when the diagnostics package is installed and an endpoint is suspected of causing EF Core query performance problems.

## Flow

```mermaid
flowchart TD
    A["Choose a real endpoint"] --> B["Call without diagnostics header"]
    B --> C["Call with X-EF-Include-Execution-Plan: true"]
    C --> D["Capture X-EF-Diagnostics-Request-Id"]
    D --> E["Inspect Aspire logs and OpenTelemetry"]
    E --> F["Find tag_context and execution_plan_xml"]
    F --> G["Open source from efbench.source"]
    G --> H["Map plan symptoms back to LINQ"]
    H --> I["Recommend smallest code or schema fix"]
```

## 1. Start Or Discover The Aspire App

Use the Aspire CLI as the control plane:

```bash
aspire run --apphost <path-to-apphost> --non-interactive --nologo
aspire ps --format Json
aspire describe --format Json
```

Record:

- API resource name.
- API base URL.
- Endpoint that exercises the suspected EF Core query.

For this repository's sample app:

```bash
aspire run --apphost samples/EfCoreBenchLab.AppHost/EfCoreBenchLab.AppHost.csproj --non-interactive --nologo
```

## 2. Trigger Capture

Call the endpoint once normally, then once with execution-plan capture enabled:

```bash
curl "http://localhost:<api-port>/<real-endpoint>"
curl -i -H "X-EF-Include-Execution-Plan: true" "http://localhost:<api-port>/<real-endpoint>"
```

Save the `X-EF-Diagnostics-Request-Id` response header if present. If the response header is not available, use the closest timestamp and endpoint path when searching logs.

## 3. Inspect Logs

Start with text logs:

```bash
aspire logs <api-resource-name> --tail 200 --timestamps
```

Then inspect structured OpenTelemetry records:

```bash
aspire otel logs <api-resource-name> --limit 100 --format Json
aspire otel spans <api-resource-name> --limit 100 --format Json
```

Search for:

- `request_id`
- `include_execution_plan`
- `tag_context`
- `source`
- `execution_plan_xml`

## 4. Read The Diagnostic Record

A useful captured record should answer:

| Field | Why it matters |
| --- | --- |
| `request_id` | Correlates HTTP request, EF commands, spans, and plan capture. |
| `tag_context` | Names the query or business operation. |
| `source` | Points to the file/member/line that added `TagWithContext`. |
| `duration_ms` | Gives a first-order impact signal for the command. |
| `execution_plan_xml` | Contains SQL Server actual execution-plan operators and runtime row counts. |

## 5. Interpret Common Symptoms

| Symptom | Common LINQ shape | Likely impact |
| --- | --- | --- |
| `LIKE '%term%'` | `.Contains(term)` on SQL Server | Cannot seek into a normal b-tree index. |
| `LOWER(column)` or functions around columns | `.ToLower()` in query predicate | Can make the predicate non-sargable. |
| Concatenated search text | `a + " " + b + " " + c` | Forces computed expression evaluation per row. |
| Sort before paging | `.OrderBy(...).Skip(...).Take(...)` after weak filtering | Sorts many rows to return a small page. |
| Many similar EF command logs | Query inside a loop | N+1 request amplification. |
| Fetched rows much greater than returned rows | `.ToListAsync()` before filtering/paging | Moves filtering work from SQL Server to application memory. |

## 6. Locate The Source

Use the `efbench.source` value:

```text
samples/EfCoreBenchLab.Api/Features/Orders/OrderSearchRepository.cs:SearchWithKnownPerformanceProblemAsync:44
```

Open that file and line, then map the SQL/plan symptoms back to the LINQ expression. Report the smallest fix that changes the query shape, index strategy, or search design.

## Reporting Template

```text
Request: <request_id>
Endpoint: <method/path>
Query tag: <tag_context>
Source: <file>:<member>:<line>
Impact: <duration, rows read, rows returned, repeated calls, or memory pressure>
Plan symptoms: <scan, sort, lookup, function predicate, LIKE pattern, etc.>
Likely cause: <LINQ shape or schema gap>
Smallest fix: <code/index/search change>
Follow-up test: <endpoint and expected log/plan change>
```
