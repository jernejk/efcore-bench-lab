namespace EFCorePerf.Api.Models;

/// <summary>
/// Represents statistics for an employer including their sales data.
/// Used to demonstrate split query scenarios.
/// </summary>
public class EmployerStats
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public int TotalSales { get; set; }
    public List<SaleModel> Sales { get; set; } = new();
}
