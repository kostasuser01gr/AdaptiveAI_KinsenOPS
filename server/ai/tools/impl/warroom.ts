/**
 * War Room / Entity Room Tools — Collaborative incident management, entity rooms, real-time messaging.
 * Enables the AI to create and manage war rooms for critical incidents.
 */
import { z } from "zod/v4";
import { toolRegistry } from "../registry.js";
import { storage } from "../../../storage.js";
import type { ToolResult } from "../types.js";

// ─── List Entity Rooms ───
toolRegistry.register({
  name: "list_war_rooms",
  description: "List active entity rooms (war rooms). Each room is a collaborative space linked to a vehicle, incident, or other entity for real-time coordination.",
  inputSchema: z.object({
    entityType: z.string().optional().describe("Filter by entity type: vehicle, incident, station, other"),
    active: z.boolean().optional().describe("Only show active rooms (default true)"),
  }),
  async handler(input): Promise<ToolResult> {
    const allRooms = await storage.getEntityRooms(input.entityType as string | undefined);
    const rooms = (input.active as boolean) !== false ? allRooms.filter((r: any) => r.active !== false) : allRooms;
    return {
      content: `${rooms.length} active war room(s).`,
      data: rooms,
      uiBlock: {
        type: "data_table", title: "War Rooms",
        columns: [
          { key: "id", label: "ID" },
          { key: "name", label: "Room" },
          { key: "entityType", label: "Entity" },
          { key: "entityId", label: "Entity ID" },
          { key: "status", label: "Status" },
        ],
        rows: rooms.slice(0, 20).map((r: any) => ({
          id: r.id,
          name: r.name ?? `Room #${r.id}`,
          entityType: r.entityType ?? "—",
          entityId: r.entityId ?? "—",
          status: r.active !== false ? "Active" : "Closed",
        })),
      },
    };
  },
});

// ─── Create War Room ───
toolRegistry.register({
  name: "create_war_room",
  description: "Create a new war room / entity room for coordinating on a critical issue. Links to a vehicle, incident, or station for context.",
  inputSchema: z.object({
    name: z.string().describe("Room name (e.g. 'Vehicle #42 Damage Response')"),
    entityType: z.string().describe("Entity type: vehicle, incident, station, other"),
    entityId: z.string().describe("Entity ID to link (as string)"),
    description: z.string().optional().describe("Room purpose/description"),
  }),
  requiredRole: "coordinator",
  async handler(input, ctx): Promise<ToolResult> {
    const room = await storage.createEntityRoom({
      workspaceId: ctx.workspaceId,
      title: input.name as string,
      entityType: input.entityType as string,
      entityId: input.entityId as string,
    });
    return {
      content: `War room "${(room as any).name}" created (ID: ${room.id}), linked to ${input.entityType} #${input.entityId}.`,
      uiBlock: {
        type: "entity_card", entityType: "war_room", entityId: room.id,
        title: (room as any).name ?? `Room #${room.id}`,
        subtitle: `${input.entityType} #${input.entityId}`,
        status: "Active", statusColor: "green",
        fields: [
          { label: "Entity", value: `${input.entityType} #${input.entityId}` },
          { label: "Created by", value: ctx.userDisplayName },
        ],
      },
    };
  },
});

// ─── Post to War Room ───
toolRegistry.register({
  name: "post_to_war_room",
  description: "Post a message or update to a war room. Use when reporting status, sharing findings, or coordinating actions.",
  inputSchema: z.object({
    roomId: z.number().describe("War room ID"),
    message: z.string().describe("Message to post"),
    type: z.string().optional().describe("Message type: text, status_update, action_item, resolution"),
  }),
  requiredRole: "agent",
  async handler(input, ctx): Promise<ToolResult> {
    const _msg = await storage.createRoomMessage({
      roomId: input.roomId as number,
      userId: ctx.userId,
      content: input.message as string,
    });
    return {
      content: `Posted to war room #${input.roomId}: "${(input.message as string).slice(0, 80)}${(input.message as string).length > 80 ? "…" : ""}".`,
    };
  },
});

// ─── Get War Room Messages ───
toolRegistry.register({
  name: "get_war_room_messages",
  description: "Get messages from a war room. Use to catch up on context, review discussion, or understand the timeline of an incident.",
  inputSchema: z.object({
    roomId: z.number().describe("War room ID"),
    limit: z.number().optional().describe("Number of messages (default 20)"),
  }),
  async handler(input): Promise<ToolResult> {
    const limit = Math.min((input.limit as number) || 20, 50);
    const allMessages = await storage.getRoomMessages(input.roomId as number);
    const messages = allMessages.slice(-limit);
    if (messages.length === 0) return { content: "No messages in this war room yet." };
    const formatted = messages.map((m: any) =>
      `[${m.createdAt ? new Date(m.createdAt).toLocaleString() : "?"}] ${m.userDisplayName ?? `User #${m.userId}`}: ${m.message}`
    ).join("\n");
    return {
      content: `${messages.length} message(s) in war room #${input.roomId}:\n\n${formatted}`,
      data: messages,
    };
  },
});

// ─── Close War Room ───
toolRegistry.register({
  name: "close_war_room",
  description: "Close a war room after the issue is resolved.",
  inputSchema: z.object({
    roomId: z.number().describe("War room ID to close"),
    summary: z.string().optional().describe("Closing summary or resolution notes"),
  }),
  requiredRole: "coordinator",
  async handler(input, ctx): Promise<ToolResult> {
    if (input.summary) {
      await storage.createRoomMessage({
        roomId: input.roomId as number,
        userId: ctx.userId,
        content: `Room closed. Summary: ${input.summary}`,
      });
    }
    const room = await storage.updateEntityRoom(input.roomId as number, { status: "closed" });
    if (!room) return { content: "War room not found.", isError: true };
    return {
      content: `War room #${input.roomId} closed.${input.summary ? ` Summary: ${(input.summary as string).slice(0, 80)}` : ""}`,
      uiBlock: { type: "alert", severity: "info", title: "War Room Closed", message: `Room #${input.roomId} has been archived.` },
    };
  },
});
