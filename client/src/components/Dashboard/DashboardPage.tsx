import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  Wallet,
  Receipt,
  AlertTriangle,
  Users,
  RefreshCw,
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { DashboardData } from '../../types/dashboard';
import { formatCurrencyBRL, formatReferenceMonthBR } from '../../utils/formatters';
import { Button } from '../ui/Button';
import { ErrorState } from '../ui/States';
import { KpiCard } from './KpiCard';
import { BillingChart } from './BillingChart';
import { ServicesChart } from './ServicesChart';
import { AlertsWidget } from './AlertsWidget';

export const DashboardPage: React.FC = () => {
  const {
    data: dashboard,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch<DashboardData>('/api/dashboard'),
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse" role="status" aria-label="Carregando o dashboard">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-slate-200 rounded w-48" />
          <div className="h-8 bg-slate-200 rounded w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-72 bg-slate-200 rounded-xl" />
            <div className="h-72 bg-slate-200 rounded-xl" />
          </div>
          <div className="h-96 bg-slate-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !dashboard) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs">
        <ErrorState
          title="Não foi possível carregar o dashboard"
          message="As métricas e indicadores não puderam ser calculados. Verifique sua conexão e tente novamente."
          onRetry={() => refetch()}
          isRetrying={isFetching}
        />
      </div>
    );
  }

  const { current, comparison, alerts, charts, settings } = dashboard;
  const monthName = formatReferenceMonthBR(current.referenceMonth);

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Métricas financeiras e saúde da operação em{' '}
            <span className="font-semibold text-slate-700">{monthName}</span>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            icon={
              <RefreshCw
                className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-teal-600' : ''}`}
                aria-hidden="true"
              />
            }
          >
            Atualizar
          </Button>
        </div>
      </div>

      {/* Bento Grid dos KPIs Principais (RF-40 a RF-44, RF-48) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. MRR */}
        <KpiCard
          title="MRR (Mensalidade)"
          value={formatCurrencyBRL(current.mrrCents)}
          icon={TrendingUp}
          iconBgColor="bg-teal-50"
          iconColor="text-teal-600"
          comparison={comparison?.mrr}
          subtitle="Contratos recorrentes ativos"
        />

        {/* 2. Recebido no Mês (Caixa) */}
        <KpiCard
          title="Recebido (Caixa)"
          value={formatCurrencyBRL(current.receivedCents)}
          icon={Wallet}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-600"
          comparison={comparison?.received}
          subtitle="Pagamentos baixados no mês"
        />

        {/* 3. Faturado no Mês (Competência) */}
        <KpiCard
          title="Faturado (Competência)"
          value={formatCurrencyBRL(current.invoicedCents)}
          icon={Receipt}
          iconBgColor="bg-blue-50"
          iconColor="text-blue-600"
          comparison={comparison?.invoiced}
          subtitle="Competência do mês corrente"
        />

        {/* 4. Inadimplência */}
        <KpiCard
          title="Inadimplência"
          value={formatCurrencyBRL(current.overdueCents)}
          icon={AlertTriangle}
          iconBgColor="bg-rose-50"
          iconColor="text-rose-600"
          comparison={comparison?.overdue}
          subtitle={`${current.delinquencyRate}% taxa (${current.overdueCount} pendentes)`}
          isDelinquency
        />

        {/* 5. Clientes Ativos */}
        <KpiCard
          title="Clientes Ativos"
          value={current.activeClients}
          icon={Users}
          iconBgColor="bg-slate-100"
          iconColor="text-slate-700"
          comparison={comparison?.activeClients}
          subtitle="Com contratos em vigência"
        />
      </div>

      {/* Seção Gráficos e Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráficos Recharts (2 colunas) */}
        <div className="lg:col-span-2 space-y-6">
          <BillingChart data={charts.billingHistory} />
          <ServicesChart data={charts.serviceDistribution} />
        </div>

        {/* Widget de Alertas (1 coluna) */}
        <div className="lg:col-span-1">
          <AlertsWidget
            overdue={alerts.overdue}
            upcoming7Days={alerts.upcoming7Days}
            settings={settings}
          />
        </div>
      </div>
    </div>
  );
};
