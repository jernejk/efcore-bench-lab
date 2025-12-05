"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { GitCompare, TrendingUp, TrendingDown, Minus, X, Search, Plus } from "lucide-react";
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
import { benchmarkStore, type BenchmarkRun } from "@/lib/benchmark-store";

// Colors for up to 4 benchmarks
const BENCHMARK_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];
const BENCHMARK_LABELS = ["A", "B", "C", "D"];

export default function ComparePage() {
  const [benchmarks, setBenchmarks] = useState<BenchmarkRun[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQueries, setSearchQueries] = useState<string[]>(["", "", "", ""]);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);

  useEffect(() => {
    const loaded = benchmarkStore.getAllBenchmarks();
    setBenchmarks(loaded);
    // Start with nothing selected by default
  }, []);

  // Get selected benchmarks
  const selectedBenchmarks = selectedIds
    .map((id) => benchmarks.find((b) => b.id === id))
    .filter((b): b is BenchmarkRun => b !== undefined);

  // Filter benchmarks for autocomplete
  const getFilteredBenchmarks = (index: number) => {
    const query = searchQueries[index].toLowerCase();
    return benchmarks.filter((b) => {
      // Don't show already selected benchmarks (except if it's the current slot)
      if (selectedIds.includes(b.id) && selectedIds[index] !== b.id) return false;
      // Filter by search query
      if (!query) return true;
      return (
        b.name.toLowerCase().includes(query) ||
        new Date(b.createdAt).toLocaleDateString().includes(query)
      );
    });
  };

  const handleSelectBenchmark = (index: number, benchmarkId: string) => {
    const newSelectedIds = [...selectedIds];
    // Ensure array is long enough
    while (newSelectedIds.length <= index) {
      newSelectedIds.push("");
    }
    newSelectedIds[index] = benchmarkId;
    // Remove empty slots but keep order
    setSelectedIds(newSelectedIds.filter((id) => id !== ""));
    setActiveDropdown(null);
    // Clear search
    const newQueries = [...searchQueries];
    newQueries[index] = "";
    setSearchQueries(newQueries);
  };

  const handleRemoveBenchmark = (index: number) => {
    const newSelectedIds = selectedIds.filter((_, i) => i !== index);
    setSelectedIds(newSelectedIds);
  };

  const handleAddSlot = () => {
    if (selectedIds.length < 4) {
      setActiveDropdown(selectedIds.length);
    }
  };

  // Prepare comparison data - works with 1 to 4 benchmarks
  const comparisonData = useMemo(() => {
    if (selectedBenchmarks.length === 0) return [];

    // Get all unique variants across all selected benchmarks
    const allVariants = new Set<string>();
    selectedBenchmarks.forEach((b) => {
      b.runs.forEach((run) => allVariants.add(run.variant));
    });

    return Array.from(allVariants).map((variant) => {
      const data: Record<string, string | number> = { variant };
      selectedBenchmarks.forEach((benchmark, idx) => {
        const run = benchmark.runs.find((r) => r.variant === variant);
        data[`rps${idx}`] = run?.results.requestsPerSecond || 0;
        data[`p50_${idx}`] = run?.results.latencyP50 || 0;
        data[`p95_${idx}`] = run?.results.latencyP95 || 0;
        data[`p99_${idx}`] = run?.results.latencyP99 || 0;
      });
      return data;
    });
  }, [selectedBenchmarks]);

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
          Compare performance across up to 4 benchmark runs
        </p>
      </div>

      {/* Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Benchmarks</CardTitle>
          <CardDescription>Choose up to 4 benchmarks to compare (type to search)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Render slots for selected benchmarks + one empty slot if < 4 */}
            {Array.from({ length: Math.min(selectedIds.length + 1, 4) }).map((_, index) => {
              const selectedId = selectedIds[index];
              const selectedBenchmark = benchmarks.find((b) => b.id === selectedId);
              const isActive = activeDropdown === index;
              const filtered = getFilteredBenchmarks(index);

              return (
                <div key={index} className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: BENCHMARK_COLORS[index] }}
                    />
                    Benchmark {BENCHMARK_LABELS[index]}
                    {index === 0 && <span className="text-muted-foreground">(Baseline)</span>}
                  </label>
                  <div className="relative">
                    {selectedBenchmark ? (
                      <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                        <div className="flex-1 truncate text-sm">
                          <div className="font-medium truncate">{selectedBenchmark.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(selectedBenchmark.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => handleRemoveBenchmark(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search benchmarks..."
                            className="pl-8"
                            value={searchQueries[index]}
                            onChange={(e) => {
                              const newQueries = [...searchQueries];
                              newQueries[index] = e.target.value;
                              setSearchQueries(newQueries);
                              setActiveDropdown(index);
                            }}
                            onFocus={() => setActiveDropdown(index)}
                            onBlur={() => {
                              // Delay to allow click on dropdown item
                              setTimeout(() => setActiveDropdown(null), 200);
                            }}
                          />
                        </div>
                        {isActive && filtered.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {filtered.map((b) => (
                              <button
                                key={b.id}
                                className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                                onMouseDown={() => handleSelectBenchmark(index, b.id)}
                              >
                                <div className="font-medium truncate">{b.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(b.createdAt).toLocaleDateString()} • {b.runs.length} variants
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        {isActive && filtered.length === 0 && searchQueries[index] && (
                          <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg p-3 text-sm text-muted-foreground">
                            No benchmarks found
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {/* Add button when less than 4 and all slots are filled */}
            {selectedIds.length > 0 && selectedIds.length < 4 && activeDropdown === null && (
              <div className="flex items-end">
                <Button variant="outline" onClick={handleAddSlot} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Benchmark
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedBenchmarks.length >= 1 && (
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
                  {selectedBenchmarks.map((benchmark, idx) => (
                    <Bar
                      key={benchmark.id}
                      dataKey={`rps${idx}`}
                      name={benchmark.name}
                      fill={BENCHMARK_COLORS[idx]}
                    />
                  ))}
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
                  {selectedBenchmarks.map((benchmark, idx) => (
                    <Bar
                      key={benchmark.id}
                      dataKey={`p95_${idx}`}
                      name={`${benchmark.name} P95`}
                      fill={BENCHMARK_COLORS[idx]}
                    />
                  ))}
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
                      {selectedBenchmarks.map((b, idx) => (
                        <th key={b.id} className="text-right py-2 px-4">
                          <span className="flex items-center justify-end gap-1">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: BENCHMARK_COLORS[idx] }}
                            />
                            RPS ({BENCHMARK_LABELS[idx]})
                          </span>
                        </th>
                      ))}
                      {selectedBenchmarks.length >= 2 && (
                        <th className="text-right py-2 px-4">Δ A→B</th>
                      )}
                      {selectedBenchmarks.map((b, idx) => (
                        <th key={`p95-${b.id}`} className="text-right py-2 px-4">
                          P95 ({BENCHMARK_LABELS[idx]})
                        </th>
                      ))}
                      {selectedBenchmarks.length >= 2 && (
                        <th className="text-right py-2 pl-4">Δ A→B</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonData.map((row) => {
                      const rpsChange = selectedBenchmarks.length >= 2
                        ? calculateChange(row.rps0 as number, row.rps1 as number)
                        : null;
                      const p95Change = selectedBenchmarks.length >= 2
                        ? calculateChange(row.p95_0 as number, row.p95_1 as number)
                        : null;

                      return (
                        <tr key={row.variant as string} className="border-b last:border-0">
                          <td className="py-2 pr-4">
                            <Badge variant="outline">{row.variant}</Badge>
                          </td>
                          {selectedBenchmarks.map((_, idx) => (
                            <td key={`rps-${idx}`} className="text-right py-2 px-4 font-mono">
                              {(row[`rps${idx}`] as number).toFixed(1)}
                            </td>
                          ))}
                          {rpsChange && (
                            <td className="text-right py-2 px-4">
                              <ChangeIndicator change={rpsChange} positiveIsGood={true} />
                            </td>
                          )}
                          {selectedBenchmarks.map((_, idx) => (
                            <td key={`p95-${idx}`} className="text-right py-2 px-4 font-mono">
                              {(row[`p95_${idx}`] as number).toFixed(0)}ms
                            </td>
                          ))}
                          {p95Change && (
                            <td className="text-right py-2 pl-4">
                              <ChangeIndicator change={p95Change} positiveIsGood={false} />
                            </td>
                          )}
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

      {benchmarks.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <GitCompare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No saved benchmarks found.</p>
            <p className="text-sm mt-2">Run benchmarks from the Benchmarks page first.</p>
          </CardContent>
        </Card>
      )}

      {benchmarks.length > 0 && selectedBenchmarks.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Select benchmarks above to compare.</p>
            <p className="text-sm mt-2">You have {benchmarks.length} saved benchmark{benchmarks.length !== 1 ? "s" : ""} available.</p>
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

