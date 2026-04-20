import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProposalPreviewProps {
  payload: Record<string, unknown>;
  previousValue: Record<string, unknown> | null;
  type: string;
  onApply?: () => void;
}

function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(result, flattenObject(val as Record<string, unknown>, path));
    } else {
      result[path] = val;
    }
  }
  return result;
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (Array.isArray(val)) return val.join(', ');
  return String(val);
}

export function ProposalPreview({ payload, previousValue, type, onApply }: ProposalPreviewProps) {
  const [showPreview, setShowPreview] = useState(false);

  const newFields = flattenObject(payload);
  const oldFields = previousValue ? flattenObject(previousValue) : {};

  // Compute diff: changed, added, removed keys
  const allKeys = [...new Set([...Object.keys(newFields), ...Object.keys(oldFields)])].sort();
  const changes = allKeys.map(key => {
    const oldVal = oldFields[key];
    const newVal = newFields[key];
    const status: 'added' | 'removed' | 'changed' | 'unchanged' =
      !(key in oldFields) ? 'added' :
      !(key in newFields) ? 'removed' :
      JSON.stringify(oldVal) !== JSON.stringify(newVal) ? 'changed' : 'unchanged';
    return { key, oldVal, newVal, status };
  }).filter(c => c.status !== 'unchanged');

  if (changes.length === 0) return null;

  return (
    <div className="space-y-2">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 h-7 text-xs text-primary"
        onClick={() => setShowPreview(!showPreview)}
      >
        {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        {showPreview ? 'Hide preview' : 'Preview changes'}
      </Button>

      {showPreview && (
        <Card className="border-primary/30 bg-primary/[0.02] overflow-hidden">
          <CardContent className="p-0">
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-primary/10 flex items-center justify-between bg-primary/5">
              <div className="flex items-center gap-2">
                <Eye className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">Preview Mode</span>
                <Badge variant="outline" className="text-[10px] border-primary/20 text-primary">{type}</Badge>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                {changes.length} change{changes.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Diff table */}
            <div className="divide-y divide-border/50">
              {changes.map(({ key, oldVal, newVal, status }) => (
                <div key={key} className={cn(
                  "grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-2 text-xs",
                  status === 'added' && "bg-emerald-500/5",
                  status === 'removed' && "bg-red-500/5",
                  status === 'changed' && "bg-amber-500/5",
                )}>
                  {/* Old value */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-muted-foreground truncate">{key}</span>
                    {status !== 'added' && (
                      <span className={cn(
                        "ml-auto px-1.5 py-0.5 rounded font-mono text-[11px] shrink-0",
                        status === 'removed' ? "bg-red-500/10 text-red-600 line-through" : "bg-muted text-muted-foreground"
                      )}>
                        {formatValue(oldVal)}
                      </span>
                    )}
                    {status === 'added' && <span className="ml-auto text-muted-foreground italic">new</span>}
                  </div>

                  {/* Arrow */}
                  <ArrowRight className={cn(
                    "h-3 w-3 shrink-0",
                    status === 'added' ? "text-emerald-500" :
                    status === 'removed' ? "text-red-500" : "text-amber-500"
                  )} />

                  {/* New value */}
                  <div className="flex items-center min-w-0">
                    {status !== 'removed' ? (
                      <span className={cn(
                        "px-1.5 py-0.5 rounded font-mono text-[11px]",
                        status === 'added' ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary font-semibold"
                      )}>
                        {formatValue(newVal)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">removed</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer with ghost apply hint */}
            {onApply && (
              <div className="px-4 py-2.5 border-t border-primary/10 bg-primary/5 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  This is a preview — no changes have been applied yet.
                </span>
                <Button size="sm" className="h-6 text-[11px] gap-1" onClick={onApply}>
                  Apply now
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
