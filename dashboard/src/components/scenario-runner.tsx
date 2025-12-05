"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Loader2 } from "lucide-react";
import { MetricsCard } from "./metrics-card";
import { SqlViewer } from "./sql-viewer";
import { webApiClient, type ScenarioResponse } from "@/lib/webapi-client";
import { formatDuration, formatBytes } from "@/lib/format-utils";
import { toast } from "sonner";

interface Variant {
  id: string;
  name: string;
  description: string;
  isBad?: boolean;
  isGood?: boolean;
  queryGoal?: string;
  queryBehavior?: string;
}

interface ScenarioRunnerProps {
  scenario: string;
  variants: Variant[];
  defaultParams?: Record<string, string | number | boolean>;
}

export function ScenarioRunner({ scenario, variants, defaultParams = {} }: ScenarioRunnerProps) {
  const [results, setResults] = useState<Record<string, ScenarioResponse<unknown>>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [includeExecutionPlan, setIncludeExecutionPlan] = useState(false);

  const runVariant = async (variantId: string) => {
    setLoading((prev) => ({ ...prev, [variantId]: true }));
    
    try {
      const params = new URLSearchParams();
      Object.entries(defaultParams).forEach(([key, value]) => {
        params.set(key, String(value));
      });
      if (includeExecutionPlan) {
        params.set("includeExecutionPlan", "true");
      }

      const response = await fetch(
        `http://localhost:5847/api/scenarios/${scenario}/${variantId}?${params.toString()}`,
        {
          headers: {
            "X-Request-Id": crypto.randomUUID().replace(/-/g, ""),
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setResults((prev) => ({ ...prev, [variantId]: data }));
      toast.success(`${variantId} completed`);
    } catch (error) {
      toast.error(`Failed to run ${variantId}: ${error}`);
    } finally {
      setLoading((prev) => ({ ...prev, [variantId]: false }));
    }
  };

  const runAll = async () => {
    for (const variant of variants) {
      await runVariant(variant.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Run Scenarios</CardTitle>
              <CardDescription>
                Execute different variants to compare performance
              </CardDescription>
            </div>
            <Button onClick={runAll} disabled={Object.values(loading).some(Boolean)}>
              {Object.values(loading).some(Boolean) ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Run All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Switch
              id="execution-plan"
              checked={includeExecutionPlan}
              onCheckedChange={setIncludeExecutionPlan}
            />
            <Label htmlFor="execution-plan" className="text-sm">
              Include Execution Plan (slower)
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Variant Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {variants.map((variant) => (
          <Card key={variant.id} className={variant.isBad ? "border-red-200" : variant.isGood ? "border-green-200" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    {variant.name}
                    {variant.isBad && <Badge variant="destructive">Bad</Badge>}
                    {variant.isGood && <Badge className="bg-green-600">Good</Badge>}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {variant.description}
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => runVariant(variant.id)}
                  disabled={loading[variant.id]}
                >
                  {loading[variant.id] ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading[variant.id] && (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              )}
              {results[variant.id] && !loading[variant.id] && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Duration: </span>
                      <span className="font-semibold">
                        {formatDuration(results[variant.id].metrics.durationMs)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Queries: </span>
                      <span className="font-semibold">
                        {results[variant.id].metrics.queryCount}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Rows: </span>
                      <span className="font-semibold">
                        {results[variant.id].metrics.rowsReturned.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Memory: </span>
                      <span className="font-semibold">
                        {formatBytes(results[variant.id].metrics.memoryAllocatedBytes)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed Results */}
      {Object.keys(results).length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Detailed Results</h3>
          {Object.entries(results).map(([variantId, result]) => (
            <div key={variantId} className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{variantId}</Badge>
                <span className="text-sm text-muted-foreground">
                  {result.variantDescription}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <MetricsCard metrics={result.metrics} title={`${variantId} Metrics`} />
                <SqlViewer 
                  queries={result.queries} 
                  title={`${variantId} SQL`}
                  queryGoal={variants.find(v => v.id === variantId)?.queryGoal}
                  queryBehavior={variants.find(v => v.id === variantId)?.queryBehavior}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

