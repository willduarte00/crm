import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@agencia.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: 'Administrador',
        role: 'admin',
        active: true,
        mustChangePassword: false,
        tokenVersion: 0,
      },
    });
    console.log(`✅ Usuário administrador inicial criado (${adminEmail})`);
  } else {
    console.log(`ℹ️ Usuário administrador já existe (${adminEmail})`);
  }

  // Garante configurações padrão da agência
  const settingsCount = await prisma.settings.count();
  if (settingsCount === 0) {
    await prisma.settings.create({
      data: {
        agencyName: 'Agência de Marketing',
        contactEmail: adminEmail,
        phone: '5511999999999',
      },
    });
    console.log('✅ Configurações iniciais da agência criadas');
  }

  // Garante etapas padrão do pipeline operacional
  const stageCount = await prisma.operationalStage.count();
  if (stageCount === 0) {
    const defaultStages = [
      { name: 'Onboarding',   color: 'blue',    position: 0 },
      { name: 'Briefing',     color: 'amber',   position: 1 },
      { name: 'Em Produção',  color: 'purple',  position: 2 },
      { name: 'Aprovação',    color: 'emerald', position: 3 },
      { name: 'Entregue',     color: 'teal',    position: 4 },
    ];

    for (const stage of defaultStages) {
      await prisma.operationalStage.create({ data: stage });
    }
    console.log('✅ Etapas padrão do pipeline operacional criadas');
  }
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
