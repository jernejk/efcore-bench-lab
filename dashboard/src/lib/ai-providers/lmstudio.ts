import { exec } from "child_process";
import { promisify } from "util";
import type { AIProvider, ChatMessage, AnalysisContext } from "./types";
import { SYSTEM_PROMPT } from "./types";

const execAsync = promisify(exec);

export class LMStudioProvider implements AIProvider {
  name = "LM Studio";
  private baseUrl: string;
  private model: string;
  private autoControl: boolean;

  constructor(
    baseUrl: string = "http://localhost:1234",
    model: string = "",
    autoControl: boolean = false
  ) {
    this.baseUrl = baseUrl;
    this.model = model;
    this.autoControl = autoControl;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async startServer(): Promise<void> {
    if (!this.autoControl) return;
    
    try {
      await execAsync("lms server start");
      // Wait for server to be ready
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error) {
      console.error("Failed to start LM Studio server:", error);
      throw new Error("Failed to start LM Studio server");
    }
  }

  async loadModel(modelName: string): Promise<void> {
    if (!this.autoControl) return;
    
    try {
      await execAsync(`lms load "${modelName}"`);
    } catch (error) {
      console.error("Failed to load model:", error);
      throw new Error(`Failed to load model: ${modelName}`);
    }
  }

  async analyze(prompt: string, context?: AnalysisContext): Promise<string> {
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: this.buildAnalysisPrompt(prompt, context) },
    ];
    return this.chat(messages);
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model || "local-model",
        messages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`LM Studio API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "No response generated";
  }

  private buildAnalysisPrompt(prompt: string, context?: AnalysisContext): string {
    let fullPrompt = prompt;

    if (context) {
      fullPrompt += "\n\n## Context\n";
      
      if (context.scenario) {
        fullPrompt += `\n**Scenario:** ${context.scenario}`;
      }
      if (context.variant) {
        fullPrompt += `\n**Variant:** ${context.variant}`;
      }
      if (context.metrics) {
        fullPrompt += `\n\n**Metrics:**`;
        if (context.metrics.durationMs !== undefined) {
          fullPrompt += `\n- Duration: ${context.metrics.durationMs.toFixed(2)} ms`;
        }
        if (context.metrics.queryCount !== undefined) {
          fullPrompt += `\n- Query Count: ${context.metrics.queryCount}`;
        }
        if (context.metrics.rowsReturned !== undefined) {
          fullPrompt += `\n- Rows Returned: ${context.metrics.rowsReturned}`;
        }
        if (context.metrics.memoryAllocatedBytes !== undefined) {
          fullPrompt += `\n- Memory: ${Math.round(context.metrics.memoryAllocatedBytes / 1024)} KB`;
        }
      }
      if (context.sql) {
        fullPrompt += `\n\n**SQL Query:**\n\`\`\`sql\n${context.sql}\n\`\`\``;
      }
      if (context.executionPlan) {
        fullPrompt += `\n\n**Execution Plan (XML):**\n\`\`\`xml\n${context.executionPlan.substring(0, 2000)}...\n\`\`\``;
      }
    }

    return fullPrompt;
  }
}

