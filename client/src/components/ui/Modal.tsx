import React, { useEffect, useId, useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import { pushDialog, popDialog, isTopDialog } from '../../hooks/dialogStack';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Título acessível do diálogo. Renderizado no cabeçalho quando `header` não é informado. */
  title: string;
  description?: string;
  /** Ícone exibido à esquerda do título no cabeçalho padrão. */
  icon?: React.ReactNode;
  /** Cor do contêiner do ícone. Use `danger` em confirmações destrutivas. */
  iconTone?: 'teal' | 'danger';
  size?: ModalSize;
  /**
   * Formulários não fecham ao clicar fora, para não descartar dados
   * digitados por acidente. Telas somente-leitura podem habilitar.
   */
  dismissOnOverlayClick?: boolean;
  /** Conteúdo fixo no rodapé (ações primárias). */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Casca única de modal usada por toda a aplicação.
 *
 * Resolve o que faltava nos diálogos escritos à mão: fechar com Esc, papel
 * ARIA correto, foco preso dentro do painel, foco devolvido ao elemento de
 * origem, bloqueio do scroll da página e altura limitada à viewport.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  icon,
  iconTone = 'teal',
  size = 'lg',
  dismissOnOverlayClick = false,
  footer,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const dialogId = useMemo(() => Symbol('modal'), []);

  // Registra na pilha para que só o diálogo do topo responda ao Esc.
  useEffect(() => {
    if (!isOpen) return;
    pushDialog(dialogId);
    return () => popDialog(dialogId);
  }, [isOpen, dialogId]);

  // Bloqueia o scroll do documento enquanto o modal estiver aberto.
  useEffect(() => {
    if (!isOpen) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [isOpen]);

  // Guarda o foco anterior, move o foco para o painel e devolve ao fechar.
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const focusFirst = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target = panel.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [data-autofocus]'
      );
      (target || panel).focus();
    }, 0);

    return () => {
      window.clearTimeout(focusFirst);
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen]);

  // Esc fecha; Tab circula apenas entre os elementos focáveis do painel.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopDialog(dialogId)) return;

      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose, dialogId]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-sm flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4 animate-overlay-in"
      onMouseDown={(event) => {
        if (dismissOnOverlayClick && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`w-full ${SIZE_CLASSES[size]} bg-white rounded-xl border border-slate-200 shadow-xl my-4 sm:my-8 flex flex-col max-h-[calc(100dvh-2rem)] overflow-hidden animate-panel-in focus:outline-none`}
      >
        <header className="px-4 sm:px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  iconTone === 'danger'
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-teal-50 text-teal-700'
                }`}
              >
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-bold text-navy-900 truncate">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="text-xs text-slate-500 mt-0.5">
                  {description}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 -mr-1 text-slate-500 hover:text-navy-900 hover:bg-slate-200/70 rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">{children}</div>

        {footer && (
          <footer className="px-4 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 flex-shrink-0">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
};
