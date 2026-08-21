import React, { useState, useEffect } from 'react';
import {
  Client,
  DocumentType,
  LeadSource,
  PipelineStage,
  Priority,
} from '../../types/client';
import { User } from '../../types';
import { apiFetch, errorMessage } from '../../services/api';
import {
  maskDocumentInput,
  maskPhoneInput,
  cleanDigits,
  validateDocument,
  formatDocument,
  formatPhoneBR,
} from '../../utils/formatters';
import { UserPlus, Edit3, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, controlClass } from '../ui/Field';
import { FormAlert } from '../ui/States';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clientToEdit: Client | null;
  users: User[];
}

const LEAD_SOURCES: LeadSource[] = [
  'Instagram',
  'Indicação',
  'Google Ads',
  'Prospecção Ativa',
  'LinkedIn',
  'Outro',
];

const PIPELINE_STAGES: PipelineStage[] = [
  'Novo Lead',
  'Contato/Qualificação',
  'Proposta Enviada',
  'Em Negociação',
  'Contrato Ativo',
  'Pausado/Churn',
];

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Média' },
  { value: 'baixa', label: 'Baixa' },
];

export const ClientModal: React.FC<ClientModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  clientToEdit,
  users,
}) => {
  const [name, setName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('CNPJ');
  const [documentNumber, setDocumentNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [leadSource, setLeadSource] = useState<LeadSource>('Instagram');
  const [stage, setStage] = useState<PipelineStage>('Novo Lead');
  const [priority, setPriority] = useState<Priority>('media');
  const [ownerId, setOwnerId] = useState<string>('');
  const [notes, setNotes] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!clientToEdit;
  const formId = 'client-form';

  useEffect(() => {
    if (clientToEdit) {
      setName(clientToEdit.name);
      setTradeName(clientToEdit.tradeName || '');
      setDocumentType(clientToEdit.documentType);
      setDocumentNumber(
        formatDocument(clientToEdit.documentNumber, clientToEdit.documentType)
      );
      setEmail(clientToEdit.email || '');
      setPhone(clientToEdit.phone ? formatPhoneBR(clientToEdit.phone) : '');
      setLeadSource(clientToEdit.leadSource);
      setStage(clientToEdit.stage);
      setPriority(clientToEdit.priority || 'media');
      setOwnerId(clientToEdit.ownerId || '');
      setNotes(clientToEdit.notes || '');
    } else {
      setName('');
      setTradeName('');
      setDocumentType('CNPJ');
      setDocumentNumber('');
      setEmail('');
      setPhone('');
      setLeadSource('Instagram');
      setStage('Novo Lead');
      setPriority('media');
      setOwnerId('');
      setNotes('');
    }
    setError(null);
    setDocumentError(null);
  }, [clientToEdit, isOpen]);

  const handleDocumentTypeChange = (newType: DocumentType) => {
    setDocumentType(newType);
    setDocumentNumber(maskDocumentInput(documentNumber, newType));
    setDocumentError(null);
  };

  const handleDocumentNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDocumentNumber(maskDocumentInput(e.target.value, documentType));
    setDocumentError(null);
  };

  // Valida ao sair do campo, para o erro aparecer junto do campo errado
  // em vez de só depois de tentar salvar o formulário inteiro.
  const handleDocumentBlur = () => {
    const digits = cleanDigits(documentNumber);
    if (!digits) return;
    setDocumentError(
      validateDocument(digits, documentType)
        ? null
        : `Este ${documentType} não é válido. Confira os dígitos.`
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);

    const cleanDoc = cleanDigits(documentNumber);
    if (!validateDocument(cleanDoc, documentType)) {
      setDocumentError(`Este ${documentType} não é válido. Confira os dígitos.`);
      setError(`Corrija o ${documentType} antes de salvar.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        tradeName: tradeName.trim() || null,
        documentType,
        documentNumber: cleanDoc,
        email: email.trim() || null,
        phone: phone.trim() || null,
        leadSource,
        stage,
        priority,
        ownerId: ownerId || null,
        notes: notes.trim() || null,
      };

      if (isEditing) {
        await apiFetch(`/api/clients/${clientToEdit.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Cliente atualizado.');
      } else {
        await apiFetch('/api/clients', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Cliente cadastrado.');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível salvar o cliente.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeUsers = users.filter((u) => u.active);
  const currentOwnerIsInactive =
    clientToEdit?.owner && !clientToEdit.owner.active && clientToEdit.ownerId;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar cliente' : 'Novo cliente ou lead'}
      description={
        isEditing
          ? 'Atualize os dados cadastrais e a posição no funil.'
          : 'Preencha os dados de contato e a origem do lead.'
      }
      icon={
        isEditing ? (
          <Edit3 className="w-5 h-5" aria-hidden="true" />
        ) : (
          <UserPlus className="w-5 h-5" aria-hidden="true" />
        )
      }
      size="lg"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            isLoading={isSubmitting}
            icon={<Check className="w-4 h-4" aria-hidden="true" />}
          >
            {isEditing ? 'Salvar alterações' : 'Cadastrar cliente'}
          </Button>
        </div>
      }
    >
      {error && <FormAlert>{error}</FormAlert>}

      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nome / razão social" required>
            {(props) => (
              <input
                {...props}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Apex Corp LTDA"
                className={controlClass}
              />
            )}
          </Field>

          <Field label="Nome fantasia">
            {(props) => (
              <input
                {...props}
                type="text"
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                placeholder="Ex: Apex Corp"
                className={controlClass}
              />
            )}
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <fieldset>
            <legend className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tipo de documento
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {(['CNPJ', 'CPF'] as DocumentType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleDocumentTypeChange(type)}
                  aria-pressed={documentType === type}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors ${
                    documentType === type
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {type === 'CNPJ' ? 'CNPJ (PJ)' : 'CPF (PF)'}
                </button>
              ))}
            </div>
          </fieldset>

          <Field
            label={`Número do ${documentType}`}
            required
            error={documentError || undefined}
            className="md:col-span-2"
          >
            {(props) => (
              <input
                {...props}
                type="text"
                inputMode="numeric"
                value={documentNumber}
                onChange={handleDocumentNumberChange}
                onBlur={handleDocumentBlur}
                placeholder={
                  documentType === 'CNPJ' ? '00.000.000/0000-00' : '000.000.000-00'
                }
                className={`${controlClass} font-mono`}
              />
            )}
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="E-mail de contato">
            {(props) => (
              <input
                {...props}
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contato@cliente.com.br"
                className={controlClass}
              />
            )}
          </Field>

          <Field label="Telefone / WhatsApp" hint="Inclua o DDD.">
            {(props) => (
              <input
                {...props}
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(maskPhoneInput(e.target.value))}
                placeholder="(11) 98765-4321"
                className={`${controlClass} font-mono`}
              />
            )}
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Origem do lead">
            {(props) => (
              <select
                {...props}
                value={leadSource}
                onChange={(e) => setLeadSource(e.target.value as LeadSource)}
                className={controlClass}
              >
                {LEAD_SOURCES.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label="Etapa do funil">
            {(props) => (
              <select
                {...props}
                value={stage}
                onChange={(e) => setStage(e.target.value as PipelineStage)}
                className={controlClass}
              >
                {PIPELINE_STAGES.map((stg) => (
                  <option key={stg} value={stg}>
                    {stg}
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

        <Field
          label="Responsável pelo lead"
          hint="Leads sem responsável aparecem marcados como “Sem responsável” nas listas."
        >
          {(props) => (
            <select
              {...props}
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className={controlClass}
            >
              <option value="">Sem responsável</option>
              {currentOwnerIsInactive && (
                <option value={clientToEdit.owner!.id} disabled>
                  {clientToEdit.owner!.name} (inativo)
                </option>
              )}
              {activeUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="Observações gerais">
          {(props) => (
            <textarea
              {...props}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contexto inicial, expectativas do cliente, combinados…"
              className={controlClass}
            />
          )}
        </Field>
      </form>
    </Modal>
  );
};
