import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

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

/**
 * Singleton WebSocket manager for the app.
 * Exposes connection status and handles auto-reconnect with bounded backoff.
 */
export function useWebSocket(channels: string[] = []) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pingTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const backoff = useRef(1000);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<WSStatus>('disconnected');

  const channelsRef = useRef(channels);
  channelsRef.current = channels;

  const cleanup = useCallback(() => {
    if (pingTimer.current) clearInterval(pingTimer.current);
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    cleanup();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;
    setStatus('connecting');

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setStatus('connected');
      backoff.current = 1000;

      // Subscribe to channels
      for (const ch of channelsRef.current) {
        ws.send(JSON.stringify({ type: 'subscribe', channel: ch }));
      }

      // Client-side ping to keep connection alive through proxies
      pingTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, PING_INTERVAL);
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        handleServerMessage(msg);
      } catch {
        // ignore non-JSON frames
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStatus('disconnected');
      if (pingTimer.current) clearInterval(pingTimer.current);
      scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose will fire after onerror; reconnect handled there
    };
  }, [cleanup]);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    const delay = Math.min(backoff.current + Math.random() * 500, MAX_BACKOFF);
    backoff.current = Math.min(backoff.current * 2, MAX_BACKOFF);
    reconnectTimer.current = setTimeout(() => {
      if (mountedRef.current) connect();
    }, delay);
  }, [connect]);

  const handleServerMessage = useCallback((msg: WSMessage) => {
    // Map WS event types to query key invalidation
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
      case 'notifications_changed':
        queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
        break;
      case 'activity_update':
      case 'activity_changed':
        queryClient.invalidateQueries({ queryKey: ['/api/activity'] });
        break;
      case 'chat_message':
        queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
        break;
      case 'pong':
      case 'connected':
      case 'auth_result':
        // internal, no invalidation needed
        break;
      default:
        // Unknown event types: broad invalidation to stay fresh
        break;
    }
  }, [queryClient]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [connect, cleanup]);

  // Re-subscribe when channels change
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    for (const ch of channels) {
      ws.send(JSON.stringify({ type: 'subscribe', channel: ch }));
    }
  }, [channels]);

  return { status };
}
