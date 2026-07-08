// backend/src/core/audience/audience-options.ts
// CAPACIDADE TRANSVERSAL de VISIBILIDADE (Clayton 2026-07-07: "fonte única de verdade para TODAS as
// opções"). Antes: posts (IntentComposer), demanda (DemandPublishForm) e evento (/events/audience-
// options) tinham 3 projeções DIVERGENTES da mesma verdade + locação faltando. Aqui a projeção é
// DERIVADA do SSOT (PAIR_ALLOWED_LABELS — quais labels valem por par de tipos de actor), nunca
// hardcoded. Qualquer módulo que publique oferta/post consome ISTO — Lei de Coerência (uma verdade).

import { PAIR_ALLOWED_LABELS, RELATIONSHIP_LABELS, type RelationshipLabel } from '@modules/relationships/actor-relationship.types';

// Display PT dos labels typed-edge (projeção UX; governado, mas é apresentação — não identidade).
const LABEL_DISPLAY: Record<RelationshipLabel, { plural: string; icon: string }> = {
  amigo: { plural: 'Amigos', icon: '👥' },
  conhecido: { plural: 'Conhecidos', icon: '🙂' },
  familiar: { plural: 'Familiares', icon: '🏠' },
  cliente: { plural: 'Clientes', icon: '🛒' },
  colaborador: { plural: 'Colaboradores', icon: '🧑‍💼' },
  fornecedor: { plural: 'Fornecedores', icon: '📦' },
  parceiro: { plural: 'Parceiros', icon: '🤝' },
};

export interface AudienceOption {
  key: string;
  label: string;
  icon: string;
  visibility: 'public' | 'connections' | 'only_me';
  /** Refinamento por tipo de relação (⊆ RELATIONSHIP_LABELS). null = sem refinamento (macro). */
  audienceRelationshipTypes: string[] | null;
}

/** actor_type do sistema → lado da aresta do vocabulário typed-edge. */
function actorKindOf(actorType: string): 'pf' | 'pj' | null {
  if (actorType === 'user') return 'pf';
  if (actorType === 'page') return 'pj';
  return null; // group/channel/etc: sem refinamento por relação tipada (ainda) → só macros
}

/**
 * FONTE ÚNICA das opções de plateia por tipo de actor. Deriva de PAIR_ALLOWED_LABELS:
 * os labels ofertáveis = união de todos os labels de qualquer PAR que envolve o tipo do actor
 * (um PF pode ter amigo/familiar/conhecido E cliente/colaborador/fornecedor; um PJ pode ter
 * cliente/colaborador/fornecedor E parceiro). Zero hardcode — muda o SSOT, muda todas as telas.
 */
export function buildAudienceOptions(actorType: string): AudienceOption[] {
  const macroTop: AudienceOption[] = [
    { key: 'public', label: 'Público', icon: '🌐', visibility: 'public', audienceRelationshipTypes: null },
    { key: 'connections', label: 'Todas as conexões', icon: '🔗', visibility: 'connections', audienceRelationshipTypes: null },
  ];
  const onlyMe: AudienceOption = { key: 'only_me', label: 'Só eu', icon: '🔒', visibility: 'only_me', audienceRelationshipTypes: null };

  const kind = actorKindOf(actorType);
  if (!kind) return [...macroTop, onlyMe];

  // Labels ofertáveis = união dos labels de todo par que contém 'kind', na ordem canônica de
  // RELATIONSHIP_LABELS (determinístico, sem duplicata).
  const allowed = new Set<RelationshipLabel>();
  for (const [pair, labels] of Object.entries(PAIR_ALLOWED_LABELS)) {
    if (pair.split(':').includes(kind)) labels.forEach((l) => allowed.add(l));
  }
  const refinements: AudienceOption[] = RELATIONSHIP_LABELS
    .filter((l) => allowed.has(l))
    .map((l) => ({
      key: l,
      label: LABEL_DISPLAY[l].plural,
      icon: LABEL_DISPLAY[l].icon,
      visibility: 'connections' as const,
      audienceRelationshipTypes: [l],
    }));

  return [...macroTop, ...refinements, onlyMe];
}
