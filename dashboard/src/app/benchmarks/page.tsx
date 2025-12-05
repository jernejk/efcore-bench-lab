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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  BarChart3,
  Play,
  Trash2,
  Download,
  Upload,
  Loader2,
  Clock,
  ChartBar,
  Cpu,
  MemoryStick,
  Presentation,
} from "lucide-react";
import { toast } from "sonner";
import {
  benchmarkStore,
  runBenchmark,
  type BenchmarkRun,
  type BenchmarkConfig,
  type EndpointRun,
  type ProgressCallback,
} from "@/lib/benchmark-store";
import { BenchmarkComparisonDialog } from "@/components/benchmark-comparison-dialog";
import { BenchmarkProgressOverlay, type BenchmarkProgress } from "@/components/benchmark-progress-overlay";
import { BenchmarkSlideGenerator } from "@/components/benchmark-slide-generator";

const scenarios = [
  { id: "nplusone", name: "N+1 Problem", variants: ["explicit-loop", "eager-loading", "projection", "projection-notracking"] },
  { id: "pagination", name: "Pagination", variants: ["naive-pagination", "sql-pagination"] },
  { id: "tracking", name: "Tracking", variants: ["tracked", "no-tracking", "projection"] },
  { id: "updates", name: "Updates", variants: ["select-update-save", "execute-update"] },
  { id: "tolist", name: "ToList", variants: ["tolist-before-filter", "filter-before-tolist", "count-in-sql"] },
  { id: "iqueryable-vs-ienumerable", name: "IQueryable vs IEnumerable", variants: ["naive-count", "sql-count"] },
  { id: "asnotracking", name: "AsNoTracking", variants: ["with-tracking", "no-tracking"] },
  { id: "implicit-include", name: "Implicit Include", variants: ["with-include-no-select", "without-include-with-mapping"] },
  { id: "update-demo", name: "Update (DDD Demo)", variants: ["loop-update", "execute-update"] },
  { id: "split-query", name: "SplitQuery", variants: ["cartesian-explosion", "split-query"] },
];

// Detect hardware info properly (including Apple Silicon)
function detectHardware(): { os: string; cpu: string; memory: string } {
  let os = "Unknown OS";
  let cpu = "Unknown CPU";
  let memory = "Unknown";

  // Detect OS
  const ua = navigator.userAgent;
  if (ua.includes("Mac")) {
    os = "macOS";
    // Try to get version
    const macMatch = ua.match(/Mac OS X (\d+[._]\d+)/);
    if (macMatch) {
      os = `macOS ${macMatch[1].replace("_", ".")}`;
    }
  } else if (ua.includes("Windows")) {
    os = "Windows";
    if (ua.includes("Windows NT 10")) os = "Windows 10/11";
  } else if (ua.includes("Linux")) {
    os = "Linux";
  }

  // Detect CPU architecture (Apple Silicon vs Intel)
  // @ts-ignore - navigator.userAgentData is experimental
  const uaData = navigator.userAgentData;
  if (uaData?.platform === "macOS") {
    // Modern detection via User-Agent Client Hints
    // @ts-ignore
    uaData.getHighEntropyValues?.(["architecture", "model"]).then((values: any) => {
      if (values.architecture === "arm") {
        cpu = "Apple Silicon";
      }
    });
  }
  
  // Fallback: Check for Apple Silicon via WebGL renderer
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (gl) {
      const debugInfo = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        if (renderer.includes("Apple M1") || renderer.includes("Apple M2") || renderer.includes("Apple M3") || renderer.includes("Apple M4")) {
          cpu = renderer.includes("M1") ? "Apple M1" : 
                renderer.includes("M2") ? "Apple M2" : 
                renderer.includes("M3") ? "Apple M3" : 
                renderer.includes("M4") ? "Apple M4" : "Apple Silicon";
        } else if (renderer.includes("Apple")) {
          cpu = "Apple Silicon";
        } else if (renderer.includes("Intel")) {
          cpu = "Intel";
        } else if (renderer.includes("AMD")) {
          cpu = "AMD";
        } else if (renderer.includes("NVIDIA")) {
          cpu = "NVIDIA GPU";
        }
      }
    }
  } catch {
    // WebGL not available
  }

  // Detect memory if available
  // @ts-ignore - deviceMemory is experimental
  if (navigator.deviceMemory) {
    // @ts-ignore
    memory = `${navigator.deviceMemory} GB`;
  }

  // Get logical cores
  if (navigator.hardwareConcurrency) {
    cpu += ` (${navigator.hardwareConcurrency} cores)`;
  }

  return { os, cpu, memory };
}

export default function BenchmarksPage() {
  const [benchmarks, setBenchmarks] = useState<BenchmarkRun[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progressState, setProgressState] = useState<BenchmarkProgress | null>(null);
  const [selectedBenchmark, setSelectedBenchmark] = useState<BenchmarkRun | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [slideDialogOpen, setSlideDialogOpen] = useState(false);
  
  const [benchmarkName, setBenchmarkName] = useState("");
  const [selectedScenario, setSelectedScenario] = useState(scenarios[0].id);
  const [selectedVariants, setSelectedVariants] = useState<string[]>([]);
  const [duration, setDuration] = useState("10s");
  const [concurrency, setConcurrency] = useState(5);
  const [warmup, setWarmup] = useState(1);
  const [httpTimeout, setHttpTimeout] = useState(60);

  useEffect(() => {
    loadBenchmarks();
  }, []);

  useEffect(() => {
    const scenario = scenarios.find(s => s.id === selectedScenario);
    if (scenario) {
      setSelectedVariants(scenario.variants);
    }
  }, [selectedScenario]);

  const loadBenchmarks = () => {
    setBenchmarks(benchmarkStore.getAllBenchmarks());
  };

  const runBenchmarks = async () => {
    if (!benchmarkName.trim()) {
      toast.error("Please enter a benchmark name");
      return;
    }

    if (selectedVariants.length === 0) {
      toast.error("Please select at least one variant");
      return;
    }

    setIsRunning(true);
    const runs: EndpointRun[] = [];
    const config: BenchmarkConfig = {
      duration,
      concurrency,
      warmupRequests: warmup,
      httpTimeoutSeconds: httpTimeout,
    };

    const completedVariants: string[] = [];
    const benchmarkStartTime = Date.now();

    try {
      for (let i = 0; i < selectedVariants.length; i++) {
        const variant = selectedVariants[i];
        const pendingVariants = selectedVariants.slice(i + 1);
        
        // Update progress state - start in warmup mode
        setProgressState({
          isRunning: true,
          currentVariant: variant,
          currentVariantIndex: i,
          totalVariants: selectedVariants.length,
          variantStartTime: Date.now(),
          benchmarkStartTime,
          completedVariants: [...completedVariants],
          pendingVariants,
          duration,
          isWarmingUp: true,
        });
        
        const endpoint = `/api/scenarios/${selectedScenario}/${variant}`;
        const results = await runBenchmark(endpoint, config, {
          onWarmupStart: () => {
            setProgressState(prev => prev ? { ...prev, isWarmingUp: true } : null);
          },
          onWarmupEnd: () => {
            setProgressState(prev => prev ? { ...prev, isWarmingUp: false, variantStartTime: Date.now() } : null);
          },
        });
        
        runs.push({
          endpoint,
          variant,
          scenario: selectedScenario,
          config,
          results,
        });
        
        completedVariants.push(variant);
      }

      // Save benchmark with proper hardware detection
      benchmarkStore.saveBenchmark({
        name: benchmarkName,
        hardware: detectHardware(),
        runs,
      });

      toast.success("Benchmark completed and saved!");
      loadBenchmarks();
      setBenchmarkName("");
    } catch (error) {
      toast.error(`Benchmark failed: ${error}`);
    } finally {
      setIsRunning(false);
      setProgressState(null);
    }
  };

  const deleteBenchmark = (id: string) => {
    benchmarkStore.deleteBenchmark(id);
    loadBenchmarks();
    toast.success("Benchmark deleted");
  };

  const exportBenchmark = (id: string) => {
    const json = benchmarkStore.exportBenchmark(id);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `benchmark-${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBenchmark = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();
        try {
          benchmarkStore.importBenchmark(text);
          loadBenchmarks();
          toast.success("Benchmark imported");
        } catch {
          toast.error("Invalid benchmark file");
        }
      }
    };
    input.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            Benchmarks
          </h1>
          <p className="text-muted-foreground mt-2">
            Run and compare performance benchmarks across scenarios
          </p>
        </div>
        <Button variant="outline" onClick={importBenchmark}>
          <Upload className="mr-2 h-4 w-4" />
          Import
        </Button>
      </div>

      {/* Run New Benchmark */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run New Benchmark</CardTitle>
          <CardDescription>
            Configure and run a performance benchmark
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Benchmark Name</Label>
              <Input
                value={benchmarkName}
                onChange={(e) => setBenchmarkName(e.target.value)}
                placeholder="e.g., N+1 Comparison - Dec 3"
              />
            </div>
            <div className="space-y-2">
              <Label>Scenario</Label>
              <Select value={selectedScenario} onValueChange={setSelectedScenario}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scenarios.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5s">5 seconds</SelectItem>
                  <SelectItem value="10s">10 seconds</SelectItem>
                  <SelectItem value="30s">30 seconds</SelectItem>
                  <SelectItem value="1m">1 minute</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Concurrency</Label>
              <Select value={String(concurrency)} onValueChange={(v) => setConcurrency(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 (Sequential)</SelectItem>
                  <SelectItem value="5">5 concurrent</SelectItem>
                  <SelectItem value="10">10 concurrent</SelectItem>
                  <SelectItem value="20">20 concurrent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>HTTP Timeout (seconds)</Label>
              <Input
                type="number"
                min={1}
                max={300}
                value={httpTimeout}
                onChange={(e) => setHttpTimeout(Math.max(1, Math.min(300, parseInt(e.target.value) || 60)))}
                placeholder="60"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Will benchmark {selectedVariants.length} variants: {selectedVariants.join(", ")}
            </div>
            <Button onClick={runBenchmarks} disabled={isRunning}>
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Benchmark
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Saved Benchmarks */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Saved Benchmarks</h2>
        
        {benchmarks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No benchmarks saved yet. Run a benchmark to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {benchmarks.map((benchmark) => (
              <Card key={benchmark.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{benchmark.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Clock className="h-3 w-3" />
                        {new Date(benchmark.createdAt).toLocaleString()}
                        <span className="mx-2">•</span>
                        {benchmark.runs.length} runs
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => {
                          setSelectedBenchmark(benchmark);
                          setDialogOpen(true);
                        }}
                      >
                        <ChartBar className="h-4 w-4 mr-1" />
                        Charts
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedBenchmark(benchmark);
                          setSlideDialogOpen(true);
                        }}
                      >
                        <Presentation className="h-4 w-4 mr-1" />
                        Slide
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportBenchmark(benchmark.id)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteBenchmark(benchmark.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4">Variant</th>
                          <th className="text-right py-2 px-2">Req/sec</th>
                          <th className="text-right py-2 px-2">P50</th>
                          <th className="text-right py-2 px-2">P95</th>
                          <th className="text-right py-2 px-2">
                            <span className="flex items-center justify-end gap-1">
                              <Cpu className="h-3 w-3" /> CPU
                            </span>
                          </th>
                          <th className="text-right py-2 px-2">
                            <span className="flex items-center justify-end gap-1">
                              <MemoryStick className="h-3 w-3" /> Mem
                            </span>
                          </th>
                          <th className="text-right py-2 pl-2">Errors</th>
                        </tr>
                      </thead>
                      <tbody>
                        {benchmark.runs.map((run, idx) => (
                          <tr key={idx} className="border-b last:border-0">
                            <td className="py-2 pr-4">
                              <Badge variant="outline">{run.variant}</Badge>
                            </td>
                            <td className="text-right py-2 px-2 font-mono">
                              {run.results.requestsPerSecond.toFixed(1)}
                            </td>
                            <td className="text-right py-2 px-2 font-mono">
                              {run.results.latencyP50.toFixed(0)}ms
                            </td>
                            <td className="text-right py-2 px-2 font-mono">
                              {run.results.latencyP95.toFixed(0)}ms
                            </td>
                            <td className="text-right py-2 px-2 font-mono text-muted-foreground">
                              {run.results.avgCpuPercent?.toFixed(1) ?? "-"}%
                            </td>
                            <td className="text-right py-2 px-2 font-mono text-muted-foreground">
                              {run.results.avgMemoryMB?.toFixed(0) ?? "-"} MB
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
                </CardContent>
              </Card>
            ))}
          </div>

        )}
      </div>

      {/* Comparison Dialog */}
      <BenchmarkComparisonDialog
        benchmark={selectedBenchmark}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      {/* Slide Generator Dialog */}
      <BenchmarkSlideGenerator
        benchmark={selectedBenchmark}
        open={slideDialogOpen}
        onOpenChange={setSlideDialogOpen}
      />

      {/* Progress Overlay */}
      <BenchmarkProgressOverlay progress={progressState} />
    </div>
  );
}

