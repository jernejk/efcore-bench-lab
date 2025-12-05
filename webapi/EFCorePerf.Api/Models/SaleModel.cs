namespace EFCorePerf.Api.Models;

/// <summary>
/// Simplified sale model for employer statistics.
/// </summary>
public class SaleModel
{
    public int SaleId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public int Quantity { get; set; }
}
