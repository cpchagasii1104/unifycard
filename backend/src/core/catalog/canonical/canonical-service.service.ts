// canonical-service.service.ts
// DECISION-0117 D — serviço canônico: identidade material COMPARTILHADA do
// significado de serviço. concept_id OBRIGATÓRIO (Lei 7); atributos-base
// governados (ex.: duração-base); SEM preço empresarial; SEM agenda empresarial.
// global ∪ scoped (contrato 2B). Empresa SUGERE (pending_curation); curador
// humano ativa. Merge por redirect (G). Trilha append-only.

import { pool } from '../../database/pool';
import { insertCatalogEvent } from './canonical-variant.service';
import { normalizeForIdentity } from './catalog-identity';
import { resolveConceptsFromSearchTerm } from '../../semantic/semantic.adapter';

export class CanonicalServiceError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'CanonicalServiceError';
  }
}

export interface CanonicalService {
  id: string;
  tenantId: string | null;
  scope: string;
  conceptId: string;
  name: string;
  slug: string;
  description: string | null;
  baseDurationMinutes: number | null;
  attributes: Record<string, unknown>;
  status: string;
  duplicateOfCanonicalServiceId: string | null;
  createdByActorId: string | null;
}

interface CsRow {
  id: string;
  tenant_id: string | null;
  scope: string;
  concept_id: string;
  name: string;
  slug: string;
  description: string | null;
  base_duration_minutes: number | null;
  attributes: unknown;
  status: string;
  duplicate_of_canonical_service_id: string | null;
  created_by_actor_id: string | null;
}

const CS_SELECT =
  'id, tenant_id, scope, concept_id, name, slug, description, base_duration_minutes, ' +
  'attributes, status, duplicate_of_canonical_service_id, created_by_actor_id';

function toCanonicalService(row: CsRow): CanonicalService {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    scope: row.scope,
    conceptId: row.concept_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    baseDurationMinutes: row.base_duration_minutes,
    attributes:
      row.attributes && typeof row.attributes === 'object' && !Array.isArray(row.attributes)
        ? (row.attributes as Record<string, unknown>)
        : {},
    status: row.status,
    duplicateOfCanonicalServiceId: row.duplicate_of_canonical_service_id,
    createdByActorId: row.created_by_actor_id,
  };
}

function slugify(name: string): string {
  return normalizeForIdentity(name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Visibilidade 2B: global (tenant NULL) ∪ scoped do tenant do contexto. */
const CS_VISIBLE = `((cs.scope = 'global' AND cs.tenant_id IS NULL) OR (cs.scope = 'scoped' AND cs.tenant_id = $1::uuid))`;

export const canonicalServiceService = {
  async findById(canonicalServiceId: string): Promise<CanonicalService | null> {
    const r = await pool.query<CsRow>(
      `SELECT ${CS_SELECT} FROM canonical_services WHERE id = $1::uuid LIMIT 1`,
      [canonicalServiceId]
    );
    return r.rows[0] ? toCanonicalService(r.rows[0]) : null;
  },

  /** Resolve redirect de merge até o vencedor (máx. 5 saltos, loop-safe). */
  async resolveRedirect(canonicalServiceId: string): Promise<CanonicalService | null> {
    let current = await this.findById(canonicalServiceId);
    const seen = new Set<string>();
    let hops = 0;
    while (current?.duplicateOfCanonicalServiceId && hops < 5 && !seen.has(current.id)) {
      seen.add(current.id);
      const next = await this.findById(current.duplicateOfCanonicalServiceId);
      if (!next) break;
      current = next;
      hops += 1;
    }
    return current;
  },

  /**
   * Identidade ATIVA visível para o tenant (uso comercial — writer de services
   * e ofertas). Resolve redirect; exige status='active'. Fail-closed.
   */
  async requireActiveForTenant(tenantId: string, canonicalServiceId: string): Promise<CanonicalService> {
    const resolved = await this.resolveRedirect(canonicalServiceId);
    if (!resolved) {
      throw new CanonicalServiceError(404, 'CANONICAL_SERVICE_NOT_FOUND', 'Serviço canônico inexistente.');
    }
    const visible =
      (resolved.scope === 'global' && resolved.tenantId === null) ||
      (resolved.scope === 'scoped' && resolved.tenantId === tenantId);
    if (!visible) {
      throw new CanonicalServiceError(404, 'CANONICAL_SERVICE_NOT_VISIBLE', 'Serviço canônico fora do escopo do tenant.');
    }
    if (resolved.status !== 'active') {
      throw new CanonicalServiceError(
        422,
        'CANONICAL_SERVICE_NOT_ACTIVE',
        'Serviço canônico ainda não curado/ativo — oferta bloqueada (DECISION-0117 D, fail-closed).'
      );
    }
    return resolved;
  },

  async searchVisible(tenantId: string, query?: string): Promise<CanonicalService[]> {
    const q = String(query ?? '').trim();
    const r = await pool.query<CsRow>(
      `SELECT ${CS_SELECT} FROM canonical_services cs
        WHERE ${CS_VISIBLE} AND cs.status = 'active'
          ${q ? `AND LOWER(cs.name) LIKE '%' || LOWER($2) || '%'` : ''}
        ORDER BY (cs.scope = 'scoped') DESC, cs.created_at ASC
        LIMIT 50`,
      q ? [tenantId, q] : [tenantId]
    );
    return r.rows.map(toCanonicalService);
  },

  /**
   * F-MVP-SERVICE-PUBLISH-OFFERABLE-AUTOCOMPLETE (Opção A — ESTRITO).
   * Serviços canônicos visíveis que o ACTOR ATIVO PODE PUBLICAR AGORA — i.e. cujo concept_id o actor já
   * declarou (PF) ou a empresa já publicou (PJ) como ATIVO. É um SUBCONJUNTO de searchVisible: a única
   * diferença é o predicado de elegibilidade, que ESPELHA EXATAMENTE o gate
   * services.service.ts::assertDeclarationEligibility (DECISION-0144):
   *   PF (actor_type='user'):  EXISTS actor_professional_concepts  (tenant, actor,   concept) AND is_active = true
   *   PJ (company_id setado):  EXISTS company_concept_publications  (tenant, company, concept) AND status   = 'active'
   * Subject não suportado (nem PF user nem page-actor de company) → conjunto VAZIO (fail-closed, igual ao
   * gate que recusaria a criação). Read-only: NÃO cria/altera declaração, NÃO cria serviço, NÃO relaxa o
   * gate. O frontend só PROJETA esta lista — a interseção é resolvida no servidor (SSOT), nunca no browser.
   * Mantém o predicado de elegibilidade numa só camada (backend), evitando lógica PF/PJ paralela no cliente.
   */
  async searchOfferable(
    tenantId: string,
    actor: { actor_id: string; actor_type: string; company_id: string | null },
    query?: string
  ): Promise<CanonicalService[]> {
    const q = String(query ?? '').trim();
    const params: unknown[] = [tenantId];
    let eligibilitySql: string;

    // Espelho 1:1 do gate. PJ tem precedência (page-actor de company tem company_id setado), igual a
    // assertDeclarationEligibility, que checa company_id ANTES de actor_type='user'.
    if (actor.company_id) {
      params.push(actor.company_id);
      eligibilitySql = `EXISTS (
        SELECT 1 FROM company_concept_publications ccp
         WHERE ccp.tenant_id = $1::uuid AND ccp.company_id = $${params.length}::uuid
           AND ccp.concept_id = cs.concept_id AND ccp.status = 'active')`;
    } else if (actor.actor_type === 'user') {
      params.push(actor.actor_id);
      eligibilitySql = `EXISTS (
        SELECT 1 FROM actor_professional_concepts apc
         WHERE apc.tenant_id = $1::uuid AND apc.actor_id = $${params.length}::uuid
           AND apc.concept_id = cs.concept_id AND apc.is_active = true)`;
    } else {
      // G3 do gate: subject indistinguível/sem suporte → nada publicável.
      return [];
    }

    // F-SERVICE-PUBLISH-OFFERABLE-ALIAS-SLICE-B: alias = LENTE de descoberta, nunca autoridade.
    // Se o termo humano ("barbeiro") resolver para concept(s) via ponte advisory (service_search_aliases
    // aprovadas, READ-ONLY), o predicado TEXTUAL passa a casar por NOME **OU** por concept_id resolvido.
    // O eligibilitySql acima permanece AND OBRIGATÓRIO (DECISION-0144/0147 intactas): o alias só amplia
    // o QUE é textualmente encontrável — nunca o QUE o actor pode publicar. Miss/colisão do alias é
    // irrelevante à autoridade: conceito resolvido mas NÃO declarado/publicado segue barrado pelo gate.
    let termSql = '';
    if (q) {
      const { conceptIds: aliasConceptIds } = await resolveConceptsFromSearchTerm(q);
      params.push(q);
      const nameIdx = params.length;
      params.push(aliasConceptIds);
      const conceptIdx = params.length;
      termSql = `AND (
          LOWER(cs.name) LIKE '%' || LOWER($${nameIdx}) || '%'
          OR cs.concept_id = ANY($${conceptIdx}::uuid[])
        )`;
    }

    const r = await pool.query<CsRow>(
      `SELECT ${CS_SELECT} FROM canonical_services cs
        WHERE ${CS_VISIBLE} AND cs.status = 'active'
          AND cs.concept_id IS NOT NULL
          AND ${eligibilitySql}
          ${termSql}
        ORDER BY (cs.scope = 'scoped') DESC, cs.created_at ASC
        LIMIT 50`,
      params
    );
    return r.rows.map(toCanonicalService);
  },

  /**
   * Sugestão GOVERNADA (DECISION-0117 B análogo): nasce scoped + pending_curation.
   * Dedup por slug normalizado no escopo visível (mesma semântica não duplica
   * por prestador). concept obrigatório e domain='servicos' (0109).
   */
  async suggest(input: {
    tenantId: string;
    name: string;
    conceptId: string;
    description?: string | null;
    baseDurationMinutes?: number | null;
    createdByActorId?: string | null;
  }): Promise<{ canonicalService: CanonicalService; created: boolean }> {
    const name = String(input.name ?? '').trim();
    if (!name) throw new CanonicalServiceError(400, 'CANONICAL_SERVICE_NAME_REQUIRED', 'name é obrigatório.');

    const concept = await pool.query<{ concept_id: string; domain: string }>(
      `SELECT concept_id, domain FROM concepts WHERE concept_id = $1::uuid LIMIT 1`,
      [input.conceptId]
    );
    if (concept.rowCount === 0) {
      throw new CanonicalServiceError(404, 'CONCEPT_NOT_FOUND', 'CONCEPT inexistente (Lei 7: significado obrigatório).');
    }
    if (concept.rows[0].domain !== 'servicos') {
      throw new CanonicalServiceError(
        422,
        'CONCEPT_DOMAIN_INVALID',
        `Serviço canônico exige concept domain='servicos' (DECISION-0109/0117); recebido '${concept.rows[0].domain}'.`
      );
    }

    const slug = slugify(name);
    const existing = await pool.query<CsRow>(
      `SELECT ${CS_SELECT} FROM canonical_services cs
        WHERE ${CS_VISIBLE} AND cs.slug = $2
        ORDER BY (cs.scope = 'global') DESC LIMIT 1`,
      [input.tenantId, slug]
    );
    if (existing.rows[0]) {
      return { canonicalService: toCanonicalService(existing.rows[0]), created: false };
    }

    try {
      const ins = await pool.query<CsRow>(
        `INSERT INTO canonical_services (
           tenant_id, scope, concept_id, name, slug, description, base_duration_minutes,
           status, created_by_actor_id
         ) VALUES ($1::uuid, 'scoped', $2::uuid, $3, $4, $5, $6, 'pending_curation', $7)
         RETURNING ${CS_SELECT}`,
        [
          input.tenantId,
          input.conceptId,
          name,
          slug,
          input.description ?? null,
          input.baseDurationMinutes ?? null,
          input.createdByActorId ?? null,
        ]
      );
      const cs = toCanonicalService(ins.rows[0]);
      await insertCatalogEvent({
        entityType: 'canonical_service',
        entityId: cs.id,
        eventType: 'service_suggested',
        payload: { slug, conceptId: input.conceptId },
        actorId: input.createdByActorId ?? null,
        tenantId: input.tenantId,
      });
      return { canonicalService: cs, created: true };
    } catch (err) {
      if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
        const retry = await pool.query<CsRow>(
          `SELECT ${CS_SELECT} FROM canonical_services cs
            WHERE ${CS_VISIBLE} AND cs.slug = $2 LIMIT 1`,
          [input.tenantId, slug]
        );
        if (retry.rows[0]) return { canonicalService: toCanonicalService(retry.rows[0]), created: false };
      }
      throw err;
    }
  },

  /** Curadoria: ativa serviço canônico pendente (curador humano explícito). */
  async approve(input: { canonicalServiceId: string; actorId: string }): Promise<CanonicalService> {
    const cs = await this.findById(input.canonicalServiceId);
    if (!cs) throw new CanonicalServiceError(404, 'CANONICAL_SERVICE_NOT_FOUND', 'Serviço canônico inexistente.');
    if (cs.status === 'active') return cs; // idempotente
    await pool.query(
      `UPDATE canonical_services SET status = 'active', updated_at = NOW() WHERE id = $1::uuid`,
      [cs.id]
    );
    await insertCatalogEvent({
      entityType: 'canonical_service',
      entityId: cs.id,
      eventType: 'service_curation_approved',
      payload: {},
      actorId: input.actorId,
      tenantId: cs.tenantId,
    });
    return { ...cs, status: 'active' };
  },

  /** Merge curatorial (G): duplicate → winner por redirect; append-only; idempotente. */
  async mergeInto(input: { duplicateId: string; winnerId: string; actorId: string }): Promise<void> {
    if (input.duplicateId === input.winnerId) {
      throw new CanonicalServiceError(400, 'MERGE_SELF', 'Serviço canônico não pode ser merge de si mesmo.');
    }
    const dup = await this.findById(input.duplicateId);
    const winner = await this.findById(input.winnerId);
    if (!dup || !winner) throw new CanonicalServiceError(404, 'CANONICAL_SERVICE_NOT_FOUND', 'Serviço inexistente no merge.');
    if (dup.duplicateOfCanonicalServiceId === winner.id) return; // idempotente
    if (winner.duplicateOfCanonicalServiceId) {
      throw new CanonicalServiceError(409, 'MERGE_WINNER_IS_DUPLICATE', 'Vencedor já é redirect de outro serviço.');
    }
    await pool.query(
      `UPDATE canonical_services
          SET duplicate_of_canonical_service_id = $2::uuid, status = 'retired', updated_at = NOW()
        WHERE id = $1::uuid`,
      [dup.id, winner.id]
    );
    await insertCatalogEvent({
      entityType: 'canonical_service',
      entityId: dup.id,
      eventType: 'service_merged_into',
      payload: { winnerId: winner.id },
      actorId: input.actorId,
      tenantId: dup.tenantId,
    });
  },
};
