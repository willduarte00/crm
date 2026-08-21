import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import {
  Client,
  PipelineStage,
  LeadSource,
  PaginatedClientsResponse,
} from '../../types/client';
import { User } from '../../types';
import { apiFetch, AppApiError, errorMessage } from '../../services/api';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useConfirm } from '../ui/ConfirmDialog';
import { Button, IconButton } from '../ui/Button';
import { LoadingState, ErrorState } from '../ui/States';
import { controlClassSm } from '../ui/Field';
import { KanbanColumn } from './KanbanColumn';
import { ClientModal } from '../Clients/ClientModal';
import { ClientDetailsModal } from '../Clients/ClientDetailsModal';
import { Search, Plus, RefreshCw, Users, Kanban as KanbanIcon } from 'lucide-react';
import { toast } from 'sonner';

const PIPELINE_STAGES: PipelineStage[] = [
  'Novo Lead',
  'Contato/Qualificação',
  'Proposta Enviada',
  'Em Negociação',
  'Contrato Ativo',
  'Pausado/Churn',
];

const LEAD_SOURCES: LeadSource[] = [
  'Instagram',
  'Indicação',
  'Google Ads',
  'Prospecção Ativa',
  'LinkedIn',
  'Outro',
];

export const KanbanPage: React.FC = () => {
  const confirm = useConfirm();

  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filtros
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Modais
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Carregar usuários para filtro e modais
  const fetchUsers = async () => {
    try {
      const data = await apiFetch<User[]>('/api/users');
      setUsers(data);
    } catch {
      // Ignora erro se não for admin (RF-08)
    }
  };

  // Carregar todos os leads do pipeline
  const fetchClients = useCallback(async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setLoadError(false);

      const params = new URLSearchParams({
        page: '1',
        limit: '1000', // Teto amplo para carregar todo o pipeline
      });

      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
      if (ownerFilter !== 'all') params.append('ownerId', ownerFilter);
      if (sourceFilter !== 'all') params.append('leadSource', sourceFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);

      const res = await apiFetch<PaginatedClientsResponse>(`/api/clients?${params.toString()}`);
      setClients(res.data || []);
    } catch {
      setClients([]);
      setLoadError(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [debouncedSearch, ownerFilter, sourceFilter, priorityFilter]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Agrupar leads por etapa
  const columnsData = useMemo(() => {
    const grouped: Record<PipelineStage, Client[]> = {
      'Novo Lead': [],
      'Contato/Qualificação': [],
      'Proposta Enviada': [],
      'Em Negociação': [],
      'Contrato Ativo': [],
      'Pausado/Churn': [],
    };

    clients.forEach((client) => {
      if (grouped[client.stage]) {
        grouped[client.stage].push(client);
      } else {
        grouped['Novo Lead'].push(client);
      }
    });

    return grouped;
  }, [clients]);

  // Total de leads visíveis
  const totalLeads = clients.length;

  // Movimentação otimista com rollback em erro
  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;

    const sourceStage = source.droppableId as PipelineStage;
    const destStage = destination.droppableId as PipelineStage;

    // Se soltou no mesmo lugar, não faz nada
    if (sourceStage === destStage && source.index === destination.index) {
      return;
    }

    // Salva o snapshot atual para rollback
    const previousClients = [...clients];

    // Localiza o cliente arrastado
    const draggedClient = clients.find((c) => c.id === draggableId);
    if (!draggedClient) return;

    // Atualização otimista do estado local
    const updatedClients = clients.map((c) => {
      if (c.id === draggableId) {
        return { ...c, stage: destStage };
      }
      return c;
    });

    setClients(updatedClients);

    // Se mudou de coluna, envia PATCH para persistir no backend
    if (sourceStage !== destStage) {
      try {
        const updated = await apiFetch<Client>(`/api/clients/${draggableId}/stage`, {
          method: 'PATCH',
          body: JSON.stringify({ stage: destStage }),
        });

        toast.success(`Lead movido para "${destStage}"`);

        // Sincroniza com a resposta oficial do backend
        setClients((current) =>
          current.map((c) => (c.id === draggableId ? { ...c, stage: updated.stage } : c))
        );
      } catch (err: any) {
        // Rollback imediato do estado
        setClients(previousClients);
        const errorMsg =
          err instanceof AppApiError
            ? err.data.error || 'Erro ao atualizar etapa do lead'
            : 'Erro de conexão ao mover lead. Alteração revertida.';
        toast.error(`${errorMsg} — Card revertido para "${sourceStage}".`);
      }
    }
  };

  const handleCardClick = (client: Client) => {
    setSelectedClientId(client.id);
    setIsDetailsModalOpen(true);
  };

  const handleEditClient = (client: Client) => {
    setClientToEdit(client);
    setIsDetailsModalOpen(false);
    setIsClientModalOpen(true);
  };

  const handleDeleteClient = async (client: Client) => {
    if (isDeleting) return;

    const confirmed = await confirm({
      title: 'Excluir lead',
      tone: 'danger',
      confirmLabel: 'Excluir lead',
      message: (
        <>
          O lead <strong className="text-navy-900">{client.name}</strong> será
          arquivado e sairá do pipeline. Contratos e cobranças já registrados são
          preservados.
        </>
      ),
    });
    if (!confirmed) return;

    try {
      setIsDeleting(true);
      await apiFetch(`/api/clients/${client.id}`, { method: 'DELETE' });
      toast.success('Lead excluído.');
      setIsDetailsModalOpen(false);
      fetchClients();
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível excluir o lead.'));
    } finally {
      setIsDeleting(false);
    }
  };

  const activeUsers = users.filter((u) => u.active);

  return (
    <div className="flex-1 min-h-[32rem] flex flex-col overflow-hidden bg-white rounded-xl border border-slate-200 shadow-xs">
      {/* Barra Superior do Quadro */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shrink-0 rounded-t-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <KanbanIcon className="w-5 h-5 text-teal-600" aria-hidden="true" />
              <h1 className="text-xl font-bold text-navy-900 leading-tight">
                Pipeline de vendas
              </h1>
              <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full border border-slate-200 tabular-nums">
                {totalLeads} {totalLeads === 1 ? 'oportunidade' : 'oportunidades'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Arraste os cards entre as 6 etapas do funil para atualizar a negociação.
            </p>
          </div>

          {/* Ação Novo Lead e Atualizar */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <IconButton
              label="Atualizar quadro"
              onClick={() => fetchClients(true)}
              disabled={isRefreshing || isLoading}
              className="border border-slate-200"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-teal-600' : ''}`}
                aria-hidden="true"
              />
            </IconButton>

            <Button
              size="sm"
              onClick={() => {
                setClientToEdit(null);
                setIsClientModalOpen(true);
              }}
              icon={<Plus className="w-4 h-4" aria-hidden="true" />}
            >
              Novo lead
            </Button>
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="mt-3.5 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          {/* Busca Textual */}
          <div className="relative flex-1 min-w-[15rem] max-w-md">
            <label htmlFor="kanban-search" className="sr-only">
              Buscar leads
            </label>
            <Search
              className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="kanban-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, documento ou anotação..."
              className={controlClassSm + ' pl-9'}
            />
          </div>

          {/* Dropdowns de Filtro */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Filtro por Responsável (RF-06a, RF-06c) */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
              <Users className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              <label htmlFor="kanban-owner" className="sr-only">
                Filtrar por responsável
              </label>
              <select
                id="kanban-owner"
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-slate-700 text-xs font-medium cursor-pointer py-0.5 pr-6"
              >
                <option value="all">Todos os responsáveis</option>
                <option value="unassigned">Sem responsável</option>
                <option value="inactive">Responsáveis inativos</option>
                {activeUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por Prioridade (RF-06b) */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
              <label htmlFor="kanban-priority" className="text-slate-600 font-medium">
                Prioridade:
              </label>
              <select
                id="kanban-priority"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-slate-700 text-xs font-medium cursor-pointer py-0.5 pr-6"
              >
                <option value="all">Todas</option>
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>

            {/* Filtro por Origem (RF-03) */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
              <label htmlFor="kanban-source" className="text-slate-600 font-medium">
                Origem:
              </label>
              <select
                id="kanban-source"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-slate-700 text-xs font-medium cursor-pointer py-0.5 pr-6"
              >
                <option value="all">Todas as origens</option>
                {LEAD_SOURCES.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
            </div>

            {/* Limpar filtros se algum estiver ativo */}
            {(search || ownerFilter !== 'all' || sourceFilter !== 'all' || priorityFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setOwnerFilter('all');
                  setSourceFilter('all');
                  setPriorityFilter('all');
                }}
                className="text-teal-700 hover:text-teal-800 hover:bg-teal-50"
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Conteúdo Principal do Quadro Kanban */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden p-4 sm:p-6 bg-slate-50">
        {isLoading ? (
          <LoadingState message="Carregando quadro de oportunidades..." className="h-full" />
        ) : loadError ? (
          <ErrorState
            title="Não foi possível carregar o pipeline"
            message="Os leads não puderam ser lidos do servidor. Verifique sua conexão e tente novamente."
            onRetry={() => fetchClients(true)}
            isRetrying={isRefreshing}
            className="h-full"
          />
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-4 min-w-max h-full pb-2">
              {PIPELINE_STAGES.map((stage) => (
                <KanbanColumn
                  key={stage}
                  stage={stage}
                  clients={columnsData[stage]}
                  onCardClick={handleCardClick}
                />
              ))}
            </div>
          </DragDropContext>
        )}
      </div>

      {/* Modais */}
      <ClientModal
        isOpen={isClientModalOpen}
        onClose={() => {
          setIsClientModalOpen(false);
          setClientToEdit(null);
        }}
        onSuccess={() => {
          fetchClients();
        }}
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
        onEdit={handleEditClient}
        onDelete={handleDeleteClient}
        onUpdated={() => {
          fetchClients();
        }}
        users={users}
      />
    </div>
  );
};
