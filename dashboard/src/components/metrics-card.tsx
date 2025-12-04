"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScenarioMetrics } from "@/lib/webapi-client";
import { Timer, Database, MemoryStick, Hash } from "lucide-react";
import { formatDuration, formatBytes } from "@/lib/format-utils";

interface MetricsCardProps {
  metrics: ScenarioMetrics;
  title?: string;
  className?: string;
}

export function MetricsCard({ metrics, title = "Metrics", className }: MetricsCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <MetricItem
            icon={Timer}
            label="Duration"
            value={formatDuration(metrics.durationMs)}
          />
          <MetricItem
            icon={Database}
            label="Queries"
            value={metrics.queryCount.toString()}
          />
          <MetricItem
            icon={Hash}
            label="Rows"
            value={metrics.rowsReturned.toLocaleString()}
          />
          <MetricItem
            icon={MemoryStick}
            label="Memory"
            value={formatBytes(metrics.memoryAllocatedBytes)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface MetricItemProps {
  icon: React.ElementType;
  label: string;
  value: string;
}

function MetricItem({ icon: Icon, label, value }: MetricItemProps) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </div>
    </div>
  );
}


