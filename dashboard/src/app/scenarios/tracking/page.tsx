"use client";

import { ScenarioRunner } from "@/components/scenario-runner";
import { RefreshCw } from "lucide-react";

const variants = [
  {
    id: "tracked",
    name: "With Tracking (Default)",
    description: "EF creates snapshots for change detection - unnecessary for read-only",
    isBad: true,
  },
  {
    id: "no-tracking",
    name: "AsNoTracking",
    description: "Skips change tracking - faster and less memory",
    isGood: true,
  },
  {
    id: "projection",
    name: "Direct Projection",
    description: "Projects to DTO - no entity objects created",
    isGood: true,
  },
  {
    id: "tracked-with-relations",
    name: "Tracked with Include",
    description: "Tracking overhead multiplied with related data",
    isBad: true,
  },
  {
    id: "notracking-with-relations",
    name: "NoTracking with Include",
    description: "AsNoTracking with related data - significant improvement",
    isGood: false,
  },
  {
    id: "projection-with-aggregates",
    name: "Projection with Aggregates",
    description: "SQL aggregates in projection - best for reporting",
    isGood: true,
  },
];

export default function TrackingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <RefreshCw className="h-8 w-8" />
          Tracking Overhead
        </h1>
        <p className="text-muted-foreground mt-2">
          By default, EF Core tracks all entities for change detection. For read-only
          queries (like dashboards, reports, APIs), this is unnecessary overhead.
          Use AsNoTracking or projections for better performance.
        </p>
      </div>

      <div className="bg-muted/50 border rounded-lg p-4">
        <h3 className="font-semibold mb-2">What to look for:</h3>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
          <li><strong>Memory:</strong> Tracking uses 2-3x more memory than NoTracking</li>
          <li><strong>Duration:</strong> Materialization is faster without tracking</li>
          <li><strong>Projection:</strong> Best of both - only fetches needed columns</li>
        </ul>
      </div>

      <ScenarioRunner
        scenario="tracking"
        variants={variants}
        defaultParams={{ take: 500 }}
      />
    </div>
  );
}

