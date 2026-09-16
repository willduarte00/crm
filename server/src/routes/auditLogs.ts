import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { requirePermission } from '../middlewares/requirePermission.js';

export const auditLogsRouter = Router();

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  action: z.string().min(1).optional(),
  actorId: z.string().min(1).optional(),
});

// GET /api/audit-logs - Trilha de auditoria (F-18)
auditLogsRouter.get('/', requirePermission('audit.view'), async (req: Request, res: Response) => {
  const { page, limit, action, actorId } = querySchema.parse(req.query);

  const where: { action?: string; actorId?: string } = {};
  if (action) where.action = action;
  if (actorId) where.actorId = actorId;

  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return res.json({
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});
