"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { GitCompare, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { benchmarkStore, type BenchmarkRun, type EndpointRun } from "@/lib/benchmark-store";

export default function ComparePage() {
  const [benchmarks, setBenchmarks] = useState<BenchmarkRun[]>([]);
  const [selectedBenchmark1, setSelectedBenchmark1] = useState<string>("");
  const [selectedBenchmark2, setSelectedBenchmark2] = useState<string>("");

  useEffect(() => {
    const loaded = benchmarkStore.getAllBenchmarks();
    setBenchmarks(loaded);
    if (loaded.length >= 2) {
      setSelectedBenchmark1(loaded[0].id);
      setSelectedBenchmark2(loaded[1].id);
    } else if (loaded.length === 1) {
      setSelectedBenchmark1(loaded[0].id);
    }
  }, []);

  const benchmark1 = benchmarks.find((b) => b.id === selectedBenchmark1);
  const benchmark2 = benchmarks.find((b) => b.id === selectedBenchmark2);

  // Prepare comparison data
  const comparisonData = benchmark1?.runs.map((run1) => {
    const run2 = benchmark2?.runs.find((r) => r.variant === run1.variant);
    return {
      variant: run1.variant,
      rps1: run1.results.requestsPerSecond,
      rps2: run2?.results.requestsPerSecond || 0,
      p50_1: run1.results.latencyP50,
      p50_2: run2?.results.latencyP50 || 0,
      p95_1: run1.results.latencyP95,
      p95_2: run2?.results.latencyP95 || 0,
    };
  }) || [];

  const calculateChange = (old: number, new_: number): { value: number; direction: "up" | "down" | "same" } => {
    if (old === 0) return { value: 0, direction: "same" };
    const change = ((new_ - old) / old) * 100;
    return {
      value: Math.abs(change),
      direction: change > 1 ? "up" : change < -1 ? "down" : "same",
    };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <GitCompare className="h-8 w-8" />
          Compare Benchmarks
        </h1>
        <p className="text-muted-foreground mt-2">
          Compare performance across different benchmark runs
        </p>
      </div>

      {/* Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Benchmarks</CardTitle>
          <CardDescription>Choose two benchmarks to compare</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Benchmark A (Baseline)</label>
              <Select value={selectedBenchmark1} onValueChange={setSelectedBenchmark1}>
                <SelectTrigger>
                  <SelectValue placeholder="Select benchmark" />
                </SelectTrigger>
                <SelectContent>
                  {benchmarks.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} ({new Date(b.createdAt).toLocaleDateString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Benchmark B (Comparison)</label>
              <Select value={selectedBenchmark2} onValueChange={setSelectedBenchmark2}>
                <SelectTrigger>
                  <SelectValue placeholder="Select benchmark" />
                </SelectTrigger>
                <SelectContent>
                  {benchmarks.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} ({new Date(b.createdAt).toLocaleDateString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {benchmark1 && benchmark2 && (
        <>
          {/* RPS Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Requests per Second</CardTitle>
              <CardDescription>Higher is better</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="variant" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="rps1" name={benchmark1.name} fill="#3b82f6" />
                  <Bar dataKey="rps2" name={benchmark2.name} fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Latency Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Latency (P95)</CardTitle>
              <CardDescription>Lower is better</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="variant" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} unit="ms" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="p95_1" name={`${benchmark1.name} P95`} fill="#f59e0b" />
                  <Bar dataKey="p95_2" name={`${benchmark2.name} P95`} fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Separator />

          {/* Detailed Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detailed Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4">Variant</th>
                      <th className="text-right py-2 px-4">RPS (A)</th>
                      <th className="text-right py-2 px-4">RPS (B)</th>
                      <th className="text-right py-2 px-4">Change</th>
                      <th className="text-right py-2 px-4">P95 (A)</th>
                      <th className="text-right py-2 px-4">P95 (B)</th>
                      <th className="text-right py-2 pl-4">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonData.map((row) => {
                      const rpsChange = calculateChange(row.rps1, row.rps2);
                      const p95Change = calculateChange(row.p50_1, row.p50_2);
                      
                      return (
                        <tr key={row.variant} className="border-b last:border-0">
                          <td className="py-2 pr-4">
                            <Badge variant="outline">{row.variant}</Badge>
                          </td>
                          <td className="text-right py-2 px-4 font-mono">
                            {row.rps1.toFixed(1)}
                          </td>
                          <td className="text-right py-2 px-4 font-mono">
                            {row.rps2.toFixed(1)}
                          </td>
                          <td className="text-right py-2 px-4">
                            <ChangeIndicator
                              change={rpsChange}
                              positiveIsGood={true}
                            />
                          </td>
                          <td className="text-right py-2 px-4 font-mono">
                            {row.p95_1.toFixed(0)}ms
                          </td>
                          <td className="text-right py-2 px-4 font-mono">
                            {row.p95_2.toFixed(0)}ms
                          </td>
                          <td className="text-right py-2 pl-4">
                            <ChangeIndicator
                              change={p95Change}
                              positiveIsGood={false}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {benchmarks.length < 2 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <GitCompare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>You need at least 2 saved benchmarks to compare.</p>
            <p className="text-sm mt-2">Run benchmarks from the Benchmarks page first.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ChangeIndicator({
  change,
  positiveIsGood,
}: {
  change: { value: number; direction: "up" | "down" | "same" };
  positiveIsGood: boolean;
}) {
  if (change.direction === "same") {
    return (
      <span className="flex items-center justify-end text-muted-foreground">
        <Minus className="h-4 w-4 mr-1" />
        ~0%
      </span>
    );
  }

  const isGood =
    (change.direction === "up" && positiveIsGood) ||
    (change.direction === "down" && !positiveIsGood);

  return (
    <span
      className={`flex items-center justify-end ${
        isGood ? "text-green-600" : "text-red-600"
      }`}
    >
      {change.direction === "up" ? (
        <TrendingUp className="h-4 w-4 mr-1" />
      ) : (
        <TrendingDown className="h-4 w-4 mr-1" />
      )}
      {change.value.toFixed(1)}%
    </span>
  );
}

