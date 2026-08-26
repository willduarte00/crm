import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../app.js';
import { prisma } from '../prisma.js';
import { env } from '../env.js';
import { PERMISSION_CATALOG, SCREEN_DEPENDENCIES } from '../domain/permissions.js';

vi.mock('../prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    group: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe('Groups API', () => {
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
          permissions: ['groups.manage', 'groups.view']
        }
      }
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
    jwt.sign({ id: user.id, tokenVersion: user.tokenVersion }, env.JWT_SECRET, {
      expiresIn: '7d',
    });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/permissions', () => {
    it('should return the permission catalog and screen dependencies', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser as any);
      const token = createToken(adminUser);

      const res = await request(app)
        .get('/api/permissions')
        .set('Cookie', [`token=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.permissions).toBeDefined();
      expect(res.body.screenDependencies).toEqual(SCREEN_DEPENDENCIES);
    });

    it('should return 403 for user without groups.view', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(noPermUser as any);
      const token = createToken(noPermUser);

      const res = await request(app)
        .get('/api/permissions')
        .set('Cookie', [`token=${token}`]);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/groups', () => {
    it('should return the list of groups with user count', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser as any);
      vi.mocked(prisma.group.findMany).mockResolvedValue([
        { id: '1', name: 'G1', description: 'Desc', isSystem: false, permissions: [], createdAt: new Date(), updatedAt: new Date(), _count: { users: 5 } } as any
      ]);

      const token = createToken(adminUser);

      const res = await request(app)
        .get('/api/groups')
        .set('Cookie', [`token=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].userCount).toBe(5);
    });

    it('should return 403 for user without groups.view', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(noPermUser as any);
      const token = createToken(noPermUser);

      const res = await request(app)
        .get('/api/groups')
        .set('Cookie', [`token=${token}`]);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/groups', () => {
    it('should create a new group', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser as any);
      vi.mocked(prisma.group.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.group.create).mockResolvedValue({ id: '2', name: 'G2' } as any);

      const token = createToken(adminUser);

      const res = await request(app)
        .post('/api/groups')
        .set('Cookie', [`token=${token}`])
        .send({
          name: 'G2',
          description: 'Desc',
          permissions: ['clients.view']
        });

      expect(res.status).toBe(201);
      expect(prisma.group.create).toHaveBeenCalledWith({
        data: {
          name: 'G2',
          description: 'Desc',
          permissions: ['clients.view']
        }
      });
    });

    it('should return 400 for duplicated name', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser as any);
      vi.mocked(prisma.group.findUnique).mockResolvedValue({ id: '1', name: 'G1' } as any);

      const token = createToken(adminUser);

      const res = await request(app)
        .post('/api/groups')
        .set('Cookie', [`token=${token}`])
        .send({
          name: 'G1',
          permissions: []
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/já existe/i);
    });

    it('should return 400 for invalid permission', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser as any);

      const token = createToken(adminUser);

      const res = await request(app)
        .post('/api/groups')
        .set('Cookie', [`token=${token}`])
        .send({
          name: 'G3',
          permissions: ['invalid.permission']
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/inválida/i);
    });

    it('should return 422 for screen dependency violation', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser as any);

      const token = createToken(adminUser);

      const res = await request(app)
        .post('/api/groups')
        .set('Cookie', [`token=${token}`])
        .send({
          name: 'G4',
          permissions: ['screen.clientes']
        });

      expect(res.status).toBe(422);
      expect(res.body.violations).toBeDefined();
      expect(res.body.violations[0].screen).toBe('screen.clientes');
    });

    it('should return 403 for user without groups.manage', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(noPermUser as any);
      const token = createToken(noPermUser);

      const res = await request(app)
        .post('/api/groups')
        .set('Cookie', [`token=${token}`])
        .send({ name: 'G5', permissions: [] });

      expect(res.status).toBe(403);
    });
    
    it('screen.dashboard aceita com só dashboard.financial.view; aceita com só dashboard.operational.view; rejeitada sem nenhuma das duas', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser as any);
      const token = createToken(adminUser);
      vi.mocked(prisma.group.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.group.create).mockResolvedValue({ id: 'dashboard-group' } as any);

      // Rejeita
      let res = await request(app).post('/api/groups').set('Cookie', [`token=${token}`])
        .send({ name: 'D1', permissions: ['screen.dashboard'] });
      expect(res.status).toBe(422);

      // Aceita financial
      res = await request(app).post('/api/groups').set('Cookie', [`token=${token}`])
        .send({ name: 'D2', permissions: ['screen.dashboard', 'dashboard.financial.view'] });
      expect(res.status).toBe(201);

      // Aceita operational
      res = await request(app).post('/api/groups').set('Cookie', [`token=${token}`])
        .send({ name: 'D3', permissions: ['screen.dashboard', 'dashboard.operational.view'] });
      expect(res.status).toBe(201);
    });
  });

  describe('PATCH /api/groups/:id', () => {
    it('should update a group', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser as any);
      vi.mocked(prisma.group.findUnique).mockImplementation(async (args: any) => {
        if (args.where.id === '1') return { id: '1', name: 'G1', permissions: [] } as any;
        return null;
      });
      vi.mocked(prisma.group.update).mockResolvedValue({ id: '1', name: 'G2' } as any);

      const token = createToken(adminUser);

      const res = await request(app)
        .patch('/api/groups/1')
        .set('Cookie', [`token=${token}`])
        .send({
          name: 'G2'
        });

      expect(res.status).toBe(200);
      expect(prisma.group.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { name: 'G2', permissions: undefined, description: undefined }
      });
    });

    it('should return 422 when trying to update a system group', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser as any);
      vi.mocked(prisma.group.findUnique).mockResolvedValue({ id: '1', name: 'G1', isSystem: true, permissions: [] } as any);

      const token = createToken(adminUser);

      const res = await request(app)
        .patch('/api/groups/1')
        .set('Cookie', [`token=${token}`])
        .send({ name: 'G2' });

      expect(res.status).toBe(422);
    });
  });

  describe('DELETE /api/groups/:id', () => {
    it('should delete a group without users', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser as any);
      vi.mocked(prisma.group.findUnique).mockResolvedValue({ id: '1', name: 'G1', isSystem: false, _count: { users: 0 } } as any);
      vi.mocked(prisma.group.delete).mockResolvedValue({ id: '1' } as any);

      const token = createToken(adminUser);

      const res = await request(app)
        .delete('/api/groups/1')
        .set('Cookie', [`token=${token}`]);

      expect(res.status).toBe(204);
    });

    it('should return 422 when deleting a group with users', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser as any);
      vi.mocked(prisma.group.findUnique).mockResolvedValue({ id: '1', name: 'G1', isSystem: false, _count: { users: 5 } } as any);

      const token = createToken(adminUser);

      const res = await request(app)
        .delete('/api/groups/1')
        .set('Cookie', [`token=${token}`]);

      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(/5/);
    });

    it('should return 422 when deleting a system group', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser as any);
      vi.mocked(prisma.group.findUnique).mockResolvedValue({ id: '1', name: 'G1', isSystem: true, _count: { users: 0 } } as any);

      const token = createToken(adminUser);

      const res = await request(app)
        .delete('/api/groups/1')
        .set('Cookie', [`token=${token}`]);

      expect(res.status).toBe(422);
    });
    
    it('should return 422 when Prisma throws a P2003 error (FK violation)', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser as any);
      vi.mocked(prisma.group.findUnique).mockResolvedValue({ id: '1', name: 'G1', isSystem: false, _count: { users: 0 } } as any);
      
      const p2003Error = new Error('Prisma FK');
      (p2003Error as any).code = 'P2003';
      vi.mocked(prisma.group.delete).mockRejectedValue(p2003Error);
      
      const token = createToken(adminUser);
      
      const res = await request(app)
        .delete('/api/groups/1')
        .set('Cookie', [`token=${token}`]);
        
      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(/vinculado/);
    });
  });
});
