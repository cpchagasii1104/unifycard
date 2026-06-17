// backend/src/core/referral/actor-referral-code.service.ts
// F-ACTOR-REFERRAL-CODE-SUBSTRATE — DECISION-0139.
// Substrato CANÔNICO do código de indicação POR ACTOR: o código e seus earnings
// pertencem ECONOMICAMENTE ao owner_actor_id (não ao CPF/user por reflexo).
// referral_code = LOOKUP econômico que resolve owner_actor_id; NUNCA authority.
//
// Regras invioláveis (DECISION-0139):
//   - owner_actor_id resolve sempre server-side; nunca de body/metadata/client.
//   - actor_system NUNCA recebe referral_code econômico (fail-closed).
//   - 1 código ativo por actor (partial unique index no banco; idempotente no app).
//   - não guarda valor/percentual/saldo (lookup, não ledger).

import crypto from 'crypto';
import { runQueryWithTenant } from '@core/database/pool';

type TxClient = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

const SYSTEM_ACTOR_TYPES = new Set(['system', 'actor_system']);

function genCandidate(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

class ActorReferralCodeService {
  /**
   * Resolve o DONO ECONÔMICO (owner_actor_id) de um código no substrato canônico
   * `actor_referral_codes`. Server-side, tenant-safe, só código ATIVO. Retorna null
   * se o código não existir no substrato actor-scoped (o caminho de aplicação decide
   * o fallback de compat para códigos legados `users.referral_code`).
   */
  async resolveCodeOwnerActor(tenantId: string, code: string): Promise<string | null> {
    if (!code?.trim()) return null;
    const row = await runQueryWithTenant<{ owner_actor_id: string }>(
      tenantId,
      `SELECT owner_actor_id FROM actor_referral_codes
        WHERE tenant_id = $1 AND UPPER(code) = UPPER($2)
          AND code_status = 'active' AND revoked_at IS NULL
        LIMIT 1`,
      [tenantId, code]
    );
    return row?.owner_actor_id ?? null;
  }

  /** Variante transacional do resolver (usa o client do nascimento/apply). */
  async resolveCodeOwnerActorTx(client: TxClient, tenantId: string, code: string): Promise<string | null> {
    if (!code?.trim()) return null;
    const res = await client.query(
      `SELECT owner_actor_id FROM actor_referral_codes
        WHERE tenant_id = $1 AND UPPER(code) = UPPER($2)
          AND code_status = 'active' AND revoked_at IS NULL
        LIMIT 1`,
      [tenantId, code]
    );
    return (res.rows[0]?.owner_actor_id as string | undefined) ?? null;
  }

  /** Lê o código ATIVO de um actor (display/lookup). */
  async getActiveCodeForActor(tenantId: string, ownerActorId: string): Promise<string | null> {
    if (!ownerActorId?.trim()) return null;
    const row = await runQueryWithTenant<{ code: string }>(
      tenantId,
      `SELECT code FROM actor_referral_codes
        WHERE tenant_id = $1 AND owner_actor_id = $2
          AND code_status = 'active' AND revoked_at IS NULL
        LIMIT 1`,
      [tenantId, ownerActorId]
    );
    return row?.code ?? null;
  }

  /**
   * Resolve o actor_type de um actor para gate de fail-closed (actor_system não recebe código).
   */
  private async getActorType(tenantId: string, actorId: string): Promise<string | null> {
    const row = await runQueryWithTenant<{ actor_type: string }>(
      tenantId,
      `SELECT actor_type FROM actors WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
      [tenantId, actorId]
    );
    return row?.actor_type ?? null;
  }

  /**
   * Provisiona (idempotente) o código de indicação ATIVO de um actor dono.
   * - Fail-closed: actor inexistente ou actor_system ⇒ lança (sem código econômico p/ sistema).
   * - Idempotente: se já existe código ativo, retorna-o (não duplica — partial unique index reforça).
   * - created_by_actor_id = autoria (quem provisionou); NÃO é autoridade atual.
   * AUTORIDADE de criação explícita (gestão de código de actor existente) é responsabilidade
   * do CALLER (rota), que DEVE validar canRepresentActor ANTES de chamar — ver referral.routes.
   */
  async ensureActorReferralCode(
    tenantId: string,
    ownerActorId: string,
    createdByActorId: string,
    createdByUserId?: string | null
  ): Promise<string> {
    if (!ownerActorId?.trim()) throw new Error('ensureActorReferralCode: ownerActorId obrigatório');
    if (!createdByActorId?.trim()) throw new Error('ensureActorReferralCode: createdByActorId obrigatório');

    const actorType = await this.getActorType(tenantId, ownerActorId);
    if (!actorType) {
      throw new Error('ensureActorReferralCode: owner actor inexistente (fail-closed)');
    }
    if (SYSTEM_ACTOR_TYPES.has(actorType)) {
      // DECISION-0139: actor_system NUNCA recebe referral_code econômico.
      throw new Error('ACTOR_SYSTEM_REFERRAL_FORBIDDEN: actor_system não recebe código de indicação econômico');
    }

    const existing = await this.getActiveCodeForActor(tenantId, ownerActorId);
    if (existing) return existing;

    let attempts = 0;
    while (attempts < 10) {
      const candidate = genCandidate();
      try {
        const row = await runQueryWithTenant<{ code: string }>(
          tenantId,
          `INSERT INTO actor_referral_codes
             (tenant_id, owner_actor_id, code, code_status, created_by_actor_id, created_by_user_id)
           VALUES ($1, $2, $3, 'active', $4, $5)
           RETURNING code`,
          [tenantId, ownerActorId, candidate, createdByActorId, createdByUserId ?? null]
        );
        if (row?.code) return row.code;
      } catch (err) {
        // 23505 = colisão de code OU já existe ativo p/ o owner (partial unique). Reler/retry.
        const code = (err as { code?: string })?.code;
        if (code === '23505') {
          const now = await this.getActiveCodeForActor(tenantId, ownerActorId);
          if (now) return now; // outro caminho criou o código ativo do owner — idempotente.
          // senão foi colisão de `code` global: tenta outro candidato.
        } else {
          throw err;
        }
      }
      attempts++;
    }
    throw new Error('ensureActorReferralCode: falha ao gerar código único após múltiplas tentativas');
  }
}

export const actorReferralCodeService = new ActorReferralCodeService();
