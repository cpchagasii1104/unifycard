// src/core/companies/company-publications.service.ts
// Writer soberano de PUBLICAÇÃO/OFERTA da empresa PJ (DECISION-0099/0100).
//
// Publicar != ativar (DECISION-0099 D1): ativar grava o que a empresa É (companies.primary_*);
// publicar grava em company_concept_publications que a empresa pode ser encontrada/consumida por
// um concept. SSOT = company_concept_publications (company/page-actor×concept). Esta fatia NÃO
// atualiza tenant_concept_offerings (read-model/projeção é frente própria — DECISION-0100 D10) nem
// toca marketplace/discovery/Bank.
//
// Gates (DECISION-0100): autoridade contextual (company_users via canManageCompany) + KYB approved
// (helper focado authority-decision) + empresa operacional (primary_* not null) + concept ===
// primary_concept_id. Reversível (retire) e auditável (created_by/retired_by/published_at/retired_at).

import { runQueryWithTenant, getClientWithTenant } from '@core/database/pool';
import { HttpError } from '@core/errors/http-error';
import { ensureUserActor } from '@modules/identity/actor-writer.service';
import { authorityDecisionService } from '@core/compliance/authority-decision.service';
import { companiesService } from './companies.service';

function pubError(code: string, message: string, statusCode: number): HttpError {
  const err = new HttpError(`${code}: ${message}`, statusCode);
  (err as unknown as { code: string }).code = code;
  return err;
}

type CompanyRow = {
  company_id: string;
  primary_company_type_id: string | null;
  primary_concept_id: string | null;
};

/**
 * Pré-condições comuns de publish/retire: autoridade contextual + empresa existente.
 * NÃO valida KYB/operacional (publish exige; retire não) — isso fica em cada writer.
 */
async function loadCompanyForAuthority(
  tenantId: string,
  companyId: string,
  globalUserId: string
): Promise<CompanyRow> {
  const canManage = await companiesService.canManageCompany(tenantId, companyId, globalUserId);
  if (!canManage) {
    throw pubError('PUBLICATION_FORBIDDEN', 'Sem autoridade para publicar/despublicar esta empresa', 403);
  }
  const company = await runQueryWithTenant<CompanyRow>(
    tenantId,
    `SELECT company_id, primary_company_type_id, primary_concept_id
       FROM companies WHERE company_id = $1 AND tenant_id = $2 LIMIT 1`,
    [companyId, tenantId]
  );
  if (!company) {
    throw pubError('COMPANY_NOT_FOUND', `Empresa ${companyId} não encontrada no tenant`, 404);
  }
  return company;
}

/** page-actor da empresa (eixo operacional, DECISION-0097 D7). NÃO cria; deve existir pós-ativação. */
async function resolvePageActorId(tenantId: string, companyId: string): Promise<string> {
  const pageActor = await runQueryWithTenant<{ id: string }>(
    tenantId,
    `SELECT id FROM actors WHERE tenant_id = $1 AND company_id = $2 AND actor_type = 'page' LIMIT 1`,
    [tenantId, companyId]
  );
  if (!pageActor?.id) {
    throw pubError('PAGE_ACTOR_MISSING', `page-actor da empresa ${companyId} ausente (empresa não ativada)`, 409);
  }
  return pageActor.id;
}

export const companyPublicationsService = {
  /**
   * Publica a empresa para um concept (MVP: concept === companies.primary_concept_id).
   * Idempotente: publicação active já existente → 200 alreadyPublished=true (sem duplicar).
   */
  async publishCompanyConcept(input: {
    tenantId: string;
    companyId: string;
    responsibleUserId: string; // users.user_id do chamador autenticado
    globalUserId: string;      // company_users.global_user_id do chamador
    conceptId: string;
    source?: string;
    intent?: string;
  }): Promise<{
    publicationId: string;
    companyId: string;
    pageActorId: string;
    conceptId: string;
    status: 'active';
    publishedAt: string;
    alreadyPublished: boolean;
  }> {
    const { tenantId, companyId, responsibleUserId, globalUserId, conceptId } = input;
    const source = input.source?.trim() || 'manual';
    const intent = input.intent?.trim() || null;

    // ── Autoridade + empresa ─────────────────────────────────────────────────
    const company = await loadCompanyForAuthority(tenantId, companyId, globalUserId);

    // ── Empresa operacional (par preenchido) ─────────────────────────────────
    if (company.primary_company_type_id === null || company.primary_concept_id === null) {
      throw pubError('COMPANY_NOT_OPERATIONAL', `Empresa ${companyId} não está operacionalmente ativada`, 409);
    }

    // ── Concept = primary_concept_id (MVP — DECISION-0100 D4) ─────────────────
    if (conceptId !== company.primary_concept_id) {
      throw pubError('CONCEPT_NOT_ACTIVATED', 'conceptId deve ser o primary_concept_id da empresa', 400);
    }

    // ── Page-actor + KYB approved ────────────────────────────────────────────
    const pageActorId = await resolvePageActorId(tenantId, companyId);
    const kyb = await authorityDecisionService.evaluatePageActorKybApproved(tenantId, pageActorId);
    if (!kyb.approved) {
      throw pubError('KYB_NOT_APPROVED', `Publicação exige KYB approved (${kyb.reason})`, 409);
    }

    // ── Actor humano de auditoria (resolvido backend-side; NÃO do frontend) ───
    const humanActor = await ensureUserActor(tenantId, responsibleUserId);
    if (!humanActor?.actor_id) {
      throw pubError('RESPONSIBLE_ACTOR_NOT_FOUND', `actor humano (user ${responsibleUserId}) não resolvido`, 404);
    }

    // ── Transação: lock da publicação active + idempotência/insert ───────────
    const client = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');
      const existing = await client.query<{ id: string; published_at: string }>(
        `SELECT id, published_at::text AS published_at
           FROM company_concept_publications
          WHERE company_id = $1 AND concept_id = $2 AND status = 'active'
          FOR UPDATE`,
        [companyId, conceptId]
      );
      if ((existing.rowCount ?? 0) > 0) {
        await client.query('COMMIT');
        return {
          publicationId: existing.rows[0].id,
          companyId,
          pageActorId,
          conceptId,
          status: 'active',
          publishedAt: existing.rows[0].published_at,
          alreadyPublished: true,
        };
      }
      const ins = await client.query<{ id: string; published_at: string }>(
        `INSERT INTO company_concept_publications
           (tenant_id, company_id, page_actor_id, concept_id, status, created_by_actor_id, source, intent)
         VALUES ($1, $2, $3, $4, 'active', $5, $6, $7)
         RETURNING id, published_at::text AS published_at`,
        [tenantId, companyId, pageActorId, conceptId, humanActor.actor_id, source, intent]
      );
      await client.query('COMMIT');
      return {
        publicationId: ins.rows[0].id,
        companyId,
        pageActorId,
        conceptId,
        status: 'active',
        publishedAt: ins.rows[0].published_at,
        alreadyPublished: false,
      };
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch { /* best-effort */ }
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Despublica (retira) a publicação active da empresa para um concept. NÃO exige KYB (retração é
   * sempre permitida com autoridade). Idempotente: sem publicação active → 200 alreadyRetired=true.
   * Isolamento por empresa: o WHERE fixa company_id (não afeta outra empresa do tenant/concept).
   */
  async retireCompanyConceptPublication(input: {
    tenantId: string;
    companyId: string;
    responsibleUserId: string;
    globalUserId: string;
    conceptId: string;
  }): Promise<{
    publicationId: string | null;
    companyId: string;
    conceptId: string;
    status: 'retired';
    retiredAt: string | null;
    alreadyRetired: boolean;
  }> {
    const { tenantId, companyId, responsibleUserId, globalUserId, conceptId } = input;

    // ── Autoridade + empresa (sem gate KYB no retire) ────────────────────────
    await loadCompanyForAuthority(tenantId, companyId, globalUserId);

    const humanActor = await ensureUserActor(tenantId, responsibleUserId);
    if (!humanActor?.actor_id) {
      throw pubError('RESPONSIBLE_ACTOR_NOT_FOUND', `actor humano (user ${responsibleUserId}) não resolvido`, 404);
    }

    const client = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');
      const active = await client.query<{ id: string }>(
        `SELECT id FROM company_concept_publications
          WHERE company_id = $1 AND concept_id = $2 AND status = 'active'
          FOR UPDATE`,
        [companyId, conceptId]
      );
      if ((active.rowCount ?? 0) === 0) {
        await client.query('COMMIT');
        return { publicationId: null, companyId, conceptId, status: 'retired', retiredAt: null, alreadyRetired: true };
      }
      const upd = await client.query<{ id: string; retired_at: string }>(
        `UPDATE company_concept_publications
            SET status = 'retired', retired_at = now(), retired_by_actor_id = $1, updated_at = now()
          WHERE id = $2
          RETURNING id, retired_at::text AS retired_at`,
        [humanActor.actor_id, active.rows[0].id]
      );
      await client.query('COMMIT');
      return {
        publicationId: upd.rows[0].id,
        companyId,
        conceptId,
        status: 'retired',
        retiredAt: upd.rows[0].retired_at,
        alreadyRetired: false,
      };
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch { /* best-effort */ }
      throw err;
    } finally {
      client.release();
    }
  },
};
