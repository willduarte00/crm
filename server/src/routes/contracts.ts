import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import {
  SERVICE_TYPES,
  BILLING_TYPES,
  CONTRACT_STATUSES,
  validateContractBilling,
} from '../domain/contracts.js';
import {
  ensurePaymentRecords,
  createPontualContractPayments,
} from '../services/billingService.js';

import { requirePermission } from '../middlewares/requirePermission.js';

export const contractsRouter = Router();

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const createContractSchema = z.object({
  clientId: z.string().uuid('ID de cliente inválido'),
  serviceType: z.enum(SERVICE_TYPES, {
    errorMap: () => ({ message: 'Tipo de serviço inválido' }),
  }),
  description: z.string().optional().nullable(),
  billingType: z.enum(BILLING_TYPES, {
    errorMap: () => ({ message: 'Tipo de cobrança deve ser "recorrente" ou "pontual"' }),
  }),
  valueCents: z.number().int().min(0, 'Valor deve ser maior ou igual a zero'),
  billingDay: z.number().int().min(1).max(31).optional().nullable(),
  billingPeriodMonths: z.number().int().min(1).optional().nullable().default(1),
  installments: z.number().int().min(1).optional().nullable(),
  startDate: z.string().regex(dateRegex, 'Data de início deve estar no formato YYYY-MM-DD'),
  endDate: z.string().regex(dateRegex, 'Data de término deve estar no formato YYYY-MM-DD').optional().nullable().or(z.literal('')),
  status: z.enum(CONTRACT_STATUSES).default('ativo'),
});

const updateContractSchema = z.object({
  serviceType: z.enum(SERVICE_TYPES).optional(),
  description: z.string().optional().nullable(),
  billingType: z.enum(BILLING_TYPES).optional(),
  valueCents: z.number().int().min(0).optional(),
  billingDay: z.number().int().min(1).max(31).optional().nullable(),
  billingPeriodMonths: z.number().int().min(1).optional().nullable(),
  installments: z.number().int().min(1).optional().nullable(),
  startDate: z.string().regex(dateRegex).optional(),
  endDate: z.string().regex(dateRegex).optional().nullable().or(z.literal('')),
  status: z.enum(CONTRACT_STATUSES).optional(),
});

// GET /api/contracts - Listagem de contratos com filtros
contractsRouter.get('/', requirePermission('contracts.view'), async (req: Request, res: Response) => {
  const { clientId, serviceType, status, billingType, search } = req.query;

  const where: any = {
    deletedAt: null,
  };

  if (clientId && typeof clientId === 'string' && clientId !== 'all') {
    where.clientId = clientId;
  }

  if (serviceType && typeof serviceType === 'string' && serviceType !== 'all') {
    where.serviceType = serviceType;
  }

  if (status && typeof status === 'string' && status !== 'all') {
    where.status = status;
  }

  if (billingType && typeof billingType === 'string' && billingType !== 'all') {
    where.billingType = billingType;
  }

  if (search && typeof search === 'string' && search.trim()) {
    const term = search.trim();
    where.OR = [
      { description: { contains: term, mode: 'insensitive' } },
      { client: { name: { contains: term, mode: 'insensitive' } } },
      { client: { tradeName: { contains: term, mode: 'insensitive' } } },
    ];
  }

  const contracts = await prisma.contract.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          tradeName: true,
          documentType: true,
          documentNumber: true,
          phone: true,
          email: true,
        },
      },
      files: {
        orderBy: { uploadedAt: 'desc' },
        select: {
          id: true,
          storedName: true,
          originalName: true,
          fileSize: true,
          mimeType: true,
          uploadedAt: true,
        },
      },
      _count: {
        select: {
          paymentRecords: true,
        },
      },
    },
  });

  return res.json(contracts);
});

// POST /api/contracts - Criação de contrato (RF-10 a RF-13)
contractsRouter.post('/', requirePermission('contracts.create'), async (req: Request, res: Response) => {
  const parseResult = createContractSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: parseResult.error.errors[0]?.message || 'Dados do contrato inválidos',
      details: parseResult.error.errors,
    });
  }
  const data = parseResult.data;

  // Valida existência do cliente
  const client = await prisma.client.findFirst({
    where: { id: data.clientId, deletedAt: null },
  });

  if (!client) {
    return res.status(404).json({ error: 'Cliente não encontrado ou excluído.' });
  }

  // Validação pura de regras de cobrança (RF-11, RF-11a)
  const validation = validateContractBilling({
    billingType: data.billingType,
    billingDay: data.billingDay,
    billingPeriodMonths: data.billingPeriodMonths,
    installments: data.installments,
  });

  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const contract = await prisma.$transaction(async (tx) => {
    const created = await tx.contract.create({
      data: {
        clientId: data.clientId,
        serviceType: data.serviceType,
        description: data.description?.trim() || null,
        billingType: data.billingType,
        valueCents: data.valueCents,
        billingDay: data.billingType === 'recorrente' ? data.billingDay : null,
        billingPeriodMonths:
          data.billingType === 'recorrente' ? data.billingPeriodMonths || 1 : null,
        installments: data.billingType === 'pontual' ? data.installments : null,
        startDate: data.startDate,
        endDate: data.endDate && data.endDate.trim() ? data.endDate.trim() : null,
        status: data.status,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            tradeName: true,
            documentType: true,
            documentNumber: true,
          },
        },
        files: true,
      },
    });

    // Se for contrato pontual, materializa as N parcelas de imediato (RF-26)
    if (data.billingType === 'pontual' && data.installments && data.installments >= 1) {
      await createPontualContractPayments(tx, created.id, {
        startDate: data.startDate,
        valueCents: data.valueCents,
        installments: data.installments,
        billingDay: data.billingDay,
      });
    }

    return created;
  });

  return res.status(201).json(contract);
});

// GET /api/contracts/:id/payments - Dispara ensurePaymentRecords e lista cobranças do contrato (RF-20)
contractsRouter.get('/:id/payments', requirePermission('contracts.view'), async (req: Request, res: Response) => {
  const { id } = req.params;

  const contract = await prisma.contract.findFirst({
    where: { id, deletedAt: null },
  });

  if (!contract) {
    return res.status(404).json({ error: 'Contrato não encontrado.' });
  }

  const payments = await ensurePaymentRecords(id);
  return res.json(payments);
});

// GET /api/contracts/:id - Detalhes do contrato
contractsRouter.get('/:id', requirePermission('contracts.view'), async (req: Request, res: Response) => {
  const { id } = req.params;

  const contract = await prisma.contract.findFirst({
    where: { id, deletedAt: null },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          tradeName: true,
          documentType: true,
          documentNumber: true,
          phone: true,
          email: true,
        },
      },
      files: {
        orderBy: { uploadedAt: 'desc' },
      },
      _count: {
        select: {
          paymentRecords: true,
        },
      },
    },
  });

  if (!contract) {
    return res.status(404).json({ error: 'Contrato não encontrado.' });
  }

  return res.json(contract);
});

// PATCH /api/contracts/:id - Atualização de contrato
contractsRouter.patch('/:id', requirePermission('contracts.update'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const parseResult = updateContractSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: parseResult.error.errors[0]?.message || 'Dados de atualização inválidos',
      details: parseResult.error.errors,
    });
  }
  const data = parseResult.data;

  const existingContract = await prisma.contract.findFirst({
    where: { id, deletedAt: null },
  });

  if (!existingContract) {
    return res.status(404).json({ error: 'Contrato não encontrado.' });
  }

  const effectiveBillingType = data.billingType || existingContract.billingType;
  const effectiveBillingDay =
    data.billingDay !== undefined ? data.billingDay : existingContract.billingDay;
  const effectiveBillingPeriodMonths =
    data.billingPeriodMonths !== undefined
      ? data.billingPeriodMonths
      : existingContract.billingPeriodMonths;
  const effectiveInstallments =
    data.installments !== undefined ? data.installments : existingContract.installments;

  // Validação pura de regras de cobrança se algum campo de faturamento foi alterado
  if (
    data.billingType !== undefined ||
    data.billingDay !== undefined ||
    data.billingPeriodMonths !== undefined ||
    data.installments !== undefined
  ) {
    const validation = validateContractBilling({
      billingType: effectiveBillingType,
      billingDay: effectiveBillingDay,
      billingPeriodMonths: effectiveBillingPeriodMonths,
      installments: effectiveInstallments,
    });

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
  }

  const updatePayload: any = {};

  if (data.serviceType !== undefined) updatePayload.serviceType = data.serviceType;
  if (data.description !== undefined)
    updatePayload.description = data.description?.trim() || null;
  if (data.valueCents !== undefined) updatePayload.valueCents = data.valueCents;
  if (data.startDate !== undefined) updatePayload.startDate = data.startDate;
  if (data.endDate !== undefined)
    updatePayload.endDate = data.endDate && data.endDate.trim() ? data.endDate.trim() : null;
  if (data.status !== undefined) updatePayload.status = data.status;

  if (data.billingType !== undefined) {
    updatePayload.billingType = data.billingType;
    if (data.billingType === 'recorrente') {
      updatePayload.billingDay = effectiveBillingDay;
      updatePayload.billingPeriodMonths = effectiveBillingPeriodMonths || 1;
      updatePayload.installments = null;
    } else {
      updatePayload.billingDay = null;
      updatePayload.billingPeriodMonths = null;
      updatePayload.installments = effectiveInstallments;
    }
  } else {
    if (data.billingDay !== undefined) updatePayload.billingDay = data.billingDay;
    if (data.billingPeriodMonths !== undefined)
      updatePayload.billingPeriodMonths = data.billingPeriodMonths;
    if (data.installments !== undefined) updatePayload.installments = data.installments;
  }

  const updatedContract = await prisma.contract.update({
    where: { id },
    data: updatePayload,
    include: {
      client: {
        select: {
          id: true,
          name: true,
          tradeName: true,
          documentType: true,
          documentNumber: true,
        },
      },
      files: {
        orderBy: { uploadedAt: 'desc' },
      },
    },
  });

  return res.json(updatedContract);
});

// DELETE /api/contracts/:id - Soft delete
contractsRouter.delete('/:id', requirePermission('contracts.delete'), async (req: Request, res: Response) => {
  const { id } = req.params;

  const existingContract = await prisma.contract.findFirst({
    where: { id, deletedAt: null },
  });

  if (!existingContract) {
    return res.status(404).json({ error: 'Contrato não encontrado.' });
  }

  await prisma.contract.update({
    where: { id },
    data: {
      deletedAt: new Date(),
    },
  });

  return res.json({
    success: true,
    message: 'Contrato excluído com sucesso.',
  });
});
