var builder = DistributedApplication.CreateBuilder(args);

var appInsights = builder.ExecutionContext.IsPublishMode
    ? builder.AddAzureApplicationInsights("appinsights")
    : builder.AddConnectionString("appinsights", "APPLICATIONINSIGHTS_CONNECTION_STRING");

var sql = builder.AddSqlServer("sql")
    .WithDataVolume("efcore-bench-lab-sql");

var salesDb = sql.AddDatabase("salesdb", "EfCoreBenchLab");

builder.AddProject<Projects.EfCoreBenchLab_Api>("api")
    .WithReference(salesDb)
    .WithReference(appInsights)
    .WaitFor(salesDb)
    .WithExternalHttpEndpoints();

builder.Build().Run();
