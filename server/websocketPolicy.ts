const MEMBER_CHANNEL_PATTERN = /^channel:(\d+)$/;

const ANONYMOUS_CHANNELS = new Set<string>();
const AUTHENTICATED_CHANNELS = new Set([
  'vehicles',
  'wash-queue',
  'activity',
  'notifications',
]);

export type WebSocketSubscriptionPolicy = 'anonymous' | 'authenticated' | 'member' | 'forbidden';

export function parseMemberChannelId(channel: string): number | null {
  const match = channel.match(MEMBER_CHANNEL_PATTERN);
  if (!match) {
    return null;
  }

  const channelId = Number.parseInt(match[1], 10);
  return Number.isFinite(channelId) ? channelId : null;
}

export function getWebSocketSubscriptionPolicy(channel: string): WebSocketSubscriptionPolicy {
  if (ANONYMOUS_CHANNELS.has(channel)) {
    return 'anonymous';
  }

  if (AUTHENTICATED_CHANNELS.has(channel)) {
    return 'authenticated';
  }

  if (parseMemberChannelId(channel) !== null) {
    return 'member';
  }

  return 'forbidden';
}

export function shouldExposeWebSocketData(channel?: string): boolean {
  return typeof channel === 'string' && parseMemberChannelId(channel) !== null;
}

export function buildWebSocketClientMessage(event: {
  type: string;
  channel?: string;
  data: unknown;
  timestamp?: string;
}) {
  return {
    type: event.type,
    ...(shouldExposeWebSocketData(event.channel) ? { data: event.data } : {}),
    timestamp: event.timestamp ?? new Date().toISOString(),
  };
}
