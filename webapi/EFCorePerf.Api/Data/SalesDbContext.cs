using EFCorePerf.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace EFCorePerf.Api.Data;

public class SalesDbContext : DbContext, IExecutionPlanDbContext
{
    public SalesDbContext(DbContextOptions<SalesDbContext> options) : base(options)
    {
    }
    
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<Sale> Sales => Set<Sale>();
    
    // For execution plan capture
    public string? LastExecutionPlan { get; set; }
    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        // Customer
        modelBuilder.Entity<Customer>(entity =>
        {
            entity.HasKey(e => e.CustomerId);
            entity.Property(e => e.FirstName).HasMaxLength(100).IsRequired();
            entity.Property(e => e.LastName).HasMaxLength(100).IsRequired();
            entity.Property(e => e.Email).HasMaxLength(255).IsRequired();
            entity.Property(e => e.Phone).HasMaxLength(20);
            entity.Property(e => e.Address).HasMaxLength(500);
            entity.Property(e => e.City).HasMaxLength(100);
            entity.Property(e => e.State).HasMaxLength(100);
            entity.Property(e => e.Country).HasMaxLength(100);
            entity.HasIndex(e => e.Email);
            entity.HasIndex(e => new { e.LastName, e.FirstName });
        });
        
        // Product
        modelBuilder.Entity<Product>(entity =>
        {
            entity.HasKey(e => e.ProductId);
            entity.Property(e => e.Name).HasMaxLength(200).IsRequired();
            entity.Property(e => e.Description).HasMaxLength(2000);
            entity.Property(e => e.Price).HasPrecision(18, 2);
            entity.Property(e => e.Category).HasMaxLength(100);
            entity.HasIndex(e => e.Category);
            entity.HasIndex(e => e.Name);
        });
        
        // Employee
        modelBuilder.Entity<Employee>(entity =>
        {
            entity.HasKey(e => e.EmployeeId);
            entity.Property(e => e.FirstName).HasMaxLength(100).IsRequired();
            entity.Property(e => e.LastName).HasMaxLength(100).IsRequired();
            entity.Property(e => e.Email).HasMaxLength(255).IsRequired();
            entity.Property(e => e.Department).HasMaxLength(100);
            entity.Property(e => e.Salary).HasPrecision(18, 2);
            entity.HasIndex(e => e.Email);
            entity.HasIndex(e => e.Department);
        });
        
        // Sale
        modelBuilder.Entity<Sale>(entity =>
        {
            entity.HasKey(e => e.SalesId);
            entity.Property(e => e.UnitPrice).HasPrecision(18, 2);
            entity.Property(e => e.TotalAmount).HasPrecision(18, 2);
            
            entity.HasOne(e => e.Customer)
                .WithMany(c => c.Sales)
                .HasForeignKey(e => e.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);
                
            entity.HasOne(e => e.Product)
                .WithMany(p => p.Sales)
                .HasForeignKey(e => e.ProductId)
                .OnDelete(DeleteBehavior.Restrict);
                
            entity.HasOne(e => e.SalesPerson)
                .WithMany(e => e.Sales)
                .HasForeignKey(e => e.SalesPersonId)
                .OnDelete(DeleteBehavior.Restrict);
                
            entity.HasIndex(e => e.SaleDate);
            entity.HasIndex(e => e.CustomerId);
            entity.HasIndex(e => e.ProductId);
            entity.HasIndex(e => e.SalesPersonId);
        });
    }
}

public interface IExecutionPlanDbContext
{
    string? LastExecutionPlan { get; set; }
}

