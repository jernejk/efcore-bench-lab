namespace EfCoreBenchLab.Diagnostics.Options;

public sealed class EfDiagnosticsOptions
{
    public const string DefaultExecutionPlanHeaderName = "X-EF-Include-Execution-Plan";
    public const string DefaultRequestIdHeaderName = "X-EF-Diagnostics-Request-Id";

    private static readonly HashSet<string> DefaultEnabledValues = new(StringComparer.OrdinalIgnoreCase)
    {
        "1",
        "true",
        "yes",
        "actual",
        "include",
        "include-execution-plan"
    };

    public string ExecutionPlanHeaderName { get; set; } = DefaultExecutionPlanHeaderName;
    public string RequestIdHeaderName { get; set; } = DefaultRequestIdHeaderName;
    public bool EnableExecutionPlanCapture { get; set; } = true;
    public bool IncludeSqlInLogs { get; set; } = true;

    public bool IsExecutionPlanRequest(string? headerValue)
    {
        if (!EnableExecutionPlanCapture || string.IsNullOrWhiteSpace(headerValue))
        {
            return false;
        }

        return DefaultEnabledValues.Contains(headerValue.Trim());
    }
}
