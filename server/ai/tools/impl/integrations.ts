/**
 * Integrations Tools — Connector management, sync jobs, imports, exports.
 * Gated by connector_manage capability for most operations.
 */
import { z } from "zod/v4";
import { toolRegistry } from "../registry.js";
import { storage } from "../../../storage.js";
import type { ToolResult } from "../types.js";

// ─── List Connectors ───
toolRegistry.register({
  name: "list_connectors",
  description: "List all integration connectors — third-party systems linked to the platform (GPS trackers, accounting, CRM, etc.).",
  inputSchema: z.object({}),
  requiredCapability: "connector_manage",
  async handler(): Promise<ToolResult> {
    const connectors = await storage.getIntegrationConnectors();
    return {
      content: `${connectors.length} integration connector(s).`,
      data: connectors,
      uiBlock: {
        type: "data_table", title: "Integration Connectors",
        columns: [
          { key: "id", label: "ID" },
          { key: "name", label: "Name" },
          { key: "type", label: "Type" },
          { key: "status", label: "Status" },
          { key: "lastSync", label: "Last Sync" },
        ],
        rows: connectors.slice(0, 20).map((c: any) => ({
          id: c.id,
          name: c.name ?? `Connector #${c.id}`,
          type: c.type ?? "—",
          status: c.status ?? "—",
          lastSync: c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString() : "Never",
        })),
      },
    };
  },
});

// ─── Create Connector ───
toolRegistry.register({
  name: "create_connector",
  description: "Set up a new integration connector to link an external system.",
  inputSchema: z.object({
    name: z.string().describe("Connector display name"),
    type: z.string().describe("Connector type: api, webhook, database, file, custom"),
    config: z.string().optional().describe("JSON configuration string"),
  }),
  requiredCapability: "connector_manage",
  async handler(input, ctx): Promise<ToolResult> {
    const connector = await storage.createIntegrationConnector({
      workspaceId: ctx.workspaceId,
      name: input.name as string,
      type: input.type as string,
      config: input.config ? JSON.parse(input.config as string) : {},
      status: "active",
      createdBy: ctx.userId,
    });
    return {
      content: `Connector "${(connector as any).name}" created (ID: ${connector.id}).`,
      uiBlock: { type: "alert", severity: "success", title: "Connector Created", message: `"${(connector as any).name}" is now active.` },
    };
  },
});

// ─── Trigger Sync ───
toolRegistry.register({
  name: "trigger_sync",
  description: "Trigger a sync job for an integration connector. Pulls or pushes data to/from the external system.",
  inputSchema: z.object({
    connectorId: z.number().describe("Connector ID to sync"),
    direction: z.string().optional().describe("pull, push, or both (default: both)"),
  }),
  requiredCapability: "connector_manage",
  async handler(input, ctx): Promise<ToolResult> {
    const job = await storage.createSyncJob({
      connectorId: input.connectorId as number,
      workspaceId: ctx.workspaceId,
      direction: (input.direction as string) || "both",
      status: "queued",
      triggeredBy: ctx.userId,
    });
    return {
      content: `Sync job #${job.id} queued for connector #${input.connectorId} (${(input.direction as string) || "both"}).`,
      uiBlock: { type: "alert", severity: "info", title: "Sync Started", message: `Sync job #${job.id} is processing.` },
    };
  },
});

// ─── List Sync Jobs ───
toolRegistry.register({
  name: "list_sync_jobs",
  description: "List recent sync jobs for a connector. Shows status, timestamps, and error details.",
  inputSchema: z.object({
    connectorId: z.number().optional().describe("Filter by connector ID"),
  }),
  requiredCapability: "connector_manage",
  async handler(input): Promise<ToolResult> {
    const jobs = await storage.getSyncJobs(input.connectorId as number | undefined);
    return {
      content: `${jobs.length} sync job(s).`,
      data: jobs,
      uiBlock: {
        type: "data_table", title: "Sync Jobs",
        columns: [
          { key: "id", label: "ID" },
          { key: "connectorId", label: "Connector" },
          { key: "direction", label: "Direction" },
          { key: "status", label: "Status" },
          { key: "startedAt", label: "Started" },
        ],
        rows: jobs.slice(0, 15).map((j: any) => ({
          id: j.id,
          connectorId: j.connectorId ?? "—",
          direction: j.direction ?? "—",
          status: j.status ?? "—",
          startedAt: j.startedAt ? new Date(j.startedAt).toLocaleString() : "—",
        })),
      },
    };
  },
});

// ─── List Imports ───
toolRegistry.register({
  name: "list_imports",
  description: "List data imports — CSV, Excel, or API imports of fleet data, customer lists, etc.",
  inputSchema: z.object({
    status: z.string().optional().describe("Filter: pending, processing, completed, failed"),
  }),
  requiredRole: "coordinator",
  async handler(input): Promise<ToolResult> {
    const allImports = await storage.getImports();
    const imports = input.status ? allImports.filter((i: any) => i.status === input.status) : allImports;
    return {
      content: `${imports.length} import(s).`,
      data: imports,
      uiBlock: {
        type: "data_table", title: "Data Imports",
        columns: [
          { key: "id", label: "ID" },
          { key: "filename", label: "File" },
          { key: "type", label: "Type" },
          { key: "status", label: "Status" },
          { key: "rowCount", label: "Rows" },
          { key: "createdAt", label: "Date" },
        ],
        rows: imports.slice(0, 20).map((i: any) => ({
          id: i.id,
          filename: i.filename ?? "—",
          type: i.type ?? "—",
          status: i.status ?? "—",
          rowCount: i.rowCount ?? "—",
          createdAt: i.createdAt ? new Date(i.createdAt).toLocaleDateString() : "—",
        })),
      },
    };
  },
});

// ─── List Exports ───
toolRegistry.register({
  name: "list_exports",
  description: "List data exports — previously generated reports, compliance exports, or data extracts.",
  inputSchema: z.object({
    status: z.string().optional().describe("Filter: pending, processing, completed, failed"),
  }),
  requiredCapability: "trust_export",
  async handler(input): Promise<ToolResult> {
    const allExports = await storage.getExportRequests({
      status: input.status as string | undefined,
    });
    const exports = allExports;
    return {
      content: `${exports.length} export(s).`,
      data: exports,
      uiBlock: {
        type: "data_table", title: "Data Exports",
        columns: [
          { key: "id", label: "ID" },
          { key: "type", label: "Type" },
          { key: "status", label: "Status" },
          { key: "createdAt", label: "Date" },
        ],
        rows: exports.slice(0, 20).map((e: any) => ({
          id: e.id,
          type: e.type ?? "—",
          status: e.status ?? "—",
          createdAt: e.createdAt ? new Date(e.createdAt).toLocaleDateString() : "—",
        })),
      },
    };
  },
});

// ─── Create Export ───
toolRegistry.register({
  name: "create_export",
  description: "Initiate a new data export — generate a compliance report, fleet inventory export, or analytics extract.",
  inputSchema: z.object({
    type: z.string().describe("Export type: fleet_inventory, wash_history, incident_report, analytics, compliance, custom"),
    format: z.string().optional().describe("File format: csv, xlsx, pdf, json (default: csv)"),
    filters: z.string().optional().describe("JSON string of filter criteria"),
  }),
  requiredCapability: "trust_export",
  async handler(input, ctx): Promise<ToolResult> {
    const exp = await storage.createExportRequest({
      workspaceId: ctx.workspaceId,
      exportType: input.type as string,
      format: (input.format as string) || "csv",
      filters: input.filters ? JSON.parse(input.filters as string) : undefined,
      status: "requested",
      requestedBy: ctx.userId,
    });
    return {
      content: `Export #${exp.id} initiated: ${input.type} as ${(input.format as string) || "csv"}. Will be available in Exports when done.`,
      uiBlock: { type: "alert", severity: "info", title: "Export Started", message: `${input.type} export is being generated.` },
    };
  },
});
