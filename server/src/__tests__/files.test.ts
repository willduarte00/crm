import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { app } from '../app.js';
import { prisma } from '../prisma.js';
import { env } from '../env.js';

vi.mock('../prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    client: {
      findFirst: vi.fn(),
    },
    contract: {
      findFirst: vi.fn(),
    },
    contractFile: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    invoiceFile: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    paymentRecord: {
      findUnique: vi.fn(),
    },
  },
}));

describe('Arquivos e Uploads — Testes de Integração (RF-12, Seção 6.2 e 6.4)', () => {
  const activeUser = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'admin@agencia.com',
    name: 'Admin Teste',
    active: true,
    mustChangePassword: false,
    tokenVersion: 0,
    groups: [
      {
        group: {
          id: 'admin-group',
          name: 'Admin',
          permissions: [
            'contract_files.view',
            'contract_files.create',
            'contract_files.delete',
            'invoices.view',
            'invoices.create',
            'invoices.delete'
          ],
        },
      },
    ],
  };

  const testContract = {
    id: '44444444-4444-4444-4444-444444444444',
    clientId: '33333333-3333-3333-3333-333333333333',
    serviceType: 'Tráfego Pago',
    billingType: 'recorrente',
    valueCents: 200000,
    deletedAt: null,
  };

  const createToken = (user: { id: string; tokenVersion: number }) =>
    jwt.sign({ id: user.id, tokenVersion: user.tokenVersion }, env.JWT_SECRET, {
      expiresIn: '7d',
    });

  const tempPdfPath = path.resolve(process.cwd(), 'temp_test_contrato.pdf');
  const tempExePath = path.resolve(process.cwd(), 'temp_test_malicious.exe');

  beforeEach(() => {
    vi.clearAllMocks();
    if (!fs.existsSync(tempPdfPath)) {
      fs.writeFileSync(tempPdfPath, '%PDF-1.4 Test PDF Content for Contract');
    }
    if (!fs.existsSync(tempExePath)) {
      fs.writeFileSync(tempExePath, 'MZ fake executable content');
    }
  });

  afterAll(() => {
    if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
    if (fs.existsSync(tempExePath)) fs.unlinkSync(tempExePath);
  });

  it('1. GET /api/files/:id sem cookie deve retornar 401 (Seção 6.2)', async () => {
    const res = await request(app).get('/api/files/fake-id-123');
    expect(res.status).toBe(401);
  });

  it('2. POST /api/files sem cookie deve retornar 401 (Seção 6.2)', async () => {
    const res = await request(app)
      .post('/api/files')
      .send({ contractId: testContract.id });

    expect(res.status).toBe(401);
  });

  it('3. Deve fazer upload de PDF anexado a contrato e salvar registro (RF-12)', async () => {
    const token = createToken(activeUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser as any);
    vi.mocked(prisma.contract.findFirst).mockResolvedValue(testContract as any);
    vi.mocked(prisma.contractFile.create).mockImplementation(async ({ data }: any) => ({
      id: 'file-123',
      contractId: data.contractId,
      storedName: data.storedName,
      originalName: data.originalName,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      uploadedAt: new Date(),
    }));

    const res = await request(app)
      .post('/api/files')
      .set('Cookie', [`token=${token}`])
      .field('contractId', testContract.id)
      .attach('file', tempPdfPath);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('file-123');
    expect(res.body.contractId).toBe(testContract.id);
    expect(res.body.originalName).toBe('temp_test_contrato.pdf');
    expect(res.body.mimeType).toBe('application/pdf');
    expect(prisma.contractFile.create).toHaveBeenCalled();
  });

  it('4. Deve rejeitar upload de arquivo não permitido pela whitelist (ex: .exe) com 400', async () => {
    const token = createToken(activeUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser as any);
    vi.mocked(prisma.contract.findFirst).mockResolvedValue(testContract as any);

    const res = await request(app)
      .post('/api/files')
      .set('Cookie', [`token=${token}`])
      .field('contractId', testContract.id)
      .attach('file', tempExePath);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('não permitido');
  });

  it('5. Download autenticado deve entregar o arquivo com header Content-Disposition preservando o nome original', async () => {
    const token = createToken(activeUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser as any);

    // Salva arquivo físico simulado na pasta de uploads
    const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR || './uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const storedFileName = 'test-stored-file.pdf';
    const physicalFilePath = path.resolve(uploadDir, storedFileName);
    fs.writeFileSync(physicalFilePath, '%PDF-1.4 Mock Download Content');

    vi.mocked(prisma.contractFile.findUnique).mockResolvedValue({
      id: 'file-123',
      contractId: testContract.id,
      storedName: storedFileName,
      originalName: 'Contrato_Assinado_Cliente.pdf',
      fileSize: Buffer.byteLength('%PDF-1.4 Mock Download Content'),
      mimeType: 'application/pdf',
      uploadedAt: new Date(),
    });

    const res = await request(app)
      .get('/api/files/file-123')
      .set('Cookie', [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toBe('application/pdf');
    expect(res.header['content-disposition']).toContain('Contrato_Assinado_Cliente.pdf');
    const content = res.text || res.body?.toString() || '';
    expect(content).toContain('%PDF-1.4 Mock Download Content');

    // Limpa arquivo de teste
    if (fs.existsSync(physicalFilePath)) fs.unlinkSync(physicalFilePath);
  });

  it('6. DELETE /api/files/:id deve remover o registro no banco e o arquivo físico do disco', async () => {
    const token = createToken(activeUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser as any);

    const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR || './uploads');
    const storedFileName = 'to-delete-file.pdf';
    const physicalFilePath = path.resolve(uploadDir, storedFileName);
    fs.writeFileSync(physicalFilePath, 'Content to delete');

    vi.mocked(prisma.contractFile.findUnique).mockResolvedValue({
      id: 'file-to-delete',
      contractId: testContract.id,
      storedName: storedFileName,
      originalName: 'Contrato_Velho.pdf',
      fileSize: 17,
      mimeType: 'application/pdf',
      uploadedAt: new Date(),
    });
    vi.mocked(prisma.contractFile.delete).mockResolvedValue({} as any);

    const res = await request(app)
      .delete('/api/files/file-to-delete')
      .set('Cookie', [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prisma.contractFile.delete).toHaveBeenCalledWith({
      where: { id: 'file-to-delete' },
    });
    expect(fs.existsSync(physicalFilePath)).toBe(false);
  });
});
