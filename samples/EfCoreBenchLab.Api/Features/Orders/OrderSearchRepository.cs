using EfCoreBenchLab.Api.Data;
using EfCoreBenchLab.Diagnostics.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace EfCoreBenchLab.Api.Features.Orders;

public sealed class OrderSearchRepository(BenchLabDbContext dbContext)
{
    private const int BadSearchCandidateLimit = 5_000;

    public async Task<IReadOnlyList<OrderSearchResult>> GetRecentPaidOrdersAsync(
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        return await dbContext.Orders
            .TagWithContext("HealthyRecentPaidOrders: status/date lookup with bounded projection")
            .AsNoTracking()
            .Where(order => order.Status == "Paid")
            .OrderByDescending(order => order.OrderedAt)
            .Skip(page * pageSize)
            .Take(pageSize)
            .Select(order => new OrderSearchResult(
                order.Id,
                order.Customer.Name,
                order.Customer.Region,
                order.Product.Name,
                order.Product.Category,
                order.Quantity,
                order.Total,
                order.OrderedAt,
                order.Status,
                order.SalesPerson))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<OrderSearchResult>> SearchWithKnownPerformanceProblemAsync(
        string search,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var loweredSearch = search.ToLowerInvariant();

        return await dbContext.Orders
            .TagWithContext("DeepBadOrderSearch: wildcard text search across joined order data")
            .AsNoTracking()
            .Where(order => order.Status != "Cancelled")
            .OrderByDescending(order => order.OrderedAt)
            .Take(BadSearchCandidateLimit)
            .Where(order =>
                (order.Customer.Name + " " + order.Customer.Region + " " + order.Product.Name + " " + order.SalesPerson)
                .ToLower()
                .Contains(loweredSearch))
            .OrderBy(order => order.Customer.Region)
            .ThenBy(order => order.OrderedAt)
            .Skip(page * pageSize)
            .Take(pageSize)
            .Select(order => new OrderSearchResult(
                order.Id,
                order.Customer.Name,
                order.Customer.Region,
                order.Product.Name,
                order.Product.Category,
                order.Quantity,
                order.Total,
                order.OrderedAt,
                order.Status,
                order.SalesPerson))
            .ToListAsync(cancellationToken);
    }

    public async Task<OverFetchResult> SearchByOverFetchingAsync(
        string search,
        int page,
        int pageSize,
        int fetchCount,
        CancellationToken cancellationToken)
    {
        var loweredSearch = search.ToLowerInvariant();

        var fetchedRows = await dbContext.Orders
            .TagWithContext("OverFetchingOrders: materialize broad joined order set before filtering")
            .AsNoTracking()
            .Include(order => order.Customer)
            .Include(order => order.Product)
            .OrderByDescending(order => order.OrderedAt)
            .Take(fetchCount)
            .ToListAsync(cancellationToken);

        var matchedRows = fetchedRows
            .Where(order =>
                $"{order.Customer.Name} {order.Customer.Region} {order.Product.Name} {order.SalesPerson}"
                    .Contains(loweredSearch, StringComparison.OrdinalIgnoreCase))
            .OrderBy(order => order.Customer.Region)
            .ThenBy(order => order.OrderedAt)
            .ToArray();

        var returnedRows = matchedRows
            .Skip(page * pageSize)
            .Take(pageSize)
            .Select(MapOrder)
            .ToArray();

        return new OverFetchResult(fetchedRows.Count, matchedRows.Length, returnedRows);
    }

    public async Task<IReadOnlyList<OrderSearchResult>> SearchWithIndexedPathAsync(
        int customerId,
        int pageSize,
        CancellationToken cancellationToken)
    {
        return await dbContext.Orders
            .TagWithContext("HealthyCustomerOrderLookup: indexed customer/date path")
            .AsNoTracking()
            .Where(order => order.CustomerId == customerId)
            .OrderByDescending(order => order.OrderedAt)
            .Take(pageSize)
            .Select(order => new OrderSearchResult(
                order.Id,
                order.Customer.Name,
                order.Customer.Region,
                order.Product.Name,
                order.Product.Category,
                order.Quantity,
                order.Total,
                order.OrderedAt,
                order.Status,
                order.SalesPerson))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<CustomerOrderCountResult>> CountOrdersWithNPlusOneAsync(
        string region,
        int customerCount,
        CancellationToken cancellationToken)
    {
        var customers = await dbContext.Customers
            .TagWithContext("NPlusOneCustomers: initial customer list for per-row order lookups")
            .AsNoTracking()
            .Where(customer => customer.Region == region)
            .OrderBy(customer => customer.Name)
            .Take(customerCount)
            .ToListAsync(cancellationToken);

        var results = new List<CustomerOrderCountResult>(customers.Count);
        foreach (var customer in customers)
        {
            var activeOrderCount = await dbContext.Orders
                .TagWithContext("NPlusOneOrderCount: one count query per customer in loop")
                .AsNoTracking()
                .Where(order => order.CustomerId == customer.Id && order.Status != "Cancelled")
                .CountAsync(cancellationToken);

            var latestOrderAt = await dbContext.Orders
                .TagWithContext("NPlusOneLatestOrder: one latest-order query per customer in loop")
                .AsNoTracking()
                .Where(order => order.CustomerId == customer.Id)
                .OrderByDescending(order => order.OrderedAt)
                .Select(order => (DateTimeOffset?)order.OrderedAt)
                .FirstOrDefaultAsync(cancellationToken);

            results.Add(new CustomerOrderCountResult(
                customer.Id,
                customer.Name,
                customer.Region,
                activeOrderCount,
                latestOrderAt));
        }

        return results;
    }

    private static OrderSearchResult MapOrder(SalesOrder order)
    {
        return new OrderSearchResult(
            order.Id,
            order.Customer.Name,
            order.Customer.Region,
            order.Product.Name,
            order.Product.Category,
            order.Quantity,
            order.Total,
            order.OrderedAt,
            order.Status,
            order.SalesPerson);
    }
}

public sealed record OverFetchResult(
    int FetchedRows,
    int MatchedRows,
    IReadOnlyList<OrderSearchResult> ReturnedRows);
