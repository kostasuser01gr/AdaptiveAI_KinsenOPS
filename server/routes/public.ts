import type { Express } from "express";
import { z } from "zod/v4";
import { storage } from "../storage.js";
import { publicEvidenceLimiter } from "../middleware/rate-limiter.js";
import { PUBLIC_ROOM_ENTITY_TYPES, isPublicRoomType } from "./_helpers.js";
import { bridgeRoomToChannel } from "./_bridge.js";

export function registerPublicRoutes(app: Express) {
  // PUBLIC EVIDENCE (customer portal)
  app.post("/api/public/evidence", publicEvidenceLimiter, async (req, res, next) => {
    try {
      const schema = z.object({
        reservationId: z.string().min(1).max(100),
        type: z.string().min(1).max(50),
        caption: z.string().max(500).optional(),
        source: z.enum(["customer", "staff"]),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }).strict();
      const data = schema.parse(req.body);
      const record = await storage.createVehicleEvidence({
        vehicleId: null,
        type: data.type,
        caption: data.caption,
        source: data.source,
        reservationId: data.reservationId,
        metadata: data.metadata,
      });
      res.status(201).json(record);
    } catch (e) { next(e); }
  });

  // PUBLIC ROOM RESOLVE (customer/washer chat)
  app.post("/api/public/rooms/resolve", publicEvidenceLimiter, async (req, res, next) => {
    try {
      const schema = z.object({
        entityType: z.enum(PUBLIC_ROOM_ENTITY_TYPES),
        entityId: z.string().min(1).max(100),
        title: z.string().min(1).max(200).optional(),
      }).strict();
      const { entityType, entityId, title } = schema.parse(req.body);
      let room = await storage.getEntityRoomByEntity(entityType, entityId);
      if (!room) {
        room = await storage.createEntityRoom({
          entityType,
          entityId,
          title: title || `${entityType} ${entityId}`,
          status: "open",
          priority: "normal",
        });
      }
      res.json(room);
    } catch (e) { next(e); }
  });

  app.get("/api/public/rooms/:id/messages", publicEvidenceLimiter, async (req, res, next) => {
    try {
      const room = await storage.getEntityRoom(Number(req.params.id));
      if (!room || !isPublicRoomType(room.entityType)) {
        return res.status(404).json({ message: "Not found" });
      }
      res.json(await storage.getRoomMessages(Number(req.params.id)));
    } catch (e) { next(e); }
  });

  app.post("/api/public/rooms/:id/messages", publicEvidenceLimiter, async (req, res, next) => {
    try {
      const room = await storage.getEntityRoom(Number(req.params.id));
      if (!room || !isPublicRoomType(room.entityType)) {
        return res.status(404).json({ message: "Not found" });
      }
      const { content } = z.object({
        content: z.string().min(1).max(10000),
      }).strict().parse(req.body);
      const roomId = Number(req.params.id);
      const msg = await storage.createRoomMessage({
        roomId,
        content,
        role: "customer",
        type: "message",
      });
      // Bridge to washer_bridge channel if linked
      if (room.entityType === "washer-ops") {
        bridgeRoomToChannel(roomId, content, "washer");
      }
      res.status(201).json(msg);
    } catch (e) { next(e); }
  });
}
