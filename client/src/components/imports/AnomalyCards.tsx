import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Check, ArrowUp, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Anomaly {
  id: number;
  kind: string;
  count: number;
  note: string;
  suggestedAction: string;
}

interface AnomalyCardsProps {
  importId: number;
  anomalies?: Anomaly[];
  onAction?: (anomalyId: number, action: string) => void;
}

// Default anomalies when the import has conflicts but no detailed anomaly data
function deriveAnomalies(diffs?: { conflicts: number; added: number; updated: number } | null): Anomaly[] {
  const results: Anomaly[] = [];
  if (!diffs) return results;
  if (diffs.conflicts > 0) {
    results.push({
      id: 1,
      kind: "Duplicate records",
      count: diffs.conflicts,
      note: "Records with matching keys already exist in the system. Merge or skip?",
      suggestedAction: "Merge",
    });
  }
  if (diffs.added > 20) {
    results.push({
      id: 2,
      kind: "Large batch insert",
      count: diffs.added,
      note: `${diffs.added} new records will be added. Review sampling before commit.`,
      suggestedAction: "Review",
    });
  }
  if (diffs.updated > 0) {
    results.push({
      id: 3,
      kind: "Field overwrites",
      count: diffs.updated,
      note: `${diffs.updated} existing records will be updated. Check for unintended changes.`,
      suggestedAction: "Accept",
    });
  }
  return results;
}

export function AnomalyCards({ importId, anomalies: propAnomalies, onAction }: AnomalyCardsProps) {
  const [cards, setCards] = useState<Anomaly[]>(propAnomalies || []);
  const [processed, setProcessed] = useState<Array<Anomaly & { verb: string }>>([]);

  const top = cards[0];

  const handle = (verb: string) => {
    if (!top) return;
    setProcessed(p => [...p, { ...top, verb }]);
    setCards(c => c.slice(1));
    onAction?.(top.id, verb);
  };

  const reset = () => {
    setCards(propAnomalies || []);
    setProcessed([]);
  };

  if (cards.length === 0 && processed.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-4">
      {/* Card stack */}
      <div className="relative h-[260px]">
        {cards.length > 0 ? (
          cards.slice(0, 3).reverse().map((c, i, arr) => {
            const depth = arr.length - 1 - i;
            return (
              <Card key={c.id} className={cn(
                "absolute inset-0 flex flex-col transition-all",
                depth === 0 && "shadow-lg"
              )} style={{
                transform: `translate(${depth * 5}px, ${depth * 5}px) scale(${1 - depth * 0.03})`,
                opacity: depth === 0 ? 1 : 0.7,
                zIndex: 10 - depth,
              }}>
                <CardContent className="p-4 flex flex-col gap-2.5 h-full">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Anomaly</span>
                    <Badge variant="outline" className="ml-auto text-[10px] font-mono text-primary">{c.count} rows</Badge>
                  </div>
                  <h3 className="text-lg font-semibold leading-tight">{c.kind}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">{c.note}</p>
                  {depth === 0 && (
                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => handle('escalated')}>
                        <ArrowUp className="h-3 w-3" /> Escalate
                      </Button>
                      <div className="flex-1" />
                      <Button size="sm" className="text-xs gap-1.5" onClick={() => handle(c.suggestedAction.toLowerCase())}>
                        <Check className="h-3 w-3" /> {c.suggestedAction}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="absolute inset-0 flex items-center justify-center border-dashed">
            <div className="text-center text-muted-foreground">
              <Check className="h-6 w-6 mx-auto mb-2 text-emerald-500" />
              <p className="text-sm font-medium">All anomalies triaged</p>
            </div>
          </Card>
        )}
      </div>

      {/* Processed list */}
      <Card className="max-h-[260px] overflow-auto">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              Triaged · {processed.length}
            </span>
            {processed.length > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-6 gap-1" onClick={reset}>
                <RotateCcw className="h-3 w-3" /> Reset
              </Button>
            )}
          </div>
          {processed.length === 0 ? (
            <p className="text-xs text-muted-foreground">Process anomaly cards on the left.</p>
          ) : (
            <div className="space-y-2">
              {processed.map((p, i) => (
                <div key={i} className="flex items-baseline gap-2 py-1.5 border-t first:border-0">
                  <span className={cn(
                    "text-[10px] font-mono uppercase",
                    p.verb === 'escalated' ? 'text-amber-500' : 'text-emerald-500'
                  )}>{p.verb}</span>
                  <span className="text-xs text-muted-foreground flex-1 truncate">{p.kind}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{p.count} rows</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export { deriveAnomalies };
export type { Anomaly };
