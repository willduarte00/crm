import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { apiFetch, errorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../ui/ConfirmDialog';
import { Button, IconButton } from '../ui/Button';
import { LoadingState, EmptyState, ErrorState } from '../ui/States';
import { controlClassSm } from '../ui/Field';
import { UserModal } from './UserModal';
import { Users, UserPlus, Search, Edit2, UserX, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

export const UsersPage: React.FC = () => {
  const confirm = useConfirm();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  // Impede que um duplo clique dispare dois PATCH para o mesmo usuário.
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const { user: currentUser } = useAuth();

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setLoadError(false);
      const data = await apiFetch<User[]>('/api/users');
      setUsers(data);
    } catch {
      setUsers([]);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleActive = async (user: User) => {
    if (togglingId) return;

    const willDeactivate = user.active;
    const confirmed = await confirm({
      title: willDeactivate ? 'Desativar usuário' : 'Reativar usuário',
      tone: willDeactivate ? 'danger' : 'default',
      confirmLabel: willDeactivate ? 'Desativar acesso' : 'Reativar acesso',
      message: willDeactivate ? (
        <>
          <strong className="text-navy-900">{user.name}</strong> perderá o acesso
          imediatamente e todas as sessões abertas serão encerradas. Os leads sob
          responsabilidade dele continuam no sistema e podem ser reatribuídos.
        </>
      ) : (
        <>
          <strong className="text-navy-900">{user.name}</strong> voltará a acessar o
          sistema com o papel atual.
        </>
      ),
    });
    if (!confirmed) return;

    try {
      setTogglingId(user.id);
      await apiFetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !user.active }),
      });
      toast.success(
        willDeactivate
          ? `Acesso de ${user.name} desativado.`
          : `Acesso de ${user.name} reativado.`
      );
      fetchUsers();
    } catch (err) {
      toast.error(
        errorMessage(err, 'Não foi possível alterar o status deste usuário.')
      );
    } finally {
      setTogglingId(null);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 tracking-tight">
            Gestão de usuários
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Gerencie as contas de acesso, papéis e permissões da agência.
          </p>
        </div>

        <Button
          onClick={() => {
            setUserToEdit(null);
            setIsModalOpen(true);
          }}
          icon={<UserPlus className="w-4 h-4" aria-hidden="true" />}
          className="flex-shrink-0"
        >
          Novo usuário
        </Button>
      </div>

      {/* Toolbar / Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 sm:max-w-md">
          <label htmlFor="users-search" className="sr-only">
            Buscar usuários por nome ou e-mail
          </label>
          <Search
            className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="users-search"
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className={controlClassSm + ' pl-9'}
          />
        </div>
        <p className="text-xs text-slate-600 font-medium" aria-live="polite">
          Total:{' '}
          <span className="text-navy-900 font-bold tabular-nums">
            {filteredUsers.length}
          </span>{' '}
          {filteredUsers.length === 1 ? 'usuário' : 'usuários'}
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <LoadingState message="Carregando usuários…" />
        ) : loadError ? (
          <ErrorState
            title="Não foi possível carregar os usuários"
            message="A lista não pôde ser lida do servidor. Verifique sua conexão e tente novamente."
            onRetry={fetchUsers}
          />
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            icon={<Users className="w-6 h-6" />}
            title={
              searchTerm
                ? 'Nenhum usuário corresponde à busca'
                : 'Nenhum usuário cadastrado ainda'
            }
            message={
              searchTerm
                ? 'Tente outro nome ou endereço de e-mail.'
                : 'Crie a primeira conta de acesso da agência.'
            }
            action={
              searchTerm ? (
                <Button variant="secondary" size="sm" onClick={() => setSearchTerm('')}>
                  Limpar busca
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="w-full min-w-[44rem] text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th scope="col" className="py-3 px-4">Nome</th>
                  <th scope="col" className="py-3 px-4">E-mail</th>
                  <th scope="col" className="py-3 px-4">Papel</th>
                  <th scope="col" className="py-3 px-4">Status</th>
                  <th scope="col" className="py-3 px-4">Criado em</th>
                  <th scope="col" className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => {
                  const isSelf = currentUser?.id === u.id;
                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-medium text-navy-900">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs uppercase border border-slate-200 flex-shrink-0"
                            aria-hidden="true"
                          >
                            {u.name.substring(0, 2)}
                          </div>
                          <div>
                            <div className="whitespace-nowrap">{u.name}</div>
                            {isSelf && (
                              <span className="text-[10px] text-teal-700 bg-teal-50 border border-teal-200/60 px-1.5 py-0.5 rounded font-medium">
                                Você
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{u.email}</td>
                      <td className="py-3.5 px-4">
                        {u.role === 'admin' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-navy-100 text-navy-800 border border-navy-200">
                            Administrador
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            Membro
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {u.active ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Inativo
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 tabular-nums text-slate-500 text-xs">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-0.5">
                          <IconButton
                            label={'Editar ' + u.name}
                            onClick={() => {
                              setUserToEdit(u);
                              setIsModalOpen(true);
                            }}
                          >
                            <Edit2 className="w-4 h-4" aria-hidden="true" />
                          </IconButton>

                          <IconButton
                            label={
                              isSelf
                                ? 'Você não pode desativar seu próprio acesso'
                                : u.active
                                ? 'Desativar acesso de ' + u.name
                                : 'Reativar acesso de ' + u.name
                            }
                            tone={u.active ? 'danger' : 'success'}
                            onClick={() => handleToggleActive(u)}
                            disabled={isSelf || togglingId !== null}
                            isLoading={togglingId === u.id}
                          >
                            {u.active ? (
                              <UserX className="w-4 h-4" aria-hidden="true" />
                            ) : (
                              <UserCheck className="w-4 h-4" aria-hidden="true" />
                            )}
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

      {/* Modal de Criação / Edição */}
      <UserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchUsers}
        userToEdit={userToEdit}
        currentUser={currentUser}
      />
    </div>
  );
};
