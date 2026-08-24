import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { requireAuth } from './middlewares/requireAuth.js';
import { requireAdmin } from './middlewares/requireAdmin.js';
import { errorHandler } from './middlewares/errorHandler.js';
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

export const app = express();

// Middlewares essenciais
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// Health check público
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Autenticação opt-out em todas as rotas /api
app.use('/api', requireAuth);

// Rotas de autenticação
app.use('/api/auth', authRouter);

// Leitura dos dados da agência liberada a qualquer usuário autenticado.
// Precisa vir ANTES do mount com requireAdmin: o Express casa na ordem.
app.use('/api/settings/summary', settingsSummaryRouter);

// Rotas administrativas protegidas (declaradas em um só lugar com requireAdmin)
app.use('/api/users', requireAdmin, usersRouter);
app.use('/api/settings', requireAdmin, settingsRouter);

// Rotas gerais da aplicação
app.use('/api/clients', clientsRouter);
app.use('/api/contracts', contractsRouter);
app.use('/api/files', filesRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/export', exportRouter);
app.use('/api/operational-stages', operationalStagesRouter);
app.use('/api/operational-tasks', operationalTasksRouter);

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
