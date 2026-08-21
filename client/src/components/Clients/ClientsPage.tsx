import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Client,
  LeadSource,
  PipelineStage,
  Priority,
  PaginatedClientsResponse,
} from '../../types/client';
import { User } from '../../types';
import { apiFetch, apiDownload, errorMessage } from '../../services/api';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useConfirm } from '../ui/ConfirmDialog';
import { Button, IconButton } from '../ui/Button';
import { LoadingState, EmptyState, ErrorState } from '../ui/States';
import { controlClassSm } from '../ui/Field';
import { formatDocument, formatPhoneBR } from '../../utils/formatters';
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

const STAGE_STYLES: Record<
  PipelineStage,
  { bg: string; text: string; border: string; dot: string }
> = {
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

const PRIORITY_LABELS: Record<Priority, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

export const ClientsPage: React.FC = () => {
  const confirm = useConfirm();

  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Paginação e filtros
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
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

  // Impede que um duplo clique dispare dois DELETE para o mesmo registro.
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Descarta respostas de buscas antigas que chegarem fora de ordem.
  const requestIdRef = useRef(0);

  const fetchUsers = async () => {
    try {
      const data = await apiFetch<User[]>('/api/users');
      setUsers(data);
    } catch {
      // Membros não-admin não têm acesso à lista de usuários; os filtros
      // por responsável simplesmente não são populados.
    }
  };

  const fetchClients = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      setIsLoading(true);
      setLoadError(false);

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
      if (stageFilter !== 'all') params.append('stage', stageFilter);
      if (sourceFilter !== 'all') params.append('leadSource', sourceFilter);
      if (serviceFilter !== 'all') params.append('serviceType', serviceFilter);
      if (ownerFilter !== 'all') params.append('ownerId', ownerFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);

      const res = await apiFetch<PaginatedClientsResponse>(
        `/api/clients?${params.toString()}`
      );

      if (requestId !== requestIdRef.current) return;
      setClients(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotalRecords(res.pagination.total);
    } catch {
      if (requestId !== requestIdRef.current) return;
      setClients([]);
      setTotalRecords(0);
      setTotalPages(1);
      setLoadError(true);
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [
    page,
    limit,
    debouncedSearch,
    stageFilter,
    sourceFilter,
    serviceFilter,
    ownerFilter,
    priorityFilter,
  ]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Volta para a primeira página sempre que a busca efetiva muda.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const handleDelete = async (client: Client) => {
    if (deletingId) return;

    const confirmed = await confirm({
      title: 'Excluir cliente',
      tone: 'danger',
      confirmLabel: 'Excluir cliente',
      message: (
        <>
          O cliente <strong className="text-navy-900">{client.name}</strong> será
          arquivado e deixará de aparecer nas listas, no pipeline e nos relatórios.
          Contratos e cobranças já registrados são preservados.
        </>
      ),
    });
    if (!confirmed) return;

    try {
      setDeletingId(client.id);
      await apiFetch(`/api/clients/${client.id}`, { method: 'DELETE' });
      toast.success(`Cliente "${client.name}" excluído.`);
      if (isDetailsModalOpen && selectedClientId === client.id) {
        setIsDetailsModalOpen(false);
      }
      fetchClients();
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível excluir o cliente.'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleExport = async () => {
    if (isExporting) return;
    try {
      setIsExporting(true);
      await apiDownload('/api/export/clients', 'clientes.csv');
      toast.success('Exportação concluída.');
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível exportar os clientes.'));
    } finally {
      setIsExporting(false);
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
    <div className="space-y-6 min-w-0">
      {/* Cabeçalho da página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-navy-900 tracking-tight">
            Clientes e leads
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Gerencie o pipeline comercial, a base de contatos e o histórico de atendimentos.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="secondary"
            onClick={handleExport}
            isLoading={isExporting}
            icon={<Download className="w-4 h-4" aria-hidden="true" />}
          >
            <span className="hidden sm:inline">Exportar CSV</span>
            <span className="sm:hidden">CSV</span>
          </Button>

          <Button
            onClick={handleOpenNew}
            icon={<UserPlus className="w-4 h-4" aria-hidden="true" />}
          >
            Novo cliente
          </Button>
        </div>
      </div>

      {/* Filtros e busca */}
      <section
        aria-label="Filtros da lista de clientes"
        className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-3">
          <div className="sm:col-span-2 xl:col-span-4 relative">
            <label htmlFor="clients-search" className="sr-only">
              Buscar clientes
            </label>
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="clients-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, documento, telefone ou e-mail…"
              className={`${controlClassSm} pl-9`}
            />
          </div>

          <div className="xl:col-span-2">
            <label htmlFor="clients-stage" className="sr-only">
              Filtrar por etapa do funil
            </label>
            <select
              id="clients-stage"
              value={stageFilter}
              onChange={(e) => {
                setStageFilter(e.target.value);
                setPage(1);
              }}
              className={controlClassSm}
            >
              <option value="all">Todas as etapas</option>
              {PIPELINE_STAGES.map((stg) => (
                <option key={stg} value={stg}>
                  {stg}
                </option>
              ))}
            </select>
          </div>

          <div className="xl:col-span-2">
            <label htmlFor="clients-source" className="sr-only">
              Filtrar por origem do lead
            </label>
            <select
              id="clients-source"
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setPage(1);
              }}
              className={controlClassSm}
            >
              <option value="all">Todas as origens</option>
              {LEAD_SOURCES.map((src) => (
                <option key={src} value={src}>
                  {src}
                </option>
              ))}
            </select>
          </div>

          <div className="xl:col-span-2">
            <label htmlFor="clients-service" className="sr-only">
              Filtrar por tipo de serviço
            </label>
            <select
              id="clients-service"
              value={serviceFilter}
              onChange={(e) => {
                setServiceFilter(e.target.value);
                setPage(1);
              }}
              className={controlClassSm}
            >
              <option value="all">Todos os serviços</option>
              {SERVICE_TYPES.map((svc) => (
                <option key={svc} value={svc}>
                  {svc}
                </option>
              ))}
            </select>
          </div>

          <div className="xl:col-span-2">
            <label htmlFor="clients-owner" className="sr-only">
              Filtrar por responsável
            </label>
            <select
              id="clients-owner"
              value={ownerFilter}
              onChange={(e) => {
                setOwnerFilter(e.target.value);
                setPage(1);
              }}
              className={controlClassSm}
            >
              <option value="all">Todos os responsáveis</option>
              <option value="unassigned">Sem responsável</option>
              <option value="inactive">Responsável inativo</option>
              <optgroup label="Usuários ativos">
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

          <div className="xl:col-span-2 flex items-center gap-2">
            <label htmlFor="clients-priority" className="sr-only">
              Filtrar por prioridade
            </label>
            <select
              id="clients-priority"
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
              className={controlClassSm}
            >
              <option value="all">Todas as prioridades</option>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>

            {hasActiveFilters && (
              <IconButton
                label="Limpar filtros"
                onClick={handleClearFilters}
                className="flex-shrink-0"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </IconButton>
            )}
          </div>
        </div>

        {/* Reatribuição de leads órfãos (RF-06c) */}
        {isInactiveOwnerFiltered && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
            <div className="flex items-start sm:items-center gap-2">
              <AlertTriangle
                className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5 sm:mt-0"
                aria-hidden="true"
              />
              <span>
                Estes leads pertencem a responsáveis desativados. Reatribua-os a um
                membro ativo para que voltem a ter dono.
              </span>
            </div>
            {clients.length > 0 && (
              <Button
                size="sm"
                onClick={() => setIsBatchReassignOpen(true)}
                className="flex-shrink-0 whitespace-nowrap"
              >
                Reatribuir {clients.length}{' '}
                {clients.length === 1 ? 'lead' : 'leads'}
              </Button>
            )}
          </div>
        )}
      </section>

      {/* Tabela de clientes */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <LoadingState message="Carregando clientes…" />
        ) : loadError ? (
          <ErrorState
            title="Não foi possível carregar os clientes"
            message="A lista não pôde ser lida do servidor. Verifique sua conexão e tente novamente."
            onRetry={fetchClients}
          />
        ) : clients.length === 0 ? (
          <EmptyState
            icon={<Users className="w-6 h-6" />}
            title={
              hasActiveFilters
                ? 'Nenhum cliente corresponde aos filtros'
                : 'Nenhum cliente cadastrado ainda'
            }
            message={
              hasActiveFilters
                ? 'Ajuste os filtros ou limpe-os para ver toda a base.'
                : 'Cadastre o primeiro cliente ou lead para começar a acompanhar o pipeline comercial.'
            }
            action={
              hasActiveFilters ? (
                <Button variant="secondary" size="sm" onClick={handleClearFilters}>
                  Limpar filtros
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleOpenNew}
                  icon={<UserPlus className="w-4 h-4" aria-hidden="true" />}
                >
                  Novo cliente
                </Button>
              )
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="w-full min-w-[52rem] text-left text-xs border-collapse">
              <caption className="sr-only">
                Clientes e leads cadastrados. Cada linha abre a ficha completa.
              </caption>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600 uppercase tracking-wider">
                  <th scope="col" className="py-3 px-0 w-3">
                    <span className="sr-only">Prioridade</span>
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Cliente / razão social
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Documento
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Contato
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Origem
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Etapa do funil
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Responsável
                  </th>
                  <th scope="col" className="py-3 px-4 text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {clients.map((c) => {
                  const stageStyle = STAGE_STYLES[c.stage] || STAGE_STYLES['Novo Lead'];
                  const priority = c.priority || 'media';

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50 focus-within:bg-slate-50 transition-colors group"
                    >
                      {/* Barra lateral de prioridade */}
                      <td className="py-3 px-0 relative">
                        <span
                          className={`absolute inset-y-1.5 left-1 w-1 rounded-full ${PRIORITY_BARS[priority]}`}
                          aria-hidden="true"
                        />
                        <span className="sr-only">
                          Prioridade {PRIORITY_LABELS[priority]}
                        </span>
                      </td>

                      {/* Nome — âncora acessível para abrir a ficha */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs flex-shrink-0 border border-teal-200/60"
                            aria-hidden="true"
                          >
                            {c.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => handleOpenDetails(c)}
                              className="font-bold text-navy-900 group-hover:text-teal-700 transition-colors text-left rounded-sm"
                            >
                              {c.name}
                            </button>
                            {c.tradeName && (
                              <div className="text-[11px] text-slate-500 font-normal">
                                {c.tradeName}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                        {formatDocument(c.documentNumber, c.documentType)}
                      </td>

                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          {c.phone && (
                            <div className="flex items-center gap-1.5 text-slate-700 font-mono whitespace-nowrap">
                              <Phone
                                className="w-3 h-3 text-teal-600 flex-shrink-0"
                                aria-hidden="true"
                              />
                              <span>{formatPhoneBR(c.phone)}</span>
                            </div>
                          )}
                          {c.email && (
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <Mail
                                className="w-3 h-3 text-slate-400 flex-shrink-0"
                                aria-hidden="true"
                              />
                              <span className="truncate max-w-[180px]">{c.email}</span>
                            </div>
                          )}
                          {!c.phone && !c.email && (
                            <span className="text-slate-500 italic">Sem contato</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-700 font-medium whitespace-nowrap">
                        {c.leadSource}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${stageStyle.bg} ${stageStyle.text} ${stageStyle.border}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${stageStyle.dot}`}
                            aria-hidden="true"
                          />
                          <span>{c.stage}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {c.owner ? (
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] uppercase text-white flex-shrink-0 ${
                                c.owner.active ? 'bg-navy-800' : 'bg-slate-500'
                              }`}
                              aria-hidden="true"
                            >
                              {c.owner.name.substring(0, 2)}
                            </div>
                            <div>
                              <div className="font-medium text-slate-800 whitespace-nowrap">
                                {c.owner.name}
                              </div>
                              {!c.owner.active && (
                                <span className="inline-block text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-1 rounded font-semibold">
                                  Inativo
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Sem responsável</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-0.5">
                          <IconButton
                            label={`Enviar WhatsApp para ${c.name}`}
                            tone="whatsapp"
                            onClick={() => handleOpenWhatsApp(c)}
                          >
                            <MessageSquare className="w-4 h-4" aria-hidden="true" />
                          </IconButton>
                          <IconButton
                            label={`Ver ficha de ${c.name}`}
                            onClick={() => handleOpenDetails(c)}
                          >
                            <Eye className="w-4 h-4" aria-hidden="true" />
                          </IconButton>
                          <IconButton
                            label={`Editar ${c.name}`}
                            onClick={() => handleOpenEdit(c)}
                          >
                            <Edit2 className="w-4 h-4" aria-hidden="true" />
                          </IconButton>
                          <IconButton
                            label={`Excluir ${c.name}`}
                            tone="danger"
                            onClick={() => handleDelete(c)}
                            isLoading={deletingId === c.id}
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

        {/* Paginação */}
        {!loadError && (
          <nav
            aria-label="Paginação de clientes"
            className="p-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600"
          >
            <p aria-live="polite">
              Exibindo{' '}
              <strong className="text-navy-900 font-bold tabular-nums">
                {totalRecords === 0 ? 0 : (page - 1) * limit + 1}
              </strong>{' '}
              a{' '}
              <strong className="text-navy-900 font-bold tabular-nums">
                {Math.min(page * limit, totalRecords)}
              </strong>{' '}
              de{' '}
              <strong className="text-navy-900 font-bold tabular-nums">
                {totalRecords}
              </strong>{' '}
              {totalRecords === 1 ? 'cliente' : 'clientes'}
            </p>

            <div className="flex items-center gap-1 self-end sm:self-auto">
              <IconButton
                label="Página anterior"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || isLoading}
                className="border border-slate-200"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </IconButton>

              <span className="px-3 py-1 text-slate-700 font-medium whitespace-nowrap">
                Página <span className="font-bold tabular-nums">{page}</span> de{' '}
                <span className="font-bold tabular-nums">{totalPages}</span>
              </span>

              <IconButton
                label="Próxima página"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isLoading}
                className="border border-slate-200"
              >
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </IconButton>
            </div>
          </nav>
        )}
      </div>

      <ClientModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        onSuccess={fetchClients}
        clientToEdit={clientToEdit}
        users={users}
      />

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
        onDelete={handleDelete}
        onUpdated={fetchClients}
        users={users}
      />

      <BatchReassignModal
        isOpen={isBatchReassignOpen}
        onClose={() => setIsBatchReassignOpen(false)}
        onSuccess={fetchClients}
        selectedClientIds={inactiveClientIds}
        users={users}
      />

      {whatsAppModalData && (
        <WhatsAppModal
          isOpen
          onClose={() => setWhatsAppModalData(null)}
          initialTemplate="onboarding"
          data={whatsAppModalData}
        />
      )}
    </div>
  );
};
