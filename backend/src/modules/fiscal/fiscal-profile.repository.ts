// backend/src/modules/fiscal/fiscal-profile.repository.ts
// DECISION-0166 D9 — Fase 4b: leitor/escritor da casa canônica actor_fiscal_profiles.
//
// Rito de escrita = o MESMO da policy (F1-a): nasce DRAFT → ativa (draft→active); ativa é
// imutável no banco (trigger); mudar regime = nova versão. Ativar uma versão DEPRECIA a
// ativa anterior da mesma identidade fiscal (transição permitida) — uma ativa por vez.
// Leitura ausente = null (FISCAL_CONFIG_MISSING no chamador) — nunca regime inventado.

import { runQueryWithTenant, getClientWithTenant } from '@core/database/pool';
import type { CreateFiscalProfileInput, FiscalProfile, TaxRegime } from './fiscal-profile.types';
import { TAX_REGIMES } from './fiscal-profile.types';

interface Row {
  id: string;
  tenant_id: string;
  fiscal_identity_id: string;
  actor_id: string | null;
  tax_regime: string;
  status: string;
  version: number;
  effective_from: Date;
  effective_until: Date | null;
  configured_by_actor_id: string | null;
  source: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

function toProfile(row: Row): FiscalProfile {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    fiscalIdentityId: row.fiscal_identity_id,
    actorId: row.actor_id,
    taxRegime: row.tax_regime as TaxRegime,
    status: row.status as FiscalProfile['status'],
    version: row.version,
    effectiveFrom: row.effective_from.toISOString(),
    effectiveUntil: row.effective_until ? row.effective_until.toISOString() : null,
    configuredByActorId: row.configured_by_actor_id,
    source: row.source,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
  };
}

const SELECT_COLS = `id, tenant_id, fiscal_identity_id, actor_id, tax_regime, status, version,
       effective_from, effective_until, configured_by_actor_id, source, metadata, created_at`;

class FiscalProfileRepository {
  /**
   * Perfil fiscal ATIVO e vigente do tenant (via companies → fiscal_identity quando não há
   * fiscal_identity explícita). null = FISCAL_CONFIG_MISSING — o chamador decide alertar/
   * bloquear; NUNCA inventar regime.
   */
  async getActiveProfileForTenant(tenantId: string): Promise<FiscalProfile | null> {
    const row = await runQueryWithTenant<Row>(
      tenantId,
      `SELECT ${SELECT_COLS}
         FROM actor_fiscal_profiles
        WHERE tenant_id = $1::uuid AND status = 'active'
          AND effective_from <= NOW()
          AND (effective_until IS NULL OR effective_until > NOW())
        ORDER BY version DESC
        LIMIT 1`,
      [tenantId]
    );
    return row ? toProfile(row) : null;
  }

  async getActiveProfileForFiscalIdentity(
    tenantId: string,
    fiscalIdentityId: string
  ): Promise<FiscalProfile | null> {
    const row = await runQueryWithTenant<Row>(
      tenantId,
      `SELECT ${SELECT_COLS}
         FROM actor_fiscal_profiles
        WHERE tenant_id = $1::uuid AND fiscal_identity_id = $2::uuid AND status = 'active'
          AND effective_from <= NOW()
          AND (effective_until IS NULL OR effective_until > NOW())
        ORDER BY version DESC
        LIMIT 1`,
      [tenantId, fiscalIdentityId]
    );
    return row ? toProfile(row) : null;
  }

  /** Cria DRAFT (rito F1-a: nada nasce ativo). Regime validado contra o vocabulário canônico. */
  async createDraftProfile(input: CreateFiscalProfileInput): Promise<FiscalProfile> {
    if (!TAX_REGIMES.includes(input.taxRegime)) {
      throw new Error(
        `TAX_REGIME_INVALID: '${input.taxRegime}' fora do vocabulário canônico (${TAX_REGIMES.join(', ')}) — D9.5.`
      );
    }
    const next = await runQueryWithTenant<{ v: number }>(
      input.tenantId,
      `SELECT COALESCE(MAX(version), 0) + 1 AS v
         FROM actor_fiscal_profiles
        WHERE tenant_id = $1::uuid AND fiscal_identity_id = $2::uuid`,
      [input.tenantId, input.fiscalIdentityId]
    );
    const row = await runQueryWithTenant<Row>(
      input.tenantId,
      `INSERT INTO actor_fiscal_profiles
         (tenant_id, fiscal_identity_id, actor_id, tax_regime, status, version,
          effective_from, configured_by_actor_id, source, metadata)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, 'draft', $5,
               COALESCE($6, NOW()), $7::uuid, $8, $9::jsonb)
       RETURNING ${SELECT_COLS}`,
      [
        input.tenantId,
        input.fiscalIdentityId,
        input.actorId ?? null,
        input.taxRegime,
        next?.v ?? 1,
        input.effectiveFrom ?? null,
        input.configuredByActorId ?? null,
        input.source ?? null,
        JSON.stringify(input.metadata ?? {}),
      ]
    );
    if (!row) throw new Error('createDraftProfile: insert failed');
    return toProfile(row);
  }

  /**
   * Ativa um DRAFT e DEPRECIA a versão ativa anterior da mesma identidade fiscal (transições
   * permitidas pelo trigger: draft→active e active→deprecated). Atômico.
   */
  async activateProfile(tenantId: string, profileId: string): Promise<void> {
    const client = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');
      const target = await client.query<{ fiscal_identity_id: string }>(
        `SELECT fiscal_identity_id FROM actor_fiscal_profiles
          WHERE tenant_id = $1::uuid AND id = $2::uuid AND status = 'draft' LIMIT 1`,
        [tenantId, profileId]
      );
      if (target.rows.length === 0) {
        throw new Error('FISCAL_PROFILE_NOT_DRAFT: só draft pode ser ativado (mudança = nova versão).');
      }
      await client.query(
        `UPDATE actor_fiscal_profiles SET status = 'deprecated'
          WHERE tenant_id = $1::uuid AND fiscal_identity_id = $2::uuid AND status = 'active'`,
        [tenantId, target.rows[0].fiscal_identity_id]
      );
      await client.query(
        `UPDATE actor_fiscal_profiles SET status = 'active'
          WHERE tenant_id = $1::uuid AND id = $2::uuid AND status = 'draft'`,
        [tenantId, profileId]
      );
      await client.query('COMMIT');
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch { /* noop */ }
      throw e;
    } finally {
      client.release();
    }
  }
}

export const fiscalProfileRepository = new FiscalProfileRepository();
