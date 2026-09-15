import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../prisma.js';
import { env } from '../env.js';
import {
  uploadMiddleware,
  uploadLogoMiddleware,
  sniffFileKind,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
} from '../middlewares/upload.js';
import { requirePermission, assertPermission } from '../middlewares/requirePermission.js';
import { Permission } from '../domain/permissions.js';

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

const handleUploadLogo = (req: Request, res: Response, next: NextFunction) => {
  uploadLogoMiddleware.single('file')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Arquivo excede o tamanho máximo permitido de 2 MB.' });
      }
      return res.status(400).json({ error: err.message || 'Erro no upload do arquivo.' });
    }
    return next();
  });
};

const setFileResponseHeaders = (res: Response, { inline, isPublic }: { inline?: boolean, isPublic?: boolean } = {}) => {
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', isPublic ? 'public, max-age=3600' : 'private, no-store');
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
    if (contractId) {
      try {
        assertPermission(req, 'contract_files.create');
      } catch (err) {
        await fs.promises.unlink(req.file.path).catch(() => {});
        throw err;
      }
    } else if (paymentRecordId) {
      try {
        assertPermission(req, 'invoices.create');
      } catch (err) {
        await fs.promises.unlink(req.file.path).catch(() => {});
        throw err;
      }
    }

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

      return res.status(201).json({
        id: contractFile.id,
        contractId: contractFile.contractId,
        originalName: contractFile.originalName,
        fileSize: contractFile.fileSize,
        mimeType: contractFile.mimeType,
        uploadedAt: contractFile.uploadedAt,
      });
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

      return res.status(201).json({
        id: invoiceFile.id,
        paymentRecordId: invoiceFile.paymentRecordId,
        originalName: invoiceFile.originalName,
        fileSize: invoiceFile.fileSize,
        mimeType: invoiceFile.mimeType,
        uploadedAt: invoiceFile.uploadedAt,
      });
    }
  } catch (error) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    return res.status(500).json({ error: 'Erro ao processar e salvar o arquivo.' });
  }
});

// POST /api/files/logo - Upload de logotipo da agência
filesRouter.post('/logo', requirePermission('settings.update'), handleUploadLogo, async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }

  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const mime = req.file.mimetype.toLowerCase();
    const sniffKind = await sniffFileKind(req.file.path);
    
    const extToKind: Record<string, string[]> = {
      '.png': ['png'],
      '.jpg': ['jpeg'],
      '.jpeg': ['jpeg'],
      '.webp': ['webp']
    };

    if (!extToKind[ext] || !extToKind[ext].includes(sniffKind as string)) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: 'Conteúdo do arquivo não corresponde ao formato declarado.' });
    }

    const isValidLogo =
      ALLOWED_EXTENSIONS.logo.includes(ext) &&
      ALLOWED_MIME_TYPES.logo.includes(mime);

    if (!isValidLogo) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({
        error: 'Formato inválido. Envie uma imagem válida (jpg, png, webp, svg, gif).',
      });
    }

    // Apenas retornamos a URL/nome, o front-end salva em Settings
    return res.status(201).json({
      url: `/api/files/public/${req.file.filename}`
    });
  } catch (error) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    return res.status(500).json({ error: 'Erro ao processar o logotipo.' });
  }
});

// GET /api/files/public/:filename - Leitura pública para arquivos genéricos (ex: logo)
filesRouter.get('/public/:filename', (req: Request, res: Response) => {
  const { filename } = req.params;
  
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|webp)$/i.test(filename)) {
    return res.status(404).json({ error: 'Arquivo não encontrado.' });
  }

  const logoDir = path.resolve(uploadDir, 'logo');
  const filePath = path.resolve(logoDir, filename);

  if (!filePath.startsWith(logoDir + path.sep)) {
    return res.status(404).json({ error: 'Arquivo não encontrado.' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Arquivo não encontrado.' });
  }

  setFileResponseHeaders(res, { isPublic: true });
  res.sendFile(filePath);
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

  let fileType: 'contract' | 'invoice' | null = null;
  if (fileRecord) {
    fileType = 'contract';
  } else {
    // Se não encontrou, busca em InvoiceFile
    fileRecord = await prisma.invoiceFile.findUnique({
      where: { id },
      select: {
        storedName: true,
        originalName: true,
        mimeType: true,
        fileSize: true,
      },
    });
    if (fileRecord) {
      fileType = 'invoice';
    }
  }

  if (!fileRecord) {
    return res.status(404).json({ error: 'Arquivo não encontrado.' });
  }

  if (fileType === 'contract') {
    assertPermission(req, 'contract_files.view');
  } else if (fileType === 'invoice') {
    assertPermission(req, 'invoices.view');
  }

  const filePath = path.resolve(uploadDir, fileRecord.storedName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Arquivo físico não encontrado no servidor.' });
  }

  // Previne path traversal
  if (!filePath.startsWith(uploadDir + path.sep)) {
    return res.status(403).json({ error: 'Acesso não autorizado ao caminho do arquivo.' });
  }

  // Define Content-Disposition com nome original seguro
  const requestedInline = req.query.inline === 'true';
  const isPdf = fileRecord.mimeType === 'application/pdf';
  const inline = requestedInline && isPdf;
  const dispositionType = inline ? 'inline' : 'attachment';

  const ext = path.extname(fileRecord.storedName).toLowerCase();
  const extToMime: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.xml': 'application/xml',
  };
  const derivedMimeType = extToMime[ext] || 'application/octet-stream';

  setFileResponseHeaders(res, { inline, isPublic: false });
  res.setHeader('Content-Type', derivedMimeType);
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

  const invoiceFile = !contractFile
    ? await prisma.invoiceFile.findUnique({ where: { id } })
    : null;

  if (!contractFile && !invoiceFile) {
    return res.status(404).json({ error: 'Arquivo não encontrado.' });
  }

  if (contractFile) {
    assertPermission(req, 'contract_files.delete');

    await prisma.contractFile.delete({
      where: { id },
    });

    const filePath = path.resolve(uploadDir, contractFile.storedName);
    if (filePath.startsWith(uploadDir + path.sep)) {
      await fs.promises.unlink(filePath).catch(() => {});
    }

    return res.json({ success: true, message: 'Arquivo de contrato excluído com sucesso.' });
  }

  if (invoiceFile) {
    assertPermission(req, 'invoices.delete');

    await prisma.invoiceFile.delete({
      where: { id },
    });

    const filePath = path.resolve(uploadDir, invoiceFile.storedName);
    if (filePath.startsWith(uploadDir + path.sep)) {
      await fs.promises.unlink(filePath).catch(() => {});
    }

    return res.json({ success: true, message: 'Arquivo de nota fiscal excluído com sucesso.' });
  }

  return res.status(404).json({ error: 'Arquivo não encontrado.' });
});
