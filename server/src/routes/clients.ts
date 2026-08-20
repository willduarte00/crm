import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import {
  cleanDigits,
  validateDocument,
  normalizePhoneE164,
  isValidPhoneBR,
  LEAD_SOURCES,
  PIPELINE_STAGES,
  PRIORITIES,
  DOCUMENT_TYPES,
  LeadSource,
  PipelineStage,
  Priority,
  DocumentType,
} from '../domain/clients.js';

export const clientsRouter = Router();

const createClientSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  tradeName: z.string().optional().nullable(),
  documentType: z.enum(DOCUMENT_TYPES, {
    errorMap: () => ({ message: 'Tipo de documento deve ser CPF ou CNPJ' }),
  }),
  documentNumber: z.string().min(1, 'Número do documento é obrigatório'),
  email: z.string().email('E-mail inválido').optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable().or(z.literal('')),
  leadSource: z.enum(LEAD_SOURCES, {
    errorMap: () => ({ message: 'Origem do lead inválida' }),
  }),
  stage: z.enum(PIPELINE_STAGES).default('Novo Lead'),
  priority: z.enum(PRIORITIES).default('media'),
  ownerId: z.string().uuid('ID de responsável inválido').optional().nullable().or(z.literal('')),
  notes: z.string().optional().nullable(),
});

const updateClientSchema = z.object({
  name: z.string().min(1).optional(),
  tradeName: z.string().optional().nullable(),
  documentType: z.enum(DOCUMENT_TYPES).optional(),
  documentNumber: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable().or(z.literal('')),
  leadSource: z.enum(LEAD_SOURCES).optional(),
  stage: z.enum(PIPELINE_STAGES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  ownerId: z.string().uuid('ID de responsável inválido').optional().nullable().or(z.literal('')),
  notes: z.string().optional().nullable(),
});

const changeStageSchema = z.object({
  stage: z.enum(PIPELINE_STAGES, {
    errorMap: () => ({ message: 'Etapa do funil inválida' }),
  }),
});

const changeOwnerSchema = z.object({
  ownerId: z.string().uuid('ID de responsável inválido').optional().nullable().or(z.literal('')),
});

const batchReassignSchema = z.object({
  clientIds: z.array(z.string().uuid()).min(1, 'Pelo menos um cliente deve ser selecionado'),
  newOwnerId: z.string().uuid('ID do novo responsável inválido').optional().nullable().or(z.literal('')),
});

const createLogSchema = z.object({
  content: z.string().min(1, 'Conteúdo da anotação é obrigatório'),
  type: z.string().default('anotacao'),
});

// GET /api/clients - Listagem paginada com busca e filtros (RF-01 a RF-06c)
clientsRouter.get('/', async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.max(1, Math.min(1000, parseInt(req.query.limit as string, 10) || 25));
  const skip = (page - 1) * limit;

  const { search, stage, leadSource, serviceType, ownerId, priority } = req.query;

  const where: any = {
    deletedAt: null,
  };

  // Filtro de busca textual
  if (search && typeof search === 'string' && search.trim()) {
    const term = search.trim();
    const cleanTerm = cleanDigits(term);

    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { tradeName: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
      { notes: { contains: term, mode: 'insensitive' } },
    ];

    if (cleanTerm) {
      where.OR.push(
        { documentNumber: { contains: cleanTerm } },
        { phone: { contains: cleanTerm } }
      );
    }
  }

  // Filtro por Etapa (RF-04)
  if (stage && typeof stage === 'string' && stage !== 'all') {
    where.stage = stage;
  }

  // Filtro por Origem (RF-03)
  if (leadSource && typeof leadSource === 'string' && leadSource !== 'all') {
    where.leadSource = leadSource;
  }

  // Filtro por Prioridade (RF-06b)
  if (priority && typeof priority === 'string' && priority !== 'all') {
    where.priority = priority;
  }

  // Filtro por Serviço (RF-10)
  if (serviceType && typeof serviceType === 'string' && serviceType !== 'all') {
    where.contracts = {
      some: {
        serviceType: serviceType,
        deletedAt: null,
      },
    };
  }

  // Filtro por Responsável (RF-06a, RF-06c)
  if (ownerId && typeof ownerId === 'string' && ownerId !== 'all') {
    if (ownerId === 'unassigned' || ownerId === 'none') {
      where.ownerId = null;
    } else if (ownerId === 'inactive') {
      // Responsável inativo (RF-06c)
      where.owner = {
        active: false,
      };
    } else {
      where.ownerId = ownerId;
    }
  }

  const [total, clients] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            active: true,
            role: true,
          },
        },
        _count: {
          select: {
            contracts: true,
            interactionLogs: true,
          },
        },
      },
    }),
  ]);

  return res.json({
    data: clients,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
});

// POST /api/clients - Criar cliente/lead (RF-01 a RF-06c)
clientsRouter.post('/', async (req: Request, res: Response) => {
  const data = createClientSchema.parse(req.body);

  const cleanDoc = cleanDigits(data.documentNumber);
  if (!validateDocument(cleanDoc, data.documentType)) {
    return res.status(400).json({
      error: `Número de ${data.documentType} inválido (falha na validação de dígitos verificadores)`,
      details: [{ path: 'documentNumber', message: 'Dígito verificador inválido' }],
    });
  }

  // Validação e normalização de telefone (RF-02)
  let normalizedPhone: string | null = null;
  if (data.phone && data.phone.trim()) {
    normalizedPhone = normalizePhoneE164(data.phone);
    if (!isValidPhoneBR(normalizedPhone)) {
      return res.status(400).json({
        error: 'Telefone inválido. Informe DDD + número (celular de 9 ou fixo de 8 dígitos)',
        details: [{ path: 'phone', message: 'Formato de telefone brasileiro inválido' }],
      });
    }
  }

  // Validação do responsável (RF-06a: se informado, deve ser usuário ativo)
  let ownerIdToSet: string | null = null;
  if (data.ownerId && data.ownerId.trim()) {
    const owner = await prisma.user.findUnique({
      where: { id: data.ownerId },
      select: { id: true, active: true },
    });

    if (!owner) {
      return res.status(400).json({ error: 'Responsável selecionado não encontrado' });
    }

    if (!owner.active) {
      return res.status(400).json({ error: 'Não é possível atribuir lead a um usuário inativo' });
    }

    ownerIdToSet = owner.id;
  }

  const client = await prisma.client.create({
    data: {
      name: data.name.trim(),
      tradeName: data.tradeName?.trim() || null,
      documentType: data.documentType,
      documentNumber: cleanDoc,
      email: data.email?.trim() || null,
      phone: normalizedPhone,
      leadSource: data.leadSource,
      stage: data.stage,
      priority: data.priority,
      ownerId: ownerIdToSet,
      notes: data.notes?.trim() || null,
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          active: true,
          role: true,
        },
      },
    },
  });

  return res.status(201).json(client);
});

// POST /api/clients/batch-reassign - Reatribuição em lote (RF-06c)
clientsRouter.post('/batch-reassign', async (req: Request, res: Response) => {
  const { clientIds, newOwnerId } = batchReassignSchema.parse(req.body);

  let ownerIdToSet: string | null = null;
  if (newOwnerId && newOwnerId.trim()) {
    const targetUser = await prisma.user.findUnique({
      where: { id: newOwnerId },
      select: { id: true, active: true },
    });

    if (!targetUser) {
      return res.status(400).json({ error: 'Novo responsável não encontrado' });
    }

    if (!targetUser.active) {
      return res.status(400).json({ error: 'Novo responsável deve ser um usuário ativo' });
    }

    ownerIdToSet = targetUser.id;
  }

  const result = await prisma.client.updateMany({
    where: {
      id: { in: clientIds },
      deletedAt: null,
    },
    data: {
      ownerId: ownerIdToSet,
    },
  });

  return res.json({
    success: true,
    updatedCount: result.count,
  });
});

// GET /api/clients/:id - Detalhes do cliente
clientsRouter.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const client = await prisma.client.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          active: true,
          role: true,
        },
      },
      interactionLogs: {
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      },
      _count: {
        select: {
          contracts: true,
          interactionLogs: true,
        },
      },
    },
  });

  if (!client) {
    return res.status(404).json({ error: 'Cliente não encontrado' });
  }

  return res.json(client);
});

// PATCH /api/clients/:id - Atualizar cliente
clientsRouter.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = updateClientSchema.parse(req.body);

  const existingClient = await prisma.client.findFirst({
    where: { id, deletedAt: null },
  });

  if (!existingClient) {
    return res.status(404).json({ error: 'Cliente não encontrado' });
  }

  const updatePayload: any = {};

  if (data.name !== undefined) updatePayload.name = data.name.trim();
  if (data.tradeName !== undefined) updatePayload.tradeName = data.tradeName?.trim() || null;
  if (data.leadSource !== undefined) updatePayload.leadSource = data.leadSource;
  if (data.stage !== undefined) updatePayload.stage = data.stage;
  if (data.priority !== undefined) updatePayload.priority = data.priority;
  if (data.notes !== undefined) updatePayload.notes = data.notes?.trim() || null;
  if (data.email !== undefined) updatePayload.email = data.email?.trim() || null;

  // Validação de documento se alterado
  const newDocType = data.documentType || existingClient.documentType;
  const newDocNumber = data.documentNumber !== undefined ? cleanDigits(data.documentNumber) : existingClient.documentNumber;

  if (data.documentType !== undefined || data.documentNumber !== undefined) {
    if (!validateDocument(newDocNumber, newDocType)) {
      return res.status(400).json({
        error: `Número de ${newDocType} inválido (falha na validação de dígitos verificadores)`,
        details: [{ path: 'documentNumber', message: 'Dígito verificador inválido' }],
      });
    }
    updatePayload.documentType = newDocType;
    updatePayload.documentNumber = newDocNumber;
  }

  // Validação de telefone se alterado
  if (data.phone !== undefined) {
    if (data.phone && data.phone.trim()) {
      const normalizedPhone = normalizePhoneE164(data.phone);
      if (!isValidPhoneBR(normalizedPhone)) {
        return res.status(400).json({
          error: 'Telefone inválido. Informe DDD + número (celular de 9 ou fixo de 8 dígitos)',
          details: [{ path: 'phone', message: 'Formato de telefone brasileiro inválido' }],
        });
      }
      updatePayload.phone = normalizedPhone;
    } else {
      updatePayload.phone = null;
    }
  }

  // Validação de responsável se alterado
  if (data.ownerId !== undefined) {
    if (data.ownerId && data.ownerId.trim()) {
      const owner = await prisma.user.findUnique({
        where: { id: data.ownerId },
        select: { id: true, active: true },
      });

      if (!owner) {
        return res.status(400).json({ error: 'Responsável selecionado não encontrado' });
      }

      if (!owner.active) {
        return res.status(400).json({ error: 'Não é possível atribuir lead a um usuário inativo' });
      }

      updatePayload.ownerId = owner.id;
    } else {
      updatePayload.ownerId = null;
    }
  }

  const updatedClient = await prisma.client.update({
    where: { id },
    data: updatePayload,
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          active: true,
          role: true,
        },
      },
    },
  });

  return res.json(updatedClient);
});

// DELETE /api/clients/:id - Soft delete (RF-01, deletedAt)
clientsRouter.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const existingClient = await prisma.client.findFirst({
    where: { id, deletedAt: null },
  });

  if (!existingClient) {
    return res.status(404).json({ error: 'Cliente não encontrado' });
  }

  await prisma.client.update({
    where: { id },
    data: {
      deletedAt: new Date(),
    },
  });

  return res.json({
    success: true,
    message: 'Cliente excluído com sucesso',
  });
});

// PATCH /api/clients/:id/stage - Mudar etapa do funil (RF-05)
clientsRouter.patch('/:id/stage', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { stage } = changeStageSchema.parse(req.body);

  const existingClient = await prisma.client.findFirst({
    where: { id, deletedAt: null },
  });

  if (!existingClient) {
    return res.status(404).json({ error: 'Cliente não encontrado' });
  }

  const updatedClient = await prisma.client.update({
    where: { id },
    data: { stage },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          active: true,
          role: true,
        },
      },
    },
  });

  return res.json(updatedClient);
});

// PATCH /api/clients/:id/owner - Atribuir ou remover responsável (RF-06a)
clientsRouter.patch('/:id/owner', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { ownerId } = changeOwnerSchema.parse(req.body);

  const existingClient = await prisma.client.findFirst({
    where: { id, deletedAt: null },
  });

  if (!existingClient) {
    return res.status(404).json({ error: 'Cliente não encontrado' });
  }

  let ownerIdToSet: string | null = null;
  if (ownerId && ownerId.trim()) {
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { id: true, active: true },
    });

    if (!owner) {
      return res.status(400).json({ error: 'Responsável selecionado não encontrado' });
    }

    if (!owner.active) {
      return res.status(400).json({ error: 'Não é possível atribuir lead a um usuário inativo' });
    }

    ownerIdToSet = owner.id;
  }

  const updatedClient = await prisma.client.update({
    where: { id },
    data: { ownerId: ownerIdToSet },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          active: true,
          role: true,
        },
      },
    },
  });

  return res.json(updatedClient);
});

// GET /api/clients/:id/logs - Timeline de anotações (RF-06)
clientsRouter.get('/:id/logs', async (req: Request, res: Response) => {
  const { id } = req.params;

  const client = await prisma.client.findFirst({
    where: { id, deletedAt: null },
  });

  if (!client) {
    return res.status(404).json({ error: 'Cliente não encontrado' });
  }

  const logs = await prisma.interactionLog.findMany({
    where: { clientId: id },
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  return res.json(logs);
});

// POST /api/clients/:id/logs - Registrar anotação na timeline (RF-06)
clientsRouter.post('/:id/logs', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { content, type } = createLogSchema.parse(req.body);

  const client = await prisma.client.findFirst({
    where: { id, deletedAt: null },
  });

  if (!client) {
    return res.status(404).json({ error: 'Cliente não encontrado' });
  }

  const log = await prisma.interactionLog.create({
    data: {
      clientId: id,
      userId: req.user!.id,
      type,
      content: content.trim(),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  return res.status(201).json(log);
});
