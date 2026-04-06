/**
 * Unified command registry for command palette and slash commands.
 * Merges built-in navigation, module-registry entries, and user custom actions.
 */

export interface CommandEntry {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  category: 'navigation' | 'action' | 'slash' | 'recent' | 'custom';
  action: () => void;
  keywords?: string[];
  requiredRole?: string;
  shortcut?: string;
}

export interface SlashCommandEntry {
  id: string;
  command: string;
  label: string;
  description: string;
  icon: string;
  handler: (args: string, helpers: SlashHelpers) => void;
  requiredRole?: string;
}

export interface SlashHelpers {
  navigate: (path: string) => void;
  addToolMessage: (tool: string, result: string) => void;
  dashStats: Record<string, unknown> | null;
}

// ─── BUILT-IN SLASH COMMANDS ───
export function getBuiltinSlashCommands(): Omit<SlashCommandEntry, 'handler'>[] {
  return [
    { id: 'fleet', command: '/fleet', label: 'Fleet Overview', description: 'Show fleet status summary', icon: '🚗' },
    { id: 'wash', command: '/wash', label: 'Wash Queue', description: 'Show active wash queue', icon: '🫧' },
    { id: 'shifts', command: '/shifts', label: 'Shift Info', description: 'Today\'s shift summary', icon: '📅' },
    { id: 'stats', command: '/stats', label: 'Dashboard Stats', description: 'Key operational metrics', icon: '📊' },
    { id: 'navigate', command: '/navigate', label: 'Navigate', description: 'Go to any module', icon: '🧭' },
    { id: 'warroom', command: '/warroom', label: 'War Room', description: 'Open war room', icon: '🛡️' },
    { id: 'memory', command: '/memory', label: 'Workspace Memory', description: 'AI knowledge base', icon: '🧠' },
    { id: 'vehicle', command: '/vehicle', label: 'Vehicle Lookup', description: 'Look up a vehicle by plate', icon: '🔍' },
    { id: 'incident', command: '/incident', label: 'Report Incident', description: 'Create an incident report', icon: '⚠️' },
  ];
}

// ─── MODULE NAVIGATION COMMANDS ───
export function getModuleCommands(
  modules: Array<{ slug: string; name: string; route: string; icon?: string; requiredRole?: string | null; enabled: boolean }>,
  navigate: (path: string) => void,
  userRole: string,
): CommandEntry[] {
  return modules
    .filter(m => m.enabled && (!m.requiredRole || isRoleAllowed(userRole, m.requiredRole)))
    .map(m => ({
      id: `module-${m.slug}`,
      label: m.name,
      description: `Navigate to ${m.name}`,
      icon: m.icon || 'Layout',
      category: 'navigation' as const,
      action: () => navigate(m.route),
      requiredRole: m.requiredRole || undefined,
    }));
}

// ─── CUSTOM ACTION COMMANDS (from DB) ───
export function getCustomActionCommands(
  actions: Array<{ id: number; label: string; icon: string; target: string; placement: string; config?: Record<string, unknown> | null }>,
  navigate: (path: string) => void,
): CommandEntry[] {
  return actions.map(a => ({
    id: `custom-${a.id}`,
    label: a.label,
    icon: a.icon,
    category: (a.placement === 'slash' ? 'slash' : 'custom') as 'slash' | 'custom',
    action: () => {
      if (a.config && Array.isArray((a.config as Record<string, unknown>).steps)) {
        // Macro: execute steps sequentially
        const steps = (a.config as Record<string, unknown>).steps as Array<{ type: string; target: string }>;
        for (const step of steps) {
          if (step.type === 'navigate') navigate(step.target);
        }
      } else if (a.target.startsWith('/')) {
        navigate(a.target);
      }
    },
    keywords: [a.label.toLowerCase()],
  }));
}

// ─── ROLE HIERARCHY ───
const ROLE_HIERARCHY: Record<string, number> = {
  admin: 4,
  supervisor: 3,
  coordinator: 2,
  agent: 1,
};

function isRoleAllowed(userRole: string, requiredRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
}

// ─── FILTER COMMANDS ───
export function filterCommands(commands: CommandEntry[], query: string): CommandEntry[] {
  if (!query.trim()) return commands;
  const q = query.toLowerCase();
  return commands.filter(c =>
    c.label.toLowerCase().includes(q) ||
    c.description?.toLowerCase().includes(q) ||
    c.keywords?.some(k => k.includes(q))
  );
}
