import React, { useId } from 'react';

interface FieldProps {
  label: string;
  /** Marca o campo como obrigatório visualmente e para leitores de tela. */
  required?: boolean;
  /** Texto de apoio abaixo do controle. */
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  /** Recebe os atributos que devem ser aplicados ao controle. */
  children: (props: {
    id: string;
    required?: boolean;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
  }) => React.ReactNode;
}

/**
 * Associa `<label>` e controle via id/htmlFor. Antes desta abstração os
 * rótulos eram apenas texto solto: clicar no rótulo não focava o campo e
 * leitores de tela anunciavam os inputs sem nome.
 */
export const Field: React.FC<FieldProps> = ({
  label,
  required = false,
  hint,
  error,
  className = '',
  children,
}) => {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="block text-xs font-semibold text-slate-700 mb-1.5"
      >
        {label}
        {required && (
          <span className="text-rose-600 ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children({
        id,
        required,
        'aria-describedby': describedBy || undefined,
        'aria-invalid': error ? true : undefined,
      })}

      {hint && !error && (
        <p id={hintId} className="text-[11px] text-slate-500 mt-1">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-[11px] text-rose-600 mt-1 font-medium">
          {error}
        </p>
      )}
    </div>
  );
};

/** Classe base compartilhada por todos os inputs, selects e textareas. */
export const controlClass =
  'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-navy-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed aria-[invalid=true]:border-rose-400 aria-[invalid=true]:focus:ring-rose-500/20';

/** Variante compacta usada em barras de filtro. */
export const controlClassSm =
  'w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-navy-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20';
