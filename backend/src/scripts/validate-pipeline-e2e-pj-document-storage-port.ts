/**
 * E2E — F-PJ-DOCUMENT-STORAGE-PORT (DECISION-0112)
 *
 * Prova o substrato técnico mínimo de storage documental KYB (port + provider local-dev privado),
 * SEM upload user-facing, SEM wizard, SEM KYB approval, SEM Bank, SEM tocar fiscal_identity_documents.
 *
 *   T1  store → blob em diretório PRIVADO, FORA de /uploads
 *   T2  fileReference é OPACO (32 hex; sem path, sem '..')
 *   T3  SHA-256 retornado bate com o conteúdo
 *   T4  mimeType retornado bate com o input validado
 *   T5  sizeBytes retornado bate com o conteúdo
 *   T6  MIME fora da allowlist é rejeitado
 *   T7  arquivo vazio é rejeitado
 *   T8  arquivo acima do limite é rejeitado
 *   T9  originalFilename com '../' NÃO controla path (ref segue opaco; blob no dir privado)
 *   T10 readDocument(ref) recupera o conteúdo correto
 *   T11 readDocument com referência inválida/inexistente falha fechado
 *   T12 produção sem provider explícito falha fechado (DOCUMENT_STORAGE_PROVIDER_REQUIRED)
 *   T13 nada é criado dentro de /uploads (blobPath não está sob uploads)
 *   T14 factory em dev retorna LocalPrivateDocumentStorageProvider
 *   T15 (estrutural) os fontes do port NÃO tocam DB/Bank/SSOT/lifecycle
 *        (sem pool/bank_/company_status/kyb_status/fiscal_identity_documents/INSERT/UPDATE/@fastify/static)
 *
 * Pure filesystem — não usa banco. Roda: npx tsx backend/src/scripts/validate-pipeline-e2e-pj-document-storage-port.ts
 */

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

import { LocalPrivateDocumentStorageProvider } from '../core/document-storage/local-private-document-storage.provider';
import { resolveDocumentStorageProvider } from '../core/document-storage/document-storage.provider';
import { DOC_STORAGE_ERR, DOCUMENT_STORAGE_MAX_BYTES } from '../core/document-storage/document-storage.types';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}

async function expectErr(label: string, fn: () => Promise<unknown>, code: string): Promise<void> {
  let got = '';
  try { await fn(); } catch (e) { got = (e as { code?: string }).code ?? (e as Error).message; }
  record(label, got === code, `code=${got}`);
}

async function main(): Promise<void> {
  const e2eDir = path.join(process.cwd(), '.private', 'document-storage-e2e');
  const uploadsDir = path.resolve(path.join(process.cwd(), 'uploads'));
  await fs.rm(e2eDir, { recursive: true, force: true });

  const provider = new LocalPrivateDocumentStorageProvider(e2eDir);
  const pdf = Buffer.from('%PDF-1.4 conteudo de teste KYB ' + 'x'.repeat(500), 'utf8');
  const sha = createHash('sha256').update(pdf).digest('hex');

  try {
    // T1..T5, T13 — store feliz
    const stored = await provider.storeDocument({ tenantId: 'tenant-e2e', buffer: pdf, mimeType: 'application/pdf', originalFilename: 'cartao_cnpj.pdf' });
    const blobPath = path.join(e2eDir, stored.fileReference);
    const blobExists = await fs.stat(blobPath).then(() => true).catch(() => false);
    record('T1 store grava blob no dir PRIVADO, fora de /uploads', blobExists && !path.resolve(blobPath).startsWith(uploadsDir + path.sep), `blob=${blobExists}`);
    record('T2 fileReference OPACO (32 hex, sem path/..)', /^[0-9a-f]{32}$/.test(stored.fileReference), stored.fileReference);
    record('T3 SHA-256 bate com o conteúdo', stored.fileHash === sha, `got=${stored.fileHash.slice(0, 12)}`);
    record('T4 mimeType bate', stored.mimeType === 'application/pdf', stored.mimeType);
    record('T5 sizeBytes bate', stored.sizeBytes === pdf.length, `${stored.sizeBytes} vs ${pdf.length}`);
    record('T13 nada criado sob /uploads', !path.resolve(blobPath).startsWith(uploadsDir + path.sep));

    // T6 MIME fora da allowlist
    await expectErr('T6 MIME não permitido rejeitado', () => provider.storeDocument({ tenantId: 't', buffer: pdf, mimeType: 'application/x-msdownload' }), DOC_STORAGE_ERR.MIME_NOT_ALLOWED);
    // T7 vazio
    await expectErr('T7 arquivo vazio rejeitado', () => provider.storeDocument({ tenantId: 't', buffer: Buffer.alloc(0), mimeType: 'application/pdf' }), DOC_STORAGE_ERR.EMPTY_FILE);
    // T8 acima do limite
    await expectErr('T8 arquivo acima do limite rejeitado', () => provider.storeDocument({ tenantId: 't', buffer: Buffer.alloc(DOCUMENT_STORAGE_MAX_BYTES + 1), mimeType: 'application/pdf' }), DOC_STORAGE_ERR.TOO_LARGE);

    // T9 filename malicioso não controla path
    const evil = await provider.storeDocument({ tenantId: 't', buffer: pdf, mimeType: 'image/png', originalFilename: '../../../etc/passwd' });
    const evilOpaque = /^[0-9a-f]{32}$/.test(evil.fileReference);
    const evilBlob = path.join(e2eDir, evil.fileReference);
    const evilInsidePrivate = path.resolve(evilBlob).startsWith(path.resolve(e2eDir) + path.sep);
    const passwdLeak = await fs.stat(path.join(process.cwd(), '.private', 'etc', 'passwd')).then(() => true).catch(() => false);
    record('T9 originalFilename "../" NÃO controla path', evilOpaque && evilInsidePrivate && !passwdLeak, `opaque=${evilOpaque} insidePrivate=${evilInsidePrivate} leak=${passwdLeak}`);

    // T10 read recupera
    const read = await provider.readDocument(stored.fileReference);
    record('T10 readDocument recupera conteúdo correto', read.buffer.equals(pdf) && read.fileHash === sha && read.mimeType === 'application/pdf' && read.sizeBytes === pdf.length);

    // T11 read inválido/inexistente fail-closed
    await expectErr('T11a readDocument path-traversal rejeitado', () => provider.readDocument('../etc/passwd'), DOC_STORAGE_ERR.INVALID_REFERENCE);
    await expectErr('T11b readDocument formato inválido rejeitado', () => provider.readDocument('NAO-OPACO'), DOC_STORAGE_ERR.INVALID_REFERENCE);
    await expectErr('T11c readDocument inexistente NOT_FOUND', () => provider.readDocument('ffffffffffffffffffffffffffffffff'), DOC_STORAGE_ERR.NOT_FOUND);

    // T12 produção sem provider = fail-closed
    const prevEnv = process.env.NODE_ENV;
    const prevProv = process.env.DOCUMENT_STORAGE_PROVIDER;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.DOCUMENT_STORAGE_PROVIDER;
      let prodCode = '';
      try { resolveDocumentStorageProvider(); } catch (e) { prodCode = (e as { code?: string }).code ?? ''; }
      let localProdCode = '';
      process.env.DOCUMENT_STORAGE_PROVIDER = 'local';
      try { resolveDocumentStorageProvider(); } catch (e) { localProdCode = (e as { code?: string }).code ?? ''; }
      record('T12 produção sem provider explícito falha fechado', prodCode === DOC_STORAGE_ERR.PROVIDER_REQUIRED && localProdCode === DOC_STORAGE_ERR.PROVIDER_REQUIRED, `noProv=${prodCode} local=${localProdCode}`);
    } finally {
      if (prevEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prevEnv;
      if (prevProv === undefined) delete process.env.DOCUMENT_STORAGE_PROVIDER; else process.env.DOCUMENT_STORAGE_PROVIDER = prevProv;
    }

    // T14 factory dev → LocalPrivate
    const devProvider = resolveDocumentStorageProvider();
    record('T14 factory em dev retorna LocalPrivateDocumentStorageProvider', devProvider instanceof LocalPrivateDocumentStorageProvider);

    // T15 estrutural — fontes do port não tocam DB/Bank/SSOT/lifecycle
    const srcFiles = [
      'src/core/document-storage/document-storage.types.ts',
      'src/core/document-storage/document-storage.port.ts',
      'src/core/document-storage/local-private-document-storage.provider.ts',
      'src/core/document-storage/document-storage.provider.ts',
    ];
    const forbidden = ['pool', 'bank_', 'company_status', 'kyb_status', 'fiscal_identity_documents', 'INSERT', 'UPDATE', '@fastify/static'];
    let structuralOk = true;
    const hits: string[] = [];
    const stripComments = (s: string): string =>
      s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''); // os comentários explicam fronteiras; checamos só o CÓDIGO
    for (const f of srcFiles) {
      const code = stripComments(await fs.readFile(path.join(process.cwd(), f), 'utf8'));
      for (const tok of forbidden) {
        if (code.includes(tok)) { structuralOk = false; hits.push(`${path.basename(f)}:${tok}`); }
      }
    }
    record('T15 fontes do port NÃO tocam DB/Bank/SSOT/lifecycle (código, sem comentários)', structuralOk, hits.join(', '));
  } finally {
    await fs.rm(e2eDir, { recursive: true, force: true });
    console.log('  🧹 cleanup: .private/document-storage-e2e removido');
  }

  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log('\n' + '═'.repeat(60));
  console.log(`RESULTADO: ${passed}/${total} verdes`);
  if (passed === total) console.log('✨ DocumentStoragePort + provider local-dev privado — verde.');
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => { console.error('💥', e); process.exit(1); });
