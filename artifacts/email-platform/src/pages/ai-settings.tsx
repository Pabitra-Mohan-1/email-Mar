import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Sparkles, CheckCircle2, AlertCircle, Eye, EyeOff, Save, RefreshCw, KeyRound
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface ProviderConfig {
  provider: string;
  apiKey: string;
  isActive: boolean;
}

const PROVIDERS = [
  {
    id: "gemini",
    name: "Google Gemini",
    description: "Gemini 2.5 Flash – Recommended for workspace AI",
    link: "https://aistudio.google.com/",
    color: "border-t-blue-500",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4o, GPT-4o Mini – Chat completions API",
    link: "https://platform.openai.com/api-keys",
    color: "border-t-emerald-500",
  },
  {
    id: "claude",
    name: "Anthropic Claude",
    description: "Claude Sonnet 4, Opus 4 – Messages API",
    link: "https://console.anthropic.com/",
    color: "border-t-orange-500",
  },
  {
    id: "nvidia",
    name: "NVIDIA NIM",
    description: "Nemotron Ultra 550B – NIM inference API",
    link: "https://build.nvidia.com/",
    color: "border-t-lime-500",
  },
  {
    id: "grok",
    name: "xAI Grok",
    description: "Grok 4.3 – Chat completions API",
    link: "https://console.x.ai/",
    color: "border-t-purple-500",
  },
];

export default function AiSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [keysInput, setKeysInput] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  // Fetch current configs
  const { data: configs = [], isLoading } = useQuery<ProviderConfig[]>({
    queryKey: ["ai", "config"],
    queryFn: async () => {
      const res = await fetch("/api/ai/config");
      if (!res.ok) throw new Error("Failed to load configs");
      return res.json();
    },
  });

  // Save API Key Mutation
  const saveKeyMutation = useMutation({
    mutationFn: async ({ provider, apiKey }: { provider: string; apiKey: string }) => {
      const res = await fetch("/api/ai/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save API key");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai", "config"] });
      toast({ title: "API Key saved successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save key", description: err.message, variant: "destructive" });
    },
  });

  // Set Active Provider Mutation
  const activateMutation = useMutation({
    mutationFn: async (provider: string) => {
      const res = await fetch("/api/ai/config/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to activate provider");
      return data;
    },
    onSuccess: (_, provider) => {
      queryClient.invalidateQueries({ queryKey: ["ai", "config"] });
      toast({ title: `${provider.toUpperCase()} is now set as the active AI provider` });
    },
    onError: (err: any) => {
      toast({ title: "Activation failed", description: err.message, variant: "destructive" });
    },
  });

  const handleTestConnection = async (provider: string, apiKey?: string) => {
    setTestingProvider(provider);
    toast({ title: `Testing connection to ${provider}...` });
    try {
      const res = await fetch("/api/ai/config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: apiKey || undefined }),
      });
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: "Connection Success",
          description: `${provider} credentials are valid and responding.`,
        });
      } else {
        toast({
          title: "Connection Failed",
          description: `Could not verify credentials for ${provider}.`,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Test Connection Error",
        description: err.message || "Failed to communicate with provider",
        variant: "destructive",
      });
    } finally {
      setTestingProvider(null);
    }
  };

  const toggleShowKey = (provider: string) => {
    setShowKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  const handleInputChange = (provider: string, val: string) => {
    setKeysInput((prev) => ({ ...prev, [provider]: val }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Configurations</h1>
        <p className="text-muted-foreground mt-1">Configure API keys for your preferred LLM providers to auto-classify leads and auto-draft replies.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {PROVIDERS.map((provider) => {
          const config = configs.find((c) => c.provider === provider.id);
          const hasKeySaved = !!config?.apiKey;
          const isActive = !!config?.isActive;
          const currentInput = keysInput[provider.id] ?? "";
          const isShow = !!showKeys[provider.id];

          return (
            <Card key={provider.id} className={`border-t-4 ${provider.color} transition-all shadow-sm`}>
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      {provider.name}
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">{provider.description}</CardDescription>
                  </div>
                  <div>
                    {isActive ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-none font-bold">
                        ACTIVE
                      </Badge>
                    ) : hasKeySaved ? (
                      <Badge variant="secondary" className="font-semibold">
                        CONFIGURED
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground font-semibold">
                        NOT SET
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <KeyRound className="h-3 w-3" /> API Key
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={isShow ? "text" : "password"}
                        placeholder={hasKeySaved ? `${config.apiKey} (Saved)` : "e.g. sk-proj-... or api_key"}
                        value={currentInput}
                        onChange={(e) => handleInputChange(provider.id, e.target.value)}
                        className="pr-10 h-9 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowKey(provider.id)}
                        className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                      >
                        {isShow ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => saveKeyMutation.mutate({ provider: provider.id, apiKey: currentInput })}
                      disabled={!currentInput}
                    >
                      <Save className="h-4 w-4 mr-1.5" /> Save
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t text-xs">
                  <a
                    href={provider.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-500 hover:underline font-medium"
                  >
                    Get API Key &rarr;
                  </a>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => handleTestConnection(provider.id, currentInput)}
                      disabled={testingProvider !== null || (!hasKeySaved && !currentInput)}
                    >
                      {testingProvider === provider.id ? (
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : null}
                      Test Connection
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 text-xs bg-primary/10 text-primary hover:bg-primary/20"
                      onClick={() => activateMutation.mutate(provider.id)}
                      disabled={!hasKeySaved && !currentInput}
                    >
                      Set as Active
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
