import React, { useState, useEffect } from 'react';
import { User, GroupDetail } from '../../types';
import { apiFetch, errorMessage } from '../../services/api';
import { UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, controlClass } from '../ui/Field';
import { FormAlert } from '../ui/States';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userToEdit: User | null;
  currentUser: User | null;
}

const MIN_PASSWORD_LENGTH = 12;

export const UserModal: React.FC<UserModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  userToEdit,
  currentUser,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [active, setActive] = useState(true);
  const [availableGroups, setAvailableGroups] = useState<GroupDetail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!userToEdit;
  const isSelf = currentUser?.id === userToEdit?.id;
  const formId = 'user-form';

  useEffect(() => {
    if (userToEdit) {
      setName(userToEdit.name);
      setEmail(userToEdit.email);
      setGroupIds(userToEdit.groups?.map((g) => g.id) || []);
      setActive(userToEdit.active);
      setPassword('');
    } else {
      setName('');
      setEmail('');
      setGroupIds([]);
      setActive(true);
      setPassword('');
    }
    setError(null);
  }, [userToEdit, isOpen]);

  useEffect(() => {
    if (isOpen && availableGroups.length === 0) {
      apiFetch<GroupDetail[]>('/api/groups').then(setAvailableGroups).catch(() => {});
    }
  }, [isOpen, availableGroups.length]);

  const adminGroup = availableGroups.find((g) => g.isSystem);
  const currentUserIsAdmin = !!adminGroup && !!currentUser?.groups.some((g) => g.id === adminGroup.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);

    if (!isEditing && password.length < MIN_PASSWORD_LENGTH) {
      setError(`A senha inicial precisa ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres com letras e números.`);
      return;
    }

    if (isEditing && password && password.length < MIN_PASSWORD_LENGTH) {
      setError(`A nova senha precisa ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres com letras e números.`);
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing) {
        const payload: Record<string, unknown> = { name, email, active };

        if (!isSelf) payload.groupIds = groupIds;
        if (password) payload.password = password;

        await apiFetch(`/api/users/${userToEdit.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });

        toast.success('Usuário atualizado.');
      } else {
        await apiFetch('/api/users', {
          method: 'POST',
          body: JSON.stringify({ name, email, groupIds, password }),
        });

        toast.success('Usuário criado.');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível salvar o usuário.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar usuário' : 'Novo usuário'}
      description={
        isEditing
          ? 'Atualize os dados, os grupos de acesso ou o status da conta.'
          : 'Defina os dados de acesso e a senha inicial.'
      }
      icon={<UserCheck className="w-5 h-5" aria-hidden="true" />}
      size="sm"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} isLoading={isSubmitting}>
            {isEditing ? 'Salvar alterações' : 'Criar usuário'}
          </Button>
        </div>
      }
    >
      {error && <FormAlert>{error}</FormAlert>}

      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome completo" required>
          {(props) => (
            <input
              {...props}
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: João da Silva"
              className={controlClass}
            />
          )}
        </Field>

        <Field label="E-mail corporativo" required>
          {(props) => (
            <input
              {...props}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="joao@agencia.com"
              className={controlClass}
            />
          )}
        </Field>

        <fieldset className="space-y-2">
          <legend className="block text-xs font-semibold text-slate-700 mb-1.5">
            Grupos de acesso
          </legend>
          <div className="space-y-2">
            {availableGroups.map((group) => {
              const disableAdminGroup = group.isSystem && !currentUserIsAdmin;
              return (
                <label
                  key={group.id}
                  className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer"
                  title={disableAdminGroup ? 'Somente administradores' : undefined}
                >
                  <input
                    type="checkbox"
                    checked={groupIds.includes(group.id)}
                    disabled={isSelf || disableAdminGroup}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setGroupIds([...groupIds, group.id]);
                      } else {
                        setGroupIds(groupIds.filter((id) => id !== group.id));
                      }
                    }}
                    className="mt-0.5 text-teal-600 focus:ring-teal-600 rounded"
                  />
                  <span>{group.name}</span>
                </label>
              );
            })}
            {availableGroups.length === 0 && (
              <p className="text-sm text-slate-500 italic">Carregando grupos...</p>
            )}
          </div>
          {isSelf && (
            <p className="text-xs text-slate-500 mt-1">
              Você não pode alterar os seus próprios grupos.
            </p>
          )}
        </fieldset>

        {isEditing && (
          <fieldset>
            <legend className="block text-xs font-semibold text-slate-700 mb-1.5">
              Status da conta
            </legend>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="user-status"
                  checked={active}
                  onChange={() => setActive(true)}
                  className="text-teal-600 focus:ring-teal-600"
                />
                <span>Ativo</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="user-status"
                  checked={!active}
                  onChange={() => setActive(false)}
                  className="text-teal-600 focus:ring-teal-600"
                />
                <span>Inativo</span>
              </label>
            </div>
            {!active && (
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-2">
                Ao salvar como inativo, todas as sessões abertas deste usuário são
                encerradas imediatamente.
              </p>
            )}
          </fieldset>
        )}

        <Field
          label={isEditing ? 'Redefinir senha' : 'Senha inicial'}
          required={!isEditing}
          hint={
            isEditing
              ? 'Deixe em branco para manter a senha atual.'
              : 'O usuário será obrigado a trocar esta senha no primeiro acesso.'
          }
        >
          {(props) => (
            <input
              {...props}
              type="password"
              autoComplete="new-password"
              minLength={password ? MIN_PASSWORD_LENGTH : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                isEditing ? 'Manter a senha atual' : `Mínimo ${MIN_PASSWORD_LENGTH} caracteres com letras e números`
              }
              className={controlClass}
            />
          )}
        </Field>
      </form>
    </Modal>
  );
};
