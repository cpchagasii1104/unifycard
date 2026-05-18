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

  // ==========================================================
  // BusinessProfile actions (2026-05-18) — perfis específicos PJ.
  // Rotas reais quando módulo existe; /em-desenvolvimento?feature=X
  // (placeholder honesto) quando ainda não há backend.
  // ==========================================================

  // Banda / Artista
  'shows-agenda':      { id: 'shows-agenda',      label: 'Shows e agenda',      icon: '🎤', route: '/perfil?tab=agenda',                       color: '#8b5cf6' },
  'cache-pagamentos':  { id: 'cache-pagamentos',  label: 'Cachê e pagamentos',  icon: '💵', route: '/extrato',                                 color: '#10b981' },
  'equipe-tecnica':    { id: 'equipe-tecnica',    label: 'Equipe técnica',      icon: '🎚️', route: '/em-desenvolvimento?feature=team',         color: '#06b6d4' },
  'setlist-repertorio':{ id: 'setlist-repertorio',label: 'Setlist / repertório',icon: '🎵', route: '/em-desenvolvimento?feature=setlist',      color: '#8b5cf6' },
  'venues-contratos':  { id: 'venues-contratos',  label: 'Venues e contratos',  icon: '📜', route: '/em-desenvolvimento?feature=venues',       color: '#f59e0b' },
  'redes-fas':         { id: 'redes-fas',         label: 'Rede e fãs',          icon: '🔥', route: '/social',                                  color: '#ec4899' },

  // Clínica
  'prontuarios':       { id: 'prontuarios',       label: 'Prontuários',         icon: '📋', route: '/em-desenvolvimento?feature=health-records', color: '#06b6d4' },
  'equipe-saude':      { id: 'equipe-saude',      label: 'Equipe',              icon: '👥', route: '/em-desenvolvimento?feature=team',        color: '#06b6d4' },
  'convenios-planos':  { id: 'convenios-planos',  label: 'Convênios e planos',  icon: '🩺', route: '/em-desenvolvimento?feature=health-plans',color: '#3b82f6' },

  // Bar / Restaurante
  'cardapio-precos':   { id: 'cardapio-precos',   label: 'Cardápio e preços',   icon: '📜', route: '/em-desenvolvimento?feature=menu',        color: '#ef4444' },
  'mesas-pedidos':     { id: 'mesas-pedidos',     label: 'Mesas e pedidos',     icon: '🍽️', route: '/em-desenvolvimento?feature=tabs',        color: '#ef4444' },
  'equipe-salao':      { id: 'equipe-salao',      label: 'Equipe de salão',     icon: '👥', route: '/em-desenvolvimento?feature=team',        color: '#ef4444' },
  'eventos-bar':       { id: 'eventos-bar',       label: 'Eventos no bar',      icon: '🎭', route: '/eventos',                                color: '#ec4899' },

  // Loja / Varejo
  'estoque-produtos':  { id: 'estoque-produtos',  label: 'Estoque',             icon: '📦', route: '/empresa',                                color: '#f59e0b' },
  'pdv-caixa':         { id: 'pdv-caixa',         label: 'PDV / Caixa',         icon: '🧾', route: '/pdv',                                    color: '#10b981' },
  'catalogo-vitrine':  { id: 'catalogo-vitrine',  label: 'Catálogo / vitrine',  icon: '🛍️', route: '/marketplace',                            color: '#06b6d4' },
  'promocoes':         { id: 'promocoes',         label: 'Promoções',           icon: '🏷️', route: '/em-desenvolvimento?feature=promotions',  color: '#ec4899' },
  'fidelidade-clientes':{id: 'fidelidade-clientes',label: 'Fidelidade',         icon: '⭐', route: '/em-desenvolvimento?feature=loyalty',    color: '#f59e0b' },

  // Distribuidora
  'pedidos-b2b':       { id: 'pedidos-b2b',       label: 'Pedidos B2B',         icon: '📋', route: '/em-desenvolvimento?feature=b2b-orders',  color: '#3b82f6' },
  'rotas-entregas':    { id: 'rotas-entregas',    label: 'Rotas e entregas',    icon: '🚚', route: '/em-desenvolvimento?feature=routes',      color: '#10b981' },
  'condicoes-pagamento':{id: 'condicoes-pagamento',label: 'Condições',          icon: '💳', route: '/em-desenvolvimento?feature=payment-terms', color: '#f59e0b' },

  // Oficina / Assistência técnica
  'ordens-servico':    { id: 'ordens-servico',    label: 'Ordens de serviço',   icon: '🛠️', route: '/service-orders',                         color: '#10b981' },
  'agenda-oficina':    { id: 'agenda-oficina',    label: 'Agenda',              icon: '📅', route: '/perfil?tab=agenda',                      color: '#06b6d4' },
  'pecas-estoque':     { id: 'pecas-estoque',     label: 'Peças em estoque',    icon: '⚙️', route: '/empresa',                                color: '#f59e0b' },
  'orcamentos-os':     { id: 'orcamentos-os',     label: 'Orçamentos',          icon: '📐', route: '/em-desenvolvimento?feature=quotes',      color: '#3b82f6' },
  'tecnicos-equipe':   { id: 'tecnicos-equipe',   label: 'Técnicos',            icon: '👷', route: '/em-desenvolvimento?feature=team',        color: '#eab308' },

  // Escola / Curso
  'alunos-turmas':     { id: 'alunos-turmas',     label: 'Alunos e turmas',     icon: '🎓', route: '/em-desenvolvimento?feature=students',    color: '#eab308' },
  'agenda-aulas':      { id: 'agenda-aulas',      label: 'Agenda de aulas',     icon: '📅', route: '/perfil?tab=agenda',                      color: '#3b82f6' },
  'material-didatico': { id: 'material-didatico', label: 'Material didático',   icon: '📚', route: '/em-desenvolvimento?feature=teaching-material', color: '#8b5cf6' },
  'frequencia':        { id: 'frequencia',        label: 'Frequência',          icon: '✅', route: '/em-desenvolvimento?feature=attendance',  color: '#10b981' },
  'mensalidades':      { id: 'mensalidades',      label: 'Mensalidades',        icon: '💰', route: '/em-desenvolvimento?feature=tuition',     color: '#f59e0b' },

  // Coletivo / Organização
  'projetos-coletivos':{ id: 'projetos-coletivos',label: 'Projetos',            icon: '🌱', route: '/em-desenvolvimento?feature=projects',    color: '#84cc16' },
  'voluntarios-equipe':{ id: 'voluntarios-equipe',label: 'Voluntários',         icon: '🤝', route: '/em-desenvolvimento?feature=volunteers',  color: '#10b981' },
  'doacoes-arrecadacao':{id: 'doacoes-arrecadacao',label: 'Doações',           icon: '💚', route: '/fundo-regional',                         color: '#10b981' },
  'votacoes-internas': { id: 'votacoes-internas', label: 'Votações internas',   icon: '🗳️', route: '/em-desenvolvimento?feature=votes',       color: '#3b82f6' },
  'prestacao-contas':  { id: 'prestacao-contas',  label: 'Prestação de contas', icon: '📑', route: '/em-desenvolvimento?feature=accountability', color: '#8b5cf6' },
  'transparencia':     { id: 'transparencia',     label: 'Transparência',       icon: '🔍', route: '/transparencia',                          color: '#06b6d4' },
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
  /** Intent groups específicos deste modo (substitui os do profile base). */
  intentGroups?: IntentGroup[];
}

// ============================================================
// INTENT GROUPS — bloco "O que você busca agora?" contextual
// ============================================================

/**
 * Item de intenção com dois rótulos (consume/operate) trocados pelo modo ativo.
 * Mantém formato compatível com o array literal histórico de DashboardHome.
 */
export interface IntentItem {
  /** [label, hint] para modo consumir. */
  consume: [string, string];
  /** [label, hint] para modo operar. */
  operate: [string, string];
  /** Emoji do item. */
  icon: string;
  /** Rota de destino ao clicar (usa /em-desenvolvimento?feature=X quando WIP). */
  route: string;
  /** Tom visual opcional: 'discover' renderiza versão suave/secundária. */
  tone?: 'discover';
}

export interface IntentGroup {
  /** Título do agrupamento. */
  title: string;
  /** Items na ordem desejada. */
  items: IntentItem[];
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
  /**
   * Intent groups (painel "O que você busca agora?") base do profile.
   * byOperatingMode pode sobrescrever. resolveIntentGroups consome.
   */
  intentGroups?: IntentGroup[];
  /**
   * Subtítulo contextual do header (substitui o genérico "Bem-vindo de volta").
   * Quando ausente, getActorGreetingSubtitle cai no fallback genérico.
   */
  greetingSubtitle?: string;
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

// Intent groups universais de PF — usados também como fallback de PJ genérico
// e como base composta quando PF profissional adiciona grupo da profissão.
const INTENT_GROUPS_PF: IntentGroup[] = [
  {
    title: 'Resolver agora',
    items: [
      { consume: ['Pedir comida', 'Restaurantes e mercados'], operate: ['Fazer entrega', 'Levar pedidos e atender rotas'], icon: '🍔', route: '/em-desenvolvimento?feature=food' },
      { consume: ['Pedir transporte', 'Carro, corrida e rota'], operate: ['Dirigir carro', 'Aceitar corridas e rotas'], icon: '🚙', route: '/em-desenvolvimento?feature=mobility' },
      { consume: ['Fazer compras', 'Produtos e ofertas'], operate: ['Vender produtos', 'Ofertas e loja'], icon: '🛒', route: '/marketplace' },
      { consume: ['Contratar serviço', 'Profissionais perto'], operate: ['Prestar serviço', 'Agenda e atendimento'], icon: '🛠️', route: '/services' },
    ],
  },
  {
    title: 'Vida pessoal',
    items: [
      { consume: ['Saúde', 'Clínicas e cuidados'], operate: ['Atender pacientes', 'Consultas, exames e cuidados'], icon: '🩺', route: '/services', tone: 'discover' },
      { consume: ['Família', 'Cuidados e rotina'], operate: ['Organizar família', 'Cuidadores, tarefas e apoio'], icon: '👨‍👩‍👧', route: '/services', tone: 'discover' },
      { consume: ['Agenda', 'Horários e reservas'], operate: ['Abrir horários', 'Turnos, recursos e reservas'], icon: '📅', route: '/agenda-unificada', tone: 'discover' },
      { consume: ['Compromissos', 'Pendências e confirmações'], operate: ['Confirmar atendimentos', 'Demandas, tarefas e presença'], icon: '✅', route: '/compromissos', tone: 'discover' },
      { consume: ['Estudos', 'Cursos e aprendizado'], operate: ['Ensinar ou mentorar', 'Aulas e conteúdos'], icon: '📚', route: '/marketplace', tone: 'discover' },
      { consume: ['Documentos', 'Registros e comprovantes'], operate: ['Validar documentos', 'Cadastro, dados e aprovação'], icon: '📄', route: '/perfil', tone: 'discover' },
    ],
  },
  {
    title: 'Trabalho e dinheiro',
    items: [
      { consume: ['Trabalhar', 'Renda e oportunidade'], operate: ['Aceitar trabalho', 'Serviços, turnos e produção'], icon: '💼', route: '/services' },
      { consume: ['Transferir', 'Enviar dinheiro'], operate: ['Cobrar ou receber', 'Pagamentos e caixa'], icon: '↗️', route: '/banco' },
      { consume: ['Benefícios', 'Vantagens e auxílios'], operate: ['Gerir benefícios', 'Campanhas e regras'], icon: '🎁', route: '/fundo-regional', tone: 'discover' },
      { consume: ['Meus pedidos', 'Compras e reservas'], operate: ['Separar pedidos', 'Preparo, entrega e retirada'], icon: '📦', route: '/meus-pedidos', tone: 'discover' },
    ],
  },
  {
    title: 'Relacionar e participar',
    items: [
      { consume: ['Conhecer alguém', 'Rede social e grupos'], operate: ['Moderar comunidade', 'Canal, conversa e relação'], icon: '❤️', route: '/social' },
      { consume: ['Vizinhos', 'Bairro e comunidade'], operate: ['Mobilizar vizinhos', 'Avisos, pedidos e bairro'], icon: '🏘️', route: '/grupos', tone: 'discover' },
      { consume: ['Condomínio', 'Avisos e assembleias'], operate: ['Administrar condomínio', 'Assembleias e comunicados'], icon: '🏢', route: '/grupos', tone: 'discover' },
      { consume: ['Projetos', 'Iniciativas coletivas'], operate: ['Coordenar projeto', 'Execução e prestação'], icon: '🌱', route: '/social', tone: 'discover' },
      { consume: ['Votações', 'Decisões da comunidade'], operate: ['Criar votação', 'Consulta e apuração'], icon: '🗳️', route: '/em-desenvolvimento?feature=votes', tone: 'discover' },
      { consume: ['Impacto local', 'Resultados e fundo regional'], operate: ['Prestar contas', 'Medição e transparência'], icon: '💚', route: '/impacto', tone: 'discover' },
      { consume: ['Ajuda mútua', 'Pedidos e colaboração'], operate: ['Organizar ajuda', 'Mutirões e apoio'], icon: '🤝', route: '/social', tone: 'discover' },
    ],
  },
  {
    title: 'Lazer, cultura e bens',
    items: [
      { consume: ['Eventos', 'Ingressos e agenda'], operate: ['Produzir evento', 'Organizar, vender e receber'], icon: '🎭', route: '/eventos' },
      { consume: ['Campeonatos', 'Esporte, games e torneios'], operate: ['Organizar campeonato', 'Times, chaves e inscrições'], icon: '🏆', route: '/eventos', tone: 'discover' },
      { consume: ['Lazer', 'Passeios e experiências'], operate: ['Criar experiência', 'Agenda e venda'], icon: '🎡', route: '/eventos', tone: 'discover' },
      { consume: ['Moradia', 'Casa, aluguel e serviços'], operate: ['Anunciar imóvel', 'Locação e atendimento'], icon: '🏠', route: '/marketplace/real-estate', tone: 'discover' },
      { consume: ['Viajar', 'Passagens e hospedagem'], operate: ['Vender turismo', 'Pacotes, roteiros e hospedagem'], icon: '🧳', route: '/eventos', tone: 'discover' },
      { consume: ['Cuidar do PET', 'Buscar ou localizar'], operate: ['Atender PET', 'Banho, passeio e cuidado'], icon: '🐶', route: '/services', tone: 'discover' },
      { consume: ['Locações', 'Alugar perto de você'], operate: ['Anunciar locação', 'Reservas e entrega'], icon: '🔑', route: '/em-desenvolvimento?feature=locacoes', tone: 'discover' },
    ],
  },
];

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
  greetingSubtitle: 'Bem-vindo de volta ao UnifiCard',
  intentGroups: INTENT_GROUPS_PF,
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

// Intent groups genéricos de empresa (PJ sem businessProfile resolvido).
// Quando businessProfile resolve, intentGroups específicos do perfil são
// usados em lugar destes (ver resolveIntentGroups).
const INTENT_GROUPS_PJ_GENERIC: IntentGroup[] = [
  {
    title: 'Operar o negócio',
    items: [
      { consume: ['Buscar fornecedores', 'Insumos e contratos'], operate: ['Vender produtos', 'Ofertas e loja'], icon: '🛒', route: '/marketplace' },
      { consume: ['Contratar serviço', 'Profissionais e parceiros'], operate: ['Prestar serviço', 'Agenda e atendimento'], icon: '🛠️', route: '/services' },
      { consume: ['Meus pedidos', 'Compras e contratos'], operate: ['Atender pedidos', 'Separar, entregar e cobrar'], icon: '📦', route: '/meus-pedidos' },
      { consume: ['Agenda', 'Reservas e compromissos'], operate: ['Abrir horários', 'Turnos, recursos e reservas'], icon: '📅', route: '/agenda-unificada' },
    ],
  },
  {
    title: 'Equipe e clientes',
    items: [
      { consume: ['Conhecer parceiros', 'Networking e indicações'], operate: ['Gerir equipe', 'Cargos, escalas e permissões'], icon: '👥', route: '/empresas', tone: 'discover' },
      { consume: ['Vitrine', 'Comparar e contratar'], operate: ['CRM e clientes', 'Histórico, conversas e funil'], icon: '👤', route: '/crm', tone: 'discover' },
      { consume: ['Campanhas locais', 'Ofertas perto'], operate: ['Lançar campanha', 'Divulgação e segmentação'], icon: '📢', route: '/em-desenvolvimento?feature=campaigns', tone: 'discover' },
    ],
  },
  {
    title: 'Dinheiro e crescimento',
    items: [
      { consume: ['Comprar insumos', 'Marketplace de fornecedores'], operate: ['Receber e cobrar', 'Pagamentos e caixa'], icon: '↗️', route: '/banco' },
      { consume: ['Benefícios', 'Vantagens corporativas'], operate: ['Extrato', 'Conferência e relatórios'], icon: '📄', route: '/extrato' },
      { consume: ['Eventos', 'Patrocínio e presença'], operate: ['Produzir evento', 'Organizar, vender e receber'], icon: '🎭', route: '/eventos', tone: 'discover' },
    ],
  },
];

const PROFILE_PJ: ActorContextProfile = {
  context: 'pj',
  modeName: 'Empresa',
  // Fallback = modo Operar (estado padrão da empresa)
  quickActions: ['vender', 'campanhas', 'pedidos', 'crm', 'contratar', 'marketplace', 'transferir'],
  dashboardCards: ['caixa-empresa', 'movimentacoes-mes', 'em-processamento', 'limite-disponivel'],
  sidebarPriorities: ['/marketplace', '/services', '/banco', '/extrato'],
  primaryCreateCta: { label: 'Criar campanha', route: '/em-desenvolvimento?feature=campaign' },
  greetingSubtitle: 'Operando sua empresa no UnifiCard',
  intentGroups: INTENT_GROUPS_PJ_GENERIC,
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

// Intent groups de Grupo — coordenação coletiva.
const INTENT_GROUPS_GROUP: IntentGroup[] = [
  {
    title: 'Coordenar o grupo',
    items: [
      { consume: ['Membros', 'Quem participa'], operate: ['Convidar membros', 'Adicionar e gerir papéis'], icon: '👥', route: '/grupos' },
      { consume: ['Próximos eventos', 'Encontros e atividades'], operate: ['Criar evento', 'Organizar e convidar'], icon: '🎭', route: '/eventos' },
      { consume: ['Agenda do grupo', 'Compromissos'], operate: ['Marcar compromisso', 'Datas, horários e presença'], icon: '📅', route: '/agenda-unificada' },
    ],
  },
  {
    title: 'Decidir e mobilizar',
    items: [
      { consume: ['Votações abertas', 'Decisões em curso'], operate: ['Abrir votação', 'Consulta e apuração'], icon: '🗳️', route: '/em-desenvolvimento?feature=votes', tone: 'discover' },
      { consume: ['Campanhas ativas', 'Mobilização atual'], operate: ['Lançar campanha', 'Divulgação e segmentação'], icon: '📢', route: '/em-desenvolvimento?feature=campaigns', tone: 'discover' },
      { consume: ['Impacto', 'Resultados e prestação'], operate: ['Prestar contas', 'Medição e transparência'], icon: '💚', route: '/impacto' },
    ],
  },
  {
    title: 'Apoiar e contribuir',
    items: [
      { consume: ['Caixa do grupo', 'Saldo e movimentos'], operate: ['Receber e cobrar', 'Pagamentos e caixa'], icon: '💰', route: '/banco' },
      { consume: ['Contribuir', 'Apoiar coletivamente'], operate: ['Organizar arrecadação', 'Metas e doações'], icon: '🌱', route: '/em-desenvolvimento?feature=group-contribution' },
      { consume: ['Extrato', 'Histórico financeiro'], operate: ['Auditar', 'Conferência e relatórios'], icon: '📄', route: '/extrato', tone: 'discover' },
    ],
  },
];

const PROFILE_GROUP: ActorContextProfile = {
  context: 'group',
  modeName: 'Grupo',
  quickActions: ['membros', 'votacoes', 'contribuir', 'campanhas', 'impacto', 'eventos', 'transferir', 'extrato'],
  dashboardCards: ['caixa-grupo', 'movimentacoes-mes', 'em-processamento'],
  // RC9 (2026-05-18): /votacoes era rota fantasma (DT-MODULE-VOTES-FANTASMA).
  // Mantemos no priority highlight, mas apontando para placeholder honesto.
  sidebarPriorities: ['/grupos', '/em-desenvolvimento?feature=votes', '/impacto', '/banco'],
  primaryCreateCta: { label: 'Criar votação', route: '/em-desenvolvimento?feature=group-vote' },
  greetingSubtitle: 'Coordenando o grupo no UnifiCard',
  intentGroups: INTENT_GROUPS_GROUP,
  contextualBanner: {
    title: 'Seu grupo coordenado',
    subtitle: 'Decisões coletivas, contribuições rastreáveis, impacto compartilhado',
    route: '/impacto',
  },
};

// Intent groups de Canal — publicação e audiência.
const INTENT_GROUPS_CHANNEL: IntentGroup[] = [
  {
    title: 'Publicar e engajar',
    items: [
      { consume: ['Feed', 'Acompanhar atualizações'], operate: ['Publicar conteúdo', 'Posts, vídeos e enquetes'], icon: '✏️', route: '/social' },
      { consume: ['Eventos', 'Próximas datas'], operate: ['Criar evento', 'Organizar e divulgar'], icon: '🎭', route: '/eventos' },
      { consume: ['Campanhas', 'Conferir o que está ativo'], operate: ['Lançar campanha', 'Divulgação e segmentação'], icon: '📢', route: '/em-desenvolvimento?feature=campaigns' },
    ],
  },
  {
    title: 'Crescer e monetizar',
    items: [
      { consume: ['Marketplace', 'Explorar oportunidades'], operate: ['Vender produtos', 'Ofertas e loja'], icon: '🛍️', route: '/marketplace', tone: 'discover' },
      { consume: ['Caixa do canal', 'Saldo e movimentos'], operate: ['Receber e cobrar', 'Pagamentos e caixa'], icon: '💰', route: '/banco' },
      { consume: ['Extrato', 'Histórico financeiro'], operate: ['Conferir movimentos', 'Relatórios'], icon: '📄', route: '/extrato', tone: 'discover' },
    ],
  },
];

const PROFILE_CHANNEL: ActorContextProfile = {
  context: 'channel',
  modeName: 'Canal',
  quickActions: ['publicar', 'eventos', 'campanhas', 'marketplace', 'rede-social', 'transferir', 'extrato'],
  dashboardCards: ['meu-saldo', 'movimentacoes-mes', 'em-processamento'],
  sidebarPriorities: ['/social', '/eventos', '/marketplace'],
  primaryCreateCta: { label: 'Publicar conteúdo', route: '/social' },
  greetingSubtitle: 'Publicando no UnifiCard',
  intentGroups: INTENT_GROUPS_CHANNEL,
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

// ============================================================
// INTENT GROUPS resolver — usado por DashboardHome
// ============================================================

/**
 * Descritor mínimo para projeção contextual extra:
 *  - profession: dimensão da PF (resolve via useProfessionalContext)
 *  - business:   dimensão da PJ (resolve via useBusinessProfile)
 *
 * Cada um pode contribuir com 1 grupo "Sua [profissão/negócio] hoje"
 * inserido no topo dos intentGroups base, e/ou substituir os groups
 * base por groups próprios quando definido.
 *
 * Estrutura mínima — caller passa apenas o que tem. Evita acoplamento
 * direto entre actorContextConfig e os catálogos profissional/business.
 */
export interface ContextualOverlay {
  /** Label do grupo extra ("Sua clínica hoje", "Seu show hoje"). */
  title?: string;
  /** IDs de quick actions usadas para construir items consume/operate idênticos. */
  quickActionIds?: string[];
  /** Quando presente, SUBSTITUI os intentGroups base do profile. */
  intentGroupsOverride?: IntentGroup[];
}

/**
 * Resolve intent groups finais para render no DashboardHome.
 *
 * Estratégia:
 *  1. Se override (business profile com intentGroups próprios) → usa override.
 *  2. Senão, começa com profile.byOperatingMode[mode].intentGroups (se houver)
 *     ou profile.intentGroups (base).
 *  3. Se profession overlay tem quickActionIds e mode === 'operar', insere
 *     grupo "Sua profissão hoje" no topo construindo items a partir das ações
 *     profissionais (consume/operate compartilham o mesmo label — profissão
 *     é dimensão de operação, não de consumo).
 *
 * Princípio: profession reorganiza prioridade, businessProfile substitui base.
 */
export function resolveIntentGroups(
  profile: ActorContextProfile,
  mode: OperatingMode | undefined,
  professionOverlay?: ContextualOverlay | null,
  businessOverlay?: ContextualOverlay | null
): IntentGroup[] {
  // 1. Business profile pode substituir base completamente
  if (businessOverlay?.intentGroupsOverride && businessOverlay.intentGroupsOverride.length > 0) {
    return businessOverlay.intentGroupsOverride;
  }

  // 2. Profile base (com override de modo se aplicável)
  const fromMode = mode ? profile.byOperatingMode?.[mode]?.intentGroups : undefined;
  const base = fromMode ?? profile.intentGroups ?? [];

  // 3. Profession overlay no topo (apenas modo Operar — profissão é trabalho)
  if (
    mode === 'operar' &&
    professionOverlay?.quickActionIds &&
    professionOverlay.quickActionIds.length > 0
  ) {
    const items: IntentItem[] = professionOverlay.quickActionIds
      .map((id) => QUICK_ACTIONS_CATALOG[id])
      .filter((q): q is QuickActionDefinition => !!q)
      .slice(0, 4)
      .map<IntentItem>((q) => ({
        consume: [q.label, 'Sua profissão'],
        operate: [q.label, 'Sua profissão'],
        icon: q.icon,
        route: q.route,
      }));
    if (items.length > 0) {
      const topGroup: IntentGroup = {
        title: professionOverlay.title ?? 'Sua profissão hoje',
        items,
      };
      return [topGroup, ...base];
    }
  }

  return base;
}

// ============================================================
// Greeting subtitle — header contextual
// ============================================================

/**
 * Subtítulo do header derivado do profile contextual.
 * Cai em fallback genérico se profile não declarar greetingSubtitle.
 */
export function getActorGreetingSubtitle(
  profile: ActorContextProfile,
  mode?: OperatingMode
): string {
  if (profile.greetingSubtitle) {
    if (profile.context === 'pf') {
      return mode === 'operar' ? 'Pronto para trabalhar' : profile.greetingSubtitle;
    }
    return profile.greetingSubtitle;
  }
  return 'Bem-vindo de volta ao UnifiCard';
}
