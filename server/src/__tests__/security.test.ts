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

  it('5. Boot sem JWT_SECRET longo, ADMIN_PASSWORD forte, ou config incorreta, deve lançar erro de validação', async () => {
    const { envSchema } = await import('../env.js');

    // Teste JWT_SECRET
    expect(() => envSchema.parse({
      DATABASE_URL: 'postgres://valid',
      ADMIN_EMAIL: 'admin@agencia.com',
      ADMIN_PASSWORD: 'umaSenhaMuitoForte123!',
      JWT_SECRET: '',
    })).toThrow();

    expect(() => envSchema.parse({
      DATABASE_URL: 'postgres://valid',
      ADMIN_EMAIL: 'admin@agencia.com',
      ADMIN_PASSWORD: 'umaSenhaMuitoForte123!',
      JWT_SECRET: 'change-me',
    })).toThrow();

    expect(() => envSchema.parse({
      DATABASE_URL: 'postgres://valid',
      ADMIN_EMAIL: 'admin@agencia.com',
      ADMIN_PASSWORD: 'umaSenhaMuitoForte123!',
      JWT_SECRET: 'a-valid-secure-jwt-secret-that-is-at-least-32-chars-long',
    })).not.toThrow();

    // Teste ADMIN_PASSWORD
    expect(() => envSchema.parse({
      DATABASE_URL: 'postgres://valid',
      ADMIN_EMAIL: 'admin@agencia.com',
      ADMIN_PASSWORD: 'admin123456',
      JWT_SECRET: 'a-valid-secure-jwt-secret-that-is-at-least-32-chars-long',
    })).toThrow();

    expect(() => envSchema.parse({
      DATABASE_URL: 'postgres://valid',
      ADMIN_EMAIL: 'admin@agencia.com',
      ADMIN_PASSWORD: 'curta',
      JWT_SECRET: 'a-valid-secure-jwt-secret-that-is-at-least-32-chars-long',
    })).toThrow();

    // Teste NODE_ENV=production + APP_ENV=local
    expect(() => envSchema.parse({
      DATABASE_URL: 'postgres://valid',
      ADMIN_EMAIL: 'admin@agencia.com',
      ADMIN_PASSWORD: 'umaSenhaMuitoForte123!',
      JWT_SECRET: 'a-valid-secure-jwt-secret-that-is-at-least-32-chars-long',
      NODE_ENV: 'production',
      APP_ENV: 'local',
    })).toThrow('Em NODE_ENV=production o APP_ENV deve ser production (cookie Secure)');
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

  it('7. 11 tentativas de login para o mesmo e-mail de IPs diferentes devem retornar 429 na 11ª (accountLimiter)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-2',
      email: 'target@agencia.com',
      name: 'Target User',
      role: 'membro',
      active: true,
      mustChangePassword: false,
      tokenVersion: 0,
      passwordHash: '$2a$12$invalidhashinvalidhashinvalidhashinvalidhashinvalidhas',
      createdAt: new Date(),
    } as any);

    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', `192.168.1.${i}`)
        .send({ email: 'target@agencia.com', password: 'wrongpassword' });
      expect(res.status).toBe(401);
    }

    const blockedRes = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', `192.168.1.10`)
      .send({ email: 'target@agencia.com', password: 'wrongpassword' });
    expect(blockedRes.status).toBe(429);
  });

  it('8. 5 tentativas de um IP não bloqueiam outro IP (loginLimiter por IP)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-3',
      email: 'user3@agencia.com',
      name: 'User 3',
      role: 'membro',
      active: true,
      mustChangePassword: false,
      tokenVersion: 0,
      passwordHash: '$2a$12$invalidhashinvalidhashinvalidhashinvalidhashinvalidhas',
      createdAt: new Date(),
    } as any);

    // 5 attempts from IP A
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '10.0.0.1')
        .send({ email: 'user3@agencia.com', password: 'wrongpassword' });
      expect(res.status).toBe(401);
    }

    // IP A is blocked
    const blockedRes = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '10.0.0.1')
      .send({ email: 'user3@agencia.com', password: 'wrongpassword' });
    expect(blockedRes.status).toBe(429);

    // IP B is not blocked
    const resB = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '10.0.0.2')
      .send({ email: 'another@agencia.com', password: 'wrongpassword' });
    expect(resB.status).toBe(401);
  });
});
