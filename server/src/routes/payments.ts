import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import {
  PAYMENT_STATUSES,
  PAYMENT_METHODS,
  validatePaymentSettlement,
  PaymentMethod,
} from '../domain/billing.js';
import {
  getTodayCivilDate,
  getCurrentReferenceMonth,
  getEffectivePaymentStatus,
} from '../domain/dates.js';
import { getNextPaymentNumbers } from '../services/billingService.js';

export const paymentsRouter = Router();

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const monthRegex = /^\d{4}-\d{2}$/;

const createPaymentSchema = z.object({
  contractId: z.string().uuid('ID de contrato inválido'),
  referenceMonth: z.string().regex(monthRegex, 'Mês de referência deve estar no formato YYYY-MM'),
  dueDate: z.string().regex(dateRegex, 'Data de vencimento deve estar no formato YYYY-MM-DD'),
  amountCents: z.number().int().min(0, 'Valor deve ser maior ou igual a zero'),
  notes: z.string().optional().nullable(),
  status: z.enum(PAYMENT_STATUSES).default('Pendente'),
  paidDate: z.string().regex(dateRegex).optional().nullable(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional().nullable(),
});

const updatePaymentSchema = z.object({
  status: z.enum(PAYMENT_STATUSES).optional(),
  paidDate: z.string().regex(dateRegex).optional().nullable().or(z.literal('')),
  paymentMethod: z.enum(PAYMENT_METHODS).optional().nullable().or(z.literal('')),
  amountCents: z.number().int().min(0).optional(),
  notes: z.string().optional().nullable(),
  dueDate: z.string().regex(dateRegex).optional(),
  referenceMonth: z.string().regex(monthRegex).optional(),
});

// GET /api/payments - Listagem paginada de cobranças com filtros e resumo (RF-27, RF-28, RF-32)
paymentsRouter.get('/', async (req: Request, res: Response) => {
  const {
    page = '1',
    limit = '25',
    status,
    referenceMonth,
    clientId,
    contractId,
    search,
  } = req.query;

  const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 25));
  const skip = (pageNum - 1) * limitNum;

  const today = getTodayCivilDate();
  const currentMonth = getCurrentReferenceMonth();

  const where: any = {
    contract: {
      deletedAt: null,
    },
  };

  if (contractId && typeof contractId === 'string' && contractId !== 'all') {
    where.contractId = contractId;
  }

  if (clientId && typeof clientId === 'string' && clientId !== 'all') {
    where.contract = {
      ...where.contract,
      clientId,
    };
  }

  if (referenceMonth && typeof referenceMonth === 'string' && referenceMonth !== 'all') {
    where.referenceMonth = referenceMonth;
  }

  // Tratamento de filtro por status (RF-28: "Atrasado" é derivado)
  if (status && typeof status === 'string' && status !== 'all') {
    if (status === 'Atrasado') {
      where.status = 'Pendente';
      where.dueDate = { lt: today };
    } else if (status === 'Pendente') {
      where.status = 'Pendente';
      where.dueDate = { gte: today };
    } else if (status === 'Pago' || status === 'Cancelado') {
      where.status = status;
    }
  }

  if (search && typeof search === 'string' && search.trim()) {
    const term = search.trim();
    where.OR = [
      { number: { contains: term, mode: 'insensitive' } },
      { contract: { client: { name: { contains: term, mode: 'insensitive' } } } },
      { contract: { client: { tradeName: { contains: term, mode: 'insensitive' } } } },
    ];
  }

  const [total, payments, allMonthPayments] = await Promise.all([
    prisma.paymentRecord.count({ where }),
    prisma.paymentRecord.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        contract: {
          select: {
            id: true,
            serviceType: true,
            billingType: true,
            valueCents: true,
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
          },
        },
        invoices: {
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
      },
    }),
    // Busca registros para o sumário do mês
    prisma.paymentRecord.findMany({
      where: {
        contract: { deletedAt: null },
        OR: [
          { referenceMonth: currentMonth },
          { paidDate: { startsWith: currentMonth } },
          { status: 'Pendente', dueDate: { lt: today } },
        ],
      },
      select: {
        referenceMonth: true,
        dueDate: true,
        paidDate: true,
        amountCents: true,
        status: true,
      },
    }),
  ]);

  // Cálculo de KPIs do mês
  let totalInvoicedCents = 0;
  let totalReceivedCents = 0;
  let overdueCents = 0;
  let overdueCount = 0;

  for (const p of allMonthPayments) {
    if (p.status !== 'Cancelado') {
      // Competência: faturado no mês
      if (p.referenceMonth === currentMonth) {
        totalInvoicedCents += p.amountCents;
      }
      // Caixa: recebido no mês
      if (p.status === 'Pago' && p.paidDate && p.paidDate.startsWith(currentMonth)) {
        totalReceivedCents += p.amountCents;
      }
    }
    // Inadimplência
    if (p.status === 'Pendente' && p.dueDate < today) {
      overdueCents += p.amountCents;
      overdueCount++;
    }
  }

  // Enriquece os dados com status efetivo
  const enrichedData = payments.map((p) => ({
    ...p,
    effectiveStatus: getEffectivePaymentStatus(p.status, p.dueDate, today),
  }));

  return res.json({
    data: enrichedData,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum) || 1,
    summary: {
      invoicedCents: totalInvoicedCents,
      receivedCents: totalReceivedCents,
      overdueCents,
      overdueCount,
      currentMonth,
    },
  });
});

// GET /api/payments/:id - Detalhes da cobrança
paymentsRouter.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const payment = await prisma.paymentRecord.findUnique({
    where: { id },
    include: {
      contract: {
        include: {
          client: true,
        },
      },
      invoices: {
        orderBy: { uploadedAt: 'desc' },
      },
    },
  });

  if (!payment) {
    return res.status(404).json({ error: 'Cobrança não encontrada.' });
  }

  const today = getTodayCivilDate();
  return res.json({
    ...payment,
    effectiveStatus: getEffectivePaymentStatus(payment.status, payment.dueDate, today),
  });
});

// POST /api/payments - Criação de cobrança avulsa manual
paymentsRouter.post('/', async (req: Request, res: Response) => {
  const parseResult = createPaymentSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: parseResult.error.errors[0]?.message || 'Dados da cobrança inválidos',
      details: parseResult.error.errors,
    });
  }
  const data = parseResult.data;

  // Valida existência do contrato
  const contract = await prisma.contract.findFirst({
    where: { id: data.contractId, deletedAt: null },
  });

  if (!contract) {
    return res.status(404).json({ error: 'Contrato não encontrado ou excluído.' });
  }

  // Se estiver marcando como pago, valida dados de baixa (RF-29)
  if (data.status === 'Pago') {
    const settlementValidation = validatePaymentSettlement({
      paidDate: data.paidDate,
      paymentMethod: data.paymentMethod,
      amountCents: data.amountCents,
    });
    if (!settlementValidation.valid) {
      return res.status(400).json({ error: settlementValidation.error });
    }
  }

  const today = getTodayCivilDate();
  const currentYear = parseInt(today.slice(0, 4), 10);

  const payment = await prisma.$transaction(async (tx) => {
    // Aloca número COB-AAAA-NNNN com lock de linha (RF-32)
    const [number] = await getNextPaymentNumbers(tx, currentYear, 1);

    return tx.paymentRecord.create({
      data: {
        contractId: data.contractId,
        number,
        referenceMonth: data.referenceMonth,
        dueDate: data.dueDate,
        amountCents: data.amountCents,
        status: data.status,
        paidDate: data.status === 'Pago' ? data.paidDate : null,
        paymentMethod: data.status === 'Pago' ? data.paymentMethod : null,
        notes: data.notes?.trim() || null,
      },
      include: {
        contract: {
          include: { client: true },
        },
        invoices: true,
      },
    });
  });

  return res.status(201).json(payment);
});

// PATCH /api/payments/:id - Baixa manual, cancelamento ou edição (RF-29, RF-32)
paymentsRouter.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const parseResult = updatePaymentSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: parseResult.error.errors[0]?.message || 'Dados de atualização inválidos',
      details: parseResult.error.errors,
    });
  }
  const data = parseResult.data;

  const existingPayment = await prisma.paymentRecord.findUnique({
    where: { id },
  });

  if (!existingPayment) {
    return res.status(404).json({ error: 'Cobrança não encontrada.' });
  }

  const updatePayload: any = {};

  if (data.notes !== undefined) {
    updatePayload.notes = data.notes?.trim() || null;
  }
  if (data.dueDate !== undefined) {
    updatePayload.dueDate = data.dueDate;
  }
  if (data.referenceMonth !== undefined) {
    updatePayload.referenceMonth = data.referenceMonth;
  }
  if (data.amountCents !== undefined) {
    updatePayload.amountCents = data.amountCents;
  }

  // Baixa manual de pagamento (RF-29)
  const isMarkingPaid =
    data.status === 'Pago' ||
    (data.paidDate && data.paymentMethod && data.status !== 'Cancelado' && data.status !== 'Pendente');

  if (isMarkingPaid) {
    const effectivePaidDate = data.paidDate || existingPayment.paidDate || getTodayCivilDate();
    const effectiveMethod = (data.paymentMethod || existingPayment.paymentMethod) as PaymentMethod;
    const effectiveAmount = data.amountCents !== undefined ? data.amountCents : existingPayment.amountCents;

    const validation = validatePaymentSettlement({
      paidDate: effectivePaidDate,
      paymentMethod: effectiveMethod,
      amountCents: effectiveAmount,
    });

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    updatePayload.status = 'Pago';
    updatePayload.paidDate = effectivePaidDate;
    updatePayload.paymentMethod = effectiveMethod;
  } else if (data.status === 'Cancelado') {
    // Cancelamento (RF-32: número não é liberado nem reaproveitado)
    updatePayload.status = 'Cancelado';
  } else if (data.status === 'Pendente') {
    updatePayload.status = 'Pendente';
    updatePayload.paidDate = null;
    updatePayload.paymentMethod = null;
  }

  const updatedPayment = await prisma.paymentRecord.update({
    where: { id },
    data: updatePayload,
    include: {
      contract: {
        include: { client: true },
      },
      invoices: {
        orderBy: { uploadedAt: 'desc' },
      },
    },
  });

  const today = getTodayCivilDate();
  return res.json({
    ...updatedPayment,
    effectiveStatus: getEffectivePaymentStatus(
      updatedPayment.status,
      updatedPayment.dueDate,
      today
    ),
  });
});
