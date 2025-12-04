"use client";

import { ScenarioRunner } from "@/components/scenario-runner";
import { Zap } from "lucide-react";

const variants = [
  {
    id: "select-update-save",
    name: "Select-Update-Save",
    description: "Loads entities, modifies in loop, saves - N SELECT + N UPDATE",
    isBad: true,
  },
  {
    id: "execute-update",
    name: "ExecuteUpdate",
    description: "Single SQL UPDATE statement - no entity loading",
    isGood: true,
  },
];

export default function UpdatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Zap className="h-8 w-8" />
          Bulk Updates
        </h1>
        <p className="text-muted-foreground mt-2">
          Traditional EF Core updates require loading entities, modifying them,
          and calling SaveChanges. EF Core 7+ introduced ExecuteUpdate/ExecuteDelete
          for efficient bulk operations without loading entities.
        </p>
      </div>

      <div className="bg-muted/50 border rounded-lg p-4">
        <h3 className="font-semibold mb-2">What to look for:</h3>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
          <li><strong>Query Count:</strong> Traditional shows SELECT + many UPDATEs, ExecuteUpdate shows 2 queries</li>
          <li><strong>Duration:</strong> Orders of magnitude faster with ExecuteUpdate</li>
          <li><strong>Memory:</strong> ExecuteUpdate uses minimal memory (no entity loading)</li>
        </ul>
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <h3 className="font-semibold mb-2 text-yellow-800 dark:text-yellow-200">⚠️ Note</h3>
        <p className="text-sm text-yellow-700 dark:text-yellow-300">
          These scenarios modify data. Use the &quot;Reset Prices&quot; endpoint after testing
          to restore original values.
        </p>
      </div>

      <ScenarioRunner
        scenario="updates"
        variants={variants}
        defaultParams={{ category: "Electronics", priceIncrease: 1.00, limit: 100 }}
      />
    </div>
  );
}

