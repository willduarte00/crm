import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { app } from '../app.js';
import { prisma } from '../prisma.js';
import { env } from '../env.js';
import { ADMIN_PERMISSIONS, FINANCEIRO_PERMISSIONS, OPERACIONAL_PERMISSIONS } from '../domain/defaultGroups.js';

vi.mock('../prisma.js', () => {
  const prismaMock = {
    user: { findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    settings: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    group: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    userGroup: { deleteMany: vi.fn(), createMany: vi.fn() },
    client: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    paymentRecord: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn().mockResolvedValue([]), count: vi.fn() },
    contract: { findMany: vi.fn().mockResolvedValue([]) },
    contractFile: { findUnique: vi.fn(), delete: vi.fn() },
    invoiceFile: { findUnique: vi.fn(), delete: vi.fn() },
    metricSnapshot: { upsert: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn((callback) => callback(prismaMock)),
  };
  return { prisma: prismaMock };
});

describe('Permissões — Testes de Integração', () => {
  const adminUser = {
    id: 'admin-1',
    email: 'admin@agencia.com',
    name: 'Admin Teste',
    groups: [{ groupId: '11111111-1111-1111-1111-111111111111', group: { id: '11111111-1111-1111-1111-111111111111', name: 'Admin', permissions: ADMIN_PERMISSIONS, isSystem: true } }],
    active: true,
    mustChangePassword: false,
    tokenVersion: 0,
    passwordHash: '$2a$12$dummyhash',
    createdAt: new Date(),
  };

  const operUser = {
    id: 'oper-1',
    email: 'oper@agencia.com',
    name: 'Oper Teste',
    groups: [{ groupId: '22222222-2222-2222-2222-222222222222', group: { id: '22222222-2222-2222-2222-222222222222', name: 'Operacional', permissions: OPERACIONAL_PERMISSIONS, isSystem: false } }],
    active: true,
    mustChangePassword: false,
    tokenVersion: 0,
    passwordHash: '$2a$12$dummyhash',
    createdAt: new Date(),
  };

  const finUser = {
    id: 'fin-1',
    email: 'fin@agencia.com',
    name: 'Fin Teste',
    groups: [{ groupId: '33333333-3333-3333-3333-333333333333', group: { id: '33333333-3333-3333-3333-333333333333', name: 'Financeiro', permissions: FINANCEIRO_PERMISSIONS, isSystem: false } }],
    active: true,
    mustChangePassword: false,
    tokenVersion: 0,
    passwordHash: '$2a$12$dummyhash',
    createdAt: new Date(),
  };

  const dualUser = {
    id: 'dual-1',
    email: 'dual@agencia.com',
    name: 'Dual Teste',
    groups: [
      { groupId: '22222222-2222-2222-2222-222222222222', group: { id: '22222222-2222-2222-2222-222222222222', name: 'Operacional', permissions: OPERACIONAL_PERMISSIONS, isSystem: false } },
      { groupId: '33333333-3333-3333-3333-333333333333', group: { id: '33333333-3333-3333-3333-333333333333', name: 'Financeiro', permissions: FINANCEIRO_PERMISSIONS, isSystem: false } },
    ],
    active: true,
    mustChangePassword: false,
    tokenVersion: 0,
    passwordHash: '$2a$12$dummyhash',
    createdAt: new Date(),
  };

  const noGroupUser = {
    id: 'none-1',
    email: 'none@agencia.com',
    name: 'None Teste',
    groups: [],
    active: true,
    mustChangePassword: false,
    tokenVersion: 0,
    passwordHash: '$2a$12$dummyhash',
    createdAt: new Date(),
  };

  const createToken = (user: { id: string; tokenVersion: number }) =>
    jwt.sign({ id: user.id, tokenVersion: user.tokenVersion }, env.JWT_SECRET, {
      expiresIn: '7d',
    });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Por grupo', () => {
    it('Operacional', async () => {
      const token = createToken(operUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(operUser as any);
      vi.mocked(prisma.client.findUnique).mockResolvedValue({ id: 'c-1' } as any);
      vi.mocked(prisma.client.update).mockResolvedValue({ id: 'c-1' } as any);
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);

      const allowed = [
        { method: 'patch', url: '/api/clients/c-1/stage', body: { stageId: 's-1' } },
        { method: 'patch', url: '/api/clients/c-1/owner', body: { ownerId: 'u-1' } },
        { method: 'post', url: '/api/clients', body: { name: 'Cli', documentType: 'CPF', documentNumber: '11111111111', status: 'Ativo', stageId: 's-1' } },
        { method: 'post', url: '/api/clients/c-1/logs', body: { content: 'Log' } },
        { method: 'get', url: '/api/users/basic' },
      ];

      for (const req of allowed) {
        const res = await (request(app) as any)[req.method](req.url).set('Cookie', [`token=${token}`]).send(req.body);
        expect(res.status).not.toBe(403);
        expect(res.status).not.toBe(401);
      }

      const denied = [
        { method: 'delete', url: '/api/clients/c-1' },
        { method: 'get', url: '/api/contracts' },
        { method: 'get', url: '/api/payments' },
        { method: 'get', url: '/api/dashboard' },
        { method: 'post', url: '/api/clients/batch-reassign', body: { clientIds: [], newOwnerId: null } },
        { method: 'get', url: '/api/export/clients' },
        { method: 'get', url: '/api/users' },
        { method: 'get', url: '/api/settings' },
        { method: 'put', url: '/api/settings', body: {} },
        { method: 'get', url: '/api/groups' },
      ];

      for (const req of denied) {
        const res = await (request(app) as any)[req.method](req.url).set('Cookie', [`token=${token}`]).send(req.body);
        expect(res.status).toBe(403);
      }
    });

    it('Financeiro', async () => {
      const token = createToken(finUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(finUser as any);
      vi.mocked(prisma.settings.findFirst).mockResolvedValue({ id: 'set-1' } as any);

      const allowed = [
        { method: 'get', url: '/api/payments' },
        { method: 'post', url: '/api/payments', body: { contractId: 'c-1', referenceMonth: '2026-08', amountCents: 1000, dueDate: '2026-08-10' } },
        { method: 'post', url: '/api/contracts', body: { clientId: 'c-1', description: 'Desc', valueCents: 100, billingDay: 5 } },
        { method: 'patch', url: '/api/contracts/c-1', body: { valueCents: 200 } },
        { method: 'get', url: '/api/export/payments' },
        { method: 'get', url: '/api/settings/billing' },
      ];

      for (const req of allowed) {
        const res = await (request(app) as any)[req.method](req.url).set('Cookie', [`token=${token}`]).send(req.body);
        expect(res.status).not.toBe(403);
        expect(res.status).not.toBe(401);
      }

      const denied = [
        { method: 'patch', url: '/api/clients/c-1/stage', body: { stageId: 's-1' } },
        { method: 'post', url: '/api/clients', body: { name: 'Cli' } },
        { method: 'delete', url: '/api/contracts/c-1' },
        { method: 'put', url: '/api/settings', body: {} },
        { method: 'get', url: '/api/users' },
        { method: 'get', url: '/api/export/clients' },
        { method: 'get', url: '/api/groups' },
      ];

      for (const req of denied) {
        const res = await (request(app) as any)[req.method](req.url).set('Cookie', [`token=${token}`]).send(req.body);
        expect(res.status).toBe(403);
      }
    });

    it('Admin', async () => {
      const token = createToken(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser as any);
      vi.mocked(prisma.settings.findFirst).mockResolvedValue({ id: 'set-1' } as any);
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);

      const allowed = [
        { method: 'get', url: '/api/users' },
        { method: 'put', url: '/api/settings', body: { agencyName: 'Ag' } },
        { method: 'get', url: '/api/export/clients' },
        { method: 'get', url: '/api/export/payments' },
        { method: 'get', url: '/api/groups' },
      ];

      for (const req of allowed) {
        const res = await (request(app) as any)[req.method](req.url).set('Cookie', [`token=${token}`]).send(req.body);
        expect(res.status).not.toBe(403);
        expect(res.status).not.toBe(401);
      }
    });
  });

  describe('2. Acúmulo de grupos', () => {
    it('Usuário Dual obtém 200 em áreas de Operacional e Financeiro e une permissões', async () => {
      const token = createToken(dualUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(dualUser as any);

      const resStage = await request(app).patch('/api/clients/c-1/stage').set('Cookie', [`token=${token}`]).send({ stageId: 's-1' });
      expect(resStage.status).not.toBe(403);

      const resPayments = await request(app).get('/api/payments').set('Cookie', [`token=${token}`]);
      expect(resPayments.status).not.toBe(403);

      const resMe = await request(app).get('/api/auth/me').set('Cookie', [`token=${token}`]);
      expect(resMe.status).toBe(200);
      expect(resMe.body.user.permissions).toContain('clients.stage.update');
      expect(resMe.body.user.permissions).toContain('payments.view');
      const uniqueCount = new Set(resMe.body.user.permissions).size;
      expect(resMe.body.user.permissions.length).toBe(uniqueCount);
    });
  });

  describe('3. Sem grupo', () => {
    it('Autentica sem erro mas recebe 403 em rotas protegidas', async () => {
      const token = createToken(noGroupUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(noGroupUser as any);

      const resMe = await request(app).get('/api/auth/me').set('Cookie', [`token=${token}`]);
      expect(resMe.status).toBe(200);
      expect(resMe.body.user.permissions).toEqual([]);

      const resClients = await request(app).get('/api/clients').set('Cookie', [`token=${token}`]);
      expect(resClients.status).toBe(403);
    });
  });

  describe('4. Segurança', () => {
    it('401 e 403 são distintos', async () => {
      const res401 = await request(app).get('/api/clients');
      expect(res401.status).toBe(401);

      const token = createToken(noGroupUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(noGroupUser as any);
      const res403 = await request(app).get('/api/clients').set('Cookie', [`token=${token}`]);
      expect(res403.status).toBe(403);
      expect(res403.body.requiredPermission).toBeDefined();
    });

    it('Payload forjado não altera a autorização', async () => {
      const token = createToken(noGroupUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(noGroupUser as any);
      const res = await request(app).get('/api/clients?permissions=clients.view').set('Cookie', [`token=${token}`]).send({ groupIds: ['11111111-1111-1111-1111-111111111111'], role: 'admin', permissions: ['clients.view'] });
      expect(res.status).toBe(403);
    });

    it('Chamada direta continua devolvendo 403', async () => {
      const token = createToken(operUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(operUser as any);
      const res = await request(app).get('/api/users').set('Cookie', [`token=${token}`]).set('Accept', 'application/json');
      expect(res.status).toBe(403);
    });
  });

  describe('5. Ações compostas', () => {
    it('PATCH /api/payments/:id com Financeiro', async () => {
      const token = createToken(finUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(finUser as any);
      vi.mocked(prisma.paymentRecord.findUnique).mockResolvedValue({ 
        id: 'p-1', 
        status: 'Pendente',
        contract: { status: 'Ativo' }
      } as any);
      vi.mocked(prisma.paymentRecord.update).mockResolvedValue({
        id: 'p-1',
        status: 'Pago',
        dueDate: '2026-08-10'
      } as any);

      // Baixa
      const resSettle = await request(app).patch('/api/payments/p-1').set('Cookie', [`token=${token}`]).send({ status: 'Pago', paidDate: '2026-08-25', paymentMethod: 'PIX' });
      expect(resSettle.status).not.toBe(403);

      // Cancelamento -> Financeiro NÃO tem payments.cancel
      const resCancel = await request(app).patch('/api/payments/p-1').set('Cookie', [`token=${token}`]).send({ status: 'Cancelado' });
      expect(resCancel.status).toBe(403);
      expect(resCancel.body.requiredPermission).toBe('payments.cancel');

      // Baixa e alteração
      const resCombo = await request(app).patch('/api/payments/p-1').set('Cookie', [`token=${token}`]).send({ status: 'Pago', paidDate: '2026-08-25', paymentMethod: 'PIX', amountCents: 1500 });
      expect(resCombo.status).not.toBe(403);
    });

    it('DELETE /api/files/:id', async () => {
      const token = createToken(finUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(finUser as any);
      
      // Inexistente -> 404
      vi.mocked(prisma.contractFile.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.invoiceFile.findUnique).mockResolvedValue(null);
      const resNotFound = await request(app).delete('/api/files/f-1').set('Cookie', [`token=${token}`]);
      expect(resNotFound.status).toBe(404);

      // Invoice file (Financeiro doesn't have invoices.delete)
      vi.mocked(prisma.invoiceFile.findUnique).mockResolvedValue({ id: 'f-1' } as any);
      const resInv = await request(app).delete('/api/files/f-1').set('Cookie', [`token=${token}`]);
      expect(resInv.status).toBe(403);
      expect(resInv.body.requiredPermission).toBe('invoices.delete');

      // Contract file (Financeiro doesn't have contract_files.delete)
      vi.mocked(prisma.invoiceFile.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.contractFile.findUnique).mockResolvedValue({ id: 'f-1' } as any);
      const resCon = await request(app).delete('/api/files/f-1').set('Cookie', [`token=${token}`]);
      expect(resCon.status).toBe(403);
      expect(resCon.body.requiredPermission).toBe('contract_files.delete');
    });
  });

  describe('6. Payload filtrado', () => {
    it('GET /api/dashboard sem dashboard.financial.view', async () => {
      const token = createToken(operUser);
      // Let's artificially give Operacional dashboard.operational.view for this test so it returns 200
      const customUser = { ...operUser, groups: [{ groupId: '22222222-2222-2222-2222-222222222222', group: { id: '22222222-2222-2222-2222-222222222222', name: 'Oper', permissions: ['dashboard.operational.view'] } }] };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(customUser as any);
      
      const res = await request(app).get('/api/dashboard').set('Cookie', [`token=${token}`]);
      expect(res.status).toBe(200);
      expect(res.body.current.mrrCents).toBeUndefined();
      expect(res.body.alerts).toBeUndefined();
    });

    it('GET /api/dashboard sem settings.bank.view', async () => {
      const token = createToken(finUser);
      const customUser = { ...finUser, groups: [{ groupId: '33333333-3333-3333-3333-333333333333', group: { id: '33333333-3333-3333-3333-333333333333', name: 'Fin', permissions: ['dashboard.financial.view'] } }] };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(customUser as any);
      vi.mocked(prisma.settings.findFirst).mockResolvedValue({ id: 's-1', agencyName: 'Ag', pixKey: '123' } as any);
      
      const res = await request(app).get('/api/dashboard').set('Cookie', [`token=${token}`]);
      expect(res.status).toBe(200);
      expect(res.body.settings.pixKey).toBeUndefined();
      expect(res.body.settings.bankName).toBeUndefined();
      expect(res.body.settings.agencyName).toBe('Ag');
    });

    it('GET /api/users/basic', async () => {
      const token = createToken(operUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(operUser as any);
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 'u-1', name: 'User 1' } as any
      ]);
      const res = await request(app).get('/api/users/basic').set('Cookie', [`token=${token}`]);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: 'u-1', name: 'User 1' }]);
    });
  });

  describe('7. Regras de integridade', () => {
    it('Remover o último usuário ativo do grupo de sistema -> 422', async () => {
      const token = createToken(adminUser);
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(adminUser as any)
        .mockResolvedValueOnce(adminUser as any)
        .mockResolvedValueOnce(adminUser as any);
      vi.mocked(prisma.group.findFirst).mockResolvedValue({ id: '11111111-1111-1111-1111-111111111111', isSystem: true } as any);
      vi.mocked(prisma.user.count).mockResolvedValue(1);

      const res = await request(app).patch('/api/users/admin-1').set('Cookie', [`token=${token}`]).send({ groupIds: [] });
      expect(res.status).toBe(422);
    });

    it('Desativar o último usuário ativo do grupo de sistema -> 422', async () => {
      const admin2 = { ...adminUser, id: 'admin-2' };
      const token = createToken(adminUser);
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(adminUser as any)
        .mockResolvedValueOnce(admin2 as any);
      vi.mocked(prisma.group.findFirst).mockResolvedValue({ id: '11111111-1111-1111-1111-111111111111', isSystem: true } as any);
      vi.mocked(prisma.user.count).mockResolvedValue(1);

      const res = await request(app).patch('/api/users/admin-2').set('Cookie', [`token=${token}`]).send({ active: false });
      expect(res.status).toBe(422);
    });

    it('Alterar os próprios grupos -> 422', async () => {
      const token = createToken(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser as any);
      vi.mocked(prisma.group.count).mockResolvedValue(1);
      
      const res = await request(app).patch('/api/users/admin-1').set('Cookie', [`token=${token}`]).send({ groupIds: ['22222222-2222-2222-2222-222222222222'] });
      expect(res.status).toBe(422);
    });

    it('Desativar usuário incrementa tokenVersion e invalida a sessão aberta', async () => {
      const token = createToken(adminUser);
      const targetMember = { ...operUser };

      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(adminUser as any)
        .mockResolvedValueOnce(targetMember as any);

      vi.mocked(prisma.user.update).mockResolvedValue({
        ...targetMember,
        active: false,
        tokenVersion: 1,
      } as any);

      const res = await request(app)
        .patch('/api/users/oper-1')
        .set('Cookie', [`token=${token}`])
        .send({ active: false });

      expect(res.status).toBe(200);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            active: false,
            tokenVersion: { increment: 1 },
          }),
        })
      );
    });

    it('mustChangePassword continua bloqueando as demais rotas', async () => {
      const blockedUser = { ...adminUser, mustChangePassword: true };
      const token = createToken(blockedUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(blockedUser as any);

      const resClients = await request(app).get('/api/clients').set('Cookie', [`token=${token}`]);
      expect(resClients.status).toBe(403);
      expect(resClients.body.mustChangePassword).toBe(true);

      const resMe = await request(app).get('/api/auth/me').set('Cookie', [`token=${token}`]);
      expect(resMe.status).toBe(200);
    });
  });

  describe('8. Cobertura de rotas', () => {
    it('Toda rota sob /api deve exigir permissão', () => {
      const allowlist = [
        'POST /api/auth/login',
        'POST /api/auth/logout',
        'GET /api/auth/me',
        'POST /api/auth/change-password',
        'GET /api/health',
        'GET /api/settings/summary',
        'POST /api/files',
        'GET /api/files/:id',
        'DELETE /api/files/:id',
        'PATCH /api/payments/:id',
        'GET /api/operational-stages',
        // TODO F-01 / F-07: remover desta allowlist quando a guarda for adicionada
        'POST /api/files/logo',
        // logo público autenticado; restrito por regex e diretório
        'GET /api/files/public/:filename',
      ];

      function getRoutes(router: any, basePath = ''): any[] {
        let routes: any[] = [];
        if (!router || !router.stack) return routes;

        for (const layer of router.stack) {
          if (layer.route) {
            const path = basePath + layer.route.path;
            const methods = Object.keys(layer.route.methods).filter(m => layer.route.methods[m]).map(m => m.toUpperCase());
            const handlers = layer.route.stack.map((s: any) => s.name || s.handle?.name || 'anonymous');
            
            const isProtected = handlers.some((name: string) => 
              name === 'requirePermission' || 
              name === 'requireAnyPermission'
            );
            
            for (const method of methods) {
              routes.push({ method, path, isProtected });
            }
          } else if (layer.name === 'router' && layer.handle.stack) {
            let mountPath = '';
            if (layer.regexp) {
              const regexStr = layer.regexp.toString();
              if (regexStr.includes('^\\\\/')) {
                const prefix = regexStr.split('\\\\/')[1];
                if (prefix && prefix !== '?(?=') {
                  mountPath = '/' + prefix.replace(/\\\\/g, '');
                }
              }
            }
            routes = routes.concat(getRoutes(layer.handle, basePath + mountPath));
          }
        }
        return routes;
      }

      const allRoutes = getRoutes((app as any)._router);
      const unprotected: string[] = [];

      for (const r of allRoutes) {
        if (!r.path.startsWith('/api')) continue;
        const routeKey = `${r.method} ${r.path}`;
        
        if (!r.isProtected && !allowlist.includes(routeKey)) {
          unprotected.push(routeKey);
        }
      }

      if (unprotected.length > 0) {
        throw new Error(`As rotas a seguir estÃ£o sem guarda de permissÃ£o:\n${unprotected.join('\n')}`);
      }
    });
  });

  describe('9. F-08 Ocultar dados bancÃ¡rios em settings summary', () => {
    it('deve ocultar dados bancÃ¡rios se o usuÃ¡rio nÃ£o tiver settings.bank.view', async () => {
      const token = jwt.sign({ id: operUser.id, tokenVersion: 0 }, env.JWT_SECRET);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(operUser as any);
      vi.mocked(prisma.settings.findFirst).mockResolvedValue({
        id: 'set-1',
        agencyName: 'Minha AgÃªncia',
        pixKey: '12345678909',
        pixKeyType: 'CPF',
        bankName: 'Nubank',
        bankBranch: '0001',
        bankAccount: '12345-6',
        contactEmail: 'contato@agencia.com',
      } as any);

      const res = await request(app).get('/api/settings/summary').set('Cookie', [`token=${token}`]);
      expect(res.status).toBe(200);
      expect(res.body.agencyName).toBe('Minha AgÃªncia');
      expect(res.body.contactEmail).toBe('contato@agencia.com');
      
      // F-08: bank details must be null
      expect(res.body.pixKey).toBeNull();
      expect(res.body.pixKeyType).toBeNull();
      expect(res.body.bankName).toBeNull();
      expect(res.body.bankBranch).toBeNull();
      expect(res.body.bankAccount).toBeNull();
    });

    it('deve retornar dados bancÃ¡rios se o usuÃ¡rio tiver settings.bank.view', async () => {
      const token = jwt.sign({ id: adminUser.id, tokenVersion: 0 }, env.JWT_SECRET);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser as any);
      vi.mocked(prisma.settings.findFirst).mockResolvedValue({
        id: 'set-1',
        agencyName: 'Minha AgÃªncia',
        pixKey: '12345678909',
        pixKeyType: 'CPF',
        bankName: 'Nubank',
        bankBranch: '0001',
        bankAccount: '12345-6',
        contactEmail: 'contato@agencia.com',
      } as any);

      const res = await request(app).get('/api/settings/summary').set('Cookie', [`token=${token}`]);
      expect(res.status).toBe(200);
      expect(res.body.agencyName).toBe('Minha AgÃªncia');
      expect(res.body.contactEmail).toBe('contato@agencia.com');
      
      // F-08: bank details must be present
      expect(res.body.pixKey).toBe('12345678909');
      expect(res.body.pixKeyType).toBe('CPF');
      expect(res.body.bankName).toBe('Nubank');
      expect(res.body.bankBranch).toBe('0001');
      expect(res.body.bankAccount).toBe('12345-6');
    });
  });

  describe('10. F-09 Escalada de privilegio pelo gerenciamento de usuarios e grupos', () => {
    const userManagerUser = {
      id: 'usermgr-1',
      email: 'usermgr@agencia.com',
      name: 'Gerente de Usuarios',
      groups: [
        {
          groupId: 'g-usermgr',
          group: { id: 'g-usermgr', name: 'Gerencia Usuarios', permissions: ['users.manage', 'users.view'], isSystem: false },
        },
      ],
      active: true,
      mustChangePassword: false,
      tokenVersion: 0,
      passwordHash: '$2a$12$dummyhash',
      createdAt: new Date(),
    };

    const ADMIN_GROUP_ID = '11111111-1111-1111-1111-111111111111';

    it('usuario com users.manage fora do Admin recebe 403 ao criar usuario com o grupo Admin', async () => {
      const token = createToken(userManagerUser);
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(userManagerUser as any) // requireAuth
        .mockResolvedValueOnce(null); // existingUser (email livre)
      vi.mocked(prisma.group.count).mockResolvedValue(1);
      vi.mocked(prisma.group.findFirst).mockResolvedValue({ id: ADMIN_GROUP_ID, isSystem: true } as any);

      const res = await request(app)
        .post('/api/users')
        .set('Cookie', [`token=${token}`])
        .send({
          name: 'Novo Usuario',
          email: 'novo-usuario@agencia.com',
          // F-18: senha elevada para 12+ caracteres com letra e número
          password: 'SenhaForte2026',
          groupIds: [ADMIN_GROUP_ID],
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Apenas administradores/);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('usuario com users.manage fora do Admin recebe 403 ao adicionar Admin a outro usuario', async () => {
      const token = createToken(userManagerUser);
      const targetUser = { id: 'target-1', active: true, groups: [] };

      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(userManagerUser as any) // requireAuth
        .mockResolvedValueOnce(targetUser as any); // targetUser
      vi.mocked(prisma.group.count).mockResolvedValue(1);
      vi.mocked(prisma.group.findFirst).mockResolvedValue({ id: ADMIN_GROUP_ID, isSystem: true } as any);

      const res = await request(app)
        .patch('/api/users/target-1')
        .set('Cookie', [`token=${token}`])
        .send({ groupIds: [ADMIN_GROUP_ID] });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Apenas administradores/);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('usuario com users.manage fora do Admin recebe 403 ao remover alguem do Admin', async () => {
      const token = createToken(userManagerUser);
      const targetUser = { id: 'target-2', active: true, groups: [{ groupId: ADMIN_GROUP_ID }] };

      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(userManagerUser as any) // requireAuth
        .mockResolvedValueOnce(targetUser as any); // targetUser
      vi.mocked(prisma.group.count).mockResolvedValue(0);
      vi.mocked(prisma.group.findFirst).mockResolvedValue({ id: ADMIN_GROUP_ID, isSystem: true } as any);

      const res = await request(app)
        .patch('/api/users/target-2')
        .set('Cookie', [`token=${token}`])
        .send({ groupIds: [] });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Apenas administradores/);
    });

    it('Admin continua podendo criar usuario no grupo Admin e alterar o grupo Admin de outros', async () => {
      const token = createToken(adminUser);
      const targetUser = { id: 'target-3', active: true, groups: [] };

      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(adminUser as any) // requireAuth (POST)
        .mockResolvedValueOnce(null) // existingUser
        .mockResolvedValueOnce(adminUser as any) // requireAuth (PATCH)
        .mockResolvedValueOnce(targetUser as any); // targetUser (PATCH)
      vi.mocked(prisma.group.count).mockResolvedValue(1);
      vi.mocked(prisma.group.findFirst).mockResolvedValue({ id: ADMIN_GROUP_ID, isSystem: true } as any);
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 'novo-admin',
        name: 'Novo Admin',
        email: 'novo-admin@agencia.com',
        active: true,
        mustChangePassword: true,
        createdAt: new Date(),
        groups: [],
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({ id: 'target-3' } as any);

      const resCreate = await request(app)
        .post('/api/users')
        .set('Cookie', [`token=${token}`])
        .send({
          name: 'Novo Admin',
          email: 'novo-admin@agencia.com',
          // F-18: senha elevada para 12+ caracteres com letra e número
          password: 'SenhaForte2026',
          groupIds: [ADMIN_GROUP_ID],
        });
      expect(resCreate.status).toBe(201);

      const resPatch = await request(app)
        .patch('/api/users/target-3')
        .set('Cookie', [`token=${token}`])
        .send({ groupIds: [ADMIN_GROUP_ID] });
      expect(resPatch.status).toBe(200);
    });
  });
});
