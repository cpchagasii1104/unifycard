// schema-authority-classification.mjs
// MANIFESTO DE AUTORIDADE DE SCHEMA (Trava 1 — GO Clayton 2026-07-08).
//
// NÃO cria verdade nova: DOCUMENTA a autoridade JÁ EXISTENTE e protege contra REGRESSÃO (reativar
// cadáver, read-model ou tabela histórica como fonte de verdade). Régua: SSOT = exatamente uma fonte
// canônica por conceito; cópia paralela / derivado-persistido-como-verdade / decisão-fora-da-autoridade
// = violação institucional (Lei de Coerência: o sistema é único, nenhuma camada cria realidade paralela).
//
// classification:
//   ssot        — fonte canônica viva. É a autoridade.
//   read_model  — projeção/score derivado. NUNCA decide identidade/autoridade/saldo/tempo/permissão.
//   legacy      — coluna/tabela de compatibilidade. Sem writer NOVO de autoridade; substituída por `replacement`.
//   dead        — cadáver (0 linhas + 0 writers). Não pode ganhar writer de runtime.
//   audit_event — log/evento append-only. Não é fonte decisória.
//
// O guard audit-schema-authority-classification.mjs consome este manifesto e MORDE em regressão.

export const SCHEMA_AUTHORITY = [
  // ── TEMPORAL ──
  { table: 'availability', classification: 'ssot', authority: 'temporal', note: 'SSOT temporal vivo (janela macro).' },
  { table: 'bookings', classification: 'ssot', authority: 'temporal_booking', note: 'reserva/consumo de subperíodo.' },
  { table: 'availability_participants', classification: 'ssot', authority: 'temporal_participant' },
  { table: 'schedules', classification: 'dead', authority: 'none', allowedWriters: [], replacement: 'availability',
    note: '0 linhas + 0 writers (auditoria 2026-07-08). Não pode decidir tempo em paralelo com availability.' },
  { table: 'schedule_slots', classification: 'dead', authority: 'none', allowedWriters: [], replacement: 'availability',
    note: '0 linhas + 0 writers.' },

  // ── IDENTIDADE / ACTOR ──
  { table: 'identities', classification: 'ssot', authority: 'identidade_civil', note: 'SSOT identidade civil (global_user_id).' },
  { table: 'actors', classification: 'ssot', authority: 'acao_operacional', note: 'SSOT do actor (unidade de ação).' },
  { table: 'economic_identities', classification: 'read_model', authority: 'score_economico',
    allowedWriters: ['economic-identity.repository.ts'],
    // heurística: resolvers de identidade/autoridade NÃO podem referenciar esta tabela.
    forbiddenInPaths: ['authorization', 'active-actor', 'actor-context', '/identity/', 'core/auth'],
    note: 'READ_MODEL/score econômico DORMENTE (0 linhas, writer vivo no onboarding). NÃO resolve identidade civil/actor/autoridade/login/permissão/perfil canônico.' },
  // read-models de reputação/risco: 0 linhas (dormentes no dado) MAS o módulo dono já tem writer no
  // código (auditoria 2026-07-08). Carimbo HONESTO: allowlist = o writer do próprio módulo (congela
  // contra writer NOVO de outro módulo) + forbiddenInPaths (nenhum resolver de identidade/autoridade
  // decide a partir de reputação/risco). Reputação pública viva só nasce em frente própria (fato real).
  { table: 'trust_profiles', classification: 'read_model', authority: 'reputacao_futura',
    allowedWriters: ['trust.repository.ts'], forbiddenInPaths: ['authorization', 'active-actor', 'actor-context', 'core/auth'],
    note: 'reputação/trust dormente (0 linhas). Não decide identidade/autoridade. Reputação pública = frente própria.' },
  { table: 'actor_reputation', classification: 'read_model', authority: 'reputacao_futura',
    allowedWriters: ['reputation.service.ts'], forbiddenInPaths: ['authorization', 'active-actor', 'actor-context', 'core/auth'],
    note: 'reputação dormente (0 linhas). Não é reputação pública viva; frente própria a materializa.' },
  { table: 'actor_risk_profile', classification: 'read_model', authority: 'risco_futuro',
    allowedWriters: ['actor-risk.repository.ts'], forbiddenInPaths: ['authorization', 'active-actor', 'actor-context', 'core/auth'],
    note: 'perfil de risco dormente (0 linhas). Não decide autoridade/permissão.' },

  // ── FINANCEIRO (SSOT = Bank; só o Bank escreve) ──
  { table: 'bank_ledger', classification: 'ssot', authority: 'saldo', allowedWriterDirs: ['modules/bank', 'core/bank'],
    note: 'SSOT financeiro. Nenhum módulo fora do Bank escreve. Δbank=0 nas frentes de produto.' },
  { table: 'bank_transactions', classification: 'ssot', authority: 'transacao', allowedWriterDirs: ['modules/bank', 'core/bank'] },
  { table: 'bank_accounts', classification: 'ssot', authority: 'conta', allowedWriterDirs: ['modules/bank', 'core/bank'] },

  // ── LOCAÇÕES ──
  { table: 'rental_resource_pricing', classification: 'ssot', authority: 'rental_pricing_tiers',
    allowedWriters: ['rentable-resource.repository.ts'], note: 'SSOT das faixas de preço anunciado.' },
  // coluna-nível: rentable_resources.price_cents / pricing_unit = legado (0/2 populado, 0 writer novo).
  { table: 'rentable_resources', columns: ['price_cents', 'pricing_unit'], classification: 'legacy', authority: 'none',
    replacement: 'rental_resource_pricing',
    note: 'par legado de preço. Proibido UPDATE ... SET price_cents/pricing_unit como autoridade (use rental_resource_pricing).' },
];

export default SCHEMA_AUTHORITY;
