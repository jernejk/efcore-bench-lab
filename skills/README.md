# EF Core Diagnostics Skills

These skills are intended for agents working on a different ASP.NET Core + EF Core project, not only this lab.

Use them as a chain:

1. `efcore-diagnostics-install` adds the diagnostics package to the target API, wires the middleware/interceptor, disables incompatible SQL Server retry buffering, and tags selected LINQ queries.
2. `efcore-aspire-log-investigator` starts or attaches to the target Aspire app, calls a real endpoint with `X-EF-Include-Execution-Plan: true`, and inspects logs/OpenTelemetry for the captured SQL and execution plan.
3. `efcore-appinsights-investigator` optionally inspects remote Application Insights telemetry through Azure CLI or Azure MCP when the sample is deployed to Azure.
4. `efcore-source-locator` uses the `efbench.source` tag to locate the source class/member/line and explain which LINQ shape maps to the bad SQL/plan operator.
5. `efcore-scenario-tester` validates this lab's demo endpoints, or acts as a checklist for equivalent good/bad endpoints in a target project.

The skills should prefer Aspire logs and OpenTelemetry as the local source of truth. Application Insights is an optional remote diagnostic path for Azure demos or production-like deployments. There is no in-memory query-log endpoint.
