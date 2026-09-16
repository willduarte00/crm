import { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';

interface LogAuditParams {
  req: Request;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Grava uma entrada na trilha de auditoria (F-18). Nunca lança: uma falha ao
 * gravar o log não pode derrubar a requisição que a originou.
 */
export async function logAudit({ req, action, targetType, targetId, metadata }: LogAuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: req.user?.id ?? null,
        actorEmail: req.user?.email ?? null,
        action,
        targetType: targetType ?? null,
        targetId: targetId ?? null,
        ip: req.ip ?? null,
        metadata: (metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
  } catch (error) {
    console.error(`[audit] Falha ao registrar ação "${action}":`, error);
  }
}
