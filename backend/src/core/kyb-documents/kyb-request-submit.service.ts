// backend/src/core/kyb-documents/kyb-request-submit.service.ts
// CP2 F-PJ-HUMAN-TO-COMPANY-END-TO-END-CLOSURE (PJ-B1): submissão USER-FACING do pedido de
// análise KYB pelo responsável da empresa, fechando o elo upload → "enviar para análise".
//
// GO §3.1 (decisão diretorial congelada): pode submeter quem REPRESENTA a empresa — vínculo
// company_users ATIVO com canManageCompany — com os documentos mínimos MATERIALMENTE enviados.
// O fundador NÃO revisa/aprova/revoga (review segue humano/institucional, admin-only em
// /identity/pj/kyb/admin/*). submitted_by_actor_id é AUTH-DERIVED (actor humano do usuário
// autenticado, resolvido por LEITURA — PJ-B3: nenhuma cura de actor neste caminho).
//
// O writer da request continua ÚNICO (fiscalIdentityKybService.submitFiscalKybRequest);
// este serviço só orquestra autoridade + pré-condições documentais e mapeia erros HTTP.

import { runQueryWithTenant, pool } from '@core/database/pool';
import { socialPortsRegistry } from '@core/social/ports-registry';
import { companiesService } from '@core/companies/companies.service';
import { fiscalIdentityKybService, type FiscalKybRequest } from '@core/identity/fiscal-identity-kyb.service';

export class KybRequestSubmitError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'KybRequestSubmitError';
  }
}

const REQUIRED_DOCUMENT_TYPES = ['cnpj_registration', 'articles_of_association'] as const;

export interface SubmitCompanyKybRequestInput {
  tenantId: string;
  companyId: string;
  /** Identidade do usuário autenticado (gate de autoridade da empresa). */
  globalUserId: string;
  /** userId autenticado — resolve o actor humano AUTH-DERIVED por LEITURA (nunca de input). */
  userId: string;
  reason?: string;
}

export async function submitCompanyKybRequest(input: SubmitCompanyKybRequestInput): Promise<FiscalKybRequest> {
  const { tenantId, companyId, globalUserId, userId, reason } = input;
  if (!tenantId || !companyId || !globalUserId || !userId) {
    throw new KybRequestSubmitError(400, 'KYB_REQUEST_BAD_REQUEST', 'tenantId, companyId, globalUserId e userId são obrigatórios.');
  }

  // ── 1. AUTORIA auth-derived por LEITURA (PJ-B3: sem cura de actor) ────────────
  const actor = await socialPortsRegistry.getActorRepository().findByUserId(tenantId, userId);
  if (!actor?.actor_id) {
    throw new KybRequestSubmitError(403, 'KYB_REQUEST_ACTOR_UNRESOLVED', 'Actor humano do usuário autenticado não existe (nascimento C1 é o caminho canônico).');
  }

  // ── 2. company → fiscal_identity_id (tenant-scoped) ──────────────────────────
  const company = await runQueryWithTenant<{ fiscal_identity_id: string | null }>(
    tenantId,
    `SELECT fiscal_identity_id::text AS fiscal_identity_id FROM companies WHERE company_id = $1::uuid AND tenant_id = $2 LIMIT 1`,
    [companyId, tenantId],
  );
  if (!company) {
    throw new KybRequestSubmitError(404, 'KYB_REQUEST_COMPANY_NOT_FOUND', `Empresa ${companyId} não encontrada no tenant.`);
  }
  if (!company.fiscal_identity_id) {
    throw new KybRequestSubmitError(422, 'KYB_REQUEST_FISCAL_IDENTITY_MISSING', 'Empresa sem identidade fiscal — não é possível pedir análise KYB.');
  }
  const fiscalIdentityId = company.fiscal_identity_id;

  // ── 3. AUTORIDADE sobre a empresa (posse de companyId não basta) ─────────────
  const canManage = await companiesService.canManageCompany(tenantId, companyId, globalUserId);
  if (!canManage) {
    throw new KybRequestSubmitError(403, 'KYB_REQUEST_FORBIDDEN', 'Sem autoridade (canManageCompany) para enviar esta empresa para análise.');
  }

  // ── 4. PRÉ-CONDIÇÃO documental: tipos mínimos MATERIALMENTE enviados ─────────
  //     (submitted ou accepted; rejected/superseded não contam). A ACEITAÇÃO segue
  //     sendo do reviewer; aqui só se exige que o lastro exista antes de pedir análise.
  const docs = await pool.query<{ document_type: string }>(
    `SELECT DISTINCT document_type FROM fiscal_identity_documents
      WHERE fiscal_identity_id = $1::uuid
        AND document_status IN ('submitted','accepted')
        AND document_type = ANY($2::text[])`,
    [fiscalIdentityId, [...REQUIRED_DOCUMENT_TYPES]],
  );
  const have = new Set(docs.rows.map((r) => r.document_type));
  const missing = REQUIRED_DOCUMENT_TYPES.filter((t) => !have.has(t));
  if (missing.length > 0) {
    throw new KybRequestSubmitError(
      422,
      'KYB_REQUEST_REQUIRES_DOCUMENTS',
      `Documentos obrigatórios ausentes para pedir análise: [${missing.join(', ')}]. Envie-os antes de submeter.`,
    );
  }

  // ── 5. WRITER ÚNICO da request (1 pending por fiscal garantido no writer/índice) ─
  try {
    return await fiscalIdentityKybService.submitFiscalKybRequest(fiscalIdentityId, actor.actor_id, reason);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/FISCAL_IDENTITY_HAS_PENDING_KYB/.test(msg)) {
      throw new KybRequestSubmitError(409, 'KYB_REQUEST_ALREADY_PENDING', 'Já existe um pedido de análise pendente para esta empresa.');
    }
    if (/FISCAL_IDENTITY_NOT_PENDING/.test(msg)) {
      throw new KybRequestSubmitError(409, 'KYB_REQUEST_NOT_SUBMITTABLE', msg);
    }
    throw err;
  }
}

export interface CompanyKybStatusView {
  fiscalIdentityId: string;
  kybStatus: string;
  requests: Array<{
    kybRequestId: string;
    status: string;
    submittedAt: string | null;
    reviewedAt: string | null;
    decisionReason: string | null;
  }>;
  documents: Array<{
    documentId: string;
    documentType: string;
    documentStatus: string;
    decisionReason: string | null;
    createdAt: string | null;
  }>;
}

/**
 * Status KYB da empresa para o RESPONSÁVEL (leitura pura, membership-scoped — PJ-B4).
 * Não expõe file_reference/paths; não muda estado; ausência honesta (404/422).
 */
export async function getCompanyKybStatus(input: {
  tenantId: string;
  companyId: string;
  globalUserId: string;
}): Promise<CompanyKybStatusView> {
  const { tenantId, companyId, globalUserId } = input;

  const company = await runQueryWithTenant<{ fiscal_identity_id: string | null }>(
    tenantId,
    `SELECT c.fiscal_identity_id::text AS fiscal_identity_id
       FROM companies c
      WHERE c.company_id = $1::uuid AND c.tenant_id = $2
        AND EXISTS (
          SELECT 1 FROM company_users cu
           WHERE cu.tenant_id = c.tenant_id AND cu.company_id = c.company_id
             AND cu.global_user_id = $3::uuid AND cu.is_active = true AND cu.member_status = 'active')
      LIMIT 1`,
    [companyId, tenantId, globalUserId],
  );
  if (!company) {
    throw new KybRequestSubmitError(404, 'KYB_STATUS_COMPANY_NOT_FOUND', 'Empresa não encontrada (ou sem vínculo ativo).');
  }
  if (!company.fiscal_identity_id) {
    throw new KybRequestSubmitError(422, 'KYB_STATUS_FISCAL_IDENTITY_MISSING', 'Empresa sem identidade fiscal.');
  }
  const fiscalIdentityId = company.fiscal_identity_id;

  const fi = await pool.query<{ kyb_status: string }>(
    `SELECT kyb_status FROM fiscal_identities WHERE fiscal_identity_id = $1::uuid LIMIT 1`,
    [fiscalIdentityId],
  );
  const requests = await pool.query<{ kyb_request_id: string; status: string; created_at: Date | null; reviewed_at: Date | null; decision_reason: string | null }>(
    `SELECT kyb_request_id::text, status, created_at, reviewed_at, decision_reason
       FROM fiscal_identity_kyb_requests
      WHERE fiscal_identity_id = $1::uuid
      ORDER BY created_at DESC`,
    [fiscalIdentityId],
  );
  const documents = await pool.query<{ document_id: string; document_type: string; document_status: string; decision_reason: string | null; created_at: Date | null }>(
    `SELECT document_id::text, document_type, document_status, decision_reason, created_at
       FROM fiscal_identity_documents
      WHERE fiscal_identity_id = $1::uuid
      ORDER BY created_at DESC`,
    [fiscalIdentityId],
  );

  const iso = (v: Date | null): string | null => (v ? v.toISOString() : null);
  return {
    fiscalIdentityId,
    kybStatus: fi.rows[0]?.kyb_status ?? 'pending',
    requests: requests.rows.map((r) => ({
      kybRequestId: r.kyb_request_id,
      status: r.status,
      submittedAt: iso(r.created_at),
      reviewedAt: iso(r.reviewed_at),
      decisionReason: r.decision_reason,
    })),
    documents: documents.rows.map((d) => ({
      documentId: d.document_id,
      documentType: d.document_type,
      documentStatus: d.document_status,
      decisionReason: d.decision_reason,
      createdAt: iso(d.created_at),
    })),
  };
}
