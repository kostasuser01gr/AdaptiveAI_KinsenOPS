import React, { useState, useEffect } from 'react';
import { useApp } from '@/lib/AppContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/useAuth";
import {
  Database, Globe, Clock, FileImage, Shield, Brain, Radio, Zap,
  Link2, RotateCcw, Save, AlertTriangle, Search, Settings2,
} from 'lucide-react';

interface ConfigDefinition {
  key: string;
  category: string;
  label: string;
  description: string;
  type: "string" | "number" | "boolean" | "json" | "string[]";
  defaultValue: unknown;
  currentValue: unknown;
  isOverridden: boolean;
  validation?: { min?: number; max?: number; pattern?: string; options?: string[] };
  sensitive?: boolean;
  restartRequired?: boolean;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  storage: <Database className="h-4 w-4" />,
  integrations: <Globe className="h-4 w-4" />,
  automations: <Clock className="h-4 w-4" />,
  media: <FileImage className="h-4 w-4" />,
  rate_limits: <Shield className="h-4 w-4" />,
  operational: <Settings2 className="h-4 w-4" />,
  websocket: <Radio className="h-4 w-4" />,
  security: <Shield className="h-4 w-4" />,
  ai: <Brain className="h-4 w-4" />,
  connections: <Link2 className="h-4 w-4" />,
  channels: <Zap className="h-4 w-4" />,
};

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)}s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(0)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ConfigItem({
  def,
  localValue,
  onChange,
  onSave,
  onReset,
  isSaving,
}: {
  def: ConfigDefinition;
  localValue: unknown;
  onChange: (val: unknown) => void;
  onSave: () => void;
  onReset: () => void;
  isSaving: boolean;
}) {
  const isDirty = JSON.stringify(localValue) !== JSON.stringify(def.currentValue);
  const isDefault = !def.isOverridden && !isDirty;
  const keyShort = def.key.split(".").pop() ?? def.key;
  const isMilliseconds = keyShort.endsWith("_ms") || keyShort.includes("interval") || keyShort.includes("timeout") || keyShort.includes("ttl");
  const isBytes = keyShort.includes("bytes") || keyShort.includes("size");

  return (
    <div className="flex flex-col gap-2 p-4 border rounded-lg bg-card/50 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Label className="text-sm font-semibold">{def.label}</Label>
            {def.restartRequired && (
              <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-500">
                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Restart Required
              </Badge>
            )}
            {def.isOverridden && !isDirty && (
              <Badge variant="secondary" className="text-[10px]">Custom</Badge>
            )}
            {isDirty && (
              <Badge variant="default" className="text-[10px] bg-blue-500">Unsaved</Badge>
            )}
            {isDefault && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">Default</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{def.description}</p>
          <code className="text-[10px] text-muted-foreground/60 font-mono">{def.key}</code>
        </div>
      </div>

      <div className="flex items-end gap-2 mt-1">
        <div className="flex-1">
          {def.type === "boolean" ? (
            <Switch
              checked={localValue as boolean}
              onCheckedChange={(v) => onChange(v)}
            />
          ) : def.type === "string" && def.validation?.options ? (
            <Select
              value={String(localValue)}
              onValueChange={(v) => onChange(v)}
            >
              <SelectTrigger className="w-full h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {def.validation.options.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : def.type === "number" ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={String(localValue)}
                onChange={(e) => onChange(Number(e.target.value))}
                className="h-9 font-mono"
                min={def.validation?.min}
                max={def.validation?.max}
              />
              {isMilliseconds && typeof localValue === "number" && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">= {formatMs(localValue)}</span>
              )}
              {isBytes && typeof localValue === "number" && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">= {formatBytes(localValue)}</span>
              )}
            </div>
          ) : def.type === "string[]" ? (
            <Input
              value={Array.isArray(localValue) ? (localValue as string[]).join(", ") : String(localValue)}
              onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
              className="h-9 font-mono text-xs"
              placeholder="Comma-separated values"
            />
          ) : (
            <Input
              value={String(localValue ?? "")}
              onChange={(e) => onChange(e.target.value)}
              className="h-9"
              type={def.sensitive ? "password" : "text"}
            />
          )}
        </div>

        <div className="flex gap-1 shrink-0">
          {isDirty && (
            <Button size="sm" onClick={onSave} disabled={isSaving} className="h-9 gap-1">
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
          )}
          {def.isOverridden && (
            <Button size="sm" variant="ghost" onClick={onReset} disabled={isSaving} className="h-9 gap-1 text-muted-foreground">
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
          )}
        </div>
      </div>

      {def.validation && (def.validation.min !== undefined || def.validation.max !== undefined) && (
        <p className="text-[10px] text-muted-foreground/60">
          Range: {def.validation.min !== undefined ? def.validation.min : '—'} – {def.validation.max !== undefined ? def.validation.max : '—'}
        </p>
      )}
    </div>
  );
}

export default function SystemConfigurationPage() {
  const { isMobile, sidebarOpen } = useApp();
  const _auth = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [localValues, setLocalValues] = useState<Record<string, unknown>>({});

  const { data, isLoading } = useQuery<{
    definitions: ConfigDefinition[];
    categories: Record<string, string>;
  }>({
    queryKey: ["/api/system-config/definitions"],
  });

  const definitions = data?.definitions ?? [];
  const categories = data?.categories ?? {};

  // Sync local values when data loads
  useEffect(() => {
    if (definitions.length > 0 && Object.keys(localValues).length === 0) {
      const vals: Record<string, unknown> = {};
      for (const d of definitions) vals[d.key] = d.currentValue;
      setLocalValues(vals);
    }
  }, [definitions, localValues]);

  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      return apiRequest("PUT", `/api/system-config/${key}`, { value });
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-config/definitions"] });
      toast({
        title: "Configuration saved",
        description: result.restartRequired
          ? "This change requires a server restart to take effect."
          : `${result.label ?? "Setting"} has been updated.`,
        variant: result.restartRequired ? "destructive" : "default",
      });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async (key: string) => {
      return apiRequest("DELETE", `/api/system-config/${key}`);
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-config/definitions"] });
      setLocalValues((prev) => ({ ...prev, [result.key]: result.value }));
      toast({ title: "Reset to default", description: `${result.key} has been reset.` });
    },
  });

  const handleSave = (key: string) => {
    updateMutation.mutate({ key, value: localValues[key] });
  };

  const handleReset = (key: string) => {
    resetMutation.mutate(key);
  };

  const grouped = definitions.reduce<Record<string, ConfigDefinition[]>>((acc, def) => {
    (acc[def.category] ??= []).push(def);
    return acc;
  }, {});

  const filteredGrouped: Record<string, ConfigDefinition[]> = searchQuery.trim()
    ? Object.fromEntries(
        Object.entries(grouped)
          .map(([cat, defs]) => [
            cat,
            defs.filter(
              (d) =>
                d.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                d.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
                d.description.toLowerCase().includes(searchQuery.toLowerCase())
            ),
          ])
          .filter(([, defs]) => (defs as ConfigDefinition[]).length > 0)
      )
    : grouped;

  const categoryKeys = Object.keys(filteredGrouped);
  const overriddenCount = definitions.filter((d) => d.isOverridden).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      <header className={`sticky top-0 z-10 flex items-center justify-between px-4 h-14 bg-background/80 backdrop-blur-sm border-b transition-all ${isMobile ? 'pl-14' : (sidebarOpen ? '' : 'pl-14')}`}>
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">System Configuration</h1>
          <Badge variant="secondary" className="text-xs">{definitions.length} settings</Badge>
          {overriddenCount > 0 && (
            <Badge variant="default" className="text-xs bg-blue-500">{overriddenCount} customised</Badge>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search settings..."
            className="pl-8 h-9 w-48 md:w-64"
          />
        </div>
      </header>

      <ScrollArea className="flex-1 p-4 md:p-6 lg:px-24">
        <div className="max-w-6xl mx-auto pb-12 flex flex-col md:flex-row gap-8">
          <Tabs defaultValue={categoryKeys[0] ?? "storage"} className="w-full flex flex-col md:flex-row gap-6" orientation="vertical">
            <TabsList className="flex flex-col h-auto w-full md:w-56 bg-transparent space-y-1 justify-start items-stretch shrink-0">
              {Object.entries(categories).map(([cat, label]) => {
                const count = (filteredGrouped[cat] ?? []).length;
                if (searchQuery && count === 0) return null;
                const customCount = (grouped[cat] ?? []).filter((d) => d.isOverridden).length;
                return (
                  <TabsTrigger
                    key={cat}
                    value={cat}
                    className="justify-start data-[state=active]:bg-muted gap-2 text-left"
                  >
                    {CATEGORY_ICONS[cat]}
                    <span className="flex-1 truncate">{label}</span>
                    {customCount > 0 && (
                      <span className="text-[10px] bg-blue-500/20 text-blue-500 rounded-full px-1.5">{customCount}</span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <div className="flex-1 w-full min-w-0">
              {Object.entries(filteredGrouped).map(([cat, defs]) => (
                <TabsContent key={cat} value={cat} className="m-0 space-y-3">
                  <div className="flex items-center gap-2 mb-4">
                    {CATEGORY_ICONS[cat]}
                    <h2 className="text-lg font-semibold">{categories[cat] ?? cat}</h2>
                    <Badge variant="outline" className="text-xs">{defs.length} settings</Badge>
                  </div>

                  {defs.map((def) => (
                    <ConfigItem
                      key={def.key}
                      def={def}
                      localValue={localValues[def.key] ?? def.currentValue}
                      onChange={(val) => setLocalValues((prev) => ({ ...prev, [def.key]: val }))}
                      onSave={() => handleSave(def.key)}
                      onReset={() => handleReset(def.key)}
                      isSaving={updateMutation.isPending || resetMutation.isPending}
                    />
                  ))}
                </TabsContent>
              ))}

              {categoryKeys.length === 0 && searchQuery && (
                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                  <Search className="h-8 w-8 mb-2" />
                  <p className="text-sm">No settings matching "{searchQuery}"</p>
                </div>
              )}
            </div>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
