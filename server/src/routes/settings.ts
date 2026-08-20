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
});

// GET /api/settings (Admin only via requireAdmin)
settingsRouter.get('/', async (_req: Request, res: Response) => {
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

// PUT /api/settings (Admin only via requireAdmin)
settingsRouter.put('/', async (req: Request, res: Response) => {
  const data = updateSettingsSchema.parse(req.body);
  const settings = await prisma.settings.findFirst();

  let updated;
  if (settings) {
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
