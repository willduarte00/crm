import { Router } from 'express';
import { prisma } from '../prisma.js';
import { z } from 'zod';
import { requirePermission } from '../middlewares/requirePermission.js';
import { isValidPermission, findScreenDependencyViolations } from '../domain/permissions.js';
import { logAudit } from '../services/auditService.js';

export const groupsRouter = Router();

const groupSchema = z.object({
  name: z.string().min(1, 'Nome do grupo é obrigatório'),
  description: z.string().optional().nullable(),
  permissions: z.array(z.string()),
});

const updateGroupSchema = z.object({
  name: z.string().min(1, 'Nome do grupo é obrigatório').optional(),
  description: z.string().optional().nullable(),
  permissions: z.array(z.string()).optional(),
});

groupsRouter.get('/', requirePermission('groups.view'), async (req, res, next) => {
  try {
    const groups = await prisma.group.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { users: true }
        }
      }
    });

    res.json(
      groups.map(g => ({
        id: g.id,
        name: g.name,
        description: g.description,
        isSystem: g.isSystem,
        permissions: g.permissions,
        userCount: g._count.users
      }))
    );
  } catch (error) {
    next(error);
  }
});

groupsRouter.post('/', requirePermission('groups.manage'), async (req, res, next) => {
  try {
    const data = groupSchema.parse(req.body);

    for (const perm of data.permissions) {
      if (!isValidPermission(perm)) {
        return res.status(400).json({ error: `Permissão inválida: ${perm}` });
      }
    }

    // F-09: não permite conceder permissões que o próprio autor não possui
    const missingPermissions = data.permissions.filter((perm) => !req.user!.permissions.has(perm));
    if (missingPermissions.length > 0) {
      return res.status(403).json({
        error: 'Você não pode conceder permissões que não possui.',
        missing: missingPermissions,
      });
    }

    const violations = findScreenDependencyViolations(data.permissions);
    if (violations.length > 0) {
      return res.status(422).json({
        error: 'Uma permissão de tela exige a permissão de leitura correspondente.',
        violations
      });
    }

    const existing = await prisma.group.findUnique({ where: { name: data.name } });
    if (existing) {
      return res.status(400).json({ error: 'Já existe um grupo com este nome.' });
    }

    const newGroup = await prisma.group.create({
      data: {
        name: data.name,
        description: data.description || null,
        permissions: data.permissions
      }
    });

    await logAudit({ req, action: 'group.created', targetType: 'group', targetId: newGroup.id, metadata: { name: newGroup.name } });

    res.status(201).json(newGroup);
  } catch (error) {
    next(error);
  }
});

groupsRouter.patch('/:id', requirePermission('groups.manage'), async (req, res, next) => {
  try {
    const id = req.params.id;
    const data = updateGroupSchema.parse(req.body);

    const group = await prisma.group.findUnique({ where: { id } });
    if (!group) {
      return res.status(404).json({ error: 'Grupo não encontrado.' });
    }

    if (group.isSystem) {
      return res.status(422).json({ error: 'O grupo Admin não pode ser alterado nem excluído.' });
    }

    if (data.name && data.name !== group.name) {
      const existing = await prisma.group.findUnique({ where: { name: data.name } });
      if (existing) {
        return res.status(400).json({ error: 'Já existe um grupo com este nome.' });
      }
    }

    const finalPermissions = data.permissions !== undefined ? data.permissions : group.permissions;
    
    if (data.permissions !== undefined) {
      for (const perm of data.permissions) {
        if (!isValidPermission(perm)) {
          return res.status(400).json({ error: `Permissão inválida: ${perm}` });
        }
      }

      // F-09: não permite conceder permissões que o próprio autor não possui
      const missingPermissions = data.permissions.filter((perm) => !req.user!.permissions.has(perm));
      if (missingPermissions.length > 0) {
        return res.status(403).json({
          error: 'Você não pode conceder permissões que não possui.',
          missing: missingPermissions,
        });
      }

      const violations = findScreenDependencyViolations(finalPermissions);
      if (violations.length > 0) {
        return res.status(422).json({
          error: 'Uma permissão de tela exige a permissão de leitura correspondente.',
          violations
        });
      }
    }

    const updated = await prisma.group.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description !== undefined ? data.description : undefined,
        permissions: data.permissions
      }
    });

    await logAudit({ req, action: 'group.updated', targetType: 'group', targetId: id, metadata: { changedFields: Object.keys(data) } });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

groupsRouter.delete('/:id', requirePermission('groups.manage'), async (req, res, next) => {
  try {
    const id = req.params.id;
    
    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true }
        }
      }
    });

    if (!group) {
      return res.status(404).json({ error: 'Grupo não encontrado.' });
    }

    if (group.isSystem) {
      return res.status(422).json({ error: 'O grupo Admin não pode ser alterado nem excluído.' });
    }

    if (group._count.users > 0) {
      return res.status(422).json({ 
        error: `Este grupo tem ${group._count.users} usuário(s) vinculado(s). Desvincule antes de excluir.` 
      });
    }

    try {
      await prisma.group.delete({ where: { id } });
      await logAudit({ req, action: 'group.deleted', targetType: 'group', targetId: id, metadata: { name: group.name } });
      res.status(204).send();
    } catch (e: any) {
      if (e.code === 'P2003') { // Prisma FK violation
        return res.status(422).json({ 
          error: `Este grupo tem usuário(s) vinculado(s). Desvincule antes de excluir.` 
        });
      }
      throw e;
    }

  } catch (error) {
    next(error);
  }
});
