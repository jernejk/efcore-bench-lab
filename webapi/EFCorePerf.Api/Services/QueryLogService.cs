using System.Collections.Concurrent;

namespace EFCorePerf.Api.Services;

public interface IQueryLogService
{
    void AddQuery(QueryLogEntry entry);
    void SetLastExecutionPlan(string? plan);
    void SetRequestId(string requestId);
    string? GetCurrentRequestId();
    IReadOnlyList<QueryLogEntry> GetQueriesForRequest(string requestId);
    IReadOnlyList<QueryLogEntry> GetRecentQueries(int count = 100);
    RequestMetrics? GetMetricsForRequest(string requestId);
    void StartRequest(string requestId);
    void EndRequest(string requestId);
    void Clear();
}

public class QueryLogService : IQueryLogService
{
    private readonly ConcurrentDictionary<string, List<QueryLogEntry>> _queryLogs = new();
    private readonly ConcurrentDictionary<string, RequestMetrics> _requestMetrics = new();
    private readonly ConcurrentQueue<QueryLogEntry> _recentQueries = new();
    private readonly AsyncLocal<string?> _currentRequestId = new();
    private readonly AsyncLocal<string?> _lastExecutionPlan = new();
    private const int MaxRecentQueries = 1000;
    
    public void SetRequestId(string requestId)
    {
        _currentRequestId.Value = requestId;
    }
    
    public string? GetCurrentRequestId() => _currentRequestId.Value;
    
    public void AddQuery(QueryLogEntry entry)
    {
        var requestId = _currentRequestId.Value;
        
        if (!string.IsNullOrEmpty(requestId))
        {
            entry.RequestId = requestId;
            
            // Add to request-specific log
            _queryLogs.AddOrUpdate(
                requestId,
                _ => [entry],
                (_, list) => { list.Add(entry); return list; });
            
            // Update request metrics
            _requestMetrics.AddOrUpdate(
                requestId,
                _ => new RequestMetrics 
                { 
                    RequestId = requestId, 
                    QueryCount = 1, 
                    TotalDurationMs = entry.DurationMs 
                },
                (_, metrics) => 
                { 
                    metrics.QueryCount++; 
                    metrics.TotalDurationMs += entry.DurationMs;
                    return metrics; 
                });
        }
        
        // Add to recent queries (circular buffer)
        _recentQueries.Enqueue(entry);
        while (_recentQueries.Count > MaxRecentQueries)
        {
            _recentQueries.TryDequeue(out _);
        }
    }
    
    public void SetLastExecutionPlan(string? plan)
    {
        _lastExecutionPlan.Value = plan;
        
        // Attach to the last query in the current request
        var requestId = _currentRequestId.Value;
        if (!string.IsNullOrEmpty(requestId) && plan != null)
        {
            if (_queryLogs.TryGetValue(requestId, out var queries) && queries.Count > 0)
            {
                queries[^1].ExecutionPlan = plan;
            }
        }
    }
    
    public IReadOnlyList<QueryLogEntry> GetQueriesForRequest(string requestId)
    {
        return _queryLogs.TryGetValue(requestId, out var queries) 
            ? queries.AsReadOnly() 
            : [];
    }
    
    public IReadOnlyList<QueryLogEntry> GetRecentQueries(int count = 100)
    {
        return _recentQueries.TakeLast(count).ToList();
    }
    
    public RequestMetrics? GetMetricsForRequest(string requestId)
    {
        return _requestMetrics.TryGetValue(requestId, out var metrics) ? metrics : null;
    }
    
    public void StartRequest(string requestId)
    {
        _currentRequestId.Value = requestId;
        _lastExecutionPlan.Value = null;
        
        _requestMetrics[requestId] = new RequestMetrics
        {
            RequestId = requestId,
            StartTime = DateTime.UtcNow
        };
    }
    
    public void EndRequest(string requestId)
    {
        if (_requestMetrics.TryGetValue(requestId, out var metrics))
        {
            metrics.EndTime = DateTime.UtcNow;
            metrics.TotalRequestDurationMs = (metrics.EndTime.Value - metrics.StartTime).TotalMilliseconds;
        }
    }
    
    public void Clear()
    {
        _queryLogs.Clear();
        _requestMetrics.Clear();
        while (_recentQueries.TryDequeue(out _)) { }
    }
}

public class QueryLogEntry
{
    public string? RequestId { get; set; }
    public string Sql { get; set; } = string.Empty;
    public double DurationMs { get; set; }
    public Dictionary<string, object?> Parameters { get; set; } = new();
    public int? RowsAffected { get; set; }
    public DateTime Timestamp { get; set; }
    public string? CommandType { get; set; }
    public string? ExecutionPlan { get; set; }
}

public class RequestMetrics
{
    public string RequestId { get; set; } = string.Empty;
    public int QueryCount { get; set; }
    public double TotalDurationMs { get; set; }
    public double TotalRequestDurationMs { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public long MemoryAllocatedBytes { get; set; }
}

