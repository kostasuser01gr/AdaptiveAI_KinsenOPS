/**
 * Route orchestrator — thin entry point that delegates to domain modules.
 * Phase 4.0A: Split from the monolithic 3904-line routes.ts.
 */
import type { Express } from "express";
import type { Server } from "http";
import { setupAuth } from "./auth.js";
import { authLimiter, apiLimiter } from "./middleware/rate-limiter.js";
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
import { registerApiKeyRoutes } from "./routes/apiKeys.js";
import { registerSetupRoutes } from "./routes/setup.js";
import { registerSessionRoutes } from "./routes/sessions.js";
import { registerNotificationPreferenceRoutes } from "./routes/notificationPreferences.js";
import { registerQualityInspectionRoutes } from "./routes/qualityInspections.js";
import { registerWebhookRoutes } from "./routes/webhooks.js";
import { registerVehicleTimelineRoutes } from "./routes/vehicleTimeline.js";
import { registerSystemConfigRoutes } from "./routes/systemConfig.js";
import { registerTabWidgetRoutes } from "./routes/tabWidgets.js";
import { registerIdeaRoutes } from "./routes/ideas.js";
import { logger } from "./observability/logger.js";
import { mountBullBoard } from "./routes/bull-board.js";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Rate-limit auth endpoints — MUST be registered BEFORE setupAuth()
  // so rate limiter middleware runs before the login/register handlers.
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);

  setupAuth(app);

  // CC-1 fix: apiLimiter MUST run AFTER setupAuth() so that req.user is
  // populated by Passport session middleware, enabling per-user rate keying.
  app.use("/api", apiLimiter);

  // Phase 4.3 — resolve workspace scope for every API request.
  // Reads workspaceId from the authenticated user and stores it in
  // AsyncLocalStorage so all downstream storage queries are scoped.
  app.use("/api", (req, _res, next) => {
    const wsId = (req.user as Express.User | undefined)?.workspaceId ?? "default";
    runWithWorkspace(wsId, () => next());
  });

  // Register all domain route modules
  const routeModules: Array<[string, (app: Express) => void]> = [
    ['vehicles', registerVehicleRoutes],
    ['washQueue', registerWashQueueRoutes],
    ['shifts', registerShiftRoutes],
    ['notifications', registerNotificationRoutes],
    ['conversations', registerConversationRoutes],
    ['users', registerUserRoutes],
    ['automation', registerAutomationRoutes],
    ['incidents', registerIncidentRoutes],
    ['reservations', registerReservationRoutes],
    ['fleet', registerFleetRoutes],
    ['analytics', registerAnalyticsRoutes],
    ['connectors', registerConnectorRoutes],
    ['workspace', registerWorkspaceRoutes],
    ['imports', registerImportRoutes],
    ['trust', registerTrustRoutes],
    ['documents', registerDocumentRoutes],
    ['public', registerPublicRoutes],
    ['system', registerSystemRoutes],
    ['exports', registerExportRoutes],
    ['entitlements', registerEntitlementRoutes],
    ['metering', registerMeteringRoutes],
    ['capabilities', registerCapabilityRoutes],
    ['stationAssignments', registerStationAssignmentRoutes],
    ['telematics', registerTelematicsRoutes],
    ['workshop', registerWorkshopRoutes],
    ['positions', registerPositionRoutes],
    ['channels', registerChannelRoutes],
    ['appGraph', registerAppGraphRoutes],
    ['extensions', registerExtensionRoutes],
    ['modelGateway', registerModelGatewayRoutes],
    ['apiKeys', registerApiKeyRoutes],
    ['setup', registerSetupRoutes],
    ['sessions', registerSessionRoutes],
    ['notificationPreferences', registerNotificationPreferenceRoutes],
    ['qualityInspections', registerQualityInspectionRoutes],
    ['webhooks', registerWebhookRoutes],
    ['vehicleTimeline', registerVehicleTimelineRoutes],
    ['systemConfig', registerSystemConfigRoutes],
    ['tabWidgets', registerTabWidgetRoutes],
    ['ideas', registerIdeaRoutes],
  ];

  for (const [name, register] of routeModules) {
    try {
      register(app);
    } catch (err) {
      logger.error(`Failed to register ${name} routes`, err instanceof Error ? err : undefined);
      throw err; // still fatal — but now with diagnostic info
    }
  }

  // BullMQ dashboard — admin-only, only when Redis is available
  const { config } = await import("./config.js");
  const redisUrl = config.redisUrl;
  if (redisUrl) {
    const { requireRole } = await import("./auth.js");
    app.use("/admin/queues", requireRole("admin"));
    mountBullBoard(app, redisUrl);
    logger.info("BullMQ dashboard mounted at /admin/queues");
  }

  return httpServer;
}
