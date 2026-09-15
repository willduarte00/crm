import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';

export const settingsRouter = Router();

const updateSettingsSchema = z.object({
  agencyName: z.string().min(1).optional(),
  contactEmail: z.string().email().optional(),
  phone: z.string().optional(),
  pixKey: z.string().optional(),
  pixKeyType: z.string().optional(),
  bankName: z.string().optional(),
  bankBranch: z.string().optional(),
  bankAccount: z.string().optional(),
  logoUrl: z.string().regex(/^\/api\/files\/public\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|webp)$/i, 'logoUrl deve apontar para um arquivo enviado pelo upload de logo').or(z.literal('')).nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i).or(z.literal('')).nullable().optional(),
});

import { requirePermission } from '../middlewares/requirePermission.js';

// GET /api/settings/billing
settingsRouter.get('/billing', requirePermission('settings.bank.view'), async (_req: Request, res: Response) => {
  const settings = await prisma.settings.findFirst();

  return res.json({
    agencyName: settings?.agencyName || 'Minha Agência',
    pixKey: settings?.pixKey || null,
    pixKeyType: settings?.pixKeyType || null,
    bankName: settings?.bankName || null,
    bankBranch: settings?.bankBranch || null,
    bankAccount: settings?.bankAccount || null,
  });
});

// GET /api/settings
settingsRouter.get('/', requirePermission('settings.view'), async (_req: Request, res: Response) => {
  let settings = await prisma.settings.findFirst();
  if (!settings) {
    settings = await prisma.settings.create({
      data: {
        agencyName: 'Minha Agência',
      },
    });
  }
  return res.json(settings);
});

import { env } from '../env.js';
import path from 'path';
import fs from 'fs';

// PUT /api/settings
settingsRouter.put('/', requirePermission('settings.update'), async (req: Request, res: Response) => {
  const data = updateSettingsSchema.parse(req.body);
  const settings = await prisma.settings.findFirst();

  let updated;
  if (settings) {
    // Apaga arquivo de logo antigo se o nome for diferente
    if (settings.logoUrl && data.logoUrl !== undefined && data.logoUrl !== settings.logoUrl) {
      if (settings.logoUrl.startsWith('/api/files/public/')) {
        const oldFilename = settings.logoUrl.replace('/api/files/public/', '');
        const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR || './uploads');
        const oldFilePath = path.resolve(uploadDir, 'logo', oldFilename);
        await fs.promises.unlink(oldFilePath).catch(() => {});
      }
    }

    updated = await prisma.settings.update({
      where: { id: settings.id },
      data,
    });
  } else {
    updated = await prisma.settings.create({
      data: {
        agencyName: data.agencyName || 'Minha Agência',
        ...data,
      },
    });
  }

  return res.json(updated);
});

/**
 * Router separado para a leitura pública (autenticada) dos dados da agência.
 *
 * O módulo admin (RF-07a) controla quem *edita* as configurações, mas o
 * `membro` também usa o WhatsApp (RF-08a) e o lembrete de vencimento precisa
 * da chave PIX vinda de SETTINGS (RF-52). Este endpoint devolve apenas os
 * campos já expostos pelo `/api/dashboard` — nunca permite escrita.
 */
export const settingsSummaryRouter = Router();

settingsSummaryRouter.get('/', async (_req: Request, res: Response) => {
  const settings = await prisma.settings.findFirst();

  return res.json({
    agencyName: settings?.agencyName || 'Minha Agência',
    contactEmail: settings?.contactEmail || null,
    phone: settings?.phone || null,
    pixKey: settings?.pixKey || null,
    pixKeyType: settings?.pixKeyType || null,
    bankName: settings?.bankName || null,
    bankBranch: settings?.bankBranch || null,
    bankAccount: settings?.bankAccount || null,
    logoUrl: settings?.logoUrl || null,
    primaryColor: settings?.primaryColor || null,
  });
});
