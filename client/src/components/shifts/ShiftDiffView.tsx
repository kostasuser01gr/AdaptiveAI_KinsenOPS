import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Check, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ShiftDiffProps {
  onAcceptAll?: () => void;
}

// Demo data representing last week vs AI-proposed next week
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const STAFF = ['Ada M.', 'Ben P.', 'Cam L.', 'Dia W.', 'Eli N.'];

const LAST_WEEK = [
  ['D', 'D', 'D', '—', 'N', 'N', '—'],
  ['—', 'D', 'D', 'D', 'D', '—', '—'],
  ['N', 'N', '—', 'D', 'D', 'D', '—'],
  ['D', '—', 'D', 'D', '—', 'N', 'N'],
  ['—', 'D', 'N', 'N', '—', 'D', 'D'],
];

const PROPOSED = [
  ['D', 'D', 'D', '—', 'N', 'N', '—'],
  ['—', 'D', 'D', 'D', '—', 'D', '—'],
  ['N', 'N', 'D', 'D', 'D', 'D', '—'],
  ['D', '—', 'D', 'D', 'N', 'N', 'N'],
  ['—', 'D', 'N', 'N', '—', 'D', 'D'],
];

const REASONS: Record<string, string> = {
  '1-4': 'Coverage gap: someone needed Fri day',
  '2-2': 'Cam requested to swap; picks up Wed day',
  '3-4': 'Overtime risk on Dia → move to night',
  '3-5': 'Ben off Sun; Dia covers night',
};

export function ShiftDiffView({ onAcceptAll }: ShiftDiffProps) {
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  const cell = (r: number, c: number) => `${r}-${c}`;
  const changedCells = new Set<string>();
  for (let r = 0; r < STAFF.length; r++) {
    for (let c = 0; c < 7; c++) {
      if (LAST_WEEK[r][c] !== PROPOSED[r][c]) changedCells.add(cell(r, c));
    }
  }

  const totalChanges = changedCells.size;
  const acceptedCount = accepted.size;

  const acceptAll = () => {
    setAccepted(new Set(changedCells));
    onAcceptAll?.();
  };

  const reset = () => setAccepted(new Set());

  const toggleCell = (key: string) => {
    if (!changedCells.has(key)) return;
    setAccepted(s => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Shift Proposal Diff</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-mono">
              {totalChanges} changes · {acceptedCount} accepted
            </Badge>
          </div>
        </div>
        <CardDescription>AI-drafted shift plan compared to last week. Purple cells show changes — click to accept.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-3">
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={acceptAll}>
            <Check className="h-3 w-3" /> Accept all
          </Button>
          <Button variant="ghost" size="sm" className="text-xs gap-1.5" onClick={reset}>
            <RotateCcw className="h-3 w-3" /> Reset
          </Button>
        </div>

        <div className="overflow-x-auto">
          <div className="grid gap-1 min-w-[560px]" style={{ gridTemplateColumns: '80px repeat(7, 1fr)' }}>
            {/* Header */}
            <div />
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-mono text-muted-foreground uppercase py-1.5">
                {d}
              </div>
            ))}

            {/* Rows */}
            {STAFF.map((name, r) => (
              <React.Fragment key={name}>
                <div className="text-xs text-muted-foreground flex items-center px-1">{name}</div>
                {LAST_WEEK[r].map((v, c) => {
                  const key = cell(r, c);
                  const changed = changedCells.has(key);
                  const isAcc = accepted.has(key);
                  const reason = REASONS[key];
                  const display = changed && isAcc ? PROPOSED[r][c] : v;

                  const cellContent = (
                    <button
                      onClick={() => toggleCell(key)}
                      className={cn(
                        "text-center py-2.5 px-1 rounded-md text-xs font-mono transition-all",
                        changed
                          ? isAcc
                            ? "bg-primary text-primary-foreground font-semibold border border-primary"
                            : "bg-primary/10 text-primary border border-dashed border-primary/40 hover:bg-primary/20"
                          : "bg-muted/30 text-muted-foreground border border-transparent",
                        changed && "cursor-pointer"
                      )}
                      disabled={!changed}
                    >
                      {changed && !isAcc ? (
                        <span>
                          <span className="line-through opacity-40">{v}</span>
                          <span className="ml-0.5">→</span>
                          <span className="ml-0.5">{PROPOSED[r][c]}</span>
                        </span>
                      ) : display === '—' ? (
                        <span className="opacity-30">—</span>
                      ) : display}
                    </button>
                  );

                  if (reason) {
                    return (
                      <Tooltip key={c}>
                        <TooltipTrigger asChild>{cellContent}</TooltipTrigger>
                        <TooltipContent className="text-xs max-w-[200px]">
                          <span className="text-primary font-medium">AI rationale:</span> {reason}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }
                  return <div key={c}>{cellContent}</div>;
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="mt-3 p-2.5 rounded-lg bg-muted/30 border text-xs text-muted-foreground">
          <span className="text-primary font-mono">D</span> = Day ·{' '}
          <span className="text-primary font-mono">N</span> = Night ·{' '}
          <span className="text-primary font-mono">—</span> = Off.
          {' '}Click a changed cell to accept it. Hover for AI rationale.
        </div>
      </CardContent>
    </Card>
  );
}
