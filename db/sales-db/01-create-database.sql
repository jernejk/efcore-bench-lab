-- Create database if not exists
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'SalesDB')
BEGIN
    CREATE DATABASE SalesDB;
END
GO

USE SalesDB;
GO

-- Drop existing tables if they exist (for clean setup)
IF OBJECT_ID('Sales', 'U') IS NOT NULL DROP TABLE Sales;
IF OBJECT_ID('Products', 'U') IS NOT NULL DROP TABLE Products;
IF OBJECT_ID('Employees', 'U') IS NOT NULL DROP TABLE Employees;
IF OBJECT_ID('Customers', 'U') IS NOT NULL DROP TABLE Customers;
GO

-- Create Customers table
CREATE TABLE Customers (
    CustomerId INT IDENTITY(1,1) PRIMARY KEY,
    FirstName NVARCHAR(100) NOT NULL,
    LastName NVARCHAR(100) NOT NULL,
    Email NVARCHAR(255) NOT NULL,
    Phone NVARCHAR(20) NULL,
    Address NVARCHAR(500) NULL,
    City NVARCHAR(100) NULL,
    State NVARCHAR(100) NULL,
    Country NVARCHAR(100) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);

CREATE INDEX IX_Customers_Email ON Customers(Email);
CREATE INDEX IX_Customers_Name ON Customers(LastName, FirstName);
GO

-- Create Products table
CREATE TABLE Products (
    ProductId INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(200) NOT NULL,
    Description NVARCHAR(2000) NULL,
    Price DECIMAL(18,2) NOT NULL,
    Category NVARCHAR(100) NULL,
    StockQuantity INT NOT NULL DEFAULT 0,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);

CREATE INDEX IX_Products_Category ON Products(Category);
CREATE INDEX IX_Products_Name ON Products(Name);
GO

-- Create Employees table
CREATE TABLE Employees (
    EmployeeId INT IDENTITY(1,1) PRIMARY KEY,
    FirstName NVARCHAR(100) NOT NULL,
    LastName NVARCHAR(100) NOT NULL,
    Email NVARCHAR(255) NOT NULL,
    Department NVARCHAR(100) NULL,
    HireDate DATETIME2 NOT NULL,
    Salary DECIMAL(18,2) NULL
);

CREATE INDEX IX_Employees_Email ON Employees(Email);
CREATE INDEX IX_Employees_Department ON Employees(Department);
GO

-- Create Sales table
CREATE TABLE Sales (
    SalesId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerId INT NOT NULL,
    ProductId INT NOT NULL,
    SalesPersonId INT NOT NULL,
    Quantity INT NOT NULL,
    UnitPrice DECIMAL(18,2) NOT NULL,
    TotalAmount DECIMAL(18,2) NOT NULL,
    SaleDate DATETIME2 NOT NULL,
    CONSTRAINT FK_Sales_Customer FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId),
    CONSTRAINT FK_Sales_Product FOREIGN KEY (ProductId) REFERENCES Products(ProductId),
    CONSTRAINT FK_Sales_Employee FOREIGN KEY (SalesPersonId) REFERENCES Employees(EmployeeId)
);

CREATE INDEX IX_Sales_SaleDate ON Sales(SaleDate);
CREATE INDEX IX_Sales_CustomerId ON Sales(CustomerId);
CREATE INDEX IX_Sales_ProductId ON Sales(ProductId);
CREATE INDEX IX_Sales_SalesPersonId ON Sales(SalesPersonId);
GO

PRINT 'Database schema created successfully';
GO

