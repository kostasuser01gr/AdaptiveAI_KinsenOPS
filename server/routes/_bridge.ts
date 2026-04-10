/**
 * Washer Bridge – bidirectional cross-posting between entity rooms (public/washer)
 * and washer_bridge chat channels (authenticated staff).
 *
 * Room → Channel:  washer posts show up in the staff Channels page.
 * Channel → Room:  staff replies show up in the washer kiosk WasherChat.
 */
import { storage } from "../storage.js";
import { wsManager } from "../websocket.js";
import { logger } from "../observability/logger.js";

/**
 * After a room message is created in a washer-ops room, cross-post it
 * to the linked washer_bridge channel (if one exists).
 */
export async function bridgeRoomToChannel(
  roomId: number,
  content: string,
  senderRole: string,
): Promise<boolean> {
  try {
    const channels = await storage.getChatChannels("washer_bridge");
    const linked = channels.find(
      (c: any) => (c.metadata as Record<string, unknown> | null)?.linkedRoomId === roomId,
    );
    if (!linked) return false;

    const msg = await storage.createChannelMessage({
      channelId: linked.id,
      userId: linked.createdBy, // attribute to channel owner for schema constraint
      content,
      metadata: { bridged: true, source: "room", senderRole, roomId },
    });
    wsManager.broadcast({
      type: "channel_message",
      data: msg,
      channel: `channel:${linked.id}`,
    });
    logger.info("Bridged room→channel");
    return true;
  } catch (err) {
    logger.error("bridgeRoomToChannel failed", err instanceof Error ? err : new Error(String(err)));
    return false;
  }
}

/**
 * After a staff member posts in a washer_bridge channel, cross-post
 * to the linked entity room so the washer kiosk sees the reply.
 * Skips if the message itself was bridged (prevents infinite loop).
 */
export async function bridgeChannelToRoom(
  channelId: number,
  content: string,
  metadata: Record<string, unknown> | null | undefined,
): Promise<boolean> {
  // Prevent infinite loop – don't re-bridge messages that came from a room
  if (metadata && (metadata as any).bridged) return false;

  try {
    const channel = await storage.getChatChannel(channelId);
    if (!channel || channel.type !== "washer_bridge") return false;

    const linkedRoomId = (channel.metadata as Record<string, unknown> | null)?.linkedRoomId;
    if (typeof linkedRoomId !== "number") return false;

    const room = await storage.getEntityRoom(linkedRoomId);
    if (!room) return false;

    await storage.createRoomMessage({
      roomId: linkedRoomId,
      content,
      role: "staff",
      type: "message",
    });
    logger.info("Bridged channel→room");
    return true;
  } catch (err) {
    logger.error("bridgeChannelToRoom failed", err instanceof Error ? err : new Error(String(err)));
    return false;
  }
}

/**
 * When a washer_bridge channel is created, auto-resolve/create the washer-ops
 * entity room and store the linkage in the channel's metadata.
 */
export async function autoLinkBridgeChannel(channelId: number): Promise<void> {
  try {
    let room = await storage.getEntityRoomByEntity("washer-ops", "default");
    if (!room) {
      room = await storage.createEntityRoom({
        entityType: "washer-ops",
        entityId: "default",
        title: "Washer Operations Channel",
        status: "open",
        priority: "normal",
      });
    }
    await storage.updateChatChannel(channelId, {
      metadata: { linkedRoomId: room.id },
    });
    logger.info("Auto-linked bridge channel");
  } catch (err) {
    logger.error("autoLinkBridgeChannel failed", err instanceof Error ? err : new Error(String(err)));
  }
}
