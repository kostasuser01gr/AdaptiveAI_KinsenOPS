import type { LocalMessage } from './types';

/**
 * Detect if an AI response suggests a workspace modification and extract proposal metadata.
 */
export function detectProposalIntent(text: string): LocalMessage['proposal'] | null {
  const lower = text.toLowerCase();

  const buttonPatterns = [
    /(?:i(?:'ll| can| will| could)?|let me|shall i|want me to)\s+(?:add|create|place|put|set up)\s+(?:a\s+)?(?:button|shortcut|quick[\s-]?action|action)\s+(?:for|to|called|labeled|named|that)\s+"?([^".\n]+)"?/i,
    /(?:add|create|place|put)\s+(?:a\s+)?(?:button|shortcut|quick[\s-]?action|action)\s+(?:for|to|called|labeled|named)\s+"?([^".\n]+)"?/i,
    /(?:button|shortcut|action)\s+(?:called|labeled|named)\s+"([^"]+)"/i,
  ];

  const viewPatterns = [
    /(?:i(?:'ll| can| will)?|let me)\s+(?:create|build|add|set up)\s+(?:a\s+)?(?:view|dashboard|panel|widget)\s+(?:for|called|to show|named)\s+"?([^".\n]+)"?/i,
    /(?:create|build|add)\s+(?:a\s+)?(?:view|dashboard|panel|widget)\s+(?:for|called|to show)\s+"?([^".\n]+)"?/i,
  ];

  const workflowPatterns = [
    /(?:i(?:'ll| can| will)?|let me)\s+(?:create|set up|build|configure)\s+(?:a\s+)?(?:workflow|automation|auto[\s-]?rule|process)\s+(?:for|to|that)\s+"?([^".\n]+)"?/i,
    /(?:create|set up|build)\s+(?:a\s+)?(?:workflow|automation|process)\s+(?:for|to|that)\s+"?([^".\n]+)"?/i,
  ];

  const configPatterns = [
    /(?:i(?:'ll| can| will)?|let me)\s+(?:change|update|set|modify|configure)\s+(?:the\s+)?(?:setting|config|configuration|default|preference)\s+(?:for|of|to)\s+"?([^".\n]+)"?/i,
    /(?:change|update|set)\s+(?:the\s+)?(?:default|setting|config)\s+(?:for|of)\s+"?([^".\n]+)"?\s+to\s+"?([^".\n]+)"?/i,
  ];

  const widgetPatterns = [
    /(?:i(?:'ll| can| will)?|let me)\s+(?:add|create|show|embed)\s+(?:a\s+)?(?:widget|tile|card)\s+(?:for|showing|called|named)\s+"?([^".\n]+)"?/i,
    /(?:add|create|show)\s+(?:a\s+)?(?:widget|tile|card)\s+(?:for|showing|called)\s+"?([^".\n]+)"?/i,
  ];

  const tabPatterns = [
    /(?:i(?:'ll| can| will)?|let me)\s+(?:create|add|set up)\s+(?:a\s+)?(?:tab|workspace tab|dashboard tab)\s+(?:called|named|for)\s+"?([^".\n]+)"?/i,
    /(?:create|add)\s+(?:a\s+)?(?:tab|workspace tab)\s+(?:called|named|for)\s+"?([^".\n]+)"?/i,
  ];

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
  for (const pat of widgetPatterns) {
    const match = text.match(pat);
    if (match) {
      const label = (match[1] || '').trim().slice(0, 50);
      if (!label) continue;
      return { type: 'widget', label, icon: 'LayoutGrid', target: '/workspace', previewText: `Add widget to workspace: "${label}"` };
    }
  }
  for (const pat of tabPatterns) {
    const match = text.match(pat);
    if (match) {
      const label = (match[1] || '').trim().slice(0, 50);
      if (!label) continue;
      return { type: 'tab', label, icon: 'LayoutGrid', target: '/workspace', previewText: `Create workspace tab: "${label}"` };
    }
  }
  return null;
}
