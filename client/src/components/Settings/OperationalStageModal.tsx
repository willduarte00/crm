import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, controlClass } from '../ui/Field';
import { FormAlert } from '../ui/States';
import { OperationalStage, STAGE_COLOR_TOKENS, StageColor, STAGE_COLORS } from '../../types/operational';
import { apiFetch, errorMessage } from '../../services/api';
import { toast } from 'sonner';
import { Layers } from 'lucide-react';

interface OperationalStageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  stageToEdit: OperationalStage | null;
}

export const OperationalStageModal: React.FC<OperationalStageModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  stageToEdit,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<StageColor>('slate');
  const [active, setActive] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (stageToEdit) {
        setName(stageToEdit.name);
        setDescription(stageToEdit.description || '');
        setColor(stageToEdit.color);
        setActive(stageToEdit.active);
      } else {
        setName('');
        setDescription('');
        setColor('slate');
        setActive(true);
      }
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, stageToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!name.trim()) {
      setError('O nome da etapa é obrigatório.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (stageToEdit) {
        await apiFetch(`/api/operational-stages/${stageToEdit.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            color,
            active,
          }),
        });
        toast.success('Etapa atualizada com sucesso!');
      } else {
        await apiFetch('/api/operational-stages', {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            color,
          }),
        });
        toast.success('Etapa criada com sucesso!');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(errorMessage(err, 'Erro ao salvar a etapa.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditing = !!stageToEdit;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar Etapa' : 'Nova Etapa'}
      description="Configure as propriedades desta etapa da operação."
      icon={<Layers className="w-5 h-5 text-teal-600" />}
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
            {isEditing ? 'Salvar Alterações' : 'Criar Etapa'}
          </Button>
        </div>
      }
    >
      <form id="operationalStageForm" onSubmit={handleSubmit} className="space-y-4">
        {error && <FormAlert tone="error">{error}</FormAlert>}

        <Field label="Nome da Etapa" required>
          {(props) => (
            <input
              {...props}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={controlClass}
              placeholder="Ex: Em Aprovação"
              maxLength={50}
            />
          )}
        </Field>

        <Field label="Descrição" hint="Opcional. Exibida no cabeçalho da coluna.">
          {(props) => (
            <textarea
              {...props}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={controlClass}
              rows={2}
              maxLength={200}
              placeholder="O que acontece nesta etapa?"
            />
          )}
        </Field>

        <Field label="Cor de Identificação">
          {(props) => (
            <div className="grid grid-cols-4 gap-3 mt-2" {...props}>
              {STAGE_COLOR_TOKENS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`
                    flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-all
                    ${color === c ? 'border-teal-500 bg-teal-50/50' : 'border-slate-100 hover:border-slate-200 bg-white'}
                  `}
                >
                  <div className={`w-6 h-6 rounded-full shadow-sm ${STAGE_COLORS[c].dot}`} />
                  <span className="text-[11px] font-medium text-slate-600">
                    {STAGE_COLORS[c].label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Field>

        {isEditing && (
          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-600"
              />
              <span className="text-sm font-medium text-slate-700">Etapa ativa</span>
            </label>
            <p className="text-xs text-slate-500 ml-6 mt-1">
              Etapas inativas não aparecem no quadro nem nas opções de nova demanda.
            </p>
          </div>
        )}
      </form>
    </Modal>
  );
};