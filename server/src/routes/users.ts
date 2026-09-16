import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../prisma.js';

export const usersRouter = Router();

const createUserSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido'),
  groupIds: z.array(z.string().uuid()).default([]),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  groupIds: z.array(z.string().uuid()).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

import { requirePermission } from '../middlewares/requirePermission.js';

// GET /api/users - Listar usuários
usersRouter.get('/', requirePermission('users.view'), async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      mustChangePassword: true,
      createdAt: true,
      groups: { select: { group: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const formattedUsers = users.map(user => {
    const { groups, ...rest } = user;
    return {
      ...rest,
      groups: groups.map(g => g.group),
    };
  });

  return res.json(formattedUsers);
});

// GET /api/users/basic - Listar usuários básicos (RF-22)
usersRouter.get('/basic', requirePermission('users.view_basic'), async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return res.json(users);
});

// POST /api/users - Criar usuário (RF-09c: senha inicial definida pelo admin)
usersRouter.post('/', requirePermission('users.manage'), async (req: Request, res: Response) => {
  const { name, email, groupIds, password } = createUserSchema.parse(req.body);

  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (existingUser) {
    return res.status(400).json({ error: 'E-mail já cadastrado' });
  }

  if (groupIds.length > 0) {
    const count = await prisma.group.count({ where: { id: { in: groupIds } } });
    if (count !== groupIds.length) {
      return res.status(400).json({ error: 'Um ou mais grupos fornecidos não existem' });
    }
  }

  // F-09: só quem já pertence ao grupo Admin pode conceder o grupo Admin a outro usuário
  const adminGroupOnCreate = await prisma.group.findFirst({ where: { isSystem: true } });
  if (adminGroupOnCreate && groupIds.includes(adminGroupOnCreate.id)) {
    const authorIsAdmin = req.user!.groups.some((g) => g.id === adminGroupOnCreate.id);
    if (!authorIsAdmin) {
      return res.status(403).json({ error: 'Apenas administradores podem conceder o grupo Admin.' });
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase().trim(),
      passwordHash,
      active: true,
      mustChangePassword: true, // Obrigatório trocar no primeiro acesso
      tokenVersion: 0,
      groups: {
        create: groupIds.map((groupId) => ({ groupId })),
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      mustChangePassword: true,
      createdAt: true,
      groups: { select: { group: { select: { id: true, name: true } } } },
    },
  });

  const formattedUser = {
    ...user,
    groups: user.groups.map(g => g.group),
  };

  return res.status(201).json(formattedUser);
});

// PATCH /api/users/:id - Atualizar usuário (RF-09, RF-09a, RF-09b)
usersRouter.patch('/:id', requirePermission('users.manage'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = updateUserSchema.parse(req.body);

  const targetUser = await prisma.user.findUnique({
    where: { id },
    include: { groups: true }
  });

  if (!targetUser) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  if (data.groupIds !== undefined && data.groupIds.length > 0) {
    const count = await prisma.group.count({ where: { id: { in: data.groupIds } } });
    if (count !== data.groupIds.length) {
      return res.status(400).json({ error: 'Um ou mais grupos fornecidos não existem' });
    }
  }

  // RF-28: Ninguém altera os próprios grupos
  if (req.user && req.user.id === targetUser.id && data.groupIds !== undefined) {
    return res.status(422).json({ error: 'Não é possível alterar os próprios grupos' });
  }

  const adminGroup = await prisma.group.findFirst({ where: { isSystem: true } });

  // F-09: só quem já pertence ao grupo Admin pode conceder ou remover o grupo Admin de alguém
  if (adminGroup && data.groupIds !== undefined) {
    const targetHasAdmin = targetUser.groups.some((g) => g.groupId === adminGroup.id);
    const newHasAdmin = data.groupIds.includes(adminGroup.id);
    if (newHasAdmin !== targetHasAdmin) {
      const authorIsAdmin = req.user!.groups.some((g) => g.id === adminGroup.id);
      if (!authorIsAdmin) {
        return res.status(403).json({ error: 'Apenas administradores podem conceder o grupo Admin.' });
      }
    }
  }

  // RF-10: O último admin ativo não pode ser removido nem desativado
  if (adminGroup) {
    const isTargetActiveAdmin = targetUser.active &&
      targetUser.groups.some((g) => g.groupId === adminGroup.id);
    const losesAdmin = data.groupIds !== undefined && !data.groupIds.includes(adminGroup.id);

    if (isTargetActiveAdmin && (losesAdmin || data.active === false)) {
      const activeAdmins = await prisma.user.count({
        where: { active: true, groups: { some: { groupId: adminGroup.id } } },
      });
      if (activeAdmins <= 1) {
        return res.status(422).json({
          error: 'Não é possível desativar ou remover o único administrador ativo',
        });
      }
    }
  }

  // Preparação dos dados para atualização
  const updatePayload: {
    name?: string;
    email?: string;
    active?: boolean;
    passwordHash?: string;
    mustChangePassword?: boolean;
    tokenVersion?: { increment: number };
  } = {};

  if (data.name !== undefined) updatePayload.name = data.name;
  if (data.email !== undefined) updatePayload.email = data.email.toLowerCase().trim();
  if (data.active !== undefined) {
    updatePayload.active = data.active;
    // RF-09b: Desativar incrementa tokenVersion e derruba a sessão aberta
    if (data.active === false && targetUser.active === true) {
      updatePayload.tokenVersion = { increment: 1 };
    }
  }

  // Se o admin resetar a senha do usuário
  if (data.password) {
    updatePayload.passwordHash = await bcrypt.hash(data.password, 12);
    updatePayload.mustChangePassword = true;
    updatePayload.tokenVersion = { increment: 1 };
  }

  await prisma.$transaction(async (tx) => {
    if (data.groupIds !== undefined) {
      await tx.userGroup.deleteMany({ where: { userId: id } });
      if (data.groupIds.length > 0) {
        await tx.userGroup.createMany({
          data: data.groupIds.map(groupId => ({ userId: id, groupId }))
        });
      }
    }
    
    if (Object.keys(updatePayload).length > 0) {
      await tx.user.update({
        where: { id },
        data: updatePayload
      });
    }
  });

  const updatedUser = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      mustChangePassword: true,
      createdAt: true,
      groups: { select: { group: { select: { id: true, name: true } } } },
    }
  });

  const formattedUser = {
    ...updatedUser,
    groups: updatedUser!.groups.map(g => g.group),
  };

  return res.json(formattedUser);
});
