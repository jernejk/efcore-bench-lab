import { config } from './config';

export interface ScenarioResponse<T> {
  requestId: string;
  scenario: string;
  variant: string;
  variantDescription?: string;
  result: T;
  metrics: ScenarioMetrics;
  queries: QueryInfo[];
}

export interface ScenarioMetrics {
  durationMs: number;
  queryCount: number;
  rowsReturned: number;
  memoryAllocatedBytes: number;
}

export interface QueryInfo {
  sql: string;
  durationMs: number;
  parameters: Record<string, unknown>;
  executionPlan?: string;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
}

export interface ServerInfo {
  runtime: string;
  os: string;
  architecture: string;
  processorCount: number;
  workingSet: number;
  timestamp: string;
}

export interface HardwareInfo {
  os: string;
  architecture: string;
  processorCount: number;
  runtime: string;
  cpuBrand?: string;
  performanceCores?: number;
  efficiencyCores?: number;
  physicalCores?: number;
  logicalProcessors?: number;
  memoryGB?: number;
  gpuCores?: number;
  performanceL2CacheMB?: number;
  efficiencyL2CacheMB?: number;
  timestamp: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  isKey: boolean;
}

export interface TableStats {
  tableName: string;
  rowCount: number;
  columns: ColumnInfo[];
}

export interface DatabaseStats {
  database: string;
  timestamp: string;
  tables: TableStats[];
}

class WebApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || config.webApiUrl;
  }

  setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  private async fetch<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const requestId = crypto.randomUUID().replace(/-/g, '');
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Health and Info
  async health(): Promise<HealthResponse> {
    return this.fetch('/api/meta/health');
  }

  async info(): Promise<ServerInfo> {
    return this.fetch('/api/meta/info');
  }

  async hardware(): Promise<HardwareInfo> {
    return this.fetch('/api/meta/hardware');
  }

  async dbStats(): Promise<DatabaseStats> {
    return this.fetch('/api/meta/db-stats');
  }

  // Query Logs
  async getQueryLog(requestId: string) {
    return this.fetch(`/api/meta/query-log/${requestId}`);
  }

  async getRecentQueries(count = 100) {
    return this.fetch(`/api/meta/query-log?count=${count}`);
  }

  async clearQueryLog() {
    return this.fetch('/api/meta/query-log', { method: 'DELETE' });
  }

  // Generic scenario runner
  async runScenario<T>(
    scenario: string,
    variant: string,
    options?: { includeExecutionPlan?: boolean }
  ): Promise<ScenarioResponse<T>> {
    const params = new URLSearchParams();
    if (options?.includeExecutionPlan) {
      params.set('includeExecutionPlan', 'true');
    }
    
    const queryString = params.toString();
    const url = `/api/scenarios/${scenario}/${variant}${queryString ? `?${queryString}` : ''}`;
    
    return this.fetch(url);
  }
}

export const webApiClient = new WebApiClient();

