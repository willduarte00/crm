import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { apiFetch, errorMessage } from '../../services/api';
import { Users, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, controlClass } from '../ui/Field';
import { FormAlert } from '../ui/States';

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

  const activeUsers = users.filter((u) => u.active);
  const count = selectedClientIds.length;
  const formId = 'batch-reassign-form';

  useEffect(() => {
    if (isOpen) {
      setNewOwnerId('');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
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
        res.updatedCount === 1
          ? '1 lead reatribuído.'
          : `${res.updatedCount} leads reatribuídos.`
      );
      onSuccess();
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível reatribuir os leads.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reatribuir leads em lote"
      description={`${count} ${count === 1 ? 'lead será reatribuído' : 'leads serão reatribuídos'}.`}
      icon={<Users className="w-5 h-5" aria-hidden="true" />}
      size="sm"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            isLoading={isSubmitting}
            disabled={count === 0}
            icon={<Check className="w-4 h-4" aria-hidden="true" />}
          >
            Reatribuir {count} {count === 1 ? 'lead' : 'leads'}
          </Button>
        </div>
      }
    >
      {error && <FormAlert>{error}</FormAlert>}

      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Novo responsável"
          hint="Quem assumirá o atendimento destes leads. Deixe em branco para removê-los de qualquer responsável."
        >
          {(props) => (
            <select
              {...props}
              value={newOwnerId}
              onChange={(e) => setNewOwnerId(e.target.value)}
              className={controlClass}
            >
              <option value="">Deixar sem responsável</option>
              {activeUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          )}
        </Field>
      </form>
    </Modal>
  );
};
