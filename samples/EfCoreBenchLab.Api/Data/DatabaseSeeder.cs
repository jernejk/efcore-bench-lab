using Microsoft.EntityFrameworkCore;

namespace EfCoreBenchLab.Api.Data;

public sealed class DatabaseSeeder(BenchLabDbContext dbContext, ILogger<DatabaseSeeder> logger)
{
    private static readonly string[] Regions =
    [
        "Queensland",
        "New South Wales",
        "Victoria",
        "Western Australia",
        "South Australia",
        "Tasmania"
    ];

    private static readonly string[] Segments = ["Enterprise", "Mid Market", "Small Business", "Government"];
    private static readonly string[] Categories = ["Road bikes", "Mountain bikes", "Helmets", "Components", "Clothing", "Nutrition"];
    private static readonly string[] Statuses = ["Submitted", "Paid", "Packed", "Shipped", "Cancelled"];
    private static readonly string[] SalesPeople = ["Ada Wong", "Grace Hopper", "Katherine Johnson", "Mary Jackson", "Frances Allen", "Radia Perlman"];

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        await dbContext.Database.EnsureCreatedAsync(cancellationToken);

        if (await dbContext.Orders.AnyAsync(cancellationToken))
        {
            return;
        }

        logger.LogInformation("Seeding EF Core Bench Lab database with deterministic sales data");

        var random = new Random(1979);
        var customers = Enumerable.Range(1, 1_200)
            .Select(i => new Customer
            {
                Name = $"Customer {i:0000}",
                Segment = Segments[random.Next(Segments.Length)],
                Region = Regions[random.Next(Regions.Length)],
                CreatedAt = DateTimeOffset.UtcNow.AddDays(-random.Next(1, 1_500))
            })
            .ToArray();

        var products = Enumerable.Range(1, 180)
            .Select(i =>
            {
                var category = Categories[random.Next(Categories.Length)];
                return new Product
                {
                    Sku = $"SKU-{i:00000}",
                    Name = $"{category} product {i:000}",
                    Category = category,
                    UnitPrice = random.Next(30, 4_000)
                };
            })
            .ToArray();

        dbContext.Customers.AddRange(customers);
        dbContext.Products.AddRange(products);
        await dbContext.SaveChangesAsync(cancellationToken);

        const int orderCount = 60_000;
        const int batchSize = 5_000;
        var utcNow = DateTimeOffset.UtcNow;

        for (var offset = 0; offset < orderCount; offset += batchSize)
        {
            var orders = Enumerable.Range(offset + 1, Math.Min(batchSize, orderCount - offset))
                .Select(_ =>
                {
                    var product = products[random.Next(products.Length)];
                    var quantity = random.Next(1, 8);

                    return new SalesOrder
                    {
                        CustomerId = customers[random.Next(customers.Length)].Id,
                        ProductId = product.Id,
                        Quantity = quantity,
                        UnitPrice = product.UnitPrice,
                        Total = product.UnitPrice * quantity,
                        OrderedAt = utcNow.AddDays(-random.Next(1, 730)).AddMinutes(random.Next(0, 1_440)),
                        Status = Statuses[random.Next(Statuses.Length)],
                        SalesPerson = SalesPeople[random.Next(SalesPeople.Length)]
                    };
                });

            dbContext.Orders.AddRange(orders);
            await dbContext.SaveChangesAsync(cancellationToken);
            dbContext.ChangeTracker.Clear();
        }

        logger.LogInformation("Seeded EF Core Bench Lab database with {OrderCount} orders", orderCount);
    }
}
