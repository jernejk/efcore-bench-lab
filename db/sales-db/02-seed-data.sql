USE SalesDB;
GO

SET NOCOUNT ON;

-- Seed Employees (50 employees)
PRINT 'Seeding Employees...';

DECLARE @i INT = 1;
WHILE @i <= 50
BEGIN
    INSERT INTO Employees (FirstName, LastName, Email, Department, HireDate, Salary)
    VALUES (
        'Employee' + CAST(@i AS NVARCHAR(10)),
        'LastName' + CAST(@i AS NVARCHAR(10)),
        'employee' + CAST(@i AS NVARCHAR(10)) + '@company.com',
        CASE (@i % 5) 
            WHEN 0 THEN 'Sales'
            WHEN 1 THEN 'Marketing'
            WHEN 2 THEN 'Support'
            WHEN 3 THEN 'Engineering'
            ELSE 'HR'
        END,
        DATEADD(DAY, -(@i * 30), GETUTCDATE()),
        50000 + (@i * 1000)
    );
    SET @i = @i + 1;
END

PRINT 'Employees seeded: 50';

-- Seed Products (500 products)
PRINT 'Seeding Products...';

SET @i = 1;
WHILE @i <= 500
BEGIN
    INSERT INTO Products (Name, Description, Price, Category, StockQuantity)
    VALUES (
        'Product ' + CAST(@i AS NVARCHAR(10)),
        'Description for product ' + CAST(@i AS NVARCHAR(10)) + '. This is a sample product for performance testing.',
        CAST((10 + (@i % 990)) AS DECIMAL(18,2)) + 0.99,
        CASE (@i % 10)
            WHEN 0 THEN 'Electronics'
            WHEN 1 THEN 'Clothing'
            WHEN 2 THEN 'Food'
            WHEN 3 THEN 'Books'
            WHEN 4 THEN 'Sports'
            WHEN 5 THEN 'Home'
            WHEN 6 THEN 'Garden'
            WHEN 7 THEN 'Toys'
            WHEN 8 THEN 'Health'
            ELSE 'Automotive'
        END,
        @i * 10
    );
    SET @i = @i + 1;
END

PRINT 'Products seeded: 500';

-- Seed Customers (10,000 customers)
PRINT 'Seeding Customers...';

SET @i = 1;
WHILE @i <= 10000
BEGIN
    INSERT INTO Customers (FirstName, LastName, Email, Phone, Address, City, State, Country)
    VALUES (
        'Customer' + CAST(@i AS NVARCHAR(10)),
        'Surname' + CAST(@i AS NVARCHAR(10)),
        'customer' + CAST(@i AS NVARCHAR(10)) + '@email.com',
        '+1-555-' + RIGHT('0000' + CAST(@i % 10000 AS NVARCHAR(10)), 4),
        CAST(@i AS NVARCHAR(10)) + ' Main Street',
        CASE (@i % 10)
            WHEN 0 THEN 'New York'
            WHEN 1 THEN 'Los Angeles'
            WHEN 2 THEN 'Chicago'
            WHEN 3 THEN 'Houston'
            WHEN 4 THEN 'Phoenix'
            WHEN 5 THEN 'London'
            WHEN 6 THEN 'Sydney'
            WHEN 7 THEN 'Toronto'
            WHEN 8 THEN 'Berlin'
            ELSE 'Tokyo'
        END,
        CASE (@i % 10)
            WHEN 0 THEN 'NY'
            WHEN 1 THEN 'CA'
            WHEN 2 THEN 'IL'
            WHEN 3 THEN 'TX'
            WHEN 4 THEN 'AZ'
            WHEN 5 THEN 'England'
            WHEN 6 THEN 'NSW'
            WHEN 7 THEN 'Ontario'
            WHEN 8 THEN 'Berlin'
            ELSE 'Tokyo'
        END,
        CASE (@i % 10)
            WHEN 0 THEN 'USA'
            WHEN 1 THEN 'USA'
            WHEN 2 THEN 'USA'
            WHEN 3 THEN 'USA'
            WHEN 4 THEN 'USA'
            WHEN 5 THEN 'UK'
            WHEN 6 THEN 'Australia'
            WHEN 7 THEN 'Canada'
            WHEN 8 THEN 'Germany'
            ELSE 'Japan'
        END
    );
    
    SET @i = @i + 1;
    
    IF @i % 1000 = 0
        PRINT 'Customers seeded: ' + CAST(@i AS NVARCHAR(10));
END

PRINT 'Customers seeded: 10000';

-- Seed Sales (10,000,000 sales records) - Using batch inserts for better performance
PRINT 'Seeding Sales (10,000,000 records) using batch inserts...';

-- Create a temporary table to hold batch data
CREATE TABLE #SalesBatch (
    CustomerId INT,
    ProductId INT,
    SalesPersonId INT,
    Quantity INT,
    UnitPrice DECIMAL(18,2),
    TotalAmount DECIMAL(18,2),
    SaleDate DATETIME2
);

DECLARE @batchSize INT = 10000; -- Insert 10,000 records at a time
DECLARE @totalRecords INT = 10000000;
DECLARE @currentBatch INT = 0;

WHILE @currentBatch < @totalRecords
BEGIN
    -- Clear the batch table
    TRUNCATE TABLE #SalesBatch;

    -- Generate batch data
    DECLARE @batchStart INT = @currentBatch + 1;
    DECLARE @batchEnd INT = CASE WHEN @currentBatch + @batchSize > @totalRecords THEN @totalRecords ELSE @currentBatch + @batchSize END;

    ;WITH Numbers AS (
        SELECT TOP (@batchEnd - @batchStart + 1)
            ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) + @batchStart - 1 AS RowNum
        FROM sys.all_columns a1, sys.all_columns a2, sys.all_columns a3
    )
    INSERT INTO #SalesBatch (CustomerId, ProductId, SalesPersonId, Quantity, UnitPrice, TotalAmount, SaleDate)
    SELECT
        ((RowNum - 1) % 10000) + 1 as CustomerId,
        ((RowNum - 1) % 500) + 1 as ProductId,
        ((RowNum - 1) % 50) + 1 as SalesPersonId,
        (RowNum % 10) + 1 as Quantity,
        CAST((10 + (((RowNum - 1) % 500) % 990)) AS DECIMAL(18,2)) + 0.99 as UnitPrice,
        ((RowNum % 10) + 1) * (CAST((10 + (((RowNum - 1) % 500) % 990)) AS DECIMAL(18,2)) + 0.99) as TotalAmount,
        DATEADD(DAY, -(RowNum % 730), GETUTCDATE()) as SaleDate
    FROM Numbers;

    -- Insert the batch into the main table
    INSERT INTO Sales (CustomerId, ProductId, SalesPersonId, Quantity, UnitPrice, TotalAmount, SaleDate)
    SELECT CustomerId, ProductId, SalesPersonId, Quantity, UnitPrice, TotalAmount, SaleDate
    FROM #SalesBatch;

    SET @currentBatch = @batchEnd;

    PRINT 'Sales seeded: ' + CAST(@currentBatch AS NVARCHAR(10)) + ' / 10000000 (' +
          CAST(CAST(@currentBatch AS DECIMAL(18,2)) / 100000.00 AS NVARCHAR(10)) + '%)';
END

-- Clean up
DROP TABLE #SalesBatch;

PRINT 'Sales seeded: 10000000';

-- Print summary
PRINT '';
PRINT '=== Seed Data Summary ===';
SELECT 'Employees' as TableName, COUNT(*) as RecordCount FROM Employees
UNION ALL
SELECT 'Products', COUNT(*) FROM Products
UNION ALL
SELECT 'Customers', COUNT(*) FROM Customers
UNION ALL
SELECT 'Sales', COUNT(*) FROM Sales;
PRINT '=========================';
GO
