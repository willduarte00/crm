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
      findFirst: vi.fn(),
    },
    operationalStage: {
      findUnique: vi.fn(),
    },
    operationalTask: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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
  groups: [{ group: { id: 'g-admin', name: 'Admin', permissions: ['operational_tasks.view', 'operational_tasks.create', 'operational_tasks.update', 'operational_tasks.delete'] } }],
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
};

const inactiveStage = { ...sampleStage, id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', active: false };

const sampleClient = {
  id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  name: 'Cliente Teste',
  tradeName: null,
  deletedAt: null,
};

const sampleTask = {
  id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  clientId: sampleClient.id,
  stageId: sampleStage.id,
  title: 'Tarefa de teste',
  description: null,
  priority: 'media',
  dueDate: null,
  ownerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  stage: sampleStage,
  owner: null,
  client: { id: sampleClient.id, name: sampleClient.name, tradeName: null },
};

describe('Pipeline Operacional — Demandas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/operational-tasks', () => {
    it('membro sem permissao recebe 403', async () => {
      const token = createToken(memberUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(memberUser);

      const res = await request(app)
        .get('/api/operational-tasks')
        .set('Cookie', [`token=${token}`]);

      expect(res.status).toBe(403);
    });

    it('admin recebe 200', async () => {
      const token = createToken(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser);
      vi.mocked(prisma.operationalTask.findMany).mockResolvedValue([sampleTask]);

      const res = await request(app)
        .get('/api/operational-tasks')
        .set('Cookie', [`token=${token}`]);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].title).toBe('Tarefa de teste');
    });

    it('não autenticado recebe 401', async () => {
      const res = await request(app).get('/api/operational-tasks');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/operational-tasks', () => {
    it('membro sem permissao recebe 403', async () => {
      const token = createToken(memberUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(memberUser);

      const res = await request(app)
        .post('/api/operational-tasks')
        .set('Cookie', [`token=${token}`])
        .send({
          clientId: sampleClient.id,
          stageId: sampleStage.id,
          title: 'Tarefa de teste',
        });

      expect(res.status).toBe(403);
    });

    it('cria tarefa com sucesso', async () => {
      const token = createToken(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser);
      vi.mocked(prisma.operationalStage.findUnique).mockResolvedValue(sampleStage);
      vi.mocked(prisma.client.findFirst).mockResolvedValue(sampleClient);
      vi.mocked(prisma.operationalTask.create).mockResolvedValue(sampleTask);

      const res = await request(app)
        .post('/api/operational-tasks')
        .set('Cookie', [`token=${token}`])
        .send({
          clientId: sampleClient.id,
          stageId: sampleStage.id,
          title: 'Tarefa de teste',
        });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Tarefa de teste');
    });

    it('422 ao criar tarefa com stageId inativo', async () => {
      const token = createToken(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser);
      vi.mocked(prisma.operationalStage.findUnique).mockResolvedValue(inactiveStage);
      vi.mocked(prisma.client.findFirst).mockResolvedValue(sampleClient);

      const res = await request(app)
        .post('/api/operational-tasks')
        .set('Cookie', [`token=${token}`])
        .send({
          clientId: sampleClient.id,
          stageId: inactiveStage.id,
          title: 'Tarefa inválida',
        });

      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(/inativa/i);
    });

    it('422 ao criar tarefa com cliente inexistente', async () => {
      const token = createToken(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser);
      vi.mocked(prisma.operationalStage.findUnique).mockResolvedValue(sampleStage);
      vi.mocked(prisma.client.findFirst).mockResolvedValue(null); // cliente não encontrado

      const res = await request(app)
        .post('/api/operational-tasks')
        .set('Cookie', [`token=${token}`])
        .send({
          clientId: sampleClient.id,
          stageId: sampleStage.id,
          title: 'Tarefa com cliente inválido',
        });

      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(/cliente/i);
    });
  });

  describe('PATCH /api/operational-tasks/:id/stage', () => {
    it('membro sem permissao recebe 403', async () => {
      const token = createToken(memberUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(memberUser);

      const res = await request(app)
        .patch(`/api/operational-tasks/${sampleTask.id}/stage`)
        .set('Cookie', [`token=${token}`])
        .send({ stageId: sampleStage.id });

      expect(res.status).toBe(403);
    });

    it('move card com sucesso', async () => {
      const newStage = { ...sampleStage, id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', name: 'Briefing', color: 'amber' };
      const token = createToken(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser);
      vi.mocked(prisma.operationalTask.findFirst).mockResolvedValue(sampleTask);
      vi.mocked(prisma.operationalStage.findUnique).mockResolvedValue(newStage);
      vi.mocked(prisma.operationalTask.update).mockResolvedValue({
        ...sampleTask,
        stageId: newStage.id,
        stage: newStage,
      });

      const res = await request(app)
        .patch(`/api/operational-tasks/${sampleTask.id}/stage`)
        .set('Cookie', [`token=${token}`])
        .send({ stageId: newStage.id });

      expect(res.status).toBe(200);
      expect(res.body.stageId).toBe(newStage.id);
    });

    it('422 ao mover para etapa inativa', async () => {
      const token = createToken(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser);
      vi.mocked(prisma.operationalTask.findFirst).mockResolvedValue(sampleTask);
      vi.mocked(prisma.operationalStage.findUnique).mockResolvedValue(inactiveStage);

      const res = await request(app)
        .patch(`/api/operational-tasks/${sampleTask.id}/stage`)
        .set('Cookie', [`token=${token}`])
        .send({ stageId: inactiveStage.id });

      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(/inativa/i);
    });
  });

  describe('DELETE /api/operational-tasks/:id', () => {
    it('membro sem permissao recebe 403', async () => {
      const token = createToken(memberUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(memberUser);

      const res = await request(app)
        .delete(`/api/operational-tasks/${sampleTask.id}`)
        .set('Cookie', [`token=${token}`]);

      expect(res.status).toBe(403);
    });

    it('soft delete — task some da listagem', async () => {
      const token = createToken(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser);
      vi.mocked(prisma.operationalTask.findFirst).mockResolvedValue(sampleTask);
      vi.mocked(prisma.operationalTask.update).mockResolvedValue({
        ...sampleTask,
        deletedAt: new Date(),
      });

      const res = await request(app)
        .delete(`/api/operational-tasks/${sampleTask.id}`)
        .set('Cookie', [`token=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(prisma.operationalTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: sampleTask.id },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        })
      );
    });

    it('404 ao tentar excluir demanda inexistente', async () => {
      const token = createToken(adminUser);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser);
      vi.mocked(prisma.operationalTask.findFirst).mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/operational-tasks/00000000-0000-0000-0000-000000000000')
        .set('Cookie', [`token=${token}`]);

      expect(res.status).toBe(404);
    });
  });
});
