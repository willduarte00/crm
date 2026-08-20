import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import {
  Client,
  PipelineStage,
  LeadSource,
  PaginatedClientsResponse,
} from '../../types/client';
import { User } from '../../types';
import { apiFetch, AppApiError } from '../../services/api';
import { KanbanColumn } from './KanbanColumn';
import { ClientModal } from '../Clients/ClientModal';
import { ClientDetailsModal } from '../Clients/ClientDetailsModal';
import {
  Search,
  Plus,
  RefreshCw,
  Loader2,
  Users,
  Kanban as KanbanIcon,
} from 'lucide-react';
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
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filtros
  const [search, setSearch] = useState('');
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

      const params = new URLSearchParams({
        page: '1',
        limit: '1000', // Teto amplo para carregar todo o pipeline
      });

      if (search.trim()) params.append('search', search.trim());
      if (ownerFilter !== 'all') params.append('ownerId', ownerFilter);
      if (sourceFilter !== 'all') params.append('leadSource', sourceFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);

      const res = await apiFetch<PaginatedClientsResponse>(`/api/clients?${params.toString()}`);
      setClients(res.data || []);
    } catch (err) {
      toast.error('Erro ao carregar leads do pipeline');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [search, ownerFilter, sourceFilter, priorityFilter]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchClients();
    }, 200);
    return () => clearTimeout(timer);
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
    if (!confirm(`Deseja realmente excluir o lead "${client.name}"?`)) return;

    try {
      await apiFetch(`/api/clients/${client.id}`, { method: 'DELETE' });
      toast.success('Lead excluído com sucesso!');
      setIsDetailsModalOpen(false);
      fetchClients();
    } catch {
      toast.error('Erro ao excluir lead');
    }
  };

  const activeUsers = users.filter((u) => u.active);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-50">
      {/* Barra Superior do Quadro */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <KanbanIcon className="w-5 h-5 text-teal-600" />
              <h1 className="text-xl font-bold text-navy-900 leading-tight">
                Pipeline de Vendas
              </h1>
              <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                {totalLeads} {totalLeads === 1 ? 'oportunidade' : 'oportunidades'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Gerencie oportunidades e leads nas 6 etapas do funil comercial com arrastar e soltar.
            </p>
          </div>

          {/* Ação Novo Lead e Atualizar */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => fetchClients(true)}
              disabled={isRefreshing || isLoading}
              title="Atualizar quadro"
              className="p-2 text-slate-500 hover:text-navy-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-teal-600' : ''}`} />
            </button>

            <button
              onClick={() => {
                setClientToEdit(null);
                setIsClientModalOpen(true);
              }}
              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Lead</span>
            </button>
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="mt-3.5 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          {/* Busca Textual */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, razão social, documento ou anotação..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-navy-900"
            />
          </div>

          {/* Dropdowns de Filtro */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Filtro por Responsável (RF-06a, RF-06c) */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <select
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
              <span className="text-slate-500 font-medium">Prioridade:</span>
              <select
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
              <span className="text-slate-500 font-medium">Origem:</span>
              <select
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
              <button
                onClick={() => {
                  setSearch('');
                  setOwnerFilter('all');
                  setSourceFilter('all');
                  setPriorityFilter('all');
                }}
                className="text-xs text-teal-700 hover:text-teal-800 font-medium px-2 py-1 hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Conteúdo Principal do Quadro Kanban */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            <p className="text-sm font-medium">Carregando quadro de oportunidades...</p>
          </div>
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
