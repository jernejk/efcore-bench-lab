"use client";

import { ScenarioRunner } from "@/components/scenario-runner";
import { ListX } from "lucide-react";

const variants = [
  {
    id: "tolist-before-filter",
    name: "ToList Before Filter",
    description: "Downloads ALL data then filters in C# - disaster!",
    isBad: true,
  },
  {
    id: "filter-before-tolist",
    name: "Filter Before ToList",
    description: "Filter in SQL, only download matching rows",
    isGood: true,
  },
  {
    id: "count-in-sql",
    name: "Count in SQL",
    description: "Use CountAsync - only transfers a number, not data",
    isGood: true,
  },
  {
    id: "ienumerable-trap",
    name: "IEnumerable Trap",
    description: "Method returns IEnumerable - forces client-side evaluation",
    isBad: true,
  },
  {
    id: "iqueryable-correct",
    name: "IQueryable Correct",
    description: "Method returns IQueryable - filter stays in SQL",
    isGood: true,
  },
  {
    id: "aggregates-in-sql",
    name: "Aggregates in SQL",
    description: "Sum/Count in SQL - minimal data transfer",
    isGood: true,
  },
];

export default function ToListPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ListX className="h-8 w-8" />
          ToList / IEnumerable Trap
        </h1>
        <p className="text-muted-foreground mt-2">
          Calling ToList() too early or returning IEnumerable instead of IQueryable
          forces all subsequent operations to happen in C# memory instead of SQL.
          This can download millions of rows when you only need a count!
        </p>
      </div>

      <div className="bg-muted/50 border rounded-lg p-4">
        <h3 className="font-semibold mb-2">What to look for:</h3>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
          <li><strong>SQL:</strong> Bad cases show SELECT * without WHERE clause</li>
          <li><strong>Rows:</strong> Bad cases return all rows, good cases return filtered count</li>
          <li><strong>Memory:</strong> Huge difference - loading all vs loading needed</li>
        </ul>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <h3 className="font-semibold mb-2 text-amber-800 dark:text-amber-200">💡 Tip</h3>
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Always keep your query as IQueryable for as long as possible. Only call
          ToList/ToArray/First when you&apos;re ready to execute. Method signatures
          should return IQueryable&lt;T&gt;, not IEnumerable&lt;T&gt;.
        </p>
      </div>

      <ScenarioRunner
        scenario="tolist"
        variants={variants}
        defaultParams={{ minPrice: 500, year: 2024 }}
      />
    </div>
  );
}

