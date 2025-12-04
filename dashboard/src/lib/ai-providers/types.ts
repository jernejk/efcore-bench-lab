export interface AIProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  analyze(prompt: string, context?: AnalysisContext): Promise<string>;
  chat(messages: ChatMessage[]): Promise<string>;
}

export interface AnalysisContext {
  sql?: string;
  executionPlan?: string;
  metrics?: {
    durationMs?: number;
    queryCount?: number;
    rowsReturned?: number;
    memoryAllocatedBytes?: number;
    // Execution plan specific metrics
    actualRows?: number;
    actualLogicalReads?: number;
    estimatedRows?: number;
    physicalOp?: string;
    tableName?: string;
    indexName?: string;
    warnings?: string[];
  };
  scenario?: string;
  variant?: string;
  queryDurationMs?: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIProviderConfig {
  provider: "lmstudio" | "openai" | "azure-openai";
  lmstudioUrl?: string;
  lmstudioModel?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  azureEndpoint?: string;
  azureApiKey?: string;
  azureDeployment?: string;
}

export const SYSTEM_PROMPT = `You are an expert in Entity Framework Core and SQL Server performance optimization.
Your role is to:
1. Analyze SQL queries and explain why they might be slow
2. Explain how EF Core translates LINQ to SQL
3. Suggest optimizations for EF Core queries
4. Help developers understand execution plans
5. Compare different query approaches and explain trade-offs

When analyzing queries:
- Point out potential performance issues (N+1, missing indexes, cartesian explosions)
- Explain what EF Core is doing under the hood
- Suggest concrete code improvements
- Use clear, educational language

Format your responses with Markdown for readability. Use code blocks for SQL and C# code examples.`;

