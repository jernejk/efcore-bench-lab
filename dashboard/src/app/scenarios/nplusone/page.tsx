"use client";

import { ScenarioRunner } from "@/components/scenario-runner";
import { Layers } from "lucide-react";

const variants = [
  {
    id: "explicit-loop",
    name: "Explicit Loop",
    description: "Fetches customers, then loops to get sales - N+1 queries",
    isBad: true,
    queryGoal: "Get the top 50 customers with their total sales amount. We need customer info + one aggregated number per customer.",
    queryBehavior: "ANTI-PATTERN: First fetches 50 customers (1 query), then issues a separate query for each customer's sales (50 queries). Total: 51 database roundtrips.",
  },
  {
    id: "eager-loading",
    name: "Eager Loading (Include)",
    description: "Uses Include to eager load sales - single query but loads all columns",
    isBad: false,
    queryGoal: "Get the top 50 customers with their total sales amount. We need customer info + one aggregated number per customer.",
    queryBehavior: "Uses Include() to eager load all sales in a single JOIN query. Better than N+1, but loads ALL sales rows into memory just to compute a sum.",
  },
  {
    id: "projection",
    name: "Projection (Select)",
    description: "Projects to DTO with SQL aggregates - optimized single query",
    isGood: true,
    queryGoal: "Get the top 50 customers with their total sales amount. We need customer info + one aggregated number per customer.",
    queryBehavior: "Projects to DTO with SQL SUM(). The database computes the aggregate - we only transfer the final number, not raw sales rows.",
  },
  {
    id: "projection-notracking",
    name: "Projection + NoTracking",
    description: "Best performance - projection with AsNoTracking",
    isGood: true,
    queryGoal: "Get the top 50 customers with their total sales amount. We need customer info + one aggregated number per customer.",
    queryBehavior: "Same as Projection but with AsNoTracking. Since we're projecting to DTOs (not entities), EF skips change tracking entirely. Maximum efficiency.",
  },
];

export default function NPlusOnePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Layers className="h-8 w-8" />
          N+1 Query Problem
        </h1>
        <p className="text-muted-foreground mt-2">
          The N+1 query problem occurs when you fetch a list of entities and then
          make additional queries for each entity&apos;s related data. This results
          in 1 + N database roundtrips instead of 1 or 2.
        </p>
      </div>

      <div className="bg-muted/50 border rounded-lg p-4">
        <h3 className="font-semibold mb-2">What to look for:</h3>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
          <li><strong>Query Count:</strong> Explicit loop shows 50+ queries, projection shows 1</li>
          <li><strong>Duration:</strong> Order of magnitude difference (2000ms vs 50ms)</li>
          <li><strong>Memory:</strong> Projection uses significantly less memory</li>
        </ul>
      </div>

      <ScenarioRunner
        scenario="nplusone"
        variants={variants}
        defaultParams={{ take: 50 }}
      />
    </div>
  );
}

