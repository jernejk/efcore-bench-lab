"use client";

import { ScenarioRunner } from "@/components/scenario-runner";
import { Layers } from "lucide-react";

const variants = [
  {
    id: "with-include-no-select",
    name: "Include + Select in Memory",
    description: "Include loads full entities, then maps in C# - inefficient",
    isBad: true,
    queryGoal: "Get sales data with salesperson names for a specific salesperson",
    queryBehavior: "ANTI-PATTERN: Include() loads full SalesPerson entities, then Select() maps to DTO in memory. Transfers more data than needed.",
  },
  {
    id: "without-include-with-mapping",
    name: "Select Projection in SQL",
    description: "Select projects directly in SQL - only transfers needed data",
    isGood: true,
    queryGoal: "Get sales data with salesperson names for a specific salesperson",
    queryBehavior: "OPTIMAL: Select() projection happens in SQL. Only the required columns are transferred. No Include needed.",
  },
];

export default function ImplicitIncludePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Layers className="h-8 w-8" />
          Include vs Select Projection
        </h1>
        <p className="text-muted-foreground mt-2">
          Demonstrates the difference between Include (loads full entities) and Select projection (only needed data).
          Select projection is more efficient as it only transfers the data you actually need.
        </p>
      </div>

      <div className="bg-muted/50 border rounded-lg p-4">
        <h3 className="font-semibold mb-2">What to look for:</h3>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
          <li><strong>SQL:</strong> Include shows JOINs, Select shows only needed columns</li>
          <li><strong>Network:</strong> Include transfers full entity data, Select transfers only needed fields</li>
          <li><strong>Memory:</strong> Include loads full entities, Select creates lean DTOs</li>
          <li><strong>Performance:</strong> Select is generally faster and uses less resources</li>
        </ul>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <h3 className="font-semibold mb-2 text-amber-800 dark:text-amber-200">💡 Tip</h3>
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Prefer Select() projections over Include() when you don&apos;t need the full entity.
          Select allows you to shape exactly the data you need, reducing network traffic
          and memory usage. Use Include() only when you need to access navigation properties
          after the query is executed.
        </p>
      </div>

      <ScenarioRunner
        scenario="implicit-include"
        variants={variants}
        defaultParams={{ salesPersonId: 1 }}
      />
    </div>
  );
}
