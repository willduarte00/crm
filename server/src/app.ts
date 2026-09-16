import express from 'express';
import 'express-async-errors';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import { env } from './env.js';
import { requireAuth } from './middlewares/requireAuth.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { apiLimiter } from './middlewares/rateLimits.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { settingsRouter, settingsSummaryRouter } from './routes/settings.js';
import { clientsRouter } from './routes/clients.js';
import { contractsRouter } from './routes/contracts.js';
import { filesRouter } from './routes/files.js';
import { paymentsRouter } from './routes/payments.js';
import { dashboardRouter } from './routes/dashboard.js';
import { exportRouter } from './routes/export.js';
import { operationalStagesRouter } from './routes/operationalStages.js';
import { operationalTasksRouter } from './routes/operationalTasks.js';
import { groupsRouter } from './routes/groups.js';
import { permissionsRouter } from './routes/permissions.js';

export const app = express();

// O Caddy é o único salto em produção, então confiamos apenas em 1 proxy.
// express-rate-limit rejeita true.
app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: env.NODE_ENV === 'development' ? ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"] : ["'self'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    imgSrc: ["'self'", 'data:', 'blob:'],
    connectSrc: ["'self'"],
    frameAncestors: ["'none'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
  } },
  referrerPolicy: { policy: 'same-origin' },
  crossOriginEmbedderPolicy: false,
  strictTransportSecurity: false,
}));

// Middlewares essenciais
app.use(express.json());
app.use(cookieParser());

// CORS só é necessário quando cliente e API não são servidos na mesma origem:
// dev (proxy do Vite em :5173) ou quando CORS_ORIGINS lista origens explícitas.
// Em produção sem CORS_ORIGINS, nada é registrado (mesma origem via Express).
const corsOrigins = env.CORS_ORIGINS
  ? env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : [];

if (env.NODE_ENV === 'development') {
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
} else if (corsOrigins.length > 0) {
  app.use(cors({ origin: corsOrigins, credentials: true }));
}

// Health check público
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Limite de taxa na API
app.use('/api', apiLimiter);

// Autenticação opt-out em todas as rotas /api
app.use('/api', requireAuth);

// Rotas de autenticação
app.use('/api/auth', authRouter);

// Leitura dos dados da agência liberada a qualquer usuário autenticado.
// Precisa vir ANTES do mount protegido por permissao: o Express casa na ordem.
app.use('/api/settings/summary', settingsSummaryRouter);

// Rotas administrativas (agora a permissão é declarada dentro de cada router)
app.use('/api/users', usersRouter);
app.use('/api/settings', settingsRouter);

// Rotas gerais da aplicação
app.use('/api/clients', clientsRouter);
app.use('/api/contracts', contractsRouter);
app.use('/api/files', filesRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/export', exportRouter);
app.use('/api/operational-stages', operationalStagesRouter);
app.use('/api/operational-tasks', operationalTasksRouter);

// Grupos e permissões
app.use('/api/groups', groupsRouter);
app.use('/api/permissions', permissionsRouter);

// Servindo build do React na mesma origem (se existir)
const clientDist = path.resolve(process.cwd(), 'public-client');
const clientLocalDist = path.resolve(process.cwd(), '../client/dist');
const distPath = fs.existsSync(clientDist)
  ? clientDist
  : fs.existsSync(clientLocalDist)
  ? clientLocalDist
  : null;

if (distPath) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Tratamento de erros centralizado
app.use(errorHandler);
