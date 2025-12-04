namespace EFCorePerf.Api.Data.Entities;

public class Sale
{
    public int SalesId { get; set; }
    public int CustomerId { get; set; }
    public int ProductId { get; set; }
    public int SalesPersonId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal TotalAmount { get; set; }
    public DateTime SaleDate { get; set; }
    
    // Navigation properties
    public Customer Customer { get; set; } = null!;
    public Product Product { get; set; } = null!;
    public Employee SalesPerson { get; set; } = null!;
}

