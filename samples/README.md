# Samples

This folder contains the runnable sample application that consumes `src/EfCoreBenchLab.Diagnostics`.

- `EfCoreBenchLab.AppHost` starts SQL Server and the sample API through Aspire.
- `EfCoreBenchLab.Api` wires the diagnostics middleware/interceptor and exposes normal plus intentionally bad EF Core endpoints.
- `EfCoreBenchLab.ServiceDefaults` provides Aspire/OpenTelemetry defaults for the sample.

Use this folder as the reference implementation for adding the diagnostics package to another ASP.NET Core + EF Core project. The package code remains under `src/`; sample-only application code remains here.
