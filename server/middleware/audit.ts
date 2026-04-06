import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage.js";

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

    res.json = function (data: unknown) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const user = req.user as Express.User | undefined;
        const entityId = req.params.id || (data && typeof data === 'object' && 'id' in data ? String((data as { id: unknown }).id) : undefined);

        storage.createAuditEntry({
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
          console.error('Failed to create audit entry:', err);
        });
      }

      return originalJson(data);
    };

    next();
  };
}

export { AUDIT_ACTIONS };
