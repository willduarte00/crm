import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { app } from '../app.js';
import { prisma } from '../prisma.js';
import { env } from '../env.js';

vi.mock('../prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    settings: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe('Settings Router', () => {
  const activeUser = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'membro@agencia.com',
    name: 'Membro Teste',
    active: true,
    mustChangePassword: false,
    tokenVersion: 0,
    passwordHash: 'hash',
    createdAt: new Date(),
    groups: [
      {
        group: {
          id: 'admin-group',
          name: 'Admin',
          permissions: [
            'settings.update',
          ],
        },
      },
    ],
  };

  const createToken = (user: { id: string; tokenVersion: number }) =>
    jwt.sign({ id: user.id, tokenVersion: user.tokenVersion }, env.JWT_SECRET, {
      expiresIn: '7d',
    });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser as any);
  });

  describe('PUT /api/settings', () => {
    it('logoUrl com URL externa (https://evil.example/x.png) -> 400', async () => {
      const token = createToken(activeUser);

      const res = await request(app)
        .put('/api/settings')
        .set('Cookie', [`token=${token}`])
        .send({
          logoUrl: 'https://evil.example/x.png',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('logoUrl com caminho interno válido -> 200', async () => {
      const token = createToken(activeUser);

      vi.mocked(prisma.settings.findFirst).mockResolvedValue({ id: 'set-1' } as any);
      vi.mocked(prisma.settings.update).mockResolvedValue({ id: 'set-1', logoUrl: '/api/files/public/12345678-1234-1234-1234-123456789012.png' } as any);

      const res = await request(app)
        .put('/api/settings')
        .set('Cookie', [`token=${token}`])
        .send({
          logoUrl: '/api/files/public/12345678-1234-1234-1234-123456789012.png',
        });

      expect(res.status).toBe(200);
    });

    it('primaryColor inválido (\'red\') -> 400', async () => {
      const token = createToken(activeUser);

      const res = await request(app)
        .put('/api/settings')
        .set('Cookie', [`token=${token}`])
        .send({
          primaryColor: 'red',
        });

      expect(res.status).toBe(400);
    });
    
    it('primaryColor válido (#ff0000) -> 200', async () => {
        const token = createToken(activeUser);
  
        vi.mocked(prisma.settings.findFirst).mockResolvedValue({ id: 'set-1' } as any);
        vi.mocked(prisma.settings.update).mockResolvedValue({ id: 'set-1', primaryColor: '#ff0000' } as any);
  
        const res = await request(app)
          .put('/api/settings')
          .set('Cookie', [`token=${token}`])
          .send({
            primaryColor: '#ff0000',
          });
  
        expect(res.status).toBe(200);
      });

    it('logoUrl novo chama unlink do logo antigo', async () => {
      const token = createToken(activeUser);

      vi.mocked(prisma.settings.findFirst).mockResolvedValue({ 
        id: 'set-1',
        logoUrl: '/api/files/public/old-logo.png'
      } as any);
      vi.mocked(prisma.settings.update).mockResolvedValue({ id: 'set-1', logoUrl: '/api/files/public/new-logo.png' } as any);

      const unlinkSpy = vi.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);

      const res = await request(app)
        .put('/api/settings')
        .set('Cookie', [`token=${token}`])
        .send({
          logoUrl: '/api/files/public/12345678-1234-1234-1234-123456789012.png',
        });

      expect(res.status).toBe(200);
      expect(unlinkSpy).toHaveBeenCalled();
      
      unlinkSpy.mockRestore();
    });
  });
});
