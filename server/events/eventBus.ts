import { EventEmitter } from "events";
import Redis from "ioredis";
import type { DomainEventType, EventPayload } from "./types.js";
import { logger } from "../observability/logger.js";
import { config } from "../config.js";

const REDIS_CHANNEL = "domain-events";

class DomainEventBus {
  private emitter = new EventEmitter();
  private pub: Redis | null = null;
  private sub: Redis | null = null;
  private ready = false;

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  /** Call once at boot — attaches Redis pub/sub if REDIS_URL is set. */
  async connectRedis(): Promise<void> {
    const url = config.redisUrl;
    if (!url) {
      logger.info("EventBus: no REDIS_URL — running in local-only mode");
      return;
    }

    try {
      this.pub = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: true });
      this.sub = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: true });
      await Promise.all([this.pub.connect(), this.sub.connect()]);

      await this.sub.subscribe(REDIS_CHANNEL);
      this.sub.on("message", (_ch: string, raw: string) => {
        try {
          const { type, payload } = JSON.parse(raw) as { type: string; payload: unknown };
          // Emit locally without re-publishing (avoid infinite loop)
          this.emitter.emit(type, payload);
        } catch (parseErr) {
          logger.error("EventBus: failed to parse Redis message", parseErr instanceof Error ? parseErr : new Error(String(parseErr)));
        }
      });

      this.ready = true;
      logger.info("EventBus: Redis pub/sub connected");
    } catch (_connectErr) {
      logger.warn("EventBus: Redis pub/sub failed — falling back to local-only");
      this.pub = null;
      this.sub = null;
    }
  }

  emit<T extends DomainEventType>(type: T, payload: EventPayload<T>): void {
    logger.info(`event:${type}`, { event: type });
    // Local delivery
    this.emitter.emit(type, payload);
    // Distributed delivery via Redis (fire-and-forget)
    if (this.ready && this.pub) {
      this.pub.publish(REDIS_CHANNEL, JSON.stringify({ type, payload })).catch((pubErr) => {
        logger.error("EventBus: Redis publish failed", pubErr instanceof Error ? pubErr : new Error(String(pubErr)));
      });
    }
  }

  on<T extends DomainEventType>(type: T, handler: (payload: EventPayload<T>) => void): void {
    this.emitter.on(type, handler);
  }

  off<T extends DomainEventType>(type: T, handler: (payload: EventPayload<T>) => void): void {
    this.emitter.off(type, handler);
  }

  once<T extends DomainEventType>(type: T, handler: (payload: EventPayload<T>) => void): void {
    this.emitter.once(type, handler);
  }

  async destroy(): Promise<void> {
    if (this.sub) { await this.sub.unsubscribe(REDIS_CHANNEL).catch(() => {}); this.sub.disconnect(); }
    if (this.pub) { this.pub.disconnect(); }
    this.ready = false;
  }
}

export const eventBus = new DomainEventBus();
