# EF Core Source Locator

Use this skill when an Aspire log or OpenTelemetry record contains an EF Core Bench Lab source tag from a target project.

## Source tag format

`TagWithContext` writes SQL comments like:

```sql
-- efbench.context:DeepBadOrderSearch: wildcard text search across joined order data
-- efbench.source:src/MyApp/Orders/OrderSearchRepository.cs:SearchAsync:24
```

The source value is:

```text
<path>:<member>:<line>
```

## Locate the code

Open the file and line from the tag. If the file path is partial, search for it from the target repository root:

```bash
rg -n "SearchAsync|OrdersSearch" src
```

When reporting findings, include:

- the request id
- the query context
- the source file/member/line
- the plan symptom, such as scan, sort, key lookup, high reads, or missing useful index
- the smallest code or schema change that would address the performance issue

## Map SQL Back To LINQ

Use these common mappings:

- `LOWER(...)` usually maps to `.ToLower()` or `.ToLowerInvariant()` in the LINQ expression.
- `LIKE '%term%'` usually maps to `.Contains(term)` on SQL Server.
- `ORDER BY ... OFFSET ... FETCH` usually maps to `.OrderBy(...).Skip(...).Take(...)`.
- Repeated seek/lookup operators often map to projection or join shape, not necessarily separate EF commands.
- Multiple similar EF command logs under one request usually map to a loop that runs queries per item.
