import rateLimit from 'express-rate-limit';
import { env } from '../env.js';

const isTest = env.NODE_ENV === 'test';

export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: (req, res) => {
    if (isTest && req.headers['x-test-rate-limit'] === 'true') {
      return 30;
    }
    return isTest ? 3000 : 30; // Limite multiplicado em testes
  },
  keyGenerator: (req) => {
    return (req as any).user?.id || req.ip;
  },
  message: { error: 'Muitos uploads em sequência. Aguarde alguns minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: isTest ? 30000 : 300,
  message: { error: 'Limite de requisições excedido.' },
  standardHeaders: true,
  legacyHeaders: false,
});
