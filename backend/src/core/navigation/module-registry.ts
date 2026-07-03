// module-registry.ts
// DECISION-0117 F — REGISTRY governado do MENU DE MÓDULOS (navegação transversal).
//
// Fonte única do menu de módulos: o frontend CONSOME a projeção
// (GET /navigation/modules) e NÃO inventa módulo/categoria/rota/autoridade.
// O menu NÃO concede autoridade — toda rota revalida no backend.
// STUB/TOMBSTONE NUNCA aparecem como operacionais na projeção.
//
// Distinto da navegação de CATÁLOGO (ontologia N0/N1/N2 — /navigation/n2),
// que permanece intocada: módulo ≠ categoria.

export type ModuleContext = 'personal' | 'company';
export type ModuleStatus = 'LIVE' | 'STUB' | 'TOMBSTONE';

export interface ModuleRegistryEntry {
  moduleKey: string;
  label: string;
  icon: string;
  route: string;
  group: string;
  contexts: ModuleContext[];
  status: ModuleStatus;
  /** Match exato de rota no highlight do frontend. */
  exact?: boolean;
  /** Contexto company: exige módulo habilitado por template aplicado (DECISION-0117 E). */
  requiresTemplateModule?: string;
  /** Contexto company: exige KYB aprovado da empresa. */
  requiresKybApproved?: boolean;
}

/**
 * Registry canônico. STUBs registrados HONESTAMENTE (rotas /em-desenvolvimento
 * históricas do sidebar hardcoded) — ficam FORA da projeção operacional.
 */
export const MODULE_REGISTRY: ModuleRegistryEntry[] = [
  // ── Geral ────────────────────────────────────────────────────────────────
  { moduleKey: 'home', label: 'Início', icon: '🏠', route: '/home', group: 'Geral', contexts: ['personal'], status: 'LIVE', exact: true },

  // ── Financeiro (leitura/projeção; autoridade vive no Bank) ───────────────
  { moduleKey: 'bank', label: 'UnifyBank', icon: '🏦', route: '/banco', group: 'Financeiro', contexts: ['personal'], status: 'LIVE' },
  { moduleKey: 'statement', label: 'Extrato', icon: '📄', route: '/extrato', group: 'Financeiro', contexts: ['personal'], status: 'LIVE' },
  { moduleKey: 'regional-fund', label: 'Fundo Regional', icon: '🌱', route: '/fundo-regional', group: 'Financeiro', contexts: ['personal'], status: 'LIVE' },
  { moduleKey: 'social-ledger', label: 'Ledger Social', icon: '📜', route: '/ledger', group: 'Financeiro', contexts: ['personal'], status: 'LIVE' },

  // ── Comércio ─────────────────────────────────────────────────────────────
  { moduleKey: 'marketplace', label: 'Fazer compras', icon: '🛒', route: '/marketplace', group: 'Comércio', contexts: ['personal'], status: 'LIVE' },
  { moduleKey: 'services', label: 'Serviços', icon: '🔧', route: '/services', group: 'Comércio', contexts: ['personal'], status: 'LIVE' },
  // Histórico do sidebar hardcoded — rotas /em-desenvolvimento (NÃO operacionais):
  { moduleKey: 'mobility', label: 'Pedir um carro', icon: '🚗', route: '/em-desenvolvimento?feature=mobility', group: 'Comércio', contexts: ['personal'], status: 'STUB' },
  { moduleKey: 'food', label: 'Pedir comida', icon: '🍕', route: '/em-desenvolvimento?feature=food', group: 'Comércio', contexts: ['personal'], status: 'STUB' },
  { moduleKey: 'rentals', label: 'Locações', icon: '🔑', route: '/locacoes', group: 'Comércio', contexts: ['personal'], status: 'LIVE' }, // F-RENTAL-RESOURCE-SURFACE-SLICE-B

  // ── Social ───────────────────────────────────────────────────────────────
  { moduleKey: 'social', label: 'Rede Social', icon: '💬', route: '/social', group: 'Social', contexts: ['personal'], status: 'LIVE' },
  { moduleKey: 'groups', label: 'Grupos', icon: '👥', route: '/grupos', group: 'Social', contexts: ['personal'], status: 'LIVE' },
  // DT-MODULE-VOTES-FANTASMA: tabelas inexistentes — TOMBSTONE (nunca projetado).
  { moduleKey: 'votes', label: 'Votações', icon: '🗳️', route: '/votacoes', group: 'Social', contexts: ['personal'], status: 'TOMBSTONE' },
  { moduleKey: 'impact', label: 'Impacto', icon: '💚', route: '/impacto', group: 'Social', contexts: ['personal'], status: 'LIVE' },

  // ── Conta ────────────────────────────────────────────────────────────────
  { moduleKey: 'profile', label: 'Meu Perfil', icon: '👤', route: '/perfil', group: 'Conta', contexts: ['personal'], status: 'LIVE' },
  { moduleKey: 'companies', label: 'Minhas Empresas', icon: '🏢', route: '/empresas', group: 'Conta', contexts: ['personal'], status: 'LIVE' },
  { moduleKey: 'transparency', label: 'Transparência', icon: '🔍', route: '/transparencia', group: 'Conta', contexts: ['personal'], status: 'LIVE' },
  { moduleKey: 'settings', label: 'Configurações', icon: '⚙️', route: '/dashboard', group: 'Conta', contexts: ['personal'], status: 'LIVE' },

  // ── Criar ────────────────────────────────────────────────────────────────
  { moduleKey: 'create-company', label: 'Empresa', icon: '🏢', route: '/empresas', group: 'Criar', contexts: ['personal'], status: 'LIVE' },
  { moduleKey: 'create-group', label: 'Grupo', icon: '👥', route: '/grupos', group: 'Criar', contexts: ['personal'], status: 'LIVE' },
  { moduleKey: 'create-event', label: 'Evento', icon: '🎭', route: '/events/new', group: 'Criar', contexts: ['personal'], status: 'LIVE' },
  { moduleKey: 'create-page', label: 'Página', icon: '📄', route: '/em-desenvolvimento?feature=page', group: 'Criar', contexts: ['personal'], status: 'STUB' },
  { moduleKey: 'create-channel', label: 'Canal', icon: '📡', route: '/em-desenvolvimento?feature=channel', group: 'Criar', contexts: ['personal'], status: 'STUB' },

  // ── Contexto EMPRESA (projeção por template aplicado + lifecycle/KYB) ─────
  { moduleKey: 'company-overview', label: 'Visão Geral', icon: '🏢', route: '/empresas/:companyId', group: 'Empresa', contexts: ['company'], status: 'LIVE' },
  { moduleKey: 'company-marketplace', label: 'Catálogo & Ofertas', icon: '🛒', route: '/empresas/:companyId/catalogo', group: 'Empresa', contexts: ['company'], status: 'LIVE', requiresTemplateModule: 'marketplace' },
  { moduleKey: 'company-inventory', label: 'Estoque', icon: '📦', route: '/empresas/:companyId/estoque', group: 'Empresa', contexts: ['company'], status: 'LIVE', requiresTemplateModule: 'inventory' },
  { moduleKey: 'company-services', label: 'Serviços', icon: '🔧', route: '/empresas/:companyId/servicos', group: 'Empresa', contexts: ['company'], status: 'LIVE', requiresTemplateModule: 'services' },
  { moduleKey: 'company-agenda', label: 'Agenda', icon: '📅', route: '/empresas/:companyId/agenda', group: 'Empresa', contexts: ['company'], status: 'LIVE', requiresTemplateModule: 'agenda' },
  { moduleKey: 'company-publications', label: 'Publicações', icon: '📣', route: '/empresas/:companyId/publicacoes', group: 'Empresa', contexts: ['company'], status: 'LIVE', requiresKybApproved: true },
];

/** Entradas OPERACIONAIS de um contexto (STUB/TOMBSTONE nunca saem daqui). */
export function liveEntriesForContext(context: ModuleContext): ModuleRegistryEntry[] {
  return MODULE_REGISTRY.filter((e) => e.status === 'LIVE' && e.contexts.includes(context));
}
