/**
 * Operations Tools — Wash queue, shifts, incidents.
 */
import { z } from "zod/v4";
import { toolRegistry } from "../registry.js";
import { storage } from "../../../storage.js";
import type { ToolResult } from "../types.js";
import { calculateWashPriorityScore, calculateSlaDeadline } from "../../../businessRules.js";

// ─── Wash Queue ───
toolRegistry.register({
  name: "list_wash_queue",
  description: "List the current wash queue with priority scoring. Shows all pending and in-progress wash jobs. Use when asked about washes, queue status, or what needs washing.",
  inputSchema: z.object({
    limit: z.number().optional().describe("Max results (default 20)"),
  }),
  async handler(input): Promise<ToolResult> {
    const queue = await storage.getWashQueue();
    const scored = queue.map((item) => ({
      ...item,
      priorityScore: calculateWashPriorityScore(item),
    })).sort((a, b) => b.priorityScore - a.priorityScore);

    const limited = scored.slice(0, (input.limit as number) || 20);

    return {
      content: `Wash queue: ${queue.length} item(s). Top priority score: ${limited[0]?.priorityScore ?? 0}.`,
      data: limited,
      uiBlock: {
        type: "data_table",
        title: "Wash Queue (by priority)",
        columns: [
          { key: "vehiclePlate", label: "Vehicle" },
          { key: "washType", label: "Type" },
          { key: "priority", label: "Priority" },
          { key: "status", label: "Status" },
          { key: "priorityScore", label: "Score", align: "right" },
        ],
        rows: limited.map((item) => ({
          id: item.id,
          vehiclePlate: item.vehiclePlate || `#${item.id}`,
          washType: item.washType ?? "standard",
          priority: item.priority ?? "Medium",
          status: item.status,
          priorityScore: item.priorityScore,
        })),
      },
    };
  },
});

// ─── Overdue Washes ───
toolRegistry.register({
  name: "get_overdue_washes",
  description: "Get all overdue wash items that have missed their SLA deadline. Use for escalation or SLA breach questions.",
  inputSchema: z.object({}),
  async handler(): Promise<ToolResult> {
    const overdue = await storage.getOverdueWashItems();
    return {
      content: `${overdue.length} overdue wash item(s) found.`,
      data: overdue,
      uiBlock: overdue.length > 0
        ? {
            type: "data_table",
            title: "Overdue Washes",
            columns: [
              { key: "id", label: "ID" },
              { key: "vehiclePlate", label: "Vehicle" },
              { key: "priority", label: "Priority" },
              { key: "status", label: "Status" },
            ],
            rows: overdue.map((item) => ({
              id: item.id,
              vehiclePlate: item.vehiclePlate,
              priority: item.priority ?? "—",
              status: item.status,
            })),
          }
        : {
            type: "alert",
            severity: "success",
            title: "All Clear",
            message: "No overdue wash items found.",
          },
    };
  },
});

// ─── Shifts ───
toolRegistry.register({
  name: "list_shifts",
  description: "List shifts for a given week. Use when asked about scheduling, current shifts, or who is working.",
  inputSchema: z.object({
    weekStart: z.string().optional().describe("ISO date for the start of the week (e.g. 2026-04-06). Defaults to current week."),
  }),
  async handler(input): Promise<ToolResult> {
    const shifts = await storage.getShifts(input.weekStart as string | undefined);
    return {
      content: `Found ${shifts.length} shift(s)${input.weekStart ? ` for week starting ${input.weekStart}` : ""}.`,
      data: shifts,
      uiBlock: {
        type: "data_table",
        title: "Shifts",
        columns: [
          { key: "employeeName", label: "Employee" },
          { key: "employeeRole", label: "Role" },
          { key: "weekStart", label: "Week" },
          { key: "status", label: "Status" },
        ],
        rows: shifts.slice(0, 20).map((s) => ({
          id: s.id,
          employeeName: s.employeeName,
          employeeRole: s.employeeRole,
          weekStart: s.weekStart,
          status: s.status,
        })),
      },
    };
  },
});

// ─── Incidents ───
toolRegistry.register({
  name: "list_incidents",
  description: "List incidents, optionally filtered by status or severity. Use when asked about open issues, incidents, or problems.",
  inputSchema: z.object({
    status: z.string().optional().describe("Filter: open, investigating, resolved, closed"),
    severity: z.string().optional().describe("Filter: low, medium, high, critical"),
  }),
  async handler(input): Promise<ToolResult> {
    const incidents = await storage.getIncidents({
      status: input.status as string | undefined,
      severity: input.severity as string | undefined,
    });
    return {
      content: `Found ${incidents.length} incident(s)${input.status ? ` with status "${input.status}"` : ""}${input.severity ? ` severity "${input.severity}"` : ""}.`,
      data: incidents,
      uiBlock: {
        type: "data_table",
        title: `Incidents${input.status ? ` (${input.status})` : ""}`,
        columns: [
          { key: "id", label: "ID" },
          { key: "title", label: "Title" },
          { key: "severity", label: "Severity" },
          { key: "status", label: "Status" },
          { key: "createdAt", label: "Created" },
        ],
        rows: incidents.slice(0, 20).map((inc) => ({
          id: inc.id,
          title: (inc as any).title ?? `Incident #${inc.id}`,
          severity: (inc as any).severity ?? "—",
          status: (inc as any).status ?? "—",
          createdAt: inc.createdAt ? new Date(inc.createdAt).toLocaleDateString() : "—",
        })),
      },
    };
  },
});

// ─── Get Incident Detail ───
toolRegistry.register({
  name: "get_incident",
  description: "Get detailed information about a specific incident by ID. Includes summaries if available.",
  inputSchema: z.object({
    incidentId: z.number().describe("The incident ID"),
  }),
  async handler(input): Promise<ToolResult> {
    const incident = await storage.getIncident(input.incidentId as number);
    if (!incident) {
      return { content: "Incident not found.", isError: true };
    }

    const summaries = await storage.getIncidentSummaries(input.incidentId as number);

    return {
      content: `Incident #${incident.id}: ${(incident as any).title ?? "No title"} — severity: ${(incident as any).severity ?? "unknown"}, status: ${(incident as any).status ?? "unknown"}.${summaries.length ? ` ${summaries.length} summary(ies) available.` : ""}`,
      data: { incident, summaries },
      uiBlock: {
        type: "entity_card",
        entityType: "incident",
        entityId: incident.id,
        title: (incident as any).title ?? `Incident #${incident.id}`,
        subtitle: (incident as any).description?.slice(0, 80) ?? "",
        status: (incident as any).status ?? "unknown",
        statusColor:
          (incident as any).severity === "critical" ? "red" :
          (incident as any).severity === "high" ? "yellow" :
          "gray",
        fields: [
          { label: "Severity", value: (incident as any).severity ?? "—" },
          { label: "Status", value: (incident as any).status ?? "—" },
          { label: "Station", value: (incident as any).stationId ?? "—" },
          { label: "Assigned", value: (incident as any).assignedTo ?? "Unassigned" },
          { label: "Created", value: incident.createdAt ? new Date(incident.createdAt).toLocaleDateString() : "—" },
        ],
      },
    };
  },
});
