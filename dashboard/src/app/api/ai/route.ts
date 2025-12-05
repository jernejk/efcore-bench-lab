import { NextRequest, NextResponse } from "next/server";
import { LMStudioProvider } from "@/lib/ai-providers/lmstudio";
import { OpenAIProvider, AzureOpenAIProvider } from "@/lib/ai-providers/openai";
import type { AIProvider, AnalysisContext, ChatMessage } from "@/lib/ai-providers/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, provider: providerName, prompt, context, messages, config } = body;

    // Create provider based on config
    const provider = createProvider(providerName, config);

    if (!provider) {
      return NextResponse.json(
        { error: "Invalid or unconfigured AI provider" },
        { status: 400 }
      );
    }

    // Check availability
    const isAvailable = await provider.isAvailable();
    if (!isAvailable) {
      return NextResponse.json(
        { error: `${provider.name} is not available. Check configuration.` },
        { status: 503 }
      );
    }

    let result: string;

    switch (action) {
      case "analyze":
        result = await provider.analyze(prompt, context as AnalysisContext);
        break;
      case "chat":
        result = await provider.chat(messages as ChatMessage[]);
        break;
      case "check":
        return NextResponse.json({ available: true, provider: provider.name });
      default:
        return NextResponse.json(
          { error: "Invalid action. Use 'analyze', 'chat', or 'check'" },
          { status: 400 }
        );
    }

    return NextResponse.json({ result, provider: provider.name });
  } catch (error) {
    console.error("AI API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

function createProvider(
  providerName: string,
  config?: Record<string, string | boolean>
): AIProvider | null {
  switch (providerName) {
    case "lmstudio":
      return new LMStudioProvider(
        (config?.lmstudioUrl as string) || "http://localhost:1234",
        (config?.lmstudioModel as string) || "",
        (config?.lmstudioAutoControl as boolean) || false
      );
    case "openai":
      const openaiKey = (config?.openaiApiKey as string) || process.env.OPENAI_API_KEY;
      if (!openaiKey) return null;
      return new OpenAIProvider(
        openaiKey,
        (config?.openaiModel as string) || "gpt-5-mini"
      );
    case "azure-openai":
      const azureEndpoint = (config?.azureEndpoint as string) || process.env.AZURE_OPENAI_ENDPOINT;
      const azureKey = (config?.azureApiKey as string) || process.env.AZURE_OPENAI_API_KEY;
      const azureDeployment = (config?.azureDeployment as string) || process.env.AZURE_OPENAI_DEPLOYMENT;
      if (!azureEndpoint || !azureKey || !azureDeployment) return null;
      return new AzureOpenAIProvider(azureEndpoint, azureKey, azureDeployment);
    default:
      return null;
  }
}

export async function GET() {
  // Check which providers are available
  const providers = [
    { name: "lmstudio", label: "LM Studio (Local)" },
    { name: "openai", label: "OpenAI" },
    { name: "azure-openai", label: "Azure OpenAI" },
  ];

  const availability: Record<string, boolean> = {};

  for (const p of providers) {
    const provider = createProvider(p.name);
    availability[p.name] = provider ? await provider.isAvailable() : false;
  }

  return NextResponse.json({ providers, availability });
}

