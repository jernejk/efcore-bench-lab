namespace EfCoreBenchLab.Diagnostics;

public sealed record EfDiagnosticsRequestContext(
    string RequestId,
    bool IncludeExecutionPlan,
    string? ExecutionPlanHeaderValue,
    string Path,
    string? TraceId);

public sealed class EfDiagnosticsContextAccessor
{
    private readonly AsyncLocal<EfDiagnosticsRequestContext?> _current = new();

    public EfDiagnosticsRequestContext? Current => _current.Value;

    public IDisposable Push(EfDiagnosticsRequestContext context)
    {
        var previous = _current.Value;
        _current.Value = context;
        return new PopWhenDisposed(this, previous);
    }

    private sealed class PopWhenDisposed(
        EfDiagnosticsContextAccessor accessor,
        EfDiagnosticsRequestContext? previous) : IDisposable
    {
        public void Dispose()
        {
            accessor._current.Value = previous;
        }
    }
}
