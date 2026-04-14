import React from 'react';
import { MessageSquarePlus, Trash2, PanelLeftClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Conversation {
  id: number;
  title: string;
  createdAt: string;
}

interface ChatConversationSidebarProps {
  conversations: Conversation[];
  activeConversationId: number | null;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onNew: () => void;
  onClose: () => void;
}

export function ChatConversationSidebar({
  conversations,
  activeConversationId,
  onSelect,
  onDelete,
  onNew,
  onClose,
}: ChatConversationSidebarProps) {
  return (
    <div className="w-64 border-r bg-card/50 flex flex-col shrink-0">
      <div className="flex items-center justify-between p-3 border-b">
        <span className="text-sm font-semibold text-muted-foreground">Conversations</span>
        <div className="flex items-center gap-1">
          <Tooltip><TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNew}>
              <MessageSquarePlus className="h-4 w-4" />
            </Button>
          </TooltipTrigger><TooltipContent>New Chat</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </TooltipTrigger><TooltipContent>Hide sidebar</TooltipContent></Tooltip>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {conversations.map(conv => (
            <div
              key={conv.id}
              className={`flex items-center justify-between group px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                conv.id === activeConversationId ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/50 text-muted-foreground'
              }`}
              onClick={() => onSelect(conv.id)}
            >
              <span className="truncate flex-1">{conv.title || 'Untitled'}</span>
              <Button
                variant="ghost" size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No conversations yet</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
