import type { Request, Response } from "express";

// ─── Standard API Response Envelope ──────────────────────────────────────────

interface ApiResponse<T> {
  ok: boolean;
  data: T;
  meta?: Record<string, unknown>;
  requestId?: string;
}

interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/** Send a standard success envelope: { ok: true, data, meta?, requestId } */
export function sendOk<T>(res: Response, data: T, meta?: Record<string, unknown>, status = 200): void {
  const envelope: ApiResponse<T> = {
    ok: true,
    data,
    ...(meta && { meta }),
    requestId: res.locals.requestId as string | undefined,
  };
  res.status(status).json(envelope);
}

/** Send a paginated response: { ok: true, data: [], meta: { page, pageSize, total, totalPages, hasMore } } */
export function sendPaginated<T>(
  res: Response,
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): void {
  const totalPages = Math.ceil(total / pageSize);
  const envelope: PaginatedResponse<T> = {
    ok: true,
    data: items,
    meta: {
      page,
      pageSize,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
    requestId: res.locals.requestId as string | undefined,
  };
  res.status(200).json(envelope);
}

/** Send a standard error envelope: { ok: false, data: null, error: { message, code?, details? } } */
export function sendError(
  res: Response,
  status: number,
  message: string,
  details?: Record<string, unknown>,
): void {
  res.status(status).json({
    ok: false,
    data: null,
    error: {
      message,
      ...(details ? { details } : {}),
    },
    requestId: res.locals.requestId as string | undefined,
  });
}

/** Extract page/pageSize from query with safe defaults and bounds. */
export function parsePagination(req: Request, defaults = { page: 1, pageSize: 25 }) {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || defaults.page);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string, 10) || defaults.pageSize));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

// ─── Cursor-based Pagination ─────────────────────────────────────────────────

/** Parse cursor pagination params from query string. */
export function parseCursor(req: Request, defaults = { limit: 25 }) {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || defaults.limit));
  const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
  return { limit, cursor };
}

interface CursorPageOptions<T> {
  /** The items returned from the query (should be limit + 1 to detect hasMore). */
  items: T[];
  /** Maximum items per page. */
  limit: number;
  /** Function to extract the cursor value from the last item (e.g. item.id or item.createdAt). */
  getCursor: (item: T) => string | number;
}

/** Send a cursor-paginated response. Query should fetch `limit + 1` rows. */
export function sendCursorPage<T>(res: Response, opts: CursorPageOptions<T>): void {
  const { items, limit, getCursor } = opts;
  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? String(getCursor(page[page.length - 1])) : null;

  res.status(200).json({
    ok: true,
    data: page,
    meta: {
      limit,
      hasMore,
      nextCursor,
    },
    requestId: res.locals.requestId as string | undefined,
  });
}
