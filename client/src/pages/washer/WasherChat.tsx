import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Paperclip, Bot, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface RoomMessage {
  id: number;
  roomId: number;
  role: string;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

async function publicFetch(method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export default function WasherChat() {
  const [input, setInput] = useState('');
  const [roomId, setRoomId] = useState<number | null>(null);
  const [resolving, setResolving] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Resolve room on mount
  useEffect(() => {
    setResolving(true);
    publicFetch('POST', '/api/public/rooms/resolve', {
      entityType: 'washer-ops',
      entityId: 'default',
      title: 'Washer Operations Channel',
    })
      .then((room: { id: number }) => setRoomId(room.id))
      .catch(() => {})
      .finally(() => setResolving(false));
  }, []);

  const { data: messages = [] } = useQuery<RoomMessage[]>({
    queryKey: ['/api/public/rooms', roomId, 'messages'],
    queryFn: () => publicFetch('GET', `/api/public/rooms/${roomId}/messages`),
    enabled: roomId !== null,
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      return publicFetch('POST', `/api/public/rooms/${roomId}/messages`, { content, role: 'washer' });
    },
    retry: 1,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/public/rooms', roomId, 'messages'] });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !roomId) return;
    sendMutation.mutate(input.trim());
    setInput('');
  };

  if (resolving) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center px-4 h-14 bg-background/95 border-b shrink-0">
        <h1 className="font-semibold text-lg">Operations Chat</h1>
      </header>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="flex gap-3 flex-row">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-primary/20">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="px-4 py-2 rounded-2xl max-w-[80%] text-sm bg-muted text-foreground">
                Washer Ops Channel. Report any issues or request supplies here.
              </div>
            </div>
          )}
          {messages.map((msg) => {
            const isUser = msg.role === 'washer' || msg.role === 'user';
            return (
              <div key={msg.id} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${!isUser ? 'bg-primary/20' : 'bg-muted'}`}>
                  {!isUser ? <Bot className="h-4 w-4 text-primary" /> : <User className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className={`px-4 py-2 rounded-2xl max-w-[80%] text-sm ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                  {msg.content}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="p-3 bg-background border-t shrink-0">
        <div className="flex items-center gap-2 bg-muted/50 rounded-full p-1 pl-3 border focus-within:ring-1 focus-within:ring-primary/50">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0 text-muted-foreground">
            <Paperclip className="h-4 w-4" />
          </Button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type message..."
            className="flex-1 bg-transparent border-none focus:outline-none text-sm h-10"
          />
          <Button 
            onClick={handleSend}
            disabled={!input.trim() || sendMutation.isPending || !roomId}
            size="icon" 
            className="h-9 w-9 rounded-full shrink-0"
          >
            {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
