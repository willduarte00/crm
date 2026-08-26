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
      findMany: vi.fn(),
    },
    contract: {
      findMany: vi.fn(),
    },
    paymentRecord: {
      findMany: vi.fn(),
    },
    metricSnapshot: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    settings: {
      findFirst: vi.fn(),
    },
  },
}));

describe('Dashboard & Exportação — Testes de Integração (RF-40 a RF-53)', () => {
  const activeUser = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'membro@agencia.com',
    name: 'Membro Teste',
    active: true,
    mustChangePassword: false,
    tokenVersion: 0,
    passwordHash: 'hash',
    createdAt: new Date(),
    groups: [
      {
        group: {
          id: 'admin-group',
          name: 'Admin',
          permissions: [
            'dashboard.financial.view',
            'dashboard.operational.view',
            'clients.export',
            'payments.export',
            'settings.view',
            'settings.bank.view'
          ],
        },
      },
    ],
  };

  const createToken = (user: { id: string; tokenVersion: number }) =>
    jwt.sign({ id: user.id, tokenVersion: user.tokenVersion }, env.JWT_SECRET, {
      expiresIn: '7d',
    });

  const mockClient = {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'TechCorp Industries',
    tradeName: 'TechCorp',
    documentType: 'CNPJ',
    documentNumber: '11222333000181',
    email: 'financeiro@techcorp.com',
    phone: '5511987654321',
    leadSource: 'Google Ads',
    stage: 'Contrato Ativo',
    priority: 'alta',
    owner: { name: 'Membro Teste' },
    createdAt: new Date('2026-01-15T10:00:00Z'),
    contracts: [
      {
        id: '44444444-4444-4444-4444-444444444444',
        clientId: '33333333-3333-3333-3333-333333333333',
        serviceType: 'Tráfego Pago',
        billingType: 'recorrente',
        valueCents: 450000,
        status: 'ativo',
      },
    ],
  };

  const mockContracts = [
    {
      id: '44444444-4444-4444-4444-444444444444',
      clientId: mockClient.id,
      serviceType: 'Tráfego Pago',
      billingType: 'recorrente',
      valueCents: 450000,
      status: 'ativo',
    },
    {
      id: '44444444-4444-4444-4444-444444444445',
      clientId: mockClient.id,
      serviceType: 'Social Media & Conteúdo',
      billingType: 'recorrente',
      valueCents: 200000,
      status: 'pausado',
    },
  ];

  const mockPayments = [
    {
      id: '55555555-5555-5555-5555-555555555555',
      contractId: mockContracts[0].id,
      number: 'COB-2026-0001',
      referenceMonth: '2026-05',
      dueDate: '2026-05-10',
      paidDate: '2026-05-09',
      amountCents: 450000,
      status: 'Pago',
      paymentMethod: 'PIX',
      notes: null,
      contract: {
        clientId: mockClient.id,
        serviceType: 'Tráfego Pago',
        billingType: 'recorrente',
        client: mockClient,
      },
    },
  ];

  const mockSettings = {
    id: 'sett-1',
    agencyName: 'AdPrecision Marketing',
    contactEmail: 'contato@adprecision.com',
    phone: '5511988887777',
    pixKey: '34123456000100',
    pixKeyType: 'CNPJ',
    bankName: 'Banco Itaú',
    bankBranch: '1234',
    bankAccount: '56789-0',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser as any);
  });

  describe('GET /api/dashboard', () => {
    it('retorna 401 para requisição sem cookie de sessão', async () => {
      const res = await request(app).get('/api/dashboard');
      expect(res.status).toBe(401);
    });

    it('retorna métricas calculadas e faz upsert do snapshot do mês corrente (RF-40 a RF-47)', async () => {
      const token = createToken(activeUser);

      vi.mocked(prisma.contract.findMany).mockResolvedValue(mockContracts as any);
      vi.mocked(prisma.paymentRecord.findMany).mockResolvedValue(mockPayments as any);
      vi.mocked(prisma.client.findMany).mockResolvedValue([mockClient] as any);
      vi.mocked(prisma.metricSnapshot.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.metricSnapshot.upsert).mockResolvedValue({
        id: 'snap-1',
        referenceMonth: '2026-05',
        mrrCents: 450000,
        invoicedCents: 450000,
        receivedCents: 450000,
        overdueCents: 0,
        overdueCount: 0,
        activeClients: 1,
        capturedAt: new Date(),
      } as any);
      vi.mocked(prisma.settings.findFirst).mockResolvedValue(mockSettings as any);

      const res = await request(app)
        .get('/api/dashboard')
        .set('Cookie', [`token=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.current).toBeDefined();
      expect(res.body.current.mrrCents).toBe(450000); // 450.000 (pausado de 200.000 é ignorado)
      expect(res.body.current.activeClients).toBe(1);
      expect(res.body.settings.agencyName).toBe('AdPrecision Marketing');

      // RF-47: Confere chamada do upsert
      expect(prisma.metricSnapshot.upsert).toHaveBeenCalledTimes(1);

      // RF-48: Sem snapshot do mês anterior, comparison é null
      expect(res.body.comparison).toBeNull();
    });

    it('RF-48: exibe comparativo quando existe snapshot do mês anterior', async () => {
      const token = createToken(activeUser);

      vi.mocked(prisma.contract.findMany).mockResolvedValue(mockContracts as any);
      vi.mocked(prisma.paymentRecord.findMany).mockResolvedValue(mockPayments as any);
      vi.mocked(prisma.client.findMany).mockResolvedValue([mockClient] as any);

      // Snapshot do mês anterior
      vi.mocked(prisma.metricSnapshot.findUnique).mockResolvedValue({
        id: 'snap-prev',
        referenceMonth: '2026-04',
        mrrCents: 400000,
        invoicedCents: 400000,
        receivedCents: 400000,
        overdueCents: 0,
        overdueCount: 0,
        activeClients: 1,
        capturedAt: new Date('2026-04-30T23:59:59Z'),
      } as any);

      vi.mocked(prisma.metricSnapshot.upsert).mockResolvedValue({} as any);
      vi.mocked(prisma.settings.findFirst).mockResolvedValue(mockSettings as any);

      const res = await request(app)
        .get('/api/dashboard')
        .set('Cookie', [`token=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.comparison).not.toBeNull();
      // MRR: de 400.000 para 450.000 = +12.5%
      expect(res.body.comparison.mrr.percentage).toBe(12.5);
    });
  });

  describe('Exportação CSV (RF-47 / Contratos de API)', () => {
    it('GET /api/export/clients exporta CSV com delimitador ; e cabeçalhos em pt-BR', async () => {
      const token = createToken(activeUser);
      vi.mocked(prisma.client.findMany).mockResolvedValue([mockClient] as any);

      const res = await request(app)
        .get('/api/export/clients')
        .set('Cookie', [`token=${token}`]);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('clientes-');
      expect(res.text).toContain('Nome;Nome Fantasia;Tipo Documento;Documento;E-mail;Telefone');
      expect(res.text).toContain('TechCorp Industries;TechCorp;CNPJ');
    });

    it('GET /api/export/payments exporta CSV com delimitador ; e valores em R$', async () => {
      const token = createToken(activeUser);
      vi.mocked(prisma.paymentRecord.findMany).mockResolvedValue(mockPayments as any);

      const res = await request(app)
        .get('/api/export/payments')
        .set('Cookie', [`token=${token}`]);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('cobrancas-');
      expect(res.text).toContain('Número;Cliente;Documento;Serviço;Tipo de Cobrança');
      expect(res.text).toContain('COB-2026-0001');
      expect(res.text).toContain('R$ 4500,00');
    });
  });
});
