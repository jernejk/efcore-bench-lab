using Microsoft.EntityFrameworkCore;

namespace EfCoreBenchLab.Api.Data;

public sealed class BenchLabDbContext(DbContextOptions<BenchLabDbContext> options) : DbContext(options)
{
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<SalesOrder> Orders => Set<SalesOrder>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Customer>(entity =>
        {
            entity.HasIndex(customer => customer.Region);
            entity.Property(customer => customer.Name).HasMaxLength(160);
            entity.Property(customer => customer.Segment).HasMaxLength(80);
            entity.Property(customer => customer.Region).HasMaxLength(80);
        });

        modelBuilder.Entity<Product>(entity =>
        {
            entity.HasIndex(product => product.Category);
            entity.Property(product => product.Sku).HasMaxLength(32);
            entity.Property(product => product.Name).HasMaxLength(160);
            entity.Property(product => product.Category).HasMaxLength(80);
            entity.Property(product => product.UnitPrice).HasPrecision(18, 2);
        });

        modelBuilder.Entity<SalesOrder>(entity =>
        {
            entity.ToTable("SalesOrders");
            entity.HasIndex(order => order.OrderedAt);
            entity.HasIndex(order => order.Status);
            entity.HasIndex(order => new { order.CustomerId, order.OrderedAt });
            entity.HasIndex(order => new { order.ProductId, order.OrderedAt });
            entity.Property(order => order.SalesPerson).HasMaxLength(120);
            entity.Property(order => order.Status).HasMaxLength(40);
            entity.Property(order => order.UnitPrice).HasPrecision(18, 2);
            entity.Property(order => order.Total).HasPrecision(18, 2);
        });
    }
}

public sealed class Customer
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Segment { get; set; } = string.Empty;
    public string Region { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public List<SalesOrder> Orders { get; set; } = [];
}

public sealed class Product
{
    public int Id { get; set; }
    public string Sku { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public decimal UnitPrice { get; set; }
    public List<SalesOrder> Orders { get; set; } = [];
}

public sealed class SalesOrder
{
    public long Id { get; set; }
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Total { get; set; }
    public DateTimeOffset OrderedAt { get; set; }
    public string Status { get; set; } = string.Empty;
    public string SalesPerson { get; set; } = string.Empty;
}
