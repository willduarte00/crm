import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../services/api';
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
  AlertCircle,
  Eye,
  CreditCard,
  Download,
  MessageSquare,
} from 'lucide-react';

export const FinancialPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [referenceMonthFilter, setReferenceMonthFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Modais
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [whatsAppModalData, setWhatsAppModalData] = useState<WhatsAppModalData | null>(null);

  // Busca configurações da agência para obter chave PIX
  const { data: settings } = useQuery<AgencySettings>({
    queryKey: ['settings'],
    queryFn: () => apiFetch<AgencySettings>('/api/settings').catch(() => null as any),
  });

  // Debounce da busca
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Query para buscar cobranças
  const { data, isLoading, isError, refetch } = useQuery<PaginatedPaymentsResponse>({
    queryKey: ['payments', page, statusFilter, referenceMonthFilter, debouncedSearch],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '25');
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
        <div>
          <h2 className="text-xl font-bold text-navy-900 font-display-lg">
            Financeiro e Cobranças
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Gestão de faturamento, controle de cobranças e registro manual de pagamentos.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/api/export/payments"
            download
            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors shadow-2xs"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Exportar CSV</span>
          </a>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Nova cobrança</span>
          </button>
        </div>
      </div>

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* KPI 1: Faturado (Competência) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Faturado (Competência)
            </span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-navy-900 font-headline-md">
              {formatCurrencyBRL(summary?.invoicedCents ?? 0)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Cobranças geradas para o mês corrente
            </p>
          </div>
        </div>

        {/* KPI 2: Recebido (Caixa) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Recebido (Caixa)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-navy-900 font-headline-md">
              {formatCurrencyBRL(summary?.receivedCents ?? 0)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Pagamentos confirmados neste mês
            </p>
          </div>
        </div>

        {/* KPI 3: Inadimplência / Atrasadas */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Inadimplência (Atrasadas)
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-700 font-headline-md">
              {formatCurrencyBRL(summary?.overdueCents ?? 0)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
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
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente ou número de cobrança..."
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-navy-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 outline-none transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Filtro por Status */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-xs text-navy-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 outline-none font-medium"
            >
              <option value="all">Todos os status</option>
              <option value="Pendente">Pendentes</option>
              <option value="Atrasado">Atrasados</option>
              <option value="Pago">Pagos</option>
              <option value="Cancelado">Cancelados</option>
            </select>

            {/* Filtro por Mês de Referência */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1">
              <span className="text-[11px] text-slate-400 font-medium">Mês:</span>
              <input
                type="month"
                value={referenceMonthFilter}
                onChange={(e) => {
                  setReferenceMonthFilter(e.target.value);
                  setPage(1);
                }}
                className="text-xs text-navy-900 border-none p-0 focus:ring-0 outline-none bg-transparent"
              />
              {referenceMonthFilter && (
                <button
                  onClick={() => {
                    setReferenceMonthFilter('');
                    setPage(1);
                  }}
                  className="text-[11px] text-slate-400 hover:text-rose-600 ml-1 font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            {total > 0
              ? `Mostrando ${(page - 1) * 25 + 1}-${Math.min(page * 25, total)} de ${total} cobranças`
              : '0 cobranças'}
          </div>
        </div>

        {/* Tabela de Cobranças */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Cobrança</th>
                <th className="py-3 px-4">Cliente / Contrato</th>
                <th className="py-3 px-4">Mês de Ref.</th>
                <th className="py-3 px-4">Vencimento</th>
                <th className="py-3 px-4">Valor (R$)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Nota Fiscal</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-navy-900 font-data-tabular">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Carregando cobranças...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-rose-600">
                    <AlertCircle className="w-6 h-6 mx-auto mb-1" />
                    Ocorreu um erro ao carregar as cobranças.
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 bg-slate-50/30">
                    <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">Nenhuma cobrança encontrada</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Tente alterar os filtros ou crie uma nova cobrança manual.
                    </p>
                  </td>
                </tr>
              ) : (
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
                        <button
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
                          title="Enviar lembrete / NF via WhatsApp"
                          className="p-1.5 text-slate-500 hover:text-[#25D366] hover:bg-[#25D366]/10 rounded transition-colors"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        {p.status !== 'Pago' && p.status !== 'Cancelado' && (
                          <button
                            onClick={() => handleOpenDetails(p.id)}
                            className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 text-[11px] font-bold rounded transition-colors flex items-center gap-1 border border-teal-200/60"
                          >
                            <CreditCard className="w-3 h-3" />
                            Dar baixa
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenDetails(p.id)}
                          title="Visualizar detalhes"
                          className="p-1.5 text-slate-400 hover:text-navy-900 hover:bg-slate-100 rounded transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Anterior
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  onClick={() => setPage(num)}
                  className={`w-7 h-7 rounded text-xs font-bold transition-colors ${
                    page === num
                      ? 'bg-teal-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-40 transition-colors"
            >
              Próximo
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
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
