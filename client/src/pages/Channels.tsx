import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MotionDialog } from '@/components/motion/MotionDialog';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  Hash, Lock, Plus, Send, Users, MessageSquare, Pin, Loader2, ArrowLeft,
  Link2, PanelLeftClose, PanelLeft, Search, Settings, Smile, Reply,
  Edit2, MoreHorizontal, X, UserPlus, PanelRightClose, PanelRight,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePageLayout } from '@/hooks/useLayoutPreferences';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ───
interface Channel {
  id: number;
  name: string;
  slug: string;
  type: string;
  description: string | null;
  archived: boolean;
  createdAt: string;
}

interface ChannelMessage {
  id: number;
  channelId: number;
  userId: number;
  content: string;
  edited: boolean;
  pinned: boolean;
  replyToId: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  displayName: string;
  username: string;
}

interface ChannelMember {
  id: number;
  channelId: number;
  userId: number;
  role: string;
  muted: boolean;
  lastReadAt: string | null;
  joinedAt: string;
  displayName: string;
  username: string;
  userRole: string;
}

// ─── Helpers ───
function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getAvatarColor(userId: number): string {
  const colors = [
    'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500',
    'bg-orange-500', 'bg-pink-500', 'bg-teal-500', 'bg-indigo-500',
    'bg-cyan-500', 'bg-amber-500', 'bg-emerald-500', 'bg-violet-500',
  ];
  return colors[userId % colors.length];
}

function formatMessageDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const dayMs = 86400000;

  if (diff < dayMs && date.getDate() === now.getDate()) {
    return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (diff < 2 * dayMs) {
    return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined }) +
    ` at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function shouldGroupMessages(prev: ChannelMessage | null, curr: ChannelMessage): boolean {
  if (!prev) return false;
  if (prev.userId !== curr.userId) return false;
  const timeDiff = new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime();
  return Math.abs(timeDiff) < 5 * 60 * 1000; // 5 minutes
}

function formatDateDivider(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 86400000 && date.getDate() === now.getDate()) return 'Today';
  if (diff < 2 * 86400000) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '👀', '✅', '🚀'];

// ─── Main Component ───
export default function ChannelsPage() {
  const [selectedChannel, setSelectedChannel] = React.useState<Channel | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const { get: getChanPref, set: setChanPref } = usePageLayout('channels');
  const sidebarCollapsed = getChanPref<boolean>('sidebarCollapsed', false);
  const membersOpen = getChanPref<boolean>('membersOpen', true);
  const lastChannelId = getChanPref<number | null>('lastChannel', null);

  const wsChannels = React.useMemo(() => {
    const base = ['activity'];
    if (selectedChannel) base.push(`channel:${selectedChannel.id}`);
    return base;
  }, [selectedChannel]);
  const { lastMessage, send: wsSend } = useWebSocket(wsChannels);

  const queryClient = useQueryClient();
  const { data: channels, isLoading: loadingChannels } = useQuery<Channel[]>({
    queryKey: ["/api/channels"],
  });

  const channelList = Array.isArray(channels) ? channels : [];

  // Filter channels by search
  const filteredChannels = React.useMemo(() => {
    if (!searchQuery.trim()) return channelList;
    const q = searchQuery.toLowerCase();
    return channelList.filter(c =>
      c.name.toLowerCase().includes(q) || (c.description?.toLowerCase().includes(q))
    );
  }, [channelList, searchQuery]);

  // Group channels by type
  const groupedChannels = React.useMemo(() => {
    const groups: Record<string, Channel[]> = {};
    for (const ch of filteredChannels) {
      const key = ch.type === 'washer_bridge' ? 'Washer Bridge' : ch.type === 'station' ? 'Stations' : ch.type === 'private' ? 'Private' : 'Public';
      (groups[key] ??= []).push(ch);
    }
    return groups;
  }, [filteredChannels]);

  // Restore last active channel
  const restoredRef = React.useRef(false);
  React.useEffect(() => {
    if (!restoredRef.current && lastChannelId && channelList.length > 0 && !selectedChannel) {
      const found = channelList.find(c => c.id === lastChannelId);
      if (found) setSelectedChannel(found);
      restoredRef.current = true;
    }
  }, [channelList, lastChannelId, selectedChannel]);

  // Listen for real-time channel events
  React.useEffect(() => {
    if (!lastMessage) return;
    const msg = lastMessage as { type: string; data: unknown };
    if (msg.type === 'channel_message' || msg.type === 'channel_message_edited' || msg.type === 'message_pinned' || msg.type === 'message_unpinned') {
      const data = msg.data as { channelId: number };
      queryClient.invalidateQueries({ queryKey: ["/api/channel-messages", data.channelId] });
    }
    if (msg.type === 'member_joined' || msg.type === 'member_left') {
      const data = msg.data as { channelId: number };
      queryClient.invalidateQueries({ queryKey: ["/api/channel-members", data.channelId] });
    }
  }, [lastMessage, queryClient]);

  const selectChannel = React.useCallback((ch: Channel) => {
    setSelectedChannel(ch);
    setChanPref('lastChannel', ch.id);
  }, [setChanPref]);

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* ─── Channel Sidebar ─── */}
      <div className={`border-r flex flex-col bg-card/30 shrink-0 transition-all duration-200 ${sidebarCollapsed ? 'w-0 overflow-hidden border-0' : 'w-[260px]'} ${selectedChannel ? 'hidden md:flex' : 'flex'}`}>
        {/* Sidebar Header */}
        <div className="p-3 border-b">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-sm flex items-center gap-2" data-testid="text-channels-title">
              <MessageSquare className="h-4 w-4 text-primary" /> Channels
            </h2>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setChanPref('sidebarCollapsed', true)} title="Collapse sidebar">
                <PanelLeftClose className="h-3.5 w-3.5" />
              </Button>
              <CreateChannelDialog />
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Find a channel..."
              className="h-8 pl-8 text-xs bg-muted/50"
            />
          </div>
        </div>

        {/* Channel List */}
        <ScrollArea className="flex-1">
          <div className="p-1.5">
            {Object.entries(groupedChannels).map(([group, chs]) => (
              <div key={group} className="mb-2">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{group}</span>
                  <span className="text-[10px] text-muted-foreground">{chs.length}</span>
                </div>
                {chs.map(ch => (
                  <button
                    key={ch.id}
                    onClick={() => selectChannel(ch)}
                    data-testid={`channel-item-${ch.id}`}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left group ${
                      selectedChannel?.id === ch.id
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'hover:bg-muted/60 text-foreground/70 hover:text-foreground'
                    }`}
                  >
                    {ch.type === 'private' ? <Lock className="h-3.5 w-3.5 shrink-0 opacity-60" /> : ch.type === 'washer_bridge' ? <Link2 className="h-3.5 w-3.5 shrink-0 text-orange-500/70" /> : <Hash className="h-3.5 w-3.5 shrink-0 opacity-60" />}
                    <span className="truncate text-[13px]">{ch.name}</span>
                  </button>
                ))}
              </div>
            ))}
            {loadingChannels && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loadingChannels && filteredChannels.length === 0 && (
              <p className="px-3 py-8 text-xs text-muted-foreground text-center" data-testid="text-no-channels">
                {searchQuery ? 'No channels match your search' : 'No channels yet. Create one!'}
              </p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ─── Collapsed Sidebar Rail ─── */}
      {sidebarCollapsed && (
        <div className="border-r flex flex-col items-center py-3 px-1 bg-card/30">
          <Button variant="ghost" size="icon" className="h-8 w-8 mb-2" onClick={() => setChanPref('sidebarCollapsed', false)} title="Show channels">
            <PanelLeft className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ─── Message Area ─── */}
      {selectedChannel ? (
        <ChannelMessageArea
          channel={selectedChannel}
          onBack={() => setSelectedChannel(null)}
          wsSend={wsSend}
          membersOpen={membersOpen}
          onToggleMembers={() => setChanPref('membersOpen', !membersOpen)}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-3"
          >
            <div className="h-16 w-16 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center">
              <MessageSquare className="h-8 w-8 opacity-30" />
            </div>
            <p className="text-lg font-semibold">Select a channel</p>
            <p className="text-sm text-muted-foreground/70">Choose a channel from the sidebar to start chatting</p>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ─── Create Channel Dialog ───
function CreateChannelDialog() {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState('public');
  const [description, setDescription] = React.useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/channels", { name, type, description: description || undefined });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
      toast({ title: "Channel created" });
      setOpen(false);
      setName('');
      setType('public');
      setDescription('');
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <>
      <Button variant="ghost" size="icon" className="h-7 w-7" data-testid="button-create-channel" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /></Button>
      <MotionDialog open={open} onOpenChange={setOpen} title="" className="sm:max-w-md">
        <div className="flex items-center gap-2 text-lg font-semibold"><Hash className="h-5 w-5 text-primary" /> Create Channel</div>
        <p className="text-sm text-muted-foreground">Channels organize conversations by topic or team.</p>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. fleet-updates" data-testid="input-channel-name" />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public"><div className="flex items-center gap-2"><Hash className="h-3.5 w-3.5" /> Public</div></SelectItem>
                <SelectItem value="private"><div className="flex items-center gap-2"><Lock className="h-3.5 w-3.5" /> Private</div></SelectItem>
                <SelectItem value="station"><div className="flex items-center gap-2"><Settings className="h-3.5 w-3.5" /> Station</div></SelectItem>
                <SelectItem value="washer_bridge"><div className="flex items-center gap-2"><Link2 className="h-3.5 w-3.5" /> Washer Bridge</div></SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this channel about?" />
          </div>
          <Button onClick={() => createMutation.mutate()} disabled={!name.trim() || createMutation.isPending} className="w-full" data-testid="button-submit-channel">
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Hash className="h-4 w-4 mr-2" />}
            Create Channel
          </Button>
        </div>
      </MotionDialog>
    </>
  );
}

// ─── Channel Message Area ───
function ChannelMessageArea({ channel, onBack, wsSend, membersOpen, onToggleMembers }: {
  channel: Channel;
  onBack: () => void;
  wsSend: (msg: Record<string, unknown>) => void;
  membersOpen: boolean;
  onToggleMembers: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [message, setMessage] = React.useState('');
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editContent, setEditContent] = React.useState('');
  const [replyTo, setReplyTo] = React.useState<ChannelMessage | null>(null);
  const [hoveredMsg, setHoveredMsg] = React.useState<number | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const typingTimeout = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [typingUsers, setTypingUsers] = React.useState<Map<number, number>>(new Map());

  // Fetch messages
  const { data: messages, isLoading } = useQuery<ChannelMessage[]>({
    queryKey: ["/api/channel-messages", channel.id],
    queryFn: () => apiRequest("GET", `/api/channels/${channel.id}/messages?limit=100`).then(r => r.json()),
    refetchInterval: 30_000,
  });

  // Fetch members
  const { data: members } = useQuery<ChannelMember[]>({
    queryKey: ["/api/channel-members", channel.id],
    queryFn: () => apiRequest("GET", `/api/channels/${channel.id}/members`).then(r => r.json()),
  });

  // Fetch pinned messages
  const { data: pinnedMessages } = useQuery<ChannelMessage[]>({
    queryKey: ["/api/channel-pins", channel.id],
    queryFn: () => apiRequest("GET", `/api/channels/${channel.id}/pins`).then(r => r.json()),
  });

  // Mutations
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const body: Record<string, unknown> = { content };
      if (replyTo) body.replyToId = replyTo.id;
      const res = await apiRequest("POST", `/api/channels/${channel.id}/messages`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channel-messages", channel.id] });
      setMessage('');
      setReplyTo(null);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, content }: { id: number; content: string }) => {
      const res = await apiRequest("PATCH", `/api/channel-messages/${id}`, { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channel-messages", channel.id] });
      setEditingId(null);
      setEditContent('');
    },
  });

  const pinMutation = useMutation({
    mutationFn: async ({ id, pinned }: { id: number; pinned: boolean }) => {
      const res = await apiRequest("POST", `/api/channel-messages/${id}/${pinned ? 'pin' : 'unpin'}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channel-messages", channel.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/channel-pins", channel.id] });
    },
  });

  const reactionMutation = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: number; emoji: string }) => {
      const res = await apiRequest("POST", `/api/channel-messages/${messageId}/reactions`, { emoji });
      return res.json();
    },
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/channels/${channel.id}/join`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channel-members", channel.id] });
      toast({ title: "Joined channel" });
    },
  });

  const messageList = React.useMemo(() => {
    const list = Array.isArray(messages) ? [...messages] : [];
    list.reverse(); // API returns desc order, reverse for display
    return list;
  }, [messages]);

  const memberList = Array.isArray(members) ? members : [];
  const pinnedList = Array.isArray(pinnedMessages) ? pinnedMessages : [];
  const isMember = memberList.some(m => m.userId === user?.id);

  // Auto-scroll to bottom
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messageList.length]);

  // Typing indicator cleanup
  React.useEffect(() => {
    const interval = setInterval(() => {
      setTypingUsers(prev => {
        const now = Date.now();
        const next = new Map(prev);
        let changed = false;
        for (const [userId, timestamp] of next) {
          if (now - timestamp > 4000) {
            next.delete(userId);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen for typing WebSocket messages
  const { lastMessage: wsLastMessage } = useWebSocket([`channel:${channel.id}`]);
  React.useEffect(() => {
    if (!wsLastMessage) return;
    const msg = wsLastMessage as { type: string; data?: { userId?: number } };
    if (msg.type === 'typing' && msg.data && msg.data.userId !== user?.id) {
      setTypingUsers(prev => {
        const next = new Map(prev);
        next.set(msg.data!.userId!, Date.now());
        return next;
      });
    }
  }, [wsLastMessage, user?.id]);

  const handleSend = () => {
    const content = message.trim();
    if (!content) return;
    sendMutation.mutate(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape' && replyTo) {
      setReplyTo(null);
    }
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {}, 3000);
    wsSend({ type: 'typing', channel: `channel:${channel.id}` });
  };

  const startEdit = (msg: ChannelMessage) => {
    setEditingId(msg.id);
    setEditContent(msg.content);
  };

  const submitEdit = () => {
    if (!editingId || !editContent.trim()) return;
    editMutation.mutate({ id: editingId, content: editContent.trim() });
  };

  const typingDisplay = React.useMemo(() => {
    const names = Array.from(typingUsers.keys()).map((typingUserId) => {
      const member = memberList.find((entry) => entry.userId === typingUserId);
      return member?.displayName || `User #${typingUserId}`;
    });
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} is typing`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
    return `${names[0]} and ${names.length - 1} others are typing`;
  }, [memberList, typingUsers]);

  // Build date dividers into message list
  const messagesWithDividers = React.useMemo(() => {
    const result: Array<{ type: 'message'; msg: ChannelMessage; grouped: boolean } | { type: 'divider'; date: string }> = [];
    let lastDate = '';
    let prevMsg: ChannelMessage | null = null;

    for (const msg of messageList) {
      const dateKey = new Date(msg.createdAt).toLocaleDateString();
      if (dateKey !== lastDate) {
        result.push({ type: 'divider', date: msg.createdAt });
        lastDate = dateKey;
        prevMsg = null;
      }
      const grouped = shouldGroupMessages(prevMsg, msg);
      result.push({ type: 'message', msg, grouped });
      prevMsg = msg;
    }
    return result;
  }, [messageList]);

  const findReplyParent = React.useCallback((replyToId: number | null) => {
    if (!replyToId) return null;
    return messageList.find(m => m.id === replyToId) || null;
  }, [messageList]);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Main message column */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ─── Channel Header ─── */}
        <div className="h-12 border-b flex items-center gap-2 px-3 bg-card/30 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1.5">
            {channel.type === 'private' ? <Lock className="h-4 w-4 text-muted-foreground" /> : channel.type === 'washer_bridge' ? <Link2 className="h-4 w-4 text-orange-500" /> : <Hash className="h-4 w-4 text-muted-foreground" />}
            <h3 className="font-bold text-sm">{channel.name}</h3>
          </div>
          {channel.description && (
            <>
              <Separator orientation="vertical" className="h-5" />
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{channel.description}</p>
            </>
          )}
          <div className="ml-auto flex items-center gap-1">
            {pinnedList.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Pin className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{pinnedList.length} pinned</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleMembers}>
                  {membersOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{membersOpen ? 'Hide' : 'Show'} members</TooltipContent>
            </Tooltip>
            <Badge variant="outline" className="text-[10px] gap-1 h-6"><Users className="h-3 w-3" /> {memberList.length}</Badge>
            {!isMember && (
              <Button size="sm" variant="default" onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending} className="h-7 text-xs">
                <UserPlus className="h-3 w-3 mr-1" /> Join
              </Button>
            )}
          </div>
        </div>

        {/* ─── Messages ─── */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="min-h-full flex flex-col justify-end">
            {/* Channel intro */}
            <div className="px-4 pt-8 pb-4">
              <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                {channel.type === 'private' ? <Lock className="h-8 w-8 text-muted-foreground/40" /> : <Hash className="h-8 w-8 text-muted-foreground/40" />}
              </div>
              <h2 className="text-2xl font-bold">Welcome to #{channel.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {channel.description || `This is the start of the #${channel.name} channel.`}
              </p>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="px-2">
                {messagesWithDividers.map((item, idx) => {
                  if (item.type === 'divider') {
                    return (
                      <div key={`divider-${idx}`} className="flex items-center gap-3 py-2 px-2">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[11px] font-semibold text-muted-foreground">{formatDateDivider(item.date)}</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                    );
                  }

                  const { msg, grouped } = item;
                  const isBridged = !!(msg.metadata as Record<string, unknown> | null)?.bridged;
                  const isOwn = !isBridged && msg.userId === user?.id;
                  const replyParent = findReplyParent(msg.replyToId);

                  return (
                    <div
                      key={msg.id}
                      className={`group relative px-2 py-0.5 hover:bg-muted/30 rounded-md transition-colors ${msg.pinned ? 'border-l-2 border-amber-400/50 bg-amber-500/5' : ''}`}
                      onMouseEnter={() => setHoveredMsg(msg.id)}
                      onMouseLeave={() => setHoveredMsg(null)}
                    >
                      {/* Reply indicator */}
                      {replyParent && (
                        <div className="flex items-center gap-2 ml-12 mb-0.5 text-xs text-muted-foreground">
                          <Reply className="h-3 w-3 rotate-180" />
                          <Avatar className="h-4 w-4">
                            <AvatarFallback className={`text-[8px] text-white ${getAvatarColor(replyParent.userId)}`}>
                              {getInitials(replyParent.displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground/70">{replyParent.displayName}</span>
                          <span className="truncate max-w-[300px]">{replyParent.content}</span>
                        </div>
                      )}

                      <div className="flex gap-3">
                        {/* Avatar (only show for first in group) */}
                        {!grouped ? (
                          <Avatar className="h-9 w-9 mt-0.5 shrink-0">
                            <AvatarFallback className={`text-xs font-bold text-white ${isBridged ? 'bg-orange-500' : getAvatarColor(msg.userId)}`}>
                              {isBridged ? '🔗' : getInitials(msg.displayName)}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="w-9 shrink-0 flex items-center justify-center">
                            <span className="text-[10px] text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          {/* Name + timestamp (only for first in group) */}
                          {!grouped && (
                            <div className="flex items-baseline gap-2 mb-0.5">
                              <span className={`text-sm font-semibold ${isBridged ? 'text-orange-400' : isOwn ? 'text-primary' : 'text-foreground'}`}>
                                {isBridged ? 'Washer Bridge' : msg.displayName}
                              </span>
                              {isBridged && <Badge variant="outline" className="text-[9px] h-4 px-1 text-orange-400 border-orange-400/30">bridge</Badge>}
                              <span className="text-[11px] text-muted-foreground">{formatMessageDate(msg.createdAt)}</span>
                              {msg.edited && <span className="text-[10px] text-muted-foreground">(edited)</span>}
                            </div>
                          )}

                          {/* Message content */}
                          {editingId === msg.id ? (
                            <div className="space-y-1">
                              <Textarea
                                value={editContent}
                                onChange={e => setEditContent(e.target.value)}
                                className="min-h-[60px] text-sm"
                                autoFocus
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(); }
                                  if (e.key === 'Escape') { setEditingId(null); setEditContent(''); }
                                }}
                              />
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>escape to <button className="text-primary" onClick={() => { setEditingId(null); setEditContent(''); }}>cancel</button></span>
                                <span>enter to <button className="text-primary" onClick={submitEdit}>save</button></span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-[14px] leading-relaxed whitespace-pre-wrap break-words text-foreground/90">
                              {msg.content}
                            </div>
                          )}

                          {/* Pinned indicator on grouped messages */}
                          {msg.pinned && grouped && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Pin className="h-3 w-3 text-amber-400" />
                              <span className="text-[10px] text-amber-400">Pinned</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Hover action bar */}
                      <AnimatePresence>
                        {hoveredMsg === msg.id && !editingId && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            transition={{ duration: 0.1 }}
                            className="absolute -top-3 right-2 flex items-center bg-card border rounded-md shadow-lg overflow-hidden"
                          >
                            {QUICK_EMOJIS.slice(0, 4).map(emoji => (
                              <button
                                key={emoji}
                                onClick={() => reactionMutation.mutate({ messageId: msg.id, emoji })}
                                className="h-8 w-8 flex items-center justify-center hover:bg-muted/80 transition-colors text-sm"
                              >
                                {emoji}
                              </button>
                            ))}
                            <Separator orientation="vertical" className="h-5" />
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button onClick={() => setReplyTo(msg)} className="h-8 w-8 flex items-center justify-center hover:bg-muted/80 transition-colors">
                                  <Reply className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Reply</TooltipContent>
                            </Tooltip>
                            {isOwn && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button onClick={() => startEdit(msg)} className="h-8 w-8 flex items-center justify-center hover:bg-muted/80 transition-colors">
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Edit</TooltipContent>
                              </Tooltip>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="h-8 w-8 flex items-center justify-center hover:bg-muted/80 transition-colors">
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={() => pinMutation.mutate({ id: msg.id, pinned: !msg.pinned })}>
                                  <Pin className="h-3.5 w-3.5 mr-2" /> {msg.pinned ? 'Unpin' : 'Pin'} message
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(msg.content); toast({ title: "Copied" }); }}>
                                  Copy text
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ─── Typing Indicator ─── */}
        <AnimatePresence>
          {typingDisplay && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 pb-1"
            >
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span className="flex gap-0.5">
                  <span className="h-1.5 w-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
                {typingDisplay}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Input Area ─── */}
        {isMember ? (
          <div className="px-4 pb-4 pt-1">
            {/* Reply preview */}
            <AnimatePresence>
              {replyTo && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 px-3 py-2 mb-1 bg-muted/50 rounded-t-lg border border-b-0 text-xs"
                >
                  <Reply className="h-3.5 w-3.5 text-primary shrink-0 rotate-180" />
                  <span className="text-muted-foreground">Replying to</span>
                  <span className="font-medium text-foreground">{replyTo.displayName}</span>
                  <span className="truncate text-muted-foreground">{replyTo.content}</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto shrink-0" onClick={() => setReplyTo(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className={`flex items-end gap-2 bg-card border rounded-lg ${replyTo ? 'rounded-t-none' : ''} px-3 py-2 focus-within:ring-2 focus-within:ring-primary/20 transition-all`}>
              <Textarea
                ref={inputRef}
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message #${channel.name}...`}
                className="min-h-[20px] max-h-[150px] text-sm border-0 p-0 resize-none focus-visible:ring-0 bg-transparent"
                rows={1}
                data-testid="input-channel-message"
              />
              <div className="flex items-center gap-1 shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                      <Smile className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="p-2">
                    <div className="grid grid-cols-4 gap-1">
                      {QUICK_EMOJIS.map(e => (
                        <button key={e} onClick={() => setMessage(prev => prev + e)} className="h-8 w-8 flex items-center justify-center hover:bg-muted rounded text-lg">
                          {e}
                        </button>
                      ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  onClick={handleSend}
                  disabled={!message.trim() || sendMutation.isPending}
                  size="icon"
                  className={`h-8 w-8 rounded-lg transition-all ${message.trim() ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                  data-testid="button-send-channel-message"
                >
                  {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 border-t text-center">
            <Button onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending} className="gap-2">
              <UserPlus className="h-4 w-4" /> Join #{channel.name} to send messages
            </Button>
          </div>
        )}
      </div>

      {/* ─── Members Sidebar ─── */}
      <AnimatePresence>
        {membersOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 220, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="border-l bg-card/30 overflow-hidden shrink-0 hidden lg:block"
          >
            <div className="w-[220px]">
              <div className="p-3 border-b">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Members — {memberList.length}</h4>
              </div>
              <ScrollArea className="h-[calc(100vh-180px)]">
                <div className="p-2 space-y-0.5">
                  {(['owner', 'admin', 'member'] as const).map(role => {
                    const roleMembers = memberList.filter(m => m.role === role);
                    if (roleMembers.length === 0) return null;
                    return (
                      <div key={role} className="mb-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">
                          {role === 'owner' ? 'Owner' : role === 'admin' ? 'Admins' : 'Members'} — {roleMembers.length}
                        </p>
                        {roleMembers.map(m => (
                          <div key={m.userId} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className={`text-[10px] font-bold text-white ${getAvatarColor(m.userId)}`}>
                                {getInitials(m.displayName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{m.displayName}</p>
                              <p className="text-[10px] text-muted-foreground truncate">@{m.username}</p>
                            </div>
                            {m.role === 'owner' && <Badge variant="outline" className="text-[8px] h-4 px-1 ml-auto shrink-0">owner</Badge>}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
