/**
 * Tool Call Display — Shows tool execution status in the chat.
 * Renders tool_start as a loading state, tool_result as the result.
 */
import { Loader2, Wrench, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UIBlockRenderer } from "./UIBlockRenderer";

interface ToolCall {
  toolUseId: string;
  name: string;
  input?: Record<string, unknown>;
  result?: string;
  uiBlock?: unknown;
  isError?: boolean;
  status: "running" | "done" | "error";
}

interface ToolCallDisplayProps {
  toolCall: ToolCall;
  onToolCall?: (toolName: string, params: Record<string, unknown>) => void;
}

const toolLabels: Record<string, string> = {
  // Fleet
  list_vehicles: "Checking fleet vehicles",
  get_vehicle: "Looking up vehicle details",
  update_vehicle_status: "Updating vehicle",
  fleet_summary: "Getting fleet overview",
  // Operations
  list_wash_queue: "Checking wash queue",
  get_overdue_washes: "Looking for overdue washes",
  list_shifts: "Reviewing shift schedule",
  list_incidents: "Checking incidents",
  get_incident: "Looking up incident",
  // Analytics
  get_dashboard_stats: "Pulling dashboard stats",
  get_analytics_summary: "Gathering analytics",
  get_analytics_trends: "Analyzing trends",
  get_kpi_snapshots: "Loading KPI data",
  list_anomalies: "Detecting anomalies",
  search: "Searching",
  // Platform
  list_notifications: "Checking notifications",
  mark_notifications_read: "Clearing notifications",
  get_workspace_memory: "Accessing workspace memory",
  get_latest_briefing: "Getting executive briefing",
  // Navigation
  navigate: "Navigating",
  show_widget: "Loading widget",
  confirm_action: "Awaiting confirmation",
  // Mutations — wash, shifts, incidents, reservations, repairs, downtime
  create_wash_item: "Adding to wash queue",
  update_wash_item: "Updating wash item",
  create_shift: "Creating shift",
  update_shift: "Updating shift",
  publish_shift: "Publishing shift",
  review_shift_request: "Reviewing shift request",
  create_incident: "Filing incident report",
  update_incident: "Updating incident",
  create_reservation: "Creating reservation",
  update_reservation: "Updating reservation",
  create_repair_order: "Creating repair order",
  update_repair_order: "Updating repair order",
  list_repair_orders: "Listing repair orders",
  create_downtime: "Recording downtime",
  close_downtime: "Closing downtime event",
  list_downtime: "Listing downtime events",
  list_reservations: "Listing reservations",
  list_shift_requests: "Checking shift requests",
  send_notification: "Sending notification",
  // Admin
  list_users: "Loading user list",
  update_user_role: "Updating user role",
  list_stations: "Loading stations",
  create_station: "Creating station",
  assign_user_station: "Assigning user to station",
  get_workspace_config: "Reading config",
  set_workspace_config: "Updating config",
  list_automations: "Loading automation rules",
  toggle_automation: "Toggling automation",
  view_audit_log: "Reading audit log",
  get_activity_feed: "Loading activity feed",
  save_workspace_memory: "Saving to memory",
  create_custom_action: "Creating shortcut",
  list_system_policies: "Loading policies",
  // Knowledge
  list_knowledge_docs: "Browsing knowledge base",
  get_knowledge_doc: "Reading document",
  create_knowledge_doc: "Creating document",
  update_knowledge_doc: "Updating document",
  delete_knowledge_doc: "Deleting document",
  // War Room
  list_war_rooms: "Checking war rooms",
  create_war_room: "Creating war room",
  post_to_war_room: "Posting to war room",
  get_war_room_messages: "Reading war room messages",
  close_war_room: "Closing war room",
  // Integrations
  list_connectors: "Loading connectors",
  create_connector: "Creating connector",
  trigger_sync: "Triggering sync",
  list_sync_jobs: "Checking sync jobs",
  list_imports: "Loading imports",
  list_exports: "Loading exports",
  create_export: "Starting export",
  // Workflows
  list_workflows: "Loading workflows",
  start_workflow: "Starting workflow",
  workflow_advance: "Advancing workflow step",
  workflow_cancel: "Cancelling workflow",
  // Generative UI
  compose_dashboard: "Composing dashboard",
  drill_down: "AI drill-down analysis",
  render_chart: "Rendering chart",
  render_heatmap: "Rendering heatmap",
};

export function ToolCallDisplay({ toolCall, onToolCall }: ToolCallDisplayProps) {
  const label = toolLabels[toolCall.name] ?? toolCall.name.replace(/_/g, " ");

  return (
    <div className="my-2 space-y-2">
      <div className="flex items-center gap-2 text-sm">
        {toolCall.status === "running" ? (
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
        ) : toolCall.status === "error" || toolCall.isError ? (
          <XCircle className="w-4 h-4 text-red-500" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        )}
        <Wrench className="w-3 h-3 text-muted-foreground" />
        <span className="text-muted-foreground">{label}</span>
        <Badge variant="outline" className="text-xs font-mono">
          {toolCall.name}
        </Badge>
      </div>

      {toolCall.uiBlock != null && toolCall.status === "done" && (
        <div className="ml-6">
          <UIBlockRenderer
            block={toolCall.uiBlock as any}
            onToolCall={onToolCall}
          />
        </div>
      )}
    </div>
  );
}
