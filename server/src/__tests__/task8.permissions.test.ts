import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../app.js';
import { prisma } from '../prisma.js';
import { env } from '../env.js';

vi.mock('../prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    paymentRecord: { findUnique: vi.fn(), update: vi.fn() },
    contractFile: { findUnique: vi.fn() },
    invoiceFile: { findUnique: vi.fn() },
  },
}));

describe('TASK-8: Permissões por intenção em cobranças e por tipo em arquivos', () => {
  const createUserWithPermissions = (permissions: string[]) => ({
    id: 'user-1',
    email: 'user@test.com',
    name: 'User',
    active: true,
    mustChangePassword: false,
    tokenVersion: 0,
    groups: [{ group: { id: 'g-1', name: 'Group', permissions } }],
    passwordHash: 'hash',
    createdAt: new Date(),
  });

  const createToken = (user: any) =>
    jwt.sign({ id: user.id, tokenVersion: user.tokenVersion }, env.JWT_SECRET, { expiresIn: '7d' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PATCH /api/payments/:id', () => {
    const mockPayment = {
      id: 'pay-1',
      status: 'Pendente',
      amountCents: 1000,
    };

    it('Exige payments.cancel para cancelar', async () => {
      const user = createUserWithPermissions(['payments.settle', 'payments.update']);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);
      vi.mocked(prisma.paymentRecord.findUnique).mockResolvedValue(mockPayment as any);

      const res = await request(app)
        .patch('/api/payments/pay-1')
        .set('Cookie', [`token=${createToken(user)}`])
        .send({ status: 'Cancelado' });

      expect(res.status).toBe(403);
      expect(res.body.requiredPermission).toBe('payments.cancel');
    });

    it('Exige payments.settle e payments.update se combinar baixa e edição', async () => {
      const user = createUserWithPermissions(['payments.settle']);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);
      vi.mocked(prisma.paymentRecord.findUnique).mockResolvedValue(mockPayment as any);

      const res = await request(app)
        .patch('/api/payments/pay-1')
        .set('Cookie', [`token=${createToken(user)}`])
        .send({ status: 'Pago', amountCents: 2000, paidDate: '2026-05-10', paymentMethod: 'PIX' });

      expect(res.status).toBe(403);
      expect(res.body.requiredPermission).toBe('payments.update');
    });
  });

  describe('GET e DELETE /api/files/:id', () => {
    it('Retorna 404 antes de 403 para arquivo inexistente', async () => {
      const user = createUserWithPermissions([]);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);
      vi.mocked(prisma.contractFile.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.invoiceFile.findUnique).mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/files/inexistent')
        .set('Cookie', [`token=${createToken(user)}`]);

      expect(res.status).toBe(404);
    });
  });
});
