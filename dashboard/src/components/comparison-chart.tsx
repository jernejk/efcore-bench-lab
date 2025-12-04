"use client";

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScenarioMetrics } from "@/lib/webapi-client";

interface ComparisonData {
  variant: string;
  description?: string;
  metrics: ScenarioMetrics;
}

interface ComparisonChartProps {
  data: ComparisonData[];
  title?: string;
  metric?: "durationMs" | "queryCount" | "memoryAllocatedBytes";
}

export function ComparisonChart({
  data,
  title = "Performance Comparison",
  metric = "durationMs",
}: ComparisonChartProps) {
  const chartData = data.map((d) => ({
    name: d.variant,
    duration: d.metrics.durationMs,
    queries: d.metrics.queryCount,
    memory: d.metrics.memoryAllocatedBytes / 1024, // KB
    rows: d.metrics.rowsReturned,
  }));

  const metricConfig = {
    durationMs: {
      dataKey: "duration",
      label: "Duration (ms)",
      color: "#3b82f6",
    },
    queryCount: {
      dataKey: "queries",
      label: "Query Count",
      color: "#10b981",
    },
    memoryAllocatedBytes: {
      dataKey: "memory",
      label: "Memory (KB)",
      color: "#f59e0b",
    },
  };

  const config = metricConfig[metric];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
            />
            <Legend />
            <Bar
              dataKey={config.dataKey}
              name={config.label}
              fill={config.color}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function MultiMetricChart({ data }: { data: ComparisonData[] }) {
  const chartData = data.map((d) => ({
    name: d.variant,
    duration: d.metrics.durationMs,
    queries: d.metrics.queryCount,
    memory: Math.round(d.metrics.memoryAllocatedBytes / 1024),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">All Metrics Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
            />
            <Legend />
            <Bar dataKey="duration" name="Duration (ms)" fill="#3b82f6" />
            <Bar dataKey="queries" name="Queries" fill="#10b981" />
            <Bar dataKey="memory" name="Memory (KB)" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

