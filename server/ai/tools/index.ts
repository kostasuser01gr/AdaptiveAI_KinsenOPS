/**
 * Tool Registration Index — Import all tool modules to register them.
 * Import this file once at server startup to populate the registry.
 */

// Fleet & Vehicles
import "./impl/fleet.js";

// Operations (wash queue, shifts, incidents)
import "./impl/operations.js";

// Analytics & KPIs
import "./impl/analytics.js";

// Platform (notifications, memory, briefings)
import "./impl/platform.js";

// Navigation & UI
import "./impl/navigation.js";

// Workflows (definitions + tools)
import "../../ai/workflows/definitions.js";
import "./impl/workflows.js";

// Mutations — full CRUD for wash, shifts, incidents, reservations, repairs, downtime
import "./impl/mutations.js";

// Admin — users, stations, config, automation, audit log
import "./impl/admin.js";

// Knowledge Base — documents, SOPs, policies
import "./impl/knowledge.js";

// War Room — entity rooms, collaborative incident management
import "./impl/warroom.js";

// Integrations — connectors, sync jobs, imports, exports
import "./impl/integrations.js";

// Generative UI — compose_dashboard, drill_down, render_chart, render_heatmap
import "./impl/generative-ui.js";

export { toolRegistry } from "./registry.js";
