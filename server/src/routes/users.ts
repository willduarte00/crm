import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../prisma.js';

export const usersRouter = Router();

const createUserSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido'),
  role: z.enum(['admin', 'membro']).default('membro'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'membro']).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

// GET /api/users - Listar usuários
usersRouter.get('/', async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      mustChangePassword: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(users);
});

// POST /api/users - Criar usuário (RF-09c: senha inicial definida pelo admin)
usersRouter.post('/', async (req: Request, res: Response) => {
  const { name, email, role, password } = createUserSchema.parse(req.body);

  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (existingUser) {
    return res.status(400).json({ error: 'E-mail já cadastrado' });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase().trim(),
      role,
      passwordHash,
      active: true,
      mustChangePassword: true, // Obrigatório trocar no primeiro acesso
      tokenVersion: 0,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      mustChangePassword: true,
      createdAt: true,
    },
  });

  return res.status(201).json(user);
});

// PATCH /api/users/:id - Atualizar usuário (RF-09, RF-09a, RF-09b)
usersRouter.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = updateUserSchema.parse(req.body);

  const targetUser = await prisma.user.findUnique({
    where: { id },
  });

  if (!targetUser) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  // RF-09a: Ninguém altera o próprio papel
  if (req.user && req.user.id === targetUser.id && data.role !== undefined && data.role !== targetUser.role) {
    return res.status(422).json({ error: 'Não é possível alterar o próprio papel' });
  }

  // RF-09: O último admin ativo não pode ser rebaixado nem desativado
  const isCurrentlyActiveAdmin = targetUser.role === 'admin' && targetUser.active === true;
  const isBeingDemoted = data.role !== undefined && data.role !== 'admin';
  const isBeingDeactivated = data.active === false;

  if (isCurrentlyActiveAdmin && (isBeingDemoted || isBeingDeactivated)) {
    const activeAdminCount = await prisma.user.count({
      where: {
        role: 'admin',
        active: true,
      },
    });

    if (activeAdminCount <= 1) {
      return res.status(422).json({
        error: 'Não é possível desativar ou rebaixar o único administrador ativo',
      });
    }
  }

  // Preparação dos dados para atualização
  const updatePayload: {
    name?: string;
    email?: string;
    role?: string;
    active?: boolean;
    passwordHash?: string;
    mustChangePassword?: boolean;
    tokenVersion?: { increment: number };
  } = {};

  if (data.name !== undefined) updatePayload.name = data.name;
  if (data.email !== undefined) updatePayload.email = data.email.toLowerCase().trim();
  if (data.role !== undefined) updatePayload.role = data.role;
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

  const updatedUser = await prisma.user.update({
    where: { id },
    data: updatePayload,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      mustChangePassword: true,
      createdAt: true,
    },
  });

  return res.json(updatedUser);
});
