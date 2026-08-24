import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { PRIORITIES } from '../domain/clients.js';

export const operationalTasksRouter = Router();

const taskInclude = {
  stage: true,
  owner: {
    select: { id: true, name: true, active: true },
  },
  client: {
    select: { id: true, name: true, tradeName: true },
  },
} as const;

const createTaskSchema = z.object({
  clientId: z.string().uuid('ID de cliente inválido'),
  stageId: z.string().uuid('ID de etapa inválido'),
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional().nullable(),
  priority: z.enum(PRIORITIES).default('media'),
  dueDate: z.string().optional().nullable(),
  ownerId: z.string().uuid().optional().nullable().or(z.literal('')),
});

const updateTaskSchema = z.object({
  clientId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  priority: z.enum(PRIORITIES).optional(),
  dueDate: z.string().optional().nullable(),
  ownerId: z.string().uuid().optional().nullable().or(z.literal('')),
});

const changeStageSchema = z.object({
  stageId: z.string().uuid('ID de etapa inválido'),
});

// GET /api/operational-tasks
operationalTasksRouter.get('/', async (req: Request, res: Response) => {
  const { search, stageId, ownerId, priority, clientId } = req.query;

  const where: any = { deletedAt: null };

  if (search && typeof search === 'string' && search.trim()) {
    const term = search.trim();
    where.OR = [
      { title: { contains: term, mode: 'insensitive' } },
      { description: { contains: term, mode: 'insensitive' } },
      { client: { name: { contains: term, mode: 'insensitive' } } },
      { client: { tradeName: { contains: term, mode: 'insensitive' } } },
    ];
  }

  if (stageId && typeof stageId === 'string' && stageId !== 'all') {
    where.stageId = stageId;
  }

  if (priority && typeof priority === 'string' && priority !== 'all') {
    where.priority = priority;
  }

  if (clientId && typeof clientId === 'string' && clientId !== 'all') {
    where.clientId = clientId;
  }

  if (ownerId && typeof ownerId === 'string' && ownerId !== 'all') {
    if (ownerId === 'unassigned' || ownerId === 'none') {
      where.ownerId = null;
    } else {
      where.ownerId = ownerId;
    }
  }

  const tasks = await prisma.operationalTask.findMany({
    where,
    take: 1000,
    orderBy: [
      { dueDate: 'asc' },
      { createdAt: 'desc' },
    ],
    include: taskInclude,
  });

  return res.json(tasks);
});

// POST /api/operational-tasks
operationalTasksRouter.post('/', async (req: Request, res: Response) => {
  const data = createTaskSchema.parse(req.body);

  // Validar etapa
  const stage = await prisma.operationalStage.findUnique({ where: { id: data.stageId } });
  if (!stage) {
    return res.status(422).json({ error: 'Etapa não encontrada' });
  }
  if (!stage.active) {
    return res.status(422).json({ error: 'Não é possível criar demandas em uma etapa inativa' });
  }

  // Validar cliente
  const client = await prisma.client.findFirst({ where: { id: data.clientId, deletedAt: null } });
  if (!client) {
    return res.status(422).json({ error: 'Cliente não encontrado ou inativo' });
  }

  // Validar responsável se informado
  let ownerIdToSet: string | null = null;
  if (data.ownerId && data.ownerId.trim()) {
    const owner = await prisma.user.findUnique({
      where: { id: data.ownerId },
      select: { id: true, active: true },
    });
    if (!owner) {
      return res.status(400).json({ error: 'Responsável não encontrado' });
    }
    if (!owner.active) {
      return res.status(400).json({ error: 'Não é possível atribuir demanda a um usuário inativo' });
    }
    ownerIdToSet = owner.id;
  }

  const task = await prisma.operationalTask.create({
    data: {
      clientId: data.clientId,
      stageId: data.stageId,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      priority: data.priority,
      dueDate: data.dueDate || null,
      ownerId: ownerIdToSet,
    },
    include: taskInclude,
  });

  return res.status(201).json(task);
});

// PATCH /api/operational-tasks/:id
operationalTasksRouter.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = updateTaskSchema.parse(req.body);

  const existing = await prisma.operationalTask.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    return res.status(404).json({ error: 'Demanda não encontrada' });
  }

  // Validar nova etapa se informada
  if (data.stageId !== undefined) {
    const stage = await prisma.operationalStage.findUnique({ where: { id: data.stageId } });
    if (!stage) {
      return res.status(422).json({ error: 'Etapa não encontrada' });
    }
    if (!stage.active) {
      return res.status(422).json({ error: 'Não é possível mover demanda para uma etapa inativa' });
    }
  }

  // Validar novo cliente se informado
  if (data.clientId !== undefined) {
    const client = await prisma.client.findFirst({ where: { id: data.clientId, deletedAt: null } });
    if (!client) {
      return res.status(422).json({ error: 'Cliente não encontrado ou inativo' });
    }
  }

  // Validar responsável
  let ownerIdToSet: string | null | undefined = undefined;
  if (data.ownerId !== undefined) {
    if (data.ownerId && data.ownerId.trim()) {
      const owner = await prisma.user.findUnique({
        where: { id: data.ownerId },
        select: { id: true, active: true },
      });
      if (!owner) {
        return res.status(400).json({ error: 'Responsável não encontrado' });
      }
      if (!owner.active) {
        return res.status(400).json({ error: 'Não é possível atribuir demanda a um usuário inativo' });
      }
      ownerIdToSet = owner.id;
    } else {
      ownerIdToSet = null;
    }
  }

  const updated = await prisma.operationalTask.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
      ...(data.stageId !== undefined ? { stageId: data.stageId } : {}),
      ...(data.clientId !== undefined ? { clientId: data.clientId } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate || null } : {}),
      ...(ownerIdToSet !== undefined ? { ownerId: ownerIdToSet } : {}),
    },
    include: taskInclude,
  });

  return res.json(updated);
});

// PATCH /api/operational-tasks/:id/stage — mover card (espelha clients.ts)
operationalTasksRouter.patch('/:id/stage', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { stageId } = changeStageSchema.parse(req.body);

  const existing = await prisma.operationalTask.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    return res.status(404).json({ error: 'Demanda não encontrada' });
  }

  const stage = await prisma.operationalStage.findUnique({ where: { id: stageId } });
  if (!stage) {
    return res.status(422).json({ error: 'Etapa não encontrada' });
  }
  if (!stage.active) {
    return res.status(422).json({ error: 'Não é possível mover demanda para uma etapa inativa' });
  }

  const updated = await prisma.operationalTask.update({
    where: { id },
    data: { stageId },
    include: taskInclude,
  });

  return res.json(updated);
});

// DELETE /api/operational-tasks/:id — soft delete
operationalTasksRouter.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.operationalTask.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    return res.status(404).json({ error: 'Demanda não encontrada' });
  }

  await prisma.operationalTask.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return res.json({ success: true, message: 'Demanda excluída com sucesso' });
});
