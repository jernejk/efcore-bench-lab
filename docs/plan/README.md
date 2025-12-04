# EF Core Bench Lab - Implementation Plan

> **Purpose**: Demonstrate the importance of building efficient EF Core queries through interactive demos, benchmarking, and AI-assisted analysis.

## Quick Links

- [Architecture Overview](./architecture.md)
- [Project Structure](./project-structure.md)
- [Scenarios Specification](./scenarios.md)
- [AI Integration](./ai-integration.md)
- [Benchmarking](./benchmarking.md)
- [Telemetry Strategy](./telemetry.md)

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           User Browser                                   │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────────┐
│                    Next.js Dashboard (Port 3847)                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ React UI: Charts, Markdown, Tables, AI Chat, Execution Plan Viewer  ││
│  └─────────────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ API Routes: /api/benchmarks, /api/ai, /api/webapi, /api/telemetry   ││
│  └─────────────────────────────────────────────────────────────────────┘│
└──────┬──────────────────┬─────────────────────┬─────────────────────────┘
       │                  │                     │
       ▼                  ▼                     ▼
┌──────────────┐  ┌───────────────┐  ┌─────────────────────────────────────┐
│  LM Studio   │  │ Benchmark     │  │        .NET 10 WebAPI (Port 5847)   │
│  (AI/LLM)    │  │ Storage       │  │  ┌─────────────────────────────────┐│
│  Port 1234   │  │ SQLite+JSON   │  │  │ EF Core 10 + OpenTelemetry      ││
└──────────────┘  └───────────────┘  │  │ Telemetry + ExecutionPlan       ││
                                     │  │ Interceptors                    ││
                                     │  └─────────────────────────────────┘│
                                     │  ┌─────────────────────────────────┐│
                                     │  │ Scenarios: N+1, Pagination,     ││
                                     │  │ Tracking, Updates, Cancellation ││
                                     │  └─────────────────────────────────┘│
                                     └──────────────────┬──────────────────┘
                                                        │
                                     ┌──────────────────▼──────────────────┐
                                     │  SQL Server (Docker, Port 11433)    │
                                     │  - SalesDB / StackOverflow          │
                                     └─────────────────────────────────────┘

Optional: .NET Aspire Dashboard (Port 18888) for telemetry queries
```

## Technology Stack

| Component | Technology | Port |
|-----------|------------|------|
| WebAPI | .NET 10, EF Core 10 | 5847 |
| Dashboard | Next.js 15, React 19, TypeScript | 3847 |
| Database | SQL Server 2022 (Docker) | 11433 |
| AI Primary | LM Studio (local) | 1234 |
| AI Fallback | OpenAI / Azure OpenAI | - |
| Orchestration | .NET Aspire (optional) | 18888 |

## Implementation Phases

### Phase 1: Foundation
- [ ] WebAPI with EF Core 10, interceptors, OpenTelemetry
- [ ] Next.js dashboard with basic layout
- [ ] Docker Compose for SQL Server

### Phase 2: Core Scenarios
- [ ] N+1 Query Problem
- [ ] Pagination Trap
- [ ] ToList/IEnumerable Trap
- [ ] Tracking Overhead
- [ ] Bulk Updates
- [ ] Cancellation Tokens

### Phase 3: Dashboard Features
- [ ] Scenario pages with comparison views
- [ ] Charts and metrics visualization
- [ ] SQL viewer with syntax highlighting

### Phase 4: AI Integration
- [ ] LM Studio provider (auto-control via CLI)
- [ ] OpenAI / Azure OpenAI providers
- [ ] Query analysis and suggestions

### Phase 5: Benchmarking
- [ ] Benchmark runner with progress
- [ ] SQLite + JSON snapshot storage
- [ ] Comparison and reporting

### Phase 6: Advanced (Post-MVP)
- [ ] Execution plan visualizer
- [ ] Query data flow diagrams
- [ ] Custom URL testing
- [ ] Real-time metrics dashboard

## Key Design Decisions

1. **WebAPI Independence**: WebAPI knows nothing about the dashboard. Communication via HTTP + correlation headers only.

2. **Flexible Scenario Variants**: Not fixed `worst/bad/good/best` labels. Use descriptive names like `explicit-loop`, `projection`, `keyset`.

3. **Execution Plan Capture**: Optional via `?includeExecutionPlan=true`. Uses `SET STATISTICS XML ON`. Slows queries - for analysis only, not benchmarks.

4. **Telemetry**: Query .NET Aspire OTLP endpoint when available. Fallback to WebAPI query log.

5. **Benchmark Storage**: SQLite for summaries (fast queries), JSON for full details (portable).

6. **AI Provider Settings**: Checkbox for LM Studio auto-control, dropdown for model selection, support for multiple providers.

