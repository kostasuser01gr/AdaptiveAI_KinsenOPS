import { useEffect, useRef, useState, useCallback } from 'react';
import { queryClient } from '@/lib/queryClient';

type WSStatus = 'connecting' | 'connected' | 'disconnected';

interface WSMessage {
  type: string;
  data?: unknown;
  channel?: string;
  timestamp?: string;
  clientId?: string;
  authenticated?: boolean;
}

const PING_INTERVAL = 25_000;
const MAX_BACKOFF = 30_000;

// ─── Module-level singleton state ────────────────────────────────────────────
// Exactly one WebSocket connection shared by all useWebSocket() callers.

let ws: WebSocket | null = null;
let wsStatus: WSStatus = 'disconnected';
let backoff = 1000;
let pingTimer: ReturnType<typeof setInterval> | undefined;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let consumerCount = 0; // how many hook instances are alive

// Ref-counted channel subscriptions: channel → number of hook-instances requesting it
const channelRefs = new Map<string, number>();
// All active hook status-listeners (so they can re-render on status change)
const statusListeners = new Set<(s: WSStatus) => void>();

function setGlobalStatus(s: WSStatus) {
  wsStatus = s;
  for (const fn of statusListeners) fn(s);
}

function sendRaw(payload: Record<string, unknown>) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function subscribeChannel(ch: string) {
  const prev = channelRefs.get(ch) ?? 0;
  channelRefs.set(ch, prev + 1);
  if (prev === 0) sendRaw({ type: 'subscribe', channel: ch }); // first requester
}

function unsubscribeChannel(ch: string) {
  const prev = channelRefs.get(ch) ?? 1;
  if (prev <= 1) {
    channelRefs.delete(ch);
    sendRaw({ type: 'unsubscribe', channel: ch });
  } else {
    channelRefs.set(ch, prev - 1);
  }
}

function cleanupConnection() {
  if (pingTimer) { clearInterval(pingTimer); pingTimer = undefined; }
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = undefined; }
  if (ws) {
    ws.onopen = null;
    ws.onclose = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.close();
    ws = null;
  }
}

function scheduleReconnect() {
  if (consumerCount <= 0) return; // no one listening — don't reconnect
  const delay = Math.min(backoff + Math.random() * 500, MAX_BACKOFF);
  backoff = Math.min(backoff * 2, MAX_BACKOFF);
  reconnectTimer = setTimeout(connect, delay);
}

function connect() {
  if (consumerCount <= 0) return;
  cleanupConnection();

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
  ws = socket;
  setGlobalStatus('connecting');

  socket.onopen = () => {
    setGlobalStatus('connected');
    backoff = 1000;
    // Re-subscribe all currently requested channels
    for (const ch of channelRefs.keys()) {
      sendRaw({ type: 'subscribe', channel: ch });
    }
    // Keep-alive ping
    pingTimer = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, PING_INTERVAL);
  };

  socket.onmessage = (event) => {
    try {
      handleServerMessagePatched(JSON.parse(event.data) as WSMessage);
    } catch { /* ignore non-JSON frames */ }
  };

  socket.onclose = () => {
    setGlobalStatus('disconnected');
    if (pingTimer) { clearInterval(pingTimer); pingTimer = undefined; }
    scheduleReconnect();
  };

  socket.onerror = () => { /* onclose fires after onerror; reconnect handled there */ };
}

function handleServerMessage(msg: WSMessage) {
  switch (msg.type) {
    case 'vehicle_update':
    case 'vehicles_changed':
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
      break;
    case 'wash_queue_update':
    case 'wash_changed':
      queryClient.invalidateQueries({ queryKey: ['/api/wash-queue'] });
      break;
    case 'notification':
    case 'notification:created':
    case 'notifications_changed':
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      break;
    case 'activity_update':
    case 'activity_changed':
      queryClient.invalidateQueries({ queryKey: ['/api/activity-feed'] });
      break;
    case 'chat_message':
      queryClient.invalidateQueries({ queryKey: ['/api/entity-rooms'] });
      break;
    case 'channel_message':
    case 'channel_message_edited':
    case 'message_pinned':
    case 'message_unpinned':
      queryClient.invalidateQueries({ queryKey: ['/api/channel-messages'] });
      break;
    case 'member_joined':
    case 'member_left':
      queryClient.invalidateQueries({ queryKey: ['/api/channels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/channel-members'] });
      break;
    case 'position_assigned':
    case 'position_released':
      queryClient.invalidateQueries({ queryKey: ['/api/position-assignments'] });
      break;
    case 'transfer_created':
    case 'transfer_updated':
      queryClient.invalidateQueries({ queryKey: ['/api/transfers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
      break;
    case 'pong':
    case 'connected':
    case 'auth_result':
      break;
    default:
      break;
  }
}

// Per-hook message listeners so each hook instance gets its own lastMessage
const messageListeners = new Set<(msg: WSMessage) => void>();

// Patch handleServerMessage to also notify per-hook listeners
const _origHandleServerMessage = handleServerMessage;
function handleServerMessagePatched(msg: WSMessage) {
  _origHandleServerMessage(msg);
  for (const fn of messageListeners) fn(msg);
}

// ─── Hook: thin wrapper over the singleton ───────────────────────────────────
// Each caller declares which channels it needs. Ref-counting ensures the
// connection stays open while at least one consumer exists, and channel
// subscriptions are aggregated across all callers.

export function useWebSocket(channels: string[] = []) {
  const [status, setStatus] = useState<WSStatus>(wsStatus);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const prevChannels = useRef<string[]>([]);

  // Register this hook instance as a consumer
  useEffect(() => {
    consumerCount++;
    // Start connection if this is the first consumer
    if (consumerCount === 1 && (!ws || ws.readyState === WebSocket.CLOSED)) {
      connect();
    }
    // Listen for status changes
    statusListeners.add(setStatus);
    // Listen for messages
    messageListeners.add(setLastMessage);
    // Sync current status immediately
    setStatus(wsStatus);

    return () => {
      statusListeners.delete(setStatus);
      messageListeners.delete(setLastMessage);
      consumerCount--;
      if (consumerCount <= 0) {
        cleanupConnection();
        setGlobalStatus('disconnected');
      }
    };
  }, []);

  // Manage channel subscriptions with ref-counting
  useEffect(() => {
    const prev = new Set(prevChannels.current);
    const next = new Set(channels);

    // Subscribe to newly requested channels
    for (const ch of next) {
      if (!prev.has(ch)) subscribeChannel(ch);
    }
    // Unsubscribe from channels no longer needed by this hook instance
    for (const ch of prev) {
      if (!next.has(ch)) unsubscribeChannel(ch);
    }
    prevChannels.current = channels;

    return () => {
      // On unmount, release all channels this instance held
      for (const ch of channels) unsubscribeChannel(ch);
    };
  }, [channels.join(',')]);   

  const send = useCallback((msg: Record<string, unknown>) => sendRaw(msg), []);

  return { status, send, lastMessage };
}
