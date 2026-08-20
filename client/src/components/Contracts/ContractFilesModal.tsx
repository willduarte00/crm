import React, { useState, useRef } from 'react';
import { Contract, ContractFile } from '../../types/contract';
import { apiFetch } from '../../services/api';
import { formatDateTimeBR, formatFileSize } from '../../utils/formatters';
import {
  X,
  FileText,
  Upload,
  Download,
  Trash2,
  Paperclip,
  FileCode2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface ContractFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract | null;
  onFilesUpdated: () => void;
}

export const ContractFilesModal: React.FC<ContractFilesModalProps> = ({
  isOpen,
  onClose,
  contract,
  onFilesUpdated,
}) => {
  const [files, setFiles] = useState<ContractFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (contract) {
      setFiles(contract.files || []);
      setError(null);
    }
  }, [contract]);

  if (!isOpen || !contract) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setError(null);

    // Validações no cliente (10MB e extensão)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('O arquivo excede o limite máximo de 10 MB.');
      toast.error('Arquivo muito grande (máx 10 MB).');
      return;
    }

    const validExtensions = ['.pdf', '.docx', '.doc'];
    const hasValidExt = validExtensions.some((ext) =>
      selectedFile.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidExt) {
      setError('Formato inválido. Apenas arquivos PDF e Word (.docx, .doc) são aceitos para contratos.');
      toast.error('Formato não aceito para contrato.');
      return;
    }

    const formData = new FormData();
    formData.append('contractId', contract.id);
    formData.append('file', selectedFile);

    try {
      setIsUploading(true);
      const res = await fetch('/api/files', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao realizar upload do arquivo.');
      }

      const newFile: ContractFile = await res.json();
      setFiles((prev) => [newFile, ...prev]);
      toast.success('Documento anexado com sucesso!');
      onFilesUpdated();

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      setError(err.message || 'Falha no upload.');
      toast.error(err.message || 'Erro ao enviar arquivo.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (file: ContractFile) => {
    try {
      const res = await fetch(`/api/files/${file.id}`);
      if (!res.ok) {
        throw new Error('Não foi possível baixar o arquivo.');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.originalName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.message || 'Erro no download');
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Deseja realmente excluir este arquivo anexo? O arquivo físico será removido.')) {
      return;
    }

    try {
      setIsDeleting(fileId);
      await apiFetch(`/api/files/${fileId}`, {
        method: 'DELETE',
      });
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      toast.success('Arquivo excluído com sucesso.');
      onFilesUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir arquivo.');
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-lg border border-slate-200 shadow-xl overflow-hidden my-6 animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-teal-600/10 text-teal-700 flex items-center justify-center font-bold">
              <Paperclip className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-navy-900">
                Arquivos do Contrato — {contract.serviceType}
              </h3>
              <p className="text-xs text-slate-500">
                Anexe o contrato assinado, aditivos e termos vinculados (PDF/DOCX, máx 10 MB)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Área de Upload */}
          <div className="border-2 border-dashed border-slate-200 hover:border-teal-500 rounded-lg p-6 text-center transition-colors bg-slate-50/50">
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="hidden"
              id="contract-file-input"
            />
            <label
              htmlFor="contract-file-input"
              className="cursor-pointer flex flex-col items-center justify-center gap-2"
            >
              <div className="w-10 h-10 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100 shadow-xs">
                {isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Upload className="w-5 h-5" />
                )}
              </div>
              <p className="text-xs font-bold text-navy-900">
                {isUploading ? 'Enviando documento...' : 'Clique para selecionar ou arraste o arquivo aqui'}
              </p>
              <p className="text-[11px] text-slate-400">
                Suporta documentos em formato <strong>PDF</strong> ou <strong>DOCX/DOC</strong> de até 10 MB.
              </p>
            </label>
          </div>

          {/* Lista de Arquivos Anexos */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Documentos Anexados ({files.length})</span>
              <span className="text-[11px] font-normal text-slate-400">
                Múltiplos anexos permitidos (RF-12)
              </span>
            </h4>

            {files.length === 0 ? (
              <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-lg border border-slate-100">
                <FileCode2 className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                <p className="text-xs text-slate-600 font-medium">
                  Nenhum arquivo anexado a este contrato ainda.
                </p>
                <p className="text-[11px] text-slate-400">
                  Faça o upload do contrato assinado ou aditivos no formulário acima.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-teal-400 transition-colors shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded bg-rose-50 text-rose-600 flex items-center justify-center font-bold flex-shrink-0 border border-rose-100">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-navy-900 truncate" title={file.originalName}>
                          {file.originalName}
                        </p>
                        <p className="text-[11px] text-slate-400 flex items-center gap-2">
                          <span>{formatFileSize(file.fileSize)}</span>
                          <span>•</span>
                          <span>Enviado em {formatDateTimeBR(file.uploadedAt)}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleDownload(file)}
                        title="Baixar arquivo"
                        className="p-1.5 text-slate-600 hover:text-teal-700 hover:bg-slate-100 rounded transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteFile(file.id)}
                        disabled={isDeleting === file.id}
                        title="Excluir anexo"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors disabled:opacity-50"
                      >
                        {isDeleting === file.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-medium rounded transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
