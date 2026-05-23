using EfCoreBenchLab.Api.Data;
using EfCoreBenchLab.Api.Features.Orders;
using EfCoreBenchLab.Api.Features.Scenarios;
using EfCoreBenchLab.Diagnostics;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

builder.Services.AddEfCoreBenchLabDiagnostics(options =>
{
    options.ExecutionPlanHeaderName = "X-EF-Include-Execution-Plan";
    options.IncludeSqlInLogs = true;
});

builder.Services.AddDbContextPool<BenchLabDbContext>((serviceProvider, options) =>
{
    var connectionString = builder.Configuration.GetConnectionString("salesdb")
        ?? throw new InvalidOperationException("Connection string 'salesdb' was not provided by Aspire.");

    options.UseSqlServer(connectionString, sqlServerOptions =>
    {
        sqlServerOptions.CommandTimeout(120);

        // NOTE: EnableRetryOnFailure is intentionally disabled because it uses a BufferedDataReader
        // which conflicts with SET STATISTICS XML ON (actual execution plans). The extra Showplan
        // result set can be read ahead while EF Core still expects the original query columns.
        // sqlServerOptions.EnableRetryOnFailure(3);
    });

    options.UseEfCoreBenchLabDiagnostics(serviceProvider);

    if (builder.Environment.IsDevelopment())
    {
        options.EnableDetailedErrors();
        options.EnableSensitiveDataLogging();
    }
});

builder.EnrichSqlServerDbContext<BenchLabDbContext>(settings =>
{
    // Aspire's SQL Server enrichment can enable resilient EF Core behavior. Keep retry buffering off
    // for the context that captures actual execution plans with SET STATISTICS XML ON.
    settings.DisableRetry = true;
    settings.CommandTimeout = 120;
});

builder.Services.AddScoped<OrderScenarioService>();
builder.Services.AddScoped<OrderSearchRepository>();
builder.Services.AddScoped<DatabaseSeeder>();

var app = builder.Build();

app.MapDefaultEndpoints();
app.UseEfCoreBenchLabDiagnostics();
app.MapOrderScenarioEndpoints();

using (var scope = app.Services.CreateScope())
{
    var seeder = scope.ServiceProvider.GetRequiredService<DatabaseSeeder>();
    await seeder.SeedAsync();
}

app.Run();
