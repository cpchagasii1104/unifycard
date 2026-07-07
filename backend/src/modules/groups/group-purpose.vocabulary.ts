// backend/src/modules/groups/group-purpose.vocabulary.ts
// DECISION-0163 (ratificada por Clayton 2026-07-07) — PROPÓSITO do grupo: eixo GOVERNADO
// ortogonal à categoria (TREE). Propósito = POR QUE o grupo existe; muda descoberta (faceta
// primária, antes de categoria) e composições futuras (cuidado_e_impacto ↔ pilar Impacto,
// PORTA-1). É do GRUPO (autodeclarado), NUNCA inferência sobre membros (0071/anti-inferência).
// Fonte ÚNICA — espelha o CHECK chk_groups_purpose; registrado no manifest governado.

export const GROUP_PURPOSES = [
  'cuidado_e_impacto',
  'comunidade_e_pertencimento',
  'fe_e_espiritualidade',
  'interesse_e_hobby',
  'aprendizado',
  'ajuda_mutua_e_cooperacao',
  'encontros_e_relacionamentos',
] as const;

export type GroupPurpose = (typeof GROUP_PURPOSES)[number];

export const DEFAULT_GROUP_PURPOSE: GroupPurpose = 'comunidade_e_pertencimento';
