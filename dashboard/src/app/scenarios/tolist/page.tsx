"use client";

import { ScenarioRunner } from "@/components/scenario-runner";
import { ListX } from "lucide-react";

const variants = [
  {
    id: "tolist-before-filter",
    name: "ToList Before Filter",
    description: "Downloads ALL data then filters in C# - disaster!",
    isBad: true,
    queryGoal: "Count how many sales in 2024 had a price over $500. We need a single number, not any row data.",
    queryBehavior: "ANTI-PATTERN: Calls ToList() BEFORE applying the filter. Downloads entire Sales table to memory, then filters in C#. The database sends ALL rows.",
  },
  {
    id: "filter-before-tolist",
    name: "Filter Before ToList",
    description: "Filter in SQL, only download matching rows",
    isGood: true,
    queryGoal: "Count how many sales in 2024 had a price over $500. We need a single number, not any row data.",
    queryBehavior: "Applies WHERE clause before ToList(). Only matching rows are sent from database. Still loads rows into memory (not ideal for just counting).",
  },
  {
    id: "count-in-sql",
    name: "Count in SQL",
    description: "Use CountAsync - only transfers a number, not data",
    isGood: true,
    queryGoal: "Count how many sales in 2024 had a price over $500. We need a single number, not any row data.",
    queryBehavior: "Uses CountAsync() which translates to SQL COUNT(*). Database returns a single integer. No row data transferred at all.",
  },
  {
    id: "ienumerable-trap",
    name: "IEnumerable Trap",
    description: "Method returns IEnumerable - forces client-side evaluation",
    isBad: true,
    queryGoal: "Count how many sales in 2024 had a price over $500. We need a single number, not any row data.",
    queryBehavior: "ANTI-PATTERN: Method signature returns IEnumerable<T> instead of IQueryable<T>. This breaks query composition - subsequent filters run in C#, not SQL.",
  },
  {
    id: "iqueryable-correct",
    name: "IQueryable Correct",
    description: "Method returns IQueryable - filter stays in SQL",
    isGood: true,
    queryGoal: "Count how many sales in 2024 had a price over $500. We need a single number, not any row data.",
    queryBehavior: "Method returns IQueryable<T>. All filters compose into a single SQL query with proper WHERE clause. Count happens in database.",
  },
  {
    id: "aggregates-in-sql",
    name: "Aggregates in SQL",
    description: "Sum/Count in SQL - minimal data transfer",
    isGood: true,
    queryGoal: "Get sales statistics (count and total revenue) for 2024. We need aggregated numbers, not individual rows.",
    queryBehavior: "Uses LINQ aggregates (Sum, Count) that translate to SQL. Database computes and returns only the aggregated values.",
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

