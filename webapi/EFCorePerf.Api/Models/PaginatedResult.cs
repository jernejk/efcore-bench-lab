namespace EFCorePerf.Api.Models;

/// <summary>
/// Represents a paginated result set with metadata.
/// </summary>
public class PaginatedResult<T>
{
    public List<T> Data { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
}
