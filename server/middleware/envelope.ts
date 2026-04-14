import type { Request, Response, NextFunction } from "express";

/**
 * Auto-envelope middleware — wraps every `res.json()` call on /api/* routes
 * into the standard `{ ok, data, error?, meta?, requestId }` envelope.
 *
 * Route handlers keep using `res.json(payload)` and `res.status(4xx).json()`
 * as before — zero migration burden. Responses that are already enveloped
 * (contain a top-level `ok` boolean) are passed through unchanged.
 *
 * Special cases:
 *  - 204 No Content responses bypass the envelope (no body).
 *  - `res.sendEnvelopedError()` is set for the global error handler.
 */
export function envelopeMiddleware(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);

  res.json = function envelopedJson(body?: unknown) {
    // Pass through if already enveloped (explicit sendOk/sendPaginated/sendError calls)
    if (body && typeof body === "object" && "ok" in (body as Record<string, unknown>)) {
      return originalJson(body);
    }

    const status = res.statusCode;
    const requestId = res.locals.requestId as string | undefined;

    if (status >= 400) {
      // Error envelope
      const raw = body as Record<string, unknown> | null | undefined;
      return originalJson({
        ok: false,
        data: null,
        error: {
          message: raw?.message ?? raw?.error ?? "Unknown error",
          ...(raw?.code ? { code: raw.code } : {}),
          ...(raw?.errors ? { details: raw.errors } : {}),
          ...(raw?.details ? { details: raw.details } : {}),
          ...(raw?.current !== undefined ? { current: raw.current } : {}),
          ...(raw?.ceiling !== undefined ? { ceiling: raw.ceiling } : {}),
          ...(raw?.jobId !== undefined ? { jobId: raw.jobId } : {}),
        },
        requestId,
      });
    }

    // Success envelope
    return originalJson({
      ok: true,
      data: body,
      requestId,
    });
  } as Response["json"];

  next();
}
