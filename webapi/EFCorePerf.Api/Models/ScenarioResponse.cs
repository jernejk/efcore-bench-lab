namespace EFCorePerf.Api.Models;

/// <summary>
/// Standard response format for all scenario endpoints.
/// </summary>
public class ScenarioResponse<T>
{
    public string RequestId { get; set; } = string.Empty;
    public string Scenario { get; set; } = string.Empty;
    public string Variant { get; set; } = string.Empty;
    public string? VariantDescription { get; set; }
    public T? Result { get; set; }
    public ScenarioMetrics Metrics { get; set; } = new();
    public List<QueryInfo> Queries { get; set; } = new();
}

public class ScenarioMetrics
{
    public double DurationMs { get; set; }
    public int QueryCount { get; set; }
    public int RowsReturned { get; set; }
    public long MemoryAllocatedBytes { get; set; }
}

public class QueryInfo
{
    public string Sql { get; set; } = string.Empty;
    public double DurationMs { get; set; }
    public Dictionary<string, object?> Parameters { get; set; } = new();
    public string? ExecutionPlan { get; set; }
}

