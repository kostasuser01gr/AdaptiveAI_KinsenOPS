/**
 * OpenAPI 3.0 spec for AdaptiveAI Platform API.
 * Hand-authored from route definitions — no zod-to-openapi needed (avoids Zod v3/v4 conflict).
 * Served at GET /api/openapi.json, rendered by Scalar at GET /api/docs.
 */

export function generateOpenApiDocument() {
  return {
    openapi: "3.0.3",
    info: {
      title: "AdaptiveAI Platform API",
      version: "1.0.0",
      description:
        "AI-powered operations platform for car rental fleet management. Covers fleet, wash operations, shifts, analytics, notifications, and AI chat.",
    },
    servers: [{ url: "/", description: "Current server" }],
    tags: [
      { name: "Fleet", description: "Vehicle fleet management" },
      { name: "Wash Operations", description: "Wash queue and washer management" },
      { name: "Shifts", description: "Staff shift scheduling" },
      { name: "Analytics", description: "Operational analytics and KPIs" },
      { name: "Notifications", description: "Alerts and notification management" },
      { name: "Search", description: "Global search" },
      { name: "Chat", description: "AI-powered chat and conversations" },
      { name: "System", description: "Health checks and operational endpoints" },
    ],
    paths: {
      "/api/vehicles": {
        get: {
          summary: "List all vehicles",
          tags: ["Fleet"],
          responses: {
            "200": {
              description: "Array of vehicles",
              content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Vehicle" } } } },
            },
          },
        },
        post: {
          summary: "Create a new vehicle",
          tags: ["Fleet"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["plate"],
                  properties: {
                    plate: { type: "string", description: "License plate number" },
                    make: { type: "string" },
                    model: { type: "string" },
                    year: { type: "integer" },
                    color: { type: "string" },
                    status: { type: "string", enum: ["ready", "rented", "washing", "maintenance", "returned"] },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "Created vehicle" } },
        },
      },
      "/api/vehicles/{id}": {
        patch: {
          summary: "Update a vehicle",
          tags: ["Fleet"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: {
            content: { "application/json": { schema: { $ref: "#/components/schemas/VehicleUpdate" } } },
          },
          responses: { "200": { description: "Updated vehicle" } },
        },
        delete: {
          summary: "Archive a vehicle",
          tags: ["Fleet"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Vehicle archived" } },
        },
      },
      "/api/wash-queue": {
        get: {
          summary: "List wash queue items",
          tags: ["Wash Operations"],
          responses: {
            "200": {
              description: "Array of wash queue items",
              content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/WashQueueItem" } } } },
            },
          },
        },
        post: {
          summary: "Add item to wash queue",
          tags: ["Wash Operations"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["vehiclePlate"],
                  properties: {
                    vehiclePlate: { type: "string" },
                    washType: { type: "string", enum: ["Quick Wash", "Full Detail", "Interior Only"] },
                    priority: { type: "string", enum: ["Normal", "Urgent"] },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "Created wash queue item" } },
        },
      },
      "/api/wash-queue/{id}": {
        patch: {
          summary: "Update wash queue item (assign, complete)",
          tags: ["Wash Operations"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", enum: ["pending", "in_progress", "completed"] },
                    assignedTo: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Updated wash queue item" } },
        },
      },
      "/api/wash-queue/washer-loads": {
        get: {
          summary: "Get active load per washer",
          tags: ["Wash Operations"],
          responses: {
            "200": {
              description: "Array of washer load data",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        washer: { type: "string" },
                        active: { type: "integer" },
                        lastSeenAt: { type: "string", nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/shifts": {
        get: {
          summary: "List shifts",
          tags: ["Shifts"],
          responses: { "200": { description: "Array of shifts" } },
        },
      },
      "/api/notifications": {
        get: {
          summary: "List notifications for current user",
          tags: ["Notifications"],
          responses: {
            "200": {
              description: "Array of notifications",
              content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Notification" } } } },
            },
          },
        },
      },
      "/api/notifications/{id}/read": {
        patch: {
          summary: "Mark notification as read",
          tags: ["Notifications"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Notification marked read" } },
        },
      },
      "/api/notifications/read-all": {
        post: {
          summary: "Mark all notifications as read",
          tags: ["Notifications"],
          responses: { "200": { description: "All notifications marked read" } },
        },
      },
      "/api/dashboard-stats": {
        get: {
          summary: "Get dashboard statistics",
          tags: ["Analytics"],
          responses: { "200": { description: "Dashboard stats: vehicles, washes, shifts, users, unread notifications" } },
        },
      },
      "/api/analytics/summary": {
        get: {
          summary: "Get analytics summary",
          tags: ["Analytics"],
          responses: { "200": { description: "Aggregated analytics with vehicle/wash/notification breakdowns" } },
        },
      },
      "/api/analytics/trends": {
        get: {
          summary: "Get trend data over time",
          tags: ["Analytics"],
          parameters: [
            { name: "days", in: "query", schema: { type: "integer", default: 30 }, description: "Number of days to look back" },
          ],
          responses: { "200": { description: "Array of daily trend data points (washes, evidence, notifications)" } },
        },
      },
      "/api/search": {
        get: {
          summary: "Global search across vehicles, users, stations",
          tags: ["Search"],
          parameters: [
            { name: "q", in: "query", required: true, schema: { type: "string" }, description: "Search query" },
          ],
          responses: { "200": { description: "Search results with type, label, and description" } },
        },
      },
      "/api/conversations": {
        get: {
          summary: "List AI chat conversations",
          tags: ["Chat"],
          responses: { "200": { description: "Array of conversations" } },
        },
        post: {
          summary: "Create a new conversation",
          tags: ["Chat"],
          responses: { "201": { description: "Created conversation" } },
        },
      },
      "/healthz": {
        get: {
          summary: "Health check",
          tags: ["System"],
          responses: {
            "200": { description: "All systems operational" },
            "503": { description: "Degraded — database unreachable" },
          },
        },
      },
    },
    components: {
      schemas: {
        Vehicle: {
          type: "object",
          properties: {
            id: { type: "integer" },
            plate: { type: "string", description: "License plate number" },
            make: { type: "string", nullable: true },
            model: { type: "string", nullable: true },
            year: { type: "integer", nullable: true },
            color: { type: "string", nullable: true },
            status: { type: "string", enum: ["ready", "rented", "washing", "maintenance", "returned"] },
            fuelLevel: { type: "integer", nullable: true, description: "0-100" },
            mileage: { type: "integer", nullable: true },
            nextBooking: { type: "string", nullable: true },
          },
        },
        VehicleUpdate: {
          type: "object",
          properties: {
            plate: { type: "string" },
            make: { type: "string" },
            model: { type: "string" },
            status: { type: "string" },
            fuelLevel: { type: "integer" },
          },
        },
        WashQueueItem: {
          type: "object",
          properties: {
            id: { type: "integer" },
            vehiclePlate: { type: "string" },
            washType: { type: "string", nullable: true },
            priority: { type: "string", nullable: true },
            status: { type: "string", enum: ["pending", "in_progress", "completed"] },
            assignedTo: { type: "string", nullable: true },
            slaInfo: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Notification: {
          type: "object",
          properties: {
            id: { type: "integer" },
            title: { type: "string" },
            body: { type: "string", nullable: true },
            type: { type: "string" },
            severity: { type: "string", enum: ["info", "warning", "critical"] },
            status: { type: "string" },
            read: { type: "boolean" },
            assignedTo: { type: "integer", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
      },
    },
  };
}
