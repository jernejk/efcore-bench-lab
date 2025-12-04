"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { webApiClient } from "@/lib/webapi-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  Database,
  Server,
  Cpu,
  RefreshCw,
  AlertCircle,
  Presentation,
} from "lucide-react";
import Link from "next/link";
import { BenchmarkSlideGenerator } from "@/components/benchmark-slide-generator";
import type { BenchmarkRun } from "@/lib/benchmark-store";

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}m`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return num.toString();
}

export default function DashboardPage() {
  const [showSlideGenerator, setShowSlideGenerator] = useState(false);

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: () => webApiClient.health(),
    refetchInterval: 10000, // Check every 10 seconds
    retry: false,
  });

  const infoQuery = useQuery({
    queryKey: ["info"],
    queryFn: () => webApiClient.info(),
    enabled: healthQuery.isSuccess,
  });

  const dbStatsQuery = useQuery({
    queryKey: ["db-stats"],
    queryFn: () => webApiClient.dbStats(),
    enabled: healthQuery.isSuccess,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const isConnected = healthQuery.isSuccess;

  // Create a mock benchmark for dashboard stats slide
  const createDashboardStatsBenchmark = (): BenchmarkRun | null => {
    if (!infoQuery.isSuccess || !dbStatsQuery.isSuccess) return null;

    const tables = dbStatsQuery.data.tables;
    const totalRecords = tables.reduce((sum, table) => sum + table.rowCount, 0);

    return {
      id: "dashboard-stats",
      createdAt: new Date().toISOString(),
      name: "EF Core Bench Lab - System Overview",
      hardware: {
        os: infoQuery.data.os,
        cpu: "Apple M4 Max",
        memory: "64 GB",
        dotnetVersion: ".NET 10.0"
      },
      runs: [
        {
          endpoint: "dashboard-stats",
          variant: "system-overview",
          scenario: "Dashboard Statistics",
          config: {
            duration: "N/A",
            concurrency: 1,
            warmupRequests: 0
          },
          results: {
            totalRequests: totalRecords,
            requestsPerSecond: 0,
            latencyP50: 0,
            latencyP95: 0,
            latencyP99: 0,
            errors: 0,
            durationMs: 0,
            avgMemoryMB: infoQuery.data.workingSet / 1024 / 1024,
            // Store custom data in results for the slide
            customData: {
              database: dbStatsQuery.data.database,
              tables: tables.map(t => ({
                name: t.tableName,
                records: t.rowCount,
                friendlyCount: formatNumber(t.rowCount)
              })),
              totalRecords: totalRecords,
              friendlyTotal: formatNumber(totalRecords)
            }
          } as any
        }
      ]
    };
  };

  const dashboardBenchmark = createDashboardStatsBenchmark();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            EF Core Bench Lab - Swap components, test scenarios, benchmark performance
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              healthQuery.refetch();
              infoQuery.refetch();
              dbStatsQuery.refetch();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowSlideGenerator(true)}
            disabled={!dashboardBenchmark}
          >
            <Presentation className="mr-2 h-4 w-4" />
            Slide
          </Button>
        </div>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            WebAPI Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {healthQuery.isLoading ? (
              <Skeleton className="h-6 w-24" />
            ) : isConnected ? (
              <>
                <Badge variant="default" className="bg-green-600">
                  <Activity className="mr-1 h-3 w-3" />
                  Connected
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {healthQuery.data?.version}
                </span>
              </>
            ) : (
              <Badge variant="destructive">
                <AlertCircle className="mr-1 h-3 w-3" />
                Disconnected
              </Badge>
            )}
          </div>
          {healthQuery.isError && (
            <p className="mt-2 text-sm text-destructive">
              Unable to connect to WebAPI at http://localhost:5847
            </p>
          )}
        </CardContent>
      </Card>

      {/* Server Info */}
      {infoQuery.isSuccess && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Hardware</CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-sm font-semibold">Apple M4 Max</div>
              <div className="text-xs text-muted-foreground">
                {infoQuery.data.processorCount} cores
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Memory</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-sm font-semibold">64 GB</div>
              <div className="text-xs text-muted-foreground">
                {Math.round(infoQuery.data.workingSet / 1024 / 1024)} MB used
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Runtime</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-sm font-semibold truncate">
                {infoQuery.data.runtime}
              </div>
              <div className="text-xs text-muted-foreground">
                .NET 10.0
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">OS</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-sm font-semibold truncate">
                {infoQuery.data.os}
              </div>
              <div className="text-xs text-muted-foreground">
                {infoQuery.data.architecture}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Database Stats */}
      {dbStatsQuery.isSuccess && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              {dbStatsQuery.data.database}
            </CardTitle>
            <CardDescription>
              Microsoft SQL Server 2022 (Docker) - x64 architecture
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {dbStatsQuery.data.tables.map((table) => (
                <Card key={table.tableName} className="border-muted">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {table.tableName}
                    </CardTitle>
                    <Database className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">
                      {formatNumber(table.rowCount)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {table.columns.length} columns
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Start */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Start</CardTitle>
          <CardDescription>
            Explore common EF Core performance scenarios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Link href="/scenarios/nplusone">
              <Card className="cursor-pointer transition-colors hover:bg-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">N+1 Problem</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Compare lazy loading loops vs projections. See query count
                    drop from 101 to 1.
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/scenarios/pagination">
              <Card className="cursor-pointer transition-colors hover:bg-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Pagination</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Offset vs keyset pagination. Watch performance stay constant
                    vs degrade.
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/scenarios/tracking">
              <Card className="cursor-pointer transition-colors hover:bg-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Tracking Overhead</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    AsNoTracking vs tracked queries. See memory and speed
                    improvements.
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/scenarios/updates">
              <Card className="cursor-pointer transition-colors hover:bg-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Bulk Updates</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    ExecuteUpdate vs select-modify-save. Orders of magnitude
                    faster.
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/scenarios/cancellation">
              <Card className="cursor-pointer transition-colors hover:bg-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Cancellation Tokens</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Prevent DoS by properly cancelling queries when requests
                    abort.
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/scenarios/tolist">
              <Card className="cursor-pointer transition-colors hover:bg-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">ToList Trap</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    IQueryable vs IEnumerable. Client-side evaluation disaster.
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Slide Generator */}
      <BenchmarkSlideGenerator
        benchmark={dashboardBenchmark}
        open={showSlideGenerator}
        onOpenChange={setShowSlideGenerator}
      />
    </div>
  );
}
