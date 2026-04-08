import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '@/lib/AppContext';
import { useAuth } from '@/lib/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { 
  Send, Paperclip, ChevronDown, Bot, User, Zap,
  Copy, RefreshCcw, Edit2, Lightbulb, Wrench, Hammer,
  Car, Droplets, CalendarDays, Activity, Shield, Brain, BarChart3,
  Hash, AtSign, Slash, CheckCircle2, Clock, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface LocalMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'builder_proposal' | 'tool_call';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  proposal?: {
    type: 'button' | 'view' | 'workflow' | 'config';
    label: string;
    icon: string;
    target: string;
    previewText: string;
  };
  toolCall?: {
    tool: string;
    status: 'running' | 'complete' | 'error';
    result?: string;
  };
  entities?: Array<{ type: string; label: string; id?: string }>;
}

interface SlashCommand {
  command: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  handler: (args: string) => void;
}

export default function ChatPage() {
  const { t, sidebarOpen, isMobile, setCustomActions } = useApp();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [input, setInput] = useState('');
  const [model, setModel] = useState('DriveAI-Builder');
  const [isTyping, setIsTyping] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [selectedSlashIdx, setSelectedSlashIdx] = useState(0);
  
  const [messages, setMessages] = useState<LocalMessage[]>([
    {
      id: 'sys-build-1',
      role: 'system',
      content: 'Builder Mode Active. You can ask me to add buttons, create dashboards, or reshape this workspace.',
      timestamp: new Date()
    },
    {
      id: '1',
      role: 'assistant',
      content: `Hello ${user?.displayName || 'there'}! I am the DriveAI Builder.\n\nI can adapt this platform to your workflows. Try:\n- Type \`/\` for slash commands (fleet status, wash queue, shift check, etc.)\n- Mention entities with \`@\` (e.g. @YHA-1234)\n- "Add a button to report a late return"\n- "Create a weekend projections view"\n- "Reorganize the sidebar for morning shift"`,
      timestamp: new Date()
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: customActionsData } = useQuery({
    queryKey: ["/api/custom-actions"],
    enabled: !!user,
  });

  const { data: dashStats } = useQuery<{
    vehicles: number; washQueue: number; shifts: number; users: number;
    stations: number; automations: number; warRooms: number;
    unreadNotifications: number; pendingShiftRequests: number;
  }>({
    queryKey: ["/api/dashboard-stats"],
    enabled: !!user,
  });

  useEffect(() => {
    if (customActionsData && Array.isArray(customActionsData)) {
      setCustomActions(customActionsData.map((a: any) => ({
        id: a.id,
        label: a.label,
        icon: a.icon,
        target: a.target,
      })));
    }
  }, [customActionsData, setCustomActions]);

  const createActionMutation = useMutation({
    mutationFn: async (data: { label: string; icon: string; target: string; placement: string }) => {
      const res = await apiRequest("POST", "/api/custom-actions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-actions"] });
    },
  });

  const createProposalMutation = useMutation({
    mutationFn: async (data: { type: string; label: string; description?: string; impact: string; scope: string; payload: Record<string, unknown> }) => {
      const res = await apiRequest("POST", "/api/proposals", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
    },
  });

  const applyProposalMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/proposals/${id}/apply`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-actions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
    },
  });

  const addToolCallMessage = (tool: string, result: string) => {
    const id = (Date.now() + Math.random()).toString();
    setMessages(prev => [...prev, {
      id,
      role: 'tool_call',
      content: '',
      timestamp: new Date(),
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

  const slashCommands: SlashCommand[] = useMemo(() => [
    {
      command: '/fleet', label: 'Fleet Status', description: 'Get current fleet overview',
      icon: <Car className="h-4 w-4" />,
      handler: () => {
        addToolCallMessage('Fleet.getStatus()', `Fleet: ${dashStats?.vehicles || 0} vehicles tracked`);
        setTimeout(() => {
          addAssistantMessage(
            `Fleet Overview:\n\n- Total Vehicles: ${dashStats?.vehicles || 0}\n- Wash Queue: ${dashStats?.washQueue || 0} items\n- Active Stations: ${dashStats?.stations || 0}\n\nWould you like me to drill into any specific area, or navigate to Fleet Intelligence?`,
            [{ type: 'module', label: 'Fleet Intelligence' }]
          );
        }, 600);
      }
    },
    {
      command: '/wash', label: 'Wash Queue', description: 'Check wash queue status',
      icon: <Droplets className="h-4 w-4" />,
      handler: () => {
        addToolCallMessage('WashQueue.getSummary()', `Queue: ${dashStats?.washQueue || 0} items`);
        setTimeout(() => addAssistantMessage(`Wash queue has ${dashStats?.washQueue || 0} items. ${(dashStats?.washQueue ?? 0) > 2 ? 'Queue is busy — consider escalating priority items.' : 'Queue is manageable.'}`), 600);
      }
    },
    {
      command: '/shifts', label: 'Shift Check', description: 'Today\'s shift coverage',
      icon: <CalendarDays className="h-4 w-4" />,
      handler: () => {
        addToolCallMessage('Shifts.checkCoverage()', `${dashStats?.shifts || 0} shifts configured`);
        setTimeout(() => addAssistantMessage(`${dashStats?.shifts || 0} shifts in the system. ${(dashStats?.pendingShiftRequests ?? 0) > 0 ? `${dashStats?.pendingShiftRequests} pending shift requests need review.` : 'No pending requests.'}`), 600);
      }
    },
    {
      command: '/stats', label: 'Dashboard Stats', description: 'Full platform statistics',
      icon: <BarChart3 className="h-4 w-4" />,
      handler: () => {
        addToolCallMessage('Platform.getStats()', 'Aggregated dashboard stats');
        setTimeout(() => addAssistantMessage(
          `Platform Overview:\n\n- Vehicles: ${dashStats?.vehicles || 0}\n- Users: ${dashStats?.users || 0}\n- Stations: ${dashStats?.stations || 0}\n- Automations: ${dashStats?.automations || 0}\n- War Rooms: ${dashStats?.warRooms || 0}\n- Unread Notifications: ${dashStats?.unreadNotifications || 0}\n- Pending Shift Requests: ${dashStats?.pendingShiftRequests || 0}`
        ), 600);
      }
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
        const target = args.trim().toLowerCase();
        const route = routes[target];
        if (route) { navigate(route); return; }
        addAssistantMessage(`Available modules: ${Object.keys(routes).join(', ')}. Try: /navigate fleet`);
      }
    },
    {
      command: '/warroom', label: 'War Room', description: 'Check active incidents',
      icon: <Shield className="h-4 w-4" />,
      handler: () => {
        addToolCallMessage('WarRoom.getActive()', `${dashStats?.warRooms || 0} active rooms`);
        setTimeout(() => addAssistantMessage(`${dashStats?.warRooms || 0} active war rooms. ${(dashStats?.warRooms ?? 0) > 0 ? 'Navigate to War Room for full incident management.' : 'No active incidents — operations are stable.'}`), 600);
      }
    },
    {
      command: '/memory', label: 'AI Memory', description: 'Query workspace knowledge',
      icon: <Brain className="h-4 w-4" />,
      handler: (args: string) => {
        addToolCallMessage('WorkspaceMemory.query()', `Searching: "${args || 'all'}"`);
        setTimeout(() => addAssistantMessage(`Workspace memory contains organizational knowledge, policies, SOPs, and AI-learned preferences. ${args ? `Searching for "${args}"...` : 'Ask me about any specific policy or procedure.'}`), 600);
      }
    },
    {
      command: '/vehicle', label: 'Vehicle Lookup', description: 'Look up a vehicle by plate',
      icon: <Car className="h-4 w-4" />,
      handler: (args: string) => {
        const plate = args.trim().toUpperCase();
        if (!plate) {
          addAssistantMessage('Usage: `/vehicle <plate>` — e.g. `/vehicle YHA-1234`');
          return;
        }
        addToolCallMessage('Fleet.lookupVehicle()', `Searching: ${plate}`);
        setTimeout(() => addAssistantMessage(`Looking up vehicle **${plate}**. Navigate to Fleet Intelligence for full details, or mention @${plate} in your message.`, [{ type: 'vehicle', label: plate }]), 600);
      }
    },
    {
      command: '/incident', label: 'Report Incident', description: 'Create an incident report',
      icon: <Shield className="h-4 w-4" />,
      handler: (args: string) => {
        if (!args.trim()) {
          addAssistantMessage('Usage: `/incident <description>` — e.g. `/incident Customer reports damage on YHA-1234`');
          return;
        }
        addToolCallMessage('WarRoom.createIncident()', `Incident: "${args.trim().slice(0, 50)}..."`);
        setTimeout(() => {
          addAssistantMessage(`Incident noted: "${args.trim()}"\n\nI've flagged this for the War Room. Navigate to War Room to manage the full incident lifecycle.`);
          navigate('/war-room');
        }, 800);
      }
    },
  ], [dashStats, navigate]);

  // Merge built-in slash commands with user-created custom slash commands from DB
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

  const filteredSlashCommands = allSlashCommands.filter(c =>
    c.command.includes(slashFilter.toLowerCase()) || c.label.toLowerCase().includes(slashFilter.toLowerCase())
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [messages, isTyping]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  useEffect(() => {
    if (input.startsWith('/') && input.length > 0 && !input.includes(' ')) {
      setShowSlashMenu(true);
      setSlashFilter(input);
      setSelectedSlashIdx(0);
    } else {
      setShowSlashMenu(false);
    }
  }, [input]);

  const handleSlashSelect = (cmd: SlashCommand) => {
    const parts = input.split(' ');
    const args = parts.slice(1).join(' ');
    setShowSlashMenu(false);
    
    const userMsg: LocalMessage = {
      id: Date.now().toString(), role: 'user', content: input || cmd.command, timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    
    setTimeout(() => cmd.handler(args), 300);
  };

  // Detect if AI response suggests a workspace modification
  const detectProposalIntent = (text: string): LocalMessage['proposal'] | null => {
    const lower = text.toLowerCase();

    // ── Button / shortcut / action proposals ─────────────────────────────
    const buttonPatterns = [
      /(?:i(?:'ll| can| will| could)?|let me|shall i|want me to)\s+(?:add|create|place|put|set up)\s+(?:a\s+)?(?:button|shortcut|quick[\s-]?action|action)\s+(?:for|to|called|labeled|named|that)\s+"?([^".\n]+)"?/i,
      /(?:add|create|place|put)\s+(?:a\s+)?(?:button|shortcut|quick[\s-]?action|action)\s+(?:for|to|called|labeled|named)\s+"?([^".\n]+)"?/i,
      /(?:button|shortcut|action)\s+(?:called|labeled|named)\s+"([^"]+)"/i,
    ];

    // ── View / dashboard proposals ───────────────────────────────────────
    const viewPatterns = [
      /(?:i(?:'ll| can| will)?|let me)\s+(?:create|build|add|set up)\s+(?:a\s+)?(?:view|dashboard|panel|widget)\s+(?:for|called|to show|named)\s+"?([^".\n]+)"?/i,
      /(?:create|build|add)\s+(?:a\s+)?(?:view|dashboard|panel|widget)\s+(?:for|called|to show)\s+"?([^".\n]+)"?/i,
    ];

    // ── Workflow / automation proposals ───────────────────────────────────
    const workflowPatterns = [
      /(?:i(?:'ll| can| will)?|let me)\s+(?:create|set up|build|configure)\s+(?:a\s+)?(?:workflow|automation|auto[\s-]?rule|process)\s+(?:for|to|that)\s+"?([^".\n]+)"?/i,
      /(?:create|set up|build)\s+(?:a\s+)?(?:workflow|automation|process)\s+(?:for|to|that)\s+"?([^".\n]+)"?/i,
    ];

    // ── Config / setting proposals ───────────────────────────────────────
    const configPatterns = [
      /(?:i(?:'ll| can| will)?|let me)\s+(?:change|update|set|modify|configure)\s+(?:the\s+)?(?:setting|config|configuration|default|preference)\s+(?:for|of|to)\s+"?([^".\n]+)"?/i,
      /(?:change|update|set)\s+(?:the\s+)?(?:default|setting|config)\s+(?:for|of)\s+"?([^".\n]+)"?\s+to\s+"?([^".\n]+)"?/i,
    ];

    // Route inference based on context
    const inferRoute = (): string => {
      if (lower.includes('fleet') || lower.includes('vehicle')) return '/fleet';
      if (lower.includes('wash')) return '/washers';
      if (lower.includes('shift') || lower.includes('schedule')) return '/shifts';
      if (lower.includes('analytics') || lower.includes('report')) return '/analytics';
      if (lower.includes('inbox') || lower.includes('notification')) return '/inbox';
      return '/';
    };

    for (const pat of buttonPatterns) {
      const match = text.match(pat);
      if (match) {
        const label = (match[1] || match[2] || '').trim().slice(0, 50);
        if (!label) continue;
        return { type: 'button', label, icon: 'Zap', target: inferRoute(), previewText: `Add a quick-action button: "${label}"` };
      }
    }
    for (const pat of viewPatterns) {
      const match = text.match(pat);
      if (match) {
        const label = (match[1] || '').trim().slice(0, 50);
        if (!label) continue;
        return { type: 'view', label, icon: 'BarChart3', target: '/analytics', previewText: `Create a new view: "${label}"` };
      }
    }
    for (const pat of workflowPatterns) {
      const match = text.match(pat);
      if (match) {
        const label = (match[1] || '').trim().slice(0, 50);
        if (!label) continue;
        return { type: 'workflow', label, icon: 'Zap', target: '/automations', previewText: `Set up workflow: "${label}"` };
      }
    }
    for (const pat of configPatterns) {
      const match = text.match(pat);
      if (match) {
        const label = (match[1] || '').trim().slice(0, 50);
        if (!label) continue;
        return { type: 'config', label, icon: 'Settings', target: '/settings', previewText: `Update setting: "${label}"` };
      }
    }
    return null;
  };

  const callAI = async (userContent: string, history: LocalMessage[]) => {
    const responseId = (Date.now() + 1).toString();
    const entityMentions = userContent.match(/@[\w-]+/g) || [];
    const entities = entityMentions.map(m => ({ type: 'mention', label: m.slice(1) }));

    setMessages(prev => [...prev, {
      id: responseId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
      entities: entities.length > 0 ? entities : undefined,
    }]);

    try {
      // Build message history for the AI (last 20 turns, user/assistant only)
      const apiMessages = history
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-20)
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      apiMessages.push({ role: 'user', content: userContent });

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          messages: apiMessages,
          context: {
            vehicles: dashStats?.vehicles,
            washQueue: dashStats?.washQueue,
            shifts: dashStats?.shifts,
            stations: dashStats?.stations,
            unreadNotifications: dashStats?.unreadNotifications,
          },
        }),
      });

      if (!res.ok) throw new Error(`AI request failed: ${res.status}`);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No response body');

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'text') {
              setMessages(prev => prev.map(msg =>
                msg.id === responseId ? { ...msg, content: msg.content + event.text } : msg
              ));
            } else if (event.type === 'done') {
              setMessages(prev => {
                const updated = prev.map(msg =>
                  msg.id === responseId ? { ...msg, isStreaming: false } : msg
                );
                // Check for proposal intent in the completed response
                const completed = updated.find(m => m.id === responseId);
                if (completed) {
                  const proposalIntent = detectProposalIntent(completed.content);
                  if (proposalIntent) {
                    return [...updated, {
                      id: `proposal-${Date.now()}`,
                      role: 'builder_proposal' as const,
                      content: proposalIntent.previewText,
                      timestamp: new Date(),
                      proposal: proposalIntent,
                    }];
                  }
                }
                return updated;
              });
              setIsTyping(false);
            }
          } catch { /* skip malformed SSE line */ }
        }
      }
    } catch (err) {
      setMessages(prev => prev.map(msg =>
        msg.id === responseId
          ? { ...msg, content: 'Sorry, I encountered an error. Please try again.', isStreaming: false }
          : msg
      ));
      setIsTyping(false);
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;

    if (showSlashMenu && filteredSlashCommands.length > 0) {
      handleSlashSelect(filteredSlashCommands[selectedSlashIdx]);
      return;
    }

    if (input.startsWith('/')) {
      const parts = input.split(' ');
      const cmdStr = parts[0];
      const args = parts.slice(1).join(' ');
      const cmd = allSlashCommands.find(c => c.command === cmdStr);
      if (cmd) {
        const userMsg: LocalMessage = {
          id: Date.now().toString(), role: 'user', content: input, timestamp: new Date()
        };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);
        setTimeout(() => cmd.handler(args), 300);
        return;
      }
    }

    const userContent = input;
    const newMsg: LocalMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userContent,
      timestamp: new Date()
    };

    setMessages(prev => {
      const updated = [...prev, newMsg];
      setInput('');
      setIsTyping(true);
      // Kick off AI call with current history snapshot
      callAI(userContent, updated);
      return updated;
    });
  };

  const handleApplyProposal = async (proposal: NonNullable<LocalMessage['proposal']>) => {
    try {
      // Create a workspace proposal first, then apply if personal + low impact
      const created = await createProposalMutation.mutateAsync({
        type: proposal.type,
        label: proposal.label,
        description: proposal.previewText,
        impact: proposal.type === 'workflow' ? 'medium' : 'low',
        scope: 'personal',
        payload: {
          icon: proposal.icon,
          target: proposal.target,
          placement: 'header',
        },
      });

      // Personal + low impact: auto-apply
      if (created.scope === 'personal' && created.impact === 'low') {
        await applyProposalMutation.mutateAsync(created.id);
        toast({
          title: "Workspace Updated",
          description: `Successfully added "${proposal.label}" to the interface.`,
        });
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          content: `Applied: Added new action "${proposal.label}". It's now live in your header. This change is audited and reversible.`,
          timestamp: new Date()
        }]);
      } else {
        toast({
          title: "Proposal Submitted",
          description: `"${proposal.label}" requires admin approval before applying.`,
        });
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          content: `Proposal "${proposal.label}" submitted for review. An admin or supervisor must approve it before it takes effect.`,
          timestamp: new Date()
        }]);
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to apply changes.", variant: "destructive" });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSlashMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSlashIdx(i => Math.min(i + 1, filteredSlashCommands.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSlashIdx(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        if (filteredSlashCommands[selectedSlashIdx]) {
          setInput(filteredSlashCommands[selectedSlashIdx].command + ' ');
          setShowSlashMenu(false);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSlashMenu(false);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Message copied to clipboard." });
  };

  return (
    <div className="flex flex-col h-full bg-background relative">
      <header className={`sticky top-0 z-10 flex items-center justify-between px-4 h-14 bg-background/95 backdrop-blur-md transition-all ${isMobile ? 'pl-14' : (sidebarOpen ? '' : 'pl-14')}`}>
        <div className="flex items-center gap-2">
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

      <ScrollArea className="flex-1 content-visibility-auto">
        <div className="flex flex-col items-center pb-32 pt-4">
          <div className="w-full max-w-3xl px-4 md:px-0 space-y-6">
            {messages.map((msg) => {
              if (msg.role === 'system') {
                return (
                  <div key={msg.id} className="flex justify-center my-4">
                    <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-1 rounded-full border border-border/50 flex items-center gap-2">
                      <Wrench className="h-3 w-3" />
                      {msg.content}
                    </span>
                  </div>
                );
              }

              if (msg.role === 'tool_call' && msg.toolCall) {
                return (
                  <div key={msg.id} className="flex justify-center my-2">
                    <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-lg border border-border/30">
                      {msg.toolCall.status === 'complete' ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      ) : (
                        <Clock className="h-3 w-3 animate-spin text-primary" />
                      )}
                      <span className="text-primary/70">{msg.toolCall.tool}</span>
                      {msg.toolCall.result && <span className="text-muted-foreground/60">→ {msg.toolCall.result}</span>}
                    </div>
                  </div>
                );
              }

              if (msg.role === 'builder_proposal' && msg.proposal) {
                return (
                  <div key={msg.id} className="flex gap-4 w-full group flex-row">
                    <div className="w-8 h-8 rounded-full border flex items-center justify-center shrink-0 shadow-sm bg-primary text-primary-foreground">
                      <Hammer className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col gap-2 min-w-0 w-full max-w-[85%] items-start">
                      <div className="px-5 py-4 rounded-3xl bg-card border shadow-lg border-primary/20 text-foreground w-full">
                        <div className="flex items-center gap-2 mb-2 text-primary font-semibold text-sm">
                          <Wrench className="h-4 w-4" /> Interface Modification Proposal
                        </div>
                        <p className="text-sm mb-4 text-muted-foreground">{msg.proposal.previewText}</p>
                        <div className="bg-muted/50 rounded-lg p-4 border mb-4">
                          <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-semibold">Preview</div>
                          <Button variant="outline" className="gap-2 bg-background border-dashed pointer-events-none">
                            <Zap className="h-4 w-4" />
                            {msg.proposal.label}
                          </Button>
                        </div>
                        <div className="flex gap-3">
                          <Button onClick={() => handleApplyProposal(msg.proposal!)} className="bg-primary hover:bg-primary/90" data-testid="button-apply-proposal">
                            Apply to Workspace
                          </Button>
                          <Button variant="outline">Modify</Button>
                          <Button variant="ghost">Reject</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id} className={`flex gap-4 w-full group ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {msg.role === 'assistant' ? (
                    <div className="w-8 h-8 rounded-full border flex items-center justify-center shrink-0 shadow-sm bg-card">
                      <Bot className={`h-5 w-5 ${model.includes('Builder') ? 'text-primary' : ''}`} />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">{user?.displayName?.[0] || 'U'}</span>
                    </div>
                  )}
                  <div className={`flex flex-col gap-1.5 min-w-0 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {msg.role === 'user' ? (
                      <div className="px-5 py-3.5 rounded-3xl bg-muted/80 text-foreground">
                        <div className="text-[15px] whitespace-pre-wrap break-words leading-relaxed">{msg.content}</div>
                      </div>
                    ) : (
                      <div className="py-1 text-foreground">
                        <div className={`text-[15px] whitespace-pre-wrap break-words leading-relaxed ${msg.isStreaming ? 'after:content-["_▋"] after:animate-pulse' : ''}`}>
                          {msg.content}
                        </div>
                        {msg.entities && msg.entities.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {msg.entities.map((e, i) => (
                              <Badge key={i} variant="outline" className="text-xs text-primary border-primary/30 bg-primary/5">
                                <Hash className="h-3 w-3 mr-1" />{e.label}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div className={`flex items-center gap-1 mt-1 ${msg.role === 'user' ? 'mr-2' : 'ml-[-8px]'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                      {msg.role === 'assistant' && !msg.isStreaming && (
                        <>
                          <Tooltip><TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => copyToClipboard(msg.content)}><Copy className="h-4 w-4" /></Button>
                          </TooltipTrigger><TooltipContent>Copy</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"><RefreshCcw className="h-4 w-4" /></Button>
                          </TooltipTrigger><TooltipContent>Regenerate</TooltipContent></Tooltip>
                        </>
                      )}
                      {msg.role === 'user' && (
                        <Tooltip><TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground bg-background rounded-full shadow-sm border"><Edit2 className="h-4 w-4" /></Button>
                        </TooltipTrigger><TooltipContent>Edit</TooltipContent></Tooltip>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {isTyping && (
              <div className="flex gap-4 w-full flex-row">
                <div className="w-8 h-8 rounded-full border flex items-center justify-center shrink-0 shadow-sm bg-card">
                  <Bot className="h-5 w-5 text-primary animate-pulse" />
                </div>
                <div className="flex items-center gap-1 py-3">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </ScrollArea>

      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-background via-background/95 to-transparent pt-10 pb-6 px-4">
        <div className="max-w-3xl mx-auto relative">
          {showSlashMenu && filteredSlashCommands.length > 0 && (
            <div className="absolute bottom-full mb-2 left-0 w-full bg-card border rounded-xl shadow-xl overflow-hidden z-10" data-testid="slash-menu">
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b">
                Slash Commands
              </div>
              {filteredSlashCommands.map((cmd, i) => (
                <div
                  key={cmd.command}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${i === selectedSlashIdx ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'}`}
                  onClick={() => handleSlashSelect(cmd)}
                  data-testid={`slash-cmd-${cmd.command.slice(1)}`}
                >
                  <div className="h-8 w-8 rounded-lg bg-muted/80 flex items-center justify-center shrink-0">
                    {cmd.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{cmd.command}</span>
                      <span className="text-sm">{cmd.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{cmd.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className={`relative flex flex-col w-full bg-card border shadow-lg shadow-black/5 dark:shadow-white/5 rounded-2xl focus-within:ring-2 focus-within:ring-primary/20 transition-all ${model.includes('Builder') ? 'border-primary/50' : ''}`}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message DriveAI — type / for commands, @ for mentions..."
              className="w-full max-h-[200px] min-h-[52px] resize-none bg-transparent px-4 py-4 text-[15px] focus:outline-none placeholder:text-muted-foreground/70"
              rows={1}
              data-testid="input-chat-message"
            />
            <div className="flex items-center justify-between px-3 pb-3 pt-1">
              <div className="flex items-center gap-1.5">
                <Tooltip><TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </TooltipTrigger><TooltipContent>Attach files</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted" onClick={() => { setInput('/'); }}>
                    <Slash className="h-4 w-4" />
                  </Button>
                </TooltipTrigger><TooltipContent>Slash commands</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={handleSend} disabled={!input.trim() || isTyping}
                  className={`h-8 w-8 rounded-full shrink-0 transition-colors ${input.trim() ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-muted text-muted-foreground'}`}
                  size="icon" data-testid="button-send-message">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
