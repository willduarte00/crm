import { prisma } from '../prisma.js';
import {
  formatPaymentNumber,
  generateExpectedBillingPeriods,
  generatePontualInstallments,
  ContractForBilling,
  PontualContractForBilling,
} from '../domain/billing.js';
import { getTodayCivilDate } from '../domain/dates.js';

/**
 * Obtém os próximos N números de cobrança sequenciais dentro do ano com lock de linha (RF-32).
 * Garante que criações concorrentes não gerem números duplicados.
 */
export async function getNextPaymentNumbers(
  tx: any,
  year: number,
  count: number
): Promise<string[]> {
  if (count <= 0) return [];

  // Garante que o registro para o ano existe
  await tx.paymentSequence.upsert({
    where: { year },
    create: { year, lastNumber: 0 },
    update: {},
  });

  let currentLast = 0;

  // Lock de linha exclusivo (SELECT ... FOR UPDATE) para Postgres (RF-32)
  try {
    const rows = await tx.$queryRawUnsafe(
      `SELECT "lastNumber" FROM "payment_sequences" WHERE "year" = $1 FOR UPDATE`,
      year
    );
    if (Array.isArray(rows) && rows.length > 0) {
      currentLast = Number(rows[0].lastNumber);
    } else {
      const record = await tx.paymentSequence.findUnique({ where: { year } });
      currentLast = record?.lastNumber ?? 0;
    }
  } catch {
    const record = await tx.paymentSequence.findUnique({ where: { year } });
    currentLast = record?.lastNumber ?? 0;
  }

  const newLast = currentLast + count;

  await tx.paymentSequence.update({
    where: { year },
    data: { lastNumber: newLast },
  });

  const numbers: string[] = [];
  for (let seq = currentLast + 1; seq <= newLast; seq++) {
    numbers.push(formatPaymentNumber(year, seq));
  }

  return numbers;
}

/**
 * Materializa os pagamentos de um contrato pontual na sua criação (RF-26).
 */
export async function createPontualContractPayments(
  tx: any,
  contractId: string,
  contractInput: PontualContractForBilling,
  targetDate?: string
) {
  const installments = generatePontualInstallments(contractInput);
  if (installments.length === 0) return [];

  const today = targetDate || getTodayCivilDate();
  const currentYear = parseInt(today.slice(0, 4), 10);

  const numbers = await getNextPaymentNumbers(tx, currentYear, installments.length);

  const createdRecords = [];
  for (let i = 0; i < installments.length; i++) {
    const installment = installments[i];
    const number = numbers[i];

    const record = await tx.paymentRecord.create({
      data: {
        contractId,
        number,
        referenceMonth: installment.referenceMonth,
        dueDate: installment.dueDate,
        amountCents: installment.amountCents,
        status: 'Pendente',
      },
    });
    createdRecords.push(record);
  }

  return createdRecords;
}

/**
 * Geração preguiçosa de cobranças (RF-20, RF-21, RF-22, RF-24, RF-25).
 * Disparada sob demanda na listagem de cobranças do contrato.
 */
export async function ensurePaymentRecords(
  contractId: string,
  targetDate?: string
) {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, deletedAt: null },
    include: {
      paymentRecords: {
        include: {
          invoices: {
            select: {
              id: true,
              originalName: true,
              fileSize: true,
              mimeType: true,
              uploadedAt: true,
            },
          },
        },
        orderBy: { dueDate: 'asc' },
      },
    },
  });

  if (!contract) {
    return [];
  }

  // Não gera para contrato não recorrente ou com status != ativo
  if (contract.billingType !== 'recorrente' || contract.status !== 'ativo') {
    return contract.paymentRecords;
  }

  const expectedPeriods = generateExpectedBillingPeriods(
    {
      startDate: contract.startDate,
      endDate: contract.endDate,
      billingType: contract.billingType,
      valueCents: contract.valueCents,
      billingDay: contract.billingDay,
      billingPeriodMonths: contract.billingPeriodMonths,
      status: contract.status,
    },
    targetDate
  );

  const existingMonths = new Set(contract.paymentRecords.map((p) => p.referenceMonth));
  const missingPeriods = expectedPeriods.filter((p) => !existingMonths.has(p.referenceMonth));

  if (missingPeriods.length > 0) {
    const today = targetDate || getTodayCivilDate();
    const currentYear = parseInt(today.slice(0, 4), 10);

    await prisma.$transaction(async (tx) => {
      // Aloca a numeração sequencial atômica
      const numbers = await getNextPaymentNumbers(tx, currentYear, missingPeriods.length);

      for (let i = 0; i < missingPeriods.length; i++) {
        const period = missingPeriods[i];
        const number = numbers[i];

        try {
          await tx.paymentRecord.create({
            data: {
              contractId: contract.id,
              number,
              referenceMonth: period.referenceMonth,
              dueDate: period.dueDate,
              amountCents: period.amountCents,
              status: 'Pendente',
            },
          });
        } catch (error: any) {
          // Idempotência: se outro processo concorrente criou exatamente o mesmo (contractId, referenceMonth),
          // o índice único impede duplicidade
          if (error.code !== 'P2002') {
            throw error;
          }
        }
      }
    });
  }

  // Retorna a lista completa atualizada
  return prisma.paymentRecord.findMany({
    where: { contractId },
    include: {
      invoices: {
        orderBy: { uploadedAt: 'desc' },
        select: {
          id: true,
          originalName: true,
          fileSize: true,
          mimeType: true,
          uploadedAt: true,
        },
      },
    },
    orderBy: { dueDate: 'asc' },
  });
}
