"use client";

import { useRef, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Download, Check, Presentation, Palette } from "lucide-react";
import { toast } from "sonner";
import * as htmlToImage from "html-to-image";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import type { BenchmarkRun } from "@/lib/benchmark-store";
import {
  type SlideTheme,
  SLIDE_THEMES,
  RESOURCE_CHART_COLORS,
  getSavedTheme,
  saveTheme,
  getTheme,
  getThemeBackgroundColor,
  getThemeBackgroundStyles,
} from "@/lib/slide-themes";

interface BenchmarkSlideGeneratorProps {
  benchmark: BenchmarkRun | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Fixed slide dimensions (FHD)
const SLIDE_WIDTH = 1920;
const SLIDE_HEIGHT = 1080;

export function BenchmarkSlideGenerator({
  benchmark,
  open,
  onOpenChange,
}: BenchmarkSlideGeneratorProps) {
  const slideRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [scale, setScale] = useState(1);
  const [themeId, setThemeId] = useState<string>("dark");
  const theme = getTheme(themeId);

  // Load saved theme on mount
  useEffect(() => {
    setThemeId(getSavedTheme());
  }, []);

  // Save theme when changed
  const handleThemeChange = (newThemeId: string) => {
    setThemeId(newThemeId);
    saveTheme(newThemeId);
  };

  // Viewbox-like scaling: calculate scale to fit container (both width AND height)
  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight;
        
        // Calculate scale to fit both dimensions (like XAML Viewbox Uniform)
        const scaleX = (containerWidth - 32) / SLIDE_WIDTH;
        const scaleY = (containerHeight - 32) / SLIDE_HEIGHT;
        const newScale = Math.min(scaleX, scaleY, 1); // Don't scale above 100%
        
        setScale(Math.max(newScale, 0.1)); // Minimum 10% scale
      }
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    
    // Recalculate when dialog opens (multiple times to handle layout settling)
    if (open) {
      setTimeout(updateScale, 50);
      setTimeout(updateScale, 150);
      setTimeout(updateScale, 300);
    }
    
    return () => window.removeEventListener("resize", updateScale);
  }, [open]);

  if (!benchmark) return null;

  // Check if this is a dashboard stats benchmark
  const isDashboardStats = benchmark.id === "dashboard-stats";

  const copyToClipboard = async () => {
    if (!slideRef.current) return;
    
    try {
      // Use theme's explicit background color for export
      const bgColor = getThemeBackgroundColor(theme);
      
      // Capture at full resolution
      const dataUrl = await htmlToImage.toPng(slideRef.current, {
        quality: 1,
        pixelRatio: 1,
        backgroundColor: bgColor,
        width: SLIDE_WIDTH,
        height: SLIDE_HEIGHT,
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
        },
        // Include background images
        includeQueryParams: true,
        cacheBust: true,
      });
      
      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      // Check if Clipboard API with ClipboardItem is available
      if (typeof ClipboardItem === "undefined") {
        // ClipboardItem not supported - download instead
        downloadImageFromDataUrl(dataUrl);
        toast.success("Image downloaded (clipboard not supported in this browser)");
        return;
      }

      // Try to write to clipboard
      try {
        const clipboardItem = new ClipboardItem({ "image/png": blob });
        await navigator.clipboard.write([clipboardItem]);
        setCopied(true);
        toast.success("Slide copied to clipboard (1920×1080)!");
        setTimeout(() => setCopied(false), 2000);
      } catch (clipErr) {
        console.warn("Clipboard write failed:", clipErr);
        // Safari and some browsers need the blob in a specific way
        // Try with a fresh blob from canvas
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = dataUrl;
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
        });
        
        const canvas = document.createElement("canvas");
        canvas.width = SLIDE_WIDTH;
        canvas.height = SLIDE_HEIGHT;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not get canvas context");
        ctx.drawImage(img, 0, 0);
        
        const canvasBlob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, "image/png");
        });
        
        if (canvasBlob) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ "image/png": canvasBlob }),
            ]);
            setCopied(true);
            toast.success("Slide copied to clipboard (1920×1080)!");
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Final fallback: download
            downloadImageFromDataUrl(dataUrl);
            toast.success("Image downloaded (clipboard blocked by browser)");
          }
        } else {
          downloadImageFromDataUrl(dataUrl);
          toast.success("Image downloaded (clipboard blocked by browser)");
        }
      }
    } catch (err) {
      console.error("Copy failed:", err);
      toast.error("Failed to generate image");
    }
  };
  
  const downloadImageFromDataUrl = (dataUrl: string) => {
    const link = document.createElement("a");
    link.download = `${benchmark!.name.replace(/\s+/g, "-")}-${activeTab}-1920x1080.png`;
    link.href = dataUrl;
    link.click();
  };

  const downloadImage = async () => {
    if (!slideRef.current) return;
    
    try {
      // Use theme's explicit background color for export
      const bgColor = getThemeBackgroundColor(theme);
      
      // Capture at full resolution
      const dataUrl = await htmlToImage.toPng(slideRef.current, {
        quality: 1,
        pixelRatio: 1,
        backgroundColor: bgColor,
        width: SLIDE_WIDTH,
        height: SLIDE_HEIGHT,
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
        },
        includeQueryParams: true,
        cacheBust: true,
      });
      
      const link = document.createElement("a");
      link.download = `${benchmark.name.replace(/\s+/g, "-")}-${activeTab}-1920x1080.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Slide downloaded (1920×1080)!");
    } catch (err) {
      toast.error("Failed to download image.");
    }
  };

  // Prepare data
  const sortedByRps = [...benchmark.runs].sort(
    (a, b) => b.results.requestsPerSecond - a.results.requestsPerSecond
  );
  const bestRps = sortedByRps[0];
  const worstRps = sortedByRps[sortedByRps.length - 1];
  const rpsImprovement = ((bestRps.results.requestsPerSecond / worstRps.results.requestsPerSecond - 1) * 100).toFixed(0);

  const sortedByLatency = [...benchmark.runs].sort(
    (a, b) => a.results.latencyP95 - b.results.latencyP95
  );
  const bestLatency = sortedByLatency[0];
  const worstLatency = sortedByLatency[sortedByLatency.length - 1];

  const sortedByMemory = [...benchmark.runs]
    .filter((r) => r.results.avgMemoryMB)
    .sort((a, b) => (a.results.avgMemoryMB || 0) - (b.results.avgMemoryMB || 0));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-none w-[98vw] h-[95vh] overflow-hidden flex flex-col"
        style={{ maxWidth: "98vw" }}
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Presentation className="h-5 w-5" />
            Generate Presentation Slide
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between gap-4 flex-wrap flex-shrink-0">
            <TabsList className={`grid w-auto ${isDashboardStats ? 'grid-cols-1' : 'grid-cols-5'}`}>
              {isDashboardStats ? (
                <TabsTrigger value="overview">System Overview</TabsTrigger>
              ) : (
                <>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="throughput">Throughput</TabsTrigger>
                  <TabsTrigger value="latency">Latency</TabsTrigger>
                  <TabsTrigger value="resources">Resources</TabsTrigger>
                  <TabsTrigger value="comparison">Comparison</TabsTrigger>
                </>
              )}
            </TabsList>

            {/* Theme selector and action buttons */}
            <div className="flex gap-2 items-center">
              <div className="flex items-center gap-2 mr-4">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <Select value={themeId} onValueChange={handleThemeChange}>
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(SLIDE_THEMES).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-xs text-muted-foreground mr-2">
                1920×1080 • {Math.round(scale * 100)}%
              </span>
              <Button onClick={copyToClipboard}>
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy to Clipboard
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={downloadImage}>
                <Download className="mr-2 h-4 w-4" />
                Download PNG
              </Button>
            </div>
          </div>

          {/* Viewbox Container - scales content to fit like XAML Viewbox */}
          <div 
            ref={containerRef}
            className="mt-4 flex-1 border rounded-lg overflow-hidden bg-slate-950 flex items-center justify-center min-h-0"
          >
            {/* Fixed-size slide that scales proportionally to fit container */}
            <div
              style={{
                width: SLIDE_WIDTH,
                height: SLIDE_HEIGHT,
                transform: `scale(${scale})`,
                transformOrigin: "center center",
                flexShrink: 0,
              }}
            >
              <div ref={slideRef} style={{ width: SLIDE_WIDTH, height: SLIDE_HEIGHT }}>
                <TabsContent value="overview" className="m-0 h-full" forceMount style={{ display: activeTab === "overview" ? "block" : "none" }}>
                  {isDashboardStats ? (
                    <DashboardStatsSlide benchmark={benchmark} theme={theme} />
                  ) : (
                    <OverviewSlide benchmark={benchmark} bestRps={bestRps} worstRps={worstRps} rpsImprovement={rpsImprovement} theme={theme} />
                  )}
                </TabsContent>

                <TabsContent value="throughput" className="m-0 h-full" forceMount style={{ display: activeTab === "throughput" ? "block" : "none" }}>
                  <ThroughputSlide benchmark={benchmark} sortedByRps={sortedByRps} theme={theme} />
                </TabsContent>

                <TabsContent value="latency" className="m-0 h-full" forceMount style={{ display: activeTab === "latency" ? "block" : "none" }}>
                  <LatencySlide benchmark={benchmark} bestLatency={bestLatency} worstLatency={worstLatency} theme={theme} />
                </TabsContent>

                <TabsContent value="resources" className="m-0 h-full" forceMount style={{ display: activeTab === "resources" ? "block" : "none" }}>
                  <ResourcesSlide benchmark={benchmark} sortedByMemory={sortedByMemory} theme={theme} />
                </TabsContent>

                <TabsContent value="comparison" className="m-0 h-full" forceMount style={{ display: activeTab === "comparison" ? "block" : "none" }}>
                  <ComparisonSlide benchmark={benchmark} theme={theme} />
                </TabsContent>
              </div>
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// === SLIDE COMPONENTS ===

function SlideContainer({ children, title, subtitle, theme }: { children: React.ReactNode; title: string; subtitle?: string; theme: SlideTheme }) {
  // Use utility function to get correct background styles
  const backgroundStyle = getThemeBackgroundStyles(theme);

  return (
    <div 
      style={{ 
        width: SLIDE_WIDTH, 
        height: SLIDE_HEIGHT, 
        padding: "40px 56px",
        display: "flex",
        flexDirection: "column",
        ...backgroundStyle,
        color: theme.text.primary,
      }}
    >
      <div style={{ marginBottom: 24, flexShrink: 0 }}>
        <h1 style={{ fontSize: 52, fontWeight: 700, color: theme.text.primary, margin: 0, lineHeight: 1.1 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 26, color: theme.text.muted, marginTop: 8 }}>{subtitle}</p>}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>{children}</div>
      <div style={{ fontSize: 18, color: theme.footer.text, marginTop: 16, display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
        <span>EF Core Performance Lab</span>
        <span>{new Date().toLocaleDateString()}</span>
      </div>
    </div>
  );
}

function MetricBox({ label, value, subValue, color = "blue", theme }: { label: string; value: string; subValue?: string; color?: string; theme: SlideTheme }) {
  // Get color from theme or use accent colors
  const getColorValues = () => {
    switch (color) {
      case "green": return theme.accent.success;
      case "yellow": return theme.accent.warning;
      case "red": return theme.accent.error;
      case "purple": return theme.accent.purple;
      default: return theme.accent.primary;
    }
  };
  
  const accentColor = getColorValues();
  
  return (
    <div style={{
      background: theme.card.background,
      border: `2px solid ${accentColor}40`,
      borderRadius: 16,
      padding: 24,
      textAlign: "center",
    }}>
      <div style={{ color: theme.text.muted, fontSize: 18, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: theme.text.primary }}>{value}</div>
      {subValue && <div style={{ fontSize: 14, color: theme.text.muted, marginTop: 8 }}>{subValue}</div>}
    </div>
  );
}

function OverviewSlide({ benchmark, bestRps, worstRps, rpsImprovement, theme }: { 
  benchmark: BenchmarkRun; 
  bestRps: BenchmarkRun["runs"][0]; 
  worstRps: BenchmarkRun["runs"][0];
  rpsImprovement: string;
  theme: SlideTheme;
}) {
  return (
    <SlideContainer title={benchmark.name} subtitle={`Performance comparison across ${benchmark.runs.length} variants`} theme={theme}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 24 }}>
        <MetricBox label="Best Throughput" value={`${bestRps.results.requestsPerSecond.toFixed(1)} req/s`} subValue={bestRps.variant} color="green" theme={theme} />
        <MetricBox label="Best Latency (P95)" value={`${Math.min(...benchmark.runs.map(r => r.results.latencyP95)).toFixed(0)}ms`} color="blue" theme={theme} />
        <MetricBox label="Performance Gain" value={`${rpsImprovement}%`} subValue="best vs worst" color="purple" theme={theme} />
        <MetricBox label="Variants Tested" value={String(benchmark.runs.length)} color="yellow" theme={theme} />
      </div>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 24 }}>
        <div style={{ background: theme.card.background, borderRadius: 16, padding: 28, display: "flex", flexDirection: "column" }}>
          <h3 style={{ fontSize: 28, fontWeight: 600, marginBottom: 24, color: theme.text.secondary }}>Key Findings</h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 20 }}>
            <li style={{ display: "flex", alignItems: "flex-start", gap: 16, fontSize: 24, lineHeight: 1.4, color: theme.text.primary }}>
              <span style={{ color: theme.accent.success, fontSize: 28 }}>✓</span>
              <span><strong style={{ color: theme.accent.success }}>{bestRps.variant}</strong> delivers the highest throughput</span>
            </li>
            <li style={{ display: "flex", alignItems: "flex-start", gap: 16, fontSize: 24, lineHeight: 1.4, color: theme.text.primary }}>
              <span style={{ color: theme.accent.error, fontSize: 28 }}>✗</span>
              <span><strong style={{ color: theme.accent.error }}>{worstRps.variant}</strong> is {rpsImprovement}% slower</span>
            </li>
            {benchmark.runs.some(r => r.results.avgMemoryMB) && (
              <li style={{ display: "flex", alignItems: "flex-start", gap: 16, fontSize: 24, lineHeight: 1.4, color: theme.text.primary }}>
                <span style={{ color: theme.accent.primary, fontSize: 28 }}>ℹ</span>
                <span>Memory usage varies between variants</span>
              </li>
            )}
          </ul>
        </div>

        <div style={{ background: theme.card.background, borderRadius: 16, padding: 28 }}>
          <h3 style={{ fontSize: 28, fontWeight: 600, marginBottom: 16, color: theme.text.secondary }}>Throughput Comparison</h3>
          <div style={{ height: "calc(100% - 50px)" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={benchmark.runs.map(r => ({ name: r.variant, rps: Math.round(r.results.requestsPerSecond * 10) / 10 }))} layout="vertical" margin={{ right: 80 }}>
                <XAxis type="number" tick={{ fill: theme.text.muted, fontSize: 18 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: theme.text.secondary, fontSize: 18 }} width={200} />
                <Bar dataKey="rps" radius={[0, 8, 8, 0]} label={{ position: "right", fill: theme.text.secondary, fontSize: 18 }}>
                  {benchmark.runs.map((_, idx) => (
                    <Cell key={idx} fill={theme.chart.colors[idx % theme.chart.colors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </SlideContainer>
  );
}

function ThroughputSlide({ benchmark, sortedByRps, theme }: { benchmark: BenchmarkRun; sortedByRps: BenchmarkRun["runs"]; theme: SlideTheme }) {
  const data = sortedByRps.map((r, i) => ({
    name: r.variant,
    rps: Math.round(r.results.requestsPerSecond * 10) / 10,
    fill: theme.chart.colors[i % theme.chart.colors.length],
  }));

  const best = sortedByRps[0];
  const worst = sortedByRps[sortedByRps.length - 1];
  const improvement = ((best.results.requestsPerSecond / worst.results.requestsPerSecond) - 1) * 100;

  return (
    <SlideContainer title="Throughput Analysis" subtitle="Requests per second - Higher is better" theme={theme}>
      <div style={{ flex: 1, display: "flex", gap: 28 }}>
        <div style={{ flex: 1, background: theme.card.background, borderRadius: 16, padding: 28 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 20, right: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.chart.grid} />
              <XAxis type="number" tick={{ fill: theme.text.muted, fontSize: 20 }} />
              <YAxis dataKey="name" type="category" tick={{ fill: theme.text.secondary, fontSize: 20 }} width={220} />
              <Bar dataKey="rps" radius={[0, 10, 10, 0]} label={{ position: "right", fill: theme.text.secondary, fontSize: 20, fontWeight: 600 }}>
                {data.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ width: 400, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ flex: 1, background: `${theme.accent.success}20`, border: `2px solid ${theme.accent.success}60`, borderRadius: 16, padding: 28, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ color: theme.accent.success, fontSize: 22, fontWeight: 600 }}>🏆 Best Performance</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: theme.text.primary, marginTop: 12 }}>{best.variant}</div>
            <div style={{ color: theme.accent.success, fontSize: 28, marginTop: 8 }}>{best.results.requestsPerSecond.toFixed(1)} req/s</div>
          </div>

          <div style={{ flex: 1, background: `${theme.accent.error}20`, border: `2px solid ${theme.accent.error}60`, borderRadius: 16, padding: 28, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ color: theme.accent.error, fontSize: 22, fontWeight: 600 }}>⚠ Slowest</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: theme.text.primary, marginTop: 12 }}>{worst.variant}</div>
            <div style={{ color: theme.accent.error, fontSize: 24, marginTop: 8 }}>{worst.results.requestsPerSecond.toFixed(1)} req/s</div>
          </div>

          <div style={{ flex: 1, background: `${theme.accent.purple}20`, border: `2px solid ${theme.accent.purple}60`, borderRadius: 16, padding: 28, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
            <div style={{ color: theme.accent.purple, fontSize: 22, fontWeight: 600 }}>📈 Improvement</div>
            <div style={{ fontSize: 64, fontWeight: 700, color: theme.text.primary, marginTop: 8 }}>{improvement.toFixed(0)}%</div>
            <div style={{ color: theme.accent.purple, fontSize: 18 }}>faster with best approach</div>
          </div>
        </div>
      </div>
    </SlideContainer>
  );
}

function LatencySlide({ benchmark, bestLatency, worstLatency, theme }: { 
  benchmark: BenchmarkRun; 
  bestLatency: BenchmarkRun["runs"][0];
  worstLatency: BenchmarkRun["runs"][0];
  theme: SlideTheme;
}) {
  const data = benchmark.runs.map((r) => ({
    name: r.variant,
    P50: Math.round(r.results.latencyP50),
    P95: Math.round(r.results.latencyP95),
    P99: Math.round(r.results.latencyP99),
  }));

  const latencyMultiplier = (worstLatency.results.latencyP95 / bestLatency.results.latencyP95).toFixed(1);

  // Latency chart colors - use theme colors but consistent for P50/P95/P99
  const latencyColors = {
    P50: theme.accent.success,
    P95: theme.accent.warning,
    P99: theme.accent.error,
  };

  return (
    <SlideContainer title="Latency Analysis" subtitle="Response time in milliseconds - Lower is better" theme={theme}>
      <div style={{ flex: 1, display: "flex", gap: 28 }}>
        <div style={{ flex: 1, background: theme.card.background, borderRadius: 16, padding: 28 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: 20, right: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.chart.grid} />
              <XAxis dataKey="name" tick={{ fill: theme.text.secondary, fontSize: 18 }} />
              <YAxis tick={{ fill: theme.text.muted, fontSize: 18 }} unit="ms" />
              <Legend wrapperStyle={{ color: theme.text.secondary, fontSize: 18, paddingTop: 10 }} />
              <Bar dataKey="P50" name="Median (P50)" fill={latencyColors.P50} radius={[8, 8, 0, 0]} />
              <Bar dataKey="P95" name="P95" fill={latencyColors.P95} radius={[8, 8, 0, 0]} />
              <Bar dataKey="P99" name="P99" fill={latencyColors.P99} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ width: 400, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ flex: 1, background: `${theme.accent.success}20`, border: `2px solid ${theme.accent.success}60`, borderRadius: 16, padding: 28, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ color: theme.accent.success, fontSize: 22, fontWeight: 600 }}>⚡ Fastest Response</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: theme.text.primary, marginTop: 12 }}>{bestLatency.variant}</div>
            <div style={{ color: theme.accent.success, fontSize: 24, marginTop: 8 }}>P95: {bestLatency.results.latencyP95.toFixed(0)}ms</div>
          </div>

          <div style={{ flex: 1, background: `${theme.accent.error}20`, border: `2px solid ${theme.accent.error}60`, borderRadius: 16, padding: 28, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ color: theme.accent.error, fontSize: 22, fontWeight: 600 }}>🐌 Slowest Response</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: theme.text.primary, marginTop: 12 }}>{worstLatency.variant}</div>
            <div style={{ color: theme.accent.error, fontSize: 24, marginTop: 8 }}>P95: {worstLatency.results.latencyP95.toFixed(0)}ms</div>
          </div>

          <div style={{ flex: 1, background: theme.card.background, borderRadius: 16, padding: 28, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ color: theme.text.secondary, fontSize: 22, fontWeight: 600 }}>💡 Impact</div>
            <div style={{ fontSize: 48, fontWeight: 700, color: theme.accent.warning, marginTop: 8 }}>{latencyMultiplier}x</div>
            <p style={{ fontSize: 18, color: theme.text.muted, marginTop: 8 }}>
              slower with worst approach
            </p>
          </div>
        </div>
      </div>
    </SlideContainer>
  );
}

function ResourcesSlide({ benchmark, sortedByMemory, theme }: { benchmark: BenchmarkRun; sortedByMemory: BenchmarkRun["runs"]; theme: SlideTheme }) {
  const hasResourceData = benchmark.runs.some(r => r.results.avgMemoryMB);
  const resourceColors = RESOURCE_CHART_COLORS[theme.id] || RESOURCE_CHART_COLORS.dark;
  
  if (!hasResourceData) {
    return (
      <SlideContainer title="Resource Utilization" subtitle="CPU and Memory consumption during benchmarks" theme={theme}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", color: theme.text.muted }}>
            <div style={{ fontSize: 120, marginBottom: 32 }}>📊</div>
            <div style={{ fontSize: 36, fontWeight: 600, color: theme.text.secondary }}>No resource data available</div>
            <div style={{ fontSize: 24, marginTop: 16 }}>Run a new benchmark to capture CPU and memory metrics</div>
          </div>
        </div>
      </SlideContainer>
    );
  }

  const memoryData = benchmark.runs.map((r) => ({
    name: r.variant,
    memory: Math.round(r.results.avgMemoryMB || 0),
    peak: Math.round(r.results.peakMemoryMB || 0),
    cpu: Math.round((r.results.avgCpuPercent || 0) * 10) / 10,
  }));

  const lowestMemory = sortedByMemory[0];
  const highestMemory = sortedByMemory[sortedByMemory.length - 1];
  const memorySavings = highestMemory.results.avgMemoryMB && lowestMemory.results.avgMemoryMB
    ? ((1 - lowestMemory.results.avgMemoryMB / highestMemory.results.avgMemoryMB) * 100).toFixed(0)
    : "0";

  return (
    <SlideContainer title="Resource Utilization" subtitle="CPU and Memory consumption - Lower is better" theme={theme}>
      <div style={{ flex: 1, display: "flex", gap: 28 }}>
        <div style={{ flex: 1, background: theme.card.background, borderRadius: 16, padding: 28 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={memoryData} margin={{ left: 20, right: 50, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.chart.grid} />
              <XAxis dataKey="name" tick={{ fill: theme.text.secondary, fontSize: 18 }} />
              <YAxis yAxisId="left" tick={{ fill: theme.text.muted, fontSize: 18 }} unit=" MB" />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: theme.text.muted, fontSize: 18 }} unit="%" />
              <Legend wrapperStyle={{ color: theme.text.secondary, fontSize: 18, paddingTop: 10 }} />
              <Bar yAxisId="right" dataKey="cpu" name="Avg CPU (%)" fill={resourceColors.cpu} radius={[8, 8, 0, 0]} />
              <Bar yAxisId="left" dataKey="memory" name="Avg Memory (MB)" fill={resourceColors.memory} radius={[8, 8, 0, 0]} />
              <Bar yAxisId="left" dataKey="peak" name="Peak Memory (MB)" fill={resourceColors.peak} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ width: 400, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ flex: 1, background: `${theme.accent.success}20`, border: `2px solid ${theme.accent.success}60`, borderRadius: 16, padding: 28, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ color: theme.accent.success, fontSize: 22, fontWeight: 600 }}>💚 Most Efficient</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: theme.text.primary, marginTop: 12 }}>{lowestMemory.variant}</div>
            <div style={{ color: theme.accent.success, fontSize: 24, marginTop: 8 }}>{lowestMemory.results.avgMemoryMB?.toFixed(0)} MB avg</div>
          </div>

          <div style={{ flex: 1, background: `${theme.accent.error}20`, border: `2px solid ${theme.accent.error}60`, borderRadius: 16, padding: 28, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ color: theme.accent.error, fontSize: 22, fontWeight: 600 }}>🔴 Highest Usage</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: theme.text.primary, marginTop: 12 }}>{highestMemory.variant}</div>
            <div style={{ color: theme.accent.error, fontSize: 24, marginTop: 8 }}>{highestMemory.results.avgMemoryMB?.toFixed(0)} MB avg</div>
          </div>

          <div style={{ flex: 1, background: `${theme.accent.purple}20`, border: `2px solid ${theme.accent.purple}60`, borderRadius: 16, padding: 28, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
            <div style={{ color: theme.accent.purple, fontSize: 22, fontWeight: 600 }}>📉 Memory Savings</div>
            <div style={{ fontSize: 64, fontWeight: 700, color: theme.text.primary, marginTop: 8 }}>{memorySavings}%</div>
            <div style={{ color: theme.accent.purple, fontSize: 18 }}>less memory with best approach</div>
          </div>
        </div>
      </div>
    </SlideContainer>
  );
}

function ComparisonSlide({ benchmark, theme }: { benchmark: BenchmarkRun; theme: SlideTheme }) {
  // Create relative scores (0-100) for each metric
  const maxRps = Math.max(...benchmark.runs.map(r => r.results.requestsPerSecond));
  const maxLatency = Math.max(...benchmark.runs.map(r => r.results.latencyP95));
  const maxMemory = Math.max(...benchmark.runs.map(r => r.results.peakMemoryMB || 1));

  const scores = benchmark.runs.map(r => ({
    variant: r.variant,
    throughputScore: Math.round((r.results.requestsPerSecond / maxRps) * 100),
    latencyScore: Math.round((1 - r.results.latencyP95 / maxLatency) * 100),
    memoryScore: r.results.peakMemoryMB 
      ? Math.round((1 - r.results.peakMemoryMB / maxMemory) * 100)
      : 50,
    reliabilityScore: Math.round((1 - r.results.errors / Math.max(r.results.totalRequests, 1)) * 100),
  }));

  // Calculate overall score
  const rankedScores = scores.map(s => ({
    ...s,
    overall: Math.round((s.throughputScore + s.latencyScore + s.memoryScore + s.reliabilityScore) / 4),
  })).sort((a, b) => b.overall - a.overall);

  const pieData = rankedScores.map((s, i) => ({
    name: s.variant,
    value: s.overall,
    fill: theme.chart.colors[i % theme.chart.colors.length],
  }));

  return (
    <SlideContainer title="Overall Comparison" subtitle="Normalized scores across all metrics (0-100) - Higher is better" theme={theme}>
      <div style={{ flex: 1, display: "flex", gap: 28 }}>
        <div style={{ flex: 1, background: theme.card.background, borderRadius: 16, padding: 28 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 32, height: "100%" }}>
            {/* Score Table */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: theme.text.muted, borderBottom: `2px solid ${theme.chart.grid}` }}>
                    <th style={{ textAlign: "left", padding: "16px 12px", fontSize: 20 }}>Variant</th>
                    <th style={{ textAlign: "right", padding: "16px 12px", fontSize: 20 }}>RPS</th>
                    <th style={{ textAlign: "right", padding: "16px 12px", fontSize: 20 }}>Latency</th>
                    <th style={{ textAlign: "right", padding: "16px 12px", fontSize: 20 }}>Memory</th>
                    <th style={{ textAlign: "right", padding: "16px 12px", fontSize: 20, color: theme.accent.warning }}>Overall</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedScores.map((s, i) => (
                    <tr key={s.variant} style={{ borderBottom: `1px solid ${theme.card.border}` }}>
                      <td style={{ padding: "16px 12px", display: "flex", alignItems: "center", gap: 12 }}>
                        {i === 0 && <span style={{ fontSize: 24 }}>🥇</span>}
                        {i === 1 && <span style={{ fontSize: 24 }}>🥈</span>}
                        {i === 2 && <span style={{ fontSize: 24 }}>🥉</span>}
                        {i > 2 && <span style={{ width: 24 }}></span>}
                        <span style={{ color: theme.text.primary, fontWeight: 600, fontSize: 20 }}>{s.variant}</span>
                      </td>
                      <td style={{ textAlign: "right", padding: "16px 12px", color: theme.text.secondary, fontSize: 20 }}>{s.throughputScore}</td>
                      <td style={{ textAlign: "right", padding: "16px 12px", color: theme.text.secondary, fontSize: 20 }}>{s.latencyScore}</td>
                      <td style={{ textAlign: "right", padding: "16px 12px", color: theme.text.secondary, fontSize: 20 }}>{s.memoryScore}</td>
                      <td style={{ textAlign: "right", padding: "16px 12px", fontWeight: 700, color: theme.accent.warning, fontSize: 22 }}>{s.overall}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pie Chart */}
            <div>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={160}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={{ stroke: theme.text.muted, strokeWidth: 2 }}
                  >
                    {pieData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div style={{ width: 380, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: `${theme.accent.warning}20`, border: `2px solid ${theme.accent.warning}60`, borderRadius: 16, padding: 28 }}>
            <div style={{ color: theme.accent.warning, fontSize: 22, fontWeight: 600 }}>🏆 Recommended</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: theme.text.primary, marginTop: 12 }}>{rankedScores[0].variant}</div>
            <div style={{ color: theme.accent.warning, fontSize: 28, marginTop: 8 }}>Score: {rankedScores[0].overall}/100</div>
          </div>

          <div style={{ flex: 1, background: theme.card.background, borderRadius: 16, padding: 28 }}>
            <div style={{ color: theme.text.secondary, fontSize: 22, fontWeight: 600, marginBottom: 20 }}>Winner Breakdown</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20 }}>
                <span style={{ color: theme.text.muted }}>⚡ Throughput</span>
                <span style={{ color: theme.text.primary, fontWeight: 600 }}>{rankedScores[0].throughputScore}/100</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20 }}>
                <span style={{ color: theme.text.muted }}>🕐 Latency</span>
                <span style={{ color: theme.text.primary, fontWeight: 600 }}>{rankedScores[0].latencyScore}/100</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20 }}>
                <span style={{ color: theme.text.muted }}>💾 Memory</span>
                <span style={{ color: theme.text.primary, fontWeight: 600 }}>{rankedScores[0].memoryScore}/100</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20 }}>
                <span style={{ color: theme.text.muted }}>✅ Reliability</span>
                <span style={{ color: theme.text.primary, fontWeight: 600 }}>{rankedScores[0].reliabilityScore}/100</span>
              </div>
            </div>
          </div>

          <div style={{ background: theme.card.background, borderRadius: 12, padding: 16, fontSize: 16, color: theme.text.muted, lineHeight: 1.5 }}>
            Each metric normalized 0-100. Overall = average of all scores.
          </div>
        </div>
      </div>
    </SlideContainer>
  );
}

function DashboardStatsSlide({ benchmark, theme }: {
  benchmark: BenchmarkRun;
  theme: SlideTheme;
}) {
  const run = benchmark.runs[0];
  const customData = (run.results as any).customData as {
    database: string;
    tables: Array<{ name: string; records: number; friendlyCount: string }>;
    totalRecords: number;
    friendlyTotal: string;
  };

  const topTables = customData.tables.slice().sort((a, b) => b.records - a.records).slice(0, 4);

  return (
    <SlideContainer title="EF Core Performance Lab" subtitle="System & Database Overview" theme={theme}>
      <div style={{ flex: 1, display: "flex", gap: 32 }}>
        {/* Left Column - System Info */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ background: theme.card.background, borderRadius: 16, padding: 32, flex: 1 }}>
            <h3 style={{ fontSize: 32, fontWeight: 600, marginBottom: 24, color: theme.text.secondary }}>🖥️ Hardware</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 24, color: theme.text.muted }}>Processor</span>
                <span style={{ fontSize: 28, fontWeight: 600, color: theme.text.primary }}>{benchmark.hardware.cpu}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 24, color: theme.text.muted }}>Memory</span>
                <span style={{ fontSize: 28, fontWeight: 600, color: theme.text.primary }}>{benchmark.hardware.memory}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 24, color: theme.text.muted }}>Runtime</span>
                <span style={{ fontSize: 28, fontWeight: 600, color: theme.text.primary }}>{benchmark.hardware.dotnetVersion}</span>
              </div>
            </div>
          </div>

          <div style={{ background: theme.card.background, borderRadius: 16, padding: 32, flex: 1 }}>
            <h3 style={{ fontSize: 32, fontWeight: 600, marginBottom: 24, color: theme.text.secondary }}>🏆 Key Metrics</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 24, color: theme.text.muted }}>Total Records</span>
                <span style={{ fontSize: 32, fontWeight: 700, color: theme.accent.primary }}>{customData.friendlyTotal}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 24, color: theme.text.muted }}>Tables</span>
                <span style={{ fontSize: 28, fontWeight: 600, color: theme.text.primary }}>{customData.tables.length}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 24, color: theme.text.muted }}>Database</span>
                <span style={{ fontSize: 24, fontWeight: 600, color: theme.accent.success }}>{customData.database}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Database Tables */}
        <div style={{ flex: 1.2, background: theme.card.background, borderRadius: 16, padding: 32 }}>
          <h3 style={{ fontSize: 32, fontWeight: 600, marginBottom: 24, color: theme.text.secondary }}>📊 Database Tables</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {topTables.map((table, index) => (
              <div key={table.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: `${theme.accent.primary}10`, borderRadius: 12, border: `1px solid ${theme.accent.primary}30` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: theme.chart.colors[index % theme.chart.colors.length], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 600, color: "white" }}>
                    {index + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: theme.text.primary }}>{table.name}</div>
                    <div style={{ fontSize: 18, color: theme.text.muted }}>{table.records.toLocaleString()} records</div>
                  </div>
                </div>
                <div style={{ fontSize: 36, fontWeight: 700, color: theme.accent.primary }}>
                  {table.friendlyCount}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24, padding: 20, background: `${theme.accent.success}15`, borderRadius: 12, border: `1px solid ${theme.accent.success}40` }}>
            <div style={{ fontSize: 20, color: theme.accent.success, fontWeight: 600 }}>
              🚀 Ready for Performance Testing
            </div>
            <div style={{ fontSize: 16, color: theme.text.muted, marginTop: 4 }}>
              Production-scale dataset with {customData.friendlyTotal} records across {customData.tables.length} tables
            </div>
          </div>
        </div>
      </div>
    </SlideContainer>
  );
}

