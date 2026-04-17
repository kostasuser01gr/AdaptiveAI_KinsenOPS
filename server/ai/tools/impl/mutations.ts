/**
 * Mutation Tools — Write operations for wash queue, shifts, incidents, reservations, repairs, downtime.
 * These give the AI the ability to CREATE, UPDATE, and DELETE across core operational domains.
 */
import { z } from "zod/v4";
import { toolRegistry } from "../registry.js";
import { storage } from "../../../storage.js";
import type { ToolResult, ToolContext } from "../types.js";
import { getWorkspaceScope } from "../../../middleware/workspaceContext.js";

// ─── Wash Queue: Create ───
toolRegistry.register({
  name: "create_wash_item",
  description: "Add a vehicle to the wash queue. Use when the user asks to schedule a wash, queue a vehicle for washing, or add a wash job.",
  inputSchema: z.object({
    vehicleId: z.number().describe("Vehicle ID to queue for washing"),
    washType: z.string().optional().describe("Wash type: standard, premium, express"),
    priority: z.string().optional().describe("Priority: Low, Medium, High, Urgent"),
    notes: z.string().optional().describe("Additional notes"),
  }),
  requiredRole: "agent",
  async handler(input, ctx): Promise<ToolResult> {
    const vehicle = await storage.getVehicle(input.vehicleId as number);
    if (!vehicle) return { content: "Vehicle not found.", isError: true };
    const item = await storage.createWashQueueItem({
      workspaceId: ctx.workspaceId,
      vehiclePlate: vehicle.plate,
      washType: (input.washType as string) || "standard",
      priority: (input.priority as string) || "Medium",
      status: "pending",
    });
    return {
      content: `Added ${vehicle.plate} to wash queue (${item.washType}, priority: ${item.priority}).`,
      uiBlock: { type: "alert", severity: "success", title: "Wash Queued", message: `${vehicle.plate} added to wash queue as ${item.priority} priority.` },
    };
  },
});

// ─── Wash Queue: Update ───
toolRegistry.register({
  name: "update_wash_item",
  description: "Update a wash queue item — change priority, status, reassign, or add notes.",
  inputSchema: z.object({
    washId: z.number().describe("Wash queue item ID"),
    status: z.string().optional().describe("New status: pending, in_progress, completed, cancelled"),
    priority: z.string().optional().describe("New priority: Low, Medium, High, Urgent"),
    washType: z.string().optional().describe("New wash type"),
    notes: z.string().optional().describe("Updated notes"),
  }),
  requiredRole: "agent",
  async handler(input): Promise<ToolResult> {
    const updates: Record<string, unknown> = {};
    if (input.status) updates.status = input.status;
    if (input.priority) updates.priority = input.priority;
    if (input.washType) updates.washType = input.washType;
    if (input.notes) updates.notes = input.notes;
    const item = await storage.updateWashQueueItem(input.washId as number, updates);
    if (!item) return { content: "Wash item not found.", isError: true };
    return {
      content: `Wash item #${item.id} updated: ${Object.entries(updates).map(([k, v]) => `${k}=${v}`).join(', ')}.`,
      uiBlock: { type: "alert", severity: "success", title: "Wash Updated", message: `Wash #${item.id} updated successfully.` },
    };
  },
});

// ─── Shift: Create ───
toolRegistry.register({
  name: "create_shift",
  description: "Create a new shift for an employee. Use when scheduling staff, adding shift coverage, or assigning work periods.",
  inputSchema: z.object({
    employeeName: z.string().describe("Name of the employee"),
    employeeRole: z.string().describe("Role: washer, agent, coordinator, supervisor"),
    weekStart: z.string().describe("Week start date (ISO format, e.g. 2026-04-13)"),
    schedule: z.string().optional().describe("JSON schedule object or descriptive text"),
  }),
  requiredRole: "coordinator",
  async handler(input, ctx): Promise<ToolResult> {
    const scheduleData = input.schedule ? JSON.parse(input.schedule as string) : ["off", "off", "off", "off", "off", "off", "off"];
    const shift = await storage.createShift({
      workspaceId: ctx.workspaceId,
      employeeName: input.employeeName as string,
      employeeRole: input.employeeRole as string,
      weekStart: input.weekStart as string,
      schedule: Array.isArray(scheduleData) ? scheduleData : ["off", "off", "off", "off", "off", "off", "off"],
      status: "draft",
    });
    return {
      content: `Shift created for ${shift.employeeName} (${shift.employeeRole}), week of ${shift.weekStart}. Status: draft.`,
      uiBlock: { type: "alert", severity: "success", title: "Shift Created", message: `Shift for ${shift.employeeName} created as draft. Publish when ready.` },
    };
  },
});

// ─── Shift: Update ───
toolRegistry.register({
  name: "update_shift",
  description: "Update an existing shift — change schedule, status, or employee assignment.",
  inputSchema: z.object({
    shiftId: z.number().describe("Shift ID"),
    employeeName: z.string().optional(),
    employeeRole: z.string().optional(),
    status: z.string().optional().describe("draft, published, cancelled"),
  }),
  requiredRole: "coordinator",
  async handler(input): Promise<ToolResult> {
    const updates: Record<string, unknown> = {};
    if (input.employeeName) updates.employeeName = input.employeeName;
    if (input.employeeRole) updates.employeeRole = input.employeeRole;
    if (input.status) updates.status = input.status;
    const shift = await storage.updateShift(input.shiftId as number, updates);
    if (!shift) return { content: "Shift not found.", isError: true };
    return { content: `Shift #${shift.id} for ${shift.employeeName} updated.` };
  },
});

// ─── Shift: Publish ───
toolRegistry.register({
  name: "publish_shift",
  description: "Publish a draft shift, making it visible to the assigned employee.",
  inputSchema: z.object({
    shiftId: z.number().describe("Shift ID to publish"),
  }),
  requiredRole: "coordinator",
  async handler(input, ctx): Promise<ToolResult> {
    const shift = await storage.publishShift(input.shiftId as number, ctx.userId);
    if (!shift) return { content: "Shift not found.", isError: true };
    return {
      content: `Shift #${shift.id} for ${shift.employeeName} published.`,
      uiBlock: { type: "alert", severity: "success", title: "Shift Published", message: `${shift.employeeName}'s shift is now live.` },
    };
  },
});

// ─── Shift Request: Review ───
toolRegistry.register({
  name: "review_shift_request",
  description: "Approve or deny a shift swap/change request from an employee.",
  inputSchema: z.object({
    requestId: z.number().describe("Shift request ID"),
    decision: z.enum(["approved", "denied"]).describe("Approve or deny"),
    note: z.string().optional().describe("Optional note to the requester"),
  }),
  requiredRole: "coordinator",
  async handler(input, ctx): Promise<ToolResult> {
    const req = await storage.reviewShiftRequest(input.requestId as number, ctx.userId, input.decision as string, input.note as string | undefined);
    if (!req) return { content: "Shift request not found.", isError: true };
    return {
      content: `Shift request #${req.id} ${input.decision}.${input.note ? ` Note: "${input.note}"` : ""}`,
      uiBlock: { type: "alert", severity: input.decision === "approved" ? "success" : "info", title: `Request ${input.decision === "approved" ? "Approved" : "Denied"}`, message: `Shift request #${req.id} has been ${input.decision}.` },
    };
  },
});

// ─── Incident: Create ───
toolRegistry.register({
  name: "create_incident",
  description: "Create a new incident report. Use when problems, damages, complaints, or safety issues need to be documented.",
  inputSchema: z.object({
    title: z.string().describe("Brief incident title"),
    description: z.string().optional().describe("Detailed description of what happened"),
    severity: z.enum(["low", "medium", "high", "critical"]).describe("Severity level"),
    category: z.string().optional().describe("Category: general, vehicle_damage, customer_complaint, equipment_failure, safety, sla_breach"),
    assignedTo: z.number().optional().describe("User ID to assign the incident to"),
  }),
  async handler(input, ctx): Promise<ToolResult> {
    const incident = await storage.createIncident({
      workspaceId: ctx.workspaceId,
      title: input.title as string,
      description: input.description as string | undefined,
      severity: input.severity as string,
      category: (input.category as string) || "general",
      reportedBy: ctx.userId,
      assignedTo: input.assignedTo as number | undefined,
      status: "open",
    });
    return {
      content: `Incident #${incident.id} created: "${(incident as any).title}" (${(incident as any).severity}).`,
      uiBlock: { type: "alert", severity: "success", title: "Incident Filed", message: `Incident #${incident.id} created with ${(incident as any).severity} severity.` },
    };
  },
});

// ─── Incident: Update ───
toolRegistry.register({
  name: "update_incident",
  description: "Update an incident — change status, severity, assignment, or add notes. Use for escalation, resolution, or reassignment.",
  inputSchema: z.object({
    incidentId: z.number().describe("Incident ID"),
    status: z.string().optional().describe("open, investigating, resolved, closed"),
    severity: z.string().optional().describe("low, medium, high, critical"),
    assignedTo: z.number().optional().describe("Reassign to user ID"),
    resolution: z.string().optional().describe("Resolution notes when closing"),
  }),
  requiredCapability: "incident_resolve",
  async handler(input): Promise<ToolResult> {
    const updates: Record<string, unknown> = {};
    if (input.status) updates.status = input.status;
    if (input.severity) updates.severity = input.severity;
    if (input.assignedTo) updates.assignedTo = input.assignedTo;
    if (input.resolution) updates.resolution = input.resolution;
    const incident = await storage.updateIncident(input.incidentId as number, updates);
    if (!incident) return { content: "Incident not found.", isError: true };
    return {
      content: `Incident #${incident.id} updated: ${Object.entries(updates).map(([k, v]) => `${k}=${v}`).join(', ')}.`,
      uiBlock: { type: "alert", severity: "success", title: "Incident Updated", message: `Incident #${incident.id} updated successfully.` },
    };
  },
});

// ─── Reservation: Create ───
toolRegistry.register({
  name: "create_reservation",
  description: "Create a vehicle reservation for a customer. Use when booking vehicles, scheduling pickups, or managing rentals.",
  inputSchema: z.object({
    vehicleId: z.number().describe("Vehicle ID to reserve"),
    customerName: z.string().describe("Customer full name"),
    customerEmail: z.string().optional(),
    customerPhone: z.string().optional(),
    pickupDate: z.string().describe("Pickup date (ISO format)"),
    returnDate: z.string().describe("Return date (ISO format)"),
    notes: z.string().optional(),
  }),
  requiredRole: "agent",
  async handler(input, ctx): Promise<ToolResult> {
    const vehicle = await storage.getVehicle(input.vehicleId as number);
    if (!vehicle) return { content: "Vehicle not found.", isError: true };
    const reservation = await storage.createReservation({
      workspaceId: ctx.workspaceId,
      vehicleId: input.vehicleId as number,
      customerName: input.customerName as string,
      customerEmail: input.customerEmail as string | undefined,
      customerPhone: input.customerPhone as string | undefined,
      pickupDate: new Date(input.pickupDate as string),
      returnDate: new Date(input.returnDate as string),
      status: "confirmed",
      notes: input.notes as string | undefined,
    });
    return {
      content: `Reservation #${reservation.id} created for ${(reservation as any).customerName}: ${vehicle.plate} from ${input.pickupDate} to ${input.returnDate}.`,
      uiBlock: {
        type: "entity_card", entityType: "reservation", entityId: reservation.id,
        title: `Reservation #${reservation.id}`, subtitle: `${vehicle.plate} — ${(reservation as any).customerName}`,
        status: "confirmed", statusColor: "green",
        fields: [
          { label: "Vehicle", value: vehicle.plate },
          { label: "Customer", value: input.customerName as string },
          { label: "Pickup", value: input.pickupDate as string },
          { label: "Return", value: input.returnDate as string },
        ],
      },
    };
  },
});

// ─── Reservation: Update ───
toolRegistry.register({
  name: "update_reservation",
  description: "Update an existing reservation — change dates, status, or notes.",
  inputSchema: z.object({
    reservationId: z.number().describe("Reservation ID"),
    status: z.string().optional().describe("confirmed, picked_up, returned, cancelled, no_show"),
    pickupDate: z.string().optional(),
    returnDate: z.string().optional(),
    notes: z.string().optional(),
  }),
  requiredRole: "agent",
  async handler(input): Promise<ToolResult> {
    const updates: Record<string, unknown> = {};
    if (input.status) updates.status = input.status;
    if (input.pickupDate) updates.pickupDate = new Date(input.pickupDate as string);
    if (input.returnDate) updates.returnDate = new Date(input.returnDate as string);
    if (input.notes) updates.notes = input.notes;
    const res = await storage.updateReservation(input.reservationId as number, updates);
    if (!res) return { content: "Reservation not found.", isError: true };
    return {
      content: `Reservation #${res.id} updated: ${Object.entries(updates).map(([k, v]) => `${k}=${v}`).join(', ')}.`,
    };
  },
});

// ─── Repair Order: Create ───
toolRegistry.register({
  name: "create_repair_order",
  description: "Create a repair order for a vehicle. Use when scheduling maintenance, documenting damage repairs, or ordering fixes.",
  inputSchema: z.object({
    vehicleId: z.number().describe("Vehicle ID"),
    description: z.string().describe("What needs to be repaired"),
    priority: z.string().optional().describe("low, normal, high, urgent"),
    incidentId: z.number().optional().describe("Link to originating incident"),
  }),
  requiredRole: "coordinator",
  async handler(input, ctx): Promise<ToolResult> {
    const vehicle = await storage.getVehicle(input.vehicleId as number);
    if (!vehicle) return { content: "Vehicle not found.", isError: true };
    const order = await storage.createRepairOrder({
      workspaceId: ctx.workspaceId,
      vehicleId: input.vehicleId as number,
      title: `Repair: ${(input.description as string).slice(0, 80)}`,
      description: input.description as string,
      priority: (input.priority as string) || "normal",
      incidentId: input.incidentId as number | undefined,
      status: "open",
    });
    return {
      content: `Repair order #${order.id} created for ${vehicle.plate}: "${input.description}".`,
      uiBlock: { type: "alert", severity: "success", title: "Repair Ordered", message: `Repair #${order.id} for ${vehicle.plate} opened.` },
    };
  },
});

// ─── Repair Order: Update ───
toolRegistry.register({
  name: "update_repair_order",
  description: "Update a repair order — change status, priority, or add notes. Use for tracking repair progress.",
  inputSchema: z.object({
    repairId: z.number().describe("Repair order ID"),
    status: z.string().optional().describe("open, in_progress, parts_ordered, completed, cancelled"),
    priority: z.string().optional(),
    notes: z.string().optional(),
  }),
  requiredRole: "coordinator",
  async handler(input): Promise<ToolResult> {
    const updates: Record<string, unknown> = {};
    if (input.status) updates.status = input.status;
    if (input.priority) updates.priority = input.priority;
    if (input.notes) updates.notes = input.notes;
    const order = await storage.updateRepairOrder(input.repairId as number, updates);
    if (!order) return { content: "Repair order not found.", isError: true };
    return { content: `Repair #${order.id} updated: ${Object.entries(updates).map(([k, v]) => `${k}=${v}`).join(', ')}.` };
  },
});

// ─── Repair Orders: List ───
toolRegistry.register({
  name: "list_repair_orders",
  description: "List repair orders, optionally filtered by vehicle, status, or incident.",
  inputSchema: z.object({
    vehicleId: z.number().optional(),
    status: z.string().optional(),
    incidentId: z.number().optional(),
  }),
  async handler(input): Promise<ToolResult> {
    const orders = await storage.getRepairOrders({
      vehicleId: input.vehicleId as number | undefined,
      status: input.status as string | undefined,
      incidentId: input.incidentId as number | undefined,
    });
    return {
      content: `Found ${orders.length} repair order(s).`,
      data: orders,
      uiBlock: {
        type: "data_table", title: "Repair Orders",
        columns: [
          { key: "id", label: "ID" },
          { key: "vehicleId", label: "Vehicle" },
          { key: "description", label: "Description" },
          { key: "priority", label: "Priority" },
          { key: "status", label: "Status" },
        ],
        rows: orders.slice(0, 20).map(o => ({
          id: o.id,
          vehicleId: (o as any).vehicleId ?? "—",
          description: ((o as any).description ?? "").slice(0, 60),
          priority: (o as any).priority ?? "—",
          status: (o as any).status ?? "—",
        })),
      },
    };
  },
});

// ─── Downtime: Create ───
toolRegistry.register({
  name: "create_downtime",
  description: "Record a vehicle downtime event. Use when a vehicle goes out of service, needs maintenance, or is unavailable.",
  inputSchema: z.object({
    vehicleId: z.number().describe("Vehicle ID"),
    reason: z.string().describe("Reason for downtime: maintenance, damage, recall, cleaning, other"),
    notes: z.string().optional(),
  }),
  requiredRole: "coordinator",
  async handler(input, ctx): Promise<ToolResult> {
    const vehicle = await storage.getVehicle(input.vehicleId as number);
    if (!vehicle) return { content: "Vehicle not found.", isError: true };
    const event = await storage.createDowntimeEvent({
      workspaceId: ctx.workspaceId,
      vehicleId: input.vehicleId as number,
      reason: input.reason as string,
      notes: input.notes as string | undefined,
      startedAt: new Date(),
    });
    return {
      content: `Downtime recorded for ${vehicle.plate}: ${input.reason}.`,
      uiBlock: { type: "alert", severity: "info", title: "Downtime Started", message: `${vehicle.plate} is now offline: ${input.reason}.` },
    };
  },
});

// ─── Downtime: Close ───
toolRegistry.register({
  name: "close_downtime",
  description: "Close/end a vehicle downtime event, returning the vehicle to service.",
  inputSchema: z.object({
    downtimeId: z.number().describe("Downtime event ID"),
    notes: z.string().optional(),
  }),
  requiredRole: "coordinator",
  async handler(input): Promise<ToolResult> {
    const event = await storage.updateDowntimeEvent(input.downtimeId as number, {
      endedAt: new Date(),
      notes: input.notes as string | undefined,
    });
    if (!event) return { content: "Downtime event not found.", isError: true };
    return {
      content: `Downtime #${event.id} closed. Vehicle back in service.`,
      uiBlock: { type: "alert", severity: "success", title: "Back Online", message: `Downtime #${event.id} ended.` },
    };
  },
});

// ─── List Downtime ───
toolRegistry.register({
  name: "list_downtime",
  description: "List vehicle downtime events. Filter by vehicle or show only currently-open events.",
  inputSchema: z.object({
    vehicleId: z.number().optional(),
    open: z.boolean().optional().describe("Only show currently active downtime"),
  }),
  async handler(input): Promise<ToolResult> {
    const events = await storage.getDowntimeEvents({
      vehicleId: input.vehicleId as number | undefined,
      open: input.open as boolean | undefined,
    });
    return {
      content: `Found ${events.length} downtime event(s).`,
      data: events,
      uiBlock: {
        type: "data_table", title: "Downtime Events",
        columns: [
          { key: "id", label: "ID" },
          { key: "vehicleId", label: "Vehicle" },
          { key: "reason", label: "Reason" },
          { key: "startedAt", label: "Started" },
          { key: "endedAt", label: "Ended" },
        ],
        rows: events.slice(0, 20).map(e => ({
          id: e.id,
          vehicleId: (e as any).vehicleId ?? "—",
          reason: (e as any).reason ?? "—",
          startedAt: e.startedAt ? new Date(e.startedAt as unknown as string).toLocaleString() : "—",
          endedAt: (e as any).endedAt ? new Date((e as any).endedAt).toLocaleString() : "Active",
        })),
      },
    };
  },
});

// ─── List Reservations ───
toolRegistry.register({
  name: "list_reservations",
  description: "List reservations, optionally filtered by vehicle, status, or station.",
  inputSchema: z.object({
    vehicleId: z.number().optional(),
    status: z.string().optional().describe("confirmed, picked_up, returned, cancelled, no_show"),
  }),
  async handler(input): Promise<ToolResult> {
    const reservations = await storage.getReservations({
      vehicleId: input.vehicleId as number | undefined,
      status: input.status as string | undefined,
    });
    return {
      content: `Found ${reservations.length} reservation(s).`,
      data: reservations,
      uiBlock: {
        type: "data_table", title: "Reservations",
        columns: [
          { key: "id", label: "ID" },
          { key: "customerName", label: "Customer" },
          { key: "vehicleId", label: "Vehicle" },
          { key: "pickupDate", label: "Pickup" },
          { key: "returnDate", label: "Return" },
          { key: "status", label: "Status" },
        ],
        rows: reservations.slice(0, 20).map(r => ({
          id: r.id,
          customerName: (r as any).customerName ?? "—",
          vehicleId: (r as any).vehicleId ?? "—",
          pickupDate: (r as any).pickupDate ?? "—",
          returnDate: (r as any).returnDate ?? "—",
          status: (r as any).status ?? "—",
        })),
      },
    };
  },
});

// ─── Shift Requests: List ───
toolRegistry.register({
  name: "list_shift_requests",
  description: "List pending shift requests (swap/change/time-off). Use when reviewing or managing shift requests.",
  inputSchema: z.object({}),
  requiredRole: "coordinator",
  async handler(_input): Promise<ToolResult> {
    const requests = await storage.getShiftRequests();
    const pending = requests.filter(r => (r as any).status === "pending");
    return {
      content: `${pending.length} pending shift request(s) out of ${requests.length} total.`,
      data: requests,
      uiBlock: {
        type: "data_table", title: "Shift Requests",
        columns: [
          { key: "id", label: "ID" },
          { key: "userId", label: "User" },
          { key: "type", label: "Type" },
          { key: "status", label: "Status" },
          { key: "createdAt", label: "Submitted" },
        ],
        rows: requests.slice(0, 20).map(r => ({
          id: r.id,
          userId: (r as any).userId ?? "—",
          type: (r as any).type ?? "—",
          status: (r as any).status ?? "—",
          createdAt: r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—",
        })),
      },
    };
  },
});

// ─── Create Notification ───
toolRegistry.register({
  name: "send_notification",
  description: "Send a notification to a user or broadcast to all users. Use when the AI needs to alert, inform, or notify team members.",
  inputSchema: z.object({
    title: z.string().describe("Notification title"),
    message: z.string().describe("Notification message body"),
    type: z.string().optional().describe("info, warning, alert, success"),
    targetUserId: z.number().optional().describe("Specific user ID to notify (omit for broadcast)"),
  }),
  requiredRole: "coordinator",
  async handler(input, ctx): Promise<ToolResult> {
    const notif = await storage.createNotification({
      workspaceId: ctx.workspaceId,
      title: input.title as string,
      body: input.message as string,
      type: (input.type as string) || "info",
      recipientUserId: input.targetUserId as number | undefined,
      audience: input.targetUserId ? "user" : "broadcast",
    });
    return {
      content: `Notification sent: "${input.title}"${input.targetUserId ? ` to user #${input.targetUserId}` : " (broadcast)"}.`,
      uiBlock: { type: "alert", severity: "success", title: "Notification Sent", message: `"${input.title}" delivered.` },
    };
  },
});
