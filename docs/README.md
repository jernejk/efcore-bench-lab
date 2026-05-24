# EF Core Bench Lab Docs

These docs focus on using `EfCoreBenchLab.Diagnostics` in another ASP.NET Core + EF Core project. The sample app under `samples/` exists to prove the workflow and provide realistic good/bad endpoints.

## Start Here

- [Adoption guide](adoption-guide.md) - install and wire the diagnostics package into a target Web API.
- [Investigation workflow](investigation-workflow.md) - trigger actual execution-plan capture, inspect Aspire logs/OpenTelemetry, and optionally inspect Application Insights for an Azure demo.
- [Sample wildcard-search diagnosis](sample-wildcard-search-diagnosis.md) - read a bad-query example from source tag to likely fix.

## Repository Layout

- `src/EfCoreBenchLab.Diagnostics` - the packable diagnostics library.
- `samples/EfCoreBenchLab.Api` - a consumer Web API sample.
- `samples/EfCoreBenchLab.AppHost` - Aspire orchestration for SQL Server and the sample API.
- `samples/EfCoreBenchLab.ServiceDefaults` - Aspire/OpenTelemetry defaults used by the sample.
- `skills/` - agent skills for installation, local log investigation, optional Application Insights investigation, source location, and scenario testing.

Generated visual experiments belong under `docs/visuals/`, which is ignored. Keep durable docs in Markdown so they are reviewable in pull requests.
