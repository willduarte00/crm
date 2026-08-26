import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Permission } from '../domain/permissions.js';

export class ForbiddenError extends Error {
  constructor(public readonly requiredPermission: Permission) {
    super('Forbidden');
  }
}

/** Guarda de rota: exige uma permissão. */
export function requirePermission(permission: Permission): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.permissions.has(permission)) {
      console.warn(`Acesso negado: userId=${req.user?.id || 'unauthenticated'}, method=${req.method}, path=${req.path}, requiredPermission=${permission}`);
      return res.status(403).json({
        error: 'Você não tem permissão para executar esta ação.',
        requiredPermission: permission,
      });
    }
    return next();
  };
}

/** Guarda de rota: concede quando o usuário tem ao menos uma das permissões. */
export function requireAnyPermission(...permissions: Permission[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      console.warn(`Acesso negado: userId=unauthenticated, method=${req.method}, path=${req.path}, requiredPermission=${permissions[0]}`);
      return res.status(403).json({
        error: 'Você não tem permissão para executar esta ação.',
        requiredPermission: permissions[0],
      });
    }

    const hasAny = permissions.some((p) => req.user!.permissions.has(p));
    if (!hasAny) {
      console.warn(`Acesso negado: userId=${req.user.id}, method=${req.method}, path=${req.path}, requiredPermission=${permissions[0]}`);
      return res.status(403).json({
        error: 'Você não tem permissão para executar esta ação.',
        requiredPermission: permissions[0],
      });
    }
    return next();
  };
}

/** Uso dentro de handler que ramifica por intenção. Lança ForbiddenError. */
export function assertPermission(req: Request, permission: Permission): void {
  if (!req.user || !req.user.permissions.has(permission)) {
    console.warn(`Acesso negado (assert): userId=${req.user?.id || 'unauthenticated'}, method=${req.method}, path=${req.path}, requiredPermission=${permission}`);
    throw new ForbiddenError(permission);
  }
}
