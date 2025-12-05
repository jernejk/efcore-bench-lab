"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Loader2, Zap } from "lucide-react";
import { MetricsCard } from "@/components/metrics-card";
import { SqlViewer } from "@/components/sql-viewer";
import { formatDuration, formatBytes } from "@/lib/format-utils";
import { SqlViewer as SqlViewerComponent } from "@/components/sql-viewer";
import { toast } from "sonner";
import type { ScenarioResponse } from "@/lib/webapi-client";

interface Variant {
  id: string;
  name: string;
  description: string;
  isBad?: boolean;
  isGood?: boolean;
  queryGoal?: string;
  queryBehavior?: string;
}

const variants: Variant[] = [
  {
    id: "loop-update",
    name: "Loop Update",
    description: "Load entities, loop update, SaveChanges - inefficient",
    isBad: true,
    queryGoal: "Swap first and last names for employees",
    queryBehavior: "ANTI-PATTERN: Loads all entities into memory, updates in a loop, then calls SaveChanges(). Multiple round trips and high memory usage.",
  },
  {
    id: "execute-update",
    name: "ExecuteUpdate",
    description: "Update directly in SQL - efficient",
    isGood: true,
    queryGoal: "Swap first and last names for employees",
    queryBehavior: "OPTIMAL: ExecuteUpdate() performs the update directly in SQL with a single statement. No entities loaded into memory.",
  },
];

export default function UpdatePage() {
  const [results, setResults] = useState<Record<string, ScenarioResponse<unknown>>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [includeExecutionPlan, setIncludeExecutionPlan] = useState(false);

  const runVariant = async (variantId: string) => {
    setLoading((prev) => ({ ...prev, [variantId]: true }));

    try {
      const params = new URLSearchParams();
      params.set("isLoadFriendly", "true");
      if (includeExecutionPlan) {
        params.set("includeExecutionPlan", "true");
      }

      const response = await fetch(
        `http://localhost:5847/api/scenarios/update-demo/${variantId}?${params}`,
        {
          headers: {
            "X-Request-Id": crypto.randomUUID().replace(/-/g, ""),
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      setResults((prev) => ({ ...prev, [variantId]: result }));
      toast.success(`${variants.find(v => v.id === variantId)?.name} completed`);
    } catch (error) {
      toast.error(`Failed to run ${variantId}: ${error}`);
    } finally {
      setLoading((prev) => ({ ...prev, [variantId]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Zap className="h-8 w-8" />
          Update Patterns
        </h1>
        <p className="text-muted-foreground mt-2">
          Demonstrates ExecuteUpdate vs traditional load-modify-save patterns.
          ExecuteUpdate performs updates directly in SQL without loading entities.
        </p>
      </div>

      <div className="bg-muted/50 border rounded-lg p-4">
        <h3 className="font-semibold mb-2">What to look for:</h3>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
          <li><strong>SQL:</strong> Loop shows SELECT then multiple UPDATEs, ExecuteUpdate shows single UPDATE statement</li>
          <li><strong>Network:</strong> Loop transfers all entity data, ExecuteUpdate transfers minimal data</li>
          <li><strong>Memory:</strong> Loop loads all entities, ExecuteUpdate uses minimal memory</li>
          <li><strong>Performance:</strong> ExecuteUpdate is much faster for bulk updates</li>
        </ul>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <h3 className="font-semibold mb-2 text-amber-800 dark:text-amber-200">💡 Tip</h3>
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Use ExecuteUpdate() and ExecuteDelete() for bulk operations. They execute
          directly in SQL without loading entities into memory. This is especially
          important for operations affecting many rows.
        </p>
      </div>

      <div className="flex items-center space-x-2 mb-4">
        <Switch
          id="execution-plan"
          checked={includeExecutionPlan}
          onCheckedChange={setIncludeExecutionPlan}
        />
        <Label htmlFor="execution-plan">Include execution plan</Label>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {variants.map((variant) => (
          <Card key={variant.id}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {variant.name}
                {variant.isBad && <Badge variant="destructive">Anti-pattern</Badge>}
                {variant.isGood && <Badge variant="default">Best practice</Badge>}
              </CardTitle>
              <CardDescription>{variant.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {variant.queryGoal && (
                <div>
                  <p className="text-sm font-medium">Goal:</p>
                  <p className="text-sm text-muted-foreground">{variant.queryGoal}</p>
                </div>
              )}

              {variant.queryBehavior && (
                <div>
                  <p className="text-sm font-medium">Behavior:</p>
                  <p className="text-sm text-muted-foreground">{variant.queryBehavior}</p>
                </div>
              )}

              <Button
                onClick={() => runVariant(variant.id)}
                disabled={loading[variant.id]}
                className="w-full"
              >
                {loading[variant.id] ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run Test
                  </>
                )}
              </Button>

              {results[variant.id] && (
                <div className="space-y-4">
                  <MetricsCard metrics={results[variant.id].metrics} />

                  {results[variant.id].queries && results[variant.id].queries.length > 0 && (
                    <SqlViewerComponent queries={results[variant.id].queries} />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
