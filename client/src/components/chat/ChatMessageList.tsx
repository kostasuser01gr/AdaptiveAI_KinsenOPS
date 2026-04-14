import React from 'react';
import {
  Bot, Zap, Wrench, Hammer, Hash, CheckCircle2, Clock, Pin,
  Copy, RefreshCcw, Edit2,
} from 'lucide-react';
import { RenderWidget, getWidgetComponent } from '@/components/widgets';
import { ToolCallDisplay } from '@/components/chat/ToolCallDisplay';
import { UIBlockRenderer } from '@/components/chat/UIBlockRenderer';
import { PipelineProgress, type PipelineStep } from '@/components/chat/PipelineProgress';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import type { LocalMessage } from '@/pages/chat/types';

interface ChatMessageListProps {
  messages: LocalMessage[];
  isTyping: boolean;
  pipelineSteps: PipelineStep[];
  model: string;
  userInitial: string;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onApplyProposal: (proposal: NonNullable<LocalMessage['proposal']>) => void;
  onToolCall: (toolName: string, params: Record<string, unknown>) => void;
  onDrillDown: (prompt: string) => void;
  onCopy: (text: string) => void;
  onRegenerate: (msgId: string) => void;
  onPinToTab: (slug: string, name: string) => void;
}

export function ChatMessageList({
  messages,
  isTyping,
  pipelineSteps,
  model,
  userInitial,
  messagesEndRef,
  onApplyProposal,
  onToolCall,
  onDrillDown,
  onCopy,
  onRegenerate,
  onPinToTab,
}: ChatMessageListProps) {
  return (
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
                        <Button onClick={() => onApplyProposal(msg.proposal!)} className="bg-primary hover:bg-primary/90" data-testid="button-apply-proposal">
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
                    <span className="text-sm font-bold text-primary">{userInitial}</span>
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
                      {msg.agentToolCalls && msg.agentToolCalls.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {msg.agentToolCalls.map(tc => (
                            <ToolCallDisplay
                              key={tc.toolUseId}
                              toolCall={tc}
                              onToolCall={onToolCall}
                            />
                          ))}
                        </div>
                      )}
                      {msg.uiBlocks && msg.uiBlocks.length > 0 && (
                        <div className="mt-3 space-y-3">
                          {msg.uiBlocks.map((block, i) => (
                            <UIBlockRenderer
                              key={i}
                              block={block as any}
                              onToolCall={onToolCall}
                              onDrillDown={onDrillDown}
                            />
                          ))}
                        </div>
                      )}
                      {msg.widget && getWidgetComponent(msg.widget.slug) && (
                        <div className="mt-3 rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
                          <div className="p-3 max-h-[300px] overflow-auto">
                            <RenderWidget componentKey={msg.widget.slug} config={msg.widget.config} />
                          </div>
                          <div className="flex items-center justify-between px-3 py-2 border-t border-border/40 bg-muted/30">
                            <span className="text-xs text-muted-foreground font-medium">{msg.widget.name}</span>
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-primary hover:text-primary"
                              onClick={() => onPinToTab(msg.widget!.slug, msg.widget!.name)}>
                              <Pin className="h-3 w-3" /> Pin to Tab
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className={`flex items-center gap-1 mt-1 ${msg.role === 'user' ? 'mr-2' : 'ml-[-8px]'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                    {msg.role === 'assistant' && !msg.isStreaming && (
                      <>
                        <Tooltip><TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => onCopy(msg.content)}><Copy className="h-4 w-4" /></Button>
                        </TooltipTrigger><TooltipContent>Copy</TooltipContent></Tooltip>
                        <Tooltip><TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => onRegenerate(msg.id)}><RefreshCcw className="h-4 w-4" /></Button>
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
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1 py-3">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
                {pipelineSteps.length > 0 && (
                  <PipelineProgress steps={pipelineSteps} className="w-64" />
                )}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </ScrollArea>
  );
}
