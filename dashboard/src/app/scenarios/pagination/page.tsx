"use client";

import { ScenarioRunner } from "@/components/scenario-runner";
import { ChevronLeft } from "lucide-react";

const variants = [
  {
    id: "naive-pagination",
    name: "Naive Pagination",
    description: "Load ALL data, then paginate in memory - DISASTER!",
    isBad: true,
    queryGoal: "Get paginated sales data for a salesperson",
    queryBehavior: "ANTI-PATTERN: Include() loads full SalesPerson entities, ToList() downloads entire table, then Skip/Take in C# memory. Transfers massive amounts of data.",
  },
  {
    id: "sql-pagination",
    name: "SQL Pagination",
    description: "Filter and paginate directly in SQL - efficient",
    isGood: true,
    queryGoal: "Get paginated sales data for a salesperson",
    queryBehavior: "OPTIMAL: Select() projection with Skip/Take in SQL. Only the required columns and rows are transferred. Count is also done in SQL.",
  },
];

export default function PaginationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ChevronLeft className="h-8 w-8" />
          Pagination Patterns
        </h1>
        <p className="text-muted-foreground mt-2">
          Loading all data then paginating in memory is a common performance disaster.
          Always filter and paginate directly in SQL.
        </p>
      </div>

      <div className="bg-muted/50 border rounded-lg p-4">
        <h3 className="font-semibold mb-2">What to look for:</h3>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
          <li><strong>SQL:</strong> Naive shows SELECT * FROM Sales with JOIN, good shows SELECT with LIMIT/OFFSET</li>
          <li><strong>Rows:</strong> Naive returns all rows for the salesperson, good returns only the page size</li>
          <li><strong>Network:</strong> Naive transfers entire dataset, good transfers only needed data</li>
          <li><strong>Memory:</strong> Naive loads all entities, good is memory efficient</li>
        </ul>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <h3 className="font-semibold mb-2 text-amber-800 dark:text-amber-200">💡 Tip</h3>
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Never call ToList() before Skip() and Take(). Always apply pagination
          operators (Skip, Take) to IQueryable&lt;T&gt; so they translate to SQL LIMIT/OFFSET.
          This is especially critical with large datasets!
        </p>
      </div>

      <ScenarioRunner
        scenario="pagination"
        variants={variants}
        defaultParams={{ salesPersonId: 1, page: 0, pageSize: 10 }}
      />
    </div>
  );
}