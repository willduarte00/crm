import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env.js';
import { prisma } from '../prisma.js';
import { AuthUser } from '../types/express.js';
import { mergePermissions } from '../domain/permissions.js';

interface JwtPayload {
  id: string;
  tokenVersion: number;
}

const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/auth/login',
  '/api/health',
  '/health',
  '/api/files/public'
];

const MUST_CHANGE_PASSWORD_ALLOWED_ROUTES = [
  '/api/auth/change-password',
  '/auth/change-password',
  '/api/auth/logout',
  '/auth/logout',
  '/api/auth/me',
  '/auth/me',
];

export const setAuthCookie = (res: Response, user: { id: string; tokenVersion: number }) => {
  const token = jwt.sign(
    { id: user.id, tokenVersion: user.tokenVersion },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  const isSecure = env.APP_ENV === 'production';

  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
  });

  return token;
};

export const clearAuthCookie = (res: Response) => {
  const isSecure = env.APP_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure,
  });
};

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const path = req.path;
  const originalUrl = req.originalUrl.split('?')[0];

  // Allowlist pública
  if (
    PUBLIC_ROUTES.includes(path) ||
    PUBLIC_ROUTES.includes(originalUrl) ||
    originalUrl === '/api/auth/login' ||
    originalUrl === '/api/health' ||
    originalUrl.startsWith('/api/files/public/')
  ) {
    return next();
  }

  const token = req.cookies?.token || req.cookies?.auth_token;

  if (!token) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        active: true,
        mustChangePassword: true,
        tokenVersion: true,
        groups: { select: { group: { select: { id: true, name: true, permissions: true } } } },
      },
    });

    if (!user || !user.active || user.tokenVersion !== decoded.tokenVersion) {
      clearAuthCookie(res);
      return res.status(401).json({ error: 'Sessão inválida ou expirada' });
    }

    const groups = user.groups ? user.groups.map((g) => g.group) : [];
    const permissions = mergePermissions(groups);

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      mustChangePassword: user.mustChangePassword,
      active: user.active,
      tokenVersion: user.tokenVersion,
      groups,
      permissions,
    };

    req.user = authUser;

    // Se mustChangePassword for verdadeiro, bloqueia qualquer rota fora da lista permitida
    if (user.mustChangePassword) {
      const isAllowed =
        MUST_CHANGE_PASSWORD_ALLOWED_ROUTES.includes(path) ||
        MUST_CHANGE_PASSWORD_ALLOWED_ROUTES.includes(originalUrl);

      if (!isAllowed) {
        return res.status(403).json({
          error: 'Troca de senha obrigatória no primeiro acesso',
          mustChangePassword: true,
        });
      }
    }

    // Sessão deslizante: renova o cookie a cada requisição válida
    setAuthCookie(res, { id: user.id, tokenVersion: user.tokenVersion });

    return next();
  } catch {
    clearAuthCookie(res);
    return res.status(401).json({ error: 'Sessão inválida ou expirada' });
  }
}
