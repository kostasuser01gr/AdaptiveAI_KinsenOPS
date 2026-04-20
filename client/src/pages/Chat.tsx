import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '@/lib/AppContext';
import { useAuth } from '@/lib/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { useLocation } from 'wouter';
import {
  ChevronDown, Bot, Zap,
  Car, Droplets, CalendarDays, Shield, Brain, BarChart3,
  Slash, AtSign, ArrowRight,
  LayoutGrid, Lightbulb, Package,
  PanelLeft, Settings2,
  Search, Database
} from 'lucide-react';
import { useUserTabs, useTabWidgets, useWidgetCatalog } from '@/hooks/useTabWidgets';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

import type { LocalMessage, SlashCommand } from './chat/types';
import { useChatSSE } from './chat/useChatSSE';
import { ChatConversationSidebar } from '@/components/chat/ChatConversationSidebar';
import { ChatMessageList } from '@/components/chat/ChatMessageList';
import { ChatInput } from '@/components/chat/ChatInput';
import { FleetPulseStrip } from '@/components/chat/FleetPulseStrip';

function makeWelcomeMessages(displayName?: string): LocalMessage[] {
  return [
    {
      id: 'sys-build-1', role: 'system',
      content: 'Builder Mode Active. You can ask me to add buttons, create dashboards, or reshape this workspace.',
      timestamp: new Date()
    },
    {
      id: '1', role: 'assistant',
      content: `Hello ${displayName || 'there'}! I am the DriveAI Builder.\n\nI can adapt this platform to your workflows. Try:\n- Type \`/\` for slash commands (fleet status, wash queue, shift check, etc.)\n- Mention entities with \`@\` (e.g. @YHA-1234)\n- "Add a button to report a late return"\n- "Create a weekend projections view"\n- "Reorganize the sidebar for morning shift"`,
      timestamp: new Date()
    }
  ];
}

export default function ChatPage() {
  const { sidebarOpen, isMobile, setCustomActions } = useApp();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [input, setInput] = useState('');
  const [model, setModel] = useState('DriveAI-Builder');
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [showConvSidebar, setShowConvSidebar] = useState(true);
  const [messages, setMessages] = useState<LocalMessage[]>(() => makeWelcomeMessages(user?.displayName));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const cmdTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ─── Data queries ───
  const { data: conversations = [] } = useQuery<Array<{ id: number; title: string; createdAt: string }>>({
    queryKey: queryKeys.conversations.all(),
    enabled: !!user,
  });

  const { data: customActionsData } = useQuery({
    queryKey: queryKeys.customActions.all(),
    enabled: !!user,
  });

  const { data: dashStats } = useQuery<{
    vehicles: number; washQueue: number; shifts: number; users: number;
    stations: number; automations: number; warRooms: number;
    unreadNotifications: number; pendingShiftRequests: number;
  }>({
    queryKey: queryKeys.dashboard.stats(),
    enabled: !!user,
  });

  // ─── SSE hook ───
  const { callAI, isTyping, setIsTyping, pipelineSteps } = useChatSSE({
    activeConversationId,
    setActiveConversationId,
    model,
    dashStats,
  });

  // ─── Widget system ───
  const { tabs, createTab } = useUserTabs();
  const { catalog } = useWidgetCatalog();
  const firstTab = tabs[0] ?? null;
  const { addWidget: addWidgetToTab } = useTabWidgets(firstTab?.id ?? null);

  // ─── Sync custom actions ───
  useEffect(() => {
    if (customActionsData && Array.isArray(customActionsData)) {
      setCustomActions(customActionsData.map((a: any) => ({
        id: a.id, label: a.label, icon: a.icon, target: a.target,
      })));
    }
  }, [customActionsData, setCustomActions]);

  // ─── Auto-scroll ───
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // ─── Read ?prompt= from URL (e.g. command palette → chat handoff) ───
  const urlPromptHandled = useRef(false);
  const [pendingAutoSend, setPendingAutoSend] = useState(false);
  useEffect(() => {
    if (urlPromptHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    const prompt = params.get('prompt');
    if (!prompt) { urlPromptHandled.current = true; return; }
    urlPromptHandled.current = true;
    setInput(prompt);
    if (params.get('send') === '1') setPendingAutoSend(true);
    params.delete('prompt'); params.delete('send');
    const newSearch = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (newSearch ? `?${newSearch}` : ''));
  }, []);

  // ─── Mutations ───
  const deleteConvMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/conversations/${id}`); },
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all() });
      if (activeConversationId === deletedId) {
        setActiveConversationId(null);
        setMessages(makeWelcomeMessages(user?.displayName));
      }
    },
    onError: (err: Error) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const createProposalMutation = useMutation({
    mutationFn: async (data: { type: string; label: string; description?: string; impact: string; scope: string; payload: Record<string, unknown> }) => {
      const res = await apiRequest("POST", "/api/proposals", data);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.proposals.all() }); },
    onError: (err: Error) => toast({ title: "Proposal failed", description: err.message, variant: "destructive" }),
  });

  const applyProposalMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/proposals/${id}/apply`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customActions.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.proposals.all() });
    },
    onError: (err: Error) => toast({ title: "Apply failed", description: err.message, variant: "destructive" }),
  });

  // ─── Conversation management ───
  const loadConversation = async (convId: number) => {
    if (convId === activeConversationId) return;
    setActiveConversationId(convId);
    try {
      const res = await apiRequest("GET", `/api/conversations/${convId}/messages`);
      if (!res.ok) return;
      const dbMessages: Array<{ id: number; role: string; content: string; createdAt: string }> = await res.json();
      const loaded: LocalMessage[] = dbMessages.map(m => ({
        id: String(m.id),
        role: m.role as LocalMessage['role'],
        content: m.content,
        timestamp: new Date(m.createdAt),
      }));
      setMessages(loaded.length > 0 ? loaded : [{
        id: 'empty', role: 'assistant', content: 'This conversation is empty. Send a message to get started.',
        timestamp: new Date(),
      }]);
    } catch { /* keep current messages on error */ }
  };

  const startNewConversation = () => {
    setActiveConversationId(null);
    setMessages(makeWelcomeMessages(user?.displayName));
  };

  // ─── Handlers ───
  const addToolCallMessage = (tool: string, result: string) => {
    const id = (Date.now() + Math.random()).toString();
    setMessages(prev => [...prev, {
      id, role: 'tool_call', content: '', timestamp: new Date(),
      toolCall: { tool, status: 'complete', result }
    }]);
  };

  const addAssistantMessage = (content: string, entities?: LocalMessage['entities']) => {
    const id = (Date.now() + Math.random()).toString();
    setMessages(prev => [...prev, {
      id, role: 'assistant', content, timestamp: new Date(), entities
    }]);
    setIsTyping(false);
  };

  const handlePinToTab = async (widgetSlug: string, widgetName: string) => {
    try {
      let targetTab = firstTab;
      if (!targetTab) {
        const res = await createTab.mutateAsync({ label: 'Chat Widgets', template: undefined });
        targetTab = res as any;
      }
      const def = catalog.find(c => c.slug === widgetSlug);
      await addWidgetToTab.mutateAsync({
        widgetSlug, x: 0, y: 0, w: def?.defaultW ?? 4, h: def?.defaultH ?? 3,
      });
      toast({ title: 'Pinned to workspace', description: `${widgetName} added to "${targetTab?.label || 'Chat Widgets'}" tab.` });
    } catch {
      toast({ title: 'Failed to pin', variant: 'destructive' });
    }
  };

  const handleToolCall = (toolName: string, params: Record<string, unknown>) => {
    const instruction = `Use the ${toolName} tool with these parameters: ${JSON.stringify(params)}`;
    const userMsg: LocalMessage = {
      id: Date.now().toString(), role: 'user', content: instruction, timestamp: new Date(),
    };
    setMessages(prev => {
      const updated = [...prev, userMsg];
      setIsTyping(true);
      callAI(instruction, updated, setMessages);
      return updated;
    });
  };

  const handleDrillDown = (prompt: string) => {
    const userMsg: LocalMessage = {
      id: Date.now().toString(), role: 'user', content: prompt, timestamp: new Date(),
    };
    setMessages(prev => {
      const updated = [...prev, userMsg];
      setIsTyping(true);
      callAI(prompt, updated, setMessages);
      return updated;
    });
  };

  const handleApplyProposal = async (proposal: NonNullable<LocalMessage['proposal']>) => {
    try {
      const created = await createProposalMutation.mutateAsync({
        type: proposal.type, label: proposal.label, description: proposal.previewText,
        impact: proposal.type === 'workflow' ? 'medium' : 'low', scope: 'personal',
        payload: { icon: proposal.icon, target: proposal.target, placement: 'header' },
      });
      if (created.scope === 'personal' && created.impact === 'low') {
        await applyProposalMutation.mutateAsync(created.id);
        toast({ title: "Workspace Updated", description: `Successfully added "${proposal.label}" to the interface.` });
        setMessages(prev => [...prev, {
          id: Date.now().toString(), role: 'system',
          content: `Applied: Added new action "${proposal.label}". It's now live in your header. This change is audited and reversible.`,
          timestamp: new Date()
        }]);
      } else {
        toast({ title: "Proposal Submitted", description: `"${proposal.label}" requires admin approval before applying.` });
        setMessages(prev => [...prev, {
          id: Date.now().toString(), role: 'system',
          content: `Proposal "${proposal.label}" submitted for review. An admin or supervisor must approve it before it takes effect.`,
          timestamp: new Date()
        }]);
      }
    } catch {
      toast({ title: "Error", description: "Failed to apply changes.", variant: "destructive" });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Message copied to clipboard." });
  };

  const regenerateLastResponse = (msgId: string) => {
    const msgIndex = messages.findIndex(m => m.id === msgId);
    if (msgIndex < 0) return;
    const lastUserMsg = [...messages].slice(0, msgIndex).reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return;
    setMessages(prev => prev.filter(m => m.id !== msgId));
    setIsTyping(true);
    callAI(lastUserMsg.content, messages.filter(m => m.id !== msgId), setMessages);
  };

  // ─── Slash commands ───
  const slashCommands: SlashCommand[] = useMemo(() => [
    {
      command: '/fleet', label: 'Fleet Status', description: 'Get current fleet overview',
      icon: <Car className="h-4 w-4" />,
      handler: () => { setIsTyping(true); callAI('Give me the current fleet status overview. Use the fleet_summary and list_vehicles tools.', messages, setMessages); }
    },
    {
      command: '/wash', label: 'Wash Queue', description: 'Check wash queue status',
      icon: <Droplets className="h-4 w-4" />,
      handler: () => { setIsTyping(true); callAI('Check the wash queue status. Use list_wash_queue and get_overdue_washes tools to show me what needs attention.', messages, setMessages); }
    },
    {
      command: '/shifts', label: 'Shift Check', description: "Today's shift coverage",
      icon: <CalendarDays className="h-4 w-4" />,
      handler: () => { setIsTyping(true); callAI('Check shift coverage. Use list_shifts and list_shift_requests to show me the current schedule and any pending requests.', messages, setMessages); }
    },
    {
      command: '/stats', label: 'Dashboard Stats', description: 'Full platform statistics',
      icon: <BarChart3 className="h-4 w-4" />,
      handler: () => { setIsTyping(true); callAI('Show me full platform statistics. Use get_dashboard_stats and get_analytics_summary to give a comprehensive overview.', messages, setMessages); }
    },
    {
      command: '/navigate', label: 'Navigate', description: 'Go to any module',
      icon: <ArrowRight className="h-4 w-4" />,
      handler: (args: string) => {
        const routes: Record<string, string> = {
          fleet: '/fleet', wash: '/washers', shifts: '/shifts', twin: '/digital-twin',
          analytics: '/analytics', executive: '/executive', trust: '/trust',
          war: '/war-room', memory: '/workspace-memory', automations: '/automations',
          imports: '/imports', calendar: '/calendar', settings: '/settings',
          knowledge: '/knowledge', users: '/users', inbox: '/inbox',
        };
        const route = routes[args.trim().toLowerCase()];
        if (route) { navigate(route); return; }
        addAssistantMessage(`Available modules: ${Object.keys(routes).join(', ')}. Try: /navigate fleet`);
      }
    },
    {
      command: '/warroom', label: 'War Room', description: 'Check active incidents',
      icon: <Shield className="h-4 w-4" />,
      handler: () => { setIsTyping(true); callAI('Check active war rooms and incidents. Use list_war_rooms and list_incidents to show me what needs attention.', messages, setMessages); }
    },
    {
      command: '/memory', label: 'AI Memory', description: 'Query workspace knowledge',
      icon: <Brain className="h-4 w-4" />,
      handler: (args: string) => {
        const prompt = args
          ? `Search workspace memory for: "${args}". Use get_workspace_memory and search tools.`
          : 'Show me what\'s stored in workspace memory. Use get_workspace_memory.';
        setIsTyping(true);
        callAI(prompt, messages, setMessages);
      }
    },
    {
      command: '/vehicle', label: 'Vehicle Lookup', description: 'Look up a vehicle by plate',
      icon: <Car className="h-4 w-4" />,
      handler: (args: string) => {
        const plate = args.trim().toUpperCase();
        if (!plate) { addAssistantMessage('Usage: `/vehicle <plate>` — e.g. `/vehicle YHA-1234`'); return; }
        setIsTyping(true);
        callAI(`Look up vehicle with plate "${plate}". Use search or list_vehicles to find it, then use get_vehicle to show full details.`, messages, setMessages);
      }
    },
    {
      command: '/incident', label: 'Report Incident', description: 'Create an incident report',
      icon: <Shield className="h-4 w-4" />,
      handler: (args: string) => {
        if (!args.trim()) { addAssistantMessage('Usage: `/incident <description>` — e.g. `/incident Customer reports damage on YHA-1234`'); return; }
        setIsTyping(true);
        callAI(`Create an incident report: "${args.trim()}". Use create_incident to file it with appropriate severity and category based on the description.`, messages, setMessages);
      }
    },
    {
      command: '/widget', label: 'Preview Widget', description: 'Show a live widget inline',
      icon: <Package className="h-4 w-4" />,
      handler: (args: string) => {
        const slug = args.trim().toLowerCase() || 'fleet-status';
        const def = catalog.find(c => c.slug === slug);
        if (!def) {
          addAssistantMessage(`Widget "${slug}" not found. Available: ${catalog.map(c => c.slug).join(', ')}`);
          return;
        }
        addToolCallMessage('Widget.render()', `Rendering: ${def.name}`);
        setTimeout(() => {
          const id = (Date.now() + Math.random()).toString();
          setMessages(prev => [...prev, {
            id, role: 'assistant', content: `Here's a live preview of **${def.name}**:`,
            timestamp: new Date(),
            widget: { slug: def.slug, name: def.name, config: (def.defaultConfig as Record<string, unknown>) ?? undefined },
          }]);
          setIsTyping(false);
        }, 400);
      }
    },
    {
      command: '/create-tab', label: 'Create Tab', description: 'Create a workspace tab from chat',
      icon: <LayoutGrid className="h-4 w-4" />,
      handler: async (args: string) => {
        const label = args.trim() || 'New Tab';
        addToolCallMessage('Workspace.createTab()', `Creating: "${label}"`);
        try {
          await createTab.mutateAsync({ label });
          setTimeout(() => addAssistantMessage(`Tab **"${label}"** created! Open /workspace to see it, or use \`/widget <slug>\` to preview widgets and pin them.`), 400);
        } catch {
          setTimeout(() => addAssistantMessage('Failed to create tab. Please try again.'), 400);
        }
      }
    },
    {
      command: '/idea', label: 'Submit Idea', description: 'Post an idea to the Ideas Hub',
      icon: <Lightbulb className="h-4 w-4" />,
      handler: async (args: string) => {
        if (!args.trim()) { addAssistantMessage('Usage: `/idea <your idea>` — e.g. `/idea Add a dark mode toggle to the header`'); return; }
        addToolCallMessage('Ideas.submit()', `"${args.trim().slice(0, 50)}..."`);
        try {
          await apiRequest('POST', '/api/workspace-proposals', {
            label: args.trim().slice(0, 100), description: args.trim(),
            type: 'idea', category: 'general', impact: 'low', scope: 'workspace', payload: {},
          });
          queryClient.invalidateQueries({ queryKey: ['/api/ideas'] });
          setTimeout(() => addAssistantMessage(`Idea submitted: **"${args.trim().slice(0, 80)}"**\n\nYour team can view and discuss it in the [Ideas Hub](/ideas).`), 400);
        } catch {
          setTimeout(() => addAssistantMessage('Failed to submit idea. Please try again.'), 400);
        }
      }
    },
    {
      command: '/workspace', label: 'Open Workspace', description: 'Go to modular workspace',
      icon: <LayoutGrid className="h-4 w-4" />,
      handler: () => { navigate('/workspace'); }
    },
    {
      command: '/search', label: 'Knowledge Search', description: 'Semantic search across docs & policies',
      icon: <Search className="h-4 w-4" />,
      handler: async (args: string) => {
        const q = args.trim();
        if (!q) { addAssistantMessage('Usage: `/search <query>` — e.g. `/search refund policy for late returns`'); return; }
        addToolCallMessage('KnowledgeBase.semanticSearch()', `Searching: "${q}"`);
        try {
          const res = await apiRequest('GET', `/api/knowledge-base/semantic-search?q=${encodeURIComponent(q)}&topK=5`);
          const hits = res.ok ? await res.json() : [];
          if (!Array.isArray(hits) || hits.length === 0) {
            addAssistantMessage(`No matching knowledge for **"${q}"**. Try broader terms or upload more documents in [Knowledge Base](/knowledge).`);
            return;
          }
          const body = hits.slice(0, 5).map((h: any, i: number) => {
            const title = h?.metadata?.title || `Document ${h.documentId}`;
            const cat = h?.metadata?.category ? ` · ${h.metadata.category}` : '';
            const score = typeof h.score === 'number' ? ` (${Math.round(h.score * 100)}%)` : '';
            const snippet = String(h.content || '').replace(/\s+/g, ' ').slice(0, 220);
            return `**${i + 1}. ${title}**${cat}${score}\n> ${snippet}${snippet.length >= 220 ? '…' : ''}`;
          }).join('\n\n');
          addAssistantMessage(`Top matches for **"${q}"**:\n\n${body}`);
        } catch (e: any) {
          addAssistantMessage(`Search failed: ${e?.message || 'unknown error'}`);
        }
      }
    },
    {
      command: '/data', label: 'Ask Data (NL→SQL)', description: 'Natural-language analytics query',
      icon: <Database className="h-4 w-4" />,
      handler: async (args: string) => {
        const q = args.trim();
        if (!q) { addAssistantMessage('Usage: `/data <question>` — e.g. `/data top 5 washers by completed washes this month`'); return; }
        addToolCallMessage('Analytics.nlQuery()', `Translating: "${q}"`);
        try {
          const res = await apiRequest('POST', '/api/analytics/nl-query', { question: q, maxRows: 25 });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const msg = err?.message || `Query failed (${res.status})`;
            addAssistantMessage(`**Query rejected**: ${msg}\n\nThis tool is limited to read-only queries for admins, supervisors, and coordinators.`);
            return;
          }
          const data = await res.json();
          if (!data.rows?.length) {
            addAssistantMessage(`Query ran (${data.latencyMs}ms) but returned no rows.\n\n\`\`\`sql\n${data.sql}\n\`\`\``);
            return;
          }
          const cols = Object.keys(data.rows[0]);
          const previewRows = data.rows.slice(0, 10);
          const header = `| ${cols.join(' | ')} |`;
          const sep = `| ${cols.map(() => '---').join(' | ')} |`;
          const body = previewRows.map((r: any) =>
            `| ${cols.map(c => {
              const v = r[c];
              if (v === null || v === undefined) return '—';
              if (typeof v === 'object') return JSON.stringify(v);
              return String(v).slice(0, 60);
            }).join(' | ')} |`
          ).join('\n');
          const more = data.rowCount > previewRows.length ? `\n\n_Showing ${previewRows.length} of ${data.rowCount} rows. Open [Analytics → Ask Data](/analytics) for the full table._` : '';
          addAssistantMessage(`**Result** (${data.rowCount} rows · ${data.latencyMs}ms)\n\n${header}\n${sep}\n${body}${more}\n\n<details><summary>Generated SQL</summary>\n\n\`\`\`sql\n${data.sql}\n\`\`\`\n\n</details>`);
        } catch (e: any) {
          addAssistantMessage(`Query failed: ${e?.message || 'unknown error'}`);
        }
      }
    },
  ], [messages, dashStats, navigate, catalog, createTab, queryClient, callAI, setIsTyping]);

  const allSlashCommands = useMemo(() => {
    const dbSlash: SlashCommand[] = (Array.isArray(customActionsData) ? customActionsData : [])
      .filter((a: any) => a.placement === 'slash' && a.active !== false)
      .map((a: any) => ({
        command: `/${a.label.toLowerCase().replace(/\s+/g, '-')}`,
        label: a.label,
        description: a.target || 'Custom command',
        icon: <Zap className="h-4 w-4" />,
        handler: () => {
          if (a.target?.startsWith('/')) navigate(a.target);
          else addAssistantMessage(`Executing custom action: ${a.label}`);
        },
      }));
    return [...slashCommands, ...dbSlash];
  }, [slashCommands, customActionsData, navigate]);

  // ─── Send handler ───
  const handleSend = () => {
    if (!input.trim()) return;
    if (input.startsWith('/')) {
      const parts = input.split(' ');
      const cmd = allSlashCommands.find(c => c.command === parts[0]);
      if (cmd) {
        const userMsg: LocalMessage = { id: Date.now().toString(), role: 'user', content: input, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);
        cmdTimeoutRef.current = setTimeout(() => cmd.handler(parts.slice(1).join(' ')), 300);
        return;
      }
    }
    const userContent = input;
    const newMsg: LocalMessage = { id: Date.now().toString(), role: 'user', content: userContent, timestamp: new Date() };
    setMessages(prev => [...prev, newMsg]);
    setInput('');
    setIsTyping(true);
    callAI(userContent, [...messages, newMsg], setMessages);
  };

  // Auto-send the URL-supplied prompt once input is set.
  useEffect(() => {
    if (!pendingAutoSend) return;
    if (!input.trim()) return;
    setPendingAutoSend(false);
    handleSend();
  }, [pendingAutoSend, input]);

  const handleSlashSelect = (cmd: SlashCommand) => {
    const parts = input.split(' ');
    const args = parts.slice(1).join(' ');
    const userMsg: LocalMessage = { id: Date.now().toString(), role: 'user', content: input || cmd.command, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    cmdTimeoutRef.current = setTimeout(() => cmd.handler(args), 300);
  };

  useEffect(() => {
    return () => { if (cmdTimeoutRef.current) clearTimeout(cmdTimeoutRef.current); };
  }, []);

  // ─── Render ───
  return (
    <div className="flex h-full bg-background relative">
      {showConvSidebar && (
        <ChatConversationSidebar
          conversations={conversations as Array<{ id: number; title: string; createdAt: string }>}
          activeConversationId={activeConversationId}
          onSelect={loadConversation}
          onDelete={(id) => deleteConvMutation.mutate(id)}
          onNew={startNewConversation}
          onClose={() => setShowConvSidebar(false)}
        />
      )}

      <div className="flex flex-col flex-1 min-w-0 relative">
        <header className={`sticky top-0 z-10 flex items-center justify-between px-4 h-14 bg-background/95 backdrop-blur-md transition-all ${isMobile ? 'pl-14' : (sidebarOpen ? '' : 'pl-14')}`}>
          <div className="flex items-center gap-2">
            {!showConvSidebar && (
              <Tooltip><TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Show conversations" onClick={() => setShowConvSidebar(true)}>
                  <PanelLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger><TooltipContent>Show conversations</TooltipContent></Tooltip>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-lg font-semibold px-2 hover:bg-muted/50 rounded-xl" data-testid="button-model-select">
                  {model} <ChevronDown className="ml-1 h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[280px]">
                <DropdownMenuItem onClick={() => setModel('DriveAI-Builder')} className={`py-3 cursor-pointer ${model === 'DriveAI-Builder' ? 'bg-primary/10' : ''}`}>
                  <div className="flex flex-col">
                    <span className="font-semibold text-primary">DriveAI-Builder</span>
                    <span className="text-xs text-muted-foreground">Adapts and modifies the app UI</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setModel('DriveAI-4')} className={`py-3 cursor-pointer ${model === 'DriveAI-4' ? 'bg-primary/10' : ''}`}>
                  <div className="flex flex-col">
                    <span className="font-semibold">DriveAI-4</span>
                    <span className="text-xs text-muted-foreground">Most capable, reasoning tasks</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setModel('DriveAI-Fleet')} className={`py-3 cursor-pointer ${model === 'DriveAI-Fleet' ? 'bg-primary/10' : ''}`}>
                  <div className="flex flex-col">
                    <span className="font-semibold">DriveAI-Fleet</span>
                    <span className="text-xs text-muted-foreground">Specialized for fleet operations</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] text-muted-foreground font-mono">
              <Slash className="h-3 w-3 mr-1" /> commands
            </Badge>
            <Badge variant="outline" className="text-[10px] text-muted-foreground font-mono">
              <AtSign className="h-3 w-3 mr-1" /> mentions
            </Badge>
          </div>
        </header>

        <ChatMessageList
          messages={messages}
          isTyping={isTyping}
          pipelineSteps={pipelineSteps}
          model={model}
          userInitial={user?.displayName?.[0] || 'U'}
          messagesEndRef={messagesEndRef}
          onApplyProposal={handleApplyProposal}
          onToolCall={handleToolCall}
          onDrillDown={handleDrillDown}
          onCopy={copyToClipboard}
          onRegenerate={regenerateLastResponse}
          onPinToTab={handlePinToTab}
        />

        <FleetPulseStrip onPillClick={(cmd) => setInput(cmd)} />
        <ChatInput
          input={input}
          setInput={setInput}
          isTyping={isTyping}
          slashCommands={allSlashCommands}
          onSend={handleSend}
          onSlashSelect={handleSlashSelect}
        />
      </div>
    </div>
  );
}
