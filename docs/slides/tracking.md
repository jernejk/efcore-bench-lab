# EF Core Tracking Diagrams

## #1 What is going on? (With Tracking - Default Behavior)

```mermaid
flowchart TD
    A[HTTP Request] --> B["context.Products<br/>.Take(500)<br/>.ToListAsync()"]
    B --> C[EF Core Evaluates Query]
    C --> D["SQL: SELECT * FROM Products<br/>ORDER BY ...<br/>OFFSET 0 ROWS<br/>FETCH NEXT 500 ROWS ONLY"]
    D --> E[(SQL Server)]
    E --> F[EF Core Receives 500 Rows]
    F --> G[EF Core Materializes Entities]
    G --> H["Creates Product Objects<br/>+ Snapshot Copies<br/>for Change Tracking"]
    H --> I[Adds to Change Tracker]
    I --> J[Returns List of Products]
    J --> K[Response]
    
    style H fill:#ffcccc
    style I fill:#ffcccc
```

**Key Points:**
- EF Core creates **snapshot copies** of each entity for change detection
- All 500 entities are tracked in the Change Tracker
- Memory overhead: ~2-3x more than NoTracking
- Unnecessary for read-only queries

---

## #2 How is this better? (AsNoTracking)

```mermaid
flowchart TD
    A[HTTP Request] --> B["context.Products<br/>.AsNoTracking()<br/>.Take(500)<br/>.ToListAsync()"]
    B --> C[EF Core Evaluates Query]
    C --> D["SQL: SELECT * FROM Products<br/>ORDER BY ...<br/>OFFSET 0 ROWS<br/>FETCH NEXT 500 ROWS ONLY"]
    D --> E[(SQL Server)]
    E --> F[EF Core Receives 500 Rows]
    F --> G[EF Core Materializes Entities]
    G --> H["Creates Product Objects<br/>NO Snapshot Copies<br/>NO Change Tracking"]
    H --> I[Returns List of Products]
    I --> J[Response]
    
    style H fill:#ccffcc
    style I fill:#ccffcc
```

**Key Points:**
- EF Core **skips** snapshot creation
- Entities are **not** added to Change Tracker
- Same data, less memory overhead
- Faster materialization
- Perfect for read-only scenarios

---

## #3 Best Approach (Direct Projection)

```mermaid
flowchart TD
    A[HTTP Request] --> B["context.Products<br/>.Take(500)<br/>.Select(p => new ProductDto {<br/>  ProductId = p.ProductId,<br/>  Name = p.Name,<br/>  Price = p.Price<br/>})<br/>.ToListAsync()"]
    B --> C[EF Core Evaluates Query]
    C --> D["SQL: SELECT ProductId, Name, Price<br/>FROM Products<br/>ORDER BY ...<br/>OFFSET 0 ROWS<br/>FETCH NEXT 500 ROWS ONLY"]
    D --> E[(SQL Server)]
    E --> F[EF Core Receives 500 Rows]
    F --> G[EF Core Creates DTOs Directly]
    G --> H["No Entity Objects<br/>No Snapshot Copies<br/>No Change Tracking<br/>Only Needed Columns"]
    H --> I[Returns List of ProductDto]
    I --> J[Response]
    
    style D fill:#ccffcc
    style G fill:#ccffcc
    style H fill:#ccffcc
```

**Key Points:**
- **No entity objects** created at all
- Only fetches **columns needed** for the DTO
- Minimal memory usage
- Fastest materialization
- Best for display/reporting scenarios

---

## #4 Tracking with Relations (Worst Case)

```mermaid
flowchart TD
    A[HTTP Request] --> B["context.Products<br/>.Include(p => p.Sales)<br/>.Take(100)<br/>.ToListAsync()"]
    B --> C[EF Core Evaluates Query]
    C --> D["SQL: SELECT p.*, s.*<br/>FROM Products p<br/>LEFT JOIN Sales s ON ...<br/>ORDER BY ...<br/>FETCH NEXT 100 ROWS ONLY"]
    D --> E[(SQL Server)]
    E --> F[EF Core Receives Rows<br/>with Related Data]
    F --> G[EF Core Materializes Entities]
    G --> H["Creates 100 Product Objects<br/>+ Snapshot Copies<br/>Creates N Sales Objects<br/>+ Snapshot Copies"]
    H --> I["Adds ALL to Change Tracker<br/>Products + Sales"]
    I --> J[Returns List of Products]
    J --> K[Response]
    
    style H fill:#ffcccc
    style I fill:#ffcccc
```

**Key Points:**
- Tracking overhead **multiplies** with each relation
- Both Products AND Sales are tracked
- Maximum memory overhead
- Worst performance for read-only queries

---

## #5 NoTracking with Relations (Better)

```mermaid
flowchart TD
    A[HTTP Request] --> B["context.Products<br/>.AsNoTracking()<br/>.Include(p => p.Sales)<br/>.Take(100)<br/>.ToListAsync()"]
    B --> C[EF Core Evaluates Query]
    C --> D["SQL: SELECT p.*, s.*<br/>FROM Products p<br/>LEFT JOIN Sales s ON ...<br/>ORDER BY ...<br/>FETCH NEXT 100 ROWS ONLY"]
    D --> E[(SQL Server)]
    E --> F[EF Core Receives Rows<br/>with Related Data]
    F --> G[EF Core Materializes Entities]
    G --> H["Creates 100 Product Objects<br/>Creates N Sales Objects<br/>NO Snapshot Copies<br/>NO Change Tracking"]
    H --> I[Returns List of Products]
    I --> J[Response]
    
    style H fill:#ccffcc
    style I fill:#ccffcc
```

**Key Points:**
- Related entities loaded without tracking overhead
- Still fetches all columns (could be optimized)
- Better than tracking, but projection is still best

---

## #6 Projection with Aggregates (Best for Reporting)

```mermaid
flowchart TD
    A[HTTP Request] --> B["context.Products<br/>.Take(100)<br/>.Select(p => new ProductDto {<br/>  ProductId = p.ProductId,<br/>  Name = p.Name,<br/>  SalesCount = p.Sales.Count,<br/>  TotalRevenue = p.Sales.Sum(s => s.TotalAmount)<br/>})<br/>.ToListAsync()"]
    B --> C[EF Core Evaluates Query]
    C --> D["SQL: SELECT p.ProductId, p.Name,<br/>  COUNT(s.SaleId) as SalesCount,<br/>  SUM(s.TotalAmount) as TotalRevenue<br/>FROM Products p<br/>LEFT JOIN Sales s ON ...<br/>GROUP BY p.ProductId, p.Name<br/>ORDER BY ...<br/>FETCH NEXT 100 ROWS ONLY"]
    D --> E[(SQL Server)]
    E --> F[EF Core Receives Aggregated Results]
    F --> G[EF Core Creates DTOs Directly]
    G --> H["No Entity Objects<br/>No Snapshot Copies<br/>Aggregates Computed in SQL<br/>Minimal Data Transfer"]
    H --> I[Returns List of ProductDto]
    I --> J[Response]
    
    style D fill:#ccffcc
    style G fill:#ccffcc
    style H fill:#ccffcc
```

**Key Points:**
- Aggregates computed **in SQL**, not in memory
- Only aggregated results transferred
- No entity objects, no tracking
- Best for reporting/analytics scenarios

---

## Fact Check: IEnumerable vs IQueryable Diagrams

### Diagram #1: "What is going on?" (IEnumerable Issue)

**✅ CORRECT**

The diagram correctly illustrates that:
- Using `IEnumerable<Sale>` (like `context.Sales` directly) causes EF Core to materialize the query immediately
- EF Core generates `SELECT * FROM Sales` and loads ALL records into memory
- Operations like `.Count()` then execute in-memory on the loaded collection
- This is inefficient because it fetches unnecessary data

**Technical Accuracy:**
- When you access `DbSet<T>` as `IEnumerable`, EF Core materializes immediately
- The `.Count()` operation happens in C# memory, not in SQL
- This is a common performance anti-pattern

### Diagram #2: "How is this better?" (IQueryable with Count)

**✅ CORRECT**

The diagram correctly illustrates that:
- Using `IQueryable<Sale>.Count()` allows EF Core to evaluate the entire query expression tree
- EF Core translates `.Count()` to `SELECT COUNT(*) FROM Sales`
- Only a single integer is returned from the database
- This is efficient because the count happens in SQL

**Technical Accuracy:**
- `IQueryable` defers execution until enumeration
- EF Core's query provider translates LINQ to SQL
- `COUNT(*)` executes efficiently on the database server
- This is the recommended approach for counting

**Note:** These diagrams are about `IEnumerable` vs `IQueryable`, not specifically about tracking, but they demonstrate an important EF Core performance concept.

