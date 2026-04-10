import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  Hash, Lock, Plus, Send, Users, MessageSquare, Pin, Loader2, ArrowLeft, Link2, PanelLeftClose, PanelLeft,
} from 'lucide-react';
import { usePageLayout } from '@/hooks/useLayoutPreferences';

interface Channel {
  id: number;
  name: string;
  slug: string;
  type: string;
  description: string | null;
  isArchived: boolean;
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
}

export default function ChannelsPage() {
  const [selectedChannel, setSelectedChannel] = React.useState<Channel | null>(null);
  const { get: getChanPref, set: setChanPref } = usePageLayout('channels');
  const sidebarCollapsed = getChanPref<boolean>('sidebarCollapsed', false);
  const lastChannelId = getChanPref<number | null>('lastChannel', null);

  // Subscribe to selected channel for live updates
  const wsChannels = React.useMemo(() => {
    const base = ['activity'];
    if (selectedChannel) base.push(`channel:${selectedChannel.id}`);
    return base;
  }, [selectedChannel]);
  const { send: wsSend } = useWebSocket(wsChannels);

  const { data: channels } = useQuery<Channel[]>({
    queryKey: ["/api/channels"],
    queryFn: () => fetch("/api/channels", { credentials: "include" }).then(r => r.json()),
  });

  const channelList = Array.isArray(channels) ? channels : [];

  // Restore last active channel on first load
  const restoredRef = React.useRef(false);
  React.useEffect(() => {
    if (!restoredRef.current && lastChannelId && channelList.length > 0 && !selectedChannel) {
      const found = channelList.find(c => c.id === lastChannelId);
      if (found) setSelectedChannel(found);
      restoredRef.current = true;
    }
  }, [channelList, lastChannelId, selectedChannel]);

  const selectChannel = React.useCallback((ch: Channel) => {
    setSelectedChannel(ch);
    setChanPref('lastChannel', ch.id);
  }, [setChanPref]);

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* Channel sidebar */}
      <div className={`border-r flex flex-col bg-card/50 shrink-0 transition-all duration-200 ${sidebarCollapsed ? 'w-0 overflow-hidden border-0' : 'w-[260px]'} ${selectedChannel ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-3 border-b flex items-center justify-between">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" /> Channels
          </h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setChanPref('sidebarCollapsed', true)} title="Collapse sidebar">
              <PanelLeftClose className="h-3.5 w-3.5" />
            </Button>
            <CreateChannelDialog />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {channelList.map(ch => (
              <button
                key={ch.id}
                onClick={() => selectChannel(ch)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left ${
                  selectedChannel?.id === ch.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/50 text-foreground/80'
                }`}
              >
                {ch.type === 'private' ? <Lock className="h-3.5 w-3.5 shrink-0" /> : ch.type === 'washer_bridge' ? <Link2 className="h-3.5 w-3.5 shrink-0 text-orange-500" /> : <Hash className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate">{ch.name}</span>
                <Badge variant="outline" className="ml-auto text-[9px] h-4 px-1">{ch.type}</Badge>
              </button>
            ))}
            {channelList.length === 0 && (
              <p className="px-3 py-8 text-sm text-muted-foreground text-center">No channels yet. Create one!</p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Message area */}
      {sidebarCollapsed && (
        <div className="border-r flex flex-col items-center py-3 px-1 bg-card/50">
          <Button variant="ghost" size="icon" className="h-8 w-8 mb-2" onClick={() => setChanPref('sidebarCollapsed', false)} title="Show channels">
            <PanelLeft className="h-4 w-4" />
          </Button>
        </div>
      )}
      {selectedChannel ? (
        <ChannelMessageArea
          channel={selectedChannel}
          onBack={() => setSelectedChannel(null)}
          wsSend={wsSend}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center space-y-2">
            <MessageSquare className="h-12 w-12 mx-auto opacity-30" />
            <p className="text-lg font-medium">Select a channel</p>
            <p className="text-sm">Choose a channel from the sidebar to start chatting</p>
          </div>
        </div>
      )}
    </div>
  );
}

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7"><Plus className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Channel</DialogTitle>
          <DialogDescription>Channels organize conversations by topic or team.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. fleet-updates" />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="station">Station</SelectItem>
                <SelectItem value="washer_bridge">Washer Bridge</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this channel about?" />
          </div>
          <Button onClick={() => createMutation.mutate()} disabled={!name.trim() || createMutation.isPending} className="w-full">
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Hash className="h-4 w-4 mr-2" />}
            Create Channel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChannelMessageArea({ channel, onBack, wsSend }: { channel: Channel; onBack: () => void; wsSend: (msg: Record<string, unknown>) => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [message, setMessage] = React.useState('');
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const typingTimeout = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { data: messages, isLoading } = useQuery<ChannelMessage[]>({
    queryKey: ["/api/channel-messages", channel.id],
    queryFn: () => fetch(`/api/channels/${channel.id}/messages?limit=50`, { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30_000,  // Safety net only; primary updates via WebSocket
  });

  const { data: members } = useQuery<Array<{ userId: number; role: string }>>({
    queryKey: ["/api/channel-members", channel.id],
    queryFn: () => fetch(`/api/channels/${channel.id}/members`, { credentials: "include" }).then(r => r.json()),
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/channels/${channel.id}/messages`, { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channel-messages", channel.id] });
      setMessage('');
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
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

  const messageList = Array.isArray(messages) ? messages : [];
  const memberList = Array.isArray(members) ? members : [];
  const isMember = memberList.some(m => m.userId === user?.id);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messageList.length]);

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
    // Send typing indicator (debounced)
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {}, 3000);
    wsSend({ type: 'typing', channel: `channel:${channel.id}`, displayName: user?.displayName });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h3 className="font-semibold text-sm flex items-center gap-1.5">
            {channel.type === 'private' ? <Lock className="h-3.5 w-3.5" /> : channel.type === 'washer_bridge' ? <Link2 className="h-3.5 w-3.5 text-orange-500" /> : <Hash className="h-3.5 w-3.5" />}
            {channel.name}
          </h3>
          {channel.description && <p className="text-xs text-muted-foreground truncate">{channel.description}</p>}
        </div>
        <Badge variant="outline" className="text-xs gap-1"><Users className="h-3 w-3" /> {memberList.length}</Badge>
        {!isMember && (
          <Button size="sm" variant="outline" onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending}>
            Join
          </Button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : messageList.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messageList.map(msg => {
            const isBridged = !!(msg.metadata as any)?.bridged;
            const bridgeRole = isBridged ? String((msg.metadata as any).senderRole ?? 'washer') : null;
            const isOwn = !isBridged && msg.userId === user?.id;
            return (
            <div key={msg.id} className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                isBridged ? 'bg-orange-500/20 text-orange-500' : 'bg-primary/20 text-primary'
              }`}>
                {isBridged ? '🔗' : String(msg.userId).slice(-2)}
              </div>
              <div className={`max-w-[70%] ${isOwn ? 'text-right' : ''}`}>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium">{isBridged ? `Washer (${bridgeRole})` : `User #${msg.userId}`}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(msg.createdAt).toLocaleTimeString()}</span>
                  {msg.edited && <span className="text-[9px] text-muted-foreground">(edited)</span>}
                  {msg.pinned && <Pin className="h-3 w-3 text-amber-400" />}
                </div>
                <div className={`inline-block px-3 py-2 rounded-lg text-sm ${
                  isOwn
                    ? 'bg-primary text-primary-foreground'
                    : isBridged
                      ? 'bg-orange-500/10 border border-orange-500/20'
                      : 'bg-muted'
                }`}>
                  {msg.content}
                </div>
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* Input */}
      {isMember ? (
        <div className="p-3 border-t">
          <div className="flex gap-2">
            <Input
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message #${channel.name}...`}
              className="flex-1"
            />
            <Button onClick={handleSend} disabled={!message.trim() || sendMutation.isPending} size="icon">
              {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-3 border-t text-center text-sm text-muted-foreground">
          Join this channel to send messages
        </div>
      )}
    </div>
  );
}
