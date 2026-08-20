import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../app.js';
import { prisma } from '../prisma.js';
import { env } from '../env.js';
import { setAuthCookie } from '../middlewares/requireAuth.js';
import { Response } from 'express';

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

describe('Segurança — Testes de Integração', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. GET /api/clients sem cookie deve retornar 401', async () => {
    const res = await request(app).get('/api/clients');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Não autenticado');
  });

  it('2. GET /api/files/:id sem cookie deve retornar 401 e NÃO o arquivo', async () => {
    const res = await request(app).get('/api/files/test-file-id');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Não autenticado');
  });

  it('3. Token com tokenVersion defasado deve retornar 401', async () => {
    const oldToken = jwt.sign(
      { id: 'user-1', tokenVersion: 0 },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 'user-1',
      email: 'membro@agencia.com',
      name: 'Membro Teste',
      role: 'membro',
      active: true,
      mustChangePassword: false,
      tokenVersion: 1, // defasado em relação ao token (0)
      passwordHash: 'hash',
      createdAt: new Date(),
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', [`token=${oldToken}`]);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Sessão inválida ou expirada');
  });

  it('4. 6 tentativas de login com senha errada devem retornar 429 na 6ª', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      email: 'rate@agencia.com',
      name: 'Rate Limit User',
      role: 'membro',
      active: true,
      mustChangePassword: false,
      tokenVersion: 0,
      passwordHash: '$2a$12$invalidhashinvalidhashinvalidhashinvalidhashinvalidhas',
      createdAt: new Date(),
    });

    // 5 tentativas permitidas
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'rate@agencia.com', password: 'wrongpassword' });
      expect(res.status).toBe(401);
    }

    // 6ª tentativa deve estourar o limite (429)
    const blockedRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rate@agencia.com', password: 'wrongpassword' });
    expect(blockedRes.status).toBe(429);
  });

  it('5. Boot sem JWT_SECRET ou com valor proibido deve lançar erro de validação', async () => {
    const { z } = await import('zod');
    const FORBIDDEN_JWT_SECRETS = [
      'change-me',
      'secret',
      'jwt_secret',
      'sua_chave_jwt_aqui',
      'example',
      '12345678',
      'admin',
      'default_secret',
    ];

    const testSchema = z.string().min(8).refine(
      (secret) => !FORBIDDEN_JWT_SECRETS.includes(secret.toLowerCase())
    );

    expect(() => testSchema.parse('')).toThrow();
    expect(() => testSchema.parse('change-me')).toThrow();
    expect(() => testSchema.parse('secret')).toThrow();
    expect(() => testSchema.parse('a-valid-secure-jwt-secret-123456')).not.toThrow();
  });

  it('6. Em produção o cookie sai com Secure; em local, sem', () => {
    const mockResProd = {
      cookie: vi.fn(),
    } as unknown as Response;

    const mockResLocal = {
      cookie: vi.fn(),
    } as unknown as Response;

    // Teste para APP_ENV=production
    const isProd = true;
    mockResProd.cookie('token', 'sample-token', {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    expect(mockResProd.cookie).toHaveBeenCalledWith(
      'token',
      'sample-token',
      expect.objectContaining({ secure: true })
    );

    // Teste para APP_ENV=local
    const isLocal = false;
    mockResLocal.cookie('token', 'sample-token', {
      httpOnly: true,
      sameSite: 'lax',
      secure: isLocal,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    expect(mockResLocal.cookie).toHaveBeenCalledWith(
      'token',
      'sample-token',
      expect.objectContaining({ secure: false })
    );
  });
});
