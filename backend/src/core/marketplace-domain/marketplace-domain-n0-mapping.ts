// backend/src/core/marketplace-domain/marketplace-domain-n0-mapping.ts
// F-MARKETPLACE-DOMAIN-N0-MATERIALIZATION (L3) — materializa em código o mapa PROMULGADO da DECISION-0106.
//
// 🔴 GATE 00_AGENT_PROTOCOL §2.3.2: pilar ONTOLOGIA/navegação; SSOT semântico = CONCEPT (Lei 7); os
// domínios N0 são governados na tabela `domains` (18_DOMAIN_ONTOLOGY §7). `MarketplaceDomain` NÃO é SSOT —
// é rótulo de navegação/UX do frontend (0106 §2). Este módulo é o HOME GOVERNADO do MAPA rótulo→N0 (que
// só vivia no doc 0106 + duplicado em 2 enums de frontend). NÃO cria taxonomia nova: PROJETA a decisão já
// promulgada por Clayton (D1-D6) sobre os domínios N0 vivos. Mapear ≠ dar autoridade (0106 §2): a
// identidade semântica continua em CONCEPT; isto é a ponte de navegação.
//
// D1 market → produtos-e-comercio · D2 services → servicos · D3 events → cultura-lazer-e-eventos ·
// D4 jobs → CAPABILITY transversal (NÃO domínio) → null · D5 real_estate → REGULADO sem alvo N0 → null ·
// D6 vehicles → REGULADO sem alvo N0 → null (NÃO mapear p/ mobilidade-e-logistica: viga do rides, 0106 §4).
// null = "sem N0 de atuação" (por DECISÃO), NÃO "esquecido" — a materialização respeita D4/D5/D6 à risca.

/**
 * O VOCABULÁRIO (6 rótulos) vive em @unificard/contracts (vocabulary.ts — "Reference vocabulary",
 * a casa canônica de enumerações compartilhadas frontend+backend, mesmo padrão de Gender/Currency).
 * Este módulo COMPÕE de lá (import + re-export) e é o home do MAPA rótulo→N0 (D1-D6), que é
 * conhecimento de BACKEND (depende da tabela `domains` viva). Fork totalmente fechado: frontend e
 * backend consomem o MESMO símbolo.
 */
import { MARKETPLACE_DOMAIN_VALUES, type MarketplaceDomain } from '@unificard/contracts';

export const MARKETPLACE_DOMAINS = MARKETPLACE_DOMAIN_VALUES;
export type { MarketplaceDomain };

/** N0 de atuação de cada rótulo, per DECISION-0106 D1-D6. null = sem alvo N0 por decisão (jobs/real_estate/vehicles). */
export const MARKETPLACE_DOMAIN_TO_N0: Record<MarketplaceDomain, string | null> = {
  market: 'produtos-e-comercio',        // D1
  services: 'servicos',                 // D2
  events: 'cultura-lazer-e-eventos',    // D3
  jobs: null,                           // D4 — capability transversal, não domínio
  real_estate: null,                    // D5 — regulado, sem alvo N0 vivo
  vehicles: null,                       // D6 — regulado; NÃO mobilidade-e-logistica (viga do rides)
};

/**
 * Resolve o N0 de atuação de um rótulo de marketplace, per 0106. Retorna null quando o rótulo NÃO tem N0
 * de atuação POR DECISÃO (jobs=capability; real_estate/vehicles=regulados). NÃO força um N0 errado
 * ("semântica errada → prisão", 0106 §2). O caller trata null como "sem domínio de atuação mapeado".
 */
export function resolveN0ForMarketplaceDomain(domain: string): string | null {
  if ((MARKETPLACE_DOMAINS as readonly string[]).includes(domain)) {
    return MARKETPLACE_DOMAIN_TO_N0[domain as MarketplaceDomain];
  }
  return null;
}
