# Samples

This folder contains the runnable sample application that consumes `src/EfCoreBenchLab.Diagnostics`.

- `EfCoreBenchLab.AppHost` starts SQL Server and the sample API through Aspire.
- `EfCoreBenchLab.Api` wires the diagnostics middleware/interceptor and exposes normal plus intentionally bad EF Core endpoints.
- `EfCoreBenchLab.ServiceDefaults` provides Aspire/OpenTelemetry defaults for the sample.

Use this folder as the reference implementation for adding the diagnostics package to another ASP.NET Core + EF Core project. The package code remains under `src/`; sample-only application code remains here.

## Optional Azure Demo

Use Aspire locally for the normal sample workflow. Deploying to Azure is optional and only needed when you want a remote demo with Application Insights telemetry.

The repository root contains `azure.yaml` for Azure Developer CLI. It points `azd` at `samples/EfCoreBenchLab.AppHost`, so optional deployments use the same Aspire application model as local runs.

From the repository root:

```bash
azd auth login
azd up
```

When prompted, choose the target Azure subscription and location. `azd` provisions the Aspire sample resources, builds the API container, deploys it, and prints the deployed endpoints. Azure resources can incur cost, so treat this as a temporary demo environment.

Remove the deployed sample resources when you are done:

```bash
azd down
```
