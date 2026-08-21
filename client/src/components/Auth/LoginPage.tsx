import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../services/api';
import { Lock, Mail, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '../ui/Button';
import { Field, controlClass } from '../ui/Field';
import { FormAlert } from '../ui/States';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(
        errorMessage(err, 'E-mail ou senha incorretos. Verifique os dados e tente novamente.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-slate-50 flex items-center justify-center p-4">
      <main className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-navy-900 text-teal-300 font-bold text-xl mb-4"
            aria-hidden="true"
          >
            CRM
          </div>
          <h1 className="text-2xl font-bold text-navy-900 tracking-tight">
            Entrar no CRM
          </h1>
          <p className="text-sm text-slate-500 mt-1.5">
            Use o e-mail e a senha da sua conta da agência.
          </p>
        </div>

        {error && <FormAlert>{error}</FormAlert>}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Field label="E-mail" required>
            {(props) => (
              <div className="relative">
                <Mail
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  {...props}
                  type="email"
                  autoComplete="username"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@agencia.com"
                  className={`${controlClass} pl-9`}
                />
              </div>
            )}
          </Field>

          <Field label="Senha" required>
            {(props) => (
              <div className="relative">
                <Lock
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  {...props}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`${controlClass} pl-9 pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-navy-900 hover:bg-slate-100 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            )}
          </Field>

          <Button
            type="submit"
            fullWidth
            isLoading={isSubmitting}
            className="mt-2"
          >
            <span>Entrar</span>
            {!isSubmitting && <ArrowRight className="w-4 h-4" aria-hidden="true" />}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500">
            Sem acesso?{' '}
            <span className="font-medium text-slate-700">
              Peça a um administrador para criar sua conta.
            </span>
          </p>
        </div>
      </main>
    </div>
  );
};
