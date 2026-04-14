import { describe, expect, it } from "vitest";
import {
  buildWebSocketClientMessage,
  getWebSocketSubscriptionPolicy,
  parseMemberChannelId,
  shouldExposeWebSocketData,
} from "../../server/websocketPolicy.js";

describe("websocket subscription policy", () => {
  it("requires authentication for operational broadcast channels", () => {
    expect(getWebSocketSubscriptionPolicy("vehicles")).toBe("authenticated");
    expect(getWebSocketSubscriptionPolicy("wash-queue")).toBe("authenticated");
    expect(getWebSocketSubscriptionPolicy("activity")).toBe("authenticated");
    expect(getWebSocketSubscriptionPolicy("notifications")).toBe("authenticated");
  });

  it("requires membership for numeric channel subscriptions", () => {
    expect(getWebSocketSubscriptionPolicy("channel:42")).toBe("member");
    expect(parseMemberChannelId("channel:42")).toBe(42);
  });

  it("rejects malformed or unknown channels", () => {
    expect(getWebSocketSubscriptionPolicy("channel:not-a-number")).toBe("forbidden");
    expect(getWebSocketSubscriptionPolicy("vehicle_events")).toBe("forbidden");
    expect(parseMemberChannelId("channel:not-a-number")).toBeNull();
  });
});

describe("websocket payload exposure", () => {
  it("preserves chat-channel payloads", () => {
    const event = buildWebSocketClientMessage({
      type: "channel_message",
      channel: "channel:7",
      data: { channelId: 7, content: "hello" },
      timestamp: "2026-04-14T12:00:00.000Z",
    });

    expect(shouldExposeWebSocketData("channel:7")).toBe(true);
    expect(event).toEqual({
      type: "channel_message",
      data: { channelId: 7, content: "hello" },
      timestamp: "2026-04-14T12:00:00.000Z",
    });
  });

  it("strips raw payloads from operational invalidation channels", () => {
    const event = buildWebSocketClientMessage({
      type: "notification:created",
      channel: "notifications",
      data: { title: "Sensitive", body: "Hidden" },
      timestamp: "2026-04-14T12:00:00.000Z",
    });

    expect(shouldExposeWebSocketData("notifications")).toBe(false);
    expect(event).toEqual({
      type: "notification:created",
      timestamp: "2026-04-14T12:00:00.000Z",
    });
  });

  it("strips raw payloads from global authenticated broadcasts", () => {
    const event = buildWebSocketClientMessage({
      type: "notification_updated",
      data: { recipientUserId: 5, body: "Sensitive" },
      timestamp: "2026-04-14T12:00:00.000Z",
    });

    expect(event).toEqual({
      type: "notification_updated",
      timestamp: "2026-04-14T12:00:00.000Z",
    });
  });
});
