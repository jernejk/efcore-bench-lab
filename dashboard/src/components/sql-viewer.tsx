"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Check, Code } from "lucide-react";
import { toast } from "sonner";
import type { QueryInfo } from "@/lib/webapi-client";
import { ExecutionPlanDialog } from "@/components/execution-plan-dialog";

interface SqlViewerProps {
  queries: QueryInfo[];
  title?: string;
  queryGoal?: string;
  queryBehavior?: string;
}

export function SqlViewer({ queries, title = "SQL Queries", queryGoal, queryBehavior }: SqlViewerProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = async (sql: string, index: number) => {
    await navigator.clipboard.writeText(sql);
    setCopiedIndex(index);
    toast.success("SQL copied to clipboard");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (queries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Code className="h-4 w-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No queries recorded</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Code className="h-4 w-4" />
          {title}
          <Badge variant="secondary" className="ml-2">
            {queries.length} {queries.length === 1 ? "query" : "queries"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-4">
            {queries.map((query, index) => (
              <div
                key={index}
                className="border rounded-lg overflow-hidden"
              >
                <div className="bg-muted/50 px-3 py-2 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Query {index + 1}</Badge>
                    <span className="text-muted-foreground">
                      {query.durationMs.toFixed(2)} ms
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {query.executionPlan && (
                      <ExecutionPlanDialog 
                        executionPlan={query.executionPlan}
                        sql={query.sql}
                        queryDurationMs={query.durationMs}
                        queryGoal={queryGoal}
                        queryBehavior={queryBehavior}
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(query.sql, index)}
                    >
                      {copiedIndex === index ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <pre className="p-3 text-sm overflow-x-auto bg-background">
                  <code className="text-foreground whitespace-pre-wrap break-words">
                    {formatSql(query.sql)}
                  </code>
                </pre>
                {Object.keys(query.parameters).length > 0 && (
                  <div className="border-t px-3 py-2 text-xs">
                    <span className="text-muted-foreground">Parameters: </span>
                    {Object.entries(query.parameters).map(([key, value], i) => (
                      <span key={key}>
                        {i > 0 && ", "}
                        <code className="bg-muted px-1 rounded">
                          {key}={String(value)}
                        </code>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function formatSql(sql: string): string {
  // Basic SQL formatting - uppercase keywords
  const keywords = [
    "SELECT", "FROM", "WHERE", "AND", "OR", "ORDER BY", "GROUP BY",
    "HAVING", "JOIN", "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "OUTER JOIN",
    "ON", "AS", "IN", "NOT", "NULL", "IS", "LIKE", "BETWEEN",
    "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE",
    "COUNT", "SUM", "AVG", "MAX", "MIN", "TOP", "DISTINCT",
    "OFFSET", "FETCH", "NEXT", "ROWS", "ONLY", "TAKE", "SKIP"
  ];
  
  let formatted = sql;
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, "gi");
    formatted = formatted.replace(regex, keyword);
  });
  
  return formatted;
}

