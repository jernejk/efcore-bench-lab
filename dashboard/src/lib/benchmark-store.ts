import { v4 as uuidv4 } from "uuid";

export interface BenchmarkRun {
  id: string;
  createdAt: string;
  name: string;
  hardware: HardwareInfo;
  runs: EndpointRun[];
  aiAnalysis?: string;
}

export interface HardwareInfo {
  os: string;
  cpu: string;
  memory: string;
  dotnetVersion?: string;
}

export interface EndpointRun {
  endpoint: string;
  variant: string;
  scenario: string;
  config: BenchmarkConfig;
  results: BenchmarkResults;
  sampleQuery?: string;
  metrics?: TimeSeriesMetrics;
}

export interface BenchmarkConfig {
  duration: string;
  concurrency: number;
  warmupRequests: number;
  httpTimeoutSeconds: number;
}

export interface BenchmarkResults {
  totalRequests: number;
  requestsPerSecond: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  errors: number;
  durationMs: number;
  avgCpuPercent?: number;
  avgMemoryMB?: number;
  peakMemoryMB?: number;
}

export interface TimeSeriesMetrics {
  timestamps: number[];
  rps: number[];
  latency: number[];
  cpu?: number[];
  memory?: number[];
}

// Store benchmarks in localStorage (client-side)
// In a production app, this would use SQLite via API routes
class BenchmarkStore {
  private readonly STORAGE_KEY = "efcore-perf-benchmarks";

  getAllBenchmarks(): BenchmarkRun[] {
    if (typeof window === "undefined") return [];
    
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (!data) return [];
    
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  getBenchmark(id: string): BenchmarkRun | null {
    const benchmarks = this.getAllBenchmarks();
    return benchmarks.find((b) => b.id === id) || null;
  }

  saveBenchmark(benchmark: Omit<BenchmarkRun, "id" | "createdAt">): BenchmarkRun {
    const newBenchmark: BenchmarkRun = {
      ...benchmark,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
    };

    const benchmarks = this.getAllBenchmarks();
    benchmarks.unshift(newBenchmark);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(benchmarks));

    return newBenchmark;
  }

  deleteBenchmark(id: string): void {
    const benchmarks = this.getAllBenchmarks();
    const filtered = benchmarks.filter((b) => b.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
  }

  exportBenchmark(id: string): string {
    const benchmark = this.getBenchmark(id);
    if (!benchmark) throw new Error("Benchmark not found");
    return JSON.stringify(benchmark, null, 2);
  }

  importBenchmark(json: string): BenchmarkRun {
    const benchmark = JSON.parse(json) as BenchmarkRun;
    benchmark.id = uuidv4(); // Generate new ID
    
    const benchmarks = this.getAllBenchmarks();
    benchmarks.unshift(benchmark);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(benchmarks));

    return benchmark;
  }

  clearAll(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}

export const benchmarkStore = new BenchmarkStore();

export interface ProgressCallback {
  onWarmupStart?: () => void;
  onWarmupEnd?: () => void;
}

// Utility functions
export async function runBenchmark(
  endpoint: string,
  config: BenchmarkConfig,
  progressCallback?: ProgressCallback
): Promise<BenchmarkResults> {
  let successCount = 0;
  let errorCount = 0;
  const latencies: number[] = [];
  const cpuSamples: number[] = [];
  const memorySamples: number[] = [];

  const timeoutMs = (config.httpTimeoutSeconds ?? 60) * 1000;

  // Warmup (before timing starts)
  progressCallback?.onWarmupStart?.();
  for (let i = 0; i < config.warmupRequests; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      await fetch(`http://localhost:5847${endpoint}`, { signal: controller.signal });
      clearTimeout(timeoutId);
    } catch {
      // Ignore warmup errors
    }
  }
  progressCallback?.onWarmupEnd?.();

  // Start timing AFTER warmup completes
  const startTime = Date.now();
  
  // Parse duration (e.g., "10s" -> 10000ms)
  const durationMs = parseDuration(config.duration);
  const endTime = startTime + durationMs;

  // Start metrics collection in background
  const metricsInterval = setInterval(async () => {
    try {
      const response = await fetch("http://localhost:5847/api/metrics");
      if (response.ok) {
        const data = await response.json();
        cpuSamples.push(data.cpu.usagePercent);
        memorySamples.push(data.memory.workingSetMB);
      }
    } catch {
      // Ignore metrics collection errors
    }
  }, 500); // Sample every 500ms

  // Create concurrent workers
  const workers = Array(config.concurrency)
    .fill(null)
    .map(async () => {
      while (Date.now() < endTime) {
        const reqStart = Date.now();
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
          const response = await fetch(`http://localhost:5847${endpoint}`, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (response.ok) {
            successCount++;
            latencies.push(Date.now() - reqStart);
          } else {
            errorCount++;
          }
        } catch {
          errorCount++;
        }
      }
    });

  await Promise.all(workers);
  clearInterval(metricsInterval);

  const totalDuration = Date.now() - startTime;
  latencies.sort((a, b) => a - b);

  return {
    totalRequests: successCount + errorCount,
    requestsPerSecond: successCount / (totalDuration / 1000),
    latencyP50: percentile(latencies, 50),
    latencyP95: percentile(latencies, 95),
    latencyP99: percentile(latencies, 99),
    errors: errorCount,
    durationMs: totalDuration,
    avgCpuPercent: cpuSamples.length > 0 ? average(cpuSamples) : undefined,
    avgMemoryMB: memorySamples.length > 0 ? average(memorySamples) : undefined,
    peakMemoryMB: memorySamples.length > 0 ? Math.max(...memorySamples) : undefined,
  };
}

function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h)?$/);
  if (!match) return 10000; // Default 10 seconds
  
  const value = parseInt(match[1]);
  const unit = match[2] || "s";
  
  switch (unit) {
    case "s": return value * 1000;
    case "m": return value * 60 * 1000;
    case "h": return value * 60 * 60 * 1000;
    default: return value * 1000;
  }
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const index = Math.ceil((p / 100) * arr.length) - 1;
  return arr[Math.max(0, index)];
}

