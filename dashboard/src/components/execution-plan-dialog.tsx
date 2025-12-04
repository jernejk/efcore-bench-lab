"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  BarChart3,
  Bot,
  Copy,
  Check,
  Send,
  Loader2,
  AlertTriangle,
  Zap,
  HardDrive,
  Clock,
  Table2,
  GitBranch,
  Search,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ExecutionPlanStats {
  // Operation info
  physicalOp: string;
  logicalOp: string;
  
  // Estimates
  estimatedRows: number;
  estimatedCost: number;
  estimatedIO: number;
  estimatedCPU: number;
  
  // Actuals (runtime stats - these prove it's actual not estimated)
  actualRows?: number;
  actualLogicalReads?: number;
  actualPhysicalReads?: number;
  actualScans?: number;
  actualElapsedMs?: number;
  actualCpuMs?: number;
  actualRowsRead?: number;
  
  // Table/Index info
  tableName?: string;
  indexName?: string;
  indexKind?: string;
  
  // Warnings
  warnings: string[];
  
  // Plan metadata
  queryHash?: string;
  planHash?: string;
  optimizationLevel?: string;
  parallelism?: number;
  
  // All operations in the plan
  operations: OperationInfo[];
}

interface OperationInfo {
  nodeId: number;
  physicalOp: string;
  logicalOp: string;
  estimatedRows: number;
  actualRows?: number;
  cost: number;
  tableName?: string;
  indexName?: string;
}

interface ExecutionPlanDialogProps {
  executionPlan: string;
  sql?: string;
  queryDurationMs?: number;
}

export function ExecutionPlanDialog({ executionPlan, sql, queryDurationMs }: ExecutionPlanDialogProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<ExecutionPlanStats | null>(null);
  
  // AI analysis state
  const [aiMessages, setAiMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && executionPlan) {
      const parsed = parseExecutionPlan(executionPlan);
      setStats(parsed);
    }
  }, [open, executionPlan]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [aiMessages, aiLoading]);

  const copyPlan = async () => {
    await navigator.clipboard.writeText(executionPlan);
    setCopied(true);
    toast.success("Execution plan copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const formatXml = (xml: string): string => {
    try {
      let formatted = "";
      let indent = 0;
      const parts = xml.split(/(<[^>]+>)/g).filter(Boolean);
      
      for (const part of parts) {
        if (part.startsWith("</")) {
          indent = Math.max(0, indent - 1);
          formatted += "  ".repeat(indent) + part + "\n";
        } else if (part.startsWith("<") && part.endsWith("/>")) {
          formatted += "  ".repeat(indent) + part + "\n";
        } else if (part.startsWith("<")) {
          formatted += "  ".repeat(indent) + part + "\n";
          if (!part.includes("</")) {
            indent++;
          }
        } else if (part.trim()) {
          formatted += "  ".repeat(indent) + part.trim() + "\n";
        }
      }
      return formatted;
    } catch {
      return xml;
    }
  };

  const sendAiMessage = async (customPrompt?: string) => {
    const prompt = customPrompt || aiInput;
    if (!prompt.trim() || aiLoading) return;

    const userMessage = { role: "user", content: prompt };
    setAiMessages((prev) => [...prev, userMessage]);
    setAiInput("");
    setAiLoading(true);
    setAiError(null);

    try {
      const context = {
        sql,
        executionPlan: executionPlan.substring(0, 15000), // Limit size
        metrics: stats ? {
          actualRows: stats.actualRows,
          actualLogicalReads: stats.actualLogicalReads,
          estimatedRows: stats.estimatedRows,
          physicalOp: stats.physicalOp,
          tableName: stats.tableName,
          indexName: stats.indexName,
          warnings: stats.warnings,
        } : undefined,
        queryDurationMs,
      };

      const operationsSummary = stats?.operations?.length 
        ? stats.operations.map(op => 
            `- ${op.physicalOp} (${op.tableName || 'N/A'}): Est ${op.estimatedRows?.toLocaleString() ?? 'N/A'} rows, Actual ${op.actualRows?.toLocaleString() ?? 'N/A'} rows`
          ).join("\n")
        : "(Unable to parse)";

      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "analyze",
          provider: "lmstudio", // Default to local LLM
          prompt: `You are a SQL Server performance expert. Analyze this execution plan and ${prompt.toLowerCase().includes("explain") ? "explain it" : "suggest improvements"}.

User question: ${prompt}

SQL Query:
${sql || "(Not provided)"}

Key Statistics:
- Physical Operation: ${stats?.physicalOp || "Unknown"}
- Estimated Rows: ${stats?.estimatedRows?.toLocaleString() ?? "Unknown"}
- Actual Rows: ${stats?.actualRows?.toLocaleString() ?? "Unknown"}
- Actual Logical Reads: ${stats?.actualLogicalReads?.toLocaleString() ?? "Unknown"}
- Table: ${stats?.tableName || "Unknown"}
- Index: ${stats?.indexName || "Unknown"}
- Warnings: ${stats?.warnings?.length ? stats.warnings.join(", ") : "None"}

Execution Plan Operations:
${operationsSummary}

Please provide actionable insights.`,
          context,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to get AI response");
      }

      const data = await response.json();
      setAiMessages((prev) => [...prev, { role: "assistant", content: data.result }]);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setAiLoading(false);
    }
  };

  const hasActualStats = stats?.actualRows !== undefined || stats?.actualLogicalReads !== undefined;

  const suggestedPrompts = [
    "Explain this execution plan",
    "Why might this be slow?",
    "Suggest index improvements",
    "Is this plan optimal?",
  ];

  const resetChat = () => {
    setAiMessages([]);
    setAiInput("");
    setAiError(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1">
          <FileText className="h-4 w-4" />
          View Plan
        </Button>
      </DialogTrigger>
      <DialogContent className="!w-[98vw] !max-w-[1600px] h-[92vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Execution Plan Analysis
            {hasActualStats && (
              <Badge variant="secondary" className="ml-2">
                <Zap className="h-3 w-3 mr-1" />
                Actual Stats
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="statistics" className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
            <TabsTrigger value="statistics" className="gap-1">
              <BarChart3 className="h-4 w-4" />
              Statistics
            </TabsTrigger>
            <TabsTrigger value="raw" className="gap-1">
              <FileText className="h-4 w-4" />
              Raw Plan
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-1">
              <Bot className="h-4 w-4" />
              AI Analysis
            </TabsTrigger>
          </TabsList>

          {/* Statistics Tab */}
          <TabsContent value="statistics" className="flex-1 min-h-0 overflow-hidden mt-4">
            <ScrollArea className="h-full pr-4">
              {stats ? (
                <div className="space-y-6">
                  {/* Warnings Section */}
                  {stats.warnings.length > 0 && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                      <h4 className="font-semibold text-yellow-600 dark:text-yellow-400 flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4" />
                        Warnings
                      </h4>
                      <ul className="text-sm space-y-1">
                        {stats.warnings.map((warning, i) => (
                          <li key={i} className="text-yellow-700 dark:text-yellow-300">• {warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MetricCard
                      icon={<Table2 className="h-4 w-4" />}
                      label="Actual Rows"
                      value={stats.actualRows?.toLocaleString() ?? "N/A"}
                      subValue={stats.estimatedRows ? `Est: ${stats.estimatedRows.toLocaleString()}` : undefined}
                      highlight={stats.actualRows !== undefined && stats.estimatedRows !== undefined && 
                        Math.abs(stats.actualRows - stats.estimatedRows) / Math.max(stats.estimatedRows, 1) > 0.5}
                    />
                    <MetricCard
                      icon={<HardDrive className="h-4 w-4" />}
                      label="Logical Reads"
                      value={stats.actualLogicalReads?.toLocaleString() ?? "N/A"}
                      subValue={stats.actualPhysicalReads ? `Physical: ${stats.actualPhysicalReads}` : undefined}
                    />
                    <MetricCard
                      icon={<Search className="h-4 w-4" />}
                      label="Scans"
                      value={stats.actualScans?.toLocaleString() ?? "N/A"}
                      subValue={stats.actualRowsRead ? `Rows read: ${stats.actualRowsRead.toLocaleString()}` : undefined}
                    />
                    <MetricCard
                      icon={<Clock className="h-4 w-4" />}
                      label="Elapsed Time"
                      value={stats.actualElapsedMs !== undefined ? `${stats.actualElapsedMs}ms` : "N/A"}
                      subValue={stats.actualCpuMs !== undefined ? `CPU: ${stats.actualCpuMs}ms` : undefined}
                    />
                  </div>

                  {/* Operation Info */}
                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <GitBranch className="h-4 w-4" />
                      Primary Operation
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Physical Op:</span>{" "}
                        <Badge variant="outline">{stats.physicalOp}</Badge>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Logical Op:</span>{" "}
                        <Badge variant="outline">{stats.logicalOp}</Badge>
                      </div>
                      {stats.tableName && (
                        <div>
                          <span className="text-muted-foreground">Table:</span>{" "}
                          <code className="bg-muted px-1 rounded">{stats.tableName}</code>
                        </div>
                      )}
                      {stats.indexName && (
                        <div>
                          <span className="text-muted-foreground">Index:</span>{" "}
                          <code className="bg-muted px-1 rounded">{stats.indexName}</code>
                          {stats.indexKind && <span className="text-muted-foreground ml-1">({stats.indexKind})</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Plan Metadata */}
                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-3">Plan Metadata</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {stats.optimizationLevel && (
                        <div>
                          <span className="text-muted-foreground">Optimization:</span>{" "}
                          <span className="font-mono">{stats.optimizationLevel}</span>
                        </div>
                      )}
                      {stats.parallelism !== undefined && (
                        <div>
                          <span className="text-muted-foreground">Parallelism:</span>{" "}
                          <span className="font-mono">{stats.parallelism}</span>
                        </div>
                      )}
                      {stats.estimatedCost !== undefined && (
                        <div>
                          <span className="text-muted-foreground">Est. Cost:</span>{" "}
                          <span className="font-mono">{stats.estimatedCost.toFixed(6)}</span>
                        </div>
                      )}
                      {stats.queryHash && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Query Hash:</span>{" "}
                          <code className="text-xs bg-muted px-1 rounded">{stats.queryHash}</code>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* All Operations */}
                  {stats.operations.length > 0 && (
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-3">All Operations ({stats.operations.length})</h4>
                      <div className="space-y-2">
                        {stats.operations.map((op, i) => (
                          <div key={i} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{op.nodeId}</Badge>
                              <span className="font-medium">{op.physicalOp}</span>
                              {op.tableName && (
                                <code className="text-xs bg-muted px-1 rounded">{op.tableName}</code>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-muted-foreground">
                              <span>Est: {op.estimatedRows.toLocaleString()}</span>
                              {op.actualRows !== undefined && (
                                <span className={
                                  Math.abs(op.actualRows - op.estimatedRows) / Math.max(op.estimatedRows, 1) > 0.5
                                    ? "text-yellow-600 dark:text-yellow-400 font-medium"
                                    : ""
                                }>
                                  Actual: {op.actualRows.toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Raw Plan Tab */}
          <TabsContent value="raw" className="flex-1 min-h-0 overflow-hidden mt-4 flex flex-col">
            <div className="flex justify-end mb-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={copyPlan}>
                {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                {copied ? "Copied!" : "Copy XML"}
              </Button>
            </div>
            <ScrollArea className="flex-1 border rounded-lg">
              <pre className="p-4 text-xs font-mono">
                <code className="text-muted-foreground whitespace-pre">
                  {formatXml(executionPlan)}
                </code>
              </pre>
            </ScrollArea>
          </TabsContent>

          {/* AI Analysis Tab */}
          <TabsContent value="ai" className="flex-1 min-h-0 overflow-hidden mt-4 flex flex-col">
            {/* Header with reset button */}
            <div className="flex justify-between items-center mb-3 flex-shrink-0">
              <p className="text-sm text-muted-foreground">
                {aiMessages.length > 0 
                  ? `${aiMessages.length} message${aiMessages.length > 1 ? 's' : ''} in conversation`
                  : "Ask AI to analyze this execution plan"}
              </p>
              {aiMessages.length > 0 && (
                <Button variant="outline" size="sm" onClick={resetChat}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset Chat
                </Button>
              )}
            </div>

            {/* Messages area - scrollable */}
            <div className="flex-1 min-h-0 overflow-y-auto border rounded-lg" ref={scrollRef}>
              <div className="p-4 space-y-4">
                {aiMessages.length === 0 && (
                  <div className="text-center py-12">
                    <Bot className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-6">
                      Ask AI to explain this execution plan or suggest improvements
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
                      {suggestedPrompts.map((prompt) => (
                        <Button
                          key={prompt}
                          variant="outline"
                          size="sm"
                          onClick={() => sendAiMessage(prompt)}
                          disabled={aiLoading}
                        >
                          {prompt}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {aiMessages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div className="relative max-w-[90%]">
                      {message.role === "assistant" && (
                        <div className="absolute -left-2 -top-2 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center z-10">
                          <Bot className="h-3 w-3 text-primary" />
                        </div>
                      )}
                      <div
                        className={`rounded-lg px-4 py-3 ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        {message.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm">{message.content}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {aiLoading && (
                  <div className="flex justify-start">
                    <div className="relative max-w-[90%]">
                      <div className="absolute -left-2 -top-2 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center z-10">
                        <Bot className="h-3 w-3 text-primary animate-pulse" />
                      </div>
                      <div className="bg-muted rounded-lg px-4 py-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                          <span className="text-sm text-muted-foreground animate-pulse">AI is analyzing...</span>
                        </div>
                        <div className="space-y-2">
                          <div className="h-3 bg-primary/10 rounded animate-pulse" style={{ width: '80%' }} />
                          <div className="h-3 bg-primary/10 rounded animate-pulse" style={{ width: '60%', animationDelay: '150ms' }} />
                          <div className="h-3 bg-primary/10 rounded animate-pulse" style={{ width: '70%', animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {aiError && (
                  <div className="bg-destructive/10 text-destructive rounded-lg px-4 py-3 text-sm">
                    <strong>Error:</strong> {aiError}
                  </div>
                )}

                {/* Suggested follow-up questions after AI response */}
                {aiMessages.length > 0 && !aiLoading && (
                  <div className="pt-4 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Continue the conversation:</p>
                    <div className="flex flex-wrap gap-2">
                      {suggestedPrompts.map((prompt) => (
                        <Button
                          key={prompt}
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => sendAiMessage(prompt)}
                          disabled={aiLoading}
                        >
                          {prompt}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Fixed Input at bottom */}
            <div className="flex gap-2 mt-3 flex-shrink-0 pt-3 border-t bg-background">
              <Input
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendAiMessage()}
                placeholder="Ask about this execution plan..."
                disabled={aiLoading}
                className="flex-1"
              />
              <Button onClick={() => sendAiMessage()} disabled={aiLoading || !aiInput.trim()}>
                {aiLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({ 
  icon, 
  label, 
  value, 
  subValue, 
  highlight 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string; 
  subValue?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`border rounded-lg p-3 ${highlight ? 'border-yellow-500/50 bg-yellow-500/5' : ''}`}>
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
        {highlight && <AlertTriangle className="h-3 w-3 text-yellow-500" />}
      </div>
      <div className="font-semibold">{value}</div>
      {subValue && <div className="text-xs text-muted-foreground">{subValue}</div>}
    </div>
  );
}

function parseExecutionPlan(xml: string): ExecutionPlanStats {
  const warnings: string[] = [];
  const operations: OperationInfo[] = [];
  
  // Helper to extract attribute value
  const getAttr = (pattern: RegExp): string | undefined => {
    const match = xml.match(pattern);
    return match?.[1];
  };
  
  const getNumAttr = (pattern: RegExp): number | undefined => {
    const val = getAttr(pattern);
    return val ? parseFloat(val) : undefined;
  };

  // Find main RelOp (usually the first one with significant info)
  const relOpMatch = xml.match(/<RelOp[^>]+NodeId="0"[^>]*>/);
  const firstRelOp = relOpMatch?.[0] || "";
  
  // Extract primary operation info
  const physicalOp = getAttr(/PhysicalOp="([^"]+)"/) || "Unknown";
  const logicalOp = getAttr(/LogicalOp="([^"]+)"/) || "Unknown";
  const estimatedRows = getNumAttr(/EstimateRows="([^"]+)"/) || 0;
  const estimatedCost = getNumAttr(/EstimatedTotalSubtreeCost="([^"]+)"/) || 0;
  const estimatedIO = getNumAttr(/EstimateIO="([^"]+)"/) || 0;
  const estimatedCPU = getNumAttr(/EstimateCPU="([^"]+)"/) || 0;
  
  // Extract actual runtime stats (these are in RunTimeCountersPerThread)
  const actualRows = getNumAttr(/ActualRows="(\d+)"/);
  const actualLogicalReads = getNumAttr(/ActualLogicalReads="(\d+)"/);
  const actualPhysicalReads = getNumAttr(/ActualPhysicalReads="(\d+)"/);
  const actualScans = getNumAttr(/ActualScans="(\d+)"/);
  const actualElapsedMs = getNumAttr(/ActualElapsedms="(\d+)"/);
  const actualCpuMs = getNumAttr(/ActualCPUms="(\d+)"/);
  const actualRowsRead = getNumAttr(/ActualRowsRead="(\d+)"/);
  
  // Extract table/index info
  const tableMatch = xml.match(/Table="\[([^\]]+)\]"/);
  const indexMatch = xml.match(/Index="\[([^\]]+)\]"/);
  const indexKindMatch = xml.match(/IndexKind="([^"]+)"/);
  
  // Extract plan metadata
  const queryHash = getAttr(/QueryHash="([^"]+)"/);
  const planHash = getAttr(/QueryPlanHash="([^"]+)"/);
  const optimizationLevel = getAttr(/StatementOptmLevel="([^"]+)"/);
  const parallelism = getNumAttr(/DegreeOfParallelism="(\d+)"/);
  
  // Check for warnings
  if (xml.includes("NoJoinPredicate")) {
    warnings.push("Missing JOIN predicate - potential Cartesian product");
  }
  if (xml.includes("SpillToTempDb")) {
    warnings.push("Query spilled to TempDb - may need more memory");
  }
  if (xml.includes("ColumnsWithNoStatistics")) {
    warnings.push("Missing column statistics - estimates may be inaccurate");
  }
  if (xml.includes('Warnings="')) {
    const warningMatch = xml.match(/Warnings="([^"]+)"/);
    if (warningMatch) {
      warnings.push(warningMatch[1]);
    }
  }
  
  // Check for estimate vs actual mismatch
  if (actualRows !== undefined && estimatedRows > 0) {
    const ratio = actualRows / estimatedRows;
    if (ratio > 10 || ratio < 0.1) {
      warnings.push(`Large estimate mismatch: Est ${estimatedRows.toLocaleString()} vs Actual ${actualRows.toLocaleString()} rows`);
    }
  }
  
  // Parse all RelOp nodes for operations list
  const relOpRegex = /<RelOp[^>]+>/g;
  let match;
  while ((match = relOpRegex.exec(xml)) !== null) {
    const opXml = match[0];
    const nodeId = parseInt(opXml.match(/NodeId="(\d+)"/)?.[1] || "0");
    const opPhysical = opXml.match(/PhysicalOp="([^"]+)"/)?.[1] || "Unknown";
    const opLogical = opXml.match(/LogicalOp="([^"]+)"/)?.[1] || "Unknown";
    const opEstRows = parseFloat(opXml.match(/EstimateRows="([^"]+)"/)?.[1] || "0");
    const opCost = parseFloat(opXml.match(/EstimatedTotalSubtreeCost="([^"]+)"/)?.[1] || "0");
    
    // Find runtime info for this node
    const runtimeSection = xml.substring(match.index, match.index + 2000);
    const opActualRows = runtimeSection.match(/ActualRows="(\d+)"/)?.[1];
    
    // Find table reference
    const tableSection = xml.substring(match.index, match.index + 1000);
    const opTable = tableSection.match(/Table="\[([^\]]+)\]"/)?.[1];
    const opIndex = tableSection.match(/Index="\[([^\]]+)\]"/)?.[1];
    
    operations.push({
      nodeId,
      physicalOp: opPhysical,
      logicalOp: opLogical,
      estimatedRows: isNaN(opEstRows) ? 0 : opEstRows,
      actualRows: opActualRows ? parseInt(opActualRows) : undefined,
      cost: isNaN(opCost) ? 0 : opCost,
      tableName: opTable,
      indexName: opIndex,
    });
  }
  
  // Sort by node ID
  operations.sort((a, b) => a.nodeId - b.nodeId);
  
  return {
    physicalOp,
    logicalOp,
    estimatedRows,
    estimatedCost,
    estimatedIO,
    estimatedCPU,
    actualRows,
    actualLogicalReads,
    actualPhysicalReads,
    actualScans,
    actualElapsedMs,
    actualCpuMs,
    actualRowsRead,
    tableName: tableMatch?.[1],
    indexName: indexMatch?.[1],
    indexKind: indexKindMatch?.[1],
    warnings,
    queryHash,
    planHash,
    optimizationLevel,
    parallelism,
    operations,
  };
}
