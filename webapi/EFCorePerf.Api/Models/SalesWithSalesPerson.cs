namespace EFCorePerf.Api.Models;

/// <summary>
/// Represents sales data with associated sales person information.
/// Used for demonstrating Include vs Select projection patterns.
/// </summary>
public class SalesWithSalesPerson
{
    public int CustomerId { get; set; }
    public int SalesId { get; set; }
    public int ProductId { get; set; }
    public int Quantity { get; set; }
    public int SalesPersonId { get; set; }
    public string SalesPersonFirstName { get; set; } = string.Empty;
    public string SalesPersonLastName { get; set; } = string.Empty;
}
