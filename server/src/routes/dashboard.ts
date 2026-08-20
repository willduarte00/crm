import { Router, Request, Response } from 'express';
import { prisma } from '../prisma.js';
import {
  getTodayCivilDate,
  getCurrentReferenceMonth,
  addMonthsToReferenceMonth,
} from '../domain/dates.js';
import {
  calculateMRR,
  calculateReceivedThisMonth,
  calculateInvoicedThisMonth,
  calculateOverdue,
  calculateDelinquencyRate,
  calculateActiveClients,
  getPaymentAlerts,
  calculateBillingHistory6Months,
  calculateServiceDistribution,
  calculateMetricComparison,
} from '../domain/metrics.js';

export const dashboardRouter = Router();

// GET /api/dashboard - Métricas, KPIs, alertas, gráficos e snapshot mensal (RF-40 a RF-49)
dashboardRouter.get('/', async (_req: Request, res: Response) => {
  const today = getTodayCivilDate();
  const currentMonth = getCurrentReferenceMonth();
  const previousMonth = addMonthsToReferenceMonth(currentMonth, -1);

  // 1. Carrega dados do banco
  const [contracts, payments, clients, previousSnapshot, settings] = await Promise.all([
    prisma.contract.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        clientId: true,
        serviceType: true,
        billingType: true,
        valueCents: true,
        status: true,
      },
    }),
    prisma.paymentRecord.findMany({
      where: {
        contract: { deletedAt: null },
      },
      select: {
        id: true,
        contractId: true,
        number: true,
        referenceMonth: true,
        dueDate: true,
        paidDate: true,
        amountCents: true,
        status: true,
        contract: {
          select: {
            clientId: true,
            serviceType: true,
            client: {
              select: {
                id: true,
                name: true,
                tradeName: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.client.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        contracts: {
          where: { deletedAt: null },
          select: {
            status: true,
            serviceType: true,
          },
        },
      },
    }),
    prisma.metricSnapshot.findUnique({
      where: { referenceMonth: previousMonth },
    }),
    prisma.settings.findFirst(),
  ]);

  // 2. Cálculo das métricas puras
  const mrrCents = calculateMRR(contracts);
  const receivedCents = calculateReceivedThisMonth(payments, currentMonth);
  const invoicedCents = calculateInvoicedThisMonth(payments, currentMonth);
  const { overdueCents, overdueCount } = calculateOverdue(payments, today);
  const delinquencyRate = calculateDelinquencyRate(overdueCents, invoicedCents);
  const activeClients = calculateActiveClients(clients);

  const alerts = getPaymentAlerts(payments, today);
  const billingHistory = calculateBillingHistory6Months(payments, currentMonth);
  const serviceDistribution = calculateServiceDistribution(clients);

  // 3. Upsert do snapshot do mês corrente (RF-47)
  // Sem cron: quando o mês vira, a linha anterior congela
  await prisma.metricSnapshot.upsert({
    where: { referenceMonth: currentMonth },
    update: {
      mrrCents,
      invoicedCents,
      receivedCents,
      overdueCents,
      overdueCount,
      activeClients,
      capturedAt: new Date(),
    },
    create: {
      referenceMonth: currentMonth,
      mrrCents,
      invoicedCents,
      receivedCents,
      overdueCents,
      overdueCount,
      activeClients,
    },
  });

  // 4. Cálculo de comparativos vs mês anterior (RF-48)
  // Se previousSnapshot não existir, tudo vem null — nunca 0% inventado
  let comparison = null;
  if (previousSnapshot) {
    const prevDelinquencyRate = calculateDelinquencyRate(
      previousSnapshot.overdueCents,
      previousSnapshot.invoicedCents
    );

    comparison = {
      mrr: calculateMetricComparison(mrrCents, previousSnapshot.mrrCents),
      received: calculateMetricComparison(receivedCents, previousSnapshot.receivedCents),
      invoiced: calculateMetricComparison(invoicedCents, previousSnapshot.invoicedCents),
      overdue: calculateMetricComparison(overdueCents, previousSnapshot.overdueCents),
      activeClients: calculateMetricComparison(activeClients, previousSnapshot.activeClients),
      delinquencyRate: {
        diff: Math.round((delinquencyRate - prevDelinquencyRate) * 10) / 10,
        percentage:
          prevDelinquencyRate > 0
            ? Math.round(((delinquencyRate - prevDelinquencyRate) / prevDelinquencyRate) * 1000) / 10
            : 0,
      },
    };
  }

  return res.json({
    current: {
      referenceMonth: currentMonth,
      today,
      mrrCents,
      receivedCents,
      invoicedCents,
      overdueCents,
      overdueCount,
      delinquencyRate,
      activeClients,
    },
    previous: previousSnapshot,
    comparison,
    alerts,
    charts: {
      billingHistory,
      serviceDistribution,
    },
    settings: {
      agencyName: settings?.agencyName || 'Minha Agência',
      contactEmail: settings?.contactEmail || null,
      phone: settings?.phone || null,
      pixKey: settings?.pixKey || null,
      pixKeyType: settings?.pixKeyType || null,
      bankName: settings?.bankName || null,
      bankBranch: settings?.bankBranch || null,
      bankAccount: settings?.bankAccount || null,
    },
  });
});
