import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { env } from '../env.js';

// Garante que o diretório de uploads existe
const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR || './uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  contract: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ],
  invoice: ['application/pdf', 'application/xml', 'text/xml'],
};

export const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  contract: ['.pdf', '.docx', '.doc'],
  invoice: ['.pdf', '.xml'],
};

// Storage com nome em disco gerado por UUID
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const storedName = `${crypto.randomUUID()}${ext}`;
    cb(null, storedName);
  },
});

// Filtro de arquivo por tipo e extensão
const fileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();

  const isAllowedExt =
    ALLOWED_EXTENSIONS.contract.includes(ext) || ALLOWED_EXTENSIONS.invoice.includes(ext);
  const isAllowedMime =
    ALLOWED_MIME_TYPES.contract.includes(mime) || ALLOWED_MIME_TYPES.invoice.includes(mime);

  if (isAllowedExt && isAllowedMime) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Tipo de arquivo não permitido. Apenas arquivos PDF, DOCX/DOC (contratos) e PDF/XML (notas fiscais) são aceitos.'
      )
    );
  }
};

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
  fileFilter,
});
