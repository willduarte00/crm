import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, errorMessage } from '../../services/api';
import { GroupDetail } from '../../types';
import { PermissionCatalog } from '../../types/permission';
import { LoadingState, EmptyState, ErrorState } from '../ui/States';
import { Button, IconButton } from '../ui/Button';
import { controlClassSm } from '../ui/Field';
import { useAuth } from '../../context/AuthContext';
import { Shield, Plus, Edit2, Trash2, Search } from 'lucide-react';
import { GroupModal } from './GroupModal';
import { useConfirm } from '../ui/ConfirmDialog';
import { toast } from 'sonner';

export const GroupsPage: React.FC = () => {
  const { has } = useAuth();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [groupToEdit, setGroupToEdit] = useState<GroupDetail | null>(null);

  const {
    data: groups,
    isLoading: isLoadingGroups,
    isError: isErrorGroups,
  } = useQuery<GroupDetail[]>({
    queryKey: ['groups'],
    queryFn: () => apiFetch('/api/groups'),
  });

  const {
    data: catalog,
    isLoading: isLoadingCatalog,
    isError: isErrorCatalog,
  } = useQuery<PermissionCatalog>({
    queryKey: ['permissions'],
    queryFn: () => apiFetch('/api/permissions'),
  });

  const isLoading = isLoadingGroups || isLoadingCatalog;
  const isError = isErrorGroups || isErrorCatalog;

  const handleDelete = async (group: GroupDetail) => {
    const confirmed = await confirm({
      title: 'Excluir grupo',
      message: `Tem certeza que deseja excluir o grupo "${group.name}"? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) return;

    try {
      await apiFetch(`/api/groups/${group.id}`, { method: 'DELETE' });
      toast.success('Grupo excluído com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    } catch (err: any) {
      toast.error(errorMessage(err, 'Ocorreu um erro ao excluir o grupo.'));
    }
  };

  const handleEdit = (group: GroupDetail) => {
    setGroupToEdit(group);
    setIsModalOpen(true);
  };

  const handleNew = () => {
    setGroupToEdit(null);
    setIsModalOpen(true);
  };

  const handleRetry = () => {
    queryClient.invalidateQueries({ queryKey: ['groups'] });
    queryClient.invalidateQueries({ queryKey: ['permissions'] });
  };

  const filteredGroups = (groups || []).filter(
    (g) =>
      g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (g.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 tracking-tight">
            Grupos e permissões
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Gerencie os grupos de acesso e defina as telas e ações permitidas para cada um.
          </p>
        </div>

        {has('groups.manage') && (
          <Button
            onClick={handleNew}
            icon={<Plus className="w-4 h-4" aria-hidden="true" />}
            className="flex-shrink-0"
          >
            Novo grupo
          </Button>
        )}
      </div>

      {/* Toolbar / Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 sm:max-w-md">
          <label htmlFor="groups-search" className="sr-only">
            Buscar grupos por nome ou descrição
          </label>
          <Search
            className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="groups-search"
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome ou descrição..."
            className={controlClassSm + ' pl-9'}
          />
        </div>
        <p className="text-xs text-slate-600 font-medium" aria-live="polite">
          Total:{' '}
          <span className="text-navy-900 font-bold tabular-nums">
            {filteredGroups.length}
          </span>{' '}
          {filteredGroups.length === 1 ? 'grupo' : 'grupos'}
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <LoadingState message="Carregando grupos e permissões…" />
        ) : isError ? (
          <ErrorState
            title="Não foi possível carregar os grupos"
            message="A lista não pôde ser lida do servidor. Verifique sua conexão e tente novamente."
            onRetry={handleRetry}
          />
        ) : filteredGroups.length === 0 ? (
          <EmptyState
            icon={<Shield className="w-6 h-6" />}
            title={
              searchTerm
                ? 'Nenhum grupo corresponde à busca'
                : 'Nenhum grupo cadastrado ainda'
            }
            message={
              searchTerm
                ? 'Tente outro nome ou descrição.'
                : 'Crie grupos para atribuir permissões aos usuários do sistema.'
            }
            action={
              searchTerm ? (
                <Button variant="secondary" size="sm" onClick={() => setSearchTerm('')}>
                  Limpar busca
                </Button>
              ) : has('groups.manage') ? (
                <Button onClick={handleNew}>Novo grupo</Button>
              ) : undefined
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="w-full min-w-[44rem] text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th scope="col" className="py-3 px-4">Grupo</th>
                  <th scope="col" className="py-3 px-4">Descrição</th>
                  <th scope="col" className="py-3 px-4">Permissões</th>
                  <th scope="col" className="py-3 px-4">Usuários</th>
                  {has('groups.manage') && (
                    <th scope="col" className="py-3 px-4 text-right">Ações</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredGroups.map((group) => (
                  <tr
                    key={group.id}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-medium text-navy-900">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs uppercase border border-slate-200 flex-shrink-0"
                          aria-hidden="true"
                        >
                          {group.name.substring(0, 2)}
                        </div>
                        <div>
                          <div className="whitespace-nowrap">{group.name}</div>
                          {group.isSystem && (
                            <span className="text-[10px] text-teal-700 bg-teal-50 border border-teal-200/60 px-1.5 py-0.5 rounded font-medium">
                              Sistema
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {group.description || (
                        <span className="text-xs text-slate-400 italic">Sem descrição</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {group.permissions.length}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {group.userCount}
                      </span>
                    </td>
                    {has('groups.manage') && (
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-0.5">
                          <IconButton
                            label={group.isSystem ? 'O grupo Admin não pode ser alterado.' : 'Editar ' + group.name}
                            onClick={() => handleEdit(group)}
                            disabled={group.isSystem}
                          >
                            <Edit2 className="w-4 h-4" aria-hidden="true" />
                          </IconButton>
                          <IconButton
                            label={group.isSystem ? 'O grupo Admin não pode ser excluído.' : 'Excluir ' + group.name}
                            onClick={() => handleDelete(group)}
                            disabled={group.isSystem}
                            tone="danger"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </IconButton>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Criação / Edição */}
      {isModalOpen && catalog && (
        <GroupModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          group={groupToEdit}
          catalog={catalog}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['groups'] })}
        />
      )}
    </div>
  );
};
