import React from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-teal-600 text-white border border-teal-600 hover:bg-teal-700 hover:border-teal-700 shadow-xs',
  secondary:
    'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-navy-900 shadow-2xs',
  danger:
    'bg-rose-600 text-white border border-rose-600 hover:bg-rose-700 hover:border-rose-700 shadow-xs',
  ghost:
    'bg-transparent text-slate-600 border border-transparent hover:bg-slate-100 hover:text-navy-900',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Exibe spinner e desabilita o botão — evita envio duplicado. */
  isLoading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  fullWidth = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}) => {
  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      className={`inline-flex items-center justify-center font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ${
        VARIANTS[variant]
      } ${SIZES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" aria-hidden="true" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
};

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Nome acessível obrigatório — botões só com ícone não têm texto visível. */
  label: string;
  tone?: 'neutral' | 'danger' | 'success' | 'whatsapp';
  isLoading?: boolean;
  children: React.ReactNode;
}

const TONES: Record<NonNullable<IconButtonProps['tone']>, string> = {
  neutral: 'text-slate-500 hover:text-navy-900 hover:bg-slate-100',
  danger: 'text-slate-500 hover:text-rose-600 hover:bg-rose-50',
  success: 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50',
  whatsapp: 'text-slate-500 hover:text-[#128C4A] hover:bg-[#25D366]/10',
};

export const IconButton: React.FC<IconButtonProps> = ({
  label,
  tone = 'neutral',
  isLoading = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    aria-label={label}
    title={label}
    disabled={disabled || isLoading}
    aria-busy={isLoading || undefined}
    className={`inline-flex items-center justify-center p-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${TONES[tone]} ${className}`}
    {...rest}
  >
    {isLoading ? (
      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
    ) : (
      children
    )}
  </button>
);
