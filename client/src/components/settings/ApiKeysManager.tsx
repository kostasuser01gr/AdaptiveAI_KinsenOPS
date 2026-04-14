import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Key } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google AI' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'custom', label: 'Custom' },
] as const;

export function ApiKeysManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newProvider, setNewProvider] = useState('openai');
  const [newLabel, setNewLabel] = useState('');
  const [newKey, setNewKey] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['/api/user/api-keys'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/user/api-keys');
      return res.json();
    }
  });

  const addKey = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/user/api-keys', {
        provider: newProvider,
        label: newLabel || undefined,
        apiKey: newKey,
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/api-keys'] });
      setNewKey('');
      setNewLabel('');
      setIsAdding(false);
      toast({ title: 'API key added' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to add key', description: err.message, variant: 'destructive' });
    }
  });

  const toggleKey = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest('PATCH', `/api/user/api-keys/${id}`, { isActive });
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/user/api-keys'] }),
  });

  const deleteKey = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/user/api-keys/${id}`);
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/api-keys'] });
      toast({ title: 'API key deleted' });
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>Bring your own AI provider keys for enhanced capabilities.</CardDescription>
          </div>
          {!isAdding && (
            <Button size="sm" onClick={() => setIsAdding(true)} className="gap-1.5">
              <Key className="h-3.5 w-3.5" /> Add Key
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdding && (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Provider</Label>
                <Select value={newProvider} onValueChange={setNewProvider}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Label (optional)</Label>
                <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="My key" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">API Key</Label>
              <Input type="password" value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="sk-..." />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setIsAdding(false)}>Cancel</Button>
              <Button size="sm" onClick={() => addKey.mutate()} disabled={!newKey || newKey.length < 8 || addKey.isPending}>
                {addKey.isPending ? 'Saving...' : 'Save Key'}
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : keys.length === 0 && !isAdding ? (
          <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/20">
            <Key className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">No API keys configured</p>
              <p className="text-xs text-muted-foreground">Add your own provider keys for multi-model AI support.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {keys.map((k: any) => (
              <div key={k.id} className="flex items-center gap-3 p-3 border rounded-lg bg-card/50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{k.label}</span>
                    <Badge variant="outline" className="text-[10px]">{k.provider}</Badge>
                    {!k.isActive && <Badge variant="secondary" className="text-[10px]">Disabled</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{k.keyPrefix}</p>
                </div>
                <Switch checked={k.isActive} onCheckedChange={(checked) => toggleKey.mutate({ id: k.id, isActive: checked })} />
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteKey.mutate(k.id)}>
                  &times;
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
