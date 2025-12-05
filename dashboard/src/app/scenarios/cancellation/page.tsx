"use client";

import { ScenarioRunner } from "@/components/scenario-runner";
import { Ban } from "lucide-react";

const variants = [
  {
    id: "without-token",
    name: "Without CancellationToken",
    description: "Query continues even if request is cancelled - wastes resources",
    isBad: true,
    queryGoal: "Run a database query that can be cancelled if the user navigates away or the request times out.",
    queryBehavior: "ANTI-PATTERN: Ignores CancellationToken. If user closes browser mid-query, SQL Server keeps executing. Wastes database resources.",
  },
  {
    id: "with-token",
    name: "With CancellationToken",
    description: "Query cancels when request is aborted - proper cleanup",
    isGood: true,
    queryGoal: "Run a database query that can be cancelled if the user navigates away or the request times out.",
    queryBehavior: "Passes CancellationToken to all async database operations. When client disconnects, SQL Server receives cancellation and stops work.",
  },
  {
    id: "slow-query",
    name: "Slow Query Demo",
    description: "Simulated 10-second query - test cancellation by navigating away",
    isBad: false,
    queryGoal: "Demonstrate cancellation behavior with a deliberately slow query. Navigate away while running to test.",
    queryBehavior: "Uses WAITFOR DELAY to simulate a 10-second query. Good for testing cancellation - watch the API logs when you navigate away.",
  },
];

export default function CancellationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Ban className="h-8 w-8" />
          Cancellation Tokens
        </h1>
        <p className="text-muted-foreground mt-2">
          Without CancellationToken, queries continue running on SQL Server even
          after the user navigates away or refreshes. This can lead to resource
          exhaustion and potential DoS scenarios.
        </p>
      </div>

      <div className="bg-muted/50 border rounded-lg p-4">
        <h3 className="font-semibold mb-2">How to test:</h3>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
          <li>Start the &quot;Slow Query Demo&quot; (10 seconds)</li>
          <li>While running, navigate to another page or close the tab</li>
          <li>Check WebAPI logs - &quot;with-token&quot; will show cancellation</li>
          <li>&quot;without-token&quot; will complete even after navigation</li>
        </ul>
      </div>

      <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <h3 className="font-semibold mb-2 text-red-800 dark:text-red-200">⚠️ DoS Risk</h3>
        <p className="text-sm text-red-700 dark:text-red-300">
          If a user refreshes a page 10 times with a slow query without cancellation,
          you&apos;ll have 10 queries running simultaneously on SQL Server. Always pass
          CancellationToken to async database operations.
        </p>
      </div>

      <ScenarioRunner
        scenario="cancellation"
        variants={variants}
        defaultParams={{ delaySeconds: 10 }}
      />
    </div>
  );
}

