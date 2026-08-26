import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Field } from '../ui/Field';
import { Button } from '../ui/Button';
import { PermissionMatrix } from './PermissionMatrix';
import { GroupDetail } from '../../types';
import { PermissionCatalog } from '../../types/permission';
import { apiFetch, AppApiError } from '../../services/api';
import { toast } from 'sonner';

interface GroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  group?: GroupDetail | null;
  catalog: PermissionCatalog | null;
  onSuccess: () => void;
}

export const GroupModal: React.FC<GroupModalProps> = ({
  isOpen,
  onClose,
  group,
  catalog,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [violations, setViolations] = useState<{ screen: string; missingAnyOf: string[] }[]>([]);

  useEffect(() => {
    if (isOpen) {
      setName(group?.name || '');
      setDescription(group?.description || '');
      setPermissions(group?.permissions || []);
      setError(null);
      setViolations([]);
    }
  }, [isOpen, group]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSaving) return;

    setIsSaving(true);
    setError(null);
    setViolations([]);

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        permissions,
      };

      if (group) {
        await apiFetch(`/api/groups/${group.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Grupo atualizado com sucesso.');
      } else {
        await apiFetch('/api/groups', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Grupo criado com sucesso.');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err instanceof AppApiError ? err.data.error : 'Ocorreu um erro ao salvar o grupo.');
      if (err instanceof AppApiError && err.status === 422 && err.data.violations) {
        setViolations(err.data.violations as any[]);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={group ? 'Editar Grupo' : 'Novo Grupo'}
      size="xl"
      dismissOnOverlayClick={false}
      footer={
        <div className="flex gap-2 w-full justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="submit" form="group-form" variant="primary" disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      }
    >
      <form id="group-form" onSubmit={handleSubmit} className="space-y-6 pt-2">
        {error && (
          <div className="p-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nome" required>
            {(props) => (
              <input
                {...props}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3 border border-slate-300 rounded-md focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                disabled={isSaving}
              />
            )}
          </Field>

          <Field label="Descrição">
            {(props) => (
              <input
                {...props}
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full h-10 px-3 border border-slate-300 rounded-md focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                disabled={isSaving}
              />
            )}
          </Field>
        </div>

        <div>
          <h3 className="text-base font-semibold text-navy-900 mb-3">Permissões</h3>
          {catalog ? (
            <PermissionMatrix
              catalog={catalog}
              value={permissions}
              onChange={setPermissions}
              violations={violations}
            />
          ) : (
            <p className="text-sm text-slate-500">Carregando permissões...</p>
          )}
        </div>
      </form>
    </Modal>
  );
};
