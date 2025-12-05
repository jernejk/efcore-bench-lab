"use client";

import { ScenarioRunner } from "@/components/scenario-runner";
import { RefreshCw } from "lucide-react";

const variants = [
  {
    id: "with-tracking",
    name: "With Tracking",
    description: "EF Core tracks entities for change detection - uses more memory",
    isBad: true,
    queryGoal: "Count sales for a specific customer",
    queryBehavior: "Default behavior: EF Core tracks all loaded entities in memory for change detection. Uses more CPU and memory, especially with large result sets.",
  },
  {
    id: "no-tracking",
    name: "AsNoTracking",
    description: "AsNoTracking() disables change tracking - faster and less memory",
    isGood: true,
    queryGoal: "Count sales for a specific customer",
    queryBehavior: "OPTIMAL: AsNoTracking() tells EF Core not to track entities. Faster execution, lower memory usage for read-only queries.",
  },
];

export default function AsNoTrackingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <RefreshCw className="h-8 w-8" />
          AsNoTracking Performance
        </h1>
        <p className="text-muted-foreground mt-2">
          Demonstrates the performance impact of Entity Framework Core&apos;s change tracking.
          For read-only queries, AsNoTracking() can significantly improve performance.
        </p>
      </div>

      <div className="bg-muted/50 border rounded-lg p-4">
        <h3 className="font-semibold mb-2">What to look for:</h3>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
          <li><strong>Memory:</strong> With tracking uses more memory for change tracking</li>
          <li><strong>CPU:</strong> No tracking is faster due to less overhead</li>
          <li><strong>SQL:</strong> Same query generated, performance difference is in EF Core</li>
          <li><strong>Best Practice:</strong> Use AsNoTracking() for all read-only queries</li>
        </ul>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <h3 className="font-semibold mb-2 text-amber-800 dark:text-amber-200">💡 Tip</h3>
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Always use AsNoTracking() for read-only queries. It disables change tracking,
          resulting in better performance and lower memory usage. The only time you
          should NOT use AsNoTracking() is when you plan to modify the entities.
        </p>
      </div>

      <ScenarioRunner
        scenario="asnotracking"
        variants={variants}
        defaultParams={{ customerId: 7 }}
      />
    </div>
  );
}
