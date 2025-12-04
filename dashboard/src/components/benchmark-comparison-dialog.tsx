"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import type { BenchmarkRun } from "@/lib/benchmark-store";

interface BenchmarkComparisonDialogProps {
  benchmark: BenchmarkRun | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BenchmarkComparisonDialog({
  benchmark,
  open,
  onOpenChange,
}: BenchmarkComparisonDialogProps) {
  if (!benchmark) return null;

  const rpsData = benchmark.runs.map((run) => ({
    variant: run.variant,
    rps: Math.round(run.results.requestsPerSecond * 10) / 10,
  }));

  const latencyData = benchmark.runs.map((run) => ({
    variant: run.variant,
    P50: run.results.latencyP50,
    P95: run.results.latencyP95,
    P99: run.results.latencyP99,
  }));

  const resourceData = benchmark.runs
    .filter((run) => run.results.avgCpuPercent !== undefined)
    .map((run) => ({
      variant: run.variant,
      cpu: Math.round((run.results.avgCpuPercent || 0) * 10) / 10,
      memory: Math.round(run.results.avgMemoryMB || 0),
      peakMemory: Math.round(run.results.peakMemoryMB || 0),
    }));

  // Normalize data for radar chart (0-100 scale)
  const maxRps = Math.max(...benchmark.runs.map((r) => r.results.requestsPerSecond));
  const maxLatency = Math.max(...benchmark.runs.map((r) => r.results.latencyP95));
  const maxMemory = Math.max(...benchmark.runs.map((r) => r.results.peakMemoryMB || 0));

  const radarData = benchmark.runs.map((run) => ({
    variant: run.variant,
    // Higher is better for RPS (normalize to 100)
    Throughput: Math.round((run.results.requestsPerSecond / maxRps) * 100),
    // Lower is better for latency (invert and normalize)
    Latency: Math.round((1 - run.results.latencyP95 / maxLatency) * 100),
    // Lower is better for memory (invert and normalize)
    Memory: maxMemory > 0 
      ? Math.round((1 - (run.results.peakMemoryMB || 0) / maxMemory) * 100) 
      : 50,
    // Lower errors is better
    Reliability: Math.round((1 - run.results.errors / Math.max(run.results.totalRequests, 1)) * 100),
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {benchmark.name}
            <Badge variant="outline">{benchmark.runs.length} variants</Badge>
          </DialogTitle>
          <DialogDescription>
            {new Date(benchmark.createdAt).toLocaleString()} • {benchmark.hardware.os}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="throughput" className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="throughput">Throughput</TabsTrigger>
            <TabsTrigger value="latency">Latency</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="radar">Overview</TabsTrigger>
          </TabsList>

          <TabsContent value="throughput" className="mt-4">
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rpsData} layout="vertical" margin={{ left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="variant" type="category" tick={{ fontSize: 12 }} width={100} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                    formatter={(value: number) => [`${value} req/s`, "Throughput"]}
                  />
                  <Bar dataKey="rps" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-sm text-muted-foreground text-center mt-2">
              Higher is better • Requests per second
            </p>
          </TabsContent>

          <TabsContent value="latency" className="mt-4">
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={latencyData} margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="variant" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} unit="ms" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="P50" name="P50 (median)" fill="#10b981" />
                  <Bar dataKey="P95" name="P95" fill="#f59e0b" />
                  <Bar dataKey="P99" name="P99" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-sm text-muted-foreground text-center mt-2">
              Lower is better • Response time in milliseconds
            </p>
          </TabsContent>

          <TabsContent value="resources" className="mt-4">
            {resourceData.length > 0 ? (
              <>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={resourceData} margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="variant" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} unit="%" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "var(--radius)",
                        }}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="memory" name="Avg Memory (MB)" fill="#8b5cf6" />
                      <Bar yAxisId="left" dataKey="peakMemory" name="Peak Memory (MB)" fill="#ec4899" />
                      <Bar yAxisId="right" dataKey="cpu" name="Avg CPU (%)" fill="#06b6d4" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-sm text-muted-foreground text-center mt-2">
                  Lower is better • Resource consumption during benchmark
                </p>
              </>
            ) : (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                No resource data available for this benchmark.
                <br />
                Run a new benchmark to capture CPU/memory metrics.
              </div>
            )}
          </TabsContent>

          <TabsContent value="radar" className="mt-4">
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid className="stroke-muted" />
                  <PolarAngleAxis dataKey="variant" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar
                    name="Throughput"
                    dataKey="Throughput"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.3}
                  />
                  <Radar
                    name="Latency"
                    dataKey="Latency"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.3}
                  />
                  <Radar
                    name="Memory"
                    dataKey="Memory"
                    stroke="#8b5cf6"
                    fill="#8b5cf6"
                    fillOpacity={0.3}
                  />
                  <Radar
                    name="Reliability"
                    dataKey="Reliability"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.3}
                  />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-sm text-muted-foreground text-center mt-2">
              Higher is better for all metrics (normalized 0-100)
            </p>
          </TabsContent>
        </Tabs>

        {/* Summary Table */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4">Variant</th>
                <th className="text-right py-2 px-2">Req/s</th>
                <th className="text-right py-2 px-2">P95</th>
                <th className="text-right py-2 px-2">CPU</th>
                <th className="text-right py-2 px-2">Memory</th>
                <th className="text-right py-2 pl-2">Errors</th>
              </tr>
            </thead>
            <tbody>
              {benchmark.runs.map((run) => (
                <tr key={run.variant} className="border-b last:border-0">
                  <td className="py-2 pr-4">
                    <Badge variant="outline">{run.variant}</Badge>
                  </td>
                  <td className="text-right py-2 px-2 font-mono">
                    {run.results.requestsPerSecond.toFixed(1)}
                  </td>
                  <td className="text-right py-2 px-2 font-mono">
                    {run.results.latencyP95.toFixed(0)}ms
                  </td>
                  <td className="text-right py-2 px-2 font-mono">
                    {run.results.avgCpuPercent?.toFixed(1) || "-"}%
                  </td>
                  <td className="text-right py-2 px-2 font-mono">
                    {run.results.avgMemoryMB?.toFixed(0) || "-"} MB
                  </td>
                  <td className="text-right py-2 pl-2 font-mono">
                    {run.results.errors > 0 ? (
                      <Badge variant="destructive">{run.results.errors}</Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

