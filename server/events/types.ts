/** Discriminated union of all domain events */
export type DomainEvent =
  | { type: "user:login"; payload: { userId: number; username: string } }
  | { type: "user:logout"; payload: { userId: number } }
  | { type: "user:locked"; payload: { userId: number; username: string; failedAttempts: number } }
  | { type: "user:registered"; payload: { userId: number; username: string; role: string } }
  | { type: "notification:created"; payload: { id: number; userId: number; title: string } }
  | { type: "job:created"; payload: { id: number; status: string } }
  | { type: "job:updated"; payload: { id: number; status: string; previousStatus?: string } };

export type DomainEventType = DomainEvent["type"];

/** Extract the payload type for a given event type */
export type EventPayload<T extends DomainEventType> = Extract<DomainEvent, { type: T }>["payload"];
