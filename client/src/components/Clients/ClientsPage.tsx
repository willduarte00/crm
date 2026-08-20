import React, { useState, useEffect, useCallback } from 'react';
import {
  Client,
  LeadSource,
  PipelineStage,
  Priority,
  PaginatedClientsResponse,
} from '../../types/client';
import { User } from '../../types';
import { apiFetch } from '../../services/api';
import {
  formatDocument,
  formatPhoneBR,
} from '../../utils/formatters';
import { ClientModal } from './ClientModal';
import { ClientDetailsModal } from './ClientDetailsModal';
import { BatchReassignModal } from './BatchReassignModal';
import { WhatsAppModal, WhatsAppModalData } from '../WhatsApp/WhatsAppModal';
import {
  Users,
  UserPlus,
  Search,
  Eye,
  Edit2,
  Trash2,
  Phone,
  Mail,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  X,
  Download,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';

const LEAD_SOURCES: LeadSource[] = [
  'Instagram',
  'Indicação',
  'Google Ads',
  'Prospecção Ativa',
  'LinkedIn',
  'Outro',
];

const PIPELINE_STAGES: PipelineStage[] = [
  'Novo Lead',
  'Contato/Qualificação',
  'Proposta Enviada',
  'Em Negociação',
  'Contrato Ativo',
  'Pausado/Churn',
];

const SERVICE_TYPES = [
  'Tráfego Pago',
  'Social Media & Conteúdo',
  'Sites/Landing Pages',
  'Branding',
  'SEO',
  'Pacote Completo',
];

const STAGE_STYLES: Record<PipelineStage, { bg: string; text: string; border: string; dot: string }> = {
  'Novo Lead': {
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    border: 'border-slate-200',
    dot: 'bg-slate-500',
  },
  'Contato/Qualificação': {
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  'Proposta Enviada': {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  'Em Negociação': {
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
  'Contrato Ativo': {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  'Pausado/Churn': {
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
  },
};

const PRIORITY_BARS: Record<Priority, string> = {
  alta: 'bg-rose-500',
  media: 'bg-slate-300',
  baixa: 'bg-teal-500',
};

export const ClientsPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Paginação e filtros
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Modais
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const [isBatchReassignOpen, setIsBatchReassignOpen] = useState(false);
  const [whatsAppModalData, setWhatsAppModalData] = useState<WhatsAppModalData | null>(null);

  // Carregar usuários para os filtros e selects
  const fetchUsers = async () => {
    try {
      const data = await apiFetch<User[]>('/api/users');
      setUsers(data);
    } catch {
      // Ignora erro se usuário não for admin
    }
  };

  // Carregar clientes
  const fetchClients = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      if (search.trim()) params.append('search', search.trim());
      if (stageFilter !== 'all') params.append('stage', stageFilter);
      if (sourceFilter !== 'all') params.append('leadSource', sourceFilter);
      if (serviceFilter !== 'all') params.append('serviceType', serviceFilter);
      if (ownerFilter !== 'all') params.append('ownerId', ownerFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);

      const res = await apiFetch<PaginatedClientsResponse>(`/api/clients?${params.toString()}`);
      setClients(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotalRecords(res.pagination.total);
    } catch (err: any) {
      toast.error('Erro ao carregar lista de clientes');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, stageFilter, sourceFilter, serviceFilter, ownerFilter, priorityFilter]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Soft delete com confirmação
  const handleDelete = async (client: Client) => {
    if (
      !confirm(
        `Deseja realmente excluir o cliente "${client.name}"? O registro será arquivado no sistema.`
      )
    ) {
      return;
    }

    try {
      await apiFetch(`/api/clients/${client.id}`, {
        method: 'DELETE',
      });
      toast.success(`Cliente "${client.name}" excluído com sucesso`);
      if (isDetailsModalOpen && selectedClientId === client.id) {
        setIsDetailsModalOpen(false);
      }
      fetchClients();
    } catch (err: any) {
      toast.error('Erro ao excluir cliente');
    }
  };

  const handleOpenNew = () => {
    setClientToEdit(null);
    setIsClientModalOpen(true);
  };

  const handleOpenEdit = (client: Client) => {
    setClientToEdit(client);
    setIsClientModalOpen(true);
  };

  const handleOpenDetails = (client: Client) => {
    setSelectedClientId(client.id);
    setIsDetailsModalOpen(true);
  };

  const handleOpenWhatsApp = (client: Client) => {
    setWhatsAppModalData({
      nome: client.tradeName || client.name,
      phone: client.phone,
    });
  };

  const handleClearFilters = () => {
    setSearch('');
    setStageFilter('all');
    setSourceFilter('all');
    setServiceFilter('all');
    setOwnerFilter('all');
    setPriorityFilter('all');
    setPage(1);
  };

  const hasActiveFilters =
    search.trim() !== '' ||
    stageFilter !== 'all' ||
    sourceFilter !== 'all' ||
    serviceFilter !== 'all' ||
    ownerFilter !== 'all' ||
    priorityFilter !== 'all';

  const isInactiveOwnerFiltered = ownerFilter === 'inactive';
  const inactiveClientIds = isInactiveOwnerFiltered ? clients.map((c) => c.id) : [];

  return (
    <div className="space-y-6">
      {/* Header da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 tracking-tight">
            Clientes & Leads
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Gerencie o pipeline comercial, base de contatos e histórico de atendimentos
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/api/export/clients"
            download
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded transition-colors shadow-2xs"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Exportar CSV</span>
          </a>

          <button
            onClick={handleOpenNew}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded transition-colors shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            <span>Novo Cliente</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Busca Textual */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por nome, documento, telefone, e-mail..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-navy-900 placeholder:text-slate-400"
            />
          </div>

          {/* Filtro por Etapa (RF-04) */}
          <div className="md:col-span-2">
            <select
              value={stageFilter}
              onChange={(e) => {
                setStageFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-teal-600 text-navy-900"
            >
              <option value="all">Todas as Etapas</option>
              {PIPELINE_STAGES.map((stg) => (
                <option key={stg} value={stg}>
                  {stg}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Origem (RF-03) */}
          <div className="md:col-span-2">
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-teal-600 text-navy-900"
            >
              <option value="all">Todas as Origens</option>
              {LEAD_SOURCES.map((src) => (
                <option key={src} value={src}>
                  {src}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Tipo de Serviço (RF-10) */}
          <div className="md:col-span-2">
            <select
              value={serviceFilter}
              onChange={(e) => {
                setServiceFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-teal-600 text-navy-900"
            >
              <option value="all">Todos os Serviços</option>
              {SERVICE_TYPES.map((svc) => (
                <option key={svc} value={svc}>
                  {svc}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Responsável (RF-06a, RF-06c) */}
          <div className="md:col-span-2">
            <select
              value={ownerFilter}
              onChange={(e) => {
                setOwnerFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-teal-600 text-navy-900"
            >
              <option value="all">Todos os Responsáveis</option>
              <option value="unassigned">Sem responsável</option>
              <option value="inactive">Responsável inativo (RF-06c)</option>
              <optgroup label="Usuários Ativos">
                {users
                  .filter((u) => u.active)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>

          {/* Filtro por Prioridade (RF-06b) */}
          <div className="md:col-span-2 flex items-center gap-2">
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-teal-600 text-navy-900"
            >
              <option value="all">Todas as Prioridades</option>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                title="Limpar filtros"
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Banner de Responsável Inativo (RF-06c) */}
        {isInactiveOwnerFiltered && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>
                Exibindo leads cujos responsáveis foram desativados. Você pode reatribuí-los
                em lote para um membro ativo.
              </span>
            </div>
            {clients.length > 0 && (
              <button
                onClick={() => setIsBatchReassignOpen(true)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded shadow-xs transition-colors whitespace-nowrap"
              >
                Reatribuir {clients.length} leads em lote
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabela de Clientes */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            <p className="text-sm">Carregando clientes...</p>
          </div>
        ) : clients.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="font-semibold text-base text-navy-900">
              Nenhum cliente ou lead encontrado
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {hasActiveFilters
                ? 'Nenhum resultado corresponde aos filtros selecionados. Tente ajustar os parâmetros ou limpar os filtros.'
                : 'Cadastre o primeiro cliente da agência clicando no botão "Novo Cliente" acima.'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="mt-4 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 border border-teal-200 rounded transition-colors"
              >
                Limpar todos os filtros
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-3 w-3"></th>
                  <th className="py-3 px-4">Cliente / Razão Social</th>
                  <th className="py-3 px-4">Documento</th>
                  <th className="py-3 px-4">Contato</th>
                  <th className="py-3 px-4">Origem</th>
                  <th className="py-3 px-4">Etapa do Funil</th>
                  <th className="py-3 px-4">Responsável</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {clients.map((c) => {
                  const stageStyle = STAGE_STYLES[c.stage] || STAGE_STYLES['Novo Lead'];
                  const priorityColor = PRIORITY_BARS[c.priority || 'media'];

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                      onClick={() => handleOpenDetails(c)}
                    >
                      {/* Barra de Prioridade na lateral esquerda */}
                      <td className="py-3 px-0 relative">
                        <span
                          className={`absolute inset-y-1.5 left-1 w-1 rounded-full ${priorityColor}`}
                          title={`Prioridade: ${c.priority || 'media'}`}
                        />
                      </td>

                      {/* Nome / Razão Social */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs flex-shrink-0 border border-teal-200/50">
                            {c.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-navy-900 group-hover:text-teal-700 transition-colors">
                              {c.name}
                            </div>
                            {c.tradeName && (
                              <div className="text-[11px] text-slate-500 font-normal">
                                {c.tradeName}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Documento (CPF / CNPJ) com máscara */}
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {formatDocument(c.documentNumber, c.documentType)}
                      </td>

                      {/* Contato (Email + Telefone formatado) */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          {c.phone && (
                            <div className="flex items-center gap-1.5 text-slate-700 font-mono">
                              <Phone className="w-3 h-3 text-teal-600 flex-shrink-0" />
                              <span>{formatPhoneBR(c.phone)}</span>
                            </div>
                          )}
                          {c.email && (
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" />
                              <span className="truncate max-w-[180px]">{c.email}</span>
                            </div>
                          )}
                          {!c.phone && !c.email && (
                            <span className="text-slate-400 italic">Sem contato</span>
                          )}
                        </div>
                      </td>

                      {/* Origem do Lead */}
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {c.leadSource}
                      </td>

                      {/* Etapa do Funil (Pill) */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${stageStyle.bg} ${stageStyle.text} ${stageStyle.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${stageStyle.dot}`} />
                          <span>{c.stage}</span>
                        </span>
                      </td>

                      {/* Responsável (RF-06a, RF-06c) */}
                      <td className="py-3 px-4">
                        {c.owner ? (
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] uppercase text-white ${
                                c.owner.active ? 'bg-navy-800' : 'bg-slate-400'
                              }`}
                            >
                              {c.owner.name.substring(0, 2)}
                            </div>
                            <div>
                              <div className="font-medium text-slate-800">
                                {c.owner.name}
                              </div>
                              {!c.owner.active && (
                                <span className="inline-block text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1 rounded font-semibold">
                                  Inativo
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Sem responsável</span>
                        )}
                      </td>

                      {/* Ações */}
                      <td
                        className="py-3 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleOpenWhatsApp(c)}
                            title="Enviar mensagem via WhatsApp"
                            className="p-1.5 text-slate-500 hover:text-[#25D366] hover:bg-[#25D366]/10 rounded transition-colors"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenDetails(c)}
                            title="Visualizar ficha"
                            className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(c)}
                            title="Editar cliente"
                            className="p-1.5 text-slate-500 hover:text-navy-900 hover:bg-slate-100 rounded transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(c)}
                            title="Excluir cliente"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
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

        {/* Rodapé de Paginação */}
        <div className="p-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Exibindo{' '}
            <strong className="text-navy-900 font-bold tabular-nums">
              {totalRecords === 0 ? 0 : (page - 1) * limit + 1}
            </strong>{' '}
            a{' '}
            <strong className="text-navy-900 font-bold tabular-nums">
              {Math.min(page * limit, totalRecords)}
            </strong>{' '}
            de{' '}
            <strong className="text-navy-900 font-bold tabular-nums">{totalRecords}</strong>{' '}
            clientes cadastrados
          </div>

          <div className="flex items-center gap-1 self-end sm:self-auto">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || isLoading}
              className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 text-slate-700 font-medium">
              Página <span className="font-bold tabular-nums">{page}</span> de{' '}
              <span className="font-bold tabular-nums">{totalPages}</span>
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || isLoading}
              className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Criação / Edição de Cliente */}
      <ClientModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        onSuccess={fetchClients}
        clientToEdit={clientToEdit}
        users={users}
      />

      {/* Modal de Ficha Detalhada */}
      <ClientDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedClientId(null);
        }}
        clientId={selectedClientId}
        onEdit={(c) => {
          setIsDetailsModalOpen(false);
          handleOpenEdit(c);
        }}
        onDelete={(c) => {
          handleDelete(c);
        }}
        onUpdated={fetchClients}
        users={users}
      />

      {/* Modal de Reatribuição em Lote */}
      <BatchReassignModal
        isOpen={isBatchReassignOpen}
        onClose={() => setIsBatchReassignOpen(false)}
        onSuccess={fetchClients}
        selectedClientIds={inactiveClientIds}
        users={users}
      />

      {/* Modal de WhatsApp */}
      {whatsAppModalData && (
        <WhatsAppModal
          isOpen={true}
          onClose={() => setWhatsAppModalData(null)}
          initialTemplate="onboarding"
          data={whatsAppModalData}
        />
      )}
    </div>
  );
};
