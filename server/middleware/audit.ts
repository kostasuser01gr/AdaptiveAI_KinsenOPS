import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage.js";
import { getWorkspaceScope } from "./workspaceContext.js";
import { logger } from "../observability/logger.js";

const AUDIT_ACTIONS = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  VIEW: 'view',
  LOGIN: 'login',
  LOGOUT: 'logout',
  EXPORT: 'export',
} as const;

interface AuditOptions {
  action: typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];
  entityType: string;
  skipCondition?: (req: Request) => boolean;
}

export function auditLog(options: AuditOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (options.skipCondition && options.skipCondition(req)) {
      return next();
    }

    const originalJson = res.json.bind(res);
    const originalEnd = res.end.bind(res);

    let audited = false;
    const recordAudit = (data?: unknown) => {
      if (audited) return;
      audited = true;
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const user = req.user as Express.User | undefined;
        const entityId = req.params.id || (data && typeof data === 'object' && 'id' in data ? String((data as { id: unknown }).id) : undefined);

        storage.createAuditEntry({
          workspaceId: getWorkspaceScope(),
          userId: user?.id || null,
          action: options.action,
          entityType: options.entityType,
          entityId: (typeof entityId === 'string' ? entityId : null) || null,
          details: {
            method: req.method,
            path: req.path,
            userAgent: req.get('user-agent'),
            statusCode: res.statusCode,
          },
          ipAddress: req.ip || null,
        }).catch(err => {
          logger.error('Failed to create audit entry:', err);
        });
      }
    };

    res.json = function (data: unknown) {
      recordAudit(data);
      return originalJson(data);
    };

    // Capture non-JSON responses (e.g. 204 from DELETE)
    // @ts-expect-error -- overriding overloaded end() signature for audit capture
    res.end = function (...args: Parameters<Response['end']>) {
      recordAudit();
      return originalEnd(...args);
    };

    next();
  };
}

export { AUDIT_ACTIONS };
