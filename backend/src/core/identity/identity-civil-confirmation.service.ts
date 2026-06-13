// src/core/identity/identity-civil-confirmation.service.ts
// DECISION-0120 — confirmação/trava de identidade civil na camada IDENTITY (auditável,
// append-only). FONTE DE AUTORIDADE da trava civil — substitui as flags de `profiles`
// (que viram projeção/tombstone). NÃO toca Bank.
//
// D2 aviso visto ≠ confirmação civil · D3 confirmação explícita · D4 evento auditável ·
// D5 perfil é projeção · D6 canEditPersonalData/write path derivam DESTA camada.

import { createHash } from 'crypto';
import { runQueryWithTenant } from '@core/database/pool';

interface CivilConfirmationState {
  civilDataConfirmed: boolean;
  canEditCivilData: boolean;
  confirmedAt: string | null;
}

class IdentityCivilConfirmationService {
  /** Resolve global_user_id do usuário (identidade civil é keyed por global_user_id). */
  private async resolveGlobalUserId(tenantId: string, userId: string): Promise<string | null> {
    const row = await runQueryWithTenant<{ global_user_id: string | null }>(
      tenantId,
      `SELECT global_user_id FROM users WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [userId, tenantId]
    );
    return row?.global_user_id ?? null;
  }

  /** Existe confirmação civil VIGENTE para esta identidade no tenant? (autoridade). */
  async hasVigentCivilConfirmation(tenantId: string, globalUserId: string): Promise<boolean> {
    const row = await runQueryWithTenant<{ ok: boolean }>(
      tenantId,
      `SELECT EXISTS (
         SELECT 1 FROM identity_civil_confirmation_events
          WHERE tenant_id = $1 AND global_user_id = $2 AND event_type = 'civil_data_confirmed'
       ) AS ok`,
      [tenantId, globalUserId]
    );
    return row?.ok === true;
  }

  /**
   * AUTORIDADE de edição civil (D6): pode editar dados civis sse NÃO há confirmação civil
   * vigente. Deriva da camada identity — NUNCA de profiles. Sem identidade resolvível ⇒
   * permite editar (primeiro acesso / ausência honesta).
   */
  async canEditCivilData(tenantId: string, userId: string): Promise<boolean> {
    const globalUserId = await this.resolveGlobalUserId(tenantId, userId);
    if (!globalUserId) return true;
    return !(await this.hasVigentCivilConfirmation(tenantId, globalUserId));
  }

  /** Estado derivado projetado ao frontend (civil confirmado + pode editar). */
  async getState(tenantId: string, userId: string): Promise<CivilConfirmationState> {
    const globalUserId = await this.resolveGlobalUserId(tenantId, userId);
    if (!globalUserId) {
      return { civilDataConfirmed: false, canEditCivilData: true, confirmedAt: null };
    }
    const row = await runQueryWithTenant<{ confirmed_at: Date | string }>(
      tenantId,
      `SELECT confirmed_at FROM identity_civil_confirmation_events
        WHERE tenant_id = $1 AND global_user_id = $2 AND event_type = 'civil_data_confirmed'
        ORDER BY confirmed_at ASC LIMIT 1`,
      [tenantId, globalUserId]
    );
    const confirmed = !!row;
    return {
      civilDataConfirmed: confirmed,
      canEditCivilData: !confirmed,
      confirmedAt: row ? (row.confirmed_at instanceof Date ? row.confirmed_at.toISOString() : String(row.confirmed_at)) : null,
    };
  }

  /**
   * Confirmação civil EXPLÍCITA (D3/D4): resolve identity/global/actor server-side, captura
   * snapshot dos campos civis JÁ EXISTENTES (CPF só por hash/parcial — nunca em claro) e grava
   * evento append-only idempotente ("uma confirmação vigente"). Retorna o estado derivado.
   * Exige usuário autenticado (resolvido pela rota). Não grava em profiles como fonte. Zero Bank.
   */
  async confirmCivilData(tenantId: string, userId: string, actorId: string | null): Promise<CivilConfirmationState> {
    const globalUserId = await this.resolveGlobalUserId(tenantId, userId);
    if (!globalUserId) {
      const err = new Error('Usuário não possui identidade civil resolvível') as Error & { statusCode?: number };
      err.statusCode = 400;
      throw err;
    }

    // Snapshot dos campos civis vigentes (o QUE está sendo confirmado).
    const { identityService } = await import('@core/identity/identity.service');
    const globalUser = await identityService.getGlobalIdentity(globalUserId);
    const idRow = await runQueryWithTenant<{ tax_id: string | null }>(
      tenantId,
      `SELECT tax_id FROM identities WHERE global_user_id = $1 LIMIT 1`,
      [globalUserId]
    );
    const taxId = idRow?.tax_id ?? null;
    const birthdate = globalUser?.birthdate
      ? (globalUser.birthdate instanceof Date ? globalUser.birthdate.toISOString().slice(0, 10) : String(globalUser.birthdate).slice(0, 10))
      : null;

    const snapshot: Record<string, unknown> = {
      source: 'explicit_confirmation',
      fullName: globalUser?.fullName ?? null,
      birthdate,
      gender: globalUser?.gender ?? null,
      // CPF NUNCA em claro: hash + últimos 3 dígitos para auditoria.
      taxIdHash: taxId ? createHash('sha256').update(taxId).digest('hex') : null,
      taxIdLast3: taxId ? taxId.replace(/\D/g, '').slice(-3) : null,
    };

    // Append-only idempotente: re-confirmação não duplica nem reescreve.
    await runQueryWithTenant(
      tenantId,
      `INSERT INTO identity_civil_confirmation_events
         (tenant_id, global_user_id, confirmed_by_user_id, actor_id, event_type, event_version, payload_snapshot)
       VALUES ($1, $2, $3, $4, 'civil_data_confirmed', 1, $5::jsonb)
       ON CONFLICT (tenant_id, global_user_id) WHERE event_type = 'civil_data_confirmed' DO NOTHING`,
      [tenantId, globalUserId, userId, actorId, JSON.stringify(snapshot)]
    );

    return this.getState(tenantId, userId);
  }
}

export const identityCivilConfirmationService = new IdentityCivilConfirmationService();
