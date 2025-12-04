# EF Core Performance Lab

Interactive demonstration tool for EF Core query performance best practices and anti-patterns.

## Quick Start

### Prerequisites

- .NET 10 SDK
- Node.js 20+
- Docker Desktop
- (Optional) LM Studio for AI features

### 1. Start SQL Server

```bash
cd db
docker-compose up -d
```

### 2. Seed the Database

```bash
# Run the seed scripts
./scripts/seed-database.sh

# Or manually:
docker exec -i efcore-perf-sqlserver /opt/mssql-tools18/bin/sqlcmd \
    -S localhost -U sa -P 'YourStrong@Passw0rd' -C \
    -i /docker-entrypoint-initdb.d/01-create-database.sql

docker exec -i efcore-perf-sqlserver /opt/mssql-tools18/bin/sqlcmd \
    -S localhost -U sa -P 'YourStrong@Passw0rd' -C \
    -i /docker-entrypoint-initdb.d/02-seed-data.sql
```

### 3. Start WebAPI

```bash
cd webapi/EFCorePerf.Api
dotnet run
```

WebAPI will be available at: http://localhost:5847

### 4. Start Dashboard

```bash
cd dashboard
npm install
npm run dev
```

Dashboard will be available at: http://localhost:3847

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser                                      │
│                    http://localhost:3847                             │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────┐
│                    Next.js Dashboard                                 │
│  • React UI with Charts, Markdown, Tables                           │
│  • AI Analysis (LM Studio / OpenAI / Azure OpenAI)                  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                    .NET 10 WebAPI                                    │
│                    http://localhost:5847                             │
│  • EF Core 10 with SQL Server                                       │
│  • OpenTelemetry instrumentation                                    │
│  • Query logging and execution plan capture                         │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                    SQL Server 2022                                   │
│                    localhost:11433                                   │
│  • SalesDB with 100K+ records                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Scenarios

| Scenario | Description | Key Learning |
|----------|-------------|--------------|
| N+1 Problem | Loop queries vs projections | Query count: 101 → 1 |
| Pagination | Offset vs keyset | Constant time vs O(n) |
| Tracking | AsNoTracking, projections | Memory & speed improvements |
| Bulk Updates | ExecuteUpdate vs traditional | Orders of magnitude faster |
| Cancellation | CancellationToken usage | Prevent resource waste |
| ToList Trap | IQueryable vs IEnumerable | Client-side evaluation |

## API Endpoints

### Meta
- `GET /api/meta/health` - Health check
- `GET /api/meta/info` - Server information
- `GET /api/meta/query-log/{requestId}` - Get queries for a request
- `GET /api/meta/query-log` - Get recent queries

### Scenarios
- `GET /api/scenarios/{scenario}/{variant}` - Run a scenario variant
- Add `?includeExecutionPlan=true` to capture execution plan (slower)

## Configuration

### WebAPI (appsettings.json)
```json
{
  "ConnectionStrings": {
    "SalesDb": "Server=localhost,11433;Database=SalesDB;User Id=sa;Password=YourStrong@Passw0rd;TrustServerCertificate=True"
  }
}
```

### Dashboard
Configure via Settings page or environment variables:
- `NEXT_PUBLIC_WEBAPI_URL` - WebAPI base URL
- `OPENAI_API_KEY` - OpenAI API key
- `AZURE_OPENAI_ENDPOINT` - Azure OpenAI endpoint
- `AZURE_OPENAI_API_KEY` - Azure OpenAI API key

## Ports

| Service | Port |
|---------|------|
| Dashboard | 3847 |
| WebAPI | 5847 |
| SQL Server | 11433 |
| LM Studio | 1234 |
| Aspire Dashboard | 18888 |

## License

MIT

