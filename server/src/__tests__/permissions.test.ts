import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
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
    settings: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('Permissões — Testes de Integração', () => {
  const adminUser = {
    id: 'admin-1',
    email: 'admin@agencia.com',
    name: 'Admin Teste',
    role: 'admin',
    active: true,
    mustChangePassword: false,
    tokenVersion: 0,
    passwordHash: '$2a$12$dummyhash',
    createdAt: new Date(),
  };

  const memberUser = {
    id: 'member-1',
    email: 'membro@agencia.com',
    name: 'Membro Teste',
    role: 'membro',
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

  it('7. RF-08: membro recebe 403 em GET /api/users e em PUT /api/settings', async () => {
    const token = createToken(memberUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(memberUser);

    const resUsers = await request(app)
      .get('/api/users')
      .set('Cookie', [`token=${token}`]);
    expect(resUsers.status).toBe(403);
    expect(resUsers.body.error).toBe('Acesso restrito a administradores');

    const resSettings = await request(app)
      .put('/api/settings')
      .set('Cookie', [`token=${token}`])
      .send({ agencyName: 'Novo Nome' });
    expect(resSettings.status).toBe(403);
    expect(resSettings.body.error).toBe('Acesso restrito a administradores');
  });

  it('8. RF-08: admin recebe 200 nas mesmas rotas (GET /api/users e PUT /api/settings)', async () => {
    const token = createToken(adminUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser);
    vi.mocked(prisma.user.findMany).mockResolvedValue([adminUser]);
    vi.mocked(prisma.settings.findFirst).mockResolvedValue({
      id: 'settings-1',
      agencyName: 'Minha Agência',
      contactEmail: 'contato@agencia.com',
      phone: '11999999999',
      pixKey: null,
      pixKeyType: null,
      bankName: null,
      bankBranch: null,
      bankAccount: null,
      updatedAt: new Date(),
    });
    vi.mocked(prisma.settings.update).mockResolvedValue({
      id: 'settings-1',
      agencyName: 'Nome Atualizado',
      contactEmail: 'contato@agencia.com',
      phone: '11999999999',
      pixKey: null,
      pixKeyType: null,
      bankName: null,
      bankBranch: null,
      bankAccount: null,
      updatedAt: new Date(),
    });

    const resUsers = await request(app)
      .get('/api/users')
      .set('Cookie', [`token=${token}`]);
    expect(resUsers.status).toBe(200);

    const resSettings = await request(app)
      .put('/api/settings')
      .set('Cookie', [`token=${token}`])
      .send({ agencyName: 'Nome Atualizado' });
    expect(resSettings.status).toBe(200);
  });

  it('8a. RF-08a/RF-52: membro lê os dados da agência em GET /api/settings/summary', async () => {
    const token = createToken(memberUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(memberUser);
    vi.mocked(prisma.settings.findFirst).mockResolvedValue({
      id: 'settings-1',
      agencyName: 'Minha Agência',
      contactEmail: 'contato@agencia.com',
      phone: '11999999999',
      pixKey: '12345678000199',
      pixKeyType: 'CNPJ',
      bankName: null,
      bankBranch: null,
      bankAccount: null,
      updatedAt: new Date(),
    });

    // O membro usa o WhatsApp e precisa da chave PIX no lembrete de vencimento.
    const resSummary = await request(app)
      .get('/api/settings/summary')
      .set('Cookie', [`token=${token}`]);
    expect(resSummary.status).toBe(200);
    expect(resSummary.body.pixKey).toBe('12345678000199');
    expect(resSummary.body.agencyName).toBe('Minha Agência');

    // A leitura liberada não abre a edição nem o restante do módulo admin.
    const resSettings = await request(app)
      .get('/api/settings')
      .set('Cookie', [`token=${token}`]);
    expect(resSettings.status).toBe(403);
  });

  it('9. RF-08: o 403 acontece com chamada direta sem passar pela UI', async () => {
    const token = createToken(memberUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(memberUser);

    const res = await request(app)
      .get('/api/users')
      .set('Cookie', [`token=${token}`]);

    expect(res.status).toBe(403);
  });

  it('10. RF-09: rebaixar o último admin ativo retorna 422', async () => {
    const token = createToken(adminUser);
    // Chamada autenticada como admin-1
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(adminUser) // autenticação
      .mockResolvedValueOnce(adminUser); // busca do target admin-1

    vi.mocked(prisma.user.count).mockResolvedValue(1); // apenas 1 admin ativo

    const res = await request(app)
      .patch('/api/users/admin-1')
      .set('Cookie', [`token=${token}`])
      .send({ role: 'membro' });

    expect(res.status).toBe(422);
    // Deve ser bloqueado por RF-09a (alterar próprio papel) ou RF-09 (último admin)
    expect(res.body.error).toBeDefined();
  });

  it('11. RF-09: desativar o último admin ativo retorna 422', async () => {
    const admin2 = { ...adminUser, id: 'admin-2', email: 'admin2@agencia.com' };
    const token = createToken(adminUser);

    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(adminUser) // autenticação
      .mockResolvedValueOnce(admin2); // target admin-2

    vi.mocked(prisma.user.count).mockResolvedValue(1); // apenas 1 admin ativo no total

    const res = await request(app)
      .patch('/api/users/admin-2')
      .set('Cookie', [`token=${token}`])
      .send({ active: false });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain('Não é possível desativar ou rebaixar o único administrador ativo');
  });

  it('12. RF-09: rebaixar um admin quando existe outro ativo retorna 200', async () => {
    const admin2 = { ...adminUser, id: 'admin-2', email: 'admin2@agencia.com' };
    const token = createToken(adminUser);

    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(adminUser) // autenticação
      .mockResolvedValueOnce(admin2); // target admin-2

    vi.mocked(prisma.user.count).mockResolvedValue(2); // 2 admins ativos

    vi.mocked(prisma.user.update).mockResolvedValue({
      ...admin2,
      role: 'membro',
    });

    const res = await request(app)
      .patch('/api/users/admin-2')
      .set('Cookie', [`token=${token}`])
      .send({ role: 'membro' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('membro');
  });

  it('13. RF-09a: admin tentando alterar o próprio papel retorna 422', async () => {
    const token = createToken(adminUser);

    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(adminUser) // auth
      .mockResolvedValueOnce(adminUser); // target é ele mesmo

    const res = await request(app)
      .patch('/api/users/admin-1')
      .set('Cookie', [`token=${token}`])
      .send({ role: 'membro' });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('Não é possível alterar o próprio papel');
  });

  it('14. RF-09b: desativar um usuário incrementa tokenVersion e invalida a sessão aberta', async () => {
    const token = createToken(adminUser);
    const targetMember = { ...memberUser, active: true, tokenVersion: 0 };

    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(adminUser) // auth
      .mockResolvedValueOnce(targetMember); // target

    vi.mocked(prisma.user.update).mockResolvedValue({
      ...targetMember,
      active: false,
      tokenVersion: 1, // incrementado
    });

    const res = await request(app)
      .patch('/api/users/member-1')
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

  it('15. RF-09c: usuário com mustChangePassword é bloqueado nas demais rotas até trocar', async () => {
    const userMustChange = {
      ...memberUser,
      mustChangePassword: true,
    };
    const token = createToken(userMustChange);

    vi.mocked(prisma.user.findUnique).mockResolvedValue(userMustChange);

    // Rota comum deve ser bloqueada com 403
    const resClients = await request(app)
      .get('/api/clients')
      .set('Cookie', [`token=${token}`]);

    expect(resClients.status).toBe(403);
    expect(resClients.body.mustChangePassword).toBe(true);

    // Rota /me deve ser permitida
    const resMe = await request(app)
      .get('/api/auth/me')
      .set('Cookie', [`token=${token}`]);

    expect(resMe.status).toBe(200);
  });

  it('16. RF-09d: trocar a própria senha derruba as outras sessões do mesmo usuário (incrementa tokenVersion)', async () => {
    const hash = await bcrypt.hash('SenhaAntiga123', 12);
    const userWithHash = {
      ...memberUser,
      passwordHash: hash,
      tokenVersion: 0,
    };
    const token = createToken(userWithHash);

    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(userWithHash) // auth
      .mockResolvedValueOnce(userWithHash); // find user in change-password

    vi.mocked(prisma.user.update).mockResolvedValue({
      ...userWithHash,
      tokenVersion: 1,
      mustChangePassword: false,
    });

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', [`token=${token}`])
      .send({
        currentPassword: 'SenhaAntiga123',
        newPassword: 'NovaSenhaSegura456',
      });

    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mustChangePassword: false,
          tokenVersion: { increment: 1 },
        }),
      })
    );
  });
});
