import React from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface LoadingStateProps {
  /** Descreve o que está sendo carregado, não apenas "Carregando". */
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Carregando…',
  className = '',
}) => (
  <div
    role="status"
    aria-live="polite"
    className={`px-6 py-16 flex flex-col items-center justify-center gap-3 text-slate-500 ${className}`}
  >
    <Loader2 className="w-8 h-8 animate-spin text-teal-600" aria-hidden="true" />
    <p className="text-sm">{message}</p>
  </div>
);

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  /** Diz o que fazer em seguida — uma tela vazia é um convite à ação. */
  message?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  message,
  action,
  className = '',
}) => (
  <div className={`px-6 py-16 text-center ${className}`}>
    <div
      className="w-12 h-12 mx-auto rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mb-4"
      aria-hidden="true"
    >
      {icon}
    </div>
    <p className="text-base font-semibold text-navy-900">{title}</p>
    {message && (
      <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
        {message}
      </p>
    )}
    {action && <div className="mt-5 flex justify-center">{action}</div>}
  </div>
);

interface ErrorStateProps {
  title?: string;
  /** Diz o que falhou e como resolver, sem expor detalhes técnicos. */
  message?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Não foi possível carregar os dados',
  message = 'A conexão com o servidor falhou. Verifique sua internet e tente novamente.',
  onRetry,
  isRetrying = false,
  className = '',
}) => (
  <div role="alert" className={`px-6 py-16 text-center ${className}`}>
    <div
      className="w-12 h-12 mx-auto rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4"
      aria-hidden="true"
    >
      <AlertTriangle className="w-6 h-6" />
    </div>
    <p className="text-base font-semibold text-navy-900">{title}</p>
    <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
      {message}
    </p>
    {onRetry && (
      <div className="mt-5 flex justify-center">
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          isLoading={isRetrying}
          icon={<RefreshCw className="w-4 h-4" aria-hidden="true" />}
        >
          Tentar novamente
        </Button>
      </div>
    )}
  </div>
);

interface FormAlertProps {
  children: React.ReactNode;
  tone?: 'error' | 'warning';
}

/** Mensagem de erro de formulário, anunciada por leitores de tela. */
export const FormAlert: React.FC<FormAlertProps> = ({ children, tone = 'error' }) => (
  <div
    role="alert"
    aria-live="assertive"
    className={`mb-4 p-3 rounded-lg border text-sm flex items-start gap-2.5 ${
      tone === 'error'
        ? 'bg-rose-50 border-rose-200 text-rose-800'
        : 'bg-amber-50 border-amber-200 text-amber-900'
    }`}
  >
    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
    <span>{children}</span>
  </div>
);
