import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Lightbulb, Plus, Search, LayoutGrid, List, Sparkles, ArrowUp,
  X, Zap, MessageSquare, ChevronLeft, ChevronRight, Settings2,
  Shield, BarChart3, Users, Car, Hash
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Data ────────────────────────────────────────────────────────────────────

interface UpgradeIdea {
  id: string;
  title: string;
  pitch: string;
  category: string;
  module: string;
  impact: number;
  effort: number;
  votes: number;
  status: 'proposed' | 'approved' | 'applied' | 'rejected';
  tags: string[];
  why: string[];
  how: string[];
}

const UPGRADE_IDEAS: UpgradeIdea[] = [
  {
    id: "U-01", title: "Live Fleet Pulse on the Chat Rail",
    pitch: "Pin a compact, animated fleet status strip above the chat composer so operators never lose situational awareness while typing.",
    category: "workflow", module: "Chat · Fleet", impact: 5, effort: 2, votes: 47, status: "proposed",
    tags: ["ambient-ui", "situational-awareness", "fleet"],
    why: ["Chat is the main surface — today operators context-switch to Fleet to check counts.", "Stuck-in-QC and overdue-to-ready are the two failure modes that drive most late starts.", "An always-on strip makes the chat feel like a control room, not a messaging app."],
    how: ["5 compact pills: Ready, Cleaning, QC, Blocked, Rented — with deltas over last hour.", "Click a pill → composer auto-fills a slash command like /fleet status:qc.", "Collapsible to a single line on mobile; hidden in kiosk mode for washers."],
  },
  {
    id: "U-02", title: "Proposal Preview Mode",
    pitch: "When the Adaptive AI suggests a UI change, show it as a ghost overlay on the real page before staff commits.",
    category: "ai", module: "Adaptive AI", impact: 5, effort: 4, votes: 63, status: "approved",
    tags: ["ai-native", "trust", "governance"],
    why: ["The README promises AI-driven UI changes — trust is the blocker, not capability.", "A dry-run overlay lets staff feel the change in context before approving.", "Converts a scary capability (the AI edits the app) into a playful one."],
    how: ["AI response renders a diff card with 'Preview on page' button.", "Preview injects the proposed node with a dashed purple outline and 'ghost' opacity.", "Apply / Discard / Send to Proposals Hub — all audited with actor + diff hash."],
  },
  {
    id: "U-03", title: "Washer Kiosk — One-Tap Vehicle Intake",
    pitch: "Replace the washer login with a camera-first kiosk that reads the plate and pre-fills the cleaning intake.",
    category: "ux", module: "Washer", impact: 4, effort: 3, votes: 34, status: "proposed",
    tags: ["kiosk", "no-login", "computer-vision"],
    why: ["Washers work fast, often with wet hands, on shared tablets.", "Typing a plate is the slowest step in the current flow.", "Tokenized device scope is already in the architecture — pair with OCR."],
    how: ["Full-bleed viewfinder with a plate-shaped guide.", "On detect: show plate + vehicle card + 3 big action buttons (Start, Hold, Flag).", "Offline queue: stamp intake locally, sync when connection returns."],
  },
  {
    id: "U-04", title: "Shift Proposal Diffs",
    pitch: "Treat weekly shifts like code: the AI drafts a shift plan and staff review it as a visual diff against last week.",
    category: "workflow", module: "Shifts", impact: 4, effort: 3, votes: 29, status: "proposed",
    tags: ["planning", "ai-drafts", "review"],
    why: ["Coordinators spend hours manually rebuilding the same plan with small tweaks.", "Most weeks are 90% the same as the prior week — highlight only what changed.", "Makes AI contribution legible and reviewable, not magical."],
    how: ["Side-by-side grid: last week vs proposed; changed cells glow purple.", "Hover a change → AI rationale (coverage gap, overtime risk, requested swap).", "Accept cell, accept row, accept all — with an 'undo' trail."],
  },
  {
    id: "U-05", title: "Damage Report — Guided Photo Frames",
    pitch: "Replace the freeform upload with 8 guided photo slots (front, 4 corners, interior, odometer, fuel) and live coverage scoring.",
    category: "ux", module: "Customer App", impact: 5, effort: 2, votes: 51, status: "approved",
    tags: ["customer", "quality", "liability"],
    why: ["Unstructured photos lead to disputes the rental company can't win.", "Customers don't know what's needed; they upload 3 blurry shots.", "Coverage score gives both sides confidence the handover is documented."],
    how: ["8-up grid with silhouette overlays for each angle.", "Real-time completeness bar; submit disabled until ≥80%.", "Private chat thread attached to the reservation."],
  },
  {
    id: "U-06", title: "Command Palette, Slash Commands & Voice — Unified",
    pitch: "One command surface that opens from ⌘K, /, or a long-press on the mic — same grammar everywhere.",
    category: "ux", module: "Global", impact: 4, effort: 3, votes: 42, status: "proposed",
    tags: ["power-user", "keyboard", "voice"],
    why: ["Three separate interaction models today fragment muscle memory.", "Operational users move fast — one grammar lets them cross-train instantly.", "Voice is the same command tree, just spoken."],
    how: ["Shared registry (commandRegistry.ts already exists).", "Palette renders nested commands; slash inline; voice parses to the same nodes.", "Recent + suggested commands pinned per role."],
  },
  {
    id: "U-07", title: "Bottleneck Radar on the Dashboard",
    pitch: "A single visual that surfaces the one bottleneck costing the most ready-time today — and offers a fix.",
    category: "analytics", module: "Analytics", impact: 5, effort: 3, votes: 58, status: "proposed",
    tags: ["actionable", "ai-explanations", "radar"],
    why: ["Dashboards today show many numbers; staff want one sentence: what's broken?", "The data is there (SLA timers, turnaround, queue health) — the insight isn't.", "AI-generated explanations are already in the plan — ground them in this widget."],
    how: ["Single radial chart: time lost by stage (Return → Clean → QC → Ready).", "Biggest slice auto-highlighted with a plain-language one-liner.", "Two buttons: 'Message supervisor' and 'Open drill-down'."],
  },
  {
    id: "U-08", title: "Import Anomaly Cards",
    pitch: "After a reservation import, replace the log with a stack of anomaly cards the AI has already pre-triaged.",
    category: "workflow", module: "Imports", impact: 4, effort: 2, votes: 26, status: "proposed",
    tags: ["triage", "imports", "cards"],
    why: ["Operators skim logs for things that look wrong — tedious and error-prone.", "AI can cluster: duplicate bookings, missing fields, unknown vehicle classes.", "Each cluster becomes a swipeable card: accept, fix, escalate."],
    how: ["Card stack on Imports page; count badge in the chat pulse strip.", "Each card shows a mini-preview of affected rows and a suggested action.", "Keyboard: J/K to move, A to accept, E to escalate."],
  },
  {
    id: "U-09", title: "Role-Aware Home",
    pitch: "Dashboard adapts its first screen to the user's role: Coordinator sees coverage; Fleet agent sees queue; Supervisor sees exceptions.",
    category: "ux", module: "Dashboard", impact: 3, effort: 2, votes: 18, status: "proposed",
    tags: ["personalization", "roles", "first-screen"],
    why: ["Generic dashboards force every role to filter the same page.", "Roles are already in shared/roles.ts — use them as a layout hint, not just permissions.", "Low effort, compounding payoff every single shift."],
    how: ["Three curated layouts keyed on role.", "User can pin/unpin widgets; choices persist per role + device.", "Adaptive AI can propose new widgets based on what the user searches for."],
  },
  {
    id: "U-10", title: "Trust Ledger — a Visible Audit Timeline",
    pitch: "A human-readable timeline of every AI-driven change, with one-click revert and a 'who approved this' trail.",
    category: "governance", module: "Trust Console", impact: 4, effort: 3, votes: 39, status: "approved",
    tags: ["audit", "revert", "compliance"],
    why: ["Adaptive systems fail the compliance conversation without a legible audit.", "TrustConsole.tsx exists — surface it, don't hide it in settings.", "Makes 'AI edits the app' safe enough for an enterprise buyer to say yes."],
    how: ["Vertical timeline: actor avatar, change summary, before/after diff.", "Filter by actor (AI vs human), module, or date range.", "Revert with reason; revert itself is an entry on the ledger."],
  },
];

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode }> = {
  ai:         { label: "Adaptive AI",  icon: <Sparkles className="h-3.5 w-3.5" /> },
  workflow:   { label: "Workflow",     icon: <Zap className="h-3.5 w-3.5" /> },
  ux:         { label: "UX",           icon: <Users className="h-3.5 w-3.5" /> },
  analytics:  { label: "Analytics",    icon: <BarChart3 className="h-3.5 w-3.5" /> },
  governance: { label: "Governance",   icon: <Shield className="h-3.5 w-3.5" /> },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  proposed:  { label: "Proposed",  color: "bg-muted text-muted-foreground" },
  approved:  { label: "Approved",  color: "bg-primary/10 text-primary" },
  applied:   { label: "Applied",   color: "bg-emerald-500/10 text-emerald-500" },
  rejected:  { label: "Rejected",  color: "bg-destructive/10 text-destructive" },
};

// ─── Impact/Effort Meter ─────────────────────────────────────────────────────

function Meter({ value, max = 5, accent }: { value: number; max?: number; accent?: boolean }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={cn(
          "w-2.5 h-1 rounded-full",
          i < value
            ? accent ? "bg-primary" : "bg-foreground/60"
            : "bg-border"
        )} />
      ))}
    </span>
  );
}

// ─── Idea Card (Grid) ────────────────────────────────────────────────────────

function IdeaCard({ idea, onOpen, onVote, voted }: {
  idea: UpgradeIdea; onOpen: () => void; onVote: (id: string) => void; voted: boolean;
}) {
  const cat = CATEGORY_META[idea.category];
  const status = STATUS_META[idea.status];
  return (
    <Card
      className="cursor-pointer transition-all hover:border-primary/40 hover:-translate-y-0.5 group"
      onClick={onOpen}
    >
      <CardContent className="p-5 flex flex-col gap-3 h-full">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-muted-foreground">{idea.id}</span>
          <Badge variant="outline" className={cn("text-[10px] gap-1", status.color)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", idea.status === 'approved' ? 'bg-primary' : idea.status === 'applied' ? 'bg-emerald-500' : 'bg-muted-foreground')} />
            {status.label}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            {cat?.icon}
          </span>
          <span className="text-[11px] text-muted-foreground font-mono uppercase tracking-wider">
            {cat?.label} · {idea.module}
          </span>
        </div>

        <div>
          <h3 className="font-semibold text-[15px] leading-tight tracking-tight group-hover:text-primary transition-colors">
            {idea.title}
          </h3>
          <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2 text-pretty">
            {idea.pitch}
          </p>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-mono uppercase">Impact</span>
            <Meter value={idea.impact} accent />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-mono uppercase">Effort</span>
            <Meter value={idea.effort} />
          </div>
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <button
            onClick={(e) => { e.stopPropagation(); onVote(idea.id); }}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border transition-all",
              voted
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-transparent text-muted-foreground border-border hover:border-primary/30"
            )}
          >
            <ArrowUp className="h-3 w-3" />
            {idea.votes + (voted ? 1 : 0)}
          </button>
          <div className="flex gap-1.5">
            {idea.tags.slice(0, 2).map(t => (
              <span key={t} className="text-[11px] text-muted-foreground font-mono">#{t}</span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Matrix View (Impact × Effort scatter) ───────────────────────────────────

function IdeaMatrix({ ideas, onOpen, hoveredId, setHoveredId }: {
  ideas: UpgradeIdea[]; onOpen: (i: UpgradeIdea) => void;
  hoveredId: string | null; setHoveredId: (id: string | null) => void;
}) {
  const size = 480;
  const pad = 52;
  const cell = (size - pad * 2) / 4;
  const pos = (impact: number, effort: number) => ({
    x: pad + (effort - 1) * cell,
    y: pad + (5 - impact) * cell,
  });

  return (
    <Card className="p-6">
      <div className="flex justify-between items-baseline mb-4">
        <div>
          <h3 className="font-semibold text-sm">Impact × Effort</h3>
          <p className="text-xs text-muted-foreground mt-1">Top-left is the sweet spot. Click a node to open.</p>
        </div>
        <span className="font-mono text-xs text-muted-foreground">{ideas.length} ideas</span>
      </div>
      <div className="relative w-full max-w-[480px] mx-auto aspect-square">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
          <rect x={pad} y={pad} width={cell * 2} height={cell * 2} className="fill-primary/5" />
          {[0,1,2,3,4].map(i => (
            <g key={i}>
              <line x1={pad} y1={pad + i*cell} x2={pad + cell*4} y2={pad + i*cell} className="stroke-border" strokeWidth="1" />
              <line x1={pad + i*cell} y1={pad} x2={pad + i*cell} y2={pad + cell*4} className="stroke-border" strokeWidth="1" />
            </g>
          ))}
          <text x={pad - 8} y={pad + 4} textAnchor="end" fontSize="9" className="fill-muted-foreground font-mono">high</text>
          <text x={pad - 8} y={pad + cell*4 + 4} textAnchor="end" fontSize="9" className="fill-muted-foreground font-mono">low</text>
          <text x={pad} y={pad + cell*4 + 16} fontSize="9" className="fill-muted-foreground font-mono">low effort</text>
          <text x={pad + cell*4} y={pad + cell*4 + 16} textAnchor="end" fontSize="9" className="fill-muted-foreground font-mono">high effort</text>
          {ideas.map((idea) => {
            const { x, y } = pos(idea.impact, idea.effort);
            const isHover = hoveredId === idea.id;
            return (
              <g key={idea.id}
                onMouseEnter={() => setHoveredId(idea.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onOpen(idea)}
                className="cursor-pointer">
                <circle cx={x} cy={y} r={isHover ? 16 : 12}
                  className={cn(isHover ? "fill-primary" : "fill-card", "stroke-primary transition-all")}
                  strokeWidth={isHover ? 2 : 1.5} />
                <text x={x} y={y + 4} textAnchor="middle" fontSize="9"
                  className={cn("font-mono pointer-events-none", isHover ? "fill-white" : "fill-primary")}>
                  {idea.id.replace("U-", "")}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </Card>
  );
}

function MatrixLegend({ ideas, onOpen, hoveredId, setHoveredId }: {
  ideas: UpgradeIdea[]; onOpen: (i: UpgradeIdea) => void;
  hoveredId: string | null; setHoveredId: (id: string | null) => void;
}) {
  const sorted = [...ideas].sort((a, b) => (b.impact - b.effort) - (a.impact - a.effort));
  return (
    <Card className="p-5">
      <h3 className="font-semibold text-sm">Ranked by leverage</h3>
      <p className="text-xs text-muted-foreground mt-1 mb-3">impact − effort, descending</p>
      <div className="flex flex-col gap-0.5">
        {sorted.map((i, idx) => (
          <div key={i.id}
            onClick={() => onOpen(i)}
            onMouseEnter={() => setHoveredId(i.id)}
            onMouseLeave={() => setHoveredId(null)}
            className={cn(
              "grid grid-cols-[28px_36px_1fr_auto] items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors",
              hoveredId === i.id && "bg-muted"
            )}>
            <span className="font-mono text-[11px] text-muted-foreground">{idx+1}.</span>
            <span className="font-mono text-[11px] text-primary">{i.id}</span>
            <span className="text-sm truncate">{i.title}</span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {i.impact > i.effort ? "+" : ""}{i.impact - i.effort}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── List View ───────────────────────────────────────────────────────────────

function IdeaList({ ideas, onOpen, onVote, votedIds }: {
  ideas: UpgradeIdea[]; onOpen: (i: UpgradeIdea) => void;
  onVote: (id: string) => void; votedIds: Set<string>;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-[60px_1fr_130px_100px_100px_70px] px-4 py-2.5 border-b text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
        <span>ID</span><span>Title</span><span>Module</span><span>Impact</span><span>Effort</span><span className="text-right">Votes</span>
      </div>
      {ideas.map((idea, i) => {
        const voted = votedIds.has(idea.id);
        return (
          <div key={idea.id}
            onClick={() => onOpen(idea)}
            className={cn(
              "grid grid-cols-[60px_1fr_130px_100px_100px_70px] px-4 py-3 items-center cursor-pointer transition-colors hover:bg-muted/50",
              i < ideas.length - 1 && "border-b"
            )}>
            <span className="font-mono text-xs text-muted-foreground">{idea.id}</span>
            <div>
              <div className="font-medium text-sm">{idea.title}</div>
              <div className="text-xs text-muted-foreground line-clamp-1">{idea.pitch}</div>
            </div>
            <span className="text-xs text-muted-foreground">{idea.module}</span>
            <Meter value={idea.impact} accent />
            <Meter value={idea.effort} />
            <div className="flex justify-end">
              <button
                onClick={(e) => { e.stopPropagation(); onVote(idea.id); }}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono border",
                  voted ? "bg-primary/10 text-primary border-primary/30" : "border-border text-muted-foreground"
                )}
              >
                <ArrowUp className="h-3 w-3" /> {idea.votes + (voted ? 1 : 0)}
              </button>
            </div>
          </div>
        );
      })}
    </Card>
  );
}

// ─── Detail Drawer ───────────────────────────────────────────────────────────

function DetailDrawer({ idea, voted, onClose, onVote, onStatusChange }: {
  idea: UpgradeIdea; voted: boolean; onClose: () => void;
  onVote: (id: string) => void; onStatusChange: (id: string, status: string) => void;
}) {
  const cat = CATEGORY_META[idea.category];
  const status = STATUS_META[idea.status];

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-[540px] flex flex-col p-0">
        <SheetHeader className="p-5 pb-4 border-b">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              {cat?.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs text-muted-foreground">{idea.id}</span>
                <span className="w-1 h-1 rounded-full bg-border" />
                <span className="text-[11px] text-muted-foreground font-mono uppercase tracking-wider">
                  {cat?.label} · {idea.module}
                </span>
              </div>
              <SheetTitle className="text-lg font-semibold leading-tight tracking-tight text-pretty">
                {idea.title}
              </SheetTitle>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 p-5">
          <p className="text-sm text-muted-foreground leading-relaxed text-pretty mb-5">
            {idea.pitch}
          </p>

          <div className="grid grid-cols-2 gap-2.5 mb-5">
            <div className="p-3 rounded-lg bg-muted/50 border">
              <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-1.5">Impact</div>
              <Meter value={idea.impact} accent />
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border">
              <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-1.5">Effort</div>
              <Meter value={idea.effort} />
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border">
              <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-1.5">Status</div>
              <Badge variant="outline" className={cn("text-[10px]", status.color)}>{status.label}</Badge>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border">
              <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-1.5">Upvotes</div>
              <span className="text-sm font-mono">{idea.votes + (voted ? 1 : 0)}</span>
            </div>
          </div>

          <SectionHeader>Why this matters</SectionHeader>
          <ul className="space-y-2 mb-5">
            {idea.why.map((b, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-muted-foreground leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                {b}
              </li>
            ))}
          </ul>

          <SectionHeader>How we'd ship it</SectionHeader>
          <ul className="space-y-2 mb-5">
            {idea.how.map((b, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-muted-foreground leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                {b}
              </li>
            ))}
          </ul>

          <SectionHeader>Tags</SectionHeader>
          <div className="flex gap-1.5 flex-wrap">
            {idea.tags.map(t => (
              <Badge key={t} variant="outline" className="text-[11px] font-mono">#{t}</Badge>
            ))}
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-muted/30 flex items-center gap-2">
          <Button
            variant={voted ? "default" : "outline"} size="sm"
            className="gap-1.5"
            onClick={() => onVote(idea.id)}
          >
            <ArrowUp className="h-3.5 w-3.5" />
            {voted ? "Upvoted" : "Upvote"} · {idea.votes + (voted ? 1 : 0)}
          </Button>
          <div className="flex-1" />
          {idea.status === "proposed" && (
            <Button size="sm" className="gap-1.5" onClick={() => onStatusChange(idea.id, "approved")}>
              <Sparkles className="h-3.5 w-3.5" /> Approve
            </Button>
          )}
          {idea.status === "approved" && (
            <Button size="sm" className="gap-1.5" onClick={() => onStatusChange(idea.id, "applied")}>
              <Zap className="h-3.5 w-3.5" /> Mark applied
            </Button>
          )}
          {idea.status === "applied" && (
            <Button variant="outline" size="sm" disabled className="gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Applied
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider font-medium mb-2.5 mt-5 first:mt-0">
      {children}
    </h4>
  );
}

// ─── New Idea Dialog ─────────────────────────────────────────────────────────

function NewIdeaDialog({ open, onClose, onCreate }: {
  open: boolean; onClose: () => void;
  onCreate: (idea: UpgradeIdea) => void;
}) {
  const [title, setTitle] = useState("");
  const [pitch, setPitch] = useState("");
  const [category, setCategory] = useState("workflow");
  const [module, setModule] = useState("");
  const [impact, setImpact] = useState([3]);
  const [effort, setEffort] = useState([3]);

  const submit = () => {
    if (!title.trim() || !pitch.trim()) return;
    onCreate({
      id: "U-" + String(Math.floor(Math.random() * 90) + 10),
      title: title.trim(), pitch: pitch.trim(), category,
      module: module.trim() || "Global",
      impact: impact[0], effort: effort[0], votes: 1, status: "proposed",
      tags: ["new"], why: [pitch.trim()], how: ["(to be drafted)"],
    });
    setTitle(""); setPitch(""); setModule("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>New upgrade idea</DialogTitle>
          <p className="text-sm text-muted-foreground">Lightweight — refine it later in the detail drawer.</p>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5 block">Title</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Vehicle Timeline Gestures" />
          </div>
          <div>
            <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5 block">One-line pitch</label>
            <Textarea value={pitch} onChange={e => setPitch(e.target.value)} rows={2} placeholder="What changes and why it's worth it?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5 block">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_META).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5 block">Module</label>
              <Input value={module} onChange={e => setModule(e.target.value)} placeholder="e.g. Fleet · Chat" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Impact — {impact[0]}/5
              </label>
              <Slider value={impact} onValueChange={setImpact} min={1} max={5} step={1} />
            </div>
            <div>
              <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Effort — {effort[0]}/5
              </label>
              <Slider value={effort} onValueChange={setEffort} min={1} max={5} step={1} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={!title.trim() || !pitch.trim()} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Create idea
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Ask AI Drawer ───────────────────────────────────────────────────────────

function AskAIDrawer({ open, onClose, ideas }: {
  open: boolean; onClose: () => void; ideas: UpgradeIdea[];
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{ role: 'ai' | 'user'; text: string }>>([
    { role: "ai", text: "Hi — I'm the curator. Ask me which ideas to ship first, or request a new one." },
  ]);

  const canned = useCallback((q: string) => {
    const ql = q.toLowerCase();
    if (ql.includes("ship") || ql.includes("first") || ql.includes("priorit")) {
      const top = [...ideas].sort((a, b) => (b.impact - b.effort) - (a.impact - a.effort)).slice(0, 3);
      return `By impact-minus-effort, I'd ship these first:\n\n${top.map(t => `• ${t.id} — ${t.title}`).join("\n")}`;
    }
    if (ql.includes("washer")) return "Two washer ideas on the board: U-03 (one-tap intake) is the fastest win — plate-OCR + 3 big buttons, kiosk-friendly.";
    if (ql.includes("customer") || ql.includes("damage")) return "U-05 (Guided Photo Frames) is my pick for the customer app — it converts an unstructured upload into 8 labeled slots with a coverage score.";
    if (ql.includes("ai")) return "U-02 (Proposal Preview Mode) is the unlock — it turns the scary 'AI edits the app' capability into a reviewable diff. Pair it with U-10 (Trust Ledger) and you have an enterprise-ready story.";
    return `I found ${ideas.length} ideas matching the current filters. The highest-leverage one is U-01 (Live Fleet Pulse): impact 5, effort 2.`;
  }, [ideas]);

  const send = () => {
    const q = input.trim();
    if (!q) return;
    const next = [...messages, { role: "user" as const, text: q }];
    setMessages(next);
    setInput("");
    setTimeout(() => {
      setMessages([...next, { role: "ai" as const, text: canned(q) }]);
    }, 400);
  };

  if (!open) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-[400px] flex flex-col p-0">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div className="flex-1">
              <SheetTitle className="text-sm">Adaptive curator</SheetTitle>
              <p className="text-[11px] text-muted-foreground font-mono">suggests · sequences · explains</p>
            </div>
          </div>
        </SheetHeader>
        <ScrollArea className="flex-1 p-4">
          <div className="flex flex-col gap-3">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex gap-2.5", m.role === "user" && "justify-end")}>
                {m.role === "ai" && (
                  <span className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0 text-[10px]">
                    <Sparkles className="h-3 w-3" />
                  </span>
                )}
                <div className={cn(
                  "max-w-[82%] px-3 py-2 rounded-lg text-sm leading-relaxed whitespace-pre-wrap",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted border"
                )}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="p-3 border-t flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") send(); }}
            placeholder="Which upgrades should we ship first?"
            className="text-sm"
          />
          <Button size="sm" onClick={send}>Send</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Stat Tile ───────────────────────────────────────────────────────────────

function StatTile({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="px-3.5 py-2.5 rounded-xl border bg-card min-w-[120px]">
      <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{label}</div>
      <div className="text-xl font-semibold tracking-tight mt-0.5">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────

export default function IdeasHub() {
  const [ideas, setIdeas] = useState<UpgradeIdea[]>(UPGRADE_IDEAS);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "matrix" | "list">("grid");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showChat, setShowChat] = useState(false);

  // ⌘K focuses search
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = document.querySelector<HTMLInputElement>("input[placeholder*='Search ideas']");
        if (el) el.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of ideas) c[i.category] = (c[i.category] || 0) + 1;
    return c;
  }, [ideas]);

  const filtered = useMemo(() => {
    return ideas.filter(i => {
      if (activeCategory !== "all" && i.category !== activeCategory) return false;
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const hay = `${i.title} ${i.pitch} ${i.module} ${i.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [ideas, activeCategory, statusFilter, query]);

  const vote = (id: string) => {
    setVotedIds(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const changeStatus = (id: string, status: string) => {
    setIdeas(xs => xs.map(x => x.id === id ? { ...x, status: status as UpgradeIdea['status'] } : x));
  };

  const createIdea = (newIdea: UpgradeIdea) => {
    setIdeas(xs => [newIdea, ...xs]);
    setSelectedId(newIdea.id);
  };

  const selected = ideas.find(i => i.id === selectedId) || null;
  const totalVotes = ideas.reduce((s, i) => s + i.votes, 0) + votedIds.size;

  const categories = [
    { key: "all", label: "All upgrades", count: ideas.length },
    { key: "ai", label: "Adaptive AI", count: counts.ai || 0 },
    { key: "workflow", label: "Workflow", count: counts.workflow || 0 },
    { key: "ux", label: "UX", count: counts.ux || 0 },
    { key: "analytics", label: "Analytics", count: counts.analytics || 0 },
    { key: "governance", label: "Governance", count: counts.governance || 0 },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 px-5 py-3 border-b bg-card flex items-center gap-3 flex-wrap">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-base font-semibold tracking-tight">Upgrade Ideas</h1>
          <span className="text-[11px] text-muted-foreground font-mono hidden sm:inline">curator · v0.5</span>
        </div>
        <div className="flex-1 min-w-3" />

        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border w-full sm:w-auto sm:min-w-[220px] sm:max-w-[280px]">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search ideas, modules, tags…"
            className="flex-1 bg-transparent border-none outline-none text-sm"
          />
          <kbd className="hidden sm:inline font-mono text-[10px] text-muted-foreground px-1.5 py-0.5 rounded border">⌘K</kbd>
        </div>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="proposed">Proposed</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="applied">Applied</SelectItem>
          </SelectContent>
        </Select>

        {/* View switcher */}
        <div className="flex border rounded-lg p-0.5 bg-muted/50">
          <Tooltip><TooltipTrigger asChild>
            <button onClick={() => setViewMode("grid")} className={cn("p-1.5 rounded-md transition-colors", viewMode === "grid" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger><TooltipContent>Grid</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild>
            <button onClick={() => setViewMode("matrix")} className={cn("p-1.5 rounded-md transition-colors", viewMode === "matrix" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
              <BarChart3 className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger><TooltipContent>Matrix</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild>
            <button onClick={() => setViewMode("list")} className={cn("p-1.5 rounded-md transition-colors", viewMode === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
              <List className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger><TooltipContent>List</TooltipContent></Tooltip>
        </div>

        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowChat(true)}>
          <MessageSquare className="h-3.5 w-3.5" /> Ask AI
        </Button>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setShowNew(true)}>
          <Plus className="h-3.5 w-3.5" /> New idea
        </Button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Category sidebar */}
        <aside className="hidden lg:flex w-[210px] shrink-0 border-r flex-col p-3 gap-1 overflow-y-auto bg-muted/20">
          <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider px-2 pb-1.5 pt-2">
            Upgrade tracks
          </div>
          {categories.map(c => (
            <button key={c.key}
              onClick={() => setActiveCategory(c.key)}
              className={cn(
                "flex items-center gap-2 w-full text-left px-2.5 py-1.5 rounded-md text-sm transition-colors",
                activeCategory === c.key
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <span className="flex-1">{c.label}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{c.count}</span>
            </button>
          ))}

          <Separator className="my-3" />
          <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider px-2 pb-1.5">
            Modules
          </div>
          {[
            { icon: <MessageSquare className="h-3 w-3" />, label: "Chat · Fleet" },
            { icon: <Sparkles className="h-3 w-3" />, label: "Adaptive AI" },
            { icon: <Car className="h-3 w-3" />, label: "Washer / Fleet" },
            { icon: <Users className="h-3 w-3" />, label: "Customer App" },
            { icon: <BarChart3 className="h-3 w-3" />, label: "Analytics" },
            { icon: <Shield className="h-3 w-3" />, label: "Governance" },
          ].map((m, i) => (
            <div key={i} className="flex items-center gap-2 px-2.5 py-1 text-xs text-muted-foreground">
              {m.icon}{m.label}
            </div>
          ))}

          <div className="flex-1" />
          <div className="mt-3 p-3 rounded-lg bg-card border text-[11px] text-muted-foreground leading-relaxed">
            <div className="text-foreground font-medium text-xs mb-1">Curator note</div>
            10 upgrade ideas grounded in the README. Upvote the ones worth pursuing; use the matrix to weigh them.
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Stats strip */}
          <div className="px-5 pt-4 pb-1 flex gap-2.5 items-stretch flex-wrap shrink-0">
            <StatTile label="Ideas" value={ideas.length} hint="curated from README" />
            <StatTile label="Votes" value={totalVotes} hint="staff + your upvotes" />
            <StatTile label="Approved" value={ideas.filter(i => i.status === "approved").length} hint="ready for sprint" />
            <StatTile label="Avg. impact" value={(ideas.reduce((s,i) => s + i.impact, 0) / ideas.length).toFixed(1)} hint="on a 1–5 scale" />
            <div className="flex-1" />
            <div className="hidden xl:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-mono">
              <Sparkles className="h-3.5 w-3.5" /> Curator mode active
            </div>
          </div>

          {/* Body */}
          <ScrollArea className="flex-1 px-5 pb-6 pt-4">
            {filtered.length === 0 ? (
              <div className="border border-dashed rounded-xl p-16 flex flex-col items-center justify-center text-center text-muted-foreground">
                <Lightbulb className="h-8 w-8 mb-3 opacity-30" />
                <div className="text-sm font-medium text-foreground mb-1">No ideas match these filters</div>
                <div className="text-xs">Try clearing the search, or switch to All upgrades.</div>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {filtered.map(idea => (
                  <IdeaCard key={idea.id} idea={idea}
                    onOpen={() => setSelectedId(idea.id)}
                    onVote={vote}
                    voted={votedIds.has(idea.id)}
                  />
                ))}
              </div>
            ) : viewMode === "matrix" ? (
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,580px)_1fr] gap-4 items-start">
                <IdeaMatrix ideas={filtered} onOpen={(i) => setSelectedId(i.id)} hoveredId={hoveredId} setHoveredId={setHoveredId} />
                <MatrixLegend ideas={filtered} onOpen={(i) => setSelectedId(i.id)} hoveredId={hoveredId} setHoveredId={setHoveredId} />
              </div>
            ) : (
              <IdeaList ideas={filtered} onOpen={(i) => setSelectedId(i.id)} onVote={vote} votedIds={votedIds} />
            )}
          </ScrollArea>
        </main>
      </div>

      {/* Drawers & Dialogs */}
      {selected && (
        <DetailDrawer
          idea={selected}
          voted={votedIds.has(selected.id)}
          onClose={() => setSelectedId(null)}
          onVote={vote}
          onStatusChange={changeStatus}
        />
      )}
      <NewIdeaDialog open={showNew} onClose={() => setShowNew(false)} onCreate={createIdea} />
      <AskAIDrawer open={showChat} onClose={() => setShowChat(false)} ideas={ideas} />
    </div>
  );
}
