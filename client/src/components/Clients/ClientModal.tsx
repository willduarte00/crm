import React, { useState, useEffect } from 'react';
import {
  Client,
  DocumentType,
  LeadSource,
  PipelineStage,
  Priority,
} from '../../types/client';
import { User } from '../../types';
import { apiFetch, AppApiError } from '../../services/api';
import {
  maskDocumentInput,
  maskPhoneInput,
  cleanDigits,
  validateDocument,
  formatDocument,
  formatPhoneBR,
} from '../../utils/formatters';
import { X, UserPlus, Edit3, AlertCircle, Check } from 'lucide-react';
import { toast } from 'sonner';

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

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'alta', label: 'Alta', color: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'media', label: 'Média', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { value: 'baixa', label: 'Baixa', color: 'bg-teal-50 text-teal-700 border-teal-200' },
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!clientToEdit;

  useEffect(() => {
    if (clientToEdit) {
      setName(clientToEdit.name);
      setTradeName(clientToEdit.tradeName || '');
      setDocumentType(clientToEdit.documentType);
      setDocumentNumber(formatDocument(clientToEdit.documentNumber, clientToEdit.documentType));
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
  }, [clientToEdit, isOpen]);

  if (!isOpen) return null;

  const handleDocumentTypeChange = (newType: DocumentType) => {
    setDocumentType(newType);
    setDocumentNumber(maskDocumentInput(documentNumber, newType));
  };

  const handleDocumentNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskDocumentInput(e.target.value, documentType);
    setDocumentNumber(masked);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskPhoneInput(e.target.value);
    setPhone(masked);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanDoc = cleanDigits(documentNumber);
    if (!validateDocument(cleanDoc, documentType)) {
      setError(`O número de ${documentType} informado é inválido.`);
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
        toast.success('Cliente atualizado com sucesso!');
      } else {
        await apiFetch('/api/clients', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Cliente/Lead cadastrado com sucesso!');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      if (err instanceof AppApiError) {
        setError(err.data.error || 'Erro ao salvar cliente');
      } else {
        setError('Ocorreu um erro ao salvar o registro.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtrar apenas usuários ativos para atribuição (RF-06a)
  // Caso esteja editando e o responsável atual esteja inativo, manter na lista visualmente com indicação
  const activeUsers = users.filter((u) => u.active);
  const currentOwnerIsInactive =
    clientToEdit?.owner && !clientToEdit.owner.active && clientToEdit.ownerId;

  return (
    <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-lg border border-slate-200 shadow-xl p-6 relative my-8 animate-in fade-in zoom-in duration-150">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 rounded p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">
            {isEditing ? <Edit3 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-navy-900">
              {isEditing ? 'Editar Cliente / Lead' : 'Novo Cliente ou Lead'}
            </h3>
            <p className="text-xs text-slate-500">
              {isEditing
                ? 'Atualize as informações cadastrais e comerciais'
                : 'Preencha os dados de contato e funil comercial'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nome / Razão Social */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome / Razão Social <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Apex Corp LTDA"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-navy-900"
              />
            </div>

            {/* Nome Fantasia */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome Fantasia (opcional)
              </label>
              <input
                type="text"
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                placeholder="Ex: Apex Corp"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-navy-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tipo de Documento */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tipo de Documento
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleDocumentTypeChange('CNPJ')}
                  className={`py-2 px-3 text-xs font-semibold rounded border transition-colors ${
                    documentType === 'CNPJ'
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  CNPJ (PJ)
                </button>
                <button
                  type="button"
                  onClick={() => handleDocumentTypeChange('CPF')}
                  className={`py-2 px-3 text-xs font-semibold rounded border transition-colors ${
                    documentType === 'CPF'
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  CPF (PF)
                </button>
              </div>
            </div>

            {/* Número do Documento com máscara */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Número do {documentType} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={documentNumber}
                onChange={handleDocumentNumberChange}
                placeholder={documentType === 'CNPJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-navy-900 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* E-mail */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                E-mail de Contato
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contato@cliente.com.br"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-navy-900"
              />
            </div>

            {/* Telefone / WhatsApp */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Telefone / WhatsApp (com DDD)
              </label>
              <input
                type="text"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="(11) 98765-4321"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-navy-900 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Origem do Lead (RF-03) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Origem do Lead
              </label>
              <select
                value={leadSource}
                onChange={(e) => setLeadSource(e.target.value as LeadSource)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-navy-900"
              >
                {LEAD_SOURCES.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
            </div>

            {/* Etapa do Funil (RF-04) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Etapa do Funil
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as PipelineStage)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-navy-900"
              >
                {PIPELINE_STAGES.map((stg) => (
                  <option key={stg} value={stg}>
                    {stg}
                  </option>
                ))}
              </select>
            </div>

            {/* Prioridade (RF-06b) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Prioridade
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-navy-900"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Responsável (RF-06a) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Responsável pelo Lead (opcional)
            </label>
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-navy-900"
            >
              <option value="">Sem responsável</option>
              {currentOwnerIsInactive && (
                <option value={clientToEdit.owner!.id} disabled>
                  {clientToEdit.owner!.name} (Inativo)
                </option>
              )}
              {activeUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Leads sem responsável aparecem explicitamente como &quot;Sem responsável&quot;.
            </p>
          </div>

          {/* Observações Gerais */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Observações Gerais
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informações adicionais, histórico inicial ou expectativas do cliente..."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-navy-900"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
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
              className="px-5 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded flex items-center gap-2 disabled:opacity-50 shadow-sm"
            >
              {isSubmitting ? (
                <span className="inline-block animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>{isEditing ? 'Salvar Alterações' : 'Cadastrar Lead'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
