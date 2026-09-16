import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch, errorMessage } from '../../services/api';
import { Lock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/Button';
import { Field, controlClass } from '../ui/Field';
import { FormAlert } from '../ui/States';

const MIN_PASSWORD_LENGTH = 12;

/**
 * Bloqueia o acesso até a troca da senha temporária. Diferente dos demais
 * diálogos, não é dispensável: só sai daqui trocando a senha ou saindo da conta.
 */
export const ForceChangePasswordModal: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { refreshUser, logout } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`A nova senha precisa ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres com letras e números.`);
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

      toast.success('Senha atualizada.');
      await refreshUser();
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível atualizar a senha.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-navy-950/70 backdrop-blur-sm flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="force-password-title"
        aria-describedby="force-password-description"
        className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-xl p-6 sm:p-8 my-4 sm:my-8 animate-panel-in"
      >
        <div className="text-center mb-6">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-teal-50 text-teal-700 mb-3"
            aria-hidden="true"
          >
            <Lock className="w-6 h-6" />
          </div>
          <h1 id="force-password-title" className="text-xl font-bold text-navy-900">
            Defina uma nova senha
          </h1>
          <p id="force-password-description" className="text-sm text-slate-500 mt-1.5">
            Sua senha atual é temporária. Escolha uma senha própria para continuar
            usando o sistema.
          </p>
        </div>

        {error && <FormAlert>{error}</FormAlert>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Senha temporária atual" required>
            {(props) => (
              <input
                {...props}
                type="password"
                autoComplete="current-password"
                autoFocus
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
            hint={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres com letras e números.`}
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

          <div className="pt-2 flex flex-col gap-2">
            <Button
              type="submit"
              fullWidth
              isLoading={isSubmitting}
              icon={<CheckCircle2 className="w-4 h-4" aria-hidden="true" />}
            >
              Salvar nova senha
            </Button>

            <Button variant="ghost" fullWidth onClick={logout} disabled={isSubmitting}>
              Sair da conta
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
