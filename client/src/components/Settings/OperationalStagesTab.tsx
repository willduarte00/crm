import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { OperationalStage, STAGE_COLORS } from '../../types/operational';
import { apiFetch, errorMessage } from '../../services/api';
import { Button, IconButton } from '../ui/Button';
import { Plus, Edit2, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { LoadingState, ErrorState, EmptyState } from '../ui/States';
import { OperationalStageModal } from './OperationalStageModal';
import { useConfirm } from '../ui/ConfirmDialog';
import { toast } from 'sonner';

export const OperationalStagesTab: React.FC = () => {
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stageToEdit, setStageToEdit] = useState<OperationalStage | null>(null);

  const { data: stages, isLoading, error } = useQuery({
    queryKey: ['operational-stages'],
    queryFn: () => apiFetch<OperationalStage[]>('/api/operational-stages'),
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch('/api/operational-stages/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational-stages'] });
    },
    onError: (err: any) => {
      toast.error(errorMessage(err, 'Erro ao reordenar etapas.'));
    },
  });

  const handleReorder = (index: number, direction: 'up' | 'down') => {
    if (!stages) return;
    const newStages = [...stages];
    if (direction === 'up' && index > 0) {
      const temp = newStages[index];
      newStages[index] = newStages[index - 1];
      newStages[index - 1] = temp;
    } else if (direction === 'down' && index < newStages.length - 1) {
      const temp = newStages[index];
      newStages[index] = newStages[index + 1];
      newStages[index + 1] = temp;
    } else {
      return;
    }
    reorderMutation.mutate(newStages.map((s) => s.id));
  };

  const handleDelete = async (stage: OperationalStage) => {
    const isConfirmed = await confirm({
      title: 'Excluir Etapa',
      message: `Tem certeza que deseja excluir a etapa "${stage.name}"? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      tone: 'danger',
    });

    if (isConfirmed) {
      try {
        await apiFetch(`/api/operational-stages/${stage.id}`, { method: 'DELETE' });
        toast.success('Etapa excluída com sucesso.');
        queryClient.invalidateQueries({ queryKey: ['operational-stages'] });
      } catch (err: any) {
        toast.error(errorMessage(err, 'Erro ao excluir etapa.'));
      }
    }
  };

  if (isLoading) return <LoadingState message="Carregando etapas..." />;
  if (error) return <ErrorState title="Erro" message="Erro ao carregar as etapas." />;

  const stageList = stages || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Pipeline Operacional</h2>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie as etapas do fluxo de trabalho operacional. A ordem definida aqui reflete no quadro Kanban.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => {
            setStageToEdit(null);
            setIsModalOpen(true);
          }}
        >
          Nova Etapa
        </Button>
      </div>

      {stageList.length === 0 ? (
        <EmptyState
          icon={<Edit2 className="w-12 h-12 text-slate-300" />}
          title="Nenhuma etapa cadastrada"
          message="Você ainda não possui etapas no pipeline operacional."
          action={
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setStageToEdit(null);
                setIsModalOpen(true);
              }}
            >
              Criar Primeira Etapa
            </Button>
          }
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="table-scroll">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="px-6 py-3 font-medium w-24 text-center">Ordem</th>
                  <th className="px-6 py-3 font-medium">Etapa</th>
                  <th className="px-6 py-3 font-medium">Cor</th>
                  <th className="px-6 py-3 font-medium text-center">Demandas</th>
                  <th className="px-6 py-3 font-medium text-center">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stageList.map((stage, index) => {
                  const config = STAGE_COLORS[stage.color] || STAGE_COLORS.slate;
                  const taskCount = stage._count?.tasks || 0;

                  return (
                    <tr key={stage.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <IconButton
                            label="Mover para cima"
                            onClick={() => handleReorder(index, 'up')}
                            disabled={index === 0 || reorderMutation.isPending}
                            className="w-6 h-6 p-0 text-slate-400 hover:text-slate-700"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </IconButton>
                          <span className="w-4 text-center font-medium text-slate-600">
                            {index + 1}
                          </span>
                          <IconButton
                            label="Mover para baixo"
                            onClick={() => handleReorder(index, 'down')}
                            disabled={index === stageList.length - 1 || reorderMutation.isPending}
                            className="w-6 h-6 p-0 text-slate-400 hover:text-slate-700"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </IconButton>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-slate-800">{stage.name}</div>
                          {stage.description && (
                            <div className="text-xs text-slate-500 truncate max-w-xs mt-0.5">
                              {stage.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${config.dot}`} />
                          <span className="text-slate-600">{config.label}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                          {taskCount}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            stage.active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {stage.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1">
                          <IconButton
                            label="Editar etapa"
                            onClick={() => {
                              setStageToEdit(stage);
                              setIsModalOpen(true);
                            }}
                          >
                            <Edit2 className="w-4 h-4" />
                          </IconButton>
                          <IconButton
                            label="Excluir etapa"
                            tone="danger"
                            onClick={() => handleDelete(stage)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <OperationalStageModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setStageToEdit(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['operational-stages'] });
          }}
          stageToEdit={stageToEdit}
        />
      )}
    </div>
  );
};