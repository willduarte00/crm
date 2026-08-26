import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ForbiddenError } from './requirePermission.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  if (err instanceof ForbiddenError) {
    return res.status(403).json({
      error: 'Você não tem permissão para executar esta ação.',
      requiredPermission: err.requiredPermission,
    });
  }

  console.error('Unhandled Error:', err);
  return res.status(500).json({
    error: 'Erro interno do servidor',
  });
}
