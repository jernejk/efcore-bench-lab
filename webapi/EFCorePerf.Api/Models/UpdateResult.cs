namespace EFCorePerf.Api.Models;

/// <summary>
/// Represents the result of an update operation.
/// </summary>
public class UpdateResult
{
    public int AffectedRows { get; set; }
    public string Method { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
}