import { Router, Request, Response } from 'express';
import { prisma } from '../prisma.js';
import { formatDocument, formatPhoneBR } from '../domain/clients.js';
import { getEffectivePaymentStatus, getTodayCivilDate } from '../domain/dates.js';

export const exportRouter = Router();

function escapeCsvField(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatCentsToBRL(cents: number): string {
  const num = (cents / 100).toFixed(2);
  return `R$ ${num.replace('.', ',')}`;
}

function formatDateCivilBR(dateStr: string | null | undefined): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr || '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function formatDateTimeBR(date: Date | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

// GET /api/export/clients - Exportação de clientes em CSV
exportRouter.get('/clients', async (_req: Request, res: Response) => {
  const clients = await prisma.client.findMany({
    where: { deletedAt: null },
    include: {
      owner: { select: { name: true } },
      contracts: {
        where: { deletedAt: null },
        select: { status: true, serviceType: true, billingType: true, valueCents: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  const headers = [
    'Nome',
    'Nome Fantasia',
    'Tipo Documento',
    'Documento',
    'E-mail',
    'Telefone',
    'Origem do Lead',
    'Etapa do Funil',
    'Prioridade',
    'Responsável',
    'Contratos Ativos',
    'Criado Em',
  ];

  const rows = clients.map((c) => {
    const activeContractsCount = c.contracts.filter((ct) => ct.status === 'ativo').length;
    return [
      escapeCsvField(c.name),
      escapeCsvField(c.tradeName),
      escapeCsvField(c.documentType),
      escapeCsvField(formatDocument(c.documentNumber, c.documentType as any)),
      escapeCsvField(c.email),
      escapeCsvField(formatPhoneBR(c.phone)),
      escapeCsvField(c.leadSource),
      escapeCsvField(c.stage),
      escapeCsvField(c.priority === 'alta' ? 'Alta' : c.priority === 'baixa' ? 'Baixa' : 'Média'),
      escapeCsvField(c.owner?.name || 'Sem responsável'),
      escapeCsvField(activeContractsCount),
      escapeCsvField(formatDateTimeBR(c.createdAt)),
    ].join(';');
  });

  const bom = '\uFEFF';
  const csvContent = bom + [headers.join(';'), ...rows].join('\r\n');
  const today = getTodayCivilDate();

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="clientes-${today}.csv"`
  );
  return res.send(csvContent);
});

// GET /api/export/payments - Exportação de cobranças em CSV
exportRouter.get('/payments', async (req: Request, res: Response) => {
  const { status, referenceMonth, search } = req.query;

  const today = getTodayCivilDate();
  const where: any = {
    contract: { deletedAt: null },
  };

  if (referenceMonth && typeof referenceMonth === 'string' && referenceMonth !== 'all') {
    where.referenceMonth = referenceMonth;
  }

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

  const payments = await prisma.paymentRecord.findMany({
    where,
    include: {
      contract: {
        include: {
          client: true,
        },
      },
    },
    orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
  });

  const headers = [
    'Número',
    'Cliente',
    'Documento',
    'Serviço',
    'Tipo de Cobrança',
    'Mês de Referência',
    'Vencimento',
    'Data de Pagamento',
    'Valor (R$)',
    'Status',
    'Forma de Pagamento',
    'Observações',
  ];

  const rows = payments.map((p) => {
    const client = p.contract.client;
    const effectiveStatus = getEffectivePaymentStatus(p.status, p.dueDate, today);

    return [
      escapeCsvField(p.number),
      escapeCsvField(client.tradeName || client.name),
      escapeCsvField(formatDocument(client.documentNumber, client.documentType as any)),
      escapeCsvField(p.contract.serviceType),
      escapeCsvField(p.contract.billingType === 'recorrente' ? 'Recorrente' : 'Pontual'),
      escapeCsvField(p.referenceMonth),
      escapeCsvField(formatDateCivilBR(p.dueDate)),
      escapeCsvField(formatDateCivilBR(p.paidDate)),
      escapeCsvField(formatCentsToBRL(p.amountCents)),
      escapeCsvField(effectiveStatus),
      escapeCsvField(p.paymentMethod || '-'),
      escapeCsvField(p.notes || ''),
    ].join(';');
  });

  const bom = '\uFEFF';
  const csvContent = bom + [headers.join(';'), ...rows].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="cobrancas-${today}.csv"`
  );
  return res.send(csvContent);
});
