"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bot, Loader2, Sparkles, CheckCircle, XCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

export default function AIPage() {
  const [provider, setProvider] = useState("lmstudio");
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const [sql, setSql] = useState("");
  const [prompt, setPrompt] = useState("Analyze this SQL query and suggest optimizations");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkAvailability();
  }, []);

  const checkAvailability = async () => {
    try {
      const response = await fetch("/api/ai");
      const data = await response.json();
      setAvailability(data.availability);
    } catch {
      toast.error("Failed to check AI provider availability");
    }
  };

  const analyze = async () => {
    if (!sql.trim()) {
      toast.error("Please enter a SQL query to analyze");
      return;
    }

    setIsLoading(true);
    setResult("");

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "analyze",
          provider,
          prompt,
          context: { sql },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to analyze");
      }

      const data = await response.json();
      setResult(data.result);
      toast.success("Analysis complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsLoading(false);
    }
  };

  const exampleQueries = [
    {
      name: "N+1 Problem",
      sql: `-- Bad: N+1 queries
SELECT * FROM Customers WHERE CustomerId = 1
SELECT * FROM Sales WHERE CustomerId = 1
SELECT * FROM Customers WHERE CustomerId = 2
SELECT * FROM Sales WHERE CustomerId = 2
-- ... repeated 100 times`,
    },
    {
      name: "Missing Index",
      sql: `SELECT * FROM Sales
WHERE SaleDate > '2024-01-01'
  AND TotalAmount > 1000
ORDER BY SaleDate DESC`,
    },
    {
      name: "Select All Columns",
      sql: `SELECT * FROM Products
INNER JOIN Sales ON Products.ProductId = Sales.ProductId
INNER JOIN Customers ON Sales.CustomerId = Customers.CustomerId
WHERE Products.Category = 'Electronics'`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Bot className="h-8 w-8" />
          AI Analysis
        </h1>
        <p className="text-muted-foreground mt-2">
          Use AI to analyze SQL queries, explain EF Core behavior, and get optimization suggestions
        </p>
      </div>

      {/* Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Provider</CardTitle>
          <CardDescription>Select your preferred AI provider</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lmstudio">LM Studio (Local)</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="azure-openai">Azure OpenAI</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              {availability[provider] ? (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Available
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  Not Available
                </Badge>
              )}
            </div>

            <Button variant="outline" size="sm" onClick={checkAvailability}>
              Refresh Status
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">SQL Query</CardTitle>
              <CardDescription>Enter the SQL query to analyze</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                placeholder="Paste your SQL query here..."
                className="min-h-[200px] font-mono text-sm"
              />
              <div className="flex flex-wrap gap-2">
                {exampleQueries.map((example) => (
                  <Button
                    key={example.name}
                    variant="outline"
                    size="sm"
                    onClick={() => setSql(example.sql)}
                  >
                    {example.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Analysis Prompt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>What would you like to know?</Label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ask about the query..."
                  className="min-h-[80px]"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPrompt("Why might this query be slow?")}
                >
                  Why slow?
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPrompt("What indexes would help this query?")}
                >
                  Index suggestions
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPrompt("How would EF Core generate this query?")}
                >
                  EF Core explanation
                </Button>
              </div>
              <Button
                className="w-full"
                onClick={analyze}
                disabled={isLoading || !availability[provider]}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Analyze Query
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Result */}
        <Card className="lg:h-fit">
          <CardHeader>
            <CardTitle className="text-base">Analysis Result</CardTitle>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Enter a SQL query and click Analyze to get AI insights</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

