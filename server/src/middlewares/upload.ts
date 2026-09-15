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
  logo: ['image/jpeg', 'image/png', 'image/webp'],
};

export const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  contract: ['.pdf', '.docx', '.doc'],
  invoice: ['.pdf', '.xml'],
  logo: ['.jpg', '.jpeg', '.png', '.webp'],
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
    ALLOWED_EXTENSIONS.contract.includes(ext) ||
    ALLOWED_EXTENSIONS.invoice.includes(ext) ||
    ALLOWED_EXTENSIONS.logo.includes(ext);

  const isAllowedMime =
    ALLOWED_MIME_TYPES.contract.includes(mime) ||
    ALLOWED_MIME_TYPES.invoice.includes(mime) ||
    ALLOWED_MIME_TYPES.logo.includes(mime);

  if (isAllowedExt && isAllowedMime) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Tipo de arquivo não permitido. Apenas arquivos suportados são aceitos.'
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

export const uploadLogoMiddleware = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB
  },
  fileFilter,
});

export const sniffFileKind = async (filePath: string): Promise<'png'|'jpeg'|'webp'|'pdf'|'zip'|'doc'|'xml'|null> => {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(12);
    const { bytesRead } = await handle.read(buffer, 0, 12, 0);
    if (bytesRead === 0) return null;

    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
        buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A) {
      return 'png';
    }
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return 'jpeg';
    }
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      return 'webp';
    }
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46 && buffer[4] === 0x2D) {
      return 'pdf';
    }
    if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
      return 'zip';
    }
    if (buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0) {
      return 'doc';
    }
    
    const str = buffer.toString('utf-8');
    const trimmed = str.replace(/^\uFEFF/, '').trimStart();
    if (trimmed.startsWith('<')) {
      return 'xml';
    }
    return null;
  } finally {
    await handle.close();
  }
};

