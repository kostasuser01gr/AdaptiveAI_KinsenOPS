import React, { useRef, useEffect, useState } from 'react';
import { Send, Paperclip, Slash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SlashCommand } from '@/pages/chat/types';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  isTyping: boolean;
  slashCommands: SlashCommand[];
  onSend: () => void;
  onSlashSelect: (cmd: SlashCommand) => void;
}

export function ChatInput({ input, setInput, isTyping, slashCommands, onSend, onSlashSelect }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [selectedSlashIdx, setSelectedSlashIdx] = useState(0);

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

  const filteredSlashCommands = slashCommands.filter(c =>
    c.command.includes(slashFilter.toLowerCase()) || c.label.toLowerCase().includes(slashFilter.toLowerCase())
  );

  const handleSlashSelectInternal = (cmd: SlashCommand) => {
    setShowSlashMenu(false);
    onSlashSelect(cmd);
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showSlashMenu && filteredSlashCommands.length > 0) {
        handleSlashSelectInternal(filteredSlashCommands[selectedSlashIdx]);
      } else {
        onSend();
      }
    }
  };

  return (
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
                onClick={() => handleSlashSelectInternal(cmd)}
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

        <div className="relative flex flex-col w-full bg-card border shadow-lg shadow-black/5 dark:shadow-white/5 rounded-2xl focus-within:ring-2 focus-within:ring-primary/20 transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message DriveAI — type / for commands, @ for mentions..."
            className="w-full max-h-[200px] min-h-[52px] resize-none bg-transparent px-4 py-4 text-[15px] focus:outline-none placeholder:text-muted-foreground/70"
            rows={1}
            maxLength={4000}
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
              <Button onClick={onSend} disabled={!input.trim() || isTyping}
                className={`h-8 w-8 rounded-full shrink-0 transition-colors ${input.trim() ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-muted text-muted-foreground'}`}
                size="icon" data-testid="button-send-message">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
