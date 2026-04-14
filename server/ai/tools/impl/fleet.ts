/**
 * Fleet & Vehicle Tools — Query vehicles, fleet status, vehicle details.
 */
import { z } from "zod/v4";
import { toolRegistry } from "../registry.js";
import { storage } from "../../../storage.js";
import type { ToolResult } from "../types.js";

// ─── List Vehicles ───
toolRegistry.register({
  name: "list_vehicles",
  description: "List all vehicles in the fleet. Returns plate, model, category, status, and station for each vehicle. Use when the user asks about fleet overview, vehicle count, or specific vehicles.",
  inputSchema: z.object({
    status: z.string().optional().describe("Filter by status: ready, washing, maintenance, out_of_service"),
    limit: z.number().optional().describe("Max results to return (default 20)"),
  }),
  async handler(input, _ctx): Promise<ToolResult> {
    const vehicles = await storage.getVehicles();
    let filtered = vehicles;
    if (input.status) {
      filtered = filtered.filter((v) => v.status === input.status);
    }
    const limited = filtered.slice(0, (input.limit as number) || 20);

    return {
      content: `Found ${filtered.length} vehicle(s)${input.status ? ` with status "${input.status}"` : ""}. Showing ${limited.length}.`,
      data: limited,
      uiBlock: {
        type: "data_table",
        title: `Fleet Vehicles${input.status ? ` (${input.status})` : ""}`,
        columns: [
          { key: "plate", label: "Plate" },
          { key: "model", label: "Model" },
          { key: "category", label: "Category" },
          { key: "status", label: "Status" },
        ],
        rows: limited.map((v) => ({
          id: v.id,
          plate: v.plate,
          model: v.model,
          category: v.category,
          status: v.status,
        })),
        actions: [
          {
            label: "Details",
            toolName: "get_vehicle",
            params: {},
            variant: "outline",
          },
        ],
      },
    };
  },
});

// ─── Get Vehicle Details ───
toolRegistry.register({
  name: "get_vehicle",
  description: "Get detailed information about a specific vehicle by ID or plate number.",
  inputSchema: z.object({
    vehicleId: z.number().optional().describe("The vehicle ID"),
    plate: z.string().optional().describe("The vehicle plate number"),
  }),
  async handler(input, _ctx): Promise<ToolResult> {
    let vehicle;
    if (input.vehicleId) {
      vehicle = await storage.getVehicle(input.vehicleId as number);
    } else if (input.plate) {
      const all = await storage.getVehicles();
      vehicle = all.find((v) => v.plate.toLowerCase() === (input.plate as string).toLowerCase());
    }

    if (!vehicle) {
      return { content: "Vehicle not found.", isError: true };
    }

    return {
      content: `Vehicle ${vehicle.plate} (${vehicle.model}): status=${vehicle.status}, category=${vehicle.category}.`,
      data: vehicle,
      uiBlock: {
        type: "entity_card",
        entityType: "vehicle",
        entityId: vehicle.id,
        title: vehicle.plate,
        subtitle: vehicle.model,
        status: vehicle.status,
        statusColor: vehicle.status === "ready" ? "green" : vehicle.status === "maintenance" ? "yellow" : vehicle.status === "out_of_service" ? "red" : "blue",
        fields: [
          { label: "Category", value: vehicle.category },
          { label: "Status", value: vehicle.status },
          { label: "Station ID", value: vehicle.stationId ?? "Unassigned" },
        ],
      },
    };
  },
});

// ─── Update Vehicle Status ───
toolRegistry.register({
  name: "update_vehicle_status",
  description: "Update the status of a vehicle. Requires coordinator role or above. Use when the user wants to change a vehicle's operational status.",
  inputSchema: z.object({
    vehicleId: z.number().describe("The vehicle ID to update"),
    status: z.enum(["ready", "washing", "maintenance", "out_of_service"]).describe("New status"),
  }),
  requiredRole: "coordinator",
  async handler(input, _ctx): Promise<ToolResult> {
    const vehicle = await storage.getVehicle(input.vehicleId as number);
    if (!vehicle) {
      return { content: "Vehicle not found.", isError: true };
    }
    const updated = await storage.updateVehicle(input.vehicleId as number, {
      status: input.status as string,
    });
    return {
      content: `Updated vehicle ${updated.plate} status from "${vehicle.status}" to "${updated.status}".`,
      data: updated,
      uiBlock: {
        type: "alert",
        severity: "success",
        title: "Vehicle Updated",
        message: `${updated.plate} is now "${updated.status}".`,
      },
    };
  },
});

// ─── Fleet Summary ───
toolRegistry.register({
  name: "fleet_summary",
  description: "Get a summary of the entire fleet: total vehicles, counts by status, and readiness percentage. Use for dashboard or overview questions.",
  inputSchema: z.object({}),
  async handler(_input, _ctx): Promise<ToolResult> {
    const vehicles = await storage.getVehicles();
    const byStatus: Record<string, number> = {};
    for (const v of vehicles) {
      byStatus[v.status] = (byStatus[v.status] || 0) + 1;
    }
    const ready = byStatus["ready"] || 0;
    const readiness = vehicles.length > 0 ? Math.round((ready / vehicles.length) * 100) : 0;

    return {
      content: `Fleet: ${vehicles.length} vehicles total. ${ready} ready (${readiness}% readiness). Status breakdown: ${Object.entries(byStatus).map(([k, v]) => `${k}: ${v}`).join(", ")}.`,
      data: { total: vehicles.length, byStatus, readiness },
      uiBlock: {
        type: "metric_grid",
        metrics: [
          { label: "Total Vehicles", value: vehicles.length },
          { label: "Ready", value: ready, trend: "flat" },
          { label: "Readiness", value: `${readiness}%`, trend: readiness >= 80 ? "up" : "down" },
          ...Object.entries(byStatus)
            .filter(([k]) => k !== "ready")
            .map(([k, v]) => ({ label: k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " "), value: v })),
        ],
      },
    };
  },
});
