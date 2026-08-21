import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmOptions {
  title: string;
  /** Explica exatamente o que vai acontecer, incluindo o nome do registro. */
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` para ações destrutivas ou irreversíveis. */
  tone?: 'danger' | 'default';
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Substitui o `window.confirm()` nativo: bloqueava a thread, ignorava o
 * design do sistema e não deixava claro qual registro seria afetado.
 */
export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  const isDanger = options?.tone === 'danger';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {options && (
        <Modal
          isOpen
          onClose={() => settle(false)}
          title={options.title}
          size="sm"
          iconTone={isDanger ? 'danger' : 'teal'}
          icon={
            isDanger ? (
              <Trash2 className="w-5 h-5" aria-hidden="true" />
            ) : (
              <AlertTriangle className="w-5 h-5" aria-hidden="true" />
            )
          }
          footer={
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button variant="secondary" onClick={() => settle(false)}>
                {options.cancelLabel || 'Cancelar'}
              </Button>
              <Button
                variant={isDanger ? 'danger' : 'primary'}
                onClick={() => settle(true)}
                data-autofocus
              >
                {options.confirmLabel || 'Confirmar'}
              </Button>
            </div>
          }
        >
          <div className="text-sm text-slate-700 leading-relaxed">{options.message}</div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
};

/** Retorna uma função que resolve `true` quando o usuário confirma. */
export const useConfirm = (): ConfirmFn => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm deve ser usado dentro de um ConfirmProvider');
  }
  return context;
};
