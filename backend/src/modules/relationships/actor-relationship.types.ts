// backend/src/modules/relationships/actor-relationship.types.ts
// F-ACTOR-RELATIONSHIP-TYPED-EDGE-SLICE-1 — a aresta de relação tipada entre actors.
// DESENHO_PAGINA_DO_ACTOR.md §5 (SELADO) + SPEC_FATIA1_RELACAO_TIPADA.md + Opção B (Clayton 2026-07-04).
//
// FRONTEIRAS DURAS (Lei de Coerência; DECISION-0113/0125):
//   · relação ≠ autoridade — este módulo NUNCA lê/escreve company_users nem concede permissão;
//   · Δbank=0 — nada de dinheiro;
//   · vocabulário GOVERNADO — labels só do seed aprovado (CHECK no schema + validação aqui).

/** Vocabulário TOTAL de tipos de relação (seed aprovado por Clayton, DESENHO §7).
 *  Espelha o CHECK de actor_relationships. Extensível por RFC/DECISION, nunca por feature. */
export const RELATIONSHIP_LABELS = [
  'amigo',
  'conhecido',
  'familiar',
  'cliente',
  'colaborador',
  'fornecedor',
  'parceiro',
] as const;
export type RelationshipLabel = (typeof RELATIONSHIP_LABELS)[number];

export const RELATIONSHIP_STATUSES = ['pending', 'accepted', 'rejected', 'removed', 'blocked'] as const;
export type RelationshipStatus = (typeof RELATIONSHIP_STATUSES)[number];

/** Tipo de lado da aresta para o pareamento do vocabulário (PF = pessoa, PJ = empresa/page). */
export type ActorKind = 'pf' | 'pj';

/** Seed aprovado (DESENHO §7): quais labels valem para cada PAR (não-ordenado) de tipos de actor.
 *  PF↔PF {amigo, conhecido, familiar} · PF↔PJ {cliente, colaborador, fornecedor} ·
 *  PJ↔PJ {fornecedor, cliente, parceiro}. Fora disso = fail-closed (422). */
export const PAIR_ALLOWED_LABELS: Record<string, readonly RelationshipLabel[]> = {
  'pf:pf': ['amigo', 'conhecido', 'familiar'],
  'pf:pj': ['cliente', 'colaborador', 'fornecedor'],
  'pj:pj': ['fornecedor', 'cliente', 'parceiro'],
};

/** Chave canônica do par (não-ordenada): pf:pj cobre PF→PJ e PJ→PF. */
export function pairKey(a: ActorKind, b: ActorKind): string {
  return [a, b].sort().join(':');
}

export interface ActorRelationship {
  id: string;
  tenantId: string;
  fromActorId: string;
  toActorId: string;
  status: RelationshipStatus;
  requesterLabel: RelationshipLabel;
  targetLabel: RelationshipLabel | null;
  requestedAt: string;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SendRelationshipInput {
  toActorId: string;
  requesterLabel: RelationshipLabel;
}

export interface RespondRelationshipInput {
  action: 'accept' | 'reject';
  targetLabel?: RelationshipLabel;
}

export interface RelationshipFilters {
  status?: RelationshipStatus;
  label?: RelationshipLabel;
  limit?: number;
  offset?: number;
}
