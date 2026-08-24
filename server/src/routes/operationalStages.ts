import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';

export const operationalStagesRouter = Router();

const STAGE_COLOR_TOKENS = ['blue', 'amber', 'purple', 'emerald', 'teal', 'rose', 'sky', 'slate'] as const;

const createStageSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().max(200).optional().nullable(),
  color: z.enum(STAGE_COLOR_TOKENS).default('slate'),
});

const updateStageSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().max(200).optional().nullable(),
  color: z.enum(STAGE_COLOR_TOKENS).optional(),
  active: z.boolean().optional(),
});

const reorderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'Pelo menos uma etapa deve ser informada'),
});

// GET /api/operational-stages — qualquer usuário autenticado
operationalStagesRouter.get('/', async (_req: Request, res: Response) => {
  const stages = await prisma.operationalStage.findMany({
    orderBy: { position: 'asc' },
    include: {
      _count: {
        select: {
          tasks: {
            where: { deletedAt: null },
          },
        },
      },
    },
  });

  return res.json(stages);
});

// POST /api/operational-stages — somente admin
operationalStagesRouter.post('/', requireAdmin, async (req: Request, res: Response) => {
  const data = createStageSchema.parse(req.body);

  const existing = await prisma.operationalStage.findUnique({
    where: { name: data.name.trim() },
  });

  if (existing) {
    return res.status(400).json({ error: 'Já existe uma etapa com esse nome' });
  }

  // position = max(position) + 1
  const maxStage = await prisma.operationalStage.findFirst({
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const nextPosition = (maxStage?.position ?? -1) + 1;

  const stage = await prisma.operationalStage.create({
    data: {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      color: data.color,
      position: nextPosition,
    },
    include: {
      _count: {
        select: {
          tasks: { where: { deletedAt: null } },
        },
      },
    },
  });

  return res.status(201).json(stage);
});

// PATCH /api/operational-stages/reorder — somente admin (DEVE vir antes de /:id)
operationalStagesRouter.patch('/reorder', requireAdmin, async (req: Request, res: Response) => {
  const { ids } = reorderSchema.parse(req.body);

  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.operationalStage.update({
        where: { id },
        data: { position: index },
      })
    )
  );

  const stages = await prisma.operationalStage.findMany({
    orderBy: { position: 'asc' },
    include: {
      _count: {
        select: {
          tasks: { where: { deletedAt: null } },
        },
      },
    },
  });

  return res.json(stages);
});

// PATCH /api/operational-stages/:id — somente admin
operationalStagesRouter.patch('/:id', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = updateStageSchema.parse(req.body);

  const stage = await prisma.operationalStage.findUnique({ where: { id } });
  if (!stage) {
    return res.status(404).json({ error: 'Etapa não encontrada' });
  }

  // Regra: não pode desativar etapa com demandas ativas
  if (data.active === false && stage.active === true) {
    const taskCount = await prisma.operationalTask.count({
      where: { stageId: id, deletedAt: null },
    });
    if (taskCount > 0) {
      return res.status(422).json({
        error: `Mova as ${taskCount} demanda${taskCount > 1 ? 's' : ''} desta etapa antes de desativá-la.`,
      });
    }
  }

  // Regra: não pode desativar a última etapa ativa
  if (data.active === false && stage.active === true) {
    const activeCount = await prisma.operationalStage.count({ where: { active: true } });
    if (activeCount <= 1) {
      return res.status(422).json({ error: 'Não é possível desativar a última etapa ativa.' });
    }
  }

  // Verificar nome duplicado se estiver alterando
  if (data.name !== undefined && data.name.trim() !== stage.name) {
    const nameTaken = await prisma.operationalStage.findUnique({
      where: { name: data.name.trim() },
    });
    if (nameTaken) {
      return res.status(400).json({ error: 'Já existe uma etapa com esse nome' });
    }
  }

  const updated = await prisma.operationalStage.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    },
    include: {
      _count: {
        select: {
          tasks: { where: { deletedAt: null } },
        },
      },
    },
  });

  return res.json(updated);
});

// DELETE /api/operational-stages/:id — somente admin
operationalStagesRouter.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;

  const stage = await prisma.operationalStage.findUnique({ where: { id } });
  if (!stage) {
    return res.status(404).json({ error: 'Etapa não encontrada' });
  }

  // Regra: não pode excluir etapa com demandas ativas
  const taskCount = await prisma.operationalTask.count({
    where: { stageId: id, deletedAt: null },
  });
  if (taskCount > 0) {
    return res.status(422).json({
      error: `Mova as ${taskCount} demanda${taskCount > 1 ? 's' : ''} desta etapa antes de excluí-la.`,
    });
  }

  // Regra: não pode excluir a última etapa ativa
  if (stage.active) {
    const activeCount = await prisma.operationalStage.count({ where: { active: true } });
    if (activeCount <= 1) {
      return res.status(422).json({ error: 'Não é possível excluir a última etapa ativa.' });
    }
  }

  await prisma.operationalStage.delete({ where: { id } });

  return res.json({ success: true, message: 'Etapa excluída com sucesso' });
});
