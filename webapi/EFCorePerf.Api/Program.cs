using EFCorePerf.Api.Data;
using EFCorePerf.Api.Data.Interceptors;
using EFCorePerf.Api.Middleware;
using EFCorePerf.Api.Services;
using Microsoft.EntityFrameworkCore;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container

// Query logging service (singleton for in-memory storage)
builder.Services.AddSingleton<IQueryLogService, QueryLogService>();

// Scenario executor
builder.Services.AddScoped<IScenarioExecutor, ScenarioExecutor>();

// Database interceptors
builder.Services.AddScoped<TelemetryInterceptor>();
builder.Services.AddScoped<ExecutionPlanInterceptor>();

// EF Core with SQL Server
builder.Services.AddDbContext<SalesDbContext>((serviceProvider, options) =>
{
    var connectionString = builder.Configuration.GetConnectionString("SalesDb")
        ?? "Server=localhost,11433;Database=SalesDB;User Id=sa;Password=YourStrong@Passw0rd;TrustServerCertificate=True";
    
    options.UseSqlServer(connectionString, sqlOptions =>
    {
        sqlOptions.EnableRetryOnFailure(3);
        sqlOptions.CommandTimeout(60);
    });
    
    // Add interceptors
    var queryLogService = serviceProvider.GetRequiredService<IQueryLogService>();
    options.AddInterceptors(
        new TelemetryInterceptor(queryLogService),
        new ExecutionPlanInterceptor(queryLogService));
    
    // Enable sensitive data logging in development
    if (builder.Environment.IsDevelopment())
    {
        options.EnableSensitiveDataLogging();
        options.EnableDetailedErrors();
    }
});

// OpenTelemetry
var serviceName = "EFCorePerf.Api";
var serviceVersion = "1.0.0";

builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource
        .AddService(serviceName: serviceName, serviceVersion: serviceVersion))
    .WithTracing(tracing => tracing
        .AddAspNetCoreInstrumentation()
        .AddEntityFrameworkCoreInstrumentation()
        .AddOtlpExporter(options =>
        {
            options.Endpoint = new Uri(builder.Configuration["Otlp:Endpoint"] ?? "http://localhost:4317");
        }))
    .WithMetrics(metrics => metrics
        .AddAspNetCoreInstrumentation()
        .AddRuntimeInstrumentation()
        .AddOtlpExporter(options =>
        {
            options.Endpoint = new Uri(builder.Configuration["Otlp:Endpoint"] ?? "http://localhost:4317");
        }));

// CORS for dashboard
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(
                "http://localhost:3847",
                "http://127.0.0.1:3847")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .WithExposedHeaders("X-Request-Id");
    });
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new()
    {
        Title = "EF Core Performance Lab API",
        Version = "v1",
        Description = "API for demonstrating EF Core query performance scenarios"
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseRequestCorrelation();
app.MapControllers();

// Configure port
var port = builder.Configuration["Port"] ?? "5847";
app.Urls.Add($"http://0.0.0.0:{port}");

app.Run();
