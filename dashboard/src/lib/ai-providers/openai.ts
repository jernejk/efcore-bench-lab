import type { AIProvider, ChatMessage, AnalysisContext } from "./types";
import { SYSTEM_PROMPT } from "./types";

export class OpenAIProvider implements AIProvider {
  name = "OpenAI";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = "gpt-5-mini") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async analyze(prompt: string, context?: AnalysisContext): Promise<string> {
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: this.buildAnalysisPrompt(prompt, context) },
    ];
    return this.chat(messages);
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
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
        fullPrompt += `\n\n**Metrics:**
- Duration: ${context.metrics.durationMs?.toFixed(2) ?? 'N/A'} ms
- Query Count: ${context.metrics.queryCount}
- Rows Returned: ${context.metrics.rowsReturned}
- Memory: ${Math.round((context.metrics.memoryAllocatedBytes ?? 0) / 1024)} KB`;
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

export class AzureOpenAIProvider implements AIProvider {
  name = "Azure OpenAI";
  private endpoint: string;
  private apiKey: string;
  private deployment: string;

  constructor(endpoint: string, apiKey: string, deployment: string) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.deployment = deployment;
  }

  async isAvailable(): Promise<boolean> {
    return !!(this.endpoint && this.apiKey && this.deployment);
  }

  async analyze(prompt: string, context?: AnalysisContext): Promise<string> {
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: this.buildAnalysisPrompt(prompt, context) },
    ];
    return this.chat(messages);
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const url = `${this.endpoint}/openai/deployments/${this.deployment}/chat/completions?api-version=2024-02-15-preview`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": this.apiKey,
      },
      body: JSON.stringify({
        messages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Azure OpenAI API error: ${response.status} - ${error}`);
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
        fullPrompt += `\n\n**Metrics:**
- Duration: ${context.metrics.durationMs?.toFixed(2) ?? 'N/A'} ms
- Query Count: ${context.metrics.queryCount}
- Rows Returned: ${context.metrics.rowsReturned}
- Memory: ${Math.round((context.metrics.memoryAllocatedBytes ?? 0) / 1024)} KB`;
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

