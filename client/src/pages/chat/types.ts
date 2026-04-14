export interface LocalMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'builder_proposal' | 'tool_call';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  proposal?: {
    type: 'button' | 'view' | 'workflow' | 'config' | 'widget' | 'tab';
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
  agentToolCalls?: Array<{
    toolUseId: string;
    name: string;
    input?: Record<string, unknown>;
    result?: string;
    uiBlock?: unknown;
    isError?: boolean;
    status: 'running' | 'done' | 'error';
  }>;
  uiBlocks?: unknown[];
  entities?: Array<{ type: string; label: string; id?: string }>;
  widget?: {
    slug: string;
    name: string;
    config?: Record<string, unknown>;
  };
}

export interface SlashCommand {
  command: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  handler: (args: string) => void;
}
