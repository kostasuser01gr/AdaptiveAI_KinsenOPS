CREATE TABLE "custom_actions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "custom_actions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"user_id" integer NOT NULL,
	"label" text NOT NULL,
	"icon" text DEFAULT 'Zap' NOT NULL,
	"target" text NOT NULL,
	"placement" text DEFAULT 'header' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"config" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite_tokens" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "invite_tokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"token" text NOT NULL,
	"email" text,
	"role" text DEFAULT 'agent' NOT NULL,
	"created_by" integer NOT NULL,
	"used_by" integer,
	"used_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invite_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "login_history" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "login_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"action" text DEFAULT 'login' NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"session_id" text,
	"success" boolean DEFAULT true NOT NULL,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "setup_state" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "setup_state_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"step" text NOT NULL,
	"data" jsonb NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"address" text,
	"timezone" text DEFAULT 'Europe/Athens' NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_preferences_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"user_id" integer NOT NULL,
	"scope" text DEFAULT 'personal' NOT NULL,
	"category" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"display_name" text NOT NULL,
	"role" text DEFAULT 'agent' NOT NULL,
	"station" text,
	"language" text DEFAULT 'en' NOT NULL,
	"theme" text DEFAULT 'dark' NOT NULL,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "chat_conversations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "chat_conversations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"user_id" integer NOT NULL,
	"title" text DEFAULT 'New Chat' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "chat_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_requests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "shift_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"user_id" integer NOT NULL,
	"shift_id" integer,
	"request_type" text NOT NULL,
	"details" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" integer,
	"review_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "shifts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"employee_name" text NOT NULL,
	"employee_role" text NOT NULL,
	"week_start" text NOT NULL,
	"schedule" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"station_id" integer,
	"fairness_score" real,
	"fatigue_score" real,
	"published_by" integer,
	"published_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notification_preferences_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"category" text NOT NULL,
	"in_app" boolean DEFAULT true NOT NULL,
	"email" boolean DEFAULT false NOT NULL,
	"push" boolean DEFAULT false NOT NULL,
	"sound" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_reads" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notification_reads_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"notification_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"read_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"type" text DEFAULT 'system' NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"audience" text DEFAULT 'broadcast' NOT NULL,
	"recipient_user_id" integer,
	"recipient_role" text,
	"recipient_station_id" integer,
	"metadata" jsonb,
	"assigned_to" integer,
	"status" text DEFAULT 'open' NOT NULL,
	"source_entity_type" text,
	"source_entity_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_executions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "automation_executions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"rule_id" integer NOT NULL,
	"trigger_event" text NOT NULL,
	"trigger_entity_type" text,
	"trigger_entity_id" text,
	"status" text DEFAULT 'running' NOT NULL,
	"result" jsonb,
	"error" text,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_rules" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "automation_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"trigger" text NOT NULL,
	"conditions" jsonb,
	"actions" jsonb,
	"created_by" integer NOT NULL,
	"scope" text DEFAULT 'shared' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"last_triggered" timestamp,
	"trigger_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"user_id" integer,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"details" jsonb,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_feed" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "activity_feed_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"user_id" integer,
	"actor_name" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"entity_label" text,
	"station_id" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_graph_versions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app_graph_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"version" integer NOT NULL,
	"label" text,
	"graph" jsonb NOT NULL,
	"diff" jsonb,
	"created_by" integer NOT NULL,
	"applied_at" timestamp,
	"rolled_back_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "digital_twin_snapshots" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "digital_twin_snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"station_id" integer,
	"snapshot_type" text DEFAULT 'hourly' NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_rooms" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "entity_rooms_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "feedback_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"user_id" integer,
	"role" text,
	"page" text NOT NULL,
	"category" text NOT NULL,
	"message" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "module_registry" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "module_registry_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'operations' NOT NULL,
	"icon" text DEFAULT 'Box' NOT NULL,
	"route" text NOT NULL,
	"required_role" text DEFAULT 'agent' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"config" jsonb
);
--> statement-breakpoint
CREATE TABLE "room_messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "room_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"room_id" integer NOT NULL,
	"user_id" integer,
	"role" text DEFAULT 'user' NOT NULL,
	"content" text NOT NULL,
	"type" text DEFAULT 'message' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_policies" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "system_policies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"rule" jsonb NOT NULL,
	"enforcement" text DEFAULT 'warn' NOT NULL,
	"scope" text DEFAULT 'global' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_config" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workspace_config_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"description" text,
	"updated_by" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_memory" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workspace_memory_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"category" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"source" text DEFAULT 'system' NOT NULL,
	"confidence" real DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_proposals" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workspace_proposals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'general' NOT NULL,
	"impact" text DEFAULT 'low' NOT NULL,
	"scope" text DEFAULT 'personal' NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"payload" jsonb NOT NULL,
	"previous_value" jsonb,
	"reviewed_by" integer,
	"review_note" text,
	"applied_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anomalies" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "anomalies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"type" text NOT NULL,
	"severity" text DEFAULT 'warning' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"station_id" integer,
	"status" text DEFAULT 'open' NOT NULL,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"acknowledged_by" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "executive_briefings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "executive_briefings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"date" text NOT NULL,
	"kpi_summary" jsonb NOT NULL,
	"anomaly_summary" jsonb,
	"recommendations" jsonb,
	"generated_by" text DEFAULT 'system' NOT NULL,
	"station_id" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kpi_definitions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "kpi_definitions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'operations' NOT NULL,
	"unit" text DEFAULT 'count' NOT NULL,
	"target_value" real,
	"warning_threshold" real,
	"critical_threshold" real,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kpi_snapshots" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "kpi_snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"kpi_slug" text NOT NULL,
	"value" real NOT NULL,
	"date" text NOT NULL,
	"station_id" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_connectors" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "integration_connectors_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"direction" text DEFAULT 'inbound' NOT NULL,
	"config" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_sync_at" timestamp,
	"last_sync_status" text,
	"last_sync_message" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "knowledge_chunks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"document_id" integer NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"token_count" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_documents" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "knowledge_documents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"title" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"tags" jsonb,
	"uploaded_by" integer NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_jobs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sync_jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"connector_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"direction" text DEFAULT 'inbound' NOT NULL,
	"entity_type" text DEFAULT 'reservation' NOT NULL,
	"records_processed" integer DEFAULT 0 NOT NULL,
	"records_failed" integer DEFAULT 0 NOT NULL,
	"records_skipped" integer DEFAULT 0 NOT NULL,
	"error_log" jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"triggered_by" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "webhook_deliveries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"webhook_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"response_code" integer,
	"response_body" text,
	"attempt" integer DEFAULT 1 NOT NULL,
	"next_retry_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "webhooks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"events" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"retry_policy" text DEFAULT 'exponential' NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"created_by" integer NOT NULL,
	"last_delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incident_summaries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "incident_summaries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"incident_id" integer NOT NULL,
	"summary" text NOT NULL,
	"data_sources_used" jsonb NOT NULL,
	"kpi_impact" jsonb,
	"generated_by" text DEFAULT 'system' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "incidents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"severity" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"reported_by" integer NOT NULL,
	"assigned_to" integer,
	"vehicle_id" integer,
	"station_id" integer,
	"room_id" integer,
	"metadata" jsonb,
	"resolved_at" timestamp,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "repair_orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"vehicle_id" integer NOT NULL,
	"incident_id" integer,
	"station_id" integer,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"assigned_to" integer,
	"estimated_cost" real,
	"actual_cost" real,
	"estimated_completion" timestamp,
	"completed_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "downtime_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "downtime_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"vehicle_id" integer NOT NULL,
	"reason" text NOT NULL,
	"incident_id" integer,
	"repair_order_id" integer,
	"station_id" integer,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "position_assignments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "position_assignments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"position_id" integer NOT NULL,
	"vehicle_id" integer NOT NULL,
	"assigned_by" integer,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"released_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "quality_inspections" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quality_inspections_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"wash_queue_id" integer NOT NULL,
	"vehicle_plate" text NOT NULL,
	"inspector_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"overall_score" real,
	"checklist" jsonb NOT NULL,
	"photos" jsonb,
	"notes" text,
	"inspected_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reservations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"vehicle_id" integer,
	"station_id" integer,
	"customer_name" text NOT NULL,
	"customer_email" text,
	"customer_phone" text,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"pickup_date" timestamp NOT NULL,
	"return_date" timestamp NOT NULL,
	"actual_pickup" timestamp,
	"actual_return" timestamp,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "station_positions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "station_positions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"station_id" integer NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"type" text DEFAULT 'parking' NOT NULL,
	"capacity" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vehicle_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"vehicle_id" integer NOT NULL,
	"connector_id" integer,
	"source" text DEFAULT 'manual' NOT NULL,
	"external_event_id" text,
	"event_type" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"payload" jsonb,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp,
	"derived_action" text,
	"derived_entity_type" text,
	"derived_entity_id" text
);
--> statement-breakpoint
CREATE TABLE "vehicle_evidence" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vehicle_evidence_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"vehicle_id" integer,
	"type" text NOT NULL,
	"url" text,
	"caption" text,
	"severity" text,
	"source" text DEFAULT 'staff' NOT NULL,
	"reservation_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_transfers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vehicle_transfers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"vehicle_id" integer NOT NULL,
	"from_station_id" integer NOT NULL,
	"to_station_id" integer NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"requested_by" integer NOT NULL,
	"driver_name" text,
	"reason" text,
	"notes" text,
	"estimated_arrival" timestamp,
	"departed_at" timestamp,
	"arrived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vehicles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"plate" text NOT NULL,
	"model" text NOT NULL,
	"category" text DEFAULT 'B' NOT NULL,
	"station_id" integer,
	"status" text DEFAULT 'ready' NOT NULL,
	"sla" text DEFAULT 'normal' NOT NULL,
	"mileage" integer,
	"fuel_level" integer,
	"next_booking" text,
	"timer_info" text,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "wash_queue" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wash_queue_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"vehicle_plate" text NOT NULL,
	"wash_type" text DEFAULT 'Quick Wash' NOT NULL,
	"priority" text DEFAULT 'Normal' NOT NULL,
	"assigned_to" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"sla_info" text,
	"station_id" integer,
	"proof_photo_url" text,
	"sla_deadline" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "entitlement_overrides" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "entitlement_overrides_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"feature" text NOT NULL,
	"enabled" boolean NOT NULL,
	"reason" text,
	"updated_by" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_capabilities" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "role_capabilities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"role" text NOT NULL,
	"capability" text NOT NULL,
	"granted" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_daily_rollups" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "usage_daily_rollups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"feature" text NOT NULL,
	"date" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "usage_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"feature" text NOT NULL,
	"user_id" integer,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"idempotency_key" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_capability_overrides" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_capability_overrides_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"user_id" integer NOT NULL,
	"capability" text NOT NULL,
	"granted" boolean NOT NULL,
	"reason" text,
	"granted_by" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_station_assignments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_station_assignments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"user_id" integer NOT NULL,
	"station_id" integer NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"assigned_by" integer,
	"assigned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_plans" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workspace_plans_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"plan" text DEFAULT 'core' NOT NULL,
	"label" text,
	"activated_at" timestamp DEFAULT now() NOT NULL,
	"activated_by" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_plans_workspace_id_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
CREATE TABLE "export_requests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "export_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"export_type" text NOT NULL,
	"format" text DEFAULT 'csv' NOT NULL,
	"scope" text,
	"filters" jsonb,
	"status" text DEFAULT 'requested' NOT NULL,
	"requested_by" integer NOT NULL,
	"approved_by" integer,
	"approval_note" text,
	"storage_key" text,
	"filename" text,
	"mime_type" text,
	"row_count" integer,
	"error" text,
	"expires_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_attachments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "file_attachments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"url" text,
	"uploaded_by" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "imports_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"filename" text NOT NULL,
	"status" text DEFAULT 'uploading' NOT NULL,
	"uploaded_by" integer NOT NULL,
	"records" integer DEFAULT 0 NOT NULL,
	"columns" integer DEFAULT 0 NOT NULL,
	"mappings" jsonb,
	"diffs" jsonb,
	"raw_data" jsonb,
	"target_table" text DEFAULT 'vehicles' NOT NULL,
	"applied_count" integer,
	"file_type" text DEFAULT 'csv' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ai_model_usage" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_model_usage_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"user_id" integer,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_cents" real,
	"latency_ms" integer,
	"feature" text DEFAULT 'chat' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_training_data" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_training_data_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"user_id" integer,
	"category" text NOT NULL,
	"input" text NOT NULL,
	"expected_output" text NOT NULL,
	"source" text DEFAULT 'user' NOT NULL,
	"quality" real DEFAULT 1 NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "installed_extensions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "installed_extensions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"description" text,
	"author" text,
	"manifest" jsonb NOT NULL,
	"permissions" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb,
	"installed_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_api_keys" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_api_keys_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"user_id" integer NOT NULL,
	"provider" text NOT NULL,
	"label" text NOT NULL,
	"encrypted_key" text NOT NULL,
	"key_prefix" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_members" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "channel_members_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"channel_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"last_read_at" timestamp,
	"muted" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "channel_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"channel_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"content" text NOT NULL,
	"reply_to_id" integer,
	"edited" boolean DEFAULT false NOT NULL,
	"edited_at" timestamp,
	"pinned" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_reactions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "channel_reactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"message_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_channels" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "chat_channels_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'public' NOT NULL,
	"station_id" integer,
	"created_by" integer NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tab_widgets" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tab_widgets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tab_id" integer NOT NULL,
	"widget_slug" text NOT NULL,
	"x" integer DEFAULT 0 NOT NULL,
	"y" integer DEFAULT 0 NOT NULL,
	"w" integer DEFAULT 4 NOT NULL,
	"h" integer DEFAULT 3 NOT NULL,
	"config" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_tabs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_tabs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"user_id" integer NOT NULL,
	"label" text NOT NULL,
	"icon" text DEFAULT 'LayoutGrid' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"template" text,
	"config" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "widget_definitions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "widget_definitions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'general' NOT NULL,
	"icon" text DEFAULT 'Box' NOT NULL,
	"component" text NOT NULL,
	"default_w" integer DEFAULT 4 NOT NULL,
	"default_h" integer DEFAULT 3 NOT NULL,
	"min_w" integer DEFAULT 2 NOT NULL,
	"min_h" integer DEFAULT 2 NOT NULL,
	"max_w" integer,
	"max_h" integer,
	"default_config" jsonb,
	"built_in" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idea_attachments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "idea_attachments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"proposal_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idea_comments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "idea_comments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"proposal_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"content" text NOT NULL,
	"parent_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workshop_jobs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workshop_jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text DEFAULT 'default' NOT NULL,
	"repair_order_id" integer,
	"connector_id" integer,
	"external_job_id" text,
	"workshop_name" text NOT NULL,
	"external_status" text,
	"normalized_status" text DEFAULT 'pending' NOT NULL,
	"estimate_amount" real,
	"invoice_ref" text,
	"notes" text,
	"metadata" jsonb,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_actions" ADD CONSTRAINT "custom_actions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_actions" ADD CONSTRAINT "custom_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "login_history" ADD CONSTRAINT "login_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setup_state" ADD CONSTRAINT "setup_state_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_requests" ADD CONSTRAINT "shift_requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_requests" ADD CONSTRAINT "shift_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_requests" ADD CONSTRAINT "shift_requests_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_requests" ADD CONSTRAINT "shift_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_station_id_stations_id_fk" FOREIGN KEY ("recipient_station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_rule_id_automation_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."automation_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_graph_versions" ADD CONSTRAINT "app_graph_versions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_graph_versions" ADD CONSTRAINT "app_graph_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_twin_snapshots" ADD CONSTRAINT "digital_twin_snapshots_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_twin_snapshots" ADD CONSTRAINT "digital_twin_snapshots_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_rooms" ADD CONSTRAINT "entity_rooms_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_registry" ADD CONSTRAINT "module_registry_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_messages" ADD CONSTRAINT "room_messages_room_id_entity_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."entity_rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_messages" ADD CONSTRAINT "room_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_policies" ADD CONSTRAINT "system_policies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_policies" ADD CONSTRAINT "system_policies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_config" ADD CONSTRAINT "workspace_config_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_config" ADD CONSTRAINT "workspace_config_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_memory" ADD CONSTRAINT "workspace_memory_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_proposals" ADD CONSTRAINT "workspace_proposals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_proposals" ADD CONSTRAINT "workspace_proposals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_proposals" ADD CONSTRAINT "workspace_proposals_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anomalies" ADD CONSTRAINT "anomalies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anomalies" ADD CONSTRAINT "anomalies_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anomalies" ADD CONSTRAINT "anomalies_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executive_briefings" ADD CONSTRAINT "executive_briefings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executive_briefings" ADD CONSTRAINT "executive_briefings_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_definitions" ADD CONSTRAINT "kpi_definitions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_snapshots" ADD CONSTRAINT "kpi_snapshots_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_snapshots" ADD CONSTRAINT "kpi_snapshots_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connectors" ADD CONSTRAINT "integration_connectors_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connectors" ADD CONSTRAINT "integration_connectors_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_knowledge_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."knowledge_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_connector_id_integration_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."integration_connectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_summaries" ADD CONSTRAINT "incident_summaries_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_orders" ADD CONSTRAINT "repair_orders_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_orders" ADD CONSTRAINT "repair_orders_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_orders" ADD CONSTRAINT "repair_orders_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_orders" ADD CONSTRAINT "repair_orders_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downtime_events" ADD CONSTRAINT "downtime_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downtime_events" ADD CONSTRAINT "downtime_events_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downtime_events" ADD CONSTRAINT "downtime_events_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downtime_events" ADD CONSTRAINT "downtime_events_repair_order_id_repair_orders_id_fk" FOREIGN KEY ("repair_order_id") REFERENCES "public"."repair_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downtime_events" ADD CONSTRAINT "downtime_events_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_assignments" ADD CONSTRAINT "position_assignments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_assignments" ADD CONSTRAINT "position_assignments_position_id_station_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."station_positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_assignments" ADD CONSTRAINT "position_assignments_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_assignments" ADD CONSTRAINT "position_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_wash_queue_id_wash_queue_id_fk" FOREIGN KEY ("wash_queue_id") REFERENCES "public"."wash_queue"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_inspector_id_users_id_fk" FOREIGN KEY ("inspector_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_positions" ADD CONSTRAINT "station_positions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_positions" ADD CONSTRAINT "station_positions_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_events" ADD CONSTRAINT "vehicle_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_events" ADD CONSTRAINT "vehicle_events_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_events" ADD CONSTRAINT "vehicle_events_connector_id_integration_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."integration_connectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_evidence" ADD CONSTRAINT "vehicle_evidence_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_evidence" ADD CONSTRAINT "vehicle_evidence_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_transfers" ADD CONSTRAINT "vehicle_transfers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_transfers" ADD CONSTRAINT "vehicle_transfers_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_transfers" ADD CONSTRAINT "vehicle_transfers_from_station_id_stations_id_fk" FOREIGN KEY ("from_station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_transfers" ADD CONSTRAINT "vehicle_transfers_to_station_id_stations_id_fk" FOREIGN KEY ("to_station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_transfers" ADD CONSTRAINT "vehicle_transfers_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wash_queue" ADD CONSTRAINT "wash_queue_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wash_queue" ADD CONSTRAINT "wash_queue_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlement_overrides" ADD CONSTRAINT "entitlement_overrides_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlement_overrides" ADD CONSTRAINT "entitlement_overrides_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_daily_rollups" ADD CONSTRAINT "usage_daily_rollups_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_capability_overrides" ADD CONSTRAINT "user_capability_overrides_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_capability_overrides" ADD CONSTRAINT "user_capability_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_capability_overrides" ADD CONSTRAINT "user_capability_overrides_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_station_assignments" ADD CONSTRAINT "user_station_assignments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_station_assignments" ADD CONSTRAINT "user_station_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_station_assignments" ADD CONSTRAINT "user_station_assignments_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_station_assignments" ADD CONSTRAINT "user_station_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_plans" ADD CONSTRAINT "workspace_plans_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_plans" ADD CONSTRAINT "workspace_plans_activated_by_users_id_fk" FOREIGN KEY ("activated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_requests" ADD CONSTRAINT "export_requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_requests" ADD CONSTRAINT "export_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_requests" ADD CONSTRAINT "export_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_attachments" ADD CONSTRAINT "file_attachments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_attachments" ADD CONSTRAINT "file_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_model_usage" ADD CONSTRAINT "ai_model_usage_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_model_usage" ADD CONSTRAINT "ai_model_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_training_data" ADD CONSTRAINT "ai_training_data_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_training_data" ADD CONSTRAINT "ai_training_data_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installed_extensions" ADD CONSTRAINT "installed_extensions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installed_extensions" ADD CONSTRAINT "installed_extensions_installed_by_users_id_fk" FOREIGN KEY ("installed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_api_keys" ADD CONSTRAINT "user_api_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_api_keys" ADD CONSTRAINT "user_api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_channel_id_chat_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_messages" ADD CONSTRAINT "channel_messages_channel_id_chat_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_messages" ADD CONSTRAINT "channel_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_messages" ADD CONSTRAINT "channel_messages_reply_to_id_channel_messages_id_fk" FOREIGN KEY ("reply_to_id") REFERENCES "public"."channel_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_reactions" ADD CONSTRAINT "channel_reactions_message_id_channel_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."channel_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_reactions" ADD CONSTRAINT "channel_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_channels" ADD CONSTRAINT "chat_channels_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_channels" ADD CONSTRAINT "chat_channels_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_channels" ADD CONSTRAINT "chat_channels_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tab_widgets" ADD CONSTRAINT "tab_widgets_tab_id_user_tabs_id_fk" FOREIGN KEY ("tab_id") REFERENCES "public"."user_tabs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tabs" ADD CONSTRAINT "user_tabs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tabs" ADD CONSTRAINT "user_tabs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "widget_definitions" ADD CONSTRAINT "widget_definitions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_attachments" ADD CONSTRAINT "idea_attachments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_attachments" ADD CONSTRAINT "idea_attachments_proposal_id_workspace_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."workspace_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_attachments" ADD CONSTRAINT "idea_attachments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_comments" ADD CONSTRAINT "idea_comments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_comments" ADD CONSTRAINT "idea_comments_proposal_id_workspace_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."workspace_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_comments" ADD CONSTRAINT "idea_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_comments" ADD CONSTRAINT "idea_comments_parent_id_idea_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."idea_comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_jobs" ADD CONSTRAINT "workshop_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_jobs" ADD CONSTRAINT "workshop_jobs_repair_order_id_repair_orders_id_fk" FOREIGN KEY ("repair_order_id") REFERENCES "public"."repair_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_jobs" ADD CONSTRAINT "workshop_jobs_connector_id_integration_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."integration_connectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_actions_user_idx" ON "custom_actions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "custom_actions_active_idx" ON "custom_actions" USING btree ("active");--> statement-breakpoint
CREATE INDEX "invite_tokens_token_idx" ON "invite_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "invite_tokens_created_by_idx" ON "invite_tokens" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "login_history_user_idx" ON "login_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "login_history_created_idx" ON "login_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "login_history_action_idx" ON "login_history" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "setup_state_ws_step_idx" ON "setup_state" USING btree ("workspace_id","step");--> statement-breakpoint
CREATE UNIQUE INDEX "stations_ws_code_idx" ON "stations" USING btree ("workspace_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "users_ws_username_idx" ON "users" USING btree ("workspace_id","username");--> statement-breakpoint
CREATE INDEX "messages_conv_idx" ON "chat_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "shift_requests_user_idx" ON "shift_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shift_requests_shift_idx" ON "shift_requests" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "shift_requests_status_idx" ON "shift_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "shifts_week_idx" ON "shifts" USING btree ("week_start");--> statement-breakpoint
CREATE INDEX "shifts_status_idx" ON "shifts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "notif_pref_user_cat_idx" ON "notification_preferences" USING btree ("user_id","category");--> statement-breakpoint
CREATE INDEX "notif_pref_user_idx" ON "notification_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_reads_uniq" ON "notification_reads" USING btree ("notification_id","user_id");--> statement-breakpoint
CREATE INDEX "notification_reads_user_idx" ON "notification_reads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_read_idx" ON "notifications" USING btree ("read");--> statement-breakpoint
CREATE INDEX "notifications_created_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_audience_idx" ON "notifications" USING btree ("audience");--> statement-breakpoint
CREATE INDEX "notifications_recipient_user_idx" ON "notifications" USING btree ("recipient_user_id");--> statement-breakpoint
CREATE INDEX "notifications_status_idx" ON "notifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notifications_assigned_idx" ON "notifications" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "automation_exec_rule_idx" ON "automation_executions" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "automation_exec_status_idx" ON "automation_executions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "automation_exec_created_idx" ON "automation_executions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "automation_rules_active_idx" ON "automation_rules" USING btree ("active");--> statement-breakpoint
CREATE INDEX "automation_rules_trigger_idx" ON "automation_rules" USING btree ("trigger");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_user_idx" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_feed_created_idx" ON "activity_feed" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "activity_feed_entity_idx" ON "activity_feed" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "activity_feed_station_idx" ON "activity_feed" USING btree ("station_id");--> statement-breakpoint
CREATE UNIQUE INDEX "app_graph_ws_version_idx" ON "app_graph_versions" USING btree ("workspace_id","version");--> statement-breakpoint
CREATE INDEX "app_graph_created_idx" ON "app_graph_versions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "dt_snapshots_station_idx" ON "digital_twin_snapshots" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "dt_snapshots_created_idx" ON "digital_twin_snapshots" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "dt_snapshots_type_idx" ON "digital_twin_snapshots" USING btree ("snapshot_type");--> statement-breakpoint
CREATE INDEX "entity_rooms_entity_idx" ON "entity_rooms" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "entity_rooms_status_idx" ON "entity_rooms" USING btree ("status");--> statement-breakpoint
CREATE INDEX "feedback_user_idx" ON "feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "feedback_page_idx" ON "feedback" USING btree ("page");--> statement-breakpoint
CREATE INDEX "feedback_created_idx" ON "feedback" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "module_registry_ws_slug_idx" ON "module_registry" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "room_messages_room_idx" ON "room_messages" USING btree ("room_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_config_ws_key_idx" ON "workspace_config" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE INDEX "workspace_memory_category_idx" ON "workspace_memory" USING btree ("workspace_id","category");--> statement-breakpoint
CREATE INDEX "workspace_memory_key_idx" ON "workspace_memory" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE INDEX "proposals_user_idx" ON "workspace_proposals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "proposals_status_idx" ON "workspace_proposals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "anomalies_type_idx" ON "anomalies" USING btree ("type");--> statement-breakpoint
CREATE INDEX "anomalies_status_idx" ON "anomalies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "anomalies_detected_idx" ON "anomalies" USING btree ("detected_at");--> statement-breakpoint
CREATE INDEX "exec_briefings_date_idx" ON "executive_briefings" USING btree ("date");--> statement-breakpoint
CREATE INDEX "exec_briefings_station_idx" ON "executive_briefings" USING btree ("station_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kpi_definitions_ws_slug_idx" ON "kpi_definitions" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "kpi_snapshots_slug_idx" ON "kpi_snapshots" USING btree ("kpi_slug");--> statement-breakpoint
CREATE INDEX "kpi_snapshots_date_idx" ON "kpi_snapshots" USING btree ("date");--> statement-breakpoint
CREATE INDEX "kpi_snapshots_station_idx" ON "kpi_snapshots" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "connectors_type_idx" ON "integration_connectors" USING btree ("type");--> statement-breakpoint
CREATE INDEX "connectors_status_idx" ON "integration_connectors" USING btree ("status");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_doc_idx" ON "knowledge_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_ws_idx" ON "knowledge_chunks" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "kb_docs_category_idx" ON "knowledge_documents" USING btree ("category");--> statement-breakpoint
CREATE INDEX "kb_docs_uploaded_idx" ON "knowledge_documents" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "sync_jobs_connector_idx" ON "sync_jobs" USING btree ("connector_id");--> statement-breakpoint
CREATE INDEX "sync_jobs_status_idx" ON "sync_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sync_jobs_created_idx" ON "sync_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "webhook_del_webhook_idx" ON "webhook_deliveries" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX "webhook_del_status_idx" ON "webhook_deliveries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "webhook_del_created_idx" ON "webhook_deliveries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "webhook_del_retry_idx" ON "webhook_deliveries" USING btree ("next_retry_at");--> statement-breakpoint
CREATE INDEX "webhooks_active_idx" ON "webhooks" USING btree ("active");--> statement-breakpoint
CREATE INDEX "webhooks_ws_idx" ON "webhooks" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "incident_summaries_incident_idx" ON "incident_summaries" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "incidents_status_idx" ON "incidents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "incidents_severity_idx" ON "incidents" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "incidents_vehicle_idx" ON "incidents" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "incidents_station_idx" ON "incidents" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "incidents_assigned_idx" ON "incidents" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "incidents_created_idx" ON "incidents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "repair_orders_vehicle_idx" ON "repair_orders" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "repair_orders_incident_idx" ON "repair_orders" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "repair_orders_status_idx" ON "repair_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "repair_orders_station_idx" ON "repair_orders" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "downtime_vehicle_idx" ON "downtime_events" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "downtime_reason_idx" ON "downtime_events" USING btree ("reason");--> statement-breakpoint
CREATE INDEX "downtime_started_idx" ON "downtime_events" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "pos_assign_position_idx" ON "position_assignments" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "pos_assign_vehicle_idx" ON "position_assignments" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "pos_assign_active_idx" ON "position_assignments" USING btree ("position_id","released_at");--> statement-breakpoint
CREATE INDEX "quality_inspections_wash_idx" ON "quality_inspections" USING btree ("wash_queue_id");--> statement-breakpoint
CREATE INDEX "quality_inspections_vehicle_idx" ON "quality_inspections" USING btree ("vehicle_plate");--> statement-breakpoint
CREATE INDEX "quality_inspections_inspector_idx" ON "quality_inspections" USING btree ("inspector_id");--> statement-breakpoint
CREATE INDEX "quality_inspections_status_idx" ON "quality_inspections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reservations_vehicle_idx" ON "reservations" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "reservations_station_idx" ON "reservations" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "reservations_status_idx" ON "reservations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reservations_pickup_idx" ON "reservations" USING btree ("pickup_date");--> statement-breakpoint
CREATE INDEX "reservations_return_idx" ON "reservations" USING btree ("return_date");--> statement-breakpoint
CREATE UNIQUE INDEX "station_pos_ws_station_code_idx" ON "station_positions" USING btree ("workspace_id","station_id","code");--> statement-breakpoint
CREATE INDEX "station_pos_station_idx" ON "station_positions" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "station_pos_type_idx" ON "station_positions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "ve_vehicle_time_idx" ON "vehicle_events" USING btree ("vehicle_id","occurred_at");--> statement-breakpoint
CREATE INDEX "ve_vehicle_type_idx" ON "vehicle_events" USING btree ("vehicle_id","event_type");--> statement-breakpoint
CREATE INDEX "ve_type_idx" ON "vehicle_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "ve_connector_idx" ON "vehicle_events" USING btree ("connector_id");--> statement-breakpoint
CREATE INDEX "ve_received_idx" ON "vehicle_events" USING btree ("received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ve_external_dedup_idx" ON "vehicle_events" USING btree ("workspace_id","source","external_event_id");--> statement-breakpoint
CREATE INDEX "evidence_vehicle_idx" ON "vehicle_evidence" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "evidence_type_idx" ON "vehicle_evidence" USING btree ("type");--> statement-breakpoint
CREATE INDEX "evidence_created_idx" ON "vehicle_evidence" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "transfers_vehicle_idx" ON "vehicle_transfers" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "transfers_from_idx" ON "vehicle_transfers" USING btree ("from_station_id");--> statement-breakpoint
CREATE INDEX "transfers_to_idx" ON "vehicle_transfers" USING btree ("to_station_id");--> statement-breakpoint
CREATE INDEX "transfers_status_idx" ON "vehicle_transfers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "transfers_created_idx" ON "vehicle_transfers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "vehicles_status_idx" ON "vehicles" USING btree ("status","deleted_at");--> statement-breakpoint
CREATE INDEX "vehicles_station_idx" ON "vehicles" USING btree ("station_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_ws_plate_idx" ON "vehicles" USING btree ("workspace_id","plate");--> statement-breakpoint
CREATE INDEX "wash_queue_status_idx" ON "wash_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wash_queue_station_idx" ON "wash_queue" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "wash_queue_priority_idx" ON "wash_queue" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "wash_queue_sla_idx" ON "wash_queue" USING btree ("sla_deadline");--> statement-breakpoint
CREATE UNIQUE INDEX "ent_override_ws_feature_idx" ON "entitlement_overrides" USING btree ("workspace_id","feature");--> statement-breakpoint
CREATE UNIQUE INDEX "role_cap_role_cap_idx" ON "role_capabilities" USING btree ("role","capability");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_rollup_ws_feature_date_idx" ON "usage_daily_rollups" USING btree ("workspace_id","feature","date");--> statement-breakpoint
CREATE INDEX "usage_rollup_date_idx" ON "usage_daily_rollups" USING btree ("date");--> statement-breakpoint
CREATE INDEX "usage_evt_ws_feature_idx" ON "usage_events" USING btree ("workspace_id","feature");--> statement-breakpoint
CREATE INDEX "usage_evt_created_idx" ON "usage_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "usage_evt_user_idx" ON "usage_events" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_evt_idempotency_idx" ON "usage_events" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "user_cap_user_cap_idx" ON "user_capability_overrides" USING btree ("user_id","capability");--> statement-breakpoint
CREATE INDEX "user_cap_user_idx" ON "user_capability_overrides" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_station_assign_idx" ON "user_station_assignments" USING btree ("user_id","station_id");--> statement-breakpoint
CREATE INDEX "user_station_user_idx" ON "user_station_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_station_station_idx" ON "user_station_assignments" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "export_req_status_idx" ON "export_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "export_req_requested_by_idx" ON "export_requests" USING btree ("requested_by");--> statement-breakpoint
CREATE INDEX "export_req_type_idx" ON "export_requests" USING btree ("export_type");--> statement-breakpoint
CREATE INDEX "export_req_expires_idx" ON "export_requests" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "file_attachments_entity_idx" ON "file_attachments" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "file_attachments_created_idx" ON "file_attachments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "imports_status_idx" ON "imports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "imports_uploaded_by_idx" ON "imports" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "imports_created_idx" ON "imports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_ws_provider_idx" ON "ai_model_usage" USING btree ("workspace_id","provider");--> statement-breakpoint
CREATE INDEX "ai_usage_created_idx" ON "ai_model_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_user_idx" ON "ai_model_usage" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_usage_feature_idx" ON "ai_model_usage" USING btree ("feature");--> statement-breakpoint
CREATE INDEX "ai_training_category_idx" ON "ai_training_data" USING btree ("category");--> statement-breakpoint
CREATE INDEX "ai_training_ws_idx" ON "ai_training_data" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "ai_training_quality_idx" ON "ai_training_data" USING btree ("quality");--> statement-breakpoint
CREATE UNIQUE INDEX "ext_ws_slug_idx" ON "installed_extensions" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "ext_enabled_idx" ON "installed_extensions" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "user_api_keys_user_idx" ON "user_api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_api_keys_provider_idx" ON "user_api_keys" USING btree ("provider");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_member_uniq_idx" ON "channel_members" USING btree ("channel_id","user_id");--> statement-breakpoint
CREATE INDEX "channel_member_user_idx" ON "channel_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ch_msg_channel_idx" ON "channel_messages" USING btree ("channel_id","created_at");--> statement-breakpoint
CREATE INDEX "ch_msg_user_idx" ON "channel_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ch_msg_reply_idx" ON "channel_messages" USING btree ("reply_to_id");--> statement-breakpoint
CREATE INDEX "ch_msg_pinned_idx" ON "channel_messages" USING btree ("channel_id","pinned");--> statement-breakpoint
CREATE UNIQUE INDEX "ch_reaction_uniq_idx" ON "channel_reactions" USING btree ("message_id","user_id","emoji");--> statement-breakpoint
CREATE INDEX "ch_reaction_message_idx" ON "channel_reactions" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "channels_ws_slug_idx" ON "chat_channels" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "channels_type_idx" ON "chat_channels" USING btree ("type");--> statement-breakpoint
CREATE INDEX "channels_station_idx" ON "chat_channels" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "tab_widgets_tab_idx" ON "tab_widgets" USING btree ("tab_id");--> statement-breakpoint
CREATE INDEX "user_tabs_user_idx" ON "user_tabs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_tabs_order_idx" ON "user_tabs" USING btree ("user_id","order");--> statement-breakpoint
CREATE UNIQUE INDEX "widget_defs_ws_slug_idx" ON "widget_definitions" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "widget_defs_category_idx" ON "widget_definitions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idea_attachments_proposal_idx" ON "idea_attachments" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idea_comments_proposal_idx" ON "idea_comments" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idea_comments_user_idx" ON "idea_comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idea_comments_parent_idx" ON "idea_comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "wj_repair_order_idx" ON "workshop_jobs" USING btree ("repair_order_id");--> statement-breakpoint
CREATE INDEX "wj_connector_idx" ON "workshop_jobs" USING btree ("connector_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wj_external_dedup_idx" ON "workshop_jobs" USING btree ("connector_id","external_job_id");--> statement-breakpoint
CREATE INDEX "wj_normalized_status_idx" ON "workshop_jobs" USING btree ("normalized_status");