/**
 * Workflow Definitions — Declarative multi-step workflow specs.
 * Each workflow is a series of steps the AI can drive through the chat.
 */
import { registerWorkflow } from "./engine.js";
import { storage } from "../../storage.js";
import type { UIBlock } from "../tools/types.js";

// ─── Vehicle Onboard ─────────────────────────────────────────────

registerWorkflow({
  id: "vehicle_onboard",
  name: "Vehicle Onboard",
  description: "Register a new vehicle in the fleet: collect plate, model, category, station, then create it.",
  requiredRole: "coordinator",
  steps: [
    {
      id: "collect_info",
      title: "Vehicle Information",
      description: "Provide the vehicle's plate number, model, category, and station.",
      uiBlock: (_collected, _ctx) => ({
        type: "form",
        formId: "vehicle_onboard_info",
        title: "New Vehicle Details",
        submitLabel: "Next",
        submitTool: "workflow_advance",
        submitParams: { workflowId: "vehicle_onboard" },
        fields: [
          { name: "plate", label: "Plate Number", type: "text" as const, required: true, placeholder: "e.g. ABC-1234" },
          { name: "model", label: "Model", type: "text" as const, required: true, placeholder: "e.g. Toyota Corolla" },
          { name: "category", label: "Category", type: "select" as const, options: [{ label: "A", value: "A" }, { label: "B", value: "B" }, { label: "C", value: "C" }, { label: "D", value: "D" }, { label: "SUV", value: "SUV" }, { label: "Van", value: "Van" }], required: true },
          { name: "sla", label: "SLA Level", type: "select" as const, options: [{ label: "Low", value: "low" }, { label: "Normal", value: "normal" }, { label: "High", value: "high" }, { label: "Critical", value: "critical" }] },
        ],
      }) satisfies UIBlock,
      validate: async (collected) => {
        const plate = collected.plate as string;
        if (!plate || plate.length < 2) return "Plate number is required.";
        // Check uniqueness
        const existing = await storage.getVehicles();
        if (existing.some(v => v.plate.toLowerCase() === plate.toLowerCase())) {
          return `A vehicle with plate "${plate}" already exists.`;
        }
        return null;
      },
    },
    {
      id: "confirm",
      title: "Confirm & Create",
      description: "Review and confirm the new vehicle details.",
      uiBlock: (collected) => ({
        type: "confirmation",
        title: "Create Vehicle?",
        message: `Register ${collected.model} (${collected.plate}) as category ${collected.category || "B"}?`,
        confirmLabel: "Create Vehicle",
        cancelLabel: "Cancel",
        confirmTool: "workflow_advance",
        confirmParams: { workflowId: "vehicle_onboard", confirmed: true },
      } as UIBlock),
    },
    {
      id: "execute",
      title: "Vehicle Created",
      description: "Vehicle is registered in the fleet.",
      execute: async (collected, ctx) => {
        const vehicle = await storage.createVehicle({
          workspaceId: ctx.workspaceId,
          plate: collected.plate as string,
          model: collected.model as string,
          category: (collected.category as string) || "B",
          sla: (collected.sla as string) || "normal",
          status: "ready",
        });
        return {
          content: `Vehicle created: ${vehicle.plate} (${vehicle.model}), ID #${vehicle.id}`,
          data: vehicle,
          uiBlock: {
            type: "entity_card",
            entityType: "vehicle",
            entityId: vehicle.id,
            title: vehicle.plate,
            subtitle: vehicle.model,
            status: "ready",
            statusColor: "green",
            fields: [
              { label: "ID", value: vehicle.id },
              { label: "Category", value: vehicle.category },
              { label: "SLA", value: vehicle.sla },
              { label: "Status", value: vehicle.status },
            ],
          } satisfies UIBlock,
        };
      },
    },
  ],
});

// ─── Incident Report ─────────────────────────────────────────────

registerWorkflow({
  id: "incident_report",
  name: "Incident Report",
  description: "Report an incident: collect details, severity, linked entities, then create it.",
  steps: [
    {
      id: "collect_details",
      title: "Incident Details",
      description: "Describe the incident and set its severity.",
      uiBlock: () => ({
        type: "form",
        formId: "incident_report_details",
        title: "Report Incident",
        submitLabel: "Next",
        submitTool: "workflow_advance",
        submitParams: { workflowId: "incident_report" },
        fields: [
          { name: "title", label: "Title", type: "text" as const, required: true, placeholder: "Brief incident title" },
          { name: "description", label: "Description", type: "textarea" as const, required: true, placeholder: "What happened?" },
          { name: "severity", label: "Severity", type: "select" as const, options: [{ label: "Low", value: "low" }, { label: "Medium", value: "medium" }, { label: "High", value: "high" }, { label: "Critical", value: "critical" }], required: true },
          { name: "category", label: "Category", type: "select" as const, options: [{ label: "General", value: "general" }, { label: "Vehicle Damage", value: "vehicle_damage" }, { label: "Customer Complaint", value: "customer_complaint" }, { label: "Equipment Failure", value: "equipment_failure" }, { label: "Safety", value: "safety" }, { label: "SLA Breach", value: "sla_breach" }] },
        ],
      }) satisfies UIBlock,
      validate: async (collected) => {
        if (!collected.title || (collected.title as string).length < 3) {
          return "Please provide a meaningful incident title.";
        }
        return null;
      },
    },
    {
      id: "confirm_report",
      title: "Confirm Report",
      description: "Review and submit the incident report.",
      uiBlock: (collected) => ({
        type: "confirmation",
        title: "Submit Incident Report?",
        message: `"${collected.title}" — Severity: ${collected.severity || "medium"}\n${collected.description || ""}`,
        confirmLabel: "Submit Report",
        cancelLabel: "Cancel",
        confirmTool: "workflow_advance",
        confirmParams: { workflowId: "incident_report", confirmed: true },
      } as UIBlock),
    },
    {
      id: "execute",
      title: "Incident Filed",
      description: "Incident has been created and the team notified.",
      execute: async (collected, ctx) => {
        const incident = await storage.createIncident({
          workspaceId: ctx.workspaceId,
          title: collected.title as string,
          description: (collected.description as string) || undefined,
          severity: (collected.severity as string) || "medium",
          category: (collected.category as string) || "general",
          reportedBy: ctx.userId,
          status: "open",
        });
        return {
          content: `Incident #${incident.id} filed: "${incident.title}" (${incident.severity})`,
          data: incident,
          uiBlock: {
            type: "alert",
            severity: "success",
            title: "Incident Reported",
            message: `Incident #${incident.id} "${incident.title}" has been created with severity ${incident.severity}.`,
          } as UIBlock,
        };
      },
    },
  ],
});

// ─── Reservation Create ──────────────────────────────────────────

registerWorkflow({
  id: "reservation_create",
  name: "Create Reservation",
  description: "Book a vehicle for a customer: pick vehicle, dates, customer info, then confirm.",
  requiredRole: "agent",
  steps: [
    {
      id: "collect_booking",
      title: "Booking Details",
      description: "Enter customer name, vehicle, and pickup/return dates.",
      uiBlock: () => ({
        type: "form",
        formId: "reservation_create_booking",
        title: "New Reservation",
        submitLabel: "Next",
        submitTool: "workflow_advance",
        submitParams: { workflowId: "reservation_create" },
        fields: [
          { name: "customerName", label: "Customer Name", type: "text" as const, required: true },
          { name: "customerEmail", label: "Customer Email", type: "text" as const },
          { name: "customerPhone", label: "Customer Phone", type: "text" as const },
          { name: "vehicleId", label: "Vehicle ID", type: "number" as const, required: true, placeholder: "Vehicle ID number" },
          { name: "pickupDate", label: "Pickup Date", type: "date" as const, required: true },
          { name: "returnDate", label: "Return Date", type: "date" as const, required: true },
          { name: "notes", label: "Notes", type: "textarea" as const },
        ],
      }) satisfies UIBlock,
      validate: async (collected) => {
        if (!collected.customerName) return "Customer name is required.";
        if (!collected.vehicleId) return "Vehicle ID is required.";
        if (!collected.pickupDate || !collected.returnDate) return "Both pickup and return dates are required.";
        const pickup = new Date(collected.pickupDate as string);
        const ret = new Date(collected.returnDate as string);
        if (ret <= pickup) return "Return date must be after pickup date.";
        // Verify vehicle exists
        const vehicle = await storage.getVehicle(Number(collected.vehicleId));
        if (!vehicle) return `Vehicle #${collected.vehicleId} not found.`;
        return null;
      },
    },
    {
      id: "confirm_booking",
      title: "Confirm Booking",
      description: "Review and confirm the reservation.",
      uiBlock: (collected) => ({
        type: "confirmation",
        title: "Create Reservation?",
        message: `Vehicle #${collected.vehicleId} for ${collected.customerName}\nPickup: ${collected.pickupDate}\nReturn: ${collected.returnDate}`,
        confirmLabel: "Confirm Booking",
        cancelLabel: "Cancel",
        confirmTool: "workflow_advance",
        confirmParams: { workflowId: "reservation_create", confirmed: true },
      } as UIBlock),
    },
    {
      id: "execute",
      title: "Reservation Confirmed",
      description: "Reservation has been created.",
      execute: async (collected, ctx) => {
        const reservation = await storage.createReservation({
          workspaceId: ctx.workspaceId,
          vehicleId: Number(collected.vehicleId),
          customerName: collected.customerName as string,
          customerEmail: (collected.customerEmail as string) || undefined,
          customerPhone: (collected.customerPhone as string) || undefined,
          pickupDate: new Date(collected.pickupDate as string),
          returnDate: new Date(collected.returnDate as string),
          notes: (collected.notes as string) || undefined,
          status: "confirmed",
          source: "manual",
        });
        return {
          content: `Reservation #${reservation.id} created for ${reservation.customerName}`,
          data: reservation,
          uiBlock: {
            type: "alert",
            severity: "success",
            title: "Reservation Created",
            message: `Reservation #${reservation.id} for vehicle #${collected.vehicleId}, ${collected.pickupDate} → ${collected.returnDate}`,
          } as UIBlock,
        };
      },
    },
  ],
});
