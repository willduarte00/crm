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
    operationalStage: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    operationalTask: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const createToken = (user: { id: string; tokenVersion: number }) =>
  jwt.sign({ id: user.id, tokenVersion: user.tokenVersion }, env.JWT_SECRET, {
    expiresIn: '7d',
  });

const adminUser = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  email: 'admin@agencia.com',
  name: 'Admin Teste',
  role: 'admin',
  groups: [{ group: { id: 'g-admin', name: 'Admin', permissions: ['settings.update'] } }],
  active: true,
  mustChangePassword: false,
  tokenVersion: 0,
  passwordHash: 'hash',
  createdAt: new Date(),
};

const memberUser = {
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  email: 'membro@agencia.com',
  name: 'Membro Teste',
  role: 'membro',
  active: true,
  mustChangePassword: false,
  tokenVersion: 0,
  passwordHash: 'hash',
  createdAt: new Date(),
};

const sampleStage = {
  id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  name: 'Onboarding',
  description: null,
  color: 'blue',
  position: 0,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { tasks: 0 },
};

describe('Pipeline Operacional — Etapas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/operational-stages', () => {
    it('membro recebe 200 com a lista de etapas', async () => {
      const token = createToken(memberUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(memberUser);
      vi.mocked(prisma.operationalStage.findMany).mockResolvedValue([sampleStage]);

      const res = await request(app)
        .get('/api/operational-stages')
        .set('Cookie', [`token=${token}`]);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Onboarding');
    });

    it('admin recebe 200 com a lista de etapas', async () => {
      const token = createToken(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser);
      vi.mocked(prisma.operationalStage.findMany).mockResolvedValue([sampleStage]);

      const res = await request(app)
        .get('/api/operational-stages')
        .set('Cookie', [`token=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it('não autenticado recebe 401', async () => {
      const res = await request(app).get('/api/operational-stages');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/operational-stages', () => {
    it('membro recebe 403', async () => {
      const token = createToken(memberUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(memberUser);

      const res = await request(app)
        .post('/api/operational-stages')
        .set('Cookie', [`token=${token}`])
        .send({ name: 'Nova Etapa', color: 'blue' });

      expect(res.status).toBe(403);
    });

    it('admin cria etapa com sucesso', async () => {
      const token = createToken(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser);
      vi.mocked(prisma.operationalStage.findUnique).mockResolvedValue(null); // nome não duplicado
      vi.mocked(prisma.operationalStage.findFirst).mockResolvedValue(sampleStage); // max position
      vi.mocked(prisma.operationalStage.create).mockResolvedValue({ ...sampleStage, id: 'new-id', name: 'Nova Etapa', position: 1 });

      const res = await request(app)
        .post('/api/operational-stages')
        .set('Cookie', [`token=${token}`])
        .send({ name: 'Nova Etapa', color: 'rose' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Nova Etapa');
    });

    it('admin recebe 400 ao criar etapa com nome duplicado', async () => {
      const token = createToken(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser);
      vi.mocked(prisma.operationalStage.findUnique).mockResolvedValue(sampleStage); // já existe

      const res = await request(app)
        .post('/api/operational-stages')
        .set('Cookie', [`token=${token}`])
        .send({ name: 'Onboarding', color: 'blue' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/já existe/i);
    });
  });

  describe('PATCH /api/operational-stages/:id', () => {
    it('membro recebe 403', async () => {
      const token = createToken(memberUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(memberUser);

      const res = await request(app)
        .patch(`/api/operational-stages/${sampleStage.id}`)
        .set('Cookie', [`token=${token}`])
        .send({ name: 'Alterado' });

      expect(res.status).toBe(403);
    });

    it('422 ao desativar etapa com demandas ativas', async () => {
      const token = createToken(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser);
      vi.mocked(prisma.operationalStage.findUnique).mockResolvedValue(sampleStage);
      vi.mocked(prisma.operationalTask.count).mockResolvedValue(3); // 3 demandas ativas

      const res = await request(app)
        .patch(`/api/operational-stages/${sampleStage.id}`)
        .set('Cookie', [`token=${token}`])
        .send({ active: false });

      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(/3 demandas/i);
    });

    it('422 ao desativar a última etapa ativa', async () => {
      const token = createToken(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser);
      vi.mocked(prisma.operationalStage.findUnique).mockResolvedValue(sampleStage);
      vi.mocked(prisma.operationalTask.count).mockResolvedValue(0); // sem demandas
      vi.mocked(prisma.operationalStage.count).mockResolvedValue(1); // só 1 ativa

      const res = await request(app)
        .patch(`/api/operational-stages/${sampleStage.id}`)
        .set('Cookie', [`token=${token}`])
        .send({ active: false });

      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(/última etapa ativa/i);
    });
  });

  describe('PATCH /api/operational-stages/reorder', () => {
    it('membro recebe 403', async () => {
      const token = createToken(memberUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(memberUser);

      const res = await request(app)
        .patch('/api/operational-stages/reorder')
        .set('Cookie', [`token=${token}`])
        .send({ ids: [sampleStage.id] });

      expect(res.status).toBe(403);
    });

    it('admin aplica reordenação e recebe lista atualizada', async () => {
      const token = createToken(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser);

      const id1 = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
      const id2 = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

      vi.mocked(prisma.$transaction).mockResolvedValue([]);
      vi.mocked(prisma.operationalStage.findMany).mockResolvedValue([
        { ...sampleStage, id: id1, position: 0 },
        { ...sampleStage, id: id2, name: 'Briefing', position: 1 },
      ]);

      const res = await request(app)
        .patch('/api/operational-stages/reorder')
        .set('Cookie', [`token=${token}`])
        .send({ ids: [id1, id2] });

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(prisma.$transaction).toHaveBeenCalledOnce();
    });
  });

  describe('DELETE /api/operational-stages/:id', () => {
    it('membro recebe 403', async () => {
      const token = createToken(memberUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(memberUser);

      const res = await request(app)
        .delete(`/api/operational-stages/${sampleStage.id}`)
        .set('Cookie', [`token=${token}`]);

      expect(res.status).toBe(403);
    });

    it('422 ao excluir etapa com demandas ativas', async () => {
      const token = createToken(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser);
      vi.mocked(prisma.operationalStage.findUnique).mockResolvedValue(sampleStage);
      vi.mocked(prisma.operationalTask.count).mockResolvedValue(2);

      const res = await request(app)
        .delete(`/api/operational-stages/${sampleStage.id}`)
        .set('Cookie', [`token=${token}`]);

      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(/2 demandas/i);
    });

    it('422 ao excluir a última etapa ativa', async () => {
      const token = createToken(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser);
      vi.mocked(prisma.operationalStage.findUnique).mockResolvedValue(sampleStage);
      vi.mocked(prisma.operationalTask.count).mockResolvedValue(0);
      vi.mocked(prisma.operationalStage.count).mockResolvedValue(1);

      const res = await request(app)
        .delete(`/api/operational-stages/${sampleStage.id}`)
        .set('Cookie', [`token=${token}`]);

      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(/última etapa ativa/i);
    });

    it('admin exclui etapa com sucesso', async () => {
      const token = createToken(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser);
      vi.mocked(prisma.operationalStage.findUnique).mockResolvedValue(sampleStage);
      vi.mocked(prisma.operationalTask.count).mockResolvedValue(0);
      vi.mocked(prisma.operationalStage.count).mockResolvedValue(3); // há outras ativas
      vi.mocked(prisma.operationalStage.delete).mockResolvedValue(sampleStage);

      const res = await request(app)
        .delete(`/api/operational-stages/${sampleStage.id}`)
        .set('Cookie', [`token=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
