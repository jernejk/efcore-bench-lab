# EF Core Application Insights Investigator

Use this skill when an EF Core Bench Lab instrumented API is deployed to Azure and you need to diagnose request telemetry, EF command logs, and on-demand SQL Server execution-plan capture through Application Insights.

Prefer `efcore-aspire-log-investigator` for local Aspire runs. Use this skill only for the optional Azure demo or a production-like remote deployment.

## Control plane choice

- Prefer Azure CLI for deterministic KQL log queries: `az monitor app-insights query`.
- Use Azure MCP only when the active agent already has Azure MCP Server tools available and authenticated. Ask it to run the same KQL against the Application Insights resource or its backing Log Analytics workspace.
- If Azure MCP cannot expose log-query tools, cannot see Application Insights tables, or returns parsing errors, fall back to Azure CLI.
- Do not add MCP configuration to the repository, print connection strings, or include subscription ids, tenant ids, local paths, or resource ids in reports unless the user explicitly asks.

## Inputs

Collect these from the deployment output, Azure portal, or resource group:

- Application Insights resource name.
- Resource group name.
- Deployed API base URL.
- Optional `X-EF-Diagnostics-Request-Id` from a plan-enabled response.

Remote telemetry can take up to 5 minutes to appear in Application Insights. Wait before treating missing traces as a failed capture.

## Discover resources with Azure CLI

List Application Insights components in a known resource group:

```bash
az resource list \
  --resource-group "<resource-group>" \
  --resource-type "Microsoft.Insights/components" \
  --query "[].{name:name,location:location}" \
  -o table
```

Show non-secret metadata for one component:

```bash
az monitor app-insights component show \
  --app "<app-insights-name>" \
  --resource-group "<resource-group>" \
  --query "{name:name,location:location,workspaceResourceId:workspaceResourceId}" \
  -o json
```

Do not query or print `connectionString` or instrumentation keys during diagnosis.

## Trigger comparable requests

Call the same endpoint once without execution-plan capture and once with capture:

```bash
curl -i "https://<api-host>/<endpoint>"
curl -i -H "X-EF-Include-Execution-Plan: true" "https://<api-host>/<endpoint>"
```

Record the `X-EF-Diagnostics-Request-Id` response header from the plan-enabled request.

## Query recent EF diagnostics

Use this to confirm EF command logs, plan summaries, and plan chunks reached Application Insights:

```bash
az monitor app-insights query \
  --apps "<app-insights-name>" \
  --resource-group "<resource-group>" \
  --analytics-query "
traces
| where timestamp > ago(30m)
| where message has 'EF command executed'
   or message has 'EF actual execution plan captured'
   or message has 'EF actual execution plan chunk'
| extend request_id = tostring(customDimensions['request_id'])
| extend include_execution_plan = tostring(customDimensions['include_execution_plan'])
| extend tag_context = tostring(customDimensions['tag_context'])
| extend source = tostring(customDimensions['source'])
| extend command_id = tostring(customDimensions['command_id'])
| extend duration_ms = todouble(customDimensions['duration_ms'])
| extend chunk_index = toint(customDimensions['execution_plan_chunk_index'])
| project timestamp, operation_Id, request_id, include_execution_plan, tag_context, source, command_id, duration_ms, chunk_index, message
| order by timestamp desc
" \
  -o table
```

## Reassemble one execution plan

Use the request id from the response header. Keep the result local and do not commit exported plans; execution plans can reveal schema and query details.

```bash
az monitor app-insights query \
  --apps "<app-insights-name>" \
  --resource-group "<resource-group>" \
  --analytics-query "
let requestId = '<X-EF-Diagnostics-Request-Id>';
traces
| where timestamp > ago(30m)
| where message has 'EF actual execution plan chunk'
| where tostring(customDimensions['request_id']) == requestId
| extend command_id = tostring(customDimensions['command_id'])
| extend execution_plan_sha256 = tostring(customDimensions['execution_plan_sha256'])
| extend chunk_index = toint(customDimensions['execution_plan_chunk_index'])
| extend chunk_count = toint(customDimensions['execution_plan_chunk_count'])
| extend chunk = tostring(customDimensions['execution_plan_xml_chunk'])
| order by command_id asc, chunk_index asc
| project request_id = requestId, command_id, execution_plan_sha256, chunk_index, chunk_count, chunk
" \
  -o json
```

Concatenate `chunk` values in `command_id`, `chunk_index` order. A complete plan has chunk indexes from `0` to `chunk_count - 1` for each `command_id`.

## Compare plan-enabled and normal performance

This query compares request duration and EF command time for requests with and without the execution-plan header:

```bash
az monitor app-insights query \
  --apps "<app-insights-name>" \
  --resource-group "<resource-group>" \
  --analytics-query "
let efCommands =
    traces
    | where timestamp > ago(60m)
    | where message has 'EF command executed'
    | extend duration_ms = todouble(customDimensions['duration_ms'])
    | extend include_plan = iff(tolower(tostring(customDimensions['include_execution_plan'])) == 'true', 1, 0)
    | summarize command_count = count(),
        total_db_ms = sum(duration_ms),
        include_plan = max(include_plan)
      by operation_Id;
requests
| where timestamp > ago(60m)
| join kind=inner efCommands on operation_Id
| summarize request_count = count(),
    p50_request_ms = percentile(duration, 50),
    p95_request_ms = percentile(duration, 95),
    avg_request_ms = avg(duration),
    avg_db_commands = avg(command_count),
    avg_total_db_ms = avg(total_db_ms)
  by name, include_execution_plan = include_plan == 1
| order by name asc, include_execution_plan asc
" \
  -o table
```

Treat a small increase on a single plan-enabled diagnostic request as expected. Investigate if the plan-enabled path changes result shape, fails, or adds sustained overhead to normal requests.

## Identify suspect endpoints without plan capture

Use historical request and EF command telemetry to find candidates before enabling actual-plan capture:

```bash
az monitor app-insights query \
  --apps "<app-insights-name>" \
  --resource-group "<resource-group>" \
  --analytics-query "
let efCommands =
    traces
    | where timestamp > ago(24h)
    | where message has 'EF command executed'
    | extend duration_ms = todouble(customDimensions['duration_ms'])
    | extend tag_context = tostring(customDimensions['tag_context'])
    | summarize db_command_count = count(),
        total_db_ms = sum(duration_ms),
        p95_db_ms = percentile(duration_ms, 95),
        query_tags = make_set(tag_context, 20)
      by operation_Id;
requests
| where timestamp > ago(24h)
| join kind=leftouter efCommands on operation_Id
| summarize request_count = count(),
    avg_request_ms = avg(duration),
    p95_request_ms = percentile(duration, 95),
    avg_db_commands = avg(db_command_count),
    avg_total_db_ms = avg(total_db_ms),
    query_tags = make_set(query_tags, 20)
  by name
| order by p95_request_ms desc
" \
  -o table
```

Good candidates for on-demand plan capture have high request duration, high total database time, many EF commands per request, or query tags that match known risky flows.

## Azure MCP path

When Azure MCP Server tools are available, ask the agent to:

1. Find the Application Insights component or backing Log Analytics workspace in the target resource group.
2. Run the same KQL sections above against that resource.
3. Use Azure Monitor metrics only as supporting evidence for request volume, failed requests, and duration trends.
4. Fall back to Azure CLI if MCP cannot run KQL against the traces and requests tables.

Keep final reports sanitized: include endpoint names, request ids, query tags, and source class/member/line, but omit local paths, subscription ids, tenant ids, and full Azure resource ids.
