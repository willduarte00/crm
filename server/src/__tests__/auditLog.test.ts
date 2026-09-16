import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../app.js';
import { prisma } from '../prisma.js';
import { env } from '../env.js';
import { ADMIN_PERMISSIONS } from '../domain/defaultGroups.js';

vi.mock('../prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    group: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

describe('Auditoria (F-18)', () => {
  const adminUser = {
    id: 'admin-1',
    email: 'admin@agencia.com',
    name: 'Admin Teste',
    active: true,
    mustChangePassword: false,
    tokenVersion: 1,
    groups: [
      {
        group: {
          id: 'group-admin',
          name: 'Admin',
          isSystem: true,
          permissions: ADMIN_PERMISSIONS,
        },
      },
    ],
  };

  const noPermUser = {
    id: 'user-no-perm',
    email: 'noperm@agencia.com',
    name: 'User Sem Perm',
    active: true,
    mustChangePassword: false,
    tokenVersion: 1,
    groups: [],
  };

  const createToken = (user: any) =>
    jwt.sign({ id: user.id, tokenVersion: user.tokenVersion }, env.JWT_SECRET, { expiresIn: '7d' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registra auth.login.failed quando o usuário não existe', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ninguem@agencia.com', password: 'qualquercoisa' });

    expect(res.status).toBe(401);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'auth.login.failed',
          metadata: { email: 'ninguem@agencia.com' },
        }),
      })
    );
  });

  it('registra auth.login.success em login válido', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      email: 'membro@agencia.com',
      name: 'Membro',
      active: true,
      mustChangePassword: false,
      tokenVersion: 0,
      passwordHash: await (await import('bcryptjs')).default.hash('SenhaForte2026', 12),
      groups: [],
    } as any);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'membro@agencia.com', password: 'SenhaForte2026' });

    expect(res.status).toBe(200);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'auth.login.success' }),
      })
    );
  });

  it('POST /api/users rejeita senha com 8 caracteres com 400', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser as any);
    const token = createToken(adminUser);

    const res = await request(app)
      .post('/api/users')
      .set('Cookie', [`token=${token}`])
      .send({ name: 'Novo Usuário', email: 'novo@agencia.com', password: 'curta123' });

    expect(res.status).toBe(400);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  describe('GET /api/audit-logs', () => {
    it('exige a permissão audit.view', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(noPermUser as any);
      const token = createToken(noPermUser);

      const res = await request(app)
        .get('/api/audit-logs')
        .set('Cookie', [`token=${token}`]);

      expect(res.status).toBe(403);
      expect(res.body.requiredPermission).toBe('audit.view');
    });

    it('retorna a lista paginada para quem tem audit.view', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser as any);
      vi.mocked(prisma.auditLog.count).mockResolvedValue(1);
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
        { id: 'log-1', action: 'auth.login.success', createdAt: new Date() },
      ] as any);

      const token = createToken(adminUser);

      const res = await request(app)
        .get('/api/audit-logs')
        .set('Cookie', [`token=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.items).toHaveLength(1);
    });
  });
});
