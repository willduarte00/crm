import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../prisma.js';
import { env } from '../env.js';
import {
  uploadMiddleware,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
} from '../middlewares/upload.js';

export const filesRouter = Router();

const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR || './uploads');

// Middleware para capturar erros do Multer
const handleUpload = (req: Request, res: Response, next: NextFunction) => {
  uploadMiddleware.single('file')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Arquivo excede o tamanho máximo permitido de 10 MB.' });
      }
      return res.status(400).json({ error: err.message || 'Erro no upload do arquivo.' });
    }
    return next();
  });
};

// POST /api/files - Upload de arquivo vinculado a contrato ou cobrança
filesRouter.post('/', handleUpload, async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }

  const { contractId, paymentRecordId } = req.body;

  if (!contractId && !paymentRecordId) {
    // Remove o arquivo físico se não foi informado o vínculo
    await fs.promises.unlink(req.file.path).catch(() => {});
    return res.status(400).json({
      error: 'É necessário informar contractId ou paymentRecordId para vincular o arquivo.',
    });
  }

  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const mime = req.file.mimetype.toLowerCase();

    if (contractId) {
      // Valida vínculo de contrato
      const contract = await prisma.contract.findFirst({
        where: { id: contractId, deletedAt: null },
      });

      if (!contract) {
        await fs.promises.unlink(req.file.path).catch(() => {});
        return res.status(404).json({ error: 'Contrato não encontrado ou excluído.' });
      }

      const isValidContractFile =
        ALLOWED_EXTENSIONS.contract.includes(ext) &&
        ALLOWED_MIME_TYPES.contract.includes(mime);

      if (!isValidContractFile) {
        await fs.promises.unlink(req.file.path).catch(() => {});
        return res.status(400).json({
          error: 'Formato inválido para contrato. Apenas arquivos PDF e DOCX/DOC são aceitos.',
        });
      }

      const contractFile = await prisma.contractFile.create({
        data: {
          contractId,
          storedName: req.file.filename,
          originalName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
        },
      });

      return res.status(201).json(contractFile);
    }

    if (paymentRecordId) {
      // Valida vínculo de cobrança / NF
      const paymentRecord = await prisma.paymentRecord.findUnique({
        where: { id: paymentRecordId },
      });

      if (!paymentRecord) {
        await fs.promises.unlink(req.file.path).catch(() => {});
        return res.status(404).json({ error: 'Cobrança não encontrada.' });
      }

      const isValidInvoiceFile =
        ALLOWED_EXTENSIONS.invoice.includes(ext) &&
        ALLOWED_MIME_TYPES.invoice.includes(mime);

      if (!isValidInvoiceFile) {
        await fs.promises.unlink(req.file.path).catch(() => {});
        return res.status(400).json({
          error: 'Formato inválido para nota fiscal. Apenas arquivos PDF e XML são aceitos.',
        });
      }

      const invoiceFile = await prisma.invoiceFile.create({
        data: {
          paymentRecordId,
          storedName: req.file.filename,
          originalName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
        },
      });

      return res.status(201).json(invoiceFile);
    }
  } catch (error) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    return res.status(500).json({ error: 'Erro ao processar e salvar o arquivo.' });
  }
});

// GET /api/files/:id - Download autenticado com streaming e Content-Disposition
filesRouter.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  // Busca em ContractFile
  let fileRecord: {
    storedName: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
  } | null = await prisma.contractFile.findUnique({
    where: { id },
    select: {
      storedName: true,
      originalName: true,
      mimeType: true,
      fileSize: true,
    },
  });

  // Se não encontrou, busca em InvoiceFile
  if (!fileRecord) {
    fileRecord = await prisma.invoiceFile.findUnique({
      where: { id },
      select: {
        storedName: true,
        originalName: true,
        mimeType: true,
        fileSize: true,
      },
    });
  }

  if (!fileRecord) {
    return res.status(404).json({ error: 'Arquivo não encontrado.' });
  }

  const filePath = path.resolve(uploadDir, fileRecord.storedName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Arquivo físico não encontrado no servidor.' });
  }

  // Previne path traversal
  if (!filePath.startsWith(uploadDir)) {
    return res.status(403).json({ error: 'Acesso não autorizado ao caminho do arquivo.' });
  }

  // Define Content-Disposition com nome original seguro
  const inline = req.query.inline === 'true';
  const dispositionType = inline ? 'inline' : 'attachment';

  res.setHeader('Content-Type', fileRecord.mimeType || 'application/octet-stream');
  res.setHeader('Content-Length', fileRecord.fileSize.toString());
  res.setHeader(
    'Content-Disposition',
    `${dispositionType}; filename="${encodeURIComponent(fileRecord.originalName)}"; filename*=UTF-8''${encodeURIComponent(fileRecord.originalName)}`
  );

  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});

// DELETE /api/files/:id - Exclusão de registro e arquivo físico
filesRouter.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  // Verifica se é ContractFile
  const contractFile = await prisma.contractFile.findUnique({
    where: { id },
  });

  if (contractFile) {
    await prisma.contractFile.delete({
      where: { id },
    });

    const filePath = path.resolve(uploadDir, contractFile.storedName);
    await fs.promises.unlink(filePath).catch(() => {});

    return res.json({ success: true, message: 'Arquivo de contrato excluído com sucesso.' });
  }

  // Verifica se é InvoiceFile
  const invoiceFile = await prisma.invoiceFile.findUnique({
    where: { id },
  });

  if (invoiceFile) {
    await prisma.invoiceFile.delete({
      where: { id },
    });

    const filePath = path.resolve(uploadDir, invoiceFile.storedName);
    await fs.promises.unlink(filePath).catch(() => {});

    return res.json({ success: true, message: 'Arquivo de nota fiscal excluído com sucesso.' });
  }

  return res.status(404).json({ error: 'Arquivo não encontrado.' });
});
