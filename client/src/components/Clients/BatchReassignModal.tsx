import React, { useState } from 'react';
import { User } from '../../types';
import { apiFetch, AppApiError } from '../../services/api';
import { X, Users, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface BatchReassignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedClientIds: string[];
  users: User[];
}

export const BatchReassignModal: React.FC<BatchReassignModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  selectedClientIds,
  users,
}) => {
  const [newOwnerId, setNewOwnerId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeUsers = users.filter((u) => u.active);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await apiFetch<{ success: boolean; updatedCount: number }>(
        '/api/clients/batch-reassign',
        {
          method: 'POST',
          body: JSON.stringify({
            clientIds: selectedClientIds,
            newOwnerId: newOwnerId || null,
          }),
        }
      );

      toast.success(
        `${res.updatedCount} ${
          res.updatedCount === 1 ? 'lead reatribuído' : 'leads reatribuídos'
        } com sucesso!`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      if (err instanceof AppApiError) {
        setError(err.data.error || 'Erro ao reatribuir leads');
      } else {
        setError('Ocorreu um erro ao reatribuir.');
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
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-navy-900">Reatribuição em Lote</h3>
            <p className="text-xs text-slate-500">
              Reatribuir {selectedClientIds.length}{' '}
              {selectedClientIds.length === 1 ? 'lead selecionado' : 'leads selecionados'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Novo Responsável
            </label>
            <select
              value={newOwnerId}
              onChange={(e) => setNewOwnerId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-navy-900"
            >
              <option value="">Deixar sem responsável</option>
              {activeUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Selecione o novo membro da agência que assumirá o atendimento destes leads.
            </p>
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
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
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded flex items-center gap-2 disabled:opacity-50 shadow-sm"
            >
              {isSubmitting ? (
                <span className="inline-block animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>Confirmar Reatribuição</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
