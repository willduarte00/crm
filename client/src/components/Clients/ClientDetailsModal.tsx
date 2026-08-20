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
import { apiFetch } from '../../services/api';
import {
  formatDocument,
  formatPhoneBR,
  formatDateTimeBR,
  formatDateBR,
  formatCurrencyBRL,
} from '../../utils/formatters';
import { ContractModal } from '../Contracts/ContractModal';
import { ContractFilesModal } from '../Contracts/ContractFilesModal';
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
  Sparkles,
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

  // Modals de contratos e arquivos
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [contractToEdit, setContractToEdit] = useState<Contract | null>(null);
  const [isFilesModalOpen, setIsFilesModalOpen] = useState(false);
  const [contractForFiles, setContractForFiles] = useState<Contract | null>(null);

  const fetchClientDetails = async () => {
    if (!clientId) return;
    try {
      setIsLoading(true);
      const data = await apiFetch<Client>(`/api/clients/${clientId}`);
      setClient(data);
      if (data.interactionLogs) {
        setLogs(data.interactionLogs);
      }
    } catch (err) {
      toast.error('Erro ao carregar detalhes do cliente');
      onClose();
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
    } catch (err) {
      toast.error('Erro ao carregar contratos do cliente');
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
      toast.success(`Etapa alterada para "${newStage}"`);
      onUpdated();
    } catch (err: any) {
      toast.error('Erro ao alterar etapa');
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
      toast.success('Responsável atualizado com sucesso!');
      onUpdated();
    } catch (err: any) {
      toast.error('Erro ao alterar responsável');
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
      toast.success('Anotação registrada na timeline!');
      onUpdated();
    } catch (err: any) {
      toast.error('Erro ao adicionar anotação');
    } finally {
      setIsSubmittingLog(false);
    }
  };

  const handleDeleteContract = async (contract: Contract) => {
    if (!confirm(`Deseja realmente excluir o contrato de ${contract.serviceType}?`)) {
      return;
    }

    try {
      await apiFetch(`/api/contracts/${contract.id}`, {
        method: 'DELETE',
      });
      toast.success('Contrato excluído com sucesso!');
      fetchContracts();
      onUpdated();
    } catch (err: any) {
      toast.error('Erro ao excluir contrato.');
    }
  };

  const handleDownloadFile = async (fileId: string, filename: string) => {
    try {
      const res = await fetch(`/api/files/${fileId}`);
      if (!res.ok) throw new Error('Falha ao baixar arquivo');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.message || 'Erro no download');
    }
  };

  const priorityObj = PRIORITIES.find((p) => p.value === client?.priority) || PRIORITIES[1];
  const activeUsers = users.filter((u) => u.active);

  return (
    <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-lg border border-slate-200 shadow-xl overflow-hidden my-6 animate-in fade-in zoom-in duration-150 flex flex-col max-h-[90vh]">
        {/* Header da Ficha */}
        <div className="p-6 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-lg shadow-sm flex-shrink-0">
              {client?.name ? client.name.substring(0, 2).toUpperCase() : 'CL'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-navy-900 leading-tight">
                  {client?.name}
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
              <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
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
          <div className="flex items-center gap-3">
            {/* Dropdown de Etapa */}
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-300 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">Etapa:</span>
              <select
                value={client?.stage || ''}
                disabled={isUpdatingStage || isLoading}
                onChange={(e) => handleStageChange(e.target.value as PipelineStage)}
                className="text-xs font-bold text-teal-700 bg-transparent border-none focus:ring-0 cursor-pointer py-1 pr-6"
              >
                {PIPELINE_STAGES.map((stg) => (
                  <option key={stg} value={stg} className="text-navy-900 font-normal">
                    {stg}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => client && onEdit(client)}
              title="Editar dados"
              className="p-2 text-slate-600 hover:text-teal-700 hover:bg-slate-200/70 rounded transition-colors"
            >
              <Edit2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => client && onDelete(client)}
              title="Excluir cliente"
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Abas Radix UI */}
        <Tabs.Root
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <Tabs.List className="flex border-b border-slate-200 bg-white px-6">
            <Tabs.Trigger
              value="geral"
              className="py-3 px-4 text-xs font-semibold text-slate-500 hover:text-navy-900 border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 transition-colors flex items-center gap-2"
            >
              <Building2 className="w-4 h-4" />
              <span>Dados Gerais & Histórico</span>
            </Tabs.Trigger>

            <Tabs.Trigger
              value="contratos"
              className="py-3 px-4 text-xs font-semibold text-slate-500 hover:text-navy-900 border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 transition-colors flex items-center gap-2"
            >
              <FileCode2 className="w-4 h-4" />
              <span>Contrato & Arquivos ({contracts.length})</span>
            </Tabs.Trigger>

            <Tabs.Trigger
              value="whatsapp"
              className="py-3 px-4 text-xs font-semibold text-slate-500 hover:text-navy-900 border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 transition-colors flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp</span>
            </Tabs.Trigger>
          </Tabs.List>

          {/* Conteúdo Aba 1: Dados Gerais & Timeline */}
          <Tabs.Content
            value="geral"
            className="flex-1 overflow-y-auto p-6 focus:outline-none bg-slate-50/50"
          >
            {isLoading ? (
              <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                <p className="text-sm">Carregando ficha do cliente...</p>
              </div>
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
                        <span className="text-slate-400 block mb-0.5">Telefone / WhatsApp</span>
                        <div className="flex items-center gap-2 text-slate-800 font-medium font-mono">
                          <Phone className="w-3.5 h-3.5 text-teal-600" />
                          <span>{client.phone ? formatPhoneBR(client.phone) : 'Não informado'}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-400 block mb-0.5">E-mail</span>
                        <div className="flex items-center gap-2 text-slate-800 font-medium">
                          <Mail className="w-3.5 h-3.5 text-teal-600" />
                          <span className="truncate">
                            {client.email || 'Não informado'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-400 block mb-0.5">Responsável pelo Lead</span>
                        <div className="flex items-center gap-2 text-slate-800 font-medium">
                          <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                          <select
                            value={client.ownerId || ''}
                            disabled={isUpdatingOwner}
                            onChange={(e) => handleOwnerChange(e.target.value)}
                            className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:ring-teal-600 w-full"
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
                        <span className="text-slate-400 block mb-0.5">Criado em</span>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
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
                      <MessageSquare className="w-4 h-4 text-teal-600" />
                      <span>Registrar Anotação na Timeline (RF-06)</span>
                    </h4>
                    <form onSubmit={handleAddLog} className="space-y-3">
                      <textarea
                        rows={2}
                        required
                        value={newLogContent}
                        onChange={(e) => setNewLogContent(e.target.value)}
                        placeholder="Escreva uma anotação sobre contato, reunião, proposta ou alinhamento com o cliente..."
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-navy-900"
                      />
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={isSubmittingLog || !newLogContent.trim()}
                          className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-xs"
                        >
                          {isSubmittingLog ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          <span>Registrar Anotação</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Lista da Timeline */}
                  <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center justify-between">
                      <span>Histórico de Interações ({logs.length})</span>
                      <span className="text-[11px] font-normal text-slate-400">
                        Ordenado do mais recente
                      </span>
                    </h4>

                    {logs.length === 0 ? (
                      <div className="py-8 text-center text-slate-400">
                        <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="text-xs font-medium text-slate-600">
                          Nenhuma anotação registrada ainda.
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Use o formulário acima para registrar contatos e reuniões.
                        </p>
                      </div>
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
                                  <span className="text-[10px] text-slate-400">
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
                  Contratos e Anexos Assinados (RF-10 a RF-13)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Gerencie serviços contratados, vigência, valores e anexos de documentos.
                </p>
              </div>
              <button
                onClick={() => {
                  setContractToEdit(null);
                  setIsContractModalOpen(true);
                }}
                className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Contrato</span>
              </button>
            </div>

            {isLoadingContracts ? (
              <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3 bg-white rounded-lg border border-slate-200">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                <p className="text-sm">Carregando contratos...</p>
              </div>
            ) : contracts.length === 0 ? (
              <div className="py-12 text-center bg-white rounded-lg border border-slate-200 p-8">
                <FileCode2 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <h4 className="text-sm font-bold text-navy-900">
                  Nenhum contrato cadastrado para este cliente
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Cadastre o primeiro contrato com modelo de cobrança recorrente ou pontual e anexe o documento assinado.
                </p>
                <button
                  onClick={() => {
                    setContractToEdit(null);
                    setIsContractModalOpen(true);
                  }}
                  className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded inline-flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Cadastrar Primeiro Contrato</span>
                </button>
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
                            <span className="text-xs text-slate-400 block font-medium">
                              {isRecorrente ? 'Mensalidade' : 'Valor Total'}
                            </span>
                            <span className="text-base font-bold text-navy-900 font-mono">
                              {formatCurrencyBRL(ct.valueCents)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setContractToEdit(ct);
                                setIsContractModalOpen(true);
                              }}
                              title="Editar contrato"
                              className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteContract(ct)}
                              title="Excluir contrato"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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
                              <Paperclip className="w-3.5 h-3.5 text-teal-600" />
                              <span>Arquivos Anexos ({ct.files?.length || 0})</span>
                            </h5>
                            <button
                              onClick={() => {
                                setContractForFiles(ct);
                                setIsFilesModalOpen(true);
                              }}
                              className="text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Gerenciar / Anexar</span>
                            </button>
                          </div>

                          {!ct.files || ct.files.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic">
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
                                  <button
                                    onClick={() => handleDownloadFile(file.id, file.originalName)}
                                    title="Baixar arquivo"
                                    className="p-1 text-slate-500 hover:text-teal-700 hover:bg-slate-200 rounded transition-colors flex-shrink-0"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
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

          {/* Conteúdo Aba 3: WhatsApp (Placeholder Fatia 6) */}
          <Tabs.Content
            value="whatsapp"
            className="flex-1 overflow-y-auto p-12 focus:outline-none bg-slate-50/50"
          >
            <div className="max-w-md mx-auto text-center bg-white p-8 rounded-lg border border-slate-200 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-navy-900">
                Central de Mensagens WhatsApp
              </h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Disparo rápido de mensagens pré-preenchidas com modelos de boas-vindas,
                lembrete de vencimento com chave PIX e envio de cobrança via links wa.me.
              </p>
              <div className="mt-5 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Será implementado na Fatia 6</span>
              </div>
            </div>
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
