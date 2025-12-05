"use client";

import { ScenarioRunner } from "@/components/scenario-runner";
import { Database } from "lucide-react";

const variants = [
  {
    id: "naive-count",
    name: "Naive Count (ToList().Count)",
    description: "Downloads ALL rows then counts in memory - DISASTER!",
    isBad: true,
    queryGoal: "Count how many sales records exist in the database",
    queryBehavior: "ANTI-PATTERN: Calls ToList() first, downloading entire Sales table, then counts in C#. The database sends ALL rows across the network.",
  },
  {
    id: "sql-count",
    name: "SQL Count (.Count())",
    description: "Executes COUNT(*) in SQL - only transfers a number",
    isGood: true,
    queryGoal: "Count how many sales records exist in the database",
    queryBehavior: "CORRECT: Uses Count() which translates to SQL COUNT(*). Database returns a single integer. No row data transferred at all.",
  },
];

export default function IQueryableVsIEnumerablePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Database className="h-8 w-8" />
          IQueryable vs IEnumerable
        </h1>
        <p className="text-muted-foreground mt-2">
          The critical difference between IQueryable (builds SQL) and IEnumerable (client-side evaluation).
          Calling ToList() too early forces all subsequent operations to happen in C# memory instead of SQL.
        </p>
      </div>

      <div className="bg-muted/50 border rounded-lg p-4">
        <h3 className="font-semibold mb-2">What to look for:</h3>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
          <li><strong>SQL:</strong> Bad case shows SELECT * FROM Sales, good case shows SELECT COUNT(*)</li>
          <li><strong>Rows:</strong> Bad case returns all rows, good case returns 1 (the count)</li>
          <li><strong>Memory:</strong> Bad case loads entire table, good case uses minimal memory</li>
          <li><strong>Network:</strong> Bad case transfers millions of rows, good case transfers 1 number</li>
        </ul>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <h3 className="font-semibold mb-2 text-amber-800 dark:text-amber-200">💡 Tip</h3>
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Always keep your query as IQueryable&lt;T&gt; for as long as possible. Only call
          ToList/ToArray/First when you&apos;re ready to execute and need the actual data.
          Method signatures should return IQueryable&lt;T&gt;, not IEnumerable&lt;T&gt;.
        </p>
      </div>

      <ScenarioRunner
        scenario="iqueryable-vs-ienumerable"
        variants={variants}
        defaultParams={{}}
      />
    </div>
  );
}
