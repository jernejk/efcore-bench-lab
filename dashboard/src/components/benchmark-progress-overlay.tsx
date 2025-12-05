"use client";

import { useEffect, useState } from "react";
import { Loader2, Clock, CheckCircle2, Circle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export interface BenchmarkProgress {
  isRunning: boolean;
  currentVariant: string;
  currentVariantIndex: number;
  totalVariants: number;
  variantStartTime: number;
  benchmarkStartTime: number;
  completedVariants: string[];
  pendingVariants: string[];
  duration: string;
  isWarmingUp?: boolean;
}

interface BenchmarkProgressOverlayProps {
  progress: BenchmarkProgress | null;
}

export function BenchmarkProgressOverlay({ progress }: BenchmarkProgressOverlayProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [variantElapsed, setVariantElapsed] = useState(0);

  useEffect(() => {
    if (!progress?.isRunning) return;

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - progress.benchmarkStartTime);
      // Only track elapsed time for the actual benchmark, not warmup
      if (!progress.isWarmingUp) {
        setVariantElapsed(Date.now() - progress.variantStartTime);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [progress?.isRunning, progress?.benchmarkStartTime, progress?.variantStartTime, progress?.isWarmingUp]);

  // Reset variant elapsed when warmup starts
  useEffect(() => {
    if (progress?.isWarmingUp) {
      setVariantElapsed(0);
    }
  }, [progress?.isWarmingUp, progress?.currentVariant]);

  if (!progress?.isRunning) return null;

  const durationMs = parseDuration(progress.duration);
  // During warmup, show 0% progress for current variant
  const variantProgress = progress.isWarmingUp ? 0 : Math.min((variantElapsed / durationMs) * 100, 100);
  const overallProgress = ((progress.currentVariantIndex + variantProgress / 100) / progress.totalVariants) * 100;

  // Estimate remaining time - freeze during warmup
  const avgTimePerVariant = progress.currentVariantIndex > 0 
    ? (Date.now() - progress.benchmarkStartTime) / progress.currentVariantIndex
    : durationMs + 2000; // Add ~2s for warmup/overhead
  const remainingVariants = progress.totalVariants - progress.currentVariantIndex - (progress.isWarmingUp ? 0 : variantProgress / 100);
  const estimatedRemainingMs = progress.isWarmingUp 
    ? remainingVariants * avgTimePerVariant + durationMs // Include current variant's full duration during warmup
    : remainingVariants * avgTimePerVariant;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card border rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center gap-3 mb-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Running Benchmark</h2>
            {progress.isWarmingUp && (
              <p className="text-sm text-amber-500 font-medium">Warming up...</p>
            )}
          </div>
        </div>

        {/* Overall Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-mono">{Math.round(overallProgress)}%</span>
          </div>
          <Progress value={overallProgress} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Elapsed: {formatDuration(elapsedTime)}</span>
            <span>Remaining: ~{formatDuration(estimatedRemainingMs)}</span>
          </div>
        </div>

        {/* Current Variant */}
        <div className={`mb-6 p-3 rounded-md ${progress.isWarmingUp ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-muted/50'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              {progress.isWarmingUp ? 'Warming up: ' : 'Testing: '}
              <code className={`px-1.5 py-0.5 rounded ${progress.isWarmingUp ? 'bg-amber-500/20 text-amber-600' : 'bg-primary/10 text-primary'}`}>{progress.currentVariant}</code>
            </span>
            <span className="text-xs text-muted-foreground">
              {progress.currentVariantIndex + 1} of {progress.totalVariants}
            </span>
          </div>
          <Progress value={variantProgress} className={`h-2 ${progress.isWarmingUp ? '[&>div]:bg-amber-500' : ''}`} />
          <div className="text-xs text-muted-foreground mt-1">
            {progress.isWarmingUp ? (
              <span className="text-amber-600">Preparing endpoint...</span>
            ) : (
              <>{formatDuration(variantElapsed)} / {progress.duration}</>
            )}
          </div>
        </div>

        {/* Variant List */}
        <div className="space-y-2">
          <span className="text-sm font-medium">Variants</span>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {progress.completedVariants.map((v) => (
              <div key={v} className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="truncate">{v}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="truncate font-medium">{progress.currentVariant}</span>
            </div>
            {progress.pendingVariants.map((v) => (
              <div key={v} className="flex items-center gap-2 text-muted-foreground">
                <Circle className="h-4 w-4" />
                <span className="truncate">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 pt-4 border-t grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-primary">
              {progress.completedVariants.length}
            </div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-500">1</div>
            <div className="text-xs text-muted-foreground">Running</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-muted-foreground">
              {progress.pendingVariants.length}
            </div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h)$/);
  if (!match) return 10000;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case "s": return value * 1000;
    case "m": return value * 60 * 1000;
    case "h": return value * 60 * 60 * 1000;
    default: return value * 1000;
  }
}

function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

