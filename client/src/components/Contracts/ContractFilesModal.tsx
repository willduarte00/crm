import React, { useState, useRef, useEffect } from 'react';
import { Contract, ContractFile } from '../../types/contract';
import { apiFetch, apiDownload, errorMessage } from '../../services/api';
import { formatDateTimeBR, formatFileSize } from '../../utils/formatters';
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Paperclip,
  FileCode2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '../ui/Modal';
import { Button, IconButton } from '../ui/Button';
import { FormAlert } from '../ui/States';
import { useConfirm } from '../ui/ConfirmDialog';

interface ContractFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract | null;
  onFilesUpdated: () => void;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const VALID_EXTENSIONS = ['.pdf', '.docx', '.doc'];

export const ContractFilesModal: React.FC<ContractFilesModalProps> = ({
  isOpen,
  onClose,
  contract,
  onFilesUpdated,
}) => {
  const confirm = useConfirm();

  const [files, setFiles] = useState<ContractFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (contract) {
      setFiles(contract.files || []);
      setError(null);
    }
  }, [contract]);

  if (!contract) return null;

  const resetInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setError(null);

    if (selectedFile.size > MAX_FILE_BYTES) {
      setError(
        `“${selectedFile.name}” tem ${formatFileSize(
          selectedFile.size
        )}. O limite por arquivo é 10 MB.`
      );
      resetInput();
      return;
    }

    const hasValidExt = VALID_EXTENSIONS.some((ext) =>
      selectedFile.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidExt) {
      setError('Envie um arquivo PDF ou Word (.doc, .docx).');
      resetInput();
      return;
    }

    const formData = new FormData();
    formData.append('contractId', contract.id);
    formData.append('file', selectedFile);

    try {
      setIsUploading(true);
      // apiFetch em vez de fetch cru: mantém o tratamento de sessão expirada
      // e impede que a resposta bruta do servidor vá para a tela.
      const newFile = await apiFetch<ContractFile>('/api/files', {
        method: 'POST',
        body: formData,
      });
      setFiles((prev) => [newFile, ...prev]);
      toast.success('Documento anexado.');
      onFilesUpdated();
      resetInput();
    } catch (err) {
      const message = errorMessage(err, 'Não foi possível enviar o arquivo.');
      setError(message);
      toast.error(message);
      resetInput();
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (file: ContractFile) => {
    if (downloadingId) return;
    try {
      setDownloadingId(file.id);
      await apiDownload(`/api/files/${file.id}`, file.originalName);
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível baixar o arquivo.'));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDeleteFile = async (file: ContractFile) => {
    if (isDeleting) return;

    const confirmed = await confirm({
      title: 'Excluir anexo',
      tone: 'danger',
      confirmLabel: 'Excluir anexo',
      message: (
        <>
          O arquivo <strong className="text-navy-900">{file.originalName}</strong> será
          removido do contrato e apagado do servidor. Esta ação não pode ser desfeita.
        </>
      ),
    });
    if (!confirmed) return;

    try {
      setIsDeleting(file.id);
      await apiFetch(`/api/files/${file.id}`, { method: 'DELETE' });
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      toast.success('Anexo excluído.');
      onFilesUpdated();
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível excluir o anexo.'));
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Arquivos — ${contract.serviceType}`}
      description="Contrato assinado, aditivos e termos vinculados. PDF ou Word, até 10 MB por arquivo."
      icon={<Paperclip className="w-5 h-5" aria-hidden="true" />}
      size="lg"
      dismissOnOverlayClick
      footer={
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {error && <FormAlert>{error}</FormAlert>}

        {/* Área de upload */}
        <div className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-lg p-6 text-center transition-colors bg-slate-50/60">
          <input
            type="file"
            ref={fileInputRef}
            accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="sr-only"
            id="contract-file-input"
          />
          <label
            htmlFor="contract-file-input"
            className="cursor-pointer flex flex-col items-center justify-center gap-2"
          >
            <div
              className="w-10 h-10 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100"
              aria-hidden="true"
            >
              {isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
            </div>
            <span className="text-sm font-bold text-navy-900">
              {isUploading ? 'Enviando documento…' : 'Selecionar arquivo'}
            </span>
            <span className="text-[11px] text-slate-500">
              PDF, DOC ou DOCX, até 10 MB.
            </span>
          </label>
        </div>

        {/* Lista de anexos */}
        <div>
          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
            Documentos anexados ({files.length})
          </h3>

          {files.length === 0 ? (
            <div className="py-8 px-4 text-center bg-slate-50 rounded-lg border border-slate-200">
              <FileCode2
                className="w-8 h-8 mx-auto mb-2 text-slate-400"
                aria-hidden="true"
              />
              <p className="text-sm text-slate-700 font-medium">
                Nenhum arquivo anexado ainda
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Envie o contrato assinado ou aditivos usando o campo acima.
              </p>
            </div>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {files.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:border-teal-400 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0 border border-slate-200"
                      aria-hidden="true"
                    >
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-xs font-bold text-navy-900 truncate"
                        title={file.originalName}
                      >
                        {file.originalName}
                      </p>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                        <span>{formatFileSize(file.fileSize)}</span>
                        <span aria-hidden="true">•</span>
                        <span>Enviado em {formatDateTimeBR(file.uploadedAt)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <IconButton
                      label={`Baixar ${file.originalName}`}
                      onClick={() => handleDownload(file)}
                      isLoading={downloadingId === file.id}
                    >
                      <Download className="w-4 h-4" aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      label={`Excluir ${file.originalName}`}
                      tone="danger"
                      onClick={() => handleDeleteFile(file)}
                      isLoading={isDeleting === file.id}
                      disabled={isDeleting !== null}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
};
