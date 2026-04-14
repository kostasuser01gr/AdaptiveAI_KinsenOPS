/**
 * Central storage interface contract.
 * All domain modules implement slices of this interface.
 * The composed DatabaseStorage class satisfies the full IStorage contract.
 */
import type {
  User, InsertUser,
  UserPreference, InsertUserPreference,
  ChatConversation, InsertConversation,
  ChatMessage, InsertMessage,
  Vehicle, InsertVehicle,
  VehicleEvidence, InsertVehicleEvidence,
  WashQueueItem, InsertWashQueue,
  Shift, InsertShift,
  ShiftRequest, InsertShiftRequest,
  Notification, InsertNotification,
  CustomAction, InsertCustomAction,
  Station, InsertStation,
  AutomationRule, InsertAutomationRule,
  AuditLog, InsertAuditLog,
  EntityRoom, InsertEntityRoom,
  RoomMessage, InsertRoomMessage,
  WorkspaceMemory, InsertWorkspaceMemory,
  DigitalTwinSnapshot, InsertDigitalTwinSnapshot,
  SystemPolicy, InsertSystemPolicy,
  ActivityFeedEntry, InsertActivityFeed,
  ModuleRegistryEntry, InsertModuleRegistry,
  WorkspaceConfigEntry, InsertWorkspaceConfig,
  FileAttachment, InsertFileAttachment,
  Import, InsertImport,
  WorkspaceProposal, InsertWorkspaceProposal,
  Feedback, InsertFeedback,
  Incident, InsertIncident,
  AutomationExecution, InsertAutomationExecution,
  Reservation, InsertReservation,
  RepairOrder, InsertRepairOrder,
  DowntimeEvent, InsertDowntimeEvent,
  KpiDefinition, InsertKpiDefinition,
  KpiSnapshot, InsertKpiSnapshot,
  Anomaly, InsertAnomaly,
  ExecutiveBriefing, InsertExecutiveBriefing,
  IntegrationConnector, InsertIntegrationConnector,
  SyncJob, InsertSyncJob,
  KnowledgeDocument, InsertKnowledgeDocument,
  IncidentSummary, InsertIncidentSummary,
  ExportRequest, InsertExportRequest,
  WorkspacePlan, InsertWorkspacePlan,
  EntitlementOverride, InsertEntitlementOverride,
  UsageEvent, InsertUsageEvent,
  UsageDailyRollup, InsertUsageDailyRollup,
  UserStationAssignment, InsertUserStationAssignment,
  RoleCapability, InsertRoleCapability,
  UserCapabilityOverride, InsertUserCapabilityOverride,
  VehicleEvent, InsertVehicleEvent,
  WorkshopJob, InsertWorkshopJob,
  StationPosition, InsertStationPosition,
  PositionAssignment, InsertPositionAssignment,
  VehicleTransfer, InsertVehicleTransfer,
  ChatChannel, InsertChatChannel,
  ChannelMember, InsertChannelMember,
  ChannelMessage, InsertChannelMessage,
  ChannelReaction, InsertChannelReaction,
  AppGraphVersion, InsertAppGraphVersion,
  AiModelUsage, InsertAiModelUsage,
  InstalledExtension, InsertInstalledExtension,
  InviteToken, InsertInviteToken,
  UserTab, InsertUserTab,
  WidgetDefinition, InsertWidgetDefinition,
  TabWidget, InsertTabWidget,
  IdeaComment, InsertIdeaComment,
  IdeaAttachment, InsertIdeaAttachment,
} from "../../shared/schema.js";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByUsernameUnscoped(username: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  updateUserUnscoped(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<void>;

  // User preferences
  getUserPreferences(userId: number, category?: string): Promise<UserPreference[]>;
  getUserPreference(id: number): Promise<UserPreference | undefined>;
  setUserPreference(data: InsertUserPreference): Promise<UserPreference>;
  deleteUserPreference(id: number): Promise<void>;

  // Chat
  getConversations(userId: number): Promise<ChatConversation[]>;
  getConversation(id: number): Promise<ChatConversation | undefined>;
  createConversation(data: InsertConversation): Promise<ChatConversation>;
  updateConversation(id: number, data: Partial<InsertConversation>): Promise<ChatConversation | undefined>;
  deleteConversation(id: number): Promise<void>;
  getMessages(conversationId: number): Promise<ChatMessage[]>;
  createMessage(data: InsertMessage): Promise<ChatMessage>;

  // Vehicles
  getVehicles(filters?: { stationIds?: number[] }): Promise<Vehicle[]>;
  getVehicle(id: number): Promise<Vehicle | undefined>;
  createVehicle(data: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: number, data: Partial<InsertVehicle>): Promise<Vehicle | undefined>;
  deleteVehicle(id: number): Promise<void>;
  restoreVehicle(id: number): Promise<Vehicle | undefined>;
  getVehicleEvidence(vehicleId: number): Promise<VehicleEvidence[]>;
  createVehicleEvidence(data: InsertVehicleEvidence): Promise<VehicleEvidence>;

  // Wash queue
  getWashQueue(): Promise<WashQueueItem[]>;
  createWashQueueItem(data: InsertWashQueue): Promise<WashQueueItem>;
  updateWashQueueItem(id: number, data: Partial<InsertWashQueue>): Promise<WashQueueItem | undefined>;
  deleteWashQueueItem(id: number): Promise<void>;
  getOverdueWashItems(): Promise<WashQueueItem[]>;

  // Shifts
  getShifts(weekStart?: string): Promise<Shift[]>;
  getPublishedShifts(weekStart?: string): Promise<Shift[]>;
  createShift(data: InsertShift): Promise<Shift>;
  updateShift(id: number, data: Partial<InsertShift>): Promise<Shift | undefined>;
  publishShift(id: number, publishedBy: number): Promise<Shift | undefined>;
  deleteShift(id: number): Promise<void>;
  getShiftRequests(userId?: number): Promise<ShiftRequest[]>;
  createShiftRequest(data: InsertShiftRequest): Promise<ShiftRequest>;
  reviewShiftRequest(id: number, reviewedBy: number, status: string, note?: string): Promise<ShiftRequest | undefined>;

  // Notifications
  getNotifications(userId: number, role: string, stationId?: number): Promise<(Notification & { read: boolean })[]>;
  createNotification(data: InsertNotification): Promise<Notification>;
  updateNotification(id: number, data: Partial<InsertNotification>): Promise<Notification | undefined>;
  markNotificationRead(notificationId: number, userId: number): Promise<void>;
  markAllNotificationsRead(userId: number, role: string, stationId?: number): Promise<void>;
  getNotificationStats(userId: number, role: string, stationId?: number): Promise<{ open: number; inProgress: number; resolved: number; escalated: number }>;

  // Custom actions
  getCustomActions(userId: number): Promise<CustomAction[]>;
  getCustomAction(id: number): Promise<CustomAction | undefined>;
  createCustomAction(data: InsertCustomAction): Promise<CustomAction>;
  deleteCustomAction(id: number): Promise<void>;

  // Stations
  getStations(): Promise<Station[]>;
  createStation(data: InsertStation): Promise<Station>;
  updateStation(id: number, data: Partial<InsertStation>): Promise<Station | undefined>;

  // Automation
  getAutomationRules(userId?: number): Promise<AutomationRule[]>;
  getAutomationRule(id: number): Promise<AutomationRule | undefined>;
  createAutomationRule(data: InsertAutomationRule): Promise<AutomationRule>;
  updateAutomationRule(id: number, data: Partial<InsertAutomationRule>): Promise<AutomationRule | undefined>;
  deleteAutomationRule(id: number): Promise<void>;
  testAutomationRule(id: number): Promise<{ valid: boolean; errors: string[]; matchingEntities: number }>;
  getAutomationExecutions(ruleId?: number, limit?: number): Promise<AutomationExecution[]>;
  createAutomationExecution(data: InsertAutomationExecution): Promise<AutomationExecution>;
  updateAutomationExecution(id: number, data: Partial<AutomationExecution>): Promise<AutomationExecution | undefined>;

  // Audit
  getAuditLog(limit?: number): Promise<AuditLog[]>;
  createAuditEntry(data: InsertAuditLog): Promise<AuditLog>;
  deleteAuditEntriesBefore(cutoff: Date): Promise<number>;

  // Entity rooms
  getEntityRooms(entityType?: string): Promise<EntityRoom[]>;
  getEntityRoom(id: number): Promise<EntityRoom | undefined>;
  getEntityRoomByEntity(entityType: string, entityId: string): Promise<EntityRoom | undefined>;
  createEntityRoom(data: InsertEntityRoom): Promise<EntityRoom>;
  updateEntityRoom(id: number, data: Partial<InsertEntityRoom>): Promise<EntityRoom | undefined>;
  getRoomMessages(roomId: number): Promise<RoomMessage[]>;
  createRoomMessage(data: InsertRoomMessage): Promise<RoomMessage>;

  // Workspace memory
  getWorkspaceMemory(category?: string): Promise<WorkspaceMemory[]>;
  createWorkspaceMemory(data: InsertWorkspaceMemory): Promise<WorkspaceMemory>;
  updateWorkspaceMemory(id: number, data: Partial<InsertWorkspaceMemory>): Promise<WorkspaceMemory | undefined>;

  // Digital twin
  getDigitalTwinSnapshots(stationId?: number): Promise<DigitalTwinSnapshot[]>;
  createDigitalTwinSnapshot(data: InsertDigitalTwinSnapshot): Promise<DigitalTwinSnapshot>;
  getDigitalTwinTimeline(stationId?: number, from?: string, to?: string): Promise<DigitalTwinSnapshot[]>;

  // System policies
  getSystemPolicies(category?: string): Promise<SystemPolicy[]>;
  createSystemPolicy(data: InsertSystemPolicy): Promise<SystemPolicy>;
  updateSystemPolicy(id: number, data: Partial<InsertSystemPolicy>): Promise<SystemPolicy | undefined>;
  deleteSystemPolicy(id: number): Promise<void>;

  // Activity feed
  getActivityFeed(limit?: number): Promise<ActivityFeedEntry[]>;
  createActivityEntry(data: InsertActivityFeed): Promise<ActivityFeedEntry>;

  // Module registry
  getModuleRegistry(): Promise<ModuleRegistryEntry[]>;
  createModuleEntry(data: InsertModuleRegistry): Promise<ModuleRegistryEntry>;
  updateModuleEntry(id: number, data: Partial<InsertModuleRegistry>): Promise<ModuleRegistryEntry | undefined>;

  // Workspace config
  getWorkspaceConfig(category?: string): Promise<WorkspaceConfigEntry[]>;
  getWorkspaceConfigByKey(key: string): Promise<WorkspaceConfigEntry | undefined>;
  setWorkspaceConfig(data: InsertWorkspaceConfig): Promise<WorkspaceConfigEntry>;
  deleteWorkspaceConfigByKey(key: string): Promise<void>;

  // File attachments
  getFileAttachments(entityType: string, entityId: string): Promise<FileAttachment[]>;
  getFileAttachment(id: number): Promise<FileAttachment | undefined>;
  createFileAttachment(data: InsertFileAttachment): Promise<FileAttachment>;
  deleteFileAttachment(id: number): Promise<void>;

  // Imports
  getImports(uploadedBy?: number): Promise<Import[]>;
  getImport(id: number): Promise<Import | undefined>;
  createImport(data: InsertImport): Promise<Import>;
  updateImport(id: number, data: Partial<InsertImport> & { completedAt?: Date | null }): Promise<Import | undefined>;
  deleteImport(id: number): Promise<void>;

  // Proposals
  getProposals(userId?: number, status?: string): Promise<WorkspaceProposal[]>;
  getProposal(id: number): Promise<WorkspaceProposal | undefined>;
  createProposal(data: InsertWorkspaceProposal): Promise<WorkspaceProposal>;
  updateProposal(id: number, data: Partial<WorkspaceProposal>): Promise<WorkspaceProposal | undefined>;

  // Feedback
  createFeedback(data: InsertFeedback): Promise<Feedback>;
  getFeedback(): Promise<Feedback[]>;

  // Incidents
  getIncidents(filters?: { status?: string; severity?: string; stationId?: number; stationIds?: number[]; assignedTo?: number }): Promise<Incident[]>;
  getIncident(id: number): Promise<Incident | undefined>;
  createIncident(data: InsertIncident): Promise<Incident>;
  updateIncident(id: number, data: Partial<Incident>): Promise<Incident | undefined>;
  getIncidentSummaries(incidentId: number): Promise<IncidentSummary[]>;
  createIncidentSummary(data: InsertIncidentSummary): Promise<IncidentSummary>;

  // Reservations
  getReservations(filters?: { vehicleId?: number; stationId?: number; stationIds?: number[]; status?: string }): Promise<Reservation[]>;
  getReservation(id: number): Promise<Reservation | undefined>;
  createReservation(data: InsertReservation): Promise<Reservation>;
  updateReservation(id: number, data: Partial<Reservation>): Promise<Reservation | undefined>;

  // Repair orders
  getRepairOrders(filters?: { vehicleId?: number; incidentId?: number; status?: string; stationId?: number; stationIds?: number[] }): Promise<RepairOrder[]>;
  getRepairOrder(id: number): Promise<RepairOrder | undefined>;
  createRepairOrder(data: InsertRepairOrder): Promise<RepairOrder>;
  updateRepairOrder(id: number, data: Partial<RepairOrder>): Promise<RepairOrder | undefined>;

  // Downtime events
  getDowntimeEvents(filters?: { vehicleId?: number; reason?: string; open?: boolean }): Promise<DowntimeEvent[]>;
  getDowntimeEvent(id: number): Promise<DowntimeEvent | undefined>;
  createDowntimeEvent(data: InsertDowntimeEvent): Promise<DowntimeEvent>;
  updateDowntimeEvent(id: number, data: Partial<DowntimeEvent>): Promise<DowntimeEvent | undefined>;

  // KPI engine
  getKpiDefinitions(category?: string): Promise<KpiDefinition[]>;
  getKpiDefinition(slug: string): Promise<KpiDefinition | undefined>;
  createKpiDefinition(data: InsertKpiDefinition): Promise<KpiDefinition>;
  updateKpiDefinition(id: number, data: Partial<InsertKpiDefinition>): Promise<KpiDefinition | undefined>;
  getKpiSnapshots(slug: string, from?: string, to?: string, stationId?: number): Promise<KpiSnapshot[]>;
  createKpiSnapshot(data: InsertKpiSnapshot): Promise<KpiSnapshot>;

  // Anomalies
  getAnomalies(filters?: { type?: string; status?: string; stationId?: number }): Promise<Anomaly[]>;
  getAnomaly(id: number): Promise<Anomaly | undefined>;
  createAnomaly(data: InsertAnomaly): Promise<Anomaly>;
  updateAnomaly(id: number, data: Partial<Anomaly>): Promise<Anomaly | undefined>;

  // Executive briefings
  getExecutiveBriefings(limit?: number): Promise<ExecutiveBriefing[]>;
  getExecutiveBriefing(id: number): Promise<ExecutiveBriefing | undefined>;
  createExecutiveBriefing(data: InsertExecutiveBriefing): Promise<ExecutiveBriefing>;

  // Integration connectors
  getIntegrationConnectors(type?: string): Promise<IntegrationConnector[]>;
  getIntegrationConnectorsUnscoped(type: string): Promise<IntegrationConnector[]>;
  getIntegrationConnector(id: number): Promise<IntegrationConnector | undefined>;
  createIntegrationConnector(data: InsertIntegrationConnector): Promise<IntegrationConnector>;
  updateIntegrationConnector(id: number, data: Partial<IntegrationConnector>): Promise<IntegrationConnector | undefined>;
  deleteIntegrationConnector(id: number): Promise<void>;

  // Sync jobs
  getSyncJobs(connectorId?: number, limit?: number): Promise<SyncJob[]>;
  getSyncJob(id: number): Promise<SyncJob | undefined>;
  createSyncJob(data: InsertSyncJob): Promise<SyncJob>;
  updateSyncJob(id: number, data: Partial<SyncJob>): Promise<SyncJob | undefined>;

  // Knowledge documents
  getKnowledgeDocuments(category?: string): Promise<KnowledgeDocument[]>;
  getKnowledgeDocument(id: number): Promise<KnowledgeDocument | undefined>;
  createKnowledgeDocument(data: InsertKnowledgeDocument): Promise<KnowledgeDocument>;
  updateKnowledgeDocument(id: number, data: Partial<KnowledgeDocument>): Promise<KnowledgeDocument | undefined>;
  deleteKnowledgeDocument(id: number): Promise<void>;
  searchKnowledgeDocuments(query: string): Promise<KnowledgeDocument[]>;

  // Export requests
  getExportRequests(filters?: { status?: string; requestedBy?: number; exportType?: string }): Promise<ExportRequest[]>;
  getExportRequest(id: number): Promise<ExportRequest | undefined>;
  createExportRequest(data: InsertExportRequest): Promise<ExportRequest>;
  updateExportRequest(id: number, data: Partial<ExportRequest>): Promise<ExportRequest | undefined>;
  getExpiredExportRequests(): Promise<ExportRequest[]>;
  getProcessableExportRequests(): Promise<ExportRequest[]>;

  // Workspace plans & entitlements
  getWorkspacePlan(workspaceId: string): Promise<WorkspacePlan | undefined>;
  upsertWorkspacePlan(data: InsertWorkspacePlan): Promise<WorkspacePlan>;
  getEntitlementOverrides(workspaceId: string): Promise<EntitlementOverride[]>;
  getEntitlementOverride(workspaceId: string, feature: string): Promise<EntitlementOverride | undefined>;
  upsertEntitlementOverride(data: InsertEntitlementOverride): Promise<EntitlementOverride>;
  deleteEntitlementOverride(workspaceId: string, feature: string): Promise<void>;

  // Workspace plans & entitlements
  getWorkspacePlan(workspaceId: string): Promise<WorkspacePlan | undefined>;
  upsertWorkspacePlan(data: InsertWorkspacePlan): Promise<WorkspacePlan>;
  getEntitlementOverrides(workspaceId: string): Promise<EntitlementOverride[]>;
  getEntitlementOverride(workspaceId: string, feature: string): Promise<EntitlementOverride | undefined>;
  upsertEntitlementOverride(data: InsertEntitlementOverride): Promise<EntitlementOverride>;
  deleteEntitlementOverride(workspaceId: string, feature: string): Promise<void>;

  // Usage metering
  recordUsageEvent(data: InsertUsageEvent): Promise<UsageEvent>;
  getUsageEvents(filters?: { workspaceId?: string; feature?: string; userId?: number; from?: Date; to?: Date; limit?: number }): Promise<UsageEvent[]>;
  incrementDailyRollup(workspaceId: string, feature: string, date: string, increment?: number): Promise<UsageDailyRollup>;
  getDailyRollups(filters?: { workspaceId?: string; feature?: string; from?: string; to?: string }): Promise<UsageDailyRollup[]>;
  getUsageTotal(workspaceId: string, feature: string, from?: string, to?: string): Promise<number>;

  // Capability permissions
  getRoleCapabilities(role: string): Promise<RoleCapability[]>;
  getAllRoleCapabilities(): Promise<RoleCapability[]>;
  upsertRoleCapability(data: InsertRoleCapability): Promise<RoleCapability>;
  deleteRoleCapability(role: string, capability: string): Promise<void>;
  getUserCapabilityOverrides(userId: number): Promise<UserCapabilityOverride[]>;
  upsertUserCapabilityOverride(data: InsertUserCapabilityOverride): Promise<UserCapabilityOverride>;
  deleteUserCapabilityOverride(userId: number, capability: string): Promise<void>;

  // Station assignments
  getUserStationAssignments(userId: number): Promise<UserStationAssignment[]>;
  getStationUsers(stationId: number): Promise<UserStationAssignment[]>;
  assignUserToStation(data: InsertUserStationAssignment): Promise<UserStationAssignment>;
  removeUserFromStation(userId: number, stationId: number): Promise<void>;
  setUserStations(userId: number, stationIds: number[], assignedBy?: number): Promise<UserStationAssignment[]>;
  resolveUserStationIds(userId: number): Promise<number[]>;

  // Vehicle events (Phase 4.2B)
  createVehicleEvent(data: InsertVehicleEvent): Promise<VehicleEvent>;
  createVehicleEventEx(data: InsertVehicleEvent): Promise<{ row: VehicleEvent; inserted: boolean }>;
  getVehicleEvents(filters?: { vehicleId?: number; eventType?: string; connectorId?: number; from?: Date; to?: Date; processed?: boolean; limit?: number }): Promise<VehicleEvent[]>;
  getVehicleEvent(id: number): Promise<VehicleEvent | undefined>;
  markVehicleEventProcessed(id: number, derivation?: { derivedAction?: string; derivedEntityType?: string; derivedEntityId?: string }): Promise<VehicleEvent | undefined>;
  countVehicleEvents(vehicleId: number, eventType?: string): Promise<number>;
  countVehicleEventsByType(vehicleId: number): Promise<Record<string, number>>;

  // Workshop jobs (Phase 4.2B)
  upsertWorkshopJob(data: InsertWorkshopJob): Promise<WorkshopJob>;
  getWorkshopJobs(filters?: { repairOrderId?: number; connectorId?: number; normalizedStatus?: string; limit?: number }): Promise<WorkshopJob[]>;
  getWorkshopJob(id: number): Promise<WorkshopJob | undefined>;
  updateWorkshopJob(id: number, data: Partial<WorkshopJob>): Promise<WorkshopJob | undefined>;
  linkWorkshopJobToRepairOrder(workshopJobId: number, repairOrderId: number): Promise<WorkshopJob | undefined>;

  // Station positions (Phase 5)
  getStationPositions(stationId?: number): Promise<StationPosition[]>;
  getStationPosition(id: number): Promise<StationPosition | undefined>;
  createStationPosition(data: InsertStationPosition): Promise<StationPosition>;
  updateStationPosition(id: number, data: Partial<InsertStationPosition>): Promise<StationPosition | undefined>;
  deleteStationPosition(id: number): Promise<void>;

  // Position assignments
  getPositionAssignments(positionId?: number): Promise<PositionAssignment[]>;
  getActiveAssignments(positionId: number): Promise<PositionAssignment[]>;
  getVehicleAssignment(vehicleId: number): Promise<PositionAssignment | undefined>;
  createPositionAssignment(data: InsertPositionAssignment): Promise<PositionAssignment>;
  releasePositionAssignment(id: number): Promise<PositionAssignment | undefined>;

  // Vehicle transfers
  getVehicleTransfers(filters?: { vehicleId?: number; fromStationId?: number; toStationId?: number; status?: string }): Promise<VehicleTransfer[]>;
  getVehicleTransfer(id: number): Promise<VehicleTransfer | undefined>;
  createVehicleTransfer(data: InsertVehicleTransfer): Promise<VehicleTransfer>;
  updateVehicleTransfer(id: number, data: Partial<InsertVehicleTransfer>): Promise<VehicleTransfer | undefined>;

  // Chat channels (Phase 5)
  getChatChannels(type?: string): Promise<ChatChannel[]>;
  getChatChannel(id: number): Promise<ChatChannel | undefined>;
  getChatChannelBySlug(slug: string): Promise<ChatChannel | undefined>;
  createChatChannel(data: InsertChatChannel): Promise<ChatChannel>;
  updateChatChannel(id: number, data: Partial<InsertChatChannel>): Promise<ChatChannel | undefined>;
  archiveChatChannel(id: number): Promise<ChatChannel | undefined>;

  // Channel members
  getChannelMembers(channelId: number): Promise<ChannelMember[]>;
  getUserChannels(userId: number): Promise<ChannelMember[]>;
  addChannelMember(data: InsertChannelMember): Promise<ChannelMember | undefined>;
  removeChannelMember(channelId: number, userId: number): Promise<void>;
  updateChannelMemberReadState(channelId: number, userId: number): Promise<ChannelMember | undefined>;

  // Channel messages
  getChannelMessages(channelId: number, limit?: number, before?: number): Promise<ChannelMessage[]>;
  getChannelMessage(id: number): Promise<ChannelMessage | undefined>;
  createChannelMessage(data: InsertChannelMessage): Promise<ChannelMessage>;
  updateChannelMessage(id: number, content: string): Promise<ChannelMessage | undefined>;
  togglePinMessage(id: number, pinned: boolean): Promise<ChannelMessage | undefined>;
  getPinnedMessages(channelId: number): Promise<ChannelMessage[]>;

  // Channel reactions
  getMessageReactions(messageId: number): Promise<ChannelReaction[]>;
  addReaction(data: InsertChannelReaction): Promise<ChannelReaction | undefined>;
  removeReaction(messageId: number, userId: number, emoji: string): Promise<void>;

  // App Graph (Phase 5)
  getAppGraphVersions(limit?: number): Promise<AppGraphVersion[]>;
  getAppGraphVersion(version: number): Promise<AppGraphVersion | undefined>;
  getLatestAppGraph(): Promise<AppGraphVersion | undefined>;
  createAppGraphVersion(data: InsertAppGraphVersion): Promise<AppGraphVersion>;
  applyAppGraphVersion(version: number): Promise<AppGraphVersion | undefined>;
  rollbackAppGraphVersion(version: number): Promise<AppGraphVersion | undefined>;

  // AI model usage (Phase 5)
  getAiModelUsage(filters?: { provider?: string; feature?: string; userId?: number; limit?: number }): Promise<AiModelUsage[]>;
  createAiModelUsage(data: InsertAiModelUsage): Promise<AiModelUsage>;

  // Installed extensions (Phase 5)
  getInstalledExtensions(enabledOnly?: boolean): Promise<InstalledExtension[]>;
  getInstalledExtension(id: number): Promise<InstalledExtension | undefined>;
  getInstalledExtensionBySlug(slug: string): Promise<InstalledExtension | undefined>;
  installExtension(data: InsertInstalledExtension): Promise<InstalledExtension>;
  updateExtension(id: number, data: Partial<InsertInstalledExtension>): Promise<InstalledExtension | undefined>;
  uninstallExtension(id: number): Promise<void>;

  // Analytics (cross-domain aggregate queries)
  getDashboardStats(): Promise<Record<string, unknown>>;
  getAnalyticsSummary(): Promise<Record<string, unknown>>;
  getAnalyticsTrends(days: number): Promise<{ date: string; washes: number; evidence: number; notifications: number }[]>;
  getVehicleTrends(vehicleId: number): Promise<{ totalWashes: number; totalEvidence: number; recentWashes: { date: string; count: number }[]; recentEvidence: { date: string; count: number }[]; topZones: { zone: string; count: number }[] }>;
  searchEntities(query: string): Promise<Array<{ type: string; id: number | string; label: string; description?: string }>>;

  // Invite tokens
  createInviteToken(data: InsertInviteToken): Promise<InviteToken>;
  getInviteTokenByToken(token: string): Promise<InviteToken | undefined>;
  markInviteTokenUsed(id: number, usedBy: number): Promise<InviteToken | undefined>;
  getInviteTokens(createdBy?: number): Promise<InviteToken[]>;
  deleteInviteToken(id: number): Promise<void>;

  // User tabs (Phase 6)
  getUserTabs(userId: number): Promise<UserTab[]>;
  getUserTab(id: number): Promise<UserTab | undefined>;
  createUserTab(data: InsertUserTab): Promise<UserTab>;
  updateUserTab(id: number, data: Partial<InsertUserTab>): Promise<UserTab | undefined>;
  deleteUserTab(id: number): Promise<void>;
  reorderUserTabs(userId: number, tabIds: number[]): Promise<void>;

  // Widget definitions (Phase 6)
  getWidgetDefinitions(category?: string): Promise<WidgetDefinition[]>;
  getWidgetDefinition(slug: string): Promise<WidgetDefinition | undefined>;
  createWidgetDefinition(data: InsertWidgetDefinition): Promise<WidgetDefinition>;
  updateWidgetDefinition(id: number, data: Partial<InsertWidgetDefinition>): Promise<WidgetDefinition | undefined>;

  // Tab widgets (Phase 6)
  getTabWidgets(tabId: number): Promise<TabWidget[]>;
  createTabWidget(data: InsertTabWidget): Promise<TabWidget>;
  updateTabWidget(id: number, data: Partial<InsertTabWidget>): Promise<TabWidget | undefined>;
  deleteTabWidget(id: number): Promise<void>;
  bulkUpdateTabWidgetLayout(tabId: number, layouts: Array<{ id: number; x: number; y: number; w: number; h: number }>): Promise<void>;

  // Idea comments (Phase 6)
  getIdeaComments(proposalId: number): Promise<IdeaComment[]>;
  createIdeaComment(data: InsertIdeaComment): Promise<IdeaComment>;
  updateIdeaComment(id: number, content: string): Promise<IdeaComment | undefined>;
  deleteIdeaComment(id: number): Promise<void>;

  // Idea attachments (Phase 6)
  getIdeaAttachments(proposalId: number): Promise<IdeaAttachment[]>;
  createIdeaAttachment(data: InsertIdeaAttachment): Promise<IdeaAttachment>;
  deleteIdeaAttachment(id: number): Promise<void>;
}

// Re-export all schema types for convenience
export type {
  User, InsertUser,
  UserPreference, InsertUserPreference,
  ChatConversation, InsertConversation,
  ChatMessage, InsertMessage,
  Vehicle, InsertVehicle,
  VehicleEvidence, InsertVehicleEvidence,
  WashQueueItem, InsertWashQueue,
  Shift, InsertShift,
  ShiftRequest, InsertShiftRequest,
  Notification, InsertNotification,
  CustomAction, InsertCustomAction,
  Station, InsertStation,
  AutomationRule, InsertAutomationRule,
  AuditLog, InsertAuditLog,
  EntityRoom, InsertEntityRoom,
  RoomMessage, InsertRoomMessage,
  WorkspaceMemory, InsertWorkspaceMemory,
  DigitalTwinSnapshot, InsertDigitalTwinSnapshot,
  SystemPolicy, InsertSystemPolicy,
  ActivityFeedEntry, InsertActivityFeed,
  ModuleRegistryEntry, InsertModuleRegistry,
  WorkspaceConfigEntry, InsertWorkspaceConfig,
  FileAttachment, InsertFileAttachment,
  Import, InsertImport,
  WorkspaceProposal, InsertWorkspaceProposal,
  Feedback, InsertFeedback,
  Incident, InsertIncident,
  AutomationExecution, InsertAutomationExecution,
  Reservation, InsertReservation,
  RepairOrder, InsertRepairOrder,
  DowntimeEvent, InsertDowntimeEvent,
  KpiDefinition, InsertKpiDefinition,
  KpiSnapshot, InsertKpiSnapshot,
  Anomaly, InsertAnomaly,
  ExecutiveBriefing, InsertExecutiveBriefing,
  IntegrationConnector, InsertIntegrationConnector,
  SyncJob, InsertSyncJob,
  KnowledgeDocument, InsertKnowledgeDocument,
  IncidentSummary, InsertIncidentSummary,
  ExportRequest, InsertExportRequest,
  WorkspacePlan, InsertWorkspacePlan,
  EntitlementOverride, InsertEntitlementOverride,
  UsageEvent, InsertUsageEvent,
  UsageDailyRollup, InsertUsageDailyRollup,
  UserStationAssignment, InsertUserStationAssignment,
  RoleCapability, InsertRoleCapability,
  UserCapabilityOverride, InsertUserCapabilityOverride,
  VehicleEvent, InsertVehicleEvent,
  WorkshopJob, InsertWorkshopJob,
  StationPosition, InsertStationPosition,
  PositionAssignment, InsertPositionAssignment,
  VehicleTransfer, InsertVehicleTransfer,
  ChatChannel, InsertChatChannel,
  ChannelMember, InsertChannelMember,
  ChannelMessage, InsertChannelMessage,
  ChannelReaction, InsertChannelReaction,
  AppGraphVersion, InsertAppGraphVersion,
  AiModelUsage, InsertAiModelUsage,
  InstalledExtension, InsertInstalledExtension,
  InviteToken, InsertInviteToken,
  UserTab, InsertUserTab,
  WidgetDefinition, InsertWidgetDefinition,
  TabWidget, InsertTabWidget,
  IdeaComment, InsertIdeaComment,
  IdeaAttachment, InsertIdeaAttachment,
};
