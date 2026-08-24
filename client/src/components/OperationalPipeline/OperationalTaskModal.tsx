import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  OperationalTask,
  CreateOperationalTaskInput,
  UpdateOperationalTaskInput,
  OperationalStage,
} from '../../types/operational';
import { Client, Priority } from '../../types/client';
import { User } from '../../types';
import { apiFetch, errorMessage } from '../../services/api';
import { toast } from 'sonner';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, controlClass } from '../ui/Field';
import { FormAlert } from '../ui/States';
import { ListChecks } from 'lucide-react';

interface OperationalTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  taskToEdit: OperationalTask | null;
  users: User[];
  stages: OperationalStage[];
}

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Média' },
  { value: 'baixa', label: 'Baixa' },
];

export const OperationalTaskModal: React.FC<OperationalTaskModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  taskToEdit,
  users,
  stages,
}) => {
  const [clientId, setClientId] = useState('');
  const [stageId, setStageId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('media');
  const [dueDate, setDueDate] = useState('');
  const [ownerId, setOwnerId] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch clients to populate select
  const { data: clientsData, isLoading: isLoadingClients } = useQuery({
    queryKey: ['clients-for-select'],
    queryFn: () => apiFetch<{ data: Client[] }>('/api/clients?limit=1000'),
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const clients = clientsData?.data || [];

  useEffect(() => {
    if (isOpen) {
      if (taskToEdit) {
        setClientId(taskToEdit.clientId);
        setStageId(taskToEdit.stageId);
        setTitle(taskToEdit.title);
        setDescription(taskToEdit.description || '');
        setPriority(taskToEdit.priority);
        setDueDate(taskToEdit.dueDate || '');
        setOwnerId(taskToEdit.ownerId || '');
      } else {
        setClientId('');
        setStageId(stages.length > 0 ? stages[0].id : '');
        setTitle('');
        setDescription('');
        setPriority('media');
        setDueDate('');
        setOwnerId('');
      }
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, taskToEdit, stages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!clientId) {
      setError('Selecione um cliente.');
      return;
    }
    if (!stageId) {
      setError('Selecione uma etapa.');
      return;
    }
    if (!title.trim()) {
      setError('O título é obrigatório.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (taskToEdit) {
        const payload: UpdateOperationalTaskInput = {
          clientId,
          stageId,
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          dueDate: dueDate || undefined,
          ownerId: ownerId || undefined,
        };
        await apiFetch(`/api/operational-tasks/${taskToEdit.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Demanda atualizada com sucesso!');
      } else {
        const payload: CreateOperationalTaskInput = {
          clientId,
          stageId,
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          dueDate: dueDate || undefined,
          ownerId: ownerId || undefined,
        };
        await apiFetch('/api/operational-tasks', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Demanda criada com sucesso!');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(errorMessage(err, 'Erro ao salvar a demanda.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditing = !!taskToEdit;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar Demanda' : 'Nova Demanda'}
      description="Preencha os dados da demanda operacional."
      icon={<ListChecks className="w-5 h-5 text-teal-600" />}
      iconTone="teal"
      size="md"
      footer={
        <div className="flex justify-end gap-3 w-full">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={isSubmitting}
          >
            {isEditing ? 'Salvar Alterações' : 'Criar Demanda'}
          </Button>
        </div>
      }
    >
      <form id="operationalTaskForm" onSubmit={handleSubmit} className="space-y-4">
        {error && <FormAlert tone="error">{error}</FormAlert>}

        <Field label="Cliente" required>
          {(props) => (
            <select
              {...props}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className={controlClass}
              disabled={isLoadingClients}
            >
              <option value="">Selecione um cliente...</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} {client.tradeName ? `(${client.tradeName})` : ''}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="Título" required>
          {(props) => (
            <input
              {...props}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={controlClass}
              placeholder="Ex: Criação de site institucional"
            />
          )}
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Etapa" required>
            {(props) => (
              <select
                {...props}
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                className={controlClass}
              >
                <option value="">Selecione...</option>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label="Prioridade">
            {(props) => (
              <select
                {...props}
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className={controlClass}
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Prazo (Vencimento)">
            {(props) => (
              <input
                {...props}
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={controlClass}
              />
            )}
          </Field>

          <Field label="Responsável">
            {(props) => (
              <select
                {...props}
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className={controlClass}
              >
                <option value="">Sem responsável</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <Field label="Descrição">
          {(props) => (
            <textarea
              {...props}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={controlClass}
              rows={3}
              placeholder="Detalhes da demanda..."
            />
          )}
        </Field>
      </form>
    </Modal>
  );
};