import React, { useState } from 'react';
import { apiFetch, errorMessage } from '../../services/api';
import { Lock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, controlClass } from '../ui/Field';
import { FormAlert } from '../ui/States';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MIN_PASSWORD_LENGTH = 8;

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formId = 'change-password-form';

  const resetAndClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('A confirmação não corresponde à nova senha.');
      return;
    }

    setIsSubmitting(true);

    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      toast.success('Senha alterada.');
      resetAndClose();
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível alterar a senha.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title="Alterar senha"
      description="Atualize a senha de acesso da sua conta."
      icon={<Lock className="w-5 h-5" aria-hidden="true" />}
      size="sm"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="secondary" onClick={resetAndClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            isLoading={isSubmitting}
            icon={<CheckCircle2 className="w-4 h-4" aria-hidden="true" />}
          >
            Salvar senha
          </Button>
        </div>
      }
    >
      {error && <FormAlert>{error}</FormAlert>}

      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <Field label="Senha atual" required>
          {(props) => (
            <input
              {...props}
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className={controlClass}
            />
          )}
        </Field>

        <Field
          label="Nova senha"
          required
          hint={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres.`}
        >
          {(props) => (
            <input
              {...props}
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className={controlClass}
            />
          )}
        </Field>

        <Field label="Confirmar nova senha" required>
          {(props) => (
            <input
              {...props}
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className={controlClass}
            />
          )}
        </Field>
      </form>
    </Modal>
  );
};
