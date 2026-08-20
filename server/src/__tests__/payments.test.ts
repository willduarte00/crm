import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../app.js';
import { prisma } from '../prisma.js';
import { env } from '../env.js';

vi.mock('../prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    client: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    contract: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    paymentRecord: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    paymentSequence: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRawUnsafe: vi.fn(),
  },
}));

describe('Cobranças e Pagamentos — Testes de Integração (RF-20 a RF-32)', () => {
  const activeUser = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'membro@agencia.com',
    name: 'Membro Teste',
    role: 'membro',
    active: true,
    mustChangePassword: false,
    tokenVersion: 0,
    passwordHash: 'hash',
    createdAt: new Date(),
  };

  const mockClient = {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'TechCorp Industries',
    tradeName: 'TechCorp',
    documentType: 'CNPJ',
    documentNumber: '11222333000181',
    email: 'financeiro@techcorp.com',
    phone: '5511987654321',
  };

  const mockContract = {
    id: '44444444-4444-4444-4444-444444444444',
    clientId: mockClient.id,
    serviceType: 'Social Media & Conteúdo',
    billingType: 'recorrente',
    valueCents: 250000,
    billingDay: 10,
    billingPeriodMonths: 1,
    startDate: '2026-01-01',
    endDate: null,
    status: 'ativo',
    client: mockClient,
    paymentRecords: [],
  };

  const mockPayment = {
    id: '55555555-5555-5555-5555-555555555555',
    contractId: mockContract.id,
    number: 'COB-2026-0001',
    referenceMonth: '2026-05',
    dueDate: '2026-05-10',
    paidDate: null,
    amountCents: 250000,
    status: 'Pendente',
    paymentMethod: null,
    notes: 'Cobrança mensal padrão',
    createdAt: new Date(),
    contract: mockContract,
    invoices: [],
  };

  const createToken = (user: { id: string; tokenVersion: number }) =>
    jwt.sign({ id: user.id, tokenVersion: user.tokenVersion }, env.JWT_SECRET, {
      expiresIn: '7d',
    });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. GET /api/payments - Deve listar cobranças paginadas com filtros', async () => {
    const token = createToken(activeUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser);
    vi.mocked(prisma.paymentRecord.count).mockResolvedValue(1);
    vi.mocked(prisma.paymentRecord.findMany).mockResolvedValue([mockPayment] as any);

    const res = await request(app)
      .get('/api/payments?page=1&limit=25&status=all')
      .set('Cookie', [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].number).toBe('COB-2026-0001');
    expect(res.body.data[0].effectiveStatus).toBeDefined();
    expect(res.body.summary).toBeDefined();
  });

  it('2. GET /api/payments/:id - Deve retornar os detalhes completos da cobrança', async () => {
    const token = createToken(activeUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser);
    vi.mocked(prisma.paymentRecord.findUnique).mockResolvedValue(mockPayment as any);

    const res = await request(app)
      .get(`/api/payments/${mockPayment.id}`)
      .set('Cookie', [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(mockPayment.id);
    expect(res.body.number).toBe('COB-2026-0001');
    expect(res.body.effectiveStatus).toBeDefined();
    expect(res.body.contract).toBeDefined();
  });

  it('3. POST /api/payments - Deve criar cobrança avulsa manual com numeração COB-AAAA-NNNN', async () => {
    const token = createToken(activeUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser);
    vi.mocked(prisma.contract.findFirst).mockResolvedValue(mockContract as any);

    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      return cb({
        paymentSequence: {
          upsert: vi.fn().mockResolvedValue({ year: 2026, lastNumber: 0 }),
          findUnique: vi.fn().mockResolvedValue({ year: 2026, lastNumber: 0 }),
          update: vi.fn().mockResolvedValue({ year: 2026, lastNumber: 1 }),
        },
        $queryRawUnsafe: vi.fn().mockResolvedValue([{ lastNumber: 0 }]),
        paymentRecord: {
          create: vi.fn().mockResolvedValue({
            ...mockPayment,
            number: 'COB-2026-0001',
          }),
        },
      });
    });

    const res = await request(app)
      .post('/api/payments')
      .set('Cookie', [`token=${token}`])
      .send({
        contractId: mockContract.id,
        referenceMonth: '2026-05',
        dueDate: '2026-05-10',
        amountCents: 250000,
        notes: 'Cobrança avulsa',
      });

    expect(res.status).toBe(201);
    expect(res.body.number).toBe('COB-2026-0001');
  });

  it('4. PATCH /api/payments/:id - Deve realizar baixa manual com paidDate e paymentMethod (RF-29)', async () => {
    const token = createToken(activeUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser);
    vi.mocked(prisma.paymentRecord.findUnique).mockResolvedValue(mockPayment as any);
    vi.mocked(prisma.paymentRecord.update).mockResolvedValue({
      ...mockPayment,
      status: 'Pago',
      paidDate: '2026-05-10',
      paymentMethod: 'PIX',
      amountCents: 240000, // Com desconto de R$ 100
      notes: 'Pago com desconto de pontualidade',
    } as any);

    const res = await request(app)
      .patch(`/api/payments/${mockPayment.id}`)
      .set('Cookie', [`token=${token}`])
      .send({
        status: 'Pago',
        paidDate: '2026-05-10',
        paymentMethod: 'PIX',
        amountCents: 240000,
        notes: 'Pago com desconto de pontualidade',
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Pago');
    expect(res.body.effectiveStatus).toBe('Pago');
    expect(res.body.paidDate).toBe('2026-05-10');
    expect(res.body.paymentMethod).toBe('PIX');
    expect(res.body.amountCents).toBe(240000);
  });

  it('5. PATCH /api/payments/:id - Deve cancelar cobrança sem alterar seu número (RF-32)', async () => {
    const token = createToken(activeUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser);
    vi.mocked(prisma.paymentRecord.findUnique).mockResolvedValue(mockPayment as any);
    vi.mocked(prisma.paymentRecord.update).mockResolvedValue({
      ...mockPayment,
      status: 'Cancelado',
    } as any);

    const res = await request(app)
      .patch(`/api/payments/${mockPayment.id}`)
      .set('Cookie', [`token=${token}`])
      .send({
        status: 'Cancelado',
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Cancelado');
    expect(res.body.effectiveStatus).toBe('Cancelado');
    expect(res.body.number).toBe(mockPayment.number);
  });

  it('6. GET /api/contracts/:id/payments - Dispara ensurePaymentRecords e lista cobranças do contrato (RF-20)', async () => {
    const token = createToken(activeUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser);
    vi.mocked(prisma.contract.findFirst).mockResolvedValue({
      ...mockContract,
      paymentRecords: [mockPayment],
    } as any);
    vi.mocked(prisma.paymentRecord.findMany).mockResolvedValue([mockPayment] as any);

    const res = await request(app)
      .get(`/api/contracts/${mockContract.id}/payments`)
      .set('Cookie', [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].contractId).toBe(mockContract.id);
  });
});
