"use client";

import { ScenarioRunner } from "@/components/scenario-runner";
import { RefreshCw } from "lucide-react";

const variants = [
  {
    id: "tracked",
    name: "With Tracking (Default)",
    description: "EF creates snapshots for change detection - unnecessary for read-only",
    isBad: true,
    queryGoal: "Display 500 recent sales in a read-only dashboard/report. We will NOT modify these entities.",
    queryBehavior: "Uses default EF tracking. Creates entity snapshots for change detection even though we'll never call SaveChanges. Wastes memory and CPU.",
  },
  {
    id: "no-tracking",
    name: "AsNoTracking",
    description: "Skips change tracking - faster and less memory",
    isGood: true,
    queryGoal: "Display 500 recent sales in a read-only dashboard/report. We will NOT modify these entities.",
    queryBehavior: "Uses AsNoTracking(). EF skips creating snapshots since we declared this is read-only. Same data, less overhead.",
  },
  {
    id: "projection",
    name: "Direct Projection",
    description: "Projects to DTO - no entity objects created",
    isGood: true,
    queryGoal: "Display 500 recent sales in a read-only dashboard/report. We will NOT modify these entities.",
    queryBehavior: "Projects directly to a DTO using Select(). No entity objects created, only the columns we need are fetched. Best for display scenarios.",
  },
  {
    id: "tracked-with-relations",
    name: "Tracked with Include",
    description: "Tracking overhead multiplied with related data",
    isBad: true,
    queryGoal: "Display 500 recent sales with customer names in a read-only dashboard. We need related data but won't modify anything.",
    queryBehavior: "Uses Include() with default tracking. Now we're tracking BOTH Sales entities AND Customer entities. Overhead multiplies with each relation.",
  },
  {
    id: "notracking-with-relations",
    name: "NoTracking with Include",
    description: "AsNoTracking with related data - significant improvement",
    isGood: false,
    queryGoal: "Display 500 recent sales with customer names in a read-only dashboard. We need related data but won't modify anything.",
    queryBehavior: "Uses Include() with AsNoTracking(). Loads related entities without tracking overhead. Better, but still fetches all columns.",
  },
  {
    id: "projection-with-aggregates",
    name: "Projection with Aggregates",
    description: "SQL aggregates in projection - best for reporting",
    isGood: true,
    queryGoal: "Show sales summary by category with totals. We need aggregated data for a report, not individual rows.",
    queryBehavior: "Uses GroupBy and aggregate functions (Sum, Count) that run in SQL. Returns only computed values, minimal data transfer.",
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

