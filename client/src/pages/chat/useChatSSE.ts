import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { detectProposalIntent } from './detectProposal';
import type { LocalMessage } from './types';
import type { PipelineStep } from '@/components/chat/PipelineProgress';

interface UseChatSSEParams {
  activeConversationId: number | null;
  setActiveConversationId: (id: number | null) => void;
  model: string;
  dashStats?: {
    vehicles?: number;
    washQueue?: number;
    shifts?: number;
    stations?: number;
    unreadNotifications?: number;
  };
}

export function useChatSSE({ activeConversationId, setActiveConversationId, model, dashStats }: UseChatSSEParams) {
  const queryClient = useQueryClient();
  const [isTyping, setIsTyping] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([]);

  const callAI = useCallback(async (
    userContent: string,
    history: LocalMessage[],
    setMessages: React.Dispatch<React.SetStateAction<LocalMessage[]>>,
  ) => {
    const responseId = (Date.now() + 1).toString();
    const entityMentions = userContent.match(/@[\w-]+/g) || [];
    const entities = entityMentions.map(m => ({ type: 'mention', label: m.slice(1) }));
    setPipelineSteps([]);

    setMessages(prev => [...prev, {
      id: responseId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
      entities: entities.length > 0 ? entities : undefined,
    }]);

    try {
      const apiMessages = history
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-20)
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      apiMessages.push({ role: 'user', content: userContent });

      let convId = activeConversationId;
      if (!convId) {
        const createRes = await apiRequest('POST', '/api/conversations', { title: userContent.slice(0, 50) });
        if (!createRes.ok) throw new Error('Failed to create conversation');
        const conv = await createRes.json();
        convId = conv.id;
        setActiveConversationId(convId);
        queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all() });
      }

      const res = await apiRequest('POST', '/api/ai/chat', {
        conversationId: convId,
        messages: apiMessages,
        model: model === 'DriveAI-Builder' ? 'anthropic/claude-sonnet-4-20250514'
             : model === 'DriveAI-4' ? 'anthropic/claude-sonnet-4-20250514'
             : model === 'DriveAI-Fleet' ? 'anthropic/claude-haiku-4-20250514'
             : undefined,
        context: {
          vehicles: String(dashStats?.vehicles ?? ''),
          washQueue: String(dashStats?.washQueue ?? ''),
          shifts: String(dashStats?.shifts ?? ''),
          stations: String(dashStats?.stations ?? ''),
          unreadNotifications: String(dashStats?.unreadNotifications ?? ''),
          screen: 'chat',
        },
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
                msg.id === responseId ? { ...msg, content: msg.content + event.content } : msg
              ));
            } else if (event.type === 'tool_start') {
              setMessages(prev => prev.map(msg => {
                if (msg.id !== responseId) return msg;
                const existing = msg.agentToolCalls ?? [];
                return {
                  ...msg,
                  agentToolCalls: [...existing, {
                    toolUseId: event.toolUseId,
                    name: event.name,
                    input: event.input,
                    status: 'running' as const,
                  }],
                };
              }));
            } else if (event.type === 'tool_result') {
              setMessages(prev => prev.map(msg => {
                if (msg.id !== responseId) return msg;
                const calls = (msg.agentToolCalls ?? []).map(tc =>
                  tc.toolUseId === event.toolUseId
                    ? { ...tc, result: event.result, isError: event.isError, status: (event.isError ? 'error' : 'done') as 'done' | 'error' }
                    : tc
                );
                return { ...msg, agentToolCalls: calls };
              }));
            } else if (event.type === 'ui_block') {
              setMessages(prev => prev.map(msg => {
                if (msg.id !== responseId) return msg;
                const blocks = msg.uiBlocks ?? [];
                return { ...msg, uiBlocks: [...blocks, event.block] };
              }));
            } else if (event.type === 'pipeline_step') {
              setPipelineSteps(prev => {
                const existing = prev.findIndex(s => s.step === event.step);
                if (existing >= 0) {
                  const updated = [...prev];
                  updated[existing] = { step: event.step, status: event.status, detail: event.detail, timestamp: Date.now() };
                  return updated;
                }
                return [...prev, { step: event.step, status: event.status, detail: event.detail, timestamp: Date.now() }];
              });
            } else if (event.type === 'error') {
              setMessages(prev => prev.map(msg =>
                msg.id === responseId ? { ...msg, content: event.message || 'An error occurred.', isStreaming: false } : msg
              ));
              setIsTyping(false);
            } else if (event.type === 'done') {
              setPipelineSteps([]);
              setMessages(prev => {
                const updated = prev.map(msg =>
                  msg.id === responseId ? { ...msg, isStreaming: false } : msg
                );
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
          } catch (parseErr) {
            console.warn('SSE parse error:', parseErr, line);
          }
        }
      }
    } catch (_err) {
      setMessages(prev => prev.map(msg =>
        msg.id === responseId
          ? { ...msg, content: 'Sorry, I encountered an error. Please try again.', isStreaming: false }
          : msg
      ));
      setIsTyping(false);
    }
  }, [activeConversationId, setActiveConversationId, model, dashStats, queryClient]);

  return { callAI, isTyping, setIsTyping, pipelineSteps };
}
