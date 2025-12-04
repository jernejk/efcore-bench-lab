"use client";

import { ScenarioRunner } from "@/components/scenario-runner";
import { Layers } from "lucide-react";

const variants = [
  {
    id: "explicit-loop",
    name: "Explicit Loop",
    description: "Fetches customers, then loops to get sales - N+1 queries",
    isBad: true,
  },
  {
    id: "eager-loading",
    name: "Eager Loading (Include)",
    description: "Uses Include to eager load sales - single query but loads all columns",
    isBad: false,
  },
  {
    id: "projection",
    name: "Projection (Select)",
    description: "Projects to DTO with SQL aggregates - optimized single query",
    isGood: true,
  },
  {
    id: "projection-notracking",
    name: "Projection + NoTracking",
    description: "Best performance - projection with AsNoTracking",
    isGood: true,
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

