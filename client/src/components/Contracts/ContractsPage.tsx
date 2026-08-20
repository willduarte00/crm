import React, { useState, useEffect } from 'react';
import { Contract, SERVICE_TYPES } from '../../types/contract';
import { Client } from '../../types/client';
import { apiFetch } from '../../services/api';
import {
  formatDateBR,
  formatCurrencyBRL,
} from '../../utils/formatters';
import { ContractModal } from './ContractModal';
import { ContractFilesModal } from './ContractFilesModal';
import {
  FileText,
  Plus,
  Search,
  Paperclip,
  Edit2,
  Trash2,
  Loader2,
  CreditCard,
  DollarSign,
  Briefcase,
} from 'lucide-react';
import { toast } from 'sonner';

export const ContractsPage: React.FC = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [billingFilter, setBillingFilter] = useState<string>('all');

  // Modais
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [contractToEdit, setContractToEdit] = useState<Contract | null>(null);
  const [isFilesModalOpen, setIsFilesModalOpen] = useState(false);
  const [contractForFiles, setContractForFiles] = useState<Contract | null>(null);

  const fetchContracts = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (serviceFilter !== 'all') params.append('serviceType', serviceFilter);
      if (billingFilter !== 'all') params.append('billingType', billingFilter);

      const queryString = params.toString();
      const url = queryString ? `/api/contracts?${queryString}` : '/api/contracts';
      const data = await apiFetch<Contract[]>(url);
      setContracts(data);
    } catch (err: any) {
      toast.error('Erro ao carregar lista de contratos.');
    } finally {
      setIsLoading(false);
    }
  };

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
  }, [statusFilter, serviceFilter, billingFilter]);

  useEffect(() => {
    fetchClients();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchContracts();
  };

  const handleDeleteContract = async (contract: Contract) => {
    if (
      !confirm(
        `Deseja realmente excluir o contrato de ${contract.serviceType} do cliente ${
          contract.client?.name || ''
        }?`
      )
    ) {
      return;
    }

    try {
      await apiFetch(`/api/contracts/${contract.id}`, {
        method: 'DELETE',
      });
      toast.success('Contrato excluído com sucesso!');
      fetchContracts();
    } catch (err: any) {
      toast.error('Erro ao excluir contrato.');
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
        <div>
          <h1 className="text-xl font-bold text-navy-900">Contratos & Arquivos</h1>
          <p className="text-xs text-slate-500 mt-1">
            Gestão de contratos recorrentes e pontuais, serviços contratados e documentos assinados.
          </p>
        </div>

        <button
          onClick={() => {
            setContractToEdit(null);
            setIsContractModalOpen(true);
          }}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded flex items-center gap-2 transition-colors shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Contrato</span>
        </button>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex items-center gap-3">
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

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex items-center gap-3">
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

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex items-center gap-3">
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
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Busca */}
          <form onSubmit={handleSearchSubmit} className="md:col-span-1">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por cliente ou escopo..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-navy-900"
              />
            </div>
          </form>

          {/* Filtro Status */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-teal-600 text-navy-900"
            >
              <option value="all">Todos os Status</option>
              <option value="ativo">Ativo</option>
              <option value="pausado">Pausado</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </div>

          {/* Filtro Tipo de Serviço */}
          <div>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-teal-600 text-navy-900"
            >
              <option value="all">Todos os Serviços</option>
              {SERVICE_TYPES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Tipo de Cobrança */}
          <div>
            <select
              value={billingFilter}
              onChange={(e) => setBillingFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-teal-600 text-navy-900"
            >
              <option value="all">Todos os Tipos de Cobrança</option>
              <option value="recorrente">Recorrente (Mensalidade)</option>
              <option value="pontual">Pontual (Projeto)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Contratos */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            <p className="text-xs font-medium">Carregando contratos...</p>
          </div>
        ) : contracts.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <h3 className="text-sm font-bold text-navy-900">
              Nenhum contrato encontrado
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Nenhum registro corresponde aos filtros selecionados ou nenhum contrato foi cadastrado.
            </p>
            <button
              onClick={() => {
                setContractToEdit(null);
                setIsContractModalOpen(true);
              }}
              className="mt-4 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded inline-flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Contrato</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Serviço & Escopo</th>
                  <th className="py-3 px-4">Cobrança</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-4">Vigência</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Anexos</th>
                  <th className="py-3 px-4 text-right">Ações</th>
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
                          <span className="text-[11px] text-slate-400 line-clamp-1 max-w-xs block">
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
                            <span className="text-[11px] text-slate-400 block mt-0.5">
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
                        <span className="text-[10px] text-slate-400 block">
                          {isRecorrente ? '/mês' : 'total'}
                        </span>
                      </td>

                      {/* Vigência */}
                      <td className="py-3 px-4 text-slate-600 text-[11px]">
                        <div>Início: {formatDateBR(ct.startDate)}</div>
                        <div className="text-slate-400">
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
                          onClick={() => {
                            setContractForFiles(ct);
                            setIsFilesModalOpen(true);
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                            ct.files && ct.files.length > 0
                              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                          title="Gerenciar documentos anexados"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          <span>{ct.files?.length || 0}</span>
                        </button>
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setContractToEdit(ct);
                              setIsContractModalOpen(true);
                            }}
                            title="Editar contrato"
                            className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteContract(ct)}
                            title="Excluir contrato"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
