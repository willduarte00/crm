import React, { useState, useEffect } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import {
  Client,
  PipelineStage,
  Priority,
  InteractionLog,
} from '../../types/client';
import { Contract } from '../../types/contract';
import { User } from '../../types';
import { apiFetch, apiDownload, errorMessage } from '../../services/api';
import { useDialogBehavior } from '../../hooks/useDialogBehavior';
import { useConfirm } from '../ui/ConfirmDialog';
import { Button, IconButton } from '../ui/Button';
import { LoadingState, EmptyState, ErrorState } from '../ui/States';
import { controlClass, controlClassSm } from '../ui/Field';
import {
  formatDocument,
  formatPhoneBR,
  formatDateTimeBR,
  formatDateBR,
  formatCurrencyBRL,
} from '../../utils/formatters';
import { ContractModal } from '../Contracts/ContractModal';
import { ContractFilesModal } from '../Contracts/ContractFilesModal';
import { ClientWhatsAppTab } from './ClientWhatsAppTab';
import {
  X,
  Building2,
  Phone,
  Mail,
  Clock,
  UserCheck,
  Edit2,
  Trash2,
  MessageSquare,
  Send,
  FileCode2,
  Calendar,
  Loader2,
  Plus,
  Paperclip,
  Download,
  FileText,
  CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';

interface ClientDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string | null;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
  onUpdated: () => void;
  users: User[];
}

const PIPELINE_STAGES: PipelineStage[] = [
  'Novo Lead',
  'Contato/Qualificação',
  'Proposta Enviada',
  'Em Negociação',
  'Contrato Ativo',
  'Pausado/Churn',
];

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'alta', label: 'Alta', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { value: 'media', label: 'Média', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { value: 'baixa', label: 'Baixa', color: 'bg-teal-50 text-teal-700 border-teal-200' },
];

export const ClientDetailsModal: React.FC<ClientDetailsModalProps> = ({
  isOpen,
  onClose,
  clientId,
  onEdit,
  onDelete,
  onUpdated,
  users,
}) => {
  const confirm = useConfirm();
  const panelRef = useDialogBehavior(isOpen, onClose);

  const [client, setClient] = useState<Client | null>(null);
  const [logs, setLogs] = useState<InteractionLog[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingContracts, setIsLoadingContracts] = useState(false);
  const [activeTab, setActiveTab] = useState('geral');
  const [newLogContent, setNewLogContent] = useState('');
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);
  const [isUpdatingOwner, setIsUpdatingOwner] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [deletingContractId, setDeletingContractId] = useState<string | null>(null);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);

  // Modals de contratos e arquivos
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [contractToEdit, setContractToEdit] = useState<Contract | null>(null);
  const [isFilesModalOpen, setIsFilesModalOpen] = useState(false);
  const [contractForFiles, setContractForFiles] = useState<Contract | null>(null);

  const fetchClientDetails = async () => {
    if (!clientId) return;
    try {
      setIsLoading(true);
      setLoadError(false);
      const data = await apiFetch<Client>(`/api/clients/${clientId}`);
      setClient(data);
      if (data.interactionLogs) {
        setLogs(data.interactionLogs);
      }
    } catch {
      // Antes o modal se fechava sozinho; agora mostra o erro com opção de repetir.
      setClient(null);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchContracts = async () => {
    if (!clientId) return;
    try {
      setIsLoadingContracts(true);
      const data = await apiFetch<Contract[]>(`/api/contracts?clientId=${clientId}`);
      setContracts(data);
    } catch {
      setContracts([]);
    } finally {
      setIsLoadingContracts(false);
    }
  };

  useEffect(() => {
    if (isOpen && clientId) {
      fetchClientDetails();
      fetchContracts();
      setActiveTab('geral');
      setNewLogContent('');
    } else {
      setClient(null);
      setLogs([]);
      setContracts([]);
    }
  }, [isOpen, clientId]);

  if (!isOpen) return null;

  const handleStageChange = async (newStage: PipelineStage) => {
    if (!client || isUpdatingStage) return;
    try {
      setIsUpdatingStage(true);
      const updated = await apiFetch<Client>(`/api/clients/${client.id}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ stage: newStage }),
      });
      setClient((prev) => (prev ? { ...prev, stage: updated.stage } : null));
      toast.success(`Etapa alterada para “${newStage}”.`);
      onUpdated();
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível alterar a etapa.'));
    } finally {
      setIsUpdatingStage(false);
    }
  };

  const handleOwnerChange = async (newOwnerId: string) => {
    if (!client || isUpdatingOwner) return;
    try {
      setIsUpdatingOwner(true);
      const updated = await apiFetch<Client>(`/api/clients/${client.id}/owner`, {
        method: 'PATCH',
        body: JSON.stringify({ ownerId: newOwnerId || null }),
      });
      setClient((prev) =>
        prev
          ? {
              ...prev,
              ownerId: updated.ownerId,
              owner: updated.owner,
            }
          : null
      );
      toast.success('Responsável atualizado.');
      onUpdated();
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível alterar o responsável.'));
    } finally {
      setIsUpdatingOwner(false);
    }
  };

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !newLogContent.trim() || isSubmittingLog) return;

    try {
      setIsSubmittingLog(true);
      const log = await apiFetch<InteractionLog>(`/api/clients/${client.id}/logs`, {
        method: 'POST',
        body: JSON.stringify({
          content: newLogContent.trim(),
          type: 'anotacao',
        }),
      });

      setLogs((prev) => [log, ...prev]);
      setNewLogContent('');
      toast.success('Anotação registrada.');
      onUpdated();
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível registrar a anotação.'));
    } finally {
      setIsSubmittingLog(false);
    }
  };

  const handleDeleteContract = async (contract: Contract) => {
    if (deletingContractId) return;

    const confirmed = await confirm({
      title: 'Excluir contrato',
      tone: 'danger',
      confirmLabel: 'Excluir contrato',
      message: (
        <>
          O contrato de{' '}
          <strong className="text-navy-900">{contract.serviceType}</strong> será excluído
          junto com os arquivos anexados. Esta ação não pode ser desfeita.
        </>
      ),
    });
    if (!confirmed) return;

    try {
      setDeletingContractId(contract.id);
      await apiFetch(`/api/contracts/${contract.id}`, { method: 'DELETE' });
      toast.success('Contrato excluído.');
      fetchContracts();
      onUpdated();
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível excluir o contrato.'));
    } finally {
      setDeletingContractId(null);
    }
  };

  const handleDownloadFile = async (fileId: string, filename: string) => {
    if (downloadingFileId) return;
    try {
      setDownloadingFileId(fileId);
      await apiDownload(`/api/files/${fileId}`, filename);
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível baixar o arquivo.'));
    } finally {
      setDownloadingFileId(null);
    }
  };

  const priorityObj = PRIORITIES.find((p) => p.value === client?.priority) || PRIORITIES[1];
  const activeUsers = users.filter((u) => u.active);

  return (
    <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-sm flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-details-title"
        tabIndex={-1}
        className="w-full max-w-4xl bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden my-4 sm:my-8 animate-panel-in flex flex-col max-h-[calc(100dvh-2rem)] focus:outline-none"
      >
        {/* Header da Ficha */}
        <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-start gap-4 min-w-0">
            <div
              className="w-12 h-12 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-lg flex-shrink-0"
              aria-hidden="true"
            >
              {client?.name ? client.name.substring(0, 2).toUpperCase() : 'CL'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="client-details-title"
                  className="text-xl font-bold text-navy-900 leading-tight"
                >
                  {client?.name || 'Ficha do cliente'}
                </h2>
                {client?.tradeName && (
                  <span className="text-xs text-slate-500 font-medium px-2 py-0.5 bg-slate-200 rounded">
                    {client.tradeName}
                  </span>
                )}
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${priorityObj.color}`}
                >
                  Prioridade {priorityObj.label}
                </span>
              </div>
              <div className="flex items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1 flex-wrap">
                <span>
                  {client?.documentType}:{' '}
                  <strong className="font-mono text-slate-700">
                    {formatDocument(client?.documentNumber, client?.documentType)}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Origem: <strong className="text-slate-700">{client?.leadSource}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Ações e Dropdown de Etapa (RF-05) */}
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {/* Etapa do funil, editável direto na ficha */}
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-300">
              <label
                htmlFor="details-stage"
                className="text-xs font-semibold text-slate-600"
              >
                Etapa:
              </label>
              <select
                id="details-stage"
                value={client?.stage || ''}
                disabled={isUpdatingStage || isLoading || !client}
                onChange={(e) => handleStageChange(e.target.value as PipelineStage)}
                className="text-xs font-bold text-teal-700 bg-transparent border-none focus:ring-0 cursor-pointer py-1 pr-6 disabled:text-slate-400"
              >
                {PIPELINE_STAGES.map((stg) => (
                  <option key={stg} value={stg} className="text-navy-900 font-normal">
                    {stg}
                  </option>
                ))}
              </select>
              {isUpdatingStage && (
                <Loader2
                  className="w-3.5 h-3.5 animate-spin text-teal-600"
                  aria-hidden="true"
                />
              )}
            </div>

            <IconButton
              label="Editar dados do cliente"
              onClick={() => client && onEdit(client)}
              disabled={!client}
            >
              <Edit2 className="w-4 h-4" aria-hidden="true" />
            </IconButton>

            <IconButton
              label="Excluir cliente"
              tone="danger"
              onClick={() => client && onDelete(client)}
              disabled={!client}
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </IconButton>

            <IconButton label="Fechar" onClick={onClose}>
              <X className="w-5 h-5" aria-hidden="true" />
            </IconButton>
          </div>
        </div>

        {/* Abas Radix UI */}
        <Tabs.Root
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <Tabs.List className="flex border-b border-slate-200 bg-white px-4 sm:px-6 overflow-x-auto flex-shrink-0">
            <Tabs.Trigger
              value="geral"
              className="py-3 px-4 text-xs font-semibold text-slate-600 hover:text-navy-900 border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 transition-colors flex items-center gap-2 whitespace-nowrap flex-shrink-0"
            >
              <Building2 className="w-4 h-4" />
              <span>Dados e histórico</span>
            </Tabs.Trigger>

            <Tabs.Trigger
              value="contratos"
              className="py-3 px-4 text-xs font-semibold text-slate-600 hover:text-navy-900 border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 transition-colors flex items-center gap-2 whitespace-nowrap flex-shrink-0"
            >
              <FileCode2 className="w-4 h-4" />
              <span>Contratos ({contracts.length})</span>
            </Tabs.Trigger>

            <Tabs.Trigger
              value="whatsapp"
              className="py-3 px-4 text-xs font-semibold text-slate-600 hover:text-navy-900 border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 transition-colors flex items-center gap-2 whitespace-nowrap flex-shrink-0"
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp</span>
            </Tabs.Trigger>
          </Tabs.List>

          {/* Conteúdo Aba 1: Dados Gerais & Timeline */}
          <Tabs.Content
            value="geral"
            className="flex-1 overflow-y-auto p-4 sm:p-6 focus:outline-none bg-slate-50/50"
          >
            {isLoading ? (
              <LoadingState message="Carregando ficha do cliente..." />
            ) : loadError ? (
              <ErrorState
                title="Não foi possível carregar a ficha"
                message="Os dados do cliente não puderam ser lidos do servidor. Verifique sua conexão e tente novamente."
                onRetry={fetchClientDetails}
              />
            ) : client ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Coluna Esquerda: Informações Cadastrais */}
                <div className="lg:col-span-1 space-y-4">
                  <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Informações de Contato
                    </h4>

                    <div className="space-y-3 text-xs">
                      <div>
                        <span className="text-slate-500 block mb-0.5">Telefone / WhatsApp</span>
                        <div className="flex items-center gap-2 text-slate-800 font-medium font-mono">
                          <Phone className="w-3.5 h-3.5 text-teal-600" />
                          <span>{client.phone ? formatPhoneBR(client.phone) : 'Não informado'}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500 block mb-0.5">E-mail</span>
                        <div className="flex items-center gap-2 text-slate-800 font-medium">
                          <Mail className="w-3.5 h-3.5 text-teal-600" />
                          <span className="truncate">
                            {client.email || 'Não informado'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="details-owner"
                          className="text-slate-500 block mb-0.5"
                        >
                          Responsável pelo lead
                        </label>
                        <div className="flex items-center gap-2 text-slate-800 font-medium">
                          <UserCheck
                            className="w-3.5 h-3.5 text-teal-600 flex-shrink-0"
                            aria-hidden="true"
                          />
                          <select
                            id="details-owner"
                            value={client.ownerId || ''}
                            disabled={isUpdatingOwner}
                            onChange={(e) => handleOwnerChange(e.target.value)}
                            className={controlClassSm}
                          >
                            <option value="">Sem responsável</option>
                            {client.owner && !client.owner.active && (
                              <option value={client.owner.id} disabled>
                                {client.owner.name} (Inativo)
                              </option>
                            )}
                            {activeUsers.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500 block mb-0.5">Criado em</span>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span>{formatDateTimeBR(client.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {client.notes && (
                    <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Observações do Cadastro
                      </h4>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded border border-slate-100">
                        {client.notes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Coluna Direita: Timeline de Anotações (RF-06) */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Card de Nova Anotação */}
                  <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
                    <h4 className="text-xs font-bold text-navy-900 mb-2 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-teal-600" aria-hidden="true" />
                      <span>Registrar anotação</span>
                    </h4>
                    <form onSubmit={handleAddLog} className="space-y-3">
                      <label htmlFor="new-log" className="sr-only">
                        Nova anotação
                      </label>
                      <textarea
                        id="new-log"
                        rows={2}
                        required
                        value={newLogContent}
                        onChange={(e) => setNewLogContent(e.target.value)}
                        placeholder="Contato, reunião, proposta ou alinhamento com o cliente..."
                        className={controlClass + ' text-xs'}
                      />
                      <div className="flex justify-end">
                        <Button
                          type="submit"
                          size="sm"
                          isLoading={isSubmittingLog}
                          disabled={!newLogContent.trim()}
                          icon={<Send className="w-3.5 h-3.5" aria-hidden="true" />}
                        >
                          Registrar anotação
                        </Button>
                      </div>
                    </form>
                  </div>

                  {/* Lista da Timeline */}
                  <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center justify-between">
                      <span>Histórico de interações ({logs.length})</span>
                      <span className="text-[11px] font-normal text-slate-500">
                        Ordenado do mais recente
                      </span>
                    </h4>

                    {logs.length === 0 ? (
                      <EmptyState
                        icon={<Clock className="w-6 h-6" />}
                        title="Nenhuma anotação ainda"
                        message="Registre contatos, reuniões e alinhamentos no campo acima para manter o histórico do cliente."
                        className="!py-8"
                      />
                    ) : (
                      <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                        {logs.map((log) => (
                          <div key={log.id} className="relative group">
                            {/* Marcador na linha do tempo */}
                            <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px] ring-4 ring-white shadow-xs">
                              •
                            </div>

                            <div className="bg-slate-50/80 hover:bg-slate-50 border border-slate-200/80 rounded-lg p-3.5 transition-colors">
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-5 rounded-full bg-navy-800 text-white flex items-center justify-center font-bold text-[10px] uppercase">
                                    {log.user.name.substring(0, 2)}
                                  </div>
                                  <span className="text-xs font-bold text-navy-900">
                                    {log.user.name}
                                  </span>
                                  <span className="text-[10px] text-slate-500">
                                    ({log.user.role})
                                  </span>
                                </div>
                                <span className="text-[11px] tabular-nums text-slate-500 font-medium">
                                  {formatDateTimeBR(log.createdAt)}
                                </span>
                              </div>

                              <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                                {log.content}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </Tabs.Content>

          {/* Conteúdo Aba 2: Contrato & Arquivos (RF-10 a RF-13) */}
          <Tabs.Content
            value="contratos"
            className="flex-1 overflow-y-auto p-6 focus:outline-none bg-slate-50/50 space-y-4"
          >
            {/* Header da Aba de Contratos */}
            <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
              <div>
                <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider">
                  Contratos e anexos assinados
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Serviços contratados, vigência, valores e documentos.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setContractToEdit(null);
                  setIsContractModalOpen(true);
                }}
                icon={<Plus className="w-3.5 h-3.5" aria-hidden="true" />}
                className="flex-shrink-0"
              >
                Novo contrato
              </Button>
            </div>

            {isLoadingContracts ? (
              <div className="bg-white rounded-lg border border-slate-200">
                <LoadingState message="Carregando contratos..." />
              </div>
            ) : contracts.length === 0 ? (
              <div className="bg-white rounded-lg border border-slate-200">
                <EmptyState
                  icon={<FileCode2 className="w-6 h-6" />}
                  title="Nenhum contrato para este cliente"
                  message="Cadastre o primeiro contrato, escolha o modelo de cobrança e anexe o documento assinado."
                  action={
                    <Button
                      size="sm"
                      onClick={() => {
                        setContractToEdit(null);
                        setIsContractModalOpen(true);
                      }}
                      icon={<Plus className="w-4 h-4" aria-hidden="true" />}
                    >
                      Cadastrar contrato
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="space-y-4">
                {contracts.map((ct) => {
                  const isRecorrente = ct.billingType === 'recorrente';
                  const statusColors: Record<string, string> = {
                    ativo: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    pausado: 'bg-amber-50 text-amber-700 border-amber-200',
                    encerrado: 'bg-slate-100 text-slate-600 border-slate-200',
                  };

                  return (
                    <div
                      key={ct.id}
                      className="bg-white rounded-lg border border-slate-200 shadow-xs hover:border-slate-300 transition-colors overflow-hidden"
                    >
                      {/* Topo do Card de Contrato */}
                      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-navy-900">
                                {ct.serviceType}
                              </h4>
                              <span
                                className={`text-[11px] px-2 py-0.5 rounded-full font-medium border capitalize ${
                                  statusColors[ct.status] || 'bg-slate-100'
                                }`}
                              >
                                {ct.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                              <span>Início: <strong>{formatDateBR(ct.startDate)}</strong></span>
                              <span>•</span>
                              <span>
                                Término:{' '}
                                <strong>
                                  {ct.endDate ? formatDateBR(ct.endDate) : 'Indeterminado'}
                                </strong>
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Valor e Tipo de Cobrança */}
                        <div className="flex items-center gap-3 sm:text-right">
                          <div>
                            <span className="text-xs text-slate-500 block font-medium">
                              {isRecorrente ? 'Mensalidade' : 'Valor Total'}
                            </span>
                            <span className="text-base font-bold text-navy-900 font-mono">
                              {formatCurrencyBRL(ct.valueCents)}
                            </span>
                          </div>

                          <div className="flex items-center gap-0.5">
                            <IconButton
                              label={'Editar contrato de ' + ct.serviceType}
                              onClick={() => {
                                setContractToEdit(ct);
                                setIsContractModalOpen(true);
                              }}
                            >
                              <Edit2 className="w-4 h-4" aria-hidden="true" />
                            </IconButton>
                            <IconButton
                              label={'Excluir contrato de ' + ct.serviceType}
                              tone="danger"
                              onClick={() => handleDeleteContract(ct)}
                              isLoading={deletingContractId === ct.id}
                              disabled={deletingContractId !== null}
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </IconButton>
                          </div>
                        </div>
                      </div>

                      {/* Corpo do Card */}
                      <div className="p-4 space-y-3">
                        {/* Condições de Cobrança */}
                        <div className="flex items-center gap-4 text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-100 flex-wrap">
                          <span className="flex items-center gap-1 font-medium">
                            <CreditCard className="w-3.5 h-3.5 text-teal-600" />
                            <span>Cobrança: <strong>{isRecorrente ? 'Recorrente' : 'Pontual'}</strong></span>
                          </span>

                          {isRecorrente && (
                            <>
                              <span>•</span>
                              <span>Vencimento: <strong>Todo dia {ct.billingDay}</strong></span>
                              <span>•</span>
                              <span>
                                Periodicidade:{' '}
                                <strong>
                                  {ct.billingPeriodMonths === 1
                                    ? 'Mensal'
                                    : ct.billingPeriodMonths === 3
                                    ? 'Trimestral'
                                    : ct.billingPeriodMonths === 6
                                    ? 'Semestral'
                                    : ct.billingPeriodMonths === 12
                                    ? 'Anual'
                                    : `A cada ${ct.billingPeriodMonths} meses`}
                                </strong>
                              </span>
                            </>
                          )}

                          {!isRecorrente && ct.installments && (
                            <>
                              <span>•</span>
                              <span>Parcelamento: <strong>{ct.installments}x parcela(s)</strong></span>
                            </>
                          )}
                        </div>

                        {ct.description && (
                          <p className="text-xs text-slate-700 whitespace-pre-wrap">
                            {ct.description}
                          </p>
                        )}

                        {/* Seção de Arquivos Anexos (RF-12) */}
                        <div className="pt-2 border-t border-slate-100">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                              <Paperclip
                                className="w-3.5 h-3.5 text-teal-600"
                                aria-hidden="true"
                              />
                              <span>Arquivos anexos ({ct.files?.length || 0})</span>
                            </h5>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setContractForFiles(ct);
                                setIsFilesModalOpen(true);
                              }}
                              aria-label={'Gerenciar anexos do contrato de ' + ct.serviceType}
                              icon={<Plus className="w-3 h-3" aria-hidden="true" />}
                              className="text-teal-700 hover:bg-teal-50 hover:text-teal-800"
                            >
                              Gerenciar anexos
                            </Button>
                          </div>

                          {!ct.files || ct.files.length === 0 ? (
                            <p className="text-[11px] text-slate-500 italic">
                              Nenhum arquivo anexado (contrato assinado ou aditivo).
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {ct.files.map((file) => (
                                <div
                                  key={file.id}
                                  className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded text-xs hover:border-teal-400 transition-colors"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <FileText className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                                    <span className="truncate text-navy-900 font-medium" title={file.originalName}>
                                      {file.originalName}
                                    </span>
                                  </div>
                                  <IconButton
                                    label={'Baixar ' + file.originalName}
                                    onClick={() =>
                                      handleDownloadFile(file.id, file.originalName)
                                    }
                                    isLoading={downloadingFileId === file.id}
                                    className="!p-1 flex-shrink-0"
                                  >
                                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                                  </IconButton>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Tabs.Content>

          {/* Conteúdo Aba 3: WhatsApp (RF-50 a RF-53) */}
          <Tabs.Content
            value="whatsapp"
            className="flex-1 overflow-y-auto p-4 sm:p-6 focus:outline-none bg-slate-50/50"
          >
            {isLoading ? (
              <div className="bg-white rounded-lg border border-slate-200">
                <LoadingState message="Carregando ficha do cliente..." />
              </div>
            ) : loadError ? (
              <ErrorState
                title="Não foi possível carregar a ficha"
                message="Os dados do cliente não puderam ser lidos do servidor. Verifique sua conexão e tente novamente."
                onRetry={fetchClientDetails}
              />
            ) : client ? (
              <ClientWhatsAppTab
                client={client}
                onLogged={(log) => {
                  setLogs((prev) => [log, ...prev]);
                  onUpdated();
                }}
              />
            ) : null}
          </Tabs.Content>
        </Tabs.Root>
      </div>

      {/* Modal de Criação / Edição de Contrato */}
      <ContractModal
        isOpen={isContractModalOpen}
        onClose={() => {
          setIsContractModalOpen(false);
          setContractToEdit(null);
        }}
        contractToEdit={contractToEdit}
        fixedClientId={client?.id}
        onSuccess={() => {
          fetchContracts();
          onUpdated();
        }}
      />

      {/* Modal de Arquivos do Contrato */}
      <ContractFilesModal
        isOpen={isFilesModalOpen}
        onClose={() => {
          setIsFilesModalOpen(false);
          setContractForFiles(null);
        }}
        contract={contractForFiles}
        onFilesUpdated={() => {
          fetchContracts();
          onUpdated();
        }}
      />
    </div>
  );
};
