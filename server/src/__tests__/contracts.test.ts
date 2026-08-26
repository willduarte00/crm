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
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    client: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    contract: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    contractFile: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    paymentRecord: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    paymentSequence: {
      upsert: vi.fn().mockResolvedValue({ year: 2026, lastNumber: 0 }),
      findUnique: vi.fn().mockResolvedValue({ year: 2026, lastNumber: 0 }),
      update: vi.fn().mockResolvedValue({ year: 2026, lastNumber: 10 }),
    },
    $transaction: vi.fn(async (cb: any) => {
      if (typeof cb === 'function') {
        return cb(prisma);
      }
      return cb;
    }),
    $queryRawUnsafe: vi.fn().mockResolvedValue([{ lastNumber: 0 }]),
  },
}));

describe('Contratos — Testes de Integração (RF-10 a RF-13)', () => {
  const activeUser = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'admin@agencia.com',
    name: 'Admin Teste',
    role: 'admin',
    active: true,
    mustChangePassword: false,
    tokenVersion: 0,
  groups: [{ group: { id: 'g-admin', name: 'Admin', permissions: ['clients.view', 'clients.create', 'clients.update', 'clients.delete', 'clients.stage.update', 'clients.owner.update', 'clients.batch_reassign', 'clients.export', 'logs.view', 'logs.create', 'contracts.view', 'contracts.create', 'contracts.update', 'contracts.delete', 'contract_files.view', 'contract_files.create', 'contract_files.delete', 'payments.view', 'payments.create', 'payments.update', 'payments.settle', 'payments.cancel', 'payments.export', 'invoices.view', 'invoices.create', 'invoices.delete', 'dashboard.financial.view', 'dashboard.operational.view', 'settings.view', 'settings.update', 'settings.bank.view', 'users.view_basic', 'users.view', 'users.manage', 'groups.view', 'groups.manage'] } }],

    passwordHash: 'hash',
    createdAt: new Date(),
  };

  const mockClient = {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Cliente Contratos Teste',
    tradeName: 'Empresa Teste',
    documentType: 'CNPJ',
    documentNumber: '11222333000181',
    email: 'contato@empresateste.com',
    phone: '5511987654321',
    leadSource: 'Instagram',
    stage: 'Contrato Ativo',
    priority: 'alta',
    ownerId: activeUser.id,
    deletedAt: null,
  };

  const mockContract = {
    id: '44444444-4444-4444-4444-444444444444',
    clientId: mockClient.id,
    serviceType: 'Social Media & Conteúdo',
    description: 'Gestão mensal de redes sociais',
    billingType: 'recorrente',
    valueCents: 250000,
    billingDay: 10,
    billingPeriodMonths: 1,
    installments: null,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    status: 'ativo',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    client: mockClient,
    files: [],
    _count: { paymentRecords: 0 },
  };

  const createToken = (user: { id: string; tokenVersion: number }) =>
    jwt.sign({ id: user.id, tokenVersion: user.tokenVersion }, env.JWT_SECRET, {
      expiresIn: '7d',
    });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Deve criar um contrato recorrente com billingDay e billingPeriodMonths válidos (RF-11, RF-11a)', async () => {
    const token = createToken(activeUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser);
    vi.mocked(prisma.client.findFirst).mockResolvedValue(mockClient);
    vi.mocked(prisma.contract.create).mockResolvedValue(mockContract);

    const res = await request(app)
      .post('/api/contracts')
      .set('Cookie', [`token=${token}`])
      .send({
        clientId: mockClient.id,
        serviceType: 'Social Media & Conteúdo',
        description: 'Gestão mensal de redes sociais',
        billingType: 'recorrente',
        valueCents: 250000, // R$ 2.500,00
        billingDay: 10,
        billingPeriodMonths: 1,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        status: 'ativo',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(mockContract.id);
    expect(res.body.billingType).toBe('recorrente');
    expect(res.body.billingDay).toBe(10);
    expect(res.body.billingPeriodMonths).toBe(1);
    expect(res.body.valueCents).toBe(250000);
    expect(prisma.contract.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: mockClient.id,
          billingType: 'recorrente',
          billingDay: 10,
          billingPeriodMonths: 1,
          valueCents: 250000,
        }),
      })
    );
  });

  it('2. Deve criar um contrato pontual com parcelas (RF-11)', async () => {
    const token = createToken(activeUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser);
    vi.mocked(prisma.client.findFirst).mockResolvedValue(mockClient);
    vi.mocked(prisma.contract.create).mockResolvedValue({
      ...mockContract,
      billingType: 'pontual',
      installments: 3,
      billingDay: null,
      billingPeriodMonths: null,
    });

    const res = await request(app)
      .post('/api/contracts')
      .set('Cookie', [`token=${token}`])
      .send({
        clientId: mockClient.id,
        serviceType: 'Sites/Landing Pages',
        description: 'Desenvolvimento de Landing Page',
        billingType: 'pontual',
        valueCents: 500000, // R$ 5.000,00
        installments: 3,
        startDate: '2026-02-01',
        endDate: '2026-04-30',
        status: 'ativo',
      });

    expect(res.status).toBe(201);
    expect(res.body.billingType).toBe('pontual');
    expect(res.body.installments).toBe(3);
    expect(prisma.contract.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          billingType: 'pontual',
          installments: 3,
          billingDay: null,
          billingPeriodMonths: null,
        }),
      })
    );
  });

  it('3. Deve rejeitar contrato recorrente sem billingDay válido (RF-11)', async () => {
    const token = createToken(activeUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser);
    vi.mocked(prisma.client.findFirst).mockResolvedValue(mockClient);

    const res = await request(app)
      .post('/api/contracts')
      .set('Cookie', [`token=${token}`])
      .send({
        clientId: mockClient.id,
        serviceType: 'Tráfego Pago',
        billingType: 'recorrente',
        valueCents: 150000,
        billingDay: 35, // Inválido (> 31)
        startDate: '2026-01-01',
      });

    expect(res.status).toBe(400);
  });

  it('4. Deve rejeitar contrato pontual sem parcelas válidas (RF-11)', async () => {
    const token = createToken(activeUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser);
    vi.mocked(prisma.client.findFirst).mockResolvedValue(mockClient);

    const res = await request(app)
      .post('/api/contracts')
      .set('Cookie', [`token=${token}`])
      .send({
        clientId: mockClient.id,
        serviceType: 'Branding',
        billingType: 'pontual',
        valueCents: 300000,
        installments: 0, // Inválido (< 1)
        startDate: '2026-01-01',
      });

    expect(res.status).toBe(400);
  });

  it('5. Deve listar contratos com filtros por cliente e tipo de serviço', async () => {
    const token = createToken(activeUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser);
    vi.mocked(prisma.contract.findMany).mockResolvedValue([mockContract]);

    const encodedService = encodeURIComponent('Social Media & Conteúdo');
    const res = await request(app)
      .get(`/api/contracts?clientId=${mockClient.id}&serviceType=${encodedService}`)
      .set('Cookie', [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].serviceType).toBe('Social Media & Conteúdo');
    expect(prisma.contract.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          clientId: mockClient.id,
          serviceType: 'Social Media & Conteúdo',
        }),
      })
    );
  });

  it('6. Deve obter detalhes completos de um contrato por ID', async () => {
    const token = createToken(activeUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser);
    vi.mocked(prisma.contract.findFirst).mockResolvedValue(mockContract);

    const res = await request(app)
      .get(`/api/contracts/${mockContract.id}`)
      .set('Cookie', [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(mockContract.id);
    expect(res.body.client).toBeDefined();
    expect(Array.isArray(res.body.files)).toBe(true);
  });

  it('7. Deve atualizar status e valor de um contrato (PATCH)', async () => {
    const token = createToken(activeUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser);
    vi.mocked(prisma.contract.findFirst).mockResolvedValue(mockContract);
    vi.mocked(prisma.contract.update).mockResolvedValue({
      ...mockContract,
      status: 'pausado',
      valueCents: 280000,
    });

    const res = await request(app)
      .patch(`/api/contracts/${mockContract.id}`)
      .set('Cookie', [`token=${token}`])
      .send({
        status: 'pausado',
        valueCents: 280000,
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pausado');
    expect(res.body.valueCents).toBe(280000);
    expect(prisma.contract.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockContract.id },
        data: expect.objectContaining({
          status: 'pausado',
          valueCents: 280000,
        }),
      })
    );
  });

  it('8. Deve realizar soft delete de um contrato mantendo o registro no banco com deletedAt', async () => {
    const token = createToken(activeUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser);
    vi.mocked(prisma.contract.findFirst).mockResolvedValue(mockContract);
    vi.mocked(prisma.contract.update).mockResolvedValue({
      ...mockContract,
      deletedAt: new Date(),
    });

    const res = await request(app)
      .delete(`/api/contracts/${mockContract.id}`)
      .set('Cookie', [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prisma.contract.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockContract.id },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
        }),
      })
    );
  });
});
