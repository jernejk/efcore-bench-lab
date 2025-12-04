namespace EFCorePerf.Api.Data.Entities;

public class Employee
{
    public int EmployeeId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Department { get; set; }
    public DateTime HireDate { get; set; }
    public decimal? Salary { get; set; }
    
    // Navigation properties
    public ICollection<Sale> Sales { get; set; } = new List<Sale>();
}

