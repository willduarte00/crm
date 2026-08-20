import React, { useState, useEffect } from 'react';
import { User, Role } from '../../types';
import { apiFetch, AppApiError } from '../../services/api';
import { X, UserCheck, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userToEdit: User | null;
  currentUser: User | null;
}

export const UserModal: React.FC<UserModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  userToEdit,
  currentUser,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('membro');
  const [password, setPassword] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!userToEdit;
  const isSelf = currentUser?.id === userToEdit?.id;

  useEffect(() => {
    if (userToEdit) {
      setName(userToEdit.name);
      setEmail(userToEdit.email);
      setRole(userToEdit.role);
      setActive(userToEdit.active);
      setPassword('');
    } else {
      setName('');
      setEmail('');
      setRole('membro');
      setActive(true);
      setPassword('');
    }
    setError(null);
  }, [userToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isEditing && password.length < 8) {
      setError('A senha inicial deve ter no mínimo 8 caracteres.');
      return;
    }

    if (isEditing && password && password.length < 8) {
      setError('A nova senha deve ter no mínimo 8 caracteres.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing) {
        const payload: any = {
          name,
          email,
          active,
        };

        if (!isSelf) {
          payload.role = role;
        }

        if (password) {
          payload.password = password;
        }

        await apiFetch(`/api/users/${userToEdit.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });

        toast.success('Usuário atualizado com sucesso!');
      } else {
        await apiFetch('/api/users', {
          method: 'POST',
          body: JSON.stringify({
            name,
            email,
            role,
            password,
          }),
        });

        toast.success('Usuário criado com sucesso!');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      if (err instanceof AppApiError) {
        setError(err.data.error || 'Erro ao salvar usuário');
      } else {
        setError('Ocorreu um erro ao salvar.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg border border-slate-200 shadow-xl p-6 relative animate-in fade-in zoom-in duration-150">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 rounded p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-navy-900">
              {isEditing ? 'Editar Usuário' : 'Novo Usuário'}
            </h3>
            <p className="text-xs text-slate-500">
              {isEditing
                ? 'Atualize as permissões ou status'
                : 'Defina os dados e a senha inicial'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome Completo
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: João da Silva"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-navy-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              E-mail Corporativo
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="joao@agencia.com"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-navy-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Papel de Acesso
            </label>
            <select
              value={role}
              disabled={isSelf}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-navy-900 disabled:bg-slate-100 disabled:text-slate-500"
            >
              <option value="membro">Membro (Acesso padrão aos clientes e faturamento)</option>
              <option value="admin">Administrador (Gestão de usuários e agência)</option>
            </select>
            {isSelf && (
              <p className="text-[11px] text-slate-500 mt-1">
                Você não pode alterar seu próprio papel.
              </p>
            )}
          </div>

          {isEditing && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Status
              </label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    checked={active}
                    onChange={() => setActive(true)}
                    className="text-teal-600 focus:ring-teal-600"
                  />
                  <span>Ativo</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    checked={!active}
                    onChange={() => setActive(false)}
                    className="text-teal-600 focus:ring-teal-600"
                  />
                  <span>Inativo (Sessão revogada imediatamente)</span>
                </label>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isEditing ? 'Redefinir Senha (opcional)' : 'Senha Inicial'}
            </label>
            <input
              type="password"
              required={!isEditing}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isEditing ? 'Deixe em branco para manter a atual' : 'Mínimo 8 caracteres'}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-navy-900"
            />
            {!isEditing && (
              <p className="text-[11px] text-slate-500 mt-1">
                O usuário será obrigado a alterar esta senha no primeiro login.
              </p>
            )}
          </div>

          <div className="pt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded border border-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="inline-block animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4" />
              ) : (
                <span>{isEditing ? 'Salvar Alterações' : 'Criar Usuário'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
