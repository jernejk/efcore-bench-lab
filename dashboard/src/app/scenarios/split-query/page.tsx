"use client";

import { ScenarioRunner } from "@/components/scenario-runner";
import { Split } from "lucide-react";

const variants = [
  {
    id: "cartesian-explosion",
    name: "Cartesian Explosion",
    description: "Single query creates massive result set - inefficient",
    isBad: true,
    queryGoal: "Get employee stats with all their sales data",
    queryBehavior: "ANTI-PATTERN: Single query with JOINs creates cartesian explosion. Employee data is repeated for each sale, resulting in massive result sets.",
  },
  {
    id: "split-query",
    name: "AsSplitQuery",
    description: "Separate queries avoid cartesian explosion - efficient",
    isGood: true,
    queryGoal: "Get employee stats with all their sales data",
    queryBehavior: "OPTIMAL: AsSplitQuery() executes separate queries - one for employee data, one for sales. Avoids cartesian explosion while maintaining data integrity.",
  },
];

export default function SplitQueryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Split className="h-8 w-8" />
          Split Query Performance
        </h1>
        <p className="text-muted-foreground mt-2">
          Demonstrates when to use AsSplitQuery() to avoid cartesian explosion.
          Cartesian explosion occurs when JOINs create massive result sets with repeated data.
        </p>
      </div>

      <div className="bg-muted/50 border rounded-lg p-4">
        <h3 className="font-semibold mb-2">What to look for:</h3>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
          <li><strong>SQL:</strong> Cartesian shows one massive query, SplitQuery shows multiple targeted queries</li>
          <li><strong>Result Size:</strong> Cartesian explosion duplicates data massively, SplitQuery is efficient</li>
          <li><strong>Performance:</strong> SplitQuery avoids transferring redundant data</li>
          <li><strong>Memory:</strong> SplitQuery uses less memory by avoiding data duplication</li>
        </ul>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <h3 className="font-semibold mb-2 text-amber-800 dark:text-amber-200">💡 Tip</h3>
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Use AsSplitQuery() when you have collection includes that would cause
          cartesian explosion. It's especially useful when entities have many
          related records. EF Core will execute separate queries instead of one
          massive JOIN.
        </p>
      </div>

      <ScenarioRunner
        scenario="split-query"
        variants={variants}
        defaultParams={{ employeeId: 1 }}
      />
    </div>
  );
}
