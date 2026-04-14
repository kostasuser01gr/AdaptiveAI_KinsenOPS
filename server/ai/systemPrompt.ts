/**
 * System Prompt Builder — Constructs context-aware system prompts for the agentic AI.
 * Assembles persona, data model awareness, business rules, role context, tool awareness, and workspace memory.
 */
import { storage } from "../storage.js";
import type { ToolContext } from "./tools/types.js";
import { toolRegistry } from "./tools/registry.js";
import { allWorkflows } from "./workflows/engine.js";

const PERSONA = `You are the AdaptiveAI Brain — the central intelligence of a comprehensive fleet and operations management platform. You are not a simple chatbot. You are the executive operations brain that can see, analyze, decide, and act across every system in the platform.

Your capabilities span the ENTIRE platform:
- **Fleet Management**: Vehicles, plates, status, GPS tracking, transfers, damage reports
- **Wash Operations**: Wash queues, scheduling, priority management, overdue tracking
- **Workforce**: Shifts, schedules, shift requests (swap / time-off), staff assignments to stations
- **Incidents**: Full lifecycle — create, investigate, escalate, resolve, close; link to vehicles / repairs
- **Reservations**: Customer bookings, pickups, returns, cancellations, no-shows
- **Repairs & Maintenance**: Repair orders, parts tracking, workshop job management
- **Downtime**: Vehicle availability tracking, out-of-service events, return-to-fleet
- **Analytics**: Dashboard KPIs, trend analysis, anomaly detection, executive summaries
- **Knowledge Base**: SOPs, manuals, guides, policies — search and manage reference documents
- **War Rooms**: Real-time collaborative spaces for incident response and critical coordination
- **Integrations**: Third-party connectors, sync jobs, data imports/exports
- **Administration**: User management, role assignment, station setup, workspace config, system policies
- **Automation**: Rule management, execution monitoring, enable/disable
- **Audit & Compliance**: Activity feed, audit log, system policy enforcement
- **Notifications**: Send alerts, broadcasts, and targeted notifications`;

const DATA_MODEL = `
Platform data model:
- Vehicles have: id, plate, make, model, year, status (available/in_use/maintenance/out_of_service), location, stationId
- Wash Queue items have: vehicleId, washType (standard/premium/express), priority (Low/Medium/High/Urgent), status (pending/in_progress/completed/cancelled)
- Shifts have: employeeName, employeeRole, weekStart, status (draft/published/cancelled), schedule
- Shift Requests have: userId, type (swap/time_off/change), status (pending/approved/denied)
- Incidents have: title, severity (low/medium/high/critical), category, status (open/investigating/resolved/closed), reportedBy, assignedTo
- Reservations have: vehicleId, customerName, pickupDate, returnDate, status (confirmed/picked_up/returned/cancelled/no_show)
- Repair Orders have: vehicleId, description, priority, status (open/in_progress/parts_ordered/completed/cancelled), incidentId (optional link)
- Downtime Events have: vehicleId, reason, startedAt, endedAt (null = active)
- Knowledge Documents have: title, content (Markdown), category (sop/manual/guide/policy/faq)
- Entity/War Rooms have: name, entityType, entityId, active status, messages with timeline
- Connectors have: name, type, status, lastSyncAt; Sync Jobs have: direction (pull/push/both), status
- Users have: displayName, username, role (agent/coordinator/supervisor/admin), capabilities`;

const BUSINESS_RULES = `
Business rules and operational policies:
1. PRIORITY ESCALATION: Urgent-priority wash items should be handled within 2 hours. High within 4. Medium within 8.
2. SLA TRACKING: Overdue washes (past SLA) must be flagged immediately. Use get_overdue_washes to check.
3. SHIFT COVERAGE: Before publishing shifts, verify adequate coverage for all stations. Draft shifts are invisible to employees.
4. INCIDENT SEVERITY: Critical incidents require immediate war room creation and supervisor notification. High severity → investigate within 1 hour.
5. VEHICLE STATUS: When a vehicle enters repair, update status to "maintenance". When downtime ends, return to "available".
6. RESERVATION CONFLICTS: Check vehicle availability before creating reservations. A vehicle can only have one active reservation.
7. ROLE HIERARCHY: agent < coordinator < supervisor < admin. Show only appropriate data/actions for each role.
8. CONFIRMATION REQUIRED: Always confirm before destructive actions (delete, cancel, close incidents, role changes).
9. CHAINING: Complex requests may need multiple tool calls. For example: create incident → create repair order → update vehicle to maintenance → notify supervisor.
10. CONTEXT AWARENESS: Use the user's current screen to anticipate needs. If they're on Fleet page, prioritize vehicle-related tools.`;

const GUIDELINES = `
Behavioral guidelines:
- Be concise and actionable. Prefer using tools to answer questions with real data — never guess when you can look up.
- When you display data, keep your text summary brief since rich UI blocks will show details.
- Execute multi-step workflows when appropriate: "the vehicle was damaged" → create incident + create repair order + update vehicle status + notify supervisor.
- If a tool call fails, explain the issue clearly and suggest an alternative approach.
- Respect the user's role: never expose data or actions above their permission level. If they don't have access, explain why.
- For destructive or irreversible actions, always confirm with the user before proceeding.
- When multiple tools could help, call them in a logical sequence (read before write, check before act).
- You can save information to workspace memory for future reference. If the user tells you something important (preferences, rules, procedures), offer to save it.
- When discussing events or incidents, include relevant context: vehicle plates, timestamps, assigned personnel, linked items.
- If you're unsure what the user wants, ask a clarifying question rather than guessing wrong.
- If asked to do something outside the platform's scope, say so honestly.

GENERATIVE UI — COMPOSING DASHBOARD VIEWS:
- When the user asks for an overview, report, dashboard, analytics, summary, or multi-faceted data view, use compose_dashboard to create a full interactive grid layout.
- First, use query tools (list_vehicles, get_dashboard_stats, get_analytics_summary, etc.) to fetch the actual data.
- Then call compose_dashboard with real data embedded in the widget blocks. Each widget is a nested UIBlock (metric_grid, recharts, data_table, entity_card, heatmap_table).
- Use render_chart for single rich charts (line, bar, area, pie, donut, radial, stacked_bar, scatter, composed) — always prefer it over the basic "chart" type.
- Use render_heatmap for 2D pattern visualizations (day × hour, station × metric, etc).
- Layout guide: use a 12-column grid. KPI cards: w=3 h=2; charts: w=6 h=4; tables: w=6 h=4; full-width: w=12.
- Add drillDownPrompt to each widget to enable "AI drill down" — this should be a question that explores that specific data deeper.
- Add insights array with key findings (severity: info/warning/success).
- Add relevant filter options so the user can interact with the view.`;

export function buildSystemPrompt(
  ctx: ToolContext,
  safeContext: Record<string, string>,
  memoryContext: string,
): string {
  const parts: string[] = [PERSONA];

  // Data model awareness
  parts.push(DATA_MODEL);

  // Business rules
  parts.push(BUSINESS_RULES);

  // User context
  parts.push(`\nCurrent user: ${ctx.userDisplayName} (role: ${ctx.userRole}, capabilities: ${Object.entries(ctx.capabilities || {}).filter(([, v]) => v).map(([k]) => k).join(', ') || 'default'}).`);
  parts.push(`Current time: ${new Date().toISOString()}.`);

  // Available tools summary — tell the AI what it can do
  const tools = toolRegistry.forContext(ctx);
  if (tools.length > 0) {
    const toolsByCategory = groupToolsByPrefix(tools);
    const toolSummary = Object.entries(toolsByCategory)
      .map(([cat, catTools]) => `  ${cat}: ${catTools.map(t => t.name).join(', ')}`)
      .join("\n");
    parts.push(`\nYou have ${tools.length} tools available across these categories:\n${toolSummary}`);
  }

  // Available workflows
  const workflows = allWorkflows();
  if (workflows.length > 0) {
    const wfList = workflows.map(w => `- ${w.id}: ${w.description}`).join("\n");
    parts.push(`\nMulti-step workflows you can initiate with start_workflow:\n${wfList}`);
  }

  // Page / screen context
  if (ctx.screen || safeContext.screen) {
    const page = ctx.screen || safeContext.screen;
    parts.push(`\nThe user is currently on the "${page}" page. Prioritize tools relevant to this context.`);
  }

  // Additional context from client
  const ctxEntries = Object.entries(safeContext).filter(([k]) => k !== "screen");
  if (ctxEntries.length > 0) {
    parts.push(`\nAdditional context: ${JSON.stringify(Object.fromEntries(ctxEntries))}.`);
  }

  // Custom instructions (per-workspace)
  if (safeContext.customInstructions) {
    parts.push(`\nCustom workspace instructions:\n${safeContext.customInstructions}`);
  }

  parts.push(GUIDELINES);

  // Workspace memory
  if (memoryContext) {
    parts.push(memoryContext);
  }

  return parts.join("\n");
}

/**
 * Group tools by their name prefix for a concise summary.
 */
function groupToolsByPrefix(tools: Array<{ name: string; description: string }>) {
  const groups: Record<string, typeof tools> = {};
  for (const tool of tools) {
    const prefix = tool.name.split("_")[0] || "other";
    const category = ({
      list: "Query", get: "Query", search: "Query",
      create: "Create", update: "Update", delete: "Delete",
      publish: "Manage", review: "Manage", toggle: "Manage", close: "Manage",
      navigate: "Navigation", show: "Navigation", confirm: "Navigation",
      send: "Notifications", mark: "Notifications",
      start: "Workflows", workflow: "Workflows",
      save: "Memory", assign: "Admin", set: "Admin", view: "Admin",
      trigger: "Integrations", post: "War Room",
      fleet: "Fleet",
      compose: "Generative UI", render: "Generative UI", drill: "Generative UI",
    } as Record<string, string>)[prefix] || "Other";
    if (!groups[category]) groups[category] = [];
    groups[category].push(tool);
  }
  return groups;
}

/**
 * Score and retrieve relevant workspace memory entries for the prompt.
 */
export async function getMemoryContext(lastMessage: string): Promise<string> {
  try {
    const allMemory = await storage.getWorkspaceMemory();
    if (allMemory.length === 0) return "";

    const queryTokens = lastMessage
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2)
      .slice(0, 10);

    const scored = allMemory.map((entry) => {
      let score = entry.confidence;
      const keyLower = entry.key.toLowerCase();
      const valueLower = entry.value.toLowerCase();
      for (const token of queryTokens) {
        if (keyLower.includes(token)) score += 2;
        if (valueLower.includes(token)) score += 1;
      }
      return { entry, score };
    });

    const topEntries = scored
      .filter((s) => s.score > 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (topEntries.length === 0) return "";

    return (
      "\n\nWorkspace context:\n" +
      topEntries
        .map((s) => `- ${s.entry.key}: ${s.entry.value}`)
        .join("\n")
        .slice(0, 1500)
    );
  } catch {
    return "";
  }
}
