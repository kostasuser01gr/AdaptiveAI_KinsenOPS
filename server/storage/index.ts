/**
 * Composed storage singleton — aggregates all domain modules into one object
 * that satisfies the full IStorage interface.
 */
import type { IStorage } from "./types.js";

import { UserStorage } from "./users.js";
import { ChatStorage } from "./chat.js";
import { VehicleStorage } from "./vehicles.js";
import { WashQueueStorage } from "./washQueue.js";
import { ShiftStorage } from "./shifts.js";
import { NotificationStorage } from "./notifications.js";
import { AutomationStorage } from "./automation.js";
import { TrustStorage } from "./trust.js";
import { WorkspaceStorage } from "./workspace.js";
import { AnalyticsStorage } from "./analytics.js";
import { IncidentStorage } from "./incidents.js";
import { ReservationStorage } from "./reservations.js";
import { RepairStorage } from "./repairs.js";
import { KpiStorage } from "./kpi.js";
import { ConnectorStorage } from "./connectors.js";
import { DocumentStorage } from "./documents.js";
import { ImportStorage } from "./imports.js";
import { ExportStorage } from "./exports.js";
import { EntitlementStorage } from "./entitlements.js";
import { MeteringStorage } from "./metering.js";
import { CapabilityStorage } from "./capabilities.js";
import { StationAssignmentStorage } from "./stationAssignments.js";
import { VehicleEventStorage } from "./vehicleEvents.js";
import { WorkshopJobStorage } from "./workshopJobs.js";

// Instantiate each domain
const userStorage = new UserStorage();
const chatStorage = new ChatStorage();
const vehicleStorage = new VehicleStorage();
const washQueueStorage = new WashQueueStorage();
const shiftStorage = new ShiftStorage();
const notificationStorage = new NotificationStorage();
const automationStorage = new AutomationStorage();
const trustStorage = new TrustStorage();
const workspaceStorage = new WorkspaceStorage();
const analyticsStorage = new AnalyticsStorage();
const incidentStorage = new IncidentStorage();
const reservationStorage = new ReservationStorage();
const repairStorage = new RepairStorage();
const kpiStorage = new KpiStorage();
const connectorStorage = new ConnectorStorage();
const documentStorage = new DocumentStorage();
const importStorage = new ImportStorage();
const exportStorage = new ExportStorage();
const entitlementStorage = new EntitlementStorage();
const meteringStorage = new MeteringStorage();
const capabilityStorage = new CapabilityStorage();
const stationAssignmentStorage = new StationAssignmentStorage();
const vehicleEventStorage = new VehicleEventStorage();
const workshopJobStorage = new WorkshopJobStorage();

/**
 * Composed DatabaseStorage — delegates every call to the matching domain module.
 * Satisfies IStorage so all downstream consumers see no change.
 */
class DatabaseStorage implements IStorage {
  // Users
  getUser = userStorage.getUser.bind(userStorage);
  getUserById = userStorage.getUserById.bind(userStorage);
  getUserByUsername = userStorage.getUserByUsername.bind(userStorage);
  getUserByUsernameUnscoped = userStorage.getUserByUsernameUnscoped.bind(userStorage);
  getUsers = userStorage.getUsers.bind(userStorage);
  createUser = userStorage.createUser.bind(userStorage);
  updateUser = userStorage.updateUser.bind(userStorage);
  deleteUser = userStorage.deleteUser.bind(userStorage);
  getUserPreferences = userStorage.getUserPreferences.bind(userStorage);
  getUserPreference = userStorage.getUserPreference.bind(userStorage);
  setUserPreference = userStorage.setUserPreference.bind(userStorage);
  deleteUserPreference = userStorage.deleteUserPreference.bind(userStorage);
  getCustomActions = userStorage.getCustomActions.bind(userStorage);
  getCustomAction = userStorage.getCustomAction.bind(userStorage);
  createCustomAction = userStorage.createCustomAction.bind(userStorage);
  deleteCustomAction = userStorage.deleteCustomAction.bind(userStorage);
  getStations = userStorage.getStations.bind(userStorage);
  createStation = userStorage.createStation.bind(userStorage);
  updateStation = userStorage.updateStation.bind(userStorage);

  // Chat
  getConversations = chatStorage.getConversations.bind(chatStorage);
  getConversation = chatStorage.getConversation.bind(chatStorage);
  createConversation = chatStorage.createConversation.bind(chatStorage);
  updateConversation = chatStorage.updateConversation.bind(chatStorage);
  deleteConversation = chatStorage.deleteConversation.bind(chatStorage);
  getMessages = chatStorage.getMessages.bind(chatStorage);
  createMessage = chatStorage.createMessage.bind(chatStorage);

  // Vehicles
  getVehicles = vehicleStorage.getVehicles.bind(vehicleStorage);
  getVehicle = vehicleStorage.getVehicle.bind(vehicleStorage);
  createVehicle = vehicleStorage.createVehicle.bind(vehicleStorage);
  updateVehicle = vehicleStorage.updateVehicle.bind(vehicleStorage);
  deleteVehicle = vehicleStorage.deleteVehicle.bind(vehicleStorage);
  restoreVehicle = vehicleStorage.restoreVehicle.bind(vehicleStorage);
  getVehicleEvidence = vehicleStorage.getVehicleEvidence.bind(vehicleStorage);
  createVehicleEvidence = vehicleStorage.createVehicleEvidence.bind(vehicleStorage);

  // Wash queue
  getWashQueue = washQueueStorage.getWashQueue.bind(washQueueStorage);
  createWashQueueItem = washQueueStorage.createWashQueueItem.bind(washQueueStorage);
  updateWashQueueItem = washQueueStorage.updateWashQueueItem.bind(washQueueStorage);
  deleteWashQueueItem = washQueueStorage.deleteWashQueueItem.bind(washQueueStorage);
  getOverdueWashItems = washQueueStorage.getOverdueWashItems.bind(washQueueStorage);

  // Shifts
  getShifts = shiftStorage.getShifts.bind(shiftStorage);
  getPublishedShifts = shiftStorage.getPublishedShifts.bind(shiftStorage);
  createShift = shiftStorage.createShift.bind(shiftStorage);
  updateShift = shiftStorage.updateShift.bind(shiftStorage);
  publishShift = shiftStorage.publishShift.bind(shiftStorage);
  deleteShift = shiftStorage.deleteShift.bind(shiftStorage);
  getShiftRequests = shiftStorage.getShiftRequests.bind(shiftStorage);
  createShiftRequest = shiftStorage.createShiftRequest.bind(shiftStorage);
  reviewShiftRequest = shiftStorage.reviewShiftRequest.bind(shiftStorage);

  // Notifications
  getNotifications = notificationStorage.getNotifications.bind(notificationStorage);
  createNotification = notificationStorage.createNotification.bind(notificationStorage);
  updateNotification = notificationStorage.updateNotification.bind(notificationStorage);
  markNotificationRead = notificationStorage.markNotificationRead.bind(notificationStorage);
  markAllNotificationsRead = notificationStorage.markAllNotificationsRead.bind(notificationStorage);
  getNotificationStats = notificationStorage.getNotificationStats.bind(notificationStorage);

  // Automation
  getAutomationRules = automationStorage.getAutomationRules.bind(automationStorage);
  getAutomationRule = automationStorage.getAutomationRule.bind(automationStorage);
  createAutomationRule = automationStorage.createAutomationRule.bind(automationStorage);
  updateAutomationRule = automationStorage.updateAutomationRule.bind(automationStorage);
  deleteAutomationRule = automationStorage.deleteAutomationRule.bind(automationStorage);
  testAutomationRule = automationStorage.testAutomationRule.bind(automationStorage);
  getAutomationExecutions = automationStorage.getAutomationExecutions.bind(automationStorage);
  createAutomationExecution = automationStorage.createAutomationExecution.bind(automationStorage);
  updateAutomationExecution = automationStorage.updateAutomationExecution.bind(automationStorage);

  // Trust / Audit
  getAuditLog = trustStorage.getAuditLog.bind(trustStorage);
  createAuditEntry = trustStorage.createAuditEntry.bind(trustStorage);
  deleteAuditEntriesBefore = trustStorage.deleteAuditEntriesBefore.bind(trustStorage);

  // Entity rooms
  getEntityRooms = workspaceStorage.getEntityRooms.bind(workspaceStorage);
  getEntityRoom = workspaceStorage.getEntityRoom.bind(workspaceStorage);
  getEntityRoomByEntity = workspaceStorage.getEntityRoomByEntity.bind(workspaceStorage);
  createEntityRoom = workspaceStorage.createEntityRoom.bind(workspaceStorage);
  updateEntityRoom = workspaceStorage.updateEntityRoom.bind(workspaceStorage);
  getRoomMessages = workspaceStorage.getRoomMessages.bind(workspaceStorage);
  createRoomMessage = workspaceStorage.createRoomMessage.bind(workspaceStorage);

  // Workspace memory
  getWorkspaceMemory = workspaceStorage.getWorkspaceMemory.bind(workspaceStorage);
  createWorkspaceMemory = workspaceStorage.createWorkspaceMemory.bind(workspaceStorage);
  updateWorkspaceMemory = workspaceStorage.updateWorkspaceMemory.bind(workspaceStorage);

  // Digital twin
  getDigitalTwinSnapshots = workspaceStorage.getDigitalTwinSnapshots.bind(workspaceStorage);
  createDigitalTwinSnapshot = workspaceStorage.createDigitalTwinSnapshot.bind(workspaceStorage);
  getDigitalTwinTimeline = workspaceStorage.getDigitalTwinTimeline.bind(workspaceStorage);

  // System policies
  getSystemPolicies = workspaceStorage.getSystemPolicies.bind(workspaceStorage);
  createSystemPolicy = workspaceStorage.createSystemPolicy.bind(workspaceStorage);
  updateSystemPolicy = workspaceStorage.updateSystemPolicy.bind(workspaceStorage);
  deleteSystemPolicy = workspaceStorage.deleteSystemPolicy.bind(workspaceStorage);

  // Activity feed
  getActivityFeed = workspaceStorage.getActivityFeed.bind(workspaceStorage);
  createActivityEntry = workspaceStorage.createActivityEntry.bind(workspaceStorage);

  // Module registry
  getModuleRegistry = workspaceStorage.getModuleRegistry.bind(workspaceStorage);
  createModuleEntry = workspaceStorage.createModuleEntry.bind(workspaceStorage);
  updateModuleEntry = workspaceStorage.updateModuleEntry.bind(workspaceStorage);

  // Workspace config
  getWorkspaceConfig = workspaceStorage.getWorkspaceConfig.bind(workspaceStorage);
  getWorkspaceConfigByKey = workspaceStorage.getWorkspaceConfigByKey.bind(workspaceStorage);
  setWorkspaceConfig = workspaceStorage.setWorkspaceConfig.bind(workspaceStorage);
  deleteWorkspaceConfigByKey = workspaceStorage.deleteWorkspaceConfigByKey.bind(workspaceStorage);

  // Proposals & feedback
  getProposals = workspaceStorage.getProposals.bind(workspaceStorage);
  getProposal = workspaceStorage.getProposal.bind(workspaceStorage);
  createProposal = workspaceStorage.createProposal.bind(workspaceStorage);
  updateProposal = workspaceStorage.updateProposal.bind(workspaceStorage);
  createFeedback = workspaceStorage.createFeedback.bind(workspaceStorage);
  getFeedback = workspaceStorage.getFeedback.bind(workspaceStorage);

  // File attachments
  getFileAttachments = documentStorage.getFileAttachments.bind(documentStorage);
  getFileAttachment = documentStorage.getFileAttachment.bind(documentStorage);
  createFileAttachment = documentStorage.createFileAttachment.bind(documentStorage);
  deleteFileAttachment = documentStorage.deleteFileAttachment.bind(documentStorage);

  // Knowledge documents
  getKnowledgeDocuments = documentStorage.getKnowledgeDocuments.bind(documentStorage);
  getKnowledgeDocument = documentStorage.getKnowledgeDocument.bind(documentStorage);
  createKnowledgeDocument = documentStorage.createKnowledgeDocument.bind(documentStorage);
  updateKnowledgeDocument = documentStorage.updateKnowledgeDocument.bind(documentStorage);
  deleteKnowledgeDocument = documentStorage.deleteKnowledgeDocument.bind(documentStorage);
  searchKnowledgeDocuments = documentStorage.searchKnowledgeDocuments.bind(documentStorage);

  // Imports
  getImports = importStorage.getImports.bind(importStorage);
  getImport = importStorage.getImport.bind(importStorage);
  createImport = importStorage.createImport.bind(importStorage);
  updateImport = importStorage.updateImport.bind(importStorage);
  deleteImport = importStorage.deleteImport.bind(importStorage);

  // Analytics (cross-domain)
  getDashboardStats = analyticsStorage.getDashboardStats.bind(analyticsStorage);
  getAnalyticsSummary = analyticsStorage.getAnalyticsSummary.bind(analyticsStorage);
  getAnalyticsTrends = analyticsStorage.getAnalyticsTrends.bind(analyticsStorage);
  getVehicleTrends = analyticsStorage.getVehicleTrends.bind(analyticsStorage);
  searchEntities = analyticsStorage.searchEntities.bind(analyticsStorage);

  // Incidents
  getIncidents = incidentStorage.getIncidents.bind(incidentStorage);
  getIncident = incidentStorage.getIncident.bind(incidentStorage);
  createIncident = incidentStorage.createIncident.bind(incidentStorage);
  updateIncident = incidentStorage.updateIncident.bind(incidentStorage);
  getIncidentSummaries = incidentStorage.getIncidentSummaries.bind(incidentStorage);
  createIncidentSummary = incidentStorage.createIncidentSummary.bind(incidentStorage);

  // Reservations
  getReservations = reservationStorage.getReservations.bind(reservationStorage);
  getReservation = reservationStorage.getReservation.bind(reservationStorage);
  createReservation = reservationStorage.createReservation.bind(reservationStorage);
  updateReservation = reservationStorage.updateReservation.bind(reservationStorage);

  // Repair orders
  getRepairOrders = repairStorage.getRepairOrders.bind(repairStorage);
  getRepairOrder = repairStorage.getRepairOrder.bind(repairStorage);
  createRepairOrder = repairStorage.createRepairOrder.bind(repairStorage);
  updateRepairOrder = repairStorage.updateRepairOrder.bind(repairStorage);

  // Downtime events
  getDowntimeEvents = repairStorage.getDowntimeEvents.bind(repairStorage);
  getDowntimeEvent = repairStorage.getDowntimeEvent.bind(repairStorage);
  createDowntimeEvent = repairStorage.createDowntimeEvent.bind(repairStorage);
  updateDowntimeEvent = repairStorage.updateDowntimeEvent.bind(repairStorage);

  // KPI engine
  getKpiDefinitions = kpiStorage.getKpiDefinitions.bind(kpiStorage);
  getKpiDefinition = kpiStorage.getKpiDefinition.bind(kpiStorage);
  createKpiDefinition = kpiStorage.createKpiDefinition.bind(kpiStorage);
  updateKpiDefinition = kpiStorage.updateKpiDefinition.bind(kpiStorage);
  getKpiSnapshots = kpiStorage.getKpiSnapshots.bind(kpiStorage);
  createKpiSnapshot = kpiStorage.createKpiSnapshot.bind(kpiStorage);

  // Anomalies
  getAnomalies = kpiStorage.getAnomalies.bind(kpiStorage);
  getAnomaly = kpiStorage.getAnomaly.bind(kpiStorage);
  createAnomaly = kpiStorage.createAnomaly.bind(kpiStorage);
  updateAnomaly = kpiStorage.updateAnomaly.bind(kpiStorage);

  // Executive briefings
  getExecutiveBriefings = kpiStorage.getExecutiveBriefings.bind(kpiStorage);
  getExecutiveBriefing = kpiStorage.getExecutiveBriefing.bind(kpiStorage);
  createExecutiveBriefing = kpiStorage.createExecutiveBriefing.bind(kpiStorage);

  // Integration connectors
  getIntegrationConnectors = connectorStorage.getIntegrationConnectors.bind(connectorStorage);
  getIntegrationConnectorsUnscoped = connectorStorage.getIntegrationConnectorsUnscoped.bind(connectorStorage);
  getIntegrationConnector = connectorStorage.getIntegrationConnector.bind(connectorStorage);
  createIntegrationConnector = connectorStorage.createIntegrationConnector.bind(connectorStorage);
  updateIntegrationConnector = connectorStorage.updateIntegrationConnector.bind(connectorStorage);
  deleteIntegrationConnector = connectorStorage.deleteIntegrationConnector.bind(connectorStorage);

  // Sync jobs
  getSyncJobs = connectorStorage.getSyncJobs.bind(connectorStorage);
  getSyncJob = connectorStorage.getSyncJob.bind(connectorStorage);
  createSyncJob = connectorStorage.createSyncJob.bind(connectorStorage);
  updateSyncJob = connectorStorage.updateSyncJob.bind(connectorStorage);

  // Export requests
  getExportRequests = exportStorage.getExportRequests.bind(exportStorage);
  getExportRequest = exportStorage.getExportRequest.bind(exportStorage);
  createExportRequest = exportStorage.createExportRequest.bind(exportStorage);
  updateExportRequest = exportStorage.updateExportRequest.bind(exportStorage);
  getExpiredExportRequests = exportStorage.getExpiredExportRequests.bind(exportStorage);
  getProcessableExportRequests = exportStorage.getProcessableExportRequests.bind(exportStorage);

  // Workspace plans & entitlements
  getWorkspacePlan = entitlementStorage.getWorkspacePlan.bind(entitlementStorage);
  upsertWorkspacePlan = entitlementStorage.upsertWorkspacePlan.bind(entitlementStorage);
  getEntitlementOverrides = entitlementStorage.getEntitlementOverrides.bind(entitlementStorage);
  getEntitlementOverride = entitlementStorage.getEntitlementOverride.bind(entitlementStorage);
  upsertEntitlementOverride = entitlementStorage.upsertEntitlementOverride.bind(entitlementStorage);
  deleteEntitlementOverride = entitlementStorage.deleteEntitlementOverride.bind(entitlementStorage);

  // Usage metering
  recordUsageEvent = meteringStorage.recordUsageEvent.bind(meteringStorage);
  getUsageEvents = meteringStorage.getUsageEvents.bind(meteringStorage);
  incrementDailyRollup = meteringStorage.incrementDailyRollup.bind(meteringStorage);
  getDailyRollups = meteringStorage.getDailyRollups.bind(meteringStorage);
  getUsageTotal = meteringStorage.getUsageTotal.bind(meteringStorage);

  // Capability permissions
  getRoleCapabilities = capabilityStorage.getRoleCapabilities.bind(capabilityStorage);
  getAllRoleCapabilities = capabilityStorage.getAllRoleCapabilities.bind(capabilityStorage);
  upsertRoleCapability = capabilityStorage.upsertRoleCapability.bind(capabilityStorage);
  deleteRoleCapability = capabilityStorage.deleteRoleCapability.bind(capabilityStorage);
  getUserCapabilityOverrides = capabilityStorage.getUserCapabilityOverrides.bind(capabilityStorage);
  upsertUserCapabilityOverride = capabilityStorage.upsertUserCapabilityOverride.bind(capabilityStorage);
  deleteUserCapabilityOverride = capabilityStorage.deleteUserCapabilityOverride.bind(capabilityStorage);

  // Station assignments
  getUserStationAssignments = stationAssignmentStorage.getUserStationAssignments.bind(stationAssignmentStorage);
  getStationUsers = stationAssignmentStorage.getStationUsers.bind(stationAssignmentStorage);
  assignUserToStation = stationAssignmentStorage.assignUserToStation.bind(stationAssignmentStorage);
  removeUserFromStation = stationAssignmentStorage.removeUserFromStation.bind(stationAssignmentStorage);
  setUserStations = stationAssignmentStorage.setUserStations.bind(stationAssignmentStorage);
  resolveUserStationIds = stationAssignmentStorage.resolveUserStationIds.bind(stationAssignmentStorage);

  // Vehicle events (Phase 4.2B)
  createVehicleEvent = vehicleEventStorage.createVehicleEvent.bind(vehicleEventStorage);
  createVehicleEventEx = vehicleEventStorage.createVehicleEventEx.bind(vehicleEventStorage);
  getVehicleEvents = vehicleEventStorage.getVehicleEvents.bind(vehicleEventStorage);
  getVehicleEvent = vehicleEventStorage.getVehicleEvent.bind(vehicleEventStorage);
  markVehicleEventProcessed = vehicleEventStorage.markVehicleEventProcessed.bind(vehicleEventStorage);
  countVehicleEvents = vehicleEventStorage.countVehicleEvents.bind(vehicleEventStorage);
  countVehicleEventsByType = vehicleEventStorage.countVehicleEventsByType.bind(vehicleEventStorage);

  // Workshop jobs (Phase 4.2B)
  upsertWorkshopJob = workshopJobStorage.upsertWorkshopJob.bind(workshopJobStorage);
  getWorkshopJobs = workshopJobStorage.getWorkshopJobs.bind(workshopJobStorage);
  getWorkshopJob = workshopJobStorage.getWorkshopJob.bind(workshopJobStorage);
  updateWorkshopJob = workshopJobStorage.updateWorkshopJob.bind(workshopJobStorage);
  linkWorkshopJobToRepairOrder = workshopJobStorage.linkWorkshopJobToRepairOrder.bind(workshopJobStorage);
}

export const storage = new DatabaseStorage();
export type { IStorage };
