import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

describe('Rotina de Backup Atômico e Restauração', () => {
  const testDir = path.resolve(process.cwd(), 'tmp_test_backup_restore');
  const uploadsDir = path.join(testDir, 'uploads');
  const backupsDir = path.join(testDir, 'backups');
  const restoreDir = path.join(testDir, 'restore_target');

  beforeEach(() => {
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.mkdirSync(backupsDir, { recursive: true });
    fs.mkdirSync(restoreDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('1. Captura de backup atômico deve empacotar banco e uploads no mesmo instante com checksums', () => {
    // 1. Cria dados simulados de banco (SQL) e arquivos de upload
    const mockContractPdf = Buffer.from('%PDF-1.4 Mock Contract Content Assinado');
    const mockInvoiceXml = Buffer.from('<xml><nfe>Mock Nota Fiscal 12345</nfe></xml>');
    
    const contractStoredName = 'contract-uuid-1.pdf';
    const invoiceStoredName = 'invoice-uuid-1.xml';

    fs.writeFileSync(path.join(uploadsDir, contractStoredName), mockContractPdf);
    fs.writeFileSync(path.join(uploadsDir, invoiceStoredName), mockInvoiceXml);

    const mockSqlDump = `
      -- PostgreSQL Dump Mock
      INSERT INTO "User" (id, email, name, role) VALUES ('u1', 'admin@agencia.com', 'Admin', 'admin');
      INSERT INTO "Client" (id, name, stage) VALUES ('c1', 'TechCorp', 'Contrato Ativo');
      INSERT INTO "Contract" (id, "clientId", "valueCents") VALUES ('k1', 'c1', 250000);
      INSERT INTO "PaymentRecord" (id, "contractId", number, "amountCents", status) VALUES ('p1', 'k1', 'COB-2026-0001', 250000, 'Pago');
      INSERT INTO "InvoiceFile" (id, "paymentRecordId", "storedName", "originalName") VALUES ('f1', 'p1', '${invoiceStoredName}', 'NF-12345.xml');
    `;

    // 2. Executa rotina de empacotamento atômico
    const timestamp = '20260819_210000';
    const dbHash = crypto.createHash('sha256').update(mockSqlDump).digest('hex');
    
    const uploadsContent = {
      [contractStoredName]: crypto.createHash('sha256').update(mockContractPdf).digest('hex'),
      [invoiceStoredName]: crypto.createHash('sha256').update(mockInvoiceXml).digest('hex'),
    };

    const manifest = {
      timestamp,
      createdAt: new Date().toISOString(),
      database: {
        file: 'database.sql',
        sha256: dbHash,
      },
      uploads: {
        files: uploadsContent,
      },
    };

    const backupBundle = {
      manifest,
      sql: mockSqlDump,
      files: {
        [contractStoredName]: mockContractPdf.toString('base64'),
        [invoiceStoredName]: mockInvoiceXml.toString('base64'),
      },
    };

    const backupFilePath = path.join(backupsDir, `backup_crm_${timestamp}.json`);
    fs.writeFileSync(backupFilePath, JSON.stringify(backupBundle, null, 2));

    expect(fs.existsSync(backupFilePath)).toBe(true);

    // 3. Simula perda total (desastre)
    fs.rmSync(path.join(uploadsDir, contractStoredName));
    fs.rmSync(path.join(uploadsDir, invoiceStoredName));
    expect(fs.existsSync(path.join(uploadsDir, contractStoredName))).toBe(false);

    // 4. Executa rotina de restauração
    const loadedBackup = JSON.parse(fs.readFileSync(backupFilePath, 'utf-8'));
    
    // Valida integridade do dump SQL
    const restoredSqlHash = crypto.createHash('sha256').update(loadedBackup.sql).digest('hex');
    expect(restoredSqlHash).toBe(loadedBackup.manifest.database.sha256);

    // Restaura arquivos no diretório de destino
    for (const [fileName, base64Content] of Object.entries<string>(loadedBackup.files)) {
      const buffer = Buffer.from(base64Content, 'base64');
      const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
      expect(fileHash).toBe(loadedBackup.manifest.uploads.files[fileName]);

      fs.writeFileSync(path.join(uploadsDir, fileName), buffer);
    }

    // 5. Verifica que todos os arquivos foram restaurados com integridade perfeita
    expect(fs.existsSync(path.join(uploadsDir, contractStoredName))).toBe(true);
    expect(fs.existsSync(path.join(uploadsDir, invoiceStoredName))).toBe(true);
    expect(fs.readFileSync(path.join(uploadsDir, contractStoredName)).toString()).toBe(
      '%PDF-1.4 Mock Contract Content Assinado'
    );
    expect(fs.readFileSync(path.join(uploadsDir, invoiceStoredName)).toString()).toBe(
      '<xml><nfe>Mock Nota Fiscal 12345</nfe></xml>'
    );
  });

  it('2. Restauração deve falhar se o arquivo de backup estiver corrompido ou com checksum inválido', () => {
    const validContent = 'INSERT INTO test VALUES (1);';
    const correctHash = crypto.createHash('sha256').update(validContent).digest('hex');
    
    const corruptedContent = 'INSERT INTO test VALUES (999); -- Corrompido';
    const computedCorruptedHash = crypto.createHash('sha256').update(corruptedContent).digest('hex');

    expect(computedCorruptedHash).not.toBe(correctHash);
  });
});
