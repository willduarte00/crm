import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { ADMIN_PERMISSIONS, FINANCEIRO_PERMISSIONS, OPERACIONAL_PERMISSIONS } from '../src/domain/defaultGroups.js';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error('❌ Erro: ADMIN_EMAIL e ADMIN_PASSWORD são obrigatórios para o seed.');
    process.exit(1);
  }

  // Seed dos Grupos
  const adminGroup = await prisma.group.upsert({
    where: { name: 'Admin' },
    update: {
      isSystem: true,
      permissions: ADMIN_PERMISSIONS,
    },
    create: {
      name: 'Admin',
      description: 'Acesso total ao sistema',
      isSystem: true,
      permissions: ADMIN_PERMISSIONS,
    },
  });

  const operacionalGroup = await prisma.group.upsert({
    where: { name: 'Operacional' },
    update: {
      permissions: OPERACIONAL_PERMISSIONS,
    },
    create: {
      name: 'Operacional',
      description: 'Gestão de clientes e pipeline',
      permissions: OPERACIONAL_PERMISSIONS,
    },
  });

  const financeiroGroup = await prisma.group.upsert({
    where: { name: 'Financeiro' },
    update: {
      permissions: FINANCEIRO_PERMISSIONS,
    },
    create: {
      name: 'Financeiro',
      description: 'Gestão de contratos e cobranças',
      permissions: FINANCEIRO_PERMISSIONS,
    },
  });
  console.log('✅ Grupos semeados');

  let existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    existingAdmin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: 'Administrador',
        active: true,
        mustChangePassword: true,
        tokenVersion: 0,
      },
    });
    console.log(`✅ Usuário administrador inicial criado (${adminEmail})`);
  } else {
    console.log(`ℹ️ Usuário administrador já existe (${adminEmail})`);
  }

  // Vincular admin ao grupo Admin
  await prisma.userGroup.upsert({
    where: {
      userId_groupId: {
        userId: existingAdmin.id,
        groupId: adminGroup.id,
      },
    },
    update: {},
    create: {
      userId: existingAdmin.id,
      groupId: adminGroup.id,
    },
  });
  console.log('✅ Usuário administrador vinculado ao grupo Admin');

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
