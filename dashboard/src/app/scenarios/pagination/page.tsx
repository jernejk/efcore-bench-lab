"use client";

import { ScenarioRunner } from "@/components/scenario-runner";
import { ScrollText } from "lucide-react";

const variants = [
  {
    id: "in-memory",
    name: "In-Memory Pagination",
    description: "Loads ALL data then paginates in C# - never do this!",
    isBad: true,
  },
  {
    id: "offset",
    name: "Offset Pagination",
    description: "Uses Skip/Take - gets slower as page number increases",
    isBad: true,
  },
  {
    id: "keyset",
    name: "Keyset Pagination",
    description: "Uses cursor-based pagination - constant time regardless of position",
    isGood: true,
  },
];

export default function PaginationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ScrollText className="h-8 w-8" />
          Pagination Trap
        </h1>
        <p className="text-muted-foreground mt-2">
          Offset pagination (Skip/Take) gets slower as you go deeper into the dataset
          because the database must scan and skip all previous rows. Keyset pagination
          maintains constant performance.
        </p>
      </div>

      <div className="bg-muted/50 border rounded-lg p-4">
        <h3 className="font-semibold mb-2">What to look for:</h3>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
          <li><strong>In-Memory:</strong> Downloads entire table - extreme memory and time</li>
          <li><strong>Offset:</strong> SQL shows OFFSET which requires scanning rows</li>
          <li><strong>Keyset:</strong> SQL uses WHERE clause with index - fast at any depth</li>
        </ul>
      </div>

      <ScenarioRunner
        scenario="pagination"
        variants={variants}
        defaultParams={{ page: 100, pageSize: 20 }}
      />
    </div>
  );
}

