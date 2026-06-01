# EF Core Scenario Tester

Use this skill when validating that EF Core diagnostics work after installation. In this repository, use the built-in good and bad endpoints. In another project, adapt the same checks to real endpoints that exercise tagged EF Core queries.

## Workflow

1. Start with Aspire:

```bash
aspire run --apphost <path-to-apphost> --non-interactive --nologo
aspire wait <api-resource-name> --apphost <path-to-apphost> --timeout 240 --non-interactive
aspire describe --apphost <path-to-apphost> --format Json
```

2. Use the API URL from `aspire describe`.
3. Pick one normal endpoint and one suspect endpoint that exercise tagged EF Core queries.
4. Call the suspect endpoint with `X-EF-Include-Execution-Plan: true`.
5. For each response, capture the `X-EF-Diagnostics-Request-Id` response header.
6. Check Aspire logs and OpenTelemetry:

```bash
aspire logs api --tail 120 --timestamps
aspire otel logs api --limit 100 --format Json
```

7. Confirm the diagnosis signal in the emitted logs:

Generic project:

- The request log includes `include_execution_plan=true`.
- EF command logs include the expected `tag_context`.
- The execution-plan log includes `execution_plan_xml_chunk`.
- The `source` points to the expected class/member/line.

Lab endpoints:

- Wildcard search: `DeepBadOrderSearch` and a plan with scans/sort/computed LIKE.
- Over-fetching: `OverFetchingOrders` and response metrics where `fetchedRows` is much higher than `returned`.
- N+1: repeated `NPlusOneOrderCount` and `NPlusOneLatestOrder` commands under one request id.

Report whether the skill can identify the request id, query tag, source class/member/line, and likely remediation.
