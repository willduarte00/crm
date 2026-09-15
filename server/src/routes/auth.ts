import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { setAuthCookie, clearAuthCookie } from '../middlewares/requireAuth.js';
import { mergePermissions } from '../domain/permissions.js';

export const authRouter = Router();

// Rate limit: 5 tentativas por IP a cada 15 minutos
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  validate: { xForwardedForHeader: false },
});

const accountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => String(req.body?.email ?? '').toLowerCase().trim() || req.ip || 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Muitas tentativas para esta conta. Tente novamente em 15 minutos.' },
  validate: { xForwardedForHeader: false },
});

const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.id || req.ip || 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
  validate: { xForwardedForHeader: false },
});

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: z.string().min(8, 'A nova senha deve ter no mínimo 8 caracteres'),
});

// POST /api/auth/login
authRouter.post('/login', loginLimiter, accountLimiter, async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: {
      groups: { select: { group: { select: { id: true, name: true, permissions: true } } } },
    },
  });

  if (!user || !user.active) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  setAuthCookie(res, { id: user.id, tokenVersion: user.tokenVersion });

  const groups = user.groups ? user.groups.map((g) => g.group) : [];
  const permissions = [...mergePermissions(groups)];

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      mustChangePassword: user.mustChangePassword,
      groups: groups.map((g) => ({ id: g.id, name: g.name })),
      permissions,
    },
  });
});

// POST /api/auth/logout
authRouter.post('/logout', (_req: Request, res: Response) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
});

// GET /api/auth/me
authRouter.get('/me', (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  return res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      mustChangePassword: req.user.mustChangePassword,
      groups: req.user.groups.map(({ id, name }) => ({ id, name })),
      permissions: [...req.user.permissions],
    },
  });
});

// POST /api/auth/change-password (RF-09c e RF-09d)
authRouter.post('/change-password', changePasswordLimiter, async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
  });

  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isPasswordValid) {
    return res.status(400).json({ error: 'Senha atual incorreta' });
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 12);
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newPasswordHash,
      mustChangePassword: false,
      tokenVersion: { increment: 1 },
    },
  });

  // Atualiza cookie da sessão corrente com o novo tokenVersion
  setAuthCookie(res, { id: updatedUser.id, tokenVersion: updatedUser.tokenVersion });

  return res.json({
    ok: true,
    message: 'Senha alterada com sucesso',
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      mustChangePassword: false,
      groups: req.user.groups.map(({ id, name }) => ({ id, name })),
      permissions: [...req.user.permissions],
    },
  });
});
