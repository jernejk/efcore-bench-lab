"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { webApiClient, type HardwareInfo as ApiHardwareInfo } from "@/lib/webapi-client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, Download, Check, Palette, Presentation, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import * as htmlToImage from "html-to-image";
import {
  type SlideTheme,
  SLIDE_THEMES,
  getSavedTheme,
  saveTheme,
  getTheme,
  getThemeBackgroundColor,
  getThemeBackgroundStyles,
} from "@/lib/slide-themes";

// Fixed slide dimensions (FHD)
const SLIDE_WIDTH = 1920;
const SLIDE_HEIGHT = 1080;

// Cache for base64 encoded background images
const imageCache: Record<string, string> = {};

// Preload and convert image to base64 for reliable export
async function getBase64Image(url: string): Promise<string> {
  if (imageCache[url]) return imageCache[url];
  
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        imageCache[url] = base64;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return url; // Fallback to original URL
  }
}

// Extended hardware info interface for slides
interface SlideHardwareInfo {
  cpuBrand: string;
  totalCores: number;
  performanceCores?: number;
  efficiencyCores?: number;
  physicalCores?: number;
  logicalProcessors?: number;
  memoryGB?: number;
  gpuCores?: number;
  performanceL2CacheMB?: number;
  efficiencyL2CacheMB?: number;
  architecture: string;
  os: string;
  runtime: string;
  dotnetVersion: string;
}

// Helper to extract .NET version
function extractDotNetVersion(runtime: string): string {
  const match = runtime.match(/\.NET\s*(\d+\.\d+)/i);
  if (match) {
    return `.NET ${match[1]}`;
  }
  return runtime;
}

export default function SlidesPage() {
  const slideRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("combined");
  const [scale, setScale] = useState(1);
  const [themeId, setThemeId] = useState<string>("dark");
  const theme = getTheme(themeId);

  // Fetch detailed hardware data from WebAPI
  const hardwareQuery = useQuery({
    queryKey: ["hardware"],
    queryFn: () => webApiClient.hardware(),
    staleTime: 60000, // 1 minute
  });

  const dbStatsQuery = useQuery({
    queryKey: ["db-stats"],
    queryFn: () => webApiClient.dbStats(),
    staleTime: 60000,
  });

  // Build hardware info from real data
  const hardwareInfo: SlideHardwareInfo | null = hardwareQuery.data ? {
    cpuBrand: hardwareQuery.data.cpuBrand || `${hardwareQuery.data.processorCount}-Core Processor`,
    totalCores: hardwareQuery.data.processorCount,
    performanceCores: hardwareQuery.data.performanceCores,
    efficiencyCores: hardwareQuery.data.efficiencyCores,
    physicalCores: hardwareQuery.data.physicalCores,
    logicalProcessors: hardwareQuery.data.logicalProcessors,
    memoryGB: hardwareQuery.data.memoryGB,
    gpuCores: hardwareQuery.data.gpuCores,
    performanceL2CacheMB: hardwareQuery.data.performanceL2CacheMB,
    efficiencyL2CacheMB: hardwareQuery.data.efficiencyL2CacheMB,
    architecture: hardwareQuery.data.architecture,
    os: hardwareQuery.data.os,
    runtime: hardwareQuery.data.runtime,
    dotnetVersion: extractDotNetVersion(hardwareQuery.data.runtime),
  } : null;

  // Load saved theme on mount
  useEffect(() => {
    setThemeId(getSavedTheme());
  }, []);

  // Preload background image and QR codes when theme changes (for reliable export)
  useEffect(() => {
    if (theme.backgroundImage) {
      getBase64Image(theme.backgroundImage);
    }
    // Preload all QR code sizes used across slides for export
    const qrSizes = [120, 320, 360]; // CombinedSlide, BenchmarkToolsSlide, OutroSlide
    qrSizes.forEach(size => {
      getBase64Image(`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(GITHUB_REPO_URL)}&margin=0`);
    });
  }, [theme]);

  // Save theme when changed
  const handleThemeChange = (newThemeId: string) => {
    setThemeId(newThemeId);
    saveTheme(newThemeId);
  };

  // Viewbox-like scaling: calculate scale to fit container (both width AND height)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateScale = () => {
      // Use getBoundingClientRect for more accurate measurements
      const rect = container.getBoundingClientRect();
      const containerWidth = rect.width;
      const containerHeight = rect.height;
      
      if (containerWidth === 0 || containerHeight === 0) return;
      
      // Calculate scale to fit both dimensions with padding
      const padding = 24;
      const scaleX = (containerWidth - padding) / SLIDE_WIDTH;
      const scaleY = (containerHeight - padding) / SLIDE_HEIGHT;
      const newScale = Math.min(scaleX, scaleY, 1); // Don't scale above 100%
      
      setScale(Math.max(newScale, 0.1)); // Minimum 10% scale
    };

    // Use ResizeObserver for reliable container size detection
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(updateScale);
    });
    
    resizeObserver.observe(container);
    updateScale();
    
    return () => resizeObserver.disconnect();
  }, [activeTab, hardwareQuery.data]);

  // Convert all external images to base64 for reliable export
  const prepareImagesForExport = async () => {
    if (!slideRef.current) return;
    
    // Handle background image
    if (theme.backgroundImage) {
      const base64Img = await getBase64Image(theme.backgroundImage);
      const bgElements = slideRef.current.querySelectorAll<HTMLElement>('[data-slide-bg]');
      bgElements.forEach(el => {
        el.style.backgroundImage = `url(${base64Img})`;
      });
    }
    
    // Handle all img elements with external URLs
    const imgElements = slideRef.current.querySelectorAll<HTMLImageElement>('img[src^="http"]');
    const originalSrcs: { el: HTMLImageElement; src: string }[] = [];
    
    // Convert all images to base64 and wait for them to load
    const loadPromises: Promise<void>[] = [];
    
    for (const img of imgElements) {
      originalSrcs.push({ el: img, src: img.src });
      try {
        const base64 = await getBase64Image(img.src);
        // Create a promise that resolves when the image loads with new src
        const loadPromise = new Promise<void>((resolve) => {
          const onLoad = () => {
            img.removeEventListener('load', onLoad);
            resolve();
          };
          img.addEventListener('load', onLoad);
          // Also resolve after timeout in case load event doesn't fire
          setTimeout(resolve, 100);
        });
        img.src = base64;
        loadPromises.push(loadPromise);
      } catch {
        // Keep original if conversion fails
      }
    }
    
    // Wait for all images to finish loading
    await Promise.all(loadPromises);
    // Extra small delay to ensure DOM has updated
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return originalSrcs;
  };
  
  // Restore original image sources after export
  const restoreImagesAfterExport = (originalSrcs?: { el: HTMLImageElement; src: string }[]) => {
    if (!slideRef.current) return;
    
    // Restore background image
    if (theme.backgroundImage) {
      const bgElements = slideRef.current.querySelectorAll<HTMLElement>('[data-slide-bg]');
      bgElements.forEach(el => {
        el.style.backgroundImage = `url(${theme.backgroundImage})`;
      });
    }
    
    // Restore img sources
    originalSrcs?.forEach(({ el, src }) => {
      el.src = src;
    });
  };

  const copyToClipboard = async () => {
    if (!slideRef.current) return;

    try {
      const originalSrcs = await prepareImagesForExport();

      const bgColor = getThemeBackgroundColor(theme);
      const dataUrl = await htmlToImage.toPng(slideRef.current, {
        quality: 1,
        pixelRatio: 2, // Higher resolution for crisp export
        backgroundColor: bgColor,
        width: SLIDE_WIDTH,
        height: SLIDE_HEIGHT,
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
        },
        skipAutoScale: true,
        includeQueryParams: true,
        cacheBust: true,
      });

      restoreImagesAfterExport(originalSrcs);

      const response = await fetch(dataUrl);
      const blob = await response.blob();

      if (typeof ClipboardItem === "undefined") {
        downloadImageFromDataUrl(dataUrl);
        toast.success("Image downloaded (clipboard not supported)");
        return;
      }

      try {
        const clipboardItem = new ClipboardItem({ "image/png": blob });
        await navigator.clipboard.write([clipboardItem]);
        setCopied(true);
        toast.success("Slide copied to clipboard (1920×1080)!");
        setTimeout(() => setCopied(false), 2000);
      } catch {
        downloadImageFromDataUrl(dataUrl);
        toast.success("Image downloaded (clipboard blocked)");
      }
    } catch (err) {
      console.error("Copy failed:", err);
      toast.error("Failed to generate image");
    }
  };

  const downloadImageFromDataUrl = (dataUrl: string) => {
    const link = document.createElement("a");
    link.download = `slide-${activeTab}-1920x1080.png`;
    link.href = dataUrl;
    link.click();
  };

  const downloadImage = async () => {
    if (!slideRef.current) return;

    try {
      const originalSrcs = await prepareImagesForExport();

      const bgColor = getThemeBackgroundColor(theme);
      const dataUrl = await htmlToImage.toPng(slideRef.current, {
        quality: 1,
        pixelRatio: 2, // Higher resolution for crisp export
        backgroundColor: bgColor,
        width: SLIDE_WIDTH,
        height: SLIDE_HEIGHT,
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
        },
        skipAutoScale: true,
        includeQueryParams: true,
        cacheBust: true,
      });

      restoreImagesAfterExport(originalSrcs);

      const link = document.createElement("a");
      link.download = `slide-${activeTab}-1920x1080.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Slide downloaded (1920×1080)!");
    } catch {
      toast.error("Failed to download image.");
    }
  };

  const refetchData = () => {
    hardwareQuery.refetch();
    dbStatsQuery.refetch();
    toast.success("Refreshing data...");
  };

  // Loading state
  if (hardwareQuery.isLoading) {
    return (
      <div className="space-y-6 h-full flex flex-col">
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Presentation className="h-8 w-8" />
              Presentation Slides
            </h1>
            <p className="text-muted-foreground">
              Loading system information...
            </p>
          </div>
        </div>
        <Card className="flex-1">
          <CardContent className="p-8 space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (hardwareQuery.isError) {
    return (
      <div className="space-y-6 h-full flex flex-col">
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Presentation className="h-8 w-8" />
              Presentation Slides
            </h1>
            <p className="text-muted-foreground">
              Generate professional slides for your testing environment
            </p>
          </div>
        </div>
        <Card className="flex-1">
          <CardContent className="p-8 flex flex-col items-center justify-center gap-4">
            <AlertCircle className="h-16 w-16 text-destructive" />
            <p className="text-lg text-muted-foreground">
              Unable to connect to WebAPI. Make sure the server is running.
            </p>
            <Button onClick={refetchData}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Presentation className="h-8 w-8" />
            Presentation Slides
          </h1>
          <p className="text-muted-foreground">
            Generate professional slides with real system data
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refetchData}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh Data
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col min-h-0"
      >
        <div className="flex items-center justify-between gap-4 flex-wrap flex-shrink-0">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="combined">All-in-One</TabsTrigger>
            <TabsTrigger value="environment">Environment</TabsTrigger>
            <TabsTrigger value="hardware">Hardware</TabsTrigger>
            <TabsTrigger value="tools">Bench Lab</TabsTrigger>
            <TabsTrigger value="vs-bombardier">vs Bombardier</TabsTrigger>
            <TabsTrigger value="vs-benchmarkdotnet">vs BenchmarkDotNet</TabsTrigger>
            <TabsTrigger value="minimal">Minimal</TabsTrigger>
            <TabsTrigger value="outro">Outro</TabsTrigger>
          </TabsList>

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
          className="mt-4 flex-1 border rounded-lg overflow-hidden bg-slate-950 relative min-h-0"
        >
          {/* Fixed-size slide that scales proportionally to fit container */}
          <div
            className="absolute inset-0 flex items-center justify-center"
          >
            <div
              style={{
                width: SLIDE_WIDTH,
                height: SLIDE_HEIGHT,
                transform: `scale(${scale})`,
                transformOrigin: "center center",
                flexShrink: 0,
              }}
            >
            <div
              ref={slideRef}
              style={{ width: SLIDE_WIDTH, height: SLIDE_HEIGHT }}
            >
              <TabsContent
                value="combined"
                className="m-0 h-full"
                forceMount
                style={{ display: activeTab === "combined" ? "block" : "none" }}
              >
                <CombinedSlide theme={theme} hardware={hardwareInfo!} dbStats={dbStatsQuery.data} />
              </TabsContent>

              <TabsContent
                value="environment"
                className="m-0 h-full"
                forceMount
                style={{ display: activeTab === "environment" ? "block" : "none" }}
              >
                <EnvironmentSlide theme={theme} hardware={hardwareInfo!} />
              </TabsContent>

              <TabsContent
                value="hardware"
                className="m-0 h-full"
                forceMount
                style={{ display: activeTab === "hardware" ? "block" : "none" }}
              >
                <HardwareDetailsSlide theme={theme} hardware={hardwareInfo!} />
              </TabsContent>

              <TabsContent
                value="tools"
                className="m-0 h-full"
                forceMount
                style={{ display: activeTab === "tools" ? "block" : "none" }}
              >
                <BenchmarkToolsSlide theme={theme} />
              </TabsContent>

              <TabsContent
                value="vs-bombardier"
                className="m-0 h-full"
                forceMount
                style={{ display: activeTab === "vs-bombardier" ? "block" : "none" }}
              >
                <VsBombardierSlide theme={theme} />
              </TabsContent>

              <TabsContent
                value="vs-benchmarkdotnet"
                className="m-0 h-full"
                forceMount
                style={{ display: activeTab === "vs-benchmarkdotnet" ? "block" : "none" }}
              >
                <VsBenchmarkDotNetSlide theme={theme} />
              </TabsContent>

              <TabsContent
                value="minimal"
                className="m-0 h-full"
                forceMount
                style={{ display: activeTab === "minimal" ? "block" : "none" }}
              >
                <MinimalSlide theme={theme} hardware={hardwareInfo!} />
              </TabsContent>

              <TabsContent
                value="outro"
                className="m-0 h-full"
                forceMount
                style={{ display: activeTab === "outro" ? "block" : "none" }}
              >
                <OutroSlide theme={theme} />
              </TabsContent>
            </div>
          </div>
          </div>
        </div>
      </Tabs>
    </div>
  );
}

// === SLIDE COMPONENTS ===

function SlideContainer({
  children,
  title,
  subtitle,
  theme,
  titleExtra,
  headerRight,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  theme: SlideTheme;
  titleExtra?: React.ReactNode;
  headerRight?: React.ReactNode;
}) {
  const backgroundStyle = getThemeBackgroundStyles(theme);

  return (
    <div
      data-slide-bg={theme.backgroundImage ? "true" : undefined}
      style={{
        width: SLIDE_WIDTH,
        height: SLIDE_HEIGHT,
        padding: "48px 64px",
        display: "flex",
        flexDirection: "column",
        ...backgroundStyle,
        color: theme.text.primary,
      }}
    >
      <div style={{ marginBottom: 32, flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: theme.text.primary,
              margin: 0,
              lineHeight: 1.1,
              display: "flex",
              alignItems: "baseline",
              whiteSpace: "nowrap",
            }}
          >
            {title}
            {titleExtra}
          </h1>
          {subtitle && (
            <p style={{ fontSize: 28, color: theme.text.muted, marginTop: 12, whiteSpace: "nowrap" }}>
              {subtitle}
            </p>
          )}
        </div>
        {headerRight}
      </div>
      <div
        style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
      >
        {children}
      </div>
      <div
        style={{
          fontSize: 18,
          color: theme.footer.text,
          marginTop: 20,
          display: "flex",
          justifyContent: "space-between",
          flexShrink: 0,
          width: "100%",
        }}
      >
        <span style={{ whiteSpace: "nowrap" }}>Join the Conversation @SSW_TV @jernej_kavka #EFCore</span>
        <span style={{ whiteSpace: "nowrap" }}>EF Core Bench Lab</span>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  subValue,
  icon,
  theme,
  accent = "primary",
}: {
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  theme: SlideTheme;
  accent?: keyof SlideTheme["accent"];
}) {
  const accentColor = theme.accent[accent];

  return (
    <div
      style={{
        background: theme.card.background,
        border: `2px solid ${accentColor}40`,
        borderRadius: 20,
        padding: "28px 32px",
        display: "flex",
        alignItems: "center",
        gap: 20,
      }}
    >
      {icon && <div style={{ fontSize: 48 }}>{icon}</div>}
      <div>
        <div style={{ color: theme.text.muted, fontSize: 20, marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ fontSize: 36, fontWeight: 700, color: theme.text.primary }}>
          {value}
        </div>
        {subValue && (
          <div style={{ fontSize: 18, color: theme.text.muted, marginTop: 4 }}>
            {subValue}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper to format large numbers
function formatRecordCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}m`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return count.toString();
}

// GitHub repo URL for QR code
const GITHUB_REPO_URL = "https://github.com/jernejk/efcore-bench-lab";

// Combined slide - EF Core Bench Lab with Hardware & Database Summary
function CombinedSlide({ theme, hardware, dbStats }: { theme: SlideTheme; hardware: SlideHardwareInfo; dbStats?: { database: string; tables: { tableName: string; rowCount: number }[] } }) {
  const totalRecords = dbStats?.tables.reduce((sum, t) => sum + t.rowCount, 0) ?? 0;
  const tableCount = dbStats?.tables.length ?? 0;
  const tableColors = [theme.accent.primary, theme.accent.success, theme.accent.warning, theme.accent.purple];

  return (
    <SlideContainer
      title="EF Core Bench Lab"
      subtitle="System & Database Overview"
      theme={theme}
      titleExtra={
        <span style={{ fontSize: 20, color: theme.text.muted, fontWeight: 400, marginLeft: 16, opacity: 0.7, whiteSpace: "nowrap" }}>
          by JK
        </span>
      }
      headerRight={
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* GitHub link - on the left */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", textAlign: "right" }}>
            <span style={{ fontSize: 14, color: theme.text.muted, marginBottom: 4, whiteSpace: "nowrap" }}>Open Source</span>
            <span style={{ fontSize: 18, color: theme.text.primary, fontWeight: 500, whiteSpace: "nowrap" }}>github.com/jernejk/efcore-bench-lab</span>
          </div>
          {/* QR Code - on the right */}
          <div
            style={{
              background: "white",
              padding: 10,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(GITHUB_REPO_URL)}&margin=0`}
              alt="GitHub QR"
              style={{ width: 120, height: 120 }}
              crossOrigin="anonymous"
            />
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", gap: 40, flex: 1 }}>
        {/* Left Column - Hardware + Key Metrics */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Hardware Card */}
          <div
            style={{
              background: theme.card.background,
              borderRadius: 20,
              padding: 32,
            }}
          >
            <h3
              style={{
                fontSize: 32,
                fontWeight: 600,
                marginBottom: 24,
                color: theme.text.primary,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              🖥️ Hardware
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 26, color: theme.text.muted }}>Processor</span>
                <span style={{ fontSize: 26, fontWeight: 600, color: theme.text.primary }}>{hardware.cpuBrand}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 26, color: theme.text.muted }}>Cores</span>
                <span style={{ fontSize: 26, fontWeight: 600, color: theme.text.primary }}>
                  {hardware.performanceCores && hardware.efficiencyCores
                    ? `${hardware.performanceCores}P + ${hardware.efficiencyCores}E (${hardware.totalCores} total)`
                    : `${hardware.totalCores} cores`}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 26, color: theme.text.muted }}>Memory</span>
                <span style={{ fontSize: 26, fontWeight: 600, color: theme.text.primary }}>{hardware.memoryGB} GB</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 26, color: theme.text.muted }}>Runtime</span>
                <span style={{ fontSize: 26, fontWeight: 600, color: theme.text.primary }}>{hardware.dotnetVersion}</span>
              </div>
            </div>
          </div>

          {/* Key Metrics Card */}
          <div
            style={{
              background: theme.card.background,
              borderRadius: 20,
              padding: 32,
              flex: 1,
            }}
          >
            <h3
              style={{
                fontSize: 32,
                fontWeight: 600,
                marginBottom: 24,
                color: theme.text.primary,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              🏆 Key Metrics
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 26, color: theme.text.muted }}>Total Records</span>
                <span style={{ fontSize: 32, fontWeight: 700, color: theme.accent.primary }}>{formatRecordCount(totalRecords)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 26, color: theme.text.muted }}>Tables</span>
                <span style={{ fontSize: 32, fontWeight: 700, color: theme.text.primary }}>{tableCount}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 26, color: theme.text.muted }}>Database</span>
                <span style={{ fontSize: 26, fontWeight: 600, color: theme.accent.success }}>{dbStats?.database ?? "SalesDB"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Database Tables */}
        <div style={{ flex: 1.2, display: "flex", flexDirection: "column" }}>
          <div
            style={{
              background: theme.card.background,
              borderRadius: 20,
              padding: 32,
              flex: 1,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h3
              style={{
                fontSize: 32,
                fontWeight: 600,
                marginBottom: 24,
                color: theme.text.primary,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              📊 Database Tables
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
              {(dbStats?.tables ?? [
                { tableName: "Sales", rowCount: 11607976 },
                { tableName: "Customers", rowCount: 20000 },
                { tableName: "Products", rowCount: 1000 },
                { tableName: "Employees", rowCount: 100 },
              ]).map((table, index) => (
                <div
                  key={table.tableName}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "18px 24px",
                    background: `${tableColors[index % tableColors.length]}12`,
                    borderRadius: 12,
                    borderLeft: `4px solid ${tableColors[index % tableColors.length]}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: tableColors[index % tableColors.length],
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontWeight: 700,
                        fontSize: 18,
                        flexShrink: 0,
                      }}
                    >
                      {index + 1}
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                      <span style={{ fontSize: 26, fontWeight: 600, color: theme.text.primary, whiteSpace: "nowrap" }}>
                        {table.tableName}
                      </span>
                      <span style={{ fontSize: 18, color: theme.text.muted, whiteSpace: "nowrap" }}>
                        {table.rowCount.toLocaleString()} records
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 700, color: tableColors[index % tableColors.length], whiteSpace: "nowrap" }}>
                    {formatRecordCount(table.rowCount)}
                  </div>
                </div>
              ))}
            </div>

            {/* Ready for Performance Testing Banner */}
            <div
              style={{
                marginTop: 20,
                padding: "20px 28px",
                background: `${theme.accent.success}20`,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <span style={{ fontSize: 32, flexShrink: 0 }}>🚀</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 24, fontWeight: 600, color: theme.accent.success, whiteSpace: "nowrap" }}>
                  Ready for Performance Testing
                </span>
                <span style={{ fontSize: 18, color: theme.text.muted, whiteSpace: "nowrap" }}>
                  Production-scale dataset with {formatRecordCount(totalRecords)} records across {tableCount} tables
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SlideContainer>
  );
}

// Environment slide - focused on the testing setup
function EnvironmentSlide({ theme, hardware }: { theme: SlideTheme; hardware: SlideHardwareInfo }) {
  const coreDescription = hardware.performanceCores && hardware.efficiencyCores
    ? `${hardware.performanceCores}P + ${hardware.efficiencyCores}E`
    : String(hardware.totalCores);

  return (
    <SlideContainer
      title="My Testing Environment"
      theme={theme}
    >
      <div style={{ display: "flex", gap: 48, flex: 1, alignItems: "center" }}>
        {/* Left - Framework */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              background: `${theme.accent.primary}15`,
              border: `3px solid ${theme.accent.primary}40`,
              borderRadius: 24,
              padding: 48,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 80, marginBottom: 24 }}>⚡</div>
            <div
              style={{
                fontSize: 48,
                fontWeight: 700,
                color: theme.accent.primary,
                marginBottom: 8,
              }}
            >
              {hardware.dotnetVersion} with EF Core
            </div>
            <div style={{ fontSize: 24, color: theme.text.muted }}>
              Latest performance optimizations
            </div>
          </div>
        </div>

        {/* Right - Hardware Grid */}
        <div style={{ flex: 1.2 }}>
          <h3
            style={{
              fontSize: 36,
              fontWeight: 600,
              marginBottom: 32,
              color: theme.text.secondary,
            }}
          >
            My PC
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <MetricCard
              icon="🔥"
              label="CPU"
              value={hardware.cpuBrand}
              theme={theme}
              accent="success"
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <MetricCard
                icon="🧵"
                label="Cores"
                value={coreDescription}
                theme={theme}
                accent="warning"
              />
              <MetricCard
                icon="💾"
                label="RAM"
                value={hardware.memoryGB ? `${hardware.memoryGB} GB` : "N/A"}
                theme={theme}
                accent="warning"
              />
            </div>

            {hardware.gpuCores && (
              <MetricCard
                icon="🎮"
                label="GPU Cores"
                value={String(hardware.gpuCores)}
                theme={theme}
                accent="purple"
              />
            )}
          </div>
        </div>
      </div>
    </SlideContainer>
  );
}

// Hardware Details slide - detailed system info
function HardwareDetailsSlide({ theme, hardware }: { theme: SlideTheme; hardware: SlideHardwareInfo }) {
  const coreDetails = [];
  if (hardware.performanceCores) coreDetails.push(`${hardware.performanceCores} P-cores`);
  if (hardware.efficiencyCores) coreDetails.push(`${hardware.efficiencyCores} E-cores`);
  const coreDescription = coreDetails.length > 0 
    ? coreDetails.join(" + ") 
    : `${hardware.totalCores} cores available`;

  return (
    <SlideContainer
      title="Hardware Specifications"
      subtitle={`${hardware.os} - ${hardware.architecture}`}
      theme={theme}
    >
      <div style={{ display: "flex", gap: 40, flex: 1 }}>
        {/* CPU Info Panel */}
        <div
          style={{
            flex: 1,
            background: theme.card.background,
            borderRadius: 20,
            padding: 32,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              marginBottom: 32,
              paddingBottom: 24,
              borderBottom: `2px solid ${theme.card.border}`,
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                background: `${theme.accent.success}20`,
                borderRadius: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 48,
              }}
            >
              🔥
            </div>
            <div>
              <div style={{ fontSize: 20, color: theme.text.muted }}>Processor</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: theme.text.primary }}>
                {hardware.cpuBrand}
              </div>
              <div style={{ fontSize: 20, color: theme.accent.success }}>
                {coreDescription}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { label: "Total Cores", value: String(hardware.totalCores) },
              { label: "Memory", value: hardware.memoryGB ? `${hardware.memoryGB} GB` : "N/A" },
              { label: "Runtime", value: hardware.dotnetVersion },
              { label: "GPU Cores", value: hardware.gpuCores ? String(hardware.gpuCores) : "N/A" },
            ].map((spec) => (
              <div
                key={spec.label}
                style={{
                  padding: "16px 20px",
                  background: `${theme.accent.primary}10`,
                  borderRadius: 12,
                }}
              >
                <div style={{ fontSize: 16, color: theme.text.muted }}>{spec.label}</div>
                <div style={{ fontSize: 24, fontWeight: 600, color: theme.text.primary }}>
                  {spec.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* OS & Runtime Panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              background: theme.card.background,
              borderRadius: 20,
              padding: 32,
              flex: 1,
            }}
          >
            <h3
              style={{
                fontSize: 28,
                fontWeight: 600,
                marginBottom: 24,
                color: theme.text.secondary,
              }}
            >
              System Information
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { label: "Operating System", value: hardware.os },
                { label: "Architecture", value: hardware.architecture },
                { label: "Runtime", value: hardware.runtime },
              ].map((info, i) => (
                <div
                  key={info.label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    padding: "16px 20px",
                    background: `${theme.accent.success}${15 - i * 3}`,
                    borderRadius: 12,
                  }}
                >
                  <span style={{ fontSize: 16, color: theme.text.muted }}>
                    {info.label}
                  </span>
                  <span style={{ fontSize: 20, fontWeight: 600, color: theme.text.primary }}>
                    {info.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* CPU Core breakdown or GPU info */}
          <div
            style={{
              display: "flex",
              gap: 16,
            }}
          >
            {hardware.performanceCores && (
              <div
                style={{
                  flex: 1,
                  background: `${theme.accent.success}15`,
                  border: `2px solid ${theme.accent.success}40`,
                  borderRadius: 20,
                  padding: 24,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 48, fontWeight: 700, color: theme.accent.success }}>
                  {hardware.performanceCores}
                </div>
                <div style={{ fontSize: 20, color: theme.text.muted }}>P-Cores</div>
              </div>
            )}
            {hardware.efficiencyCores && (
              <div
                style={{
                  flex: 1,
                  background: `${theme.accent.warning}15`,
                  border: `2px solid ${theme.accent.warning}40`,
                  borderRadius: 20,
                  padding: 24,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 48, fontWeight: 700, color: theme.accent.warning }}>
                  {hardware.efficiencyCores}
                </div>
                <div style={{ fontSize: 20, color: theme.text.muted }}>E-Cores</div>
              </div>
            )}
            {hardware.gpuCores && (
              <div
                style={{
                  flex: 1,
                  background: `${theme.accent.purple}15`,
                  border: `2px solid ${theme.accent.purple}40`,
                  borderRadius: 20,
                  padding: 24,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 48, fontWeight: 700, color: theme.accent.purple }}>
                  {hardware.gpuCores}
                </div>
                <div style={{ fontSize: 20, color: theme.text.muted }}>GPU Cores</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </SlideContainer>
  );
}

// Benchmark Tools slide - EF Core Bench Lab marketing (cleaned up with prominent QR)
function BenchmarkToolsSlide({ theme }: { theme: SlideTheme }) {
  // Sample performance data for mini charts
  const throughputData = [
    { scenario: "Bad", value: 623, color: "#ef4444" },
    { scenario: "Good", value: 1824, color: "#3b82f6" },
    { scenario: "Best", value: 2262, color: "#22c55e" },
  ];
  const maxThroughput = 2400;

  // Latency data for vertical bar chart (like the reference image)
  const latencyScenarios = [
    { name: "tolist-before-filter", p50: 31, p95: 48, p99: 59 },
    { name: "filter-before-tolist", p50: 8, p95: 11, p99: 15 },
    { name: "count-in-sql", p50: 7, p95: 10, p99: 15 },
  ];
  const maxLatency = 65;

  return (
    <SlideContainer
      title="EF Core Bench Lab"
      subtitle="Your All-in-One EF Core Performance Testing Suite"
      theme={theme}
      titleExtra={
        <span style={{ fontSize: 20, color: theme.text.muted, fontWeight: 400, marginLeft: 16, opacity: 0.7, whiteSpace: "nowrap" }}>
          by JK
        </span>
      }
    >
      <div style={{ display: "flex", gap: 36, flex: 1 }}>
        {/* Left - Features + Graphs */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          {/* Hero Banner */}
          <div
            style={{
              background: `linear-gradient(135deg, ${theme.accent.primary}30, ${theme.accent.purple}20)`,
              border: `2px solid ${theme.accent.primary}50`,
              borderRadius: 18,
              padding: "24px 32px",
              display: "flex",
              alignItems: "center",
              gap: 24,
            }}
          >
            <div style={{ fontSize: 64 }}>🔬</div>
            <div>
              <div style={{ fontSize: 32, fontWeight: 700, color: theme.accent.primary, whiteSpace: "nowrap" }}>
                Built for EF Core Performance
              </div>
              <div style={{ fontSize: 20, color: theme.text.secondary, whiteSpace: "nowrap" }}>
                Interactive scenarios • Real-time metrics • AI insights
              </div>
            </div>
          </div>

          {/* Feature Grid - 3 rows x 2 columns */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[
              { icon: "🚀", title: "Bulk Benchmarks", desc: "Run all scenarios at once", color: theme.accent.primary },
              { icon: "🤖", title: "AI Analysis", desc: "Get optimization suggestions", color: theme.accent.purple },
              { icon: "📊", title: "Compare Runs", desc: "Track improvements over time", color: theme.accent.success },
              { icon: "📈", title: "Visual Charts", desc: "Beautiful performance graphs", color: theme.accent.warning },
              { icon: "🎯", title: "Execution Plans", desc: "See actual SQL query plans", color: theme.accent.primary },
              { icon: "📋", title: "Export Slides", desc: "Share results as images", color: theme.accent.purple },
            ].map((feature) => (
              <div
                key={feature.title}
                style={{
                  background: theme.card.background,
                  border: `1px solid ${feature.color}40`,
                  borderRadius: 12,
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <span style={{ fontSize: 28 }}>{feature.icon}</span>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: feature.color, whiteSpace: "nowrap" }}>{feature.title}</div>
                  <div style={{ fontSize: 14, color: theme.text.muted, whiteSpace: "nowrap" }}>{feature.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Mini Charts Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {/* Throughput Chart - Horizontal bars */}
            <div
              style={{
                background: theme.card.background,
                borderRadius: 16,
                padding: 20,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 22 }}>🚀</span>
                <span style={{ fontSize: 18, fontWeight: 600, color: theme.text.primary, whiteSpace: "nowrap" }}>Throughput (req/s)</span>
                <span style={{ fontSize: 12, color: theme.text.muted, marginLeft: "auto", whiteSpace: "nowrap" }}>Run 1 • Run 2 • Run 3</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {throughputData.map((row) => (
                  <div key={row.scenario} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 44, fontSize: 15, fontWeight: 500, color: theme.text.muted }}>{row.scenario}</div>
                    <div style={{ flex: 1, height: 26, background: `${row.color}20`, borderRadius: 6, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${(row.value / maxThroughput) * 100}%`,
                          background: row.color,
                          borderRadius: 6,
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: row.color, width: 50, textAlign: "right" }}>
                      {row.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Latency Chart - Vertical grouped bars */}
            <div
              style={{
                background: theme.card.background,
                borderRadius: 16,
                padding: 20,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 22 }}>⏱️</span>
                <span style={{ fontSize: 18, fontWeight: 600, color: theme.text.primary, whiteSpace: "nowrap" }}>Latency (ms)</span>
              </div>
              {/* Legend */}
              <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                {[
                  { label: "Median (P50)", color: "#22c55e" },
                  { label: "P95", color: "#f59e0b" },
                  { label: "P99", color: "#ef4444" },
                ].map((item) => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: item.color }} />
                    <span style={{ fontSize: 12, color: theme.text.muted }}>{item.label}</span>
                  </div>
                ))}
              </div>
              {/* Vertical Bar Chart */}
              <div style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-around" }}>
                {latencyScenarios.map((scenario) => (
                  <div key={scenario.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    {/* Bars */}
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 100 }}>
                      {[
                        { val: scenario.p50, color: "#22c55e" },
                        { val: scenario.p95, color: "#f59e0b" },
                        { val: scenario.p99, color: "#ef4444" },
                      ].map((bar, i) => (
                        <div
                          key={i}
                          style={{
                            width: 22,
                            height: `${(bar.val / maxLatency) * 100}%`,
                            background: bar.color,
                            borderRadius: "4px 4px 0 0",
                            minHeight: 8,
                          }}
                        />
                      ))}
                    </div>
                    {/* Label */}
                    <div style={{ fontSize: 11, color: theme.text.muted, textAlign: "center", maxWidth: 85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {scenario.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right - QR Code & GitHub */}
        <div
          style={{
            flex: 0.6,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            background: theme.card.background,
            borderRadius: 24,
            padding: "32px 28px",
          }}
        >
          {/* Open Source Badge */}
          <div
            style={{
              background: `${theme.accent.success}20`,
              border: `2px solid ${theme.accent.success}50`,
              borderRadius: 14,
              padding: "12px 28px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 26 }}>⭐</span>
            <span style={{ fontSize: 24, fontWeight: 600, color: theme.accent.success, whiteSpace: "nowrap" }}>Open Source</span>
          </div>

          {/* Large QR Code */}
          <div
            style={{
              background: "white",
              padding: 20,
              borderRadius: 20,
              boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
            }}
          >
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(GITHUB_REPO_URL)}&margin=0`}
              alt="GitHub QR"
              style={{ width: 320, height: 320, display: "block" }}
              crossOrigin="anonymous"
            />
          </div>

          {/* GitHub Link */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, color: theme.text.muted, marginBottom: 8, whiteSpace: "nowrap" }}>Scan to view on GitHub</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: theme.text.primary, whiteSpace: "nowrap" }}>
              github.com/jernejk/efcore-bench-lab
            </div>
          </div>

          {/* Fun Stats Row */}
          <div style={{ display: "flex", gap: 16 }}>
            {[
              { value: "0", label: "GitHub Stars", emoji: "⭐" },
              { value: "MIT", label: "License", emoji: "📜" },
              { value: "99.9%", label: "JK's Effort", emoji: "🧑‍💻" },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  background: `${theme.accent.purple}15`,
                  border: `2px solid ${theme.accent.purple}30`,
                  borderRadius: 12,
                  padding: "12px 18px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 14, marginBottom: 4 }}>{stat.emoji}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: theme.accent.purple }}>{stat.value}</div>
                <div style={{ fontSize: 13, color: theme.text.muted, whiteSpace: "nowrap" }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideContainer>
  );
}

// Outro slide - final call to action with prominent QR code
function OutroSlide({ theme }: { theme: SlideTheme }) {
  return (
    <SlideContainer
      title="Thank You!"
      theme={theme}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 80,
        }}
      >
        {/* Left - Message */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 32 }}>
          <div>
            <div style={{ fontSize: 64, fontWeight: 700, color: theme.text.primary, lineHeight: 1.2 }}>
              EF Core Bench Lab
            </div>
            <div style={{ fontSize: 28, color: theme.text.muted, marginTop: 12, whiteSpace: "nowrap" }}>
              by JK
            </div>
          </div>

          <div style={{ fontSize: 32, color: theme.text.secondary, lineHeight: 1.5, maxWidth: 600 }}>
            Test, compare, and optimize your EF Core queries with real-time insights<span style={{ color: theme.text.muted, opacity: 0.5 }}>*</span>
          </div>
          <div style={{ fontSize: 14, color: theme.text.muted, opacity: 0.6, marginTop: -20 }}>
            * probably but if it doesn&apos;t you can make it so! 😉
          </div>

          {/* Feature Pills */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {["Open Source", "MIT License", ".NET 10", "EF Core 10"].map((tag) => (
              <div
                key={tag}
                style={{
                  background: `${theme.accent.primary}20`,
                  border: `2px solid ${theme.accent.primary}40`,
                  borderRadius: 24,
                  padding: "10px 24px",
                  fontSize: 20,
                  fontWeight: 500,
                  color: theme.accent.primary,
                  whiteSpace: "nowrap",
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        </div>

        {/* Right - QR Code Card */}
        <div
          style={{
            background: theme.card.background,
            borderRadius: 32,
            padding: 48,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 28,
            boxShadow: "0 12px 48px rgba(0,0,0,0.2)",
          }}
        >
          {/* Scan Me Badge */}
          <div
            style={{
              background: `linear-gradient(135deg, ${theme.accent.primary}, ${theme.accent.purple})`,
              borderRadius: 16,
              padding: "12px 32px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 28 }}>📱</span>
            <span style={{ fontSize: 26, fontWeight: 700, color: "white", whiteSpace: "nowrap" }}>Scan Me!</span>
          </div>

          {/* Large QR Code */}
          <div
            style={{
              background: "white",
              padding: 24,
              borderRadius: 24,
              boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
            }}
          >
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(GITHUB_REPO_URL)}&margin=0`}
              alt="GitHub QR"
              style={{ width: 360, height: 360, display: "block", minWidth: 360, minHeight: 360 }}
              crossOrigin="anonymous"
            />
          </div>

          {/* GitHub Link */}
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
              <span style={{ fontSize: 28 }}>⭐</span>
              <span style={{ fontSize: 28, fontWeight: 600, color: theme.text.primary, whiteSpace: "nowrap" }}>
                github.com/jernejk/efcore-bench-lab
              </span>
            </div>
            <div style={{ fontSize: 18, color: theme.text.muted, marginTop: 8, whiteSpace: "nowrap" }}>
              Star the repo if you find it useful!
            </div>
          </div>
        </div>
      </div>
    </SlideContainer>
  );
}

// Minimal slide - clean and simple
function MinimalSlide({ theme, hardware }: { theme: SlideTheme; hardware: SlideHardwareInfo }) {
  const coreDescription = hardware.performanceCores && hardware.efficiencyCores
    ? `${hardware.performanceCores}P + ${hardware.efficiencyCores}E cores`
    : `${hardware.totalCores} Cores`;

  return (
    <SlideContainer title="Testing Setup" theme={theme}>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 60,
        }}
      >
        {/* Framework */}
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <div
            style={{
              width: 8,
              height: 80,
              background: theme.accent.primary,
              borderRadius: 4,
            }}
          />
          <div>
            <div style={{ fontSize: 28, color: theme.text.muted }}>Framework</div>
            <div style={{ fontSize: 56, fontWeight: 700, color: theme.text.primary }}>
              {hardware.dotnetVersion} with EF Core
            </div>
          </div>
        </div>

        {/* Hardware */}
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <div
            style={{
              width: 8,
              height: 80,
              background: theme.accent.success,
              borderRadius: 4,
            }}
          />
          <div>
            <div style={{ fontSize: 28, color: theme.text.muted }}>Hardware</div>
            <div style={{ fontSize: 56, fontWeight: 700, color: theme.text.primary }}>
              {hardware.cpuBrand}
            </div>
            <div style={{ fontSize: 32, color: theme.text.secondary }}>
              {coreDescription} • {hardware.memoryGB ? `${hardware.memoryGB}GB RAM` : hardware.architecture}{hardware.gpuCores ? ` • ${hardware.gpuCores} GPU cores` : ""}
            </div>
          </div>
        </div>

        {/* Tools */}
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <div
            style={{
              width: 8,
              height: 80,
              background: theme.accent.purple,
              borderRadius: 4,
            }}
          />
          <div>
            <div style={{ fontSize: 28, color: theme.text.muted }}>Benchmark Tools</div>
            <div style={{ fontSize: 56, fontWeight: 700, color: theme.text.primary }}>
              EF Core Bench Lab
            </div>
          </div>
        </div>
      </div>
    </SlideContainer>
  );
}

// VS Bombardier comparison slide
function VsBombardierSlide({ theme }: { theme: SlideTheme }) {
  const features = [
    { feature: "HTTP Load Testing", bombardier: true, benchLab: true },
    { feature: "Concurrent Requests", bombardier: true, benchLab: true },
    { feature: "Latency Percentiles (P50/P95/P99)", bombardier: true, benchLab: true },
    { feature: "Requests/Second Metrics", bombardier: true, benchLab: true },
    { feature: "EF Core Scenario Presets", bombardier: false, benchLab: true },
    { feature: "Visual Comparison Charts", bombardier: false, benchLab: true },
    { feature: "SQL Query Capture", bombardier: false, benchLab: true },
    { feature: "Execution Plan Analysis", bombardier: false, benchLab: true },
    { feature: "AI-Powered Insights", bombardier: false, benchLab: true },
    { feature: "Export to Presentation Slides", bombardier: false, benchLab: true },
    { feature: "Save & Compare Runs", bombardier: false, benchLab: true },
  ];

  return (
    <SlideContainer
      title="EF Core Bench Lab vs Bombardier"
      subtitle="Load testing built for Entity Framework developers"
      theme={theme}
    >
      <div style={{ display: "flex", gap: 40, flex: 1 }}>
        {/* Comparison Table */}
        <div style={{ flex: 1.3 }}>
          <div
            style={{
              background: theme.card.background,
              borderRadius: 20,
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 140px 140px",
                padding: "20px 28px",
                background: `${theme.accent.primary}20`,
                borderBottom: `2px solid ${theme.card.border}`,
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 700, color: theme.text.primary }}>Feature</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#f97316", textAlign: "center" }}>💣 Bombardier</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: theme.accent.primary, textAlign: "center" }}>🔬 Bench Lab</div>
            </div>
            {/* Rows */}
            {features.map((row, i) => (
              <div
                key={row.feature}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 140px 140px",
                  padding: "16px 28px",
                  background: i % 2 === 0 ? "transparent" : `${theme.accent.primary}05`,
                  borderBottom: i < features.length - 1 ? `1px solid ${theme.card.border}` : "none",
                }}
              >
                <div style={{ fontSize: 20, color: theme.text.primary }}>{row.feature}</div>
                <div style={{ textAlign: "center", fontSize: 28 }}>
                  {row.bombardier ? "✅" : "❌"}
                </div>
                <div style={{ textAlign: "center", fontSize: 28 }}>
                  {row.benchLab ? "✅" : "❌"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right side - Summary */}
        <div style={{ flex: 0.7, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Bombardier card */}
          <div
            style={{
              background: "#f9731915",
              border: "2px solid #f9731940",
              borderRadius: 20,
              padding: 28,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <span style={{ fontSize: 48 }}>💣</span>
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#f97316" }}>Bombardier</div>
                <div style={{ fontSize: 18, color: theme.text.muted }}>CLI load testing tool</div>
              </div>
            </div>
            <div style={{ fontSize: 18, color: theme.text.secondary, lineHeight: 1.5 }}>
              Great for raw HTTP load testing, but requires manual setup and lacks EF Core-specific insights.
            </div>
          </div>

          {/* Bench Lab card */}
          <div
            style={{
              background: `${theme.accent.primary}15`,
              border: `2px solid ${theme.accent.primary}40`,
              borderRadius: 20,
              padding: 28,
              flex: 1,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <span style={{ fontSize: 48 }}>🔬</span>
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, color: theme.accent.primary }}>EF Core Bench Lab</div>
                <div style={{ fontSize: 18, color: theme.text.muted }}>Purpose-built for EF Core</div>
              </div>
            </div>
            <div style={{ fontSize: 18, color: theme.text.secondary, lineHeight: 1.5, marginBottom: 20 }}>
              All of Bombardier's load testing capabilities plus:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                "Pre-configured EF Core scenarios",
                "Query & execution plan capture",
                "Visual charts & AI insights",
                "One-click presentation export",
              ].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      background: theme.accent.success,
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      color: "white",
                    }}
                  >
                    ✓
                  </div>
                  <span style={{ fontSize: 18, color: theme.text.primary }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SlideContainer>
  );
}

// VS BenchmarkDotNet comparison slide
function VsBenchmarkDotNetSlide({ theme }: { theme: SlideTheme }) {
  const features = [
    { feature: "Precise Time Measurements", bdn: true, benchLab: true },
    { feature: "Memory Tracking", bdn: true, benchLab: true },
    { feature: "Multiple Iterations", bdn: true, benchLab: true },
    { feature: "Warmup Phase", bdn: true, benchLab: true },
    { feature: "No Code Changes Required", bdn: false, benchLab: true },
    { feature: "Real HTTP Endpoint Testing", bdn: false, benchLab: true },
    { feature: "Interactive Web UI", bdn: false, benchLab: true },
    { feature: "Live SQL Query Viewer", bdn: false, benchLab: true },
    { feature: "Side-by-Side Variant Comparison", bdn: false, benchLab: true },
    { feature: "AI Optimization Suggestions", bdn: false, benchLab: true },
    { feature: "Presentation Slide Export", bdn: false, benchLab: true },
  ];

  return (
    <SlideContainer
      title="EF Core Bench Lab vs BenchmarkDotNet"
      subtitle="From code-level microbenchmarks to end-to-end testing"
      theme={theme}
    >
      <div style={{ display: "flex", gap: 40, flex: 1 }}>
        {/* Comparison Table */}
        <div style={{ flex: 1.3 }}>
          <div
            style={{
              background: theme.card.background,
              borderRadius: 20,
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 160px 140px",
                padding: "20px 28px",
                background: `${theme.accent.purple}20`,
                borderBottom: `2px solid ${theme.card.border}`,
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 700, color: theme.text.primary }}>Feature</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: theme.accent.purple, textAlign: "center" }}>🐌 BenchmarkDotNet</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: theme.accent.primary, textAlign: "center" }}>🔬 Bench Lab</div>
            </div>
            {/* Rows */}
            {features.map((row, i) => (
              <div
                key={row.feature}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 160px 140px",
                  padding: "16px 28px",
                  background: i % 2 === 0 ? "transparent" : `${theme.accent.purple}05`,
                  borderBottom: i < features.length - 1 ? `1px solid ${theme.card.border}` : "none",
                }}
              >
                <div style={{ fontSize: 20, color: theme.text.primary }}>{row.feature}</div>
                <div style={{ textAlign: "center", fontSize: 28 }}>
                  {row.bdn ? "✅" : "❌"}
                </div>
                <div style={{ textAlign: "center", fontSize: 28 }}>
                  {row.benchLab ? "✅" : "❌"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right side - Summary */}
        <div style={{ flex: 0.7, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* BenchmarkDotNet card */}
          <div
            style={{
              background: `${theme.accent.purple}15`,
              border: `2px solid ${theme.accent.purple}40`,
              borderRadius: 20,
              padding: 28,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <span style={{ fontSize: 48 }}>🐌</span>
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, color: theme.accent.purple }}>BenchmarkDotNet</div>
                <div style={{ fontSize: 18, color: theme.text.muted }}>Microbenchmark library</div>
              </div>
            </div>
            <div style={{ fontSize: 18, color: theme.text.secondary, lineHeight: 1.5 }}>
              Industry standard for precise .NET benchmarks, but requires code changes and runs in isolation.
            </div>
          </div>

          {/* Bench Lab card */}
          <div
            style={{
              background: `${theme.accent.primary}15`,
              border: `2px solid ${theme.accent.primary}40`,
              borderRadius: 20,
              padding: 28,
              flex: 1,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <span style={{ fontSize: 48 }}>🔬</span>
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, color: theme.accent.primary }}>EF Core Bench Lab</div>
                <div style={{ fontSize: 18, color: theme.text.muted }}>Zero-config benchmarking</div>
              </div>
            </div>
            <div style={{ fontSize: 18, color: theme.text.secondary, lineHeight: 1.5, marginBottom: 20 }}>
              Test real endpoints without modifying code:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                "Point at any API endpoint",
                "See actual SQL queries generated",
                "Compare variants side-by-side",
                "Get AI-powered fix suggestions",
              ].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      background: theme.accent.success,
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      color: "white",
                    }}
                  >
                    ✓
                  </div>
                  <span style={{ fontSize: 18, color: theme.text.primary }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tagline */}
          <div
            style={{
              background: `linear-gradient(135deg, ${theme.accent.success}20, ${theme.accent.primary}20)`,
              border: `2px solid ${theme.accent.success}40`,
              borderRadius: 16,
              padding: "20px 24px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, color: theme.accent.success }}>
              🎯 Best of both worlds
            </div>
            <div style={{ fontSize: 18, color: theme.text.muted, marginTop: 8 }}>
              Statistical rigor + Real-world testing
            </div>
          </div>
        </div>
      </div>
    </SlideContainer>
  );
}
