import type { Request, Response, NextFunction } from "express";
import { z } from "zod/v4";
import DOMPurify from "isomorphic-dompurify";
type ZodSchema = z.ZodType;

export function validateRequest(schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query) as typeof req.query;
      }
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params) as typeof req.params;
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.issues.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
}

/**
 * Shorthand for body-only validation — the most common case.
 * Usage: `app.post('/api/foo', validateBody(insertFooSchema), handler)`
 */
export function validateBody(schema: ZodSchema) {
  return validateRequest({ body: schema });
}

/**
 * Shorthand for query-only validation — for GET endpoints.
 * Usage: `app.get('/api/foo', validateQuery(paginationSchema), handler)`
 */
export function validateQuery(schema: ZodSchema) {
  return validateRequest({ query: schema });
}

export function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
}

// ─── Reusable param schemas ──────────────────────────────────────────────────

/** Validates that :id param is a positive integer. */
export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

/** Middleware: reject requests where :id is not a positive integer (returns 400). */
export function validateIdParam() {
  return validateRequest({ params: idParamSchema });
}
