"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Settings, Bot, Server, Save } from "lucide-react";
import { defaultSettings, type Settings as SettingsType, type AIProvider } from "@/lib/config";

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsType>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load settings from localStorage
    const saved = localStorage.getItem("efcore-perf-settings");
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch {
        // Use defaults if parsing fails
      }
    }
  }, []);

  const handleSave = () => {
    setIsSaving(true);
    try {
      localStorage.setItem("efcore-perf-settings", JSON.stringify(settings));
      toast.success("Settings saved successfully");
    } catch {
      toast.error("Failed to save settings");
    }
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-8 w-8" />
          Settings
        </h1>
        <p className="text-muted-foreground">
          Configure API connections and AI providers
        </p>
      </div>

      {/* WebAPI Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            WebAPI Connection
          </CardTitle>
          <CardDescription>
            Configure the connection to the .NET WebAPI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webApiUrl">WebAPI URL</Label>
            <Input
              id="webApiUrl"
              value={settings.webApiUrl}
              onChange={(e) =>
                setSettings({ ...settings, webApiUrl: e.target.value })
              }
              placeholder="http://localhost:5847"
            />
            <p className="text-sm text-muted-foreground">
              The base URL of the EF Core Bench Lab WebAPI
            </p>
          </div>
        </CardContent>
      </Card>

      {/* AI Provider Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Provider
          </CardTitle>
          <CardDescription>
            Configure AI for query analysis and suggestions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="aiProvider">Provider</Label>
            <Select
              value={settings.aiProvider}
              onValueChange={(value: AIProvider) =>
                setSettings({ ...settings, aiProvider: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select AI provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lmstudio">LM Studio (Local)</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="azure-openai">Azure OpenAI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* LM Studio Settings */}
          {settings.aiProvider === "lmstudio" && (
            <div className="space-y-4">
              <h4 className="font-medium">LM Studio Settings</h4>
              <div className="flex items-center space-x-2">
                <Switch
                  id="lmStudioAutoControl"
                  checked={settings.lmStudioAutoControl}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, lmStudioAutoControl: checked })
                  }
                />
                <Label htmlFor="lmStudioAutoControl">
                  Auto-control LM Studio
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Automatically start/stop LM Studio server using the CLI
              </p>

              <div className="space-y-2">
                <Label htmlFor="lmStudioModel">Default Model</Label>
                <Input
                  id="lmStudioModel"
                  value={settings.lmStudioModel}
                  onChange={(e) =>
                    setSettings({ ...settings, lmStudioModel: e.target.value })
                  }
                  placeholder="e.g., llama-3.2-3b-instruct"
                />
                <p className="text-sm text-muted-foreground">
                  Leave empty to use the currently loaded model
                </p>
              </div>
            </div>
          )}

          {/* OpenAI Settings */}
          {settings.aiProvider === "openai" && (
            <div className="space-y-4">
              <h4 className="font-medium">OpenAI Settings</h4>
              <div className="space-y-2">
                <Label htmlFor="openAiModel">Model</Label>
                <Select
                  value={settings.openAiModel}
                  onValueChange={(value) =>
                    setSettings({ ...settings, openAiModel: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                API key should be set in environment variable OPENAI_API_KEY
              </p>
            </div>
          )}

          {/* Azure OpenAI Settings */}
          {settings.aiProvider === "azure-openai" && (
            <div className="space-y-4">
              <h4 className="font-medium">Azure OpenAI Settings</h4>
              <p className="text-sm text-muted-foreground">
                Configure via environment variables:
                <br />
                AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY,
                AZURE_OPENAI_DEPLOYMENT
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      {/* About / Attribution */}
      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            EF Core Bench Lab is an interactive lab for benchmarking and testing EF Core query performance. Swap components, test scenarios, and measure results - just like a PC bench build for your queries.
          </p>
          <p className="text-sm text-muted-foreground">
            Created by{" "}
            <a
              href="https://github.com/jernejk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              JK
            </a>
            {" "}(Jernej Kavka)
          </p>
          <p className="text-xs text-muted-foreground mt-4">
            © {new Date().getFullYear()} Jernej Kavka (JK). All rights reserved.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

