import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { apiFetch, errorMessage } from '../../services/api';
import { OperationalStage, OperationalTask } from '../../types/operational';
import { User } from '../../types';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { OperationalColumn } from './OperationalColumn';
import { OperationalTaskModal } from './OperationalTaskModal';
import { Button, IconButton } from '../ui/Button';
import { Plus, Settings, Search, Users, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { LoadingState, ErrorState, EmptyState } from '../ui/States';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { controlClassSm } from '../ui/Field';

export default function OperationalPipelinePage() {
  const queryClient = useQueryClient();
  const { has } = useAuth();
  const isAdmin = has('screen.configuracoes');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 400);
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<OperationalTask | null>(null);

  // 1. Fetch active stages
  const {
    data: stagesData,
    isLoading: isLoadingStages,
    error: stagesError,
  } = useQuery({
    queryKey: ['operational-stages'],
    queryFn: () => apiFetch<OperationalStage[]>('/api/operational-stages'),
  });

  const activeStages = useMemo(() => {
    return (stagesData || []).filter((s) => s.active).sort((a, b) => a.position - b.position);
  }, [stagesData]);

  // 2. Fetch tasks (we fetch all and filter in memory for smooth DnD, or use API filters if preferred.
  // Here we'll use API parameters for the query to match the kanban pattern.)
  const {
    data: tasksData,
    isLoading: isLoadingTasks,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: ['operational-tasks', { search: debouncedSearch, ownerId: ownerFilter, priority: priorityFilter }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (ownerFilter !== 'all') params.append('ownerId', ownerFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);
      
      return apiFetch<OperationalTask[]>(`/api/operational-tasks?${params.toString()}`);
    },
  });

  // 3. Fetch users for filters and modal
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<{ data: User[] }>('/api/users'),
  });
  const users = usersData?.data || [];

  // Group tasks by stage
  const tasksByStage = useMemo(() => {
    const tasks = tasksData || [];
    const grouped: Record<string, OperationalTask[]> = {};
    
    activeStages.forEach((stage) => {
      grouped[stage.id] = [];
    });

    tasks.forEach((task) => {
      if (grouped[task.stageId]) {
        grouped[task.stageId].push(task);
      }
    });

    return grouped;
  }, [tasksData, activeStages]);

  const clearFilters = () => {
    setSearchTerm('');
    setOwnerFilter('all');
    setPriorityFilter('all');
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    // Snapshot for rollback
    const previousTasks = queryClient.getQueryData<OperationalTask[]>([
      'operational-tasks',
      { search: debouncedSearch, ownerId: ownerFilter, priority: priorityFilter },
    ]);

    // Optimistic Update
    if (previousTasks) {
      const updatedTasks = previousTasks.map((t) => {
        if (t.id === draggableId) {
          return { ...t, stageId: destination.droppableId };
        }
        return t;
      });
      queryClient.setQueryData(
        ['operational-tasks', { search: debouncedSearch, ownerId: ownerFilter, priority: priorityFilter }],
        updatedTasks
      );
    }

    try {
      await apiFetch(`/api/operational-tasks/${draggableId}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ stageId: destination.droppableId }),
      });
      // Invalidate to get fresh counts and data
      queryClient.invalidateQueries({ queryKey: ['operational-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['operational-stages'] });
    } catch (err: any) {
      // Rollback
      if (previousTasks) {
        queryClient.setQueryData(
          ['operational-tasks', { search: debouncedSearch, ownerId: ownerFilter, priority: priorityFilter }],
          previousTasks
        );
      }
      toast.error(errorMessage(err, 'Erro ao mover a demanda.'));
    }
  };

  const handleOpenModal = (task?: OperationalTask) => {
    setTaskToEdit(task || null);
    setIsModalOpen(true);
  };

  if (isLoadingStages) return <LoadingState message="Carregando etapas..." />;
  if (stagesError) return <ErrorState title="Erro ao carregar etapas do pipeline." message="Tente novamente mais tarde." onRetry={() => window.location.reload()} />;

  if (activeStages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <EmptyState
          icon={<Settings className="w-12 h-12 text-slate-300" />}
          title="Nenhuma etapa configurada"
          message="O pipeline operacional ainda não possui etapas ativas. Para começar a usar, cadastre as etapas nas configurações."
          action={
            isAdmin ? (
              <Link to="/configuracoes">
                <Button>Configurar Etapas</Button>
              </Link>
            ) : undefined
          }
        />
      </div>
    );
  }

  const totalTasks = tasksData?.length || 0;

  return (
    <div className="flex-1 min-h-[32rem] flex flex-col overflow-hidden bg-white rounded-xl border border-slate-200 shadow-xs">
      {/* Barra Superior do Quadro */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shrink-0 rounded-t-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Settings className="w-5 h-5 text-teal-600" aria-hidden="true" />
              <h1 className="text-xl font-bold text-navy-900 leading-tight">
                Pipeline Operacional
              </h1>
              <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full border border-slate-200 tabular-nums">
                {totalTasks} {totalTasks === 1 ? 'demanda' : 'demandas'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Arraste os cards entre as etapas para atualizar o fluxo de trabalho.
            </p>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <IconButton
              label="Atualizar quadro"
              onClick={() => refetchTasks()}
              disabled={isLoadingTasks}
              className="border border-slate-200"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoadingTasks ? 'animate-spin text-teal-600' : ''}`}
                aria-hidden="true"
              />
            </IconButton>

            <Button
              size="sm"
              onClick={() => handleOpenModal()}
              icon={<Plus className="w-4 h-4" aria-hidden="true" />}
            >
              Nova demanda
            </Button>
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="mt-3.5 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          {/* Busca Textual */}
          <div className="relative flex-1 min-w-[15rem] max-w-md">
            <label htmlFor="kanban-search" className="sr-only">
              Buscar demandas
            </label>
            <Search
              className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="kanban-search"
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por cliente, título..."
              className={controlClassSm + ' pl-9'}
            />
          </div>

          {/* Dropdowns de Filtro */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Filtro por Responsável */}
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
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por Prioridade */}
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

            {/* Limpar filtros se algum estiver ativo */}
            {(searchTerm || ownerFilter !== 'all' || priorityFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-teal-700 hover:text-teal-800 hover:bg-teal-50"
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Quadro (Área de Arrastar) */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden bg-slate-50/50 custom-scrollbar relative">
        <div className="inline-flex items-start h-full px-2 py-4 gap-2 lg:px-4 shrink-0 relative">
          <DragDropContext onDragEnd={handleDragEnd}>
            {activeStages.map((stage) => (
              <OperationalColumn
                key={stage.id}
                stage={stage}
                tasks={tasksByStage[stage.id] || []}
                onTaskClick={(task) => handleOpenModal(task)}
              />
            ))}
          </DragDropContext>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <OperationalTaskModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setTaskToEdit(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['operational-tasks'] });
            queryClient.invalidateQueries({ queryKey: ['operational-stages'] });
          }}
          taskToEdit={taskToEdit}
          users={users}
          stages={activeStages}
        />
      )}
    </div>
  );
}