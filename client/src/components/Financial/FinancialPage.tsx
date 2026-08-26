import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, apiDownload, errorMessage } from '../../services/api';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { Button, IconButton } from '../ui/Button';
import { LoadingState, EmptyState, ErrorState } from '../ui/States';
import { controlClassSm } from '../ui/Field';
import { useAuth } from '../../context/AuthContext';
import { PaginatedPaymentsResponse } from '../../types/payment';
import {
  formatDateBR,
  formatCurrencyBRL,
  formatReferenceMonthShort,
} from '../../utils/formatters';
import { PaymentDetailsModal } from './PaymentDetailsModal';
import { CreatePaymentModal } from './CreatePaymentModal';
import { WhatsAppModal, WhatsAppModalData } from '../WhatsApp/WhatsAppModal';
import { AgencySettings } from '../../types/settings';
import {
  Receipt,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Ban,
  Plus,
  FileText,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Wallet,
  Eye,
  CreditCard,
  Download,
  MessageSquare,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

const PAGE_SIZE = 25;

/**
 * Janela de páginas em volta da atual, sempre com primeira e última à vista.
 * Antes a paginação renderizava um botão por página — com dezenas de meses
 * de cobranças a barra estourava a largura da tela.
 */
function pageWindow(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>([1, total, current]);
  if (current - 1 > 1) pages.add(current - 1);
  if (current + 1 < total) pages.add(current + 1);
  if (current <= 3) pages.add(2).add(3).add(4);
  if (current >= total - 2) pages.add(total - 1).add(total - 2).add(total - 3);

  const sorted = [...pages].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);

  const result: (number | 'gap')[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) result.push('gap');
    result.push(n);
  });
  return result;
}

export const FinancialPage: React.FC = () => {
  const { has } = useAuth();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [referenceMonthFilter, setReferenceMonthFilter] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [isExporting, setIsExporting] = useState(false);

  // Modais
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [whatsAppModalData, setWhatsAppModalData] = useState<WhatsAppModalData | null>(null);

  // Busca configurações da agência para obter chave PIX
  const { data: settings } = useQuery<AgencySettings>({
    queryKey: ['settings'],
    queryFn: () => apiFetch<AgencySettings>('/api/settings/billing'),
    enabled: has('settings.bank.view'),
  });

  // Volta para a primeira página sempre que a busca efetiva muda.
  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Query para buscar cobranças
  const { data, isLoading, isError, refetch } = useQuery<PaginatedPaymentsResponse>({
    queryKey: ['payments', page, statusFilter, referenceMonthFilter, debouncedSearch],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', String(PAGE_SIZE));
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (referenceMonthFilter) params.set('referenceMonth', referenceMonthFilter);
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());

      return apiFetch(`/api/payments?${params.toString()}`);
    },
  });

  const payments = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const summary = data?.summary;

  const handleOpenDetails = (id: string) => {
    setSelectedPaymentId(id);
    setIsDetailsModalOpen(true);
  };

  const hasActiveFilters =
    search.trim() !== '' || statusFilter !== 'all' || referenceMonthFilter !== '';

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setReferenceMonthFilter('');
    setPage(1);
  };

  const handleExport = async () => {
    if (isExporting) return;
    try {
      setIsExporting(true);
      await apiDownload('/api/export/payments', 'cobrancas.csv');
      toast.success('Exportação concluída.');
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível exportar as cobranças.'));
    } finally {
      setIsExporting(false);
    }
  };

  const renderStatusBadge = (effectiveStatus?: string) => {
    switch (effectiveStatus) {
      case 'Pago':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Pago
          </span>
        );
      case 'Atrasado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3 h-3" />
            Atrasado
          </span>
        );
      case 'Cancelado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <Ban className="w-3 h-3" />
            Cancelado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" />
            Pendente
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-navy-900 tabular-nums tracking-tight">
            Financeiro e cobranças
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Faturamento, controle de cobranças e registro manual de pagamentos.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {has('payments.export') && (
            <Button
              variant="secondary"
              onClick={handleExport}
              isLoading={isExporting}
              icon={<Download className="w-4 h-4" aria-hidden="true" />}
            >
              <span className="hidden sm:inline">Exportar CSV</span>
              <span className="sm:hidden">CSV</span>
            </Button>
          )}

          {has('payments.create') && (
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              icon={<Plus className="w-4 h-4" aria-hidden="true" />}
            >
              Nova cobrança
            </Button>
          )}
        </div>
      </div>

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* KPI 1: Faturado (Competência) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Faturado (Competência)
            </span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-navy-900 tabular-nums ">
              {formatCurrencyBRL(summary?.invoicedCents ?? 0)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Cobranças geradas para o mês corrente
            </p>
          </div>
        </div>

        {/* KPI 2: Recebido (Caixa) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Recebido (Caixa)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-navy-900 tabular-nums ">
              {formatCurrencyBRL(summary?.receivedCents ?? 0)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Pagamentos confirmados neste mês
            </p>
          </div>
        </div>

        {/* KPI 3: Inadimplência / Atrasadas */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Inadimplência (Atrasadas)
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-700 tabular-nums ">
              {formatCurrencyBRL(summary?.overdueCents ?? 0)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {summary?.overdueCount ?? 0} cobrança(s) pendente(s) com vencimento vencido
            </p>
          </div>
        </div>
      </div>

      {/* Seção da Tabela com Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Toolbar de Filtros */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Campo de Busca */}
            <div className="relative flex-grow sm:flex-grow-0 sm:w-72">
              <label htmlFor="payments-search" className="sr-only">
                Buscar cobranças por cliente ou número
              </label>
              <Search
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="payments-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente ou número de cobrança..."
                className={controlClassSm + ' pl-9'}
              />
            </div>

            {/* Filtro por Status */}
            <label htmlFor="payments-status" className="sr-only">
              Filtrar por status da cobrança
            </label>
            <select
              id="payments-status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className={controlClassSm + ' sm:w-auto'}
            >
              <option value="all">Todos os status</option>
              <option value="Pendente">Pendentes</option>
              <option value="Atrasado">Atrasados</option>
              <option value="Pago">Pagos</option>
              <option value="Cancelado">Cancelados</option>
            </select>

            {/* Filtro por Mês de Referência */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1">
              <label
                htmlFor="payments-month"
                className="text-[11px] text-slate-600 font-medium"
              >
                Mês:
              </label>
              <input
                id="payments-month"
                type="month"
                value={referenceMonthFilter}
                onChange={(e) => {
                  setReferenceMonthFilter(e.target.value);
                  setPage(1);
                }}
                className="text-xs text-navy-900 border-none p-0 focus:ring-0 outline-none bg-transparent"
              />
              {referenceMonthFilter && (
                <IconButton
                  label="Limpar filtro de mês"
                  tone="danger"
                  onClick={() => {
                    setReferenceMonthFilter('');
                    setPage(1);
                  }}
                  className="!p-1 ml-0.5"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </IconButton>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-600 font-medium" aria-live="polite">
            {total > 0
              ? `Mostrando ${(page - 1) * PAGE_SIZE + 1}–${Math.min(
                  page * PAGE_SIZE,
                  total
                )} de ${total} ${total === 1 ? 'cobrança' : 'cobranças'}`
              : 'Nenhuma cobrança'}
          </p>
        </div>

        {/* Tabela de Cobranças */}
        {isLoading ? (
          <LoadingState message="Carregando cobranças..." />
        ) : isError ? (
          <ErrorState
            title="Não foi possível carregar as cobranças"
            message="A lista não pôde ser lida do servidor. Verifique sua conexão e tente novamente."
            onRetry={() => refetch()}
          />
        ) : payments.length === 0 ? (
          <EmptyState
            icon={<Receipt className="w-6 h-6" />}
            title={
              hasActiveFilters
                ? 'Nenhuma cobrança corresponde aos filtros'
                : 'Nenhuma cobrança registrada ainda'
            }
            message={
              hasActiveFilters
                ? 'Ajuste os filtros ou limpe-os para ver todas as cobranças.'
                : 'As cobranças recorrentes são geradas a partir dos contratos. Você também pode criar uma cobrança avulsa.'
            }
            action={
              hasActiveFilters ? (
                <Button variant="secondary" size="sm" onClick={handleClearFilters}>
                  Limpar filtros
                </Button>
              ) : has('payments.create') ? (
                <Button
                  size="sm"
                  onClick={() => setIsCreateModalOpen(true)}
                  icon={<Plus className="w-4 h-4" aria-hidden="true" />}
                >
                  Nova cobrança
                </Button>
              ) : undefined
            }
          />
        ) : (
        <div className="table-scroll">
          <table className="w-full min-w-[64rem] text-left border-collapse">
            <caption className="sr-only">Cobranças emitidas e seu status de pagamento.</caption>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th scope="col" className="py-3 px-4">Cobrança</th>
                <th scope="col" className="py-3 px-4">Cliente / contrato</th>
                <th scope="col" className="py-3 px-4">Mês de ref.</th>
                <th scope="col" className="py-3 px-4">Vencimento</th>
                <th scope="col" className="py-3 px-4">Valor</th>
                <th scope="col" className="py-3 px-4">Status</th>
                <th scope="col" className="py-3 px-4 text-center">Nota fiscal</th>
                <th scope="col" className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-navy-900 tabular-nums">
              {(
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors group">
                    {/* Número da Cobrança */}
                    <td className="py-3 px-4">
                      <span className="font-bold text-navy-900 group-hover:text-teal-700 transition-colors">
                        {p.number}
                      </span>
                    </td>

                    {/* Cliente e Serviço */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-navy-900">
                        {p.contract?.client?.name || '-'}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-xs">
                        {p.contract?.serviceType || 'Contrato'}
                      </div>
                    </td>

                    {/* Mês de Referência */}
                    <td className="py-3 px-4 font-medium text-slate-700">
                      {formatReferenceMonthShort(p.referenceMonth)}
                    </td>

                    {/* Data de Vencimento */}
                    <td className="py-3 px-4">
                      <span
                        className={
                          p.effectiveStatus === 'Atrasado'
                            ? 'font-bold text-rose-600'
                            : 'text-slate-700'
                        }
                      >
                        {formatDateBR(p.dueDate)}
                      </span>
                    </td>

                    {/* Valor */}
                    <td className="py-3 px-4 font-bold text-navy-900">
                      {formatCurrencyBRL(p.amountCents)}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      {renderStatusBadge(p.effectiveStatus || p.status)}
                    </td>

                    {/* Indicador de Nota Fiscal (RF-31) */}
                    <td className="py-3 px-4 text-center">
                      {p.invoices && p.invoices.length > 0 ? (
                        <span
                          title={`${p.invoices.length} arquivo(s) de NF anexado(s)`}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {p.invoices.length}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Ações */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <IconButton
                          label={'Enviar lembrete da cobrança ' + p.number + ' por WhatsApp'}
                          tone="whatsapp"
                          onClick={() =>
                            setWhatsAppModalData({
                              nome: p.contract?.client?.name,
                              phone: p.contract?.client?.phone,
                              valorCents: p.amountCents,
                              vencimento: p.dueDate,
                              mesReferencia: p.referenceMonth,
                              numeroCobranca: p.number,
                              agencia: settings?.agencyName,
                              chavePix: settings?.pixKey,
                              tipoChavePix: settings?.pixKeyType,
                            })
                          }
                        >
                          <MessageSquare className="w-4 h-4" aria-hidden="true" />
                        </IconButton>
                        {has('payments.settle') && p.status !== 'Pago' && p.status !== 'Cancelado' && (
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(p.id)}
                            aria-label={'Registrar pagamento da cobrança ' + p.number}
                            className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1 border border-teal-200 whitespace-nowrap"
                          >
                            <CreditCard className="w-3 h-3" aria-hidden="true" />
                            Dar baixa
                          </button>
                        )}
                        <IconButton
                          label={'Ver detalhes da cobrança ' + p.number}
                          onClick={() => handleOpenDetails(p.id)}
                        >
                          <Eye className="w-4 h-4" aria-hidden="true" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <nav
            aria-label="Paginação de cobranças"
            className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3"
          >
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              icon={<ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />}
            >
              <span className="hidden sm:inline">Anterior</span>
              <span className="sr-only sm:hidden">Página anterior</span>
            </Button>

            <div className="flex items-center gap-1 overflow-hidden">
              {pageWindow(page, totalPages).map((entry, i) =>
                entry === 'gap' ? (
                  <span
                    key={'gap-' + i}
                    aria-hidden="true"
                    className="w-5 text-center text-xs text-slate-400"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => setPage(entry)}
                    aria-label={'Ir para a página ' + entry}
                    aria-current={page === entry ? 'page' : undefined}
                    className={`w-8 h-8 rounded-lg text-xs font-bold tabular-nums transition-colors ${
                      page === entry
                        ? 'bg-teal-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {entry}
                  </button>
                )
              )}
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <span className="hidden sm:inline">Próximo</span>
              <span className="sr-only sm:hidden">Próxima página</span>
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Button>
          </nav>
        )}
      </div>

      {/* Modal de Detalhes e Baixa */}
      <PaymentDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        paymentId={selectedPaymentId}
        onPaymentUpdated={() => refetch()}
      />

      {/* Modal de Criação de Cobrança Avulsa */}
      <CreatePaymentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onPaymentCreated={() => refetch()}
      />

      {/* Modal de WhatsApp */}
      {whatsAppModalData && (
        <WhatsAppModal
          isOpen={true}
          onClose={() => setWhatsAppModalData(null)}
          initialTemplate="lembrete_vencimento"
          data={whatsAppModalData}
        />
      )}
    </div>
  );
};
