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
      updateMany: vi.fn(),
    },
    interactionLog: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    contract: {
      findMany: vi.fn(),
    },
  },
}));

describe('Clientes e Leads — Testes de Integração (RF-01 a RF-06c)', () => {
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

  const inactiveUser = {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'inativo@agencia.com',
    name: 'Ex Membro',
    role: 'membro',
    active: false,
    mustChangePassword: false,
    tokenVersion: 0,
    passwordHash: 'hash',
    createdAt: new Date(),
  };

  const mockClient = {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Empresa Teste LTDA',
    tradeName: 'Empresa Teste',
    documentType: 'CNPJ',
    documentNumber: '11222333000181',
    email: 'contato@empresateste.com',
    phone: '5511987654321',
    leadSource: 'Instagram',
    stage: 'Novo Lead',
    priority: 'alta',
    ownerId: activeUser.id,
    notes: 'Primeiro contato realizado',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    owner: activeUser,
    _count: {
      contracts: 0,
      interactionLogs: 1,
    },
  };

  const createToken = (user: { id: string; tokenVersion: number }) =>
    jwt.sign({ id: user.id, tokenVersion: user.tokenVersion }, env.JWT_SECRET, {
      expiresIn: '7d',
    });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. GET /api/clients com usuário autenticado retorna lista paginada de 25 por página', async () => {
    const token = createToken(activeUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser);
    vi.mocked(prisma.client.count).mockResolvedValue(1);
    vi.mocked(prisma.client.findMany).mockResolvedValue([mockClient]);

    const res = await request(app)
      .get('/api/clients?page=1&limit=25')
      .set('Cookie', [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toEqual({
      page: 1,
      limit: 25,
      total: 1,
      totalPages: 1,
    });
    expect(prisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
        skip: 0,
        take: 25,
      })
    );
  });

  it('2. POST /api/clients cria lead com CNPJ válido e telefone normalizado em E.164 (RF-01, RF-02)', async () => {
    const token = createToken(activeUser);
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(activeUser) // auth
      .mockResolvedValueOnce(activeUser); // owner check

    vi.mocked(prisma.client.create).mockResolvedValue(mockClient);

    const res = await request(app)
      .post('/api/clients')
      .set('Cookie', [`token=${token}`])
      .send({
        name: 'Empresa Teste LTDA',
        tradeName: 'Empresa Teste',
        documentType: 'CNPJ',
        documentNumber: '11.222.333/0001-81',
        email: 'contato@empresateste.com',
        phone: '(11) 98765-4321',
        leadSource: 'Instagram',
        stage: 'Novo Lead',
        priority: 'alta',
        ownerId: activeUser.id,
        notes: 'Primeiro contato realizado',
      });

    expect(res.status).toBe(201);
    expect(prisma.client.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentType: 'CNPJ',
          documentNumber: '11222333000181', // Dígitos limpos
          phone: '5511987654321', // Normalizado em E.164
          leadSource: 'Instagram',
          priority: 'alta',
        }),
      })
    );
  });

  it('2b. POST /api/clients cria lead com CNPJ alfanumérico, persistindo em maiúsculas sem máscara (RF-01)', async () => {
    const token = createToken(activeUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(activeUser); // auth

    vi.mocked(prisma.client.create).mockResolvedValue(mockClient);

    const res = await request(app)
      .post('/api/clients')
      .set('Cookie', [`token=${token}`])
      .send({
        name: 'Empresa Alfanumérica LTDA',
        documentType: 'CNPJ',
        documentNumber: 'lh.ilr.c2x/0001-88',
        leadSource: 'Instagram',
        stage: 'Novo Lead',
        priority: 'alta',
      });

    expect(res.status).toBe(201);
    expect(prisma.client.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentType: 'CNPJ',
          documentNumber: 'LHILRC2X000188',
        }),
      })
    );
  });

  it('3. POST /api/clients rejeita CNPJ com dígito verificador inválido com 400 (RF-01)', async () => {
    const token = createToken(activeUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser);

    const res = await request(app)
      .post('/api/clients')
      .set('Cookie', [`token=${token}`])
      .send({
        name: 'Empresa Inválida',
        documentType: 'CNPJ',
        documentNumber: '11.222.333/0001-00', // DV inválido
        leadSource: 'Google Ads',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('inválido');
  });

  it('3b. POST /api/clients rejeita CNPJ alfanumérico com DV incorreto com 400 (RF-01)', async () => {
    const token = createToken(activeUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser);

    const res = await request(app)
      .post('/api/clients')
      .set('Cookie', [`token=${token}`])
      .send({
        name: 'Empresa Alfanumérica Inválida',
        documentType: 'CNPJ',
        documentNumber: 'LH.ILR.C2X/0001-00',
        leadSource: 'Google Ads',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('inválido');
  });

  it('3c. POST /api/clients rejeita CPF com letras com 400 (RF-01)', async () => {
    const token = createToken(activeUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser);

    const res = await request(app)
      .post('/api/clients')
      .set('Cookie', [`token=${token}`])
      .send({
        name: 'Pessoa Física Inválida',
        documentType: 'CPF',
        documentNumber: '529.98A.247-25',
        leadSource: 'Google Ads',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('inválido');
  });

  it('4. POST /api/clients rejeita atribuir lead a responsável inativo (RF-06a)', async () => {
    const token = createToken(activeUser);
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(activeUser) // auth
      .mockResolvedValueOnce(inactiveUser); // owner check

    const res = await request(app)
      .post('/api/clients')
      .set('Cookie', [`token=${token}`])
      .send({
        name: 'Cliente Sem Dono Ativo',
        documentType: 'CPF',
        documentNumber: '52998224725',
        leadSource: 'LinkedIn',
        ownerId: inactiveUser.id,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('inativo');
  });

  it('5. PATCH /api/clients/:id/stage move etapa do funil (RF-04, RF-05)', async () => {
    const token = createToken(activeUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser);
    vi.mocked(prisma.client.findFirst).mockResolvedValue(mockClient);
    vi.mocked(prisma.client.update).mockResolvedValue({
      ...mockClient,
      stage: 'Contato/Qualificação',
    });

    const res = await request(app)
      .patch(`/api/clients/${mockClient.id}/stage`)
      .set('Cookie', [`token=${token}`])
      .send({ stage: 'Contato/Qualificação' });

    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('Contato/Qualificação');
    expect(prisma.client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockClient.id },
        data: { stage: 'Contato/Qualificação' },
      })
    );
  });

  it('6. POST /api/clients/:id/logs registra anotação na timeline com autor (RF-06)', async () => {
    const token = createToken(activeUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser);
    vi.mocked(prisma.client.findFirst).mockResolvedValue(mockClient);

    const mockLog = {
      id: 'log-1',
      clientId: mockClient.id,
      userId: activeUser.id,
      type: 'anotacao',
      content: 'Cliente solicitou proposta comercial até sexta-feira',
      createdAt: new Date(),
      user: {
        id: activeUser.id,
        name: activeUser.name,
        email: activeUser.email,
        role: activeUser.role,
      },
    };

    vi.mocked(prisma.interactionLog.create).mockResolvedValue(mockLog);

    const res = await request(app)
      .post(`/api/clients/${mockClient.id}/logs`)
      .set('Cookie', [`token=${token}`])
      .send({
        content: 'Cliente solicitou proposta comercial até sexta-feira',
      });

    expect(res.status).toBe(201);
    expect(res.body.content).toBe('Cliente solicitou proposta comercial até sexta-feira');
    expect(res.body.user.name).toBe(activeUser.name);
    expect(prisma.interactionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: mockClient.id,
          userId: activeUser.id,
          content: 'Cliente solicitou proposta comercial até sexta-feira',
        }),
      })
    );
  });

  it('7. DELETE /api/clients/:id realiza soft delete preenchendo deletedAt', async () => {
    const token = createToken(activeUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser);
    vi.mocked(prisma.client.findFirst).mockResolvedValue(mockClient);
    vi.mocked(prisma.client.update).mockResolvedValue({
      ...mockClient,
      deletedAt: new Date(),
    });

    const res = await request(app)
      .delete(`/api/clients/${mockClient.id}`)
      .set('Cookie', [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prisma.client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockClient.id },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
        }),
      })
    );
  });

  it('8. POST /api/clients/batch-reassign reatribui leads em lote (RF-06c)', async () => {
    const token = createToken(activeUser);
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(activeUser) // auth
      .mockResolvedValueOnce(activeUser); // new owner check

    vi.mocked(prisma.client.updateMany).mockResolvedValue({ count: 3 });

    const res = await request(app)
      .post('/api/clients/batch-reassign')
      .set('Cookie', [`token=${token}`])
      .send({
        clientIds: [
          '33333333-3333-3333-3333-333333333333',
          '44444444-4444-4444-4444-444444444444',
          '55555555-5555-5555-5555-555555555555',
        ],
        newOwnerId: activeUser.id,
      });

    expect(res.status).toBe(200);
    expect(res.body.updatedCount).toBe(3);
    expect(prisma.client.updateMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: [
            '33333333-3333-3333-3333-333333333333',
            '44444444-4444-4444-4444-444444444444',
            '55555555-5555-5555-5555-555555555555',
          ],
        },
        deletedAt: null,
      },
      data: {
        ownerId: activeUser.id,
      },
    });
  });
});
