import React, { useState, useEffect, useCallback } from 'react';
import { Contract, SERVICE_TYPES } from '../../types/contract';
import { Client } from '../../types/client';
import { apiFetch, errorMessage } from '../../services/api';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useConfirm } from '../ui/ConfirmDialog';
import { Button, IconButton } from '../ui/Button';
import { LoadingState, EmptyState, ErrorState } from '../ui/States';
import { controlClassSm } from '../ui/Field';
import { formatDateBR, formatCurrencyBRL } from '../../utils/formatters';
import { ContractModal } from './ContractModal';
import { ContractFilesModal } from './ContractFilesModal';
import {
  FileText,
  Plus,
  Search,
  Paperclip,
  Edit2,
  Trash2,
  CreditCard,
  DollarSign,
  Briefcase,
} from 'lucide-react';
import { toast } from 'sonner';

export const ContractsPage: React.FC = () => {
  const confirm = useConfirm();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // Impede que um duplo clique dispare dois DELETE para o mesmo contrato.
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [billingFilter, setBillingFilter] = useState<string>('all');

  // Modais
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [contractToEdit, setContractToEdit] = useState<Contract | null>(null);
  const [isFilesModalOpen, setIsFilesModalOpen] = useState(false);
  const [contractForFiles, setContractForFiles] = useState<Contract | null>(null);

  const fetchContracts = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(false);

      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (serviceFilter !== 'all') params.append('serviceType', serviceFilter);
      if (billingFilter !== 'all') params.append('billingType', billingFilter);

      const queryString = params.toString();
      const url = queryString ? `/api/contracts?${queryString}` : '/api/contracts';
      const data = await apiFetch<Contract[]>(url);
      setContracts(data);
    } catch {
      setContracts([]);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, statusFilter, serviceFilter, billingFilter]);

  const fetchClients = async () => {
    try {
      const res = await apiFetch<{ data: Client[] }>('/api/clients?limit=100');
      setClients(res.data);
    } catch (err) {
      // Ignora erro de clientes
    }
  };

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  useEffect(() => {
    fetchClients();
  }, []);

  const hasActiveFilters =
    search.trim() !== '' ||
    statusFilter !== 'all' ||
    serviceFilter !== 'all' ||
    billingFilter !== 'all';

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setServiceFilter('all');
    setBillingFilter('all');
  };

  const handleDeleteContract = async (contract: Contract) => {
    if (deletingId) return;

    const confirmed = await confirm({
      title: 'Excluir contrato',
      tone: 'danger',
      confirmLabel: 'Excluir contrato',
      message: (
        <>
          O contrato de{' '}
          <strong className="text-navy-900">{contract.serviceType}</strong>
          {contract.client?.name ? (
            <>
              {' '}
              do cliente{' '}
              <strong className="text-navy-900">{contract.client.name}</strong>
            </>
          ) : null}{' '}
          será excluído junto com os arquivos anexados. Esta ação não pode ser desfeita.
        </>
      ),
    });
    if (!confirmed) return;

    try {
      setDeletingId(contract.id);
      await apiFetch(`/api/contracts/${contract.id}`, { method: 'DELETE' });
      toast.success('Contrato excluído.');
      fetchContracts();
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível excluir o contrato.'));
    } finally {
      setDeletingId(null);
    }
  };

  // Estatísticas do topo
  const activeContracts = contracts.filter((c) => c.status === 'ativo');
  const mrrCents = activeContracts
    .filter((c) => c.billingType === 'recorrente')
    .reduce((sum, c) => sum + c.valueCents, 0);
  const pontualCount = activeContracts.filter((c) => c.billingType === 'pontual').length;

  const statusColors: Record<string, string> = {
    ativo: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    pausado: 'bg-amber-50 text-amber-700 border-amber-200',
    encerrado: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  return (
    <div className="space-y-6">
      {/* Header da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-navy-900 tracking-tight">
            Contratos e arquivos
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Contratos recorrentes e pontuais, serviços contratados e documentos assinados.
          </p>
        </div>

        <Button
          onClick={() => {
            setContractToEdit(null);
            setIsContractModalOpen(true);
          }}
          icon={<Plus className="w-4 h-4" aria-hidden="true" />}
          className="self-start sm:self-auto flex-shrink-0"
        >
          Novo contrato
        </Button>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-bold border border-teal-100">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Contratos Ativos</span>
            <p className="text-lg font-bold text-navy-900 tabular-nums">
              {activeContracts.length}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold border border-emerald-100">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">MRR Recorrente Ativo</span>
            <p className="text-lg font-bold text-navy-900 font-mono tabular-nums">
              {formatCurrencyBRL(mrrCents)}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold border border-slate-200">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Contratos Pontuais / Projetos</span>
            <p className="text-lg font-bold text-navy-900 tabular-nums">
              {pontualCount}
            </p>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <section
        aria-label="Filtros da lista de contratos"
        className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <label htmlFor="contracts-search" className="sr-only">
              Buscar contratos por cliente ou escopo
            </label>
            <Search
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="contracts-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente ou escopo..."
              className={controlClassSm + ' pl-9'}
            />
          </div>

          <div>
            <label htmlFor="contracts-status" className="sr-only">
              Filtrar por status do contrato
            </label>
            <select
              id="contracts-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={controlClassSm}
            >
              <option value="all">Todos os status</option>
              <option value="ativo">Ativo</option>
              <option value="pausado">Pausado</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </div>

          <div>
            <label htmlFor="contracts-service" className="sr-only">
              Filtrar por tipo de serviço
            </label>
            <select
              id="contracts-service"
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className={controlClassSm}
            >
              <option value="all">Todos os serviços</option>
              {SERVICE_TYPES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="contracts-billing" className="sr-only">
              Filtrar por tipo de cobrança
            </label>
            <select
              id="contracts-billing"
              value={billingFilter}
              onChange={(e) => setBillingFilter(e.target.value)}
              className={controlClassSm}
            >
              <option value="all">Todos os tipos de cobrança</option>
              <option value="recorrente">Recorrente (mensalidade)</option>
              <option value="pontual">Pontual (projeto)</option>
            </select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="flex-shrink-0 whitespace-nowrap"
              >
                Limpar
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Tabela de Contratos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <LoadingState message="Carregando contratos..." />
        ) : loadError ? (
          <ErrorState
            title="Não foi possível carregar os contratos"
            message="A lista não pôde ser lida do servidor. Verifique sua conexão e tente novamente."
            onRetry={fetchContracts}
          />
        ) : contracts.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-6 h-6" />}
            title={
              hasActiveFilters
                ? 'Nenhum contrato corresponde aos filtros'
                : 'Nenhum contrato cadastrado ainda'
            }
            message={
              hasActiveFilters
                ? 'Ajuste os filtros ou limpe-os para ver todos os contratos.'
                : 'Cadastre o primeiro contrato para acompanhar receita recorrente e projetos.'
            }
            action={
              hasActiveFilters ? (
                <Button variant="secondary" size="sm" onClick={handleClearFilters}>
                  Limpar filtros
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    setContractToEdit(null);
                    setIsContractModalOpen(true);
                  }}
                  icon={<Plus className="w-4 h-4" aria-hidden="true" />}
                >
                  Novo contrato
                </Button>
              )
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="w-full min-w-[60rem] text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th scope="col" className="py-3 px-4">Cliente</th>
                  <th scope="col" className="py-3 px-4">Serviço e escopo</th>
                  <th scope="col" className="py-3 px-4">Cobrança</th>
                  <th scope="col" className="py-3 px-4 text-right">Valor</th>
                  <th scope="col" className="py-3 px-4">Vigência</th>
                  <th scope="col" className="py-3 px-4 text-center">Status</th>
                  <th scope="col" className="py-3 px-4 text-center">Anexos</th>
                  <th scope="col" className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {contracts.map((ct) => {
                  const isRecorrente = ct.billingType === 'recorrente';
                  return (
                    <tr key={ct.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Cliente */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-navy-900">
                          {ct.client?.name || 'Cliente desconhecido'}
                        </div>
                        {ct.client?.tradeName && (
                          <div className="text-[11px] text-slate-500">
                            {ct.client.tradeName}
                          </div>
                        )}
                      </td>

                      {/* Serviço */}
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800 block">
                          {ct.serviceType}
                        </span>
                        {ct.description && (
                          <span className="text-[11px] text-slate-500 line-clamp-1 max-w-xs block">
                            {ct.description}
                          </span>
                        )}
                      </td>

                      {/* Cobrança */}
                      <td className="py-3 px-4">
                        {isRecorrente ? (
                          <div>
                            <span className="inline-flex items-center gap-1 font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded text-[11px]">
                              Recorrente (Dia {ct.billingDay})
                            </span>
                            <span className="text-[11px] text-slate-500 block mt-0.5">
                              {ct.billingPeriodMonths === 1
                                ? 'Mensal'
                                : ct.billingPeriodMonths === 3
                                ? 'Trimestral'
                                : ct.billingPeriodMonths === 6
                                ? 'Semestral'
                                : ct.billingPeriodMonths === 12
                                ? 'Anual'
                                : `${ct.billingPeriodMonths} meses`}
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="inline-flex items-center gap-1 font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded text-[11px]">
                              Pontual ({ct.installments || 1}x)
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Valor */}
                      <td className="py-3 px-4 text-right">
                        <span className="font-mono font-bold text-navy-900 text-sm tabular-nums">
                          {formatCurrencyBRL(ct.valueCents)}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          {isRecorrente ? '/mês' : 'total'}
                        </span>
                      </td>

                      {/* Vigência */}
                      <td className="py-3 px-4 text-slate-600 text-[11px]">
                        <div>Início: {formatDateBR(ct.startDate)}</div>
                        <div className="text-slate-500">
                          Fim: {ct.endDate ? formatDateBR(ct.endDate) : 'Indeterminado'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium border capitalize ${
                            statusColors[ct.status] || 'bg-slate-100'
                          }`}
                        >
                          {ct.status}
                        </span>
                      </td>

                      {/* Anexos */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setContractForFiles(ct);
                            setIsFilesModalOpen(true);
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
                            ct.files && ct.files.length > 0
                              ? 'bg-teal-50 text-teal-700 hover:bg-teal-100 font-semibold border border-teal-200'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
                          }`}
                          aria-label={
                            'Gerenciar anexos do contrato de ' +
                            ct.serviceType +
                            ' (' +
                            (ct.files?.length || 0) +
                            ')'
                          }
                        >
                          <Paperclip className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{ct.files?.length || 0}</span>
                        </button>
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <IconButton
                            label={'Editar contrato de ' + ct.serviceType}
                            onClick={() => {
                              setContractToEdit(ct);
                              setIsContractModalOpen(true);
                            }}
                          >
                            <Edit2 className="w-4 h-4" aria-hidden="true" />
                          </IconButton>
                          <IconButton
                            label={'Excluir contrato de ' + ct.serviceType}
                            tone="danger"
                            onClick={() => handleDeleteContract(ct)}
                            isLoading={deletingId === ct.id}
                            disabled={deletingId !== null}
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Criação / Edição de Contrato */}
      <ContractModal
        isOpen={isContractModalOpen}
        onClose={() => {
          setIsContractModalOpen(false);
          setContractToEdit(null);
        }}
        contractToEdit={contractToEdit}
        clients={clients}
        onSuccess={() => {
          fetchContracts();
        }}
      />

      {/* Modal de Arquivos */}
      <ContractFilesModal
        isOpen={isFilesModalOpen}
        onClose={() => {
          setIsFilesModalOpen(false);
          setContractForFiles(null);
        }}
        contract={contractForFiles}
        onFilesUpdated={() => {
          fetchContracts();
        }}
      />
    </div>
  );
};
