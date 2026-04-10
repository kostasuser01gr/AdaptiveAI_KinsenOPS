/**
 * Route orchestrator — thin entry point that delegates to domain modules.
 * Phase 4.0A: Split from the monolithic 3904-line routes.ts.
 */
import type { Express } from "express";
import type { Server } from "http";
import { setupAuth } from "./auth.js";
import { authLimiter } from "./middleware/rate-limiter.js";
import { runWithWorkspace } from "./middleware/workspaceContext.js";

// Domain route modules
import { registerVehicleRoutes } from "./routes/vehicles.js";
import { registerWashQueueRoutes } from "./routes/washQueue.js";
import { registerShiftRoutes } from "./routes/shifts.js";
import { registerNotificationRoutes } from "./routes/notifications.js";
import { registerConversationRoutes } from "./routes/conversations.js";
import { registerUserRoutes } from "./routes/users.js";
import { registerAutomationRoutes } from "./routes/automation.js";
import { registerIncidentRoutes } from "./routes/incidents.js";
import { registerReservationRoutes } from "./routes/reservations.js";
import { registerFleetRoutes } from "./routes/fleet.js";
import { registerAnalyticsRoutes } from "./routes/analytics.js";
import { registerConnectorRoutes } from "./routes/connectors.js";
import { registerWorkspaceRoutes } from "./routes/workspace.js";
import { registerImportRoutes } from "./routes/imports.js";
import { registerTrustRoutes } from "./routes/trust.js";
import { registerDocumentRoutes } from "./routes/documents.js";
import { registerPublicRoutes } from "./routes/public.js";
import { registerSystemRoutes } from "./routes/system.js";
import { registerExportRoutes } from "./routes/exports.js";
import { registerEntitlementRoutes } from "./routes/entitlements.js";
import { registerMeteringRoutes } from "./routes/metering.js";
import { registerCapabilityRoutes } from "./routes/capabilities.js";
import { registerStationAssignmentRoutes } from "./routes/stationAssignments.js";
import { registerTelematicsRoutes } from "./routes/telematics.js";
import { registerWorkshopRoutes } from "./routes/workshop.js";
import { registerPositionRoutes } from "./routes/positions.js";
import { registerChannelRoutes } from "./routes/channels.js";
import { registerAppGraphRoutes } from "./routes/appGraph.js";
import { registerExtensionRoutes } from "./routes/extensions.js";
import { registerModelGatewayRoutes } from "./routes/modelGateway.js";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  setupAuth(app);

  // Rate-limit auth endpoints
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);

  // Phase 4.3 — resolve workspace scope for every API request.
  // Reads workspaceId from the authenticated user and stores it in
  // AsyncLocalStorage so all downstream storage queries are scoped.
  app.use("/api", (req, _res, next) => {
    const wsId = (req.user as Express.User | undefined)?.workspaceId ?? "default";
    runWithWorkspace(wsId, () => next());
  });

  // Register all domain route modules
  registerVehicleRoutes(app);
  registerWashQueueRoutes(app);
  registerShiftRoutes(app);
  registerNotificationRoutes(app);
  registerConversationRoutes(app);
  registerUserRoutes(app);
  registerAutomationRoutes(app);
  registerIncidentRoutes(app);
  registerReservationRoutes(app);
  registerFleetRoutes(app);
  registerAnalyticsRoutes(app);
  registerConnectorRoutes(app);
  registerWorkspaceRoutes(app);
  registerImportRoutes(app);
  registerTrustRoutes(app);
  registerDocumentRoutes(app);
  registerPublicRoutes(app);
  registerSystemRoutes(app);
  registerExportRoutes(app);
  registerEntitlementRoutes(app);
  registerMeteringRoutes(app);
  registerCapabilityRoutes(app);
  registerStationAssignmentRoutes(app);
  registerTelematicsRoutes(app);
  registerWorkshopRoutes(app);
  registerPositionRoutes(app);
  registerChannelRoutes(app);
  registerAppGraphRoutes(app);
  registerExtensionRoutes(app);
  registerModelGatewayRoutes(app);

  return httpServer;
}
