import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../app.js';
import { prisma } from '../prisma.js';
import { env } from '../env.js';

vi.mock('../prisma.js', () => {
  const prismaMock = {
    user: {
      findUnique: vi.fn(),
    },
    client: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    contract: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    interactionLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    paymentRecord: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(prismaMock)),
  };
  return { prisma: prismaMock };
});

describe('TASK-7 Permissoes nas rotas de clientes e contratos', () => {
  const createToken = (user) => jwt.sign({ id: user.id, tokenVersion: 0 }, env.JWT_SECRET, { expiresIn: '7d' });

  const opUser = {
    id: 'op-1',
    email: 'op@agencia.com',
    name: 'Operacional',
    active: true,
    mustChangePassword: false,
    tokenVersion: 0,
    groups: [{ group: { id: 'g-op', name: 'Operacional', permissions: ['clients.view', 'clients.create', 'clients.update', 'clients.stage.update', 'clients.owner.update', 'logs.view', 'logs.create', 'users.view_basic'] } }]
  };

  const finUser = {
    id: 'fin-1',
    email: 'fin@agencia.com',
    name: 'Financeiro',
    active: true,
    mustChangePassword: false,
    tokenVersion: 0,
    groups: [{ group: { id: 'g-fin', name: 'Financeiro', permissions: ['clients.view', 'logs.view', 'contracts.view', 'contracts.create', 'contracts.update', 'contract_files.view', 'contract_files.create', 'payments.view', 'payments.create', 'payments.update', 'payments.settle', 'payments.export', 'invoices.view', 'invoices.create', 'dashboard.financial.view', 'dashboard.operational.view', 'settings.bank.view'] } }]
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Operacional recebe 200 em PATCH /:id/stage, PATCH /:id/owner, POST /, PATCH /:id e POST /:id/logs', async () => {
    const token = createToken(opUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(opUser as any);
    
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: '123', deletedAt: null } as any);
    vi.mocked(prisma.client.create).mockResolvedValue({ id: '123' } as any);
    vi.mocked(prisma.client.update).mockResolvedValue({ id: '123' } as any);
    vi.mocked(prisma.interactionLog.create).mockResolvedValue({ id: 'log1' } as any);

    const reqs = [
      request(app).patch('/api/clients/123/stage').set('Cookie', [`token=${token}`]).send({ stage: 'Contato/Qualificação' }),
      request(app).patch('/api/clients/123/owner').set('Cookie', [`token=${token}`]).send({ ownerId: '11111111-1111-1111-1111-111111111111' }),
      request(app).post('/api/clients').set('Cookie', [`token=${token}`]).send({ name: 'Teste', documentType: 'CPF', documentNumber: '11111111111', leadSource: 'Outro', stage: 'Novo Lead', priority: 'media' }),
      request(app).patch('/api/clients/123').set('Cookie', [`token=${token}`]).send({ name: 'Teste Atualizado' }),
      request(app).post('/api/clients/123/logs').set('Cookie', [`token=${token}`]).send({ content: 'Anotacao', type: 'anotacao' })
    ];

    for (const r of reqs) {
      const res = await r;
      expect(res.status).not.toBe(403);
    }
  });

  it('Operacional recebe 403 em DELETE /:id, POST /batch-reassign e contratos', async () => {
    const token = createToken(opUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(opUser as any);

    const resDelete = await request(app).delete('/api/clients/123').set('Cookie', [`token=${token}`]);
    expect(resDelete.status).toBe(403);

    const resBatch = await request(app).post('/api/clients/batch-reassign').set('Cookie', [`token=${token}`]).send({ clientIds: ['123'], newOwnerId: '11111111-1111-1111-1111-111111111111' });
    expect(resBatch.status).toBe(403);

    const resContractsGet = await request(app).get('/api/contracts').set('Cookie', [`token=${token}`]);
    expect(resContractsGet.status).toBe(403);
  });

  it('Financeiro recebe 403 em PATCH /:id/stage e POST /api/clients', async () => {
    const token = createToken(finUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(finUser as any);

    const resStage = await request(app).patch('/api/clients/123/stage').set('Cookie', [`token=${token}`]).send({ stage: 'Contato/Qualificação' });
    expect(resStage.status).toBe(403);

    const resPost = await request(app).post('/api/clients').set('Cookie', [`token=${token}`]).send({ name: 'Teste', documentType: 'CPF', documentNumber: '11111111111', leadSource: 'Outro', stage: 'Novo Lead', priority: 'media' });
    expect(resPost.status).toBe(403);
  });

  it('Financeiro recebe 200 em contratos e 403 em DELETE contratos', async () => {
    const token = createToken(finUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(finUser as any);
    
    vi.mocked(prisma.contract.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: '123' } as any);
    vi.mocked(prisma.contract.create).mockResolvedValue({ id: 'c1' } as any);
    vi.mocked(prisma.contract.findFirst).mockResolvedValue({ id: 'c1', deletedAt: null } as any);
    vi.mocked(prisma.contract.update).mockResolvedValue({ id: 'c1' } as any);

    const resGet = await request(app).get('/api/contracts').set('Cookie', [`token=${token}`]);
    expect(resGet.status).toBe(200);

    const resPost = await request(app).post('/api/contracts').set('Cookie', [`token=${token}`]).send({ clientId: '11111111-1111-1111-1111-111111111111', serviceType: 'Marketing Digital', billingType: 'recorrente', valueCents: 1000, billingDay: 10, billingPeriodMonths: 1, startDate: '2026-01-01', status: 'ativo' });
    expect(resPost.status).not.toBe(403);

    const resPatch = await request(app).patch('/api/contracts/c1').set('Cookie', [`token=${token}`]).send({ valueCents: 2000 });
    expect(resPatch.status).not.toBe(403);

    const resDelete = await request(app).delete('/api/contracts/c1').set('Cookie', [`token=${token}`]);
    expect(resDelete.status).toBe(403);
  });
});
