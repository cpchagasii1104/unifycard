// frontend/src/config/actorContextConfig.ts
// Diretriz Clayton 2026-05-15: actor é modo operacional do sistema.
// Mesma base estrutural + comportamento contextual dinâmico.
//
// Esta config NÃO duplica appsRegistry — ela compõe sobre ele, declarando:
//   - QUICK_ACTIONS_CATALOG: catálogo central de ações rápidas
//   - DASHBOARD_CARDS_CATALOG: cards de visão geral por id
//   - getActorContextProfile(context): retorna o perfil operacional do actor
//
// Mantém referência limitada ao que existe materialmente hoje (user, page, group,
// channel). Especializações futuras (band, restaurant, lawyer) virão como
// subtype dentro de actor_type quando a hierarquia ontológica N0/N1/N2 amadurecer.

import type { AppContext } from './appsRegistry';
import type { OperatingMode } from './operatingMode';

// ============================================================
// CATÁLOGO: Quick Actions (todas as ações disponíveis no sistema)
// ============================================================

export interface QuickActionDefinition {
  id: string;
  label: string;
  icon: string;
  route: string;
  color: string;
}

export const QUICK_ACTIONS_CATALOG: Record<string, QuickActionDefinition> = {
  // Social / PF
  'rede-social': { id: 'rede-social', label: 'Rede Social', icon: '💬', route: '/social', color: '#10b981' },
  'meus-grupos': { id: 'meus-grupos', label: 'Meus Grupos', icon: '👥', route: '/grupos', color: '#8b5cf6' },
  'eventos': { id: 'eventos', label: 'Eventos', icon: '🎭', route: '/eventos', color: '#ec4899' },
  'comunidades': { id: 'comunidades', label: 'Comunidades', icon: '🌐', route: '/grupos', color: '#06b6d4' },

  // Mobilidade / serviços PF
  'pedir-carro': { id: 'pedir-carro', label: 'Pedir um Carro', icon: '🚗', route: '/em-desenvolvimento?feature=mobility', color: '#f59e0b' },
  'pedir-comida': { id: 'pedir-comida', label: 'Pedir Comida', icon: '🍕', route: '/em-desenvolvimento?feature=food', color: '#ef4444' },
  'marketplace': { id: 'marketplace', label: 'Marketplace', icon: '🛒', route: '/marketplace', color: '#06b6d4' },

  // Financeiro universal
  'transferir': { id: 'transferir', label: 'Transferir', icon: '↗️', route: '/banco', color: '#3b82f6' },
  'depositar': { id: 'depositar', label: 'Depósito', icon: '⬇️', route: '/banco', color: '#84cc16' },
  'sacar': { id: 'sacar', label: 'Sacar', icon: '⬆️', route: '/banco', color: '#ef4444' },
  'extrato': { id: 'extrato', label: 'Extrato', icon: '📄', route: '/extrato', color: '#3b82f6' },

  // PJ / empresa
  'vender': { id: 'vender', label: 'Vender', icon: '💰', route: '/marketplace', color: '#10b981' },
  'campanhas': { id: 'campanhas', label: 'Campanhas', icon: '📢', route: '/em-desenvolvimento?feature=campaigns', color: '#8b5cf6' },
  'pedidos': { id: 'pedidos', label: 'Pedidos', icon: '📦', route: '/em-desenvolvimento?feature=orders', color: '#f59e0b' },
  'crm': { id: 'crm', label: 'Clientes', icon: '👤', route: '/em-desenvolvimento?feature=crm', color: '#ec4899' },
  'contratar': { id: 'contratar', label: 'Contratar', icon: '🤝', route: '/em-desenvolvimento?feature=contract', color: '#06b6d4' },

  // Grupo / governança
  'membros': { id: 'membros', label: 'Membros', icon: '👥', route: '/grupos', color: '#8b5cf6' },
  // DT-MODULE-VOTES-FANTASMA (2026-05-16): /votacoes desativado — tabelas inexistentes.
  'votacoes': { id: 'votacoes', label: 'Votações', icon: '🗳️', route: '/em-desenvolvimento?feature=votes', color: '#3b82f6' },
  'contribuir': { id: 'contribuir', label: 'Contribuir', icon: '💚', route: '/em-desenvolvimento?feature=group-contribution', color: '#10b981' },
  'impacto': { id: 'impacto', label: 'Impacto', icon: '💚', route: '/impacto', color: '#10b981' },

  // Canal / publicação
  'publicar': { id: 'publicar', label: 'Publicar', icon: '✏️', route: '/social', color: '#8b5cf6' },

  // Modo operante "Operar" — actions de trabalho (PF que opera)
  'dirigir':          { id: 'dirigir',          label: 'Dirigir',                icon: '🚙', route: '/em-desenvolvimento?feature=driver',   color: '#f59e0b' },
  'entregar':         { id: 'entregar',         label: 'Entregar',               icon: '🛵', route: '/em-desenvolvimento?feature=courier',  color: '#ef4444' },
  'prestar-servico':  { id: 'prestar-servico',  label: 'Prestar serviço',        icon: '🔧', route: '/em-desenvolvimento?feature=service-provider', color: '#10b981' },
  'atender-pedidos':  { id: 'atender-pedidos',  label: 'Atender pedidos',        icon: '📋', route: '/em-desenvolvimento?feature=orders',   color: '#f59e0b' },
  'agenda':           { id: 'agenda',           label: 'Agenda',                 icon: '📅', route: '/perfil?tab=agenda',                   color: '#06b6d4' },
  'trabalhar-perto':  { id: 'trabalhar-perto',  label: 'Trabalhe perto',         icon: '📍', route: '/em-desenvolvimento?feature=local-work', color: '#10b981' },

  // Modo operante "Consumir" para PJ — empresa também consome
  'comprar-insumos':  { id: 'comprar-insumos',  label: 'Comprar insumos',        icon: '🛍️', route: '/marketplace',                         color: '#06b6d4' },
  'fornecedores':     { id: 'fornecedores',     label: 'Fornecedores',           icon: '🏭', route: '/em-desenvolvimento?feature=suppliers', color: '#3b82f6' },
  'contratar-servico':{ id: 'contratar-servico',label: 'Contratar serviço',      icon: '🤝', route: '/em-desenvolvimento?feature=hire-service', color: '#8b5cf6' },

  // Profissionais (catalogo extendido — usado por useProfessionalContext)
  // Mesmas rotas wip enquanto modulos especificos nao existem; importante e
  // sinalizar contextualmente. Cores alinhadas com paleta profissional.
  // 2026-05-15: actions "agenda-*" apontam para /perfil?tab=agenda (ProfileAgenda).
  // ProfileAgenda integra unified_availability (agenda universal soberana — fonte
  // única de verdade conforme diretriz Clayton "agenda universal" / plano v2.1).
  // Labels permanecem contextuais por profissão; destino é o mesmo módulo canônico.
  'atender-paciente': { id: 'atender-paciente', label: 'Atender paciente', icon: '🦷', route: '/perfil?tab=agenda', color: '#06b6d4' },
  'agenda-clinica': { id: 'agenda-clinica', label: 'Agenda clínica', icon: '📅', route: '/perfil?tab=agenda', color: '#06b6d4' },
  'nova-consulta': { id: 'nova-consulta', label: 'Nova consulta', icon: '⚖️', route: '/perfil?tab=agenda', color: '#3b82f6' },
  'agenda-juridica': { id: 'agenda-juridica', label: 'Agenda jurídica', icon: '📅', route: '/perfil?tab=agenda', color: '#3b82f6' },
  'publicar-conteudo': { id: 'publicar-conteudo', label: 'Publicar conteúdo', icon: '✏️', route: '/social', color: '#8b5cf6' },
  'nova-encomenda': { id: 'nova-encomenda', label: 'Nova encomenda', icon: '🎂', route: '/perfil?tab=agenda', color: '#ec4899' },
  'agenda-entregas': { id: 'agenda-entregas', label: 'Agenda entregas', icon: '📦', route: '/perfil?tab=agenda', color: '#ec4899' },
  'publicar-portfolio': { id: 'publicar-portfolio', label: 'Publicar portfólio', icon: '🖼️', route: '/social', color: '#8b5cf6' },
  'novo-ensaio': { id: 'novo-ensaio', label: 'Novo ensaio', icon: '📷', route: '/perfil?tab=agenda', color: '#8b5cf6' },
  'agenda-fotos': { id: 'agenda-fotos', label: 'Agenda fotos', icon: '📅', route: '/perfil?tab=agenda', color: '#8b5cf6' },
  'novo-projeto': { id: 'novo-projeto', label: 'Novo projeto', icon: '📐', route: '/perfil?tab=agenda', color: '#f59e0b' },
  'agenda-cliente': { id: 'agenda-cliente', label: 'Agenda cliente', icon: '📅', route: '/perfil?tab=agenda', color: '#f59e0b' },
  'novo-orcamento': { id: 'novo-orcamento', label: 'Novo orçamento', icon: '💰', route: '/perfil?tab=agenda', color: '#10b981' },
  'agenda-obras': { id: 'agenda-obras', label: 'Agenda obras', icon: '🏗️', route: '/perfil?tab=agenda', color: '#10b981' },
  'publicar-antes-depois': { id: 'publicar-antes-depois', label: 'Antes/depois', icon: '🎨', route: '/social', color: '#10b981' },
  'agenda-servico': { id: 'agenda-servico', label: 'Agenda serviço', icon: '🔧', route: '/perfil?tab=agenda', color: '#eab308' },
  'novo-aluno': { id: 'novo-aluno', label: 'Novo aluno', icon: '💪', route: '/perfil?tab=agenda', color: '#ef4444' },
  'agenda-treinos': { id: 'agenda-treinos', label: 'Agenda treinos', icon: '📅', route: '/perfil?tab=agenda', color: '#ef4444' },
  'nova-sessao': { id: 'nova-sessao', label: 'Nova sessão', icon: '🧠', route: '/perfil?tab=agenda', color: '#a855f7' },
  'agenda-pacientes': { id: 'agenda-pacientes', label: 'Agenda pacientes', icon: '📅', route: '/perfil?tab=agenda', color: '#a855f7' },
  'nova-agenda': { id: 'nova-agenda', label: 'Nova agenda', icon: '🎵', route: '/perfil?tab=agenda', color: '#8b5cf6' },
  'networking-artistas': { id: 'networking-artistas', label: 'Networking artistas', icon: '🤝', route: '/social', color: '#8b5cf6' },
};

// ============================================================
// CATÁLOGO: Dashboard Cards (visão geral)
// ============================================================

export type DashboardCardId =
  | 'fundo-regional'
  | 'meu-saldo'
  | 'caixa-empresa'
  | 'caixa-grupo'
  | 'em-processamento'
  | 'limite-disponivel'
  | 'movimentacoes-mes'
  | 'indicacoes';

// ============================================================
// CATÁLOGO: Sidebar Priority (quais items destacar no menu lateral)
// ============================================================

/**
 * IDs de rota da sidebar global que recebem destaque (badge "prioritário")
 * conforme o actor ativo. NÃO esconde itens — apenas marca prioridade visual.
 */
export type SidebarPriorityId = string;

// ============================================================
// PROFILE: configuração contextual por actor
// ============================================================

/**
 * Cross-mode hint (frase-âncora: "prioriza, não esconde").
 * Action sutil renderizada no slot final do mosaico de quick actions, sugerindo
 * o outro lado do ecossistema. Não obriga troca de modo — convite transversal.
 */
export interface CrossModeHint {
  /** ID de QuickAction no QUICK_ACTIONS_CATALOG. */
  actionId: string;
  /** Label opcional que sobrescreve o do catálogo (ex: "Ganhe dirigindo"). */
  label?: string;
}

export interface OperatingModeOverrides {
  /** Quick actions específicas deste modo (até 7 — slot 8 é cross-mode). */
  quickActions?: string[];
  /** Rotas da sidebar com destaque neste modo. */
  sidebarPriorities?: SidebarPriorityId[];
  /** Convite transversal para o modo oposto. */
  crossModeHint?: CrossModeHint;
}

export interface ActorContextProfile {
  context: AppContext;
  modeName: string;
  /** Quick actions na ordem de prioridade (até 8 renderizadas). Fallback se sem byOperatingMode. */
  quickActions: string[];
  /** Cards de visão geral mostrados (na ordem). NÃO especializa por modo — finanças são transversais. */
  dashboardCards: DashboardCardId[];
  /** Rotas da sidebar que recebem destaque visual. Fallback se sem byOperatingMode. */
  sidebarPriorities: SidebarPriorityId[];
  /** CTA de criação primário sugerido (botão FAB / banner). null = nenhum. */
  primaryCreateCta: { label: string; route: string } | null;
  /** Texto opcional para banner contextual do dashboard. */
  contextualBanner?: {
    title: string;
    subtitle: string;
    route?: string;
  };
  /**
   * Especializações por modo operante (camada de intenção). OPCIONAL.
   * Quando ausente, profile é "mono-modo" (toggle não aparece para esse actor type).
   * Quando presente com 2 chaves (consumir + operar), toggle aparece.
   */
  byOperatingMode?: Partial<Record<OperatingMode, OperatingModeOverrides>>;
}

/**
 * Envelope para render. Distingue actions normais de cross-mode (convite ao outro modo).
 * DashboardHome usa `isCrossMode` para renderizar com peso visual menor.
 */
export interface RenderableQuickAction {
  definition: QuickActionDefinition;
  /** True quando esta action representa convite ao modo oposto. */
  isCrossMode: boolean;
  /** Label override (vem de CrossModeHint.label). */
  overrideLabel?: string;
}

const PROFILE_PF: ActorContextProfile = {
  context: 'pf',
  modeName: 'Pessoa Física',
  // Fallback = modo Consumir (estado padrão da PF)
  quickActions: [
    'rede-social',
    'meus-grupos',
    'pedir-comida',
    'pedir-carro',
    'eventos',
    'marketplace',
    'transferir',
  ],
  dashboardCards: ['fundo-regional', 'meu-saldo', 'em-processamento', 'limite-disponivel'],
  sidebarPriorities: ['/social', '/grupos', '/marketplace', '/em-desenvolvimento?feature=mobility', '/em-desenvolvimento?feature=food'],
  primaryCreateCta: { label: 'Criar evento', route: '/events/new' },
  byOperatingMode: {
    consumir: {
      quickActions: [
        'rede-social',
        'meus-grupos',
        'pedir-comida',
        'pedir-carro',
        'eventos',
        'marketplace',
        'transferir',
      ],
      sidebarPriorities: ['/social', '/grupos', '/marketplace', '/em-desenvolvimento?feature=mobility', '/em-desenvolvimento?feature=food'],
      // Convite transversal ao modo Operar
      crossModeHint: { actionId: 'trabalhar-perto', label: 'Trabalhe perto' },
    },
    operar: {
      quickActions: [
        'dirigir',
        'entregar',
        'prestar-servico',
        'atender-pedidos',
        'agenda',
        'transferir',
        'extrato',
      ],
      sidebarPriorities: ['/perfil?tab=agenda', '/services', '/extrato', '/banco'],
      // Convite transversal ao modo Consumir
      crossModeHint: { actionId: 'pedir-comida', label: 'Pedir comida' },
    },
  },
};

const PROFILE_PJ: ActorContextProfile = {
  context: 'pj',
  modeName: 'Empresa',
  // Fallback = modo Operar (estado padrão da empresa)
  quickActions: ['vender', 'campanhas', 'pedidos', 'crm', 'contratar', 'marketplace', 'transferir'],
  dashboardCards: ['caixa-empresa', 'movimentacoes-mes', 'em-processamento', 'limite-disponivel'],
  sidebarPriorities: ['/marketplace', '/services', '/banco', '/extrato'],
  primaryCreateCta: { label: 'Criar campanha', route: '/em-desenvolvimento?feature=campaign' },
  contextualBanner: {
    title: 'Sua empresa no UnifiCard',
    subtitle: 'Venda, divulgue e coordene operações em um só lugar',
    route: '/marketplace',
  },
  byOperatingMode: {
    operar: {
      quickActions: ['vender', 'campanhas', 'pedidos', 'crm', 'contratar', 'marketplace', 'transferir'],
      sidebarPriorities: ['/marketplace', '/services', '/banco', '/extrato'],
      crossModeHint: { actionId: 'comprar-insumos', label: 'Comprar insumos' },
    },
    consumir: {
      quickActions: ['comprar-insumos', 'fornecedores', 'contratar-servico', 'marketplace', 'transferir', 'extrato', 'campanhas'],
      sidebarPriorities: ['/marketplace', '/services', '/extrato', '/banco'],
      crossModeHint: { actionId: 'vender', label: 'Voltar a vender' },
    },
  },
};

const PROFILE_GROUP: ActorContextProfile = {
  context: 'group',
  modeName: 'Grupo',
  quickActions: ['membros', 'votacoes', 'contribuir', 'campanhas', 'impacto', 'eventos', 'transferir', 'extrato'],
  dashboardCards: ['caixa-grupo', 'movimentacoes-mes', 'em-processamento'],
  sidebarPriorities: ['/grupos', '/votacoes', '/impacto', '/banco'],
  primaryCreateCta: { label: 'Criar votação', route: '/em-desenvolvimento?feature=group-vote' },
  contextualBanner: {
    title: 'Seu grupo coordenado',
    subtitle: 'Decisões coletivas, contribuições rastreáveis, impacto compartilhado',
    route: '/impacto',
  },
};

const PROFILE_CHANNEL: ActorContextProfile = {
  context: 'channel',
  modeName: 'Canal',
  quickActions: ['publicar', 'eventos', 'campanhas', 'marketplace', 'rede-social', 'transferir', 'extrato'],
  dashboardCards: ['meu-saldo', 'movimentacoes-mes', 'em-processamento'],
  sidebarPriorities: ['/social', '/eventos', '/marketplace'],
  primaryCreateCta: { label: 'Publicar conteúdo', route: '/social' },
};

const PROFILES_BY_CONTEXT: Record<AppContext, ActorContextProfile> = {
  pf: PROFILE_PF,
  pj: PROFILE_PJ,
  group: PROFILE_GROUP,
  channel: PROFILE_CHANNEL,
};

/**
 * Retorna o perfil operacional contextual conforme o AppContext.
 * Quando `mode` é informado e o profile tem `byOperatingMode[mode]`, retorna
 * profile com `quickActions` e `sidebarPriorities` substituídos pelo override.
 * Default: PF (fallback seguro).
 */
export function getActorContextProfile(
  context: AppContext | null | undefined,
  mode?: OperatingMode
): ActorContextProfile {
  const base = context ? PROFILES_BY_CONTEXT[context] ?? PROFILE_PF : PROFILE_PF;
  if (!mode || !base.byOperatingMode) return base;

  const override = base.byOperatingMode[mode];
  if (!override) return base;

  return {
    ...base,
    quickActions: override.quickActions ?? base.quickActions,
    sidebarPriorities: override.sidebarPriorities ?? base.sidebarPriorities,
  };
}

/**
 * Indica se o profile tem 2 modos operantes declarados (consumir + operar).
 * Usado pelo OperatingModeToggle para decidir se aparece (group/channel são
 * mono-modo — toggle some).
 */
export function profileHasTwoOperatingModes(profile: ActorContextProfile): boolean {
  const m = profile.byOperatingMode;
  return !!m && !!m.consumir && !!m.operar;
}

/**
 * Resolve cross-mode hint do profile no modo atual.
 */
function resolveCrossModeHint(
  baseProfile: ActorContextProfile,
  mode: OperatingMode | undefined
): CrossModeHint | null {
  if (!mode || !baseProfile.byOperatingMode) return null;
  return baseProfile.byOperatingMode[mode]?.crossModeHint ?? null;
}

/**
 * Resolve quick actions DEFINIÇÕES a partir do perfil contextual (sem profissão).
 * Mantida para compat — consumidores legados.
 */
export function resolveQuickActions(profile: ActorContextProfile, limit = 8): QuickActionDefinition[] {
  return profile.quickActions
    .map((id) => QUICK_ACTIONS_CATALOG[id])
    .filter((q): q is QuickActionDefinition => !!q)
    .slice(0, limit);
}

/**
 * Resolve quick actions COM ENVELOPE renderizável: 7 actions do modo + 1 cross-mode.
 *
 * Frase-âncora "prioriza, não esconde": slot 8 sugere o modo oposto sem trocar
 * de modo automaticamente. Visual menor.
 *
 * Estratégia:
 *   - Profissão (até 3) — APENAS quando mode === 'operar' (profissão refina trabalho,
 *     não consumo)
 *   - Actor mode quickActions preenchem até 7 (sem duplicar)
 *   - Slot 8: cross-mode hint do modo atual (action do modo oposto, label customizada)
 *
 * Quando profile NÃO tem byOperatingMode (group/channel mono-modo), cross-mode
 * não é adicionado — 8 actions normais.
 */
export function resolveQuickActionsWithProfession(
  profile: ActorContextProfile,
  professionalQuickActionIds: string[] | null | undefined,
  mode: OperatingMode | undefined,
  limit = 8
): RenderableQuickAction[] {
  const hint = resolveCrossModeHint(profile, mode);
  const reservedForCrossMode = hint ? 1 : 0;
  const normalSlots = Math.max(0, limit - reservedForCrossMode);

  const seen = new Set<string>();
  const normal: RenderableQuickAction[] = [];

  // 1. Profissão primeiro (até 3) — só faz sentido no modo Operar
  if (mode === 'operar' && professionalQuickActionIds && professionalQuickActionIds.length > 0) {
    for (const id of professionalQuickActionIds.slice(0, 3)) {
      const def = QUICK_ACTIONS_CATALOG[id];
      if (def && !seen.has(def.id) && normal.length < normalSlots) {
        normal.push({ definition: def, isCrossMode: false });
        seen.add(def.id);
      }
    }
  }

  // 2. Actor mode preenche até normalSlots (sem duplicar; pula se for o mesmo do hint)
  for (const id of profile.quickActions) {
    if (normal.length >= normalSlots) break;
    if (hint && id === hint.actionId) continue;
    const def = QUICK_ACTIONS_CATALOG[id];
    if (def && !seen.has(def.id)) {
      normal.push({ definition: def, isCrossMode: false });
      seen.add(def.id);
    }
  }

  // 3. Slot final: cross-mode hint (se houver)
  const result = [...normal];
  if (hint) {
    const def = QUICK_ACTIONS_CATALOG[hint.actionId];
    if (def && !seen.has(def.id)) {
      result.push({
        definition: def,
        isCrossMode: true,
        overrideLabel: hint.label,
      });
    }
  }

  return result.slice(0, limit);
}
