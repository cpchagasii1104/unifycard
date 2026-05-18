// frontend/src/config/businessProfileCatalog.ts
// 2026-05-18: catálogo de "perfis de negócio" da PJ (actor_type='page').
//
// Análogo a professionalContextCatalog (profissões de PF):
//   - Profissão (PF)   → contexto contextual da pessoa física
//   - BusinessProfile  → contexto contextual da empresa
//
// REGRAS (memory project_perfil_profissional_contextual + project_modo_operante):
//   - businessProfile é CAMADA SEMÂNTICA UX — não cria capability, authority
//     ou actor novo. Apenas reorganiza vocabulário/prioridade/agrupamento.
//   - Resolve via heurística sobre `display_name` da empresa (zero network).
//     Quando backend expuser `activity.mainActivityDescription` no
//     AvailableActor, resolver pode ser estendido para usar essa via primeiro.
//   - Fallback gracioso para PROFILE_PJ genérico se nada bater.
//
// IMPORTANTE: rotas que não têm backend ainda apontam para
// /em-desenvolvimento?feature=X (honest empty state).

import type { IntentGroup } from './actorContextConfig';

export interface BusinessProfileDefinition {
  /** Chave canônica (lowercase, snake_case). */
  key: string;
  /** Label em português. */
  label: string;
  /** Emoji representativo. */
  icon: string;
  /** Cor primária do perfil. */
  color: string;
  /** Palavras-chave para heurística de display_name (lowercase, sem acento). */
  displayNameKeywords: string[];
  /** IDs de quick actions sugeridas para este perfil (modo Operar). */
  suggestedQuickActions: string[];
  /** Sub-tagline contextual para banner/subtitle. */
  tagline: string;
  /**
   * Intent groups específicos deste perfil. Quando resolveIntentGroups recebe
   * este perfil, SUBSTITUI os intentGroups genéricos do PROFILE_PJ.
   */
  intentGroups: IntentGroup[];
  /**
   * Sidebar priorities específicas deste perfil. Quando presentes, são
   * mergeadas (não substituem) com as priorities do actor profile no
   * GlobalSidebar — princípio "prioriza, não esconde".
   * Opcional: sem este campo, sidebar usa apenas priorities do actor.
   */
  sidebarPriorities?: string[];
}

export const BUSINESS_PROFILES_CATALOG: Record<string, BusinessProfileDefinition> = {
  banda: {
    key: 'banda',
    label: 'Banda / Artista',
    icon: '🎸',
    color: '#8b5cf6',
    displayNameKeywords: ['band', 'banda', 'musica', 'musical', 'grupo musical', 'duo', 'trio', 'orquestra', 'coral', 'dj', 'mc '],
    suggestedQuickActions: ['shows-agenda', 'cache-pagamentos', 'equipe-tecnica', 'setlist-repertorio', 'venues-contratos', 'redes-fas'],
    tagline: 'shows, agenda e contratos em um só lugar',
    sidebarPriorities: ['/eventos', '/perfil?tab=agenda', '/social', '/banco', '/extrato'],
    intentGroups: [
      {
        title: 'Tocar e produzir',
        items: [
          { consume: ['Próximos shows', 'O que está marcado'], operate: ['Shows e agenda', 'Datas, locais e cachê'], icon: '🎤', route: '/perfil?tab=agenda' },
          { consume: ['Setlist', 'Repertório montado'], operate: ['Montar setlist', 'Repertório e ordem'], icon: '🎵', route: '/em-desenvolvimento?feature=setlist' },
          { consume: ['Eventos', 'Festivais e datas'], operate: ['Produzir evento próprio', 'Organizar e vender ingressos'], icon: '🎭', route: '/eventos' },
        ],
      },
      {
        title: 'Equipe e logística',
        items: [
          { consume: ['Buscar técnicos', 'Som, luz e palco'], operate: ['Equipe técnica', 'Som, luz, palco, transporte'], icon: '🎚️', route: '/em-desenvolvimento?feature=team' },
          { consume: ['Venues disponíveis', 'Locais para tocar'], operate: ['Venues e contratos', 'Casas de show e festivais'], icon: '📜', route: '/em-desenvolvimento?feature=venues' },
          { consume: ['Comprar equipamento', 'Instrumentos e som'], operate: ['Marketplace', 'Comprar e vender'], icon: '🛒', route: '/marketplace', tone: 'discover' },
        ],
      },
      {
        title: 'Audiência e dinheiro',
        items: [
          { consume: ['Conhecer fãs', 'Engajar audiência'], operate: ['Publicar conteúdo', 'Posts, vídeos e divulgação'], icon: '🔥', route: '/social' },
          { consume: ['Caixa', 'Saldo e movimentos'], operate: ['Cachê e pagamentos', 'Receber e cobrar'], icon: '💵', route: '/banco' },
          { consume: ['Extrato', 'Histórico financeiro'], operate: ['Extrato', 'Conferência e relatórios'], icon: '📄', route: '/extrato', tone: 'discover' },
        ],
      },
    ],
  },
  clinica: {
    key: 'clinica',
    label: 'Clínica / Consultório',
    icon: '🏥',
    color: '#06b6d4',
    displayNameKeywords: ['clinica', 'clínica', 'consultorio', 'consultório', 'odonto', 'odontologica', 'medical', 'medica', 'saude', 'saúde', 'hospital', 'laboratorio', 'laboratório'],
    suggestedQuickActions: ['atender-paciente', 'agenda-clinica', 'prontuarios', 'equipe-saude', 'convenios-planos'],
    tagline: 'pacientes, agenda e prontuários organizados',
    sidebarPriorities: ['/perfil?tab=agenda', '/services', '/banco', '/extrato', '/marketplace'],
    intentGroups: [
      {
        title: 'Atender pacientes',
        items: [
          { consume: ['Próximas consultas', 'Quem vem hoje'], operate: ['Atender paciente', 'Consulta, exame e cuidado'], icon: '🩺', route: '/perfil?tab=agenda' },
          { consume: ['Agenda clínica', 'Próximas reservas'], operate: ['Agenda clínica', 'Horários e marcações'], icon: '📅', route: '/perfil?tab=agenda' },
          { consume: ['Prontuários', 'Histórico de pacientes'], operate: ['Prontuários', 'Registros e evolução'], icon: '📋', route: '/em-desenvolvimento?feature=health-records', tone: 'discover' },
        ],
      },
      {
        title: 'Operar consultório',
        items: [
          { consume: ['Comprar insumos', 'Materiais e equipamentos'], operate: ['Comprar insumos', 'Marketplace de fornecedores'], icon: '🛒', route: '/marketplace' },
          { consume: ['Equipe', 'Quem está no time'], operate: ['Equipe', 'Cargos, escalas e permissões'], icon: '👥', route: '/em-desenvolvimento?feature=team' },
          { consume: ['Convênios', 'Planos atendidos'], operate: ['Convênios e planos', 'Cadastro e cobertura'], icon: '🩺', route: '/em-desenvolvimento?feature=health-plans', tone: 'discover' },
        ],
      },
      {
        title: 'Dinheiro e crescimento',
        items: [
          { consume: ['Caixa da clínica', 'Saldo e movimentos'], operate: ['Receber e cobrar', 'Pagamentos e caixa'], icon: '💰', route: '/banco' },
          { consume: ['Extrato', 'Histórico financeiro'], operate: ['Extrato', 'Conferência'], icon: '📄', route: '/extrato' },
          { consume: ['Conhecer pacientes', 'Networking de saúde'], operate: ['Publicar conteúdo', 'Educação em saúde'], icon: '✏️', route: '/social', tone: 'discover' },
        ],
      },
    ],
  },
  bar_restaurante: {
    key: 'bar_restaurante',
    label: 'Bar / Restaurante',
    icon: '🍽️',
    color: '#ef4444',
    displayNameKeywords: ['bar ', 'bar.', 'restaurante', 'pizzaria', 'lanchonete', 'cafe', 'café', 'cafeteria', 'churrascaria', 'pub', 'boteco', 'choperia', 'rotisseria', 'food', 'cozinha'],
    suggestedQuickActions: ['cardapio-precos', 'mesas-pedidos', 'comprar-insumos', 'equipe-salao', 'eventos-bar'],
    tagline: 'cardápio, mesas e operação do salão',
    sidebarPriorities: ['/marketplace', '/eventos', '/banco', '/services', '/extrato'],
    intentGroups: [
      {
        title: 'Servir',
        items: [
          { consume: ['Cardápio', 'O que está sendo servido'], operate: ['Cardápio e preços', 'Itens, fotos e preços'], icon: '📜', route: '/em-desenvolvimento?feature=menu' },
          { consume: ['Reservar mesa', 'Reservas e fila'], operate: ['Mesas e pedidos', 'Acompanhar salão'], icon: '🍽️', route: '/em-desenvolvimento?feature=tabs' },
          { consume: ['Comprar insumos', 'Bebidas, alimentos'], operate: ['Comprar insumos', 'Marketplace de fornecedores'], icon: '🛒', route: '/marketplace' },
        ],
      },
      {
        title: 'Equipe e gestão',
        items: [
          { consume: ['Equipe de salão', 'Garçons e cozinha'], operate: ['Equipe de salão', 'Escala e turnos'], icon: '👥', route: '/em-desenvolvimento?feature=team' },
          { consume: ['Caixa', 'Saldo e movimentos'], operate: ['Receber e cobrar', 'Pagamentos e caixa'], icon: '💰', route: '/banco' },
          { consume: ['Extrato', 'Histórico financeiro'], operate: ['Extrato', 'Relatórios e conferência'], icon: '📄', route: '/extrato', tone: 'discover' },
        ],
      },
      {
        title: 'Trazer público',
        items: [
          { consume: ['Próximos eventos', 'Programação local'], operate: ['Eventos no bar', 'Shows, festas e datas'], icon: '🎭', route: '/eventos' },
          { consume: ['Promoções perto', 'Ofertas locais'], operate: ['Lançar campanha', 'Promoções e divulgação'], icon: '📢', route: '/em-desenvolvimento?feature=campaigns', tone: 'discover' },
          { consume: ['Fidelidade', 'Clube de clientes'], operate: ['Fidelidade', 'Programa e recompensas'], icon: '⭐', route: '/em-desenvolvimento?feature=loyalty', tone: 'discover' },
        ],
      },
    ],
  },
  loja_varejo: {
    key: 'loja_varejo',
    label: 'Loja / Varejo',
    icon: '🛍️',
    color: '#f59e0b',
    displayNameKeywords: ['loja', 'store', 'shop', 'boutique', 'magazine', 'moda', 'vestuario', 'vestuário', 'roupa', 'calcad', 'calçad', 'mercearia', 'minimercado', 'supermercad', 'mercado'],
    suggestedQuickActions: ['vender', 'estoque-produtos', 'pdv-caixa', 'catalogo-vitrine', 'promocoes', 'fidelidade-clientes'],
    tagline: 'estoque, vendas e vitrine sempre prontos',
    sidebarPriorities: ['/marketplace', '/empresas', '/banco', '/extrato', '/services'],
    intentGroups: [
      {
        title: 'Vender',
        items: [
          { consume: ['Vitrine', 'Comparar e contratar'], operate: ['Vender produtos', 'Catálogo e ofertas'], icon: '🛍️', route: '/marketplace' },
          { consume: ['Comprar', 'Marketplace local'], operate: ['PDV / Caixa', 'Vendas presenciais'], icon: '🧾', route: '/pdv' },
          { consume: ['Meus pedidos', 'Compras e reservas'], operate: ['Atender pedidos', 'Separar, entregar e cobrar'], icon: '📦', route: '/meus-pedidos' },
        ],
      },
      {
        title: 'Estoque e fornecedores',
        items: [
          { consume: ['Buscar produto', 'O que está disponível'], operate: ['Estoque', 'Entrada, saída e contagem'], icon: '📦', route: '/empresa' },
          { consume: ['Buscar fornecedores', 'Insumos e marca'], operate: ['Comprar insumos', 'Marketplace de fornecedores'], icon: '🛒', route: '/marketplace' },
          { consume: ['Catálogo', 'O que está na vitrine'], operate: ['Catálogo / vitrine', 'Produtos publicados'], icon: '🛍️', route: '/marketplace', tone: 'discover' },
        ],
      },
      {
        title: 'Crescer',
        items: [
          { consume: ['Promoções perto', 'Ofertas locais'], operate: ['Promoções', 'Campanhas de venda'], icon: '🏷️', route: '/em-desenvolvimento?feature=promotions' },
          { consume: ['Fidelidade', 'Clube de clientes'], operate: ['Fidelidade', 'Programa e recompensas'], icon: '⭐', route: '/em-desenvolvimento?feature=loyalty', tone: 'discover' },
          { consume: ['Caixa', 'Saldo e movimentos'], operate: ['Receber e cobrar', 'Pagamentos e caixa'], icon: '💰', route: '/banco' },
        ],
      },
    ],
  },
  distribuidora: {
    key: 'distribuidora',
    label: 'Distribuidora / Atacado',
    icon: '📦',
    color: '#3b82f6',
    displayNameKeywords: ['distribuidora', 'atacad', 'atacão', 'atacão', 'logistica', 'logística', 'transportadora', 'frete', 'cargo'],
    suggestedQuickActions: ['pedidos-b2b', 'estoque-produtos', 'rotas-entregas', 'fornecedores', 'condicoes-pagamento'],
    tagline: 'pedidos B2B, estoque e logística',
    sidebarPriorities: ['/marketplace', '/empresas', '/banco', '/extrato', '/services'],
    intentGroups: [
      {
        title: 'Operar atacado',
        items: [
          { consume: ['Buscar fornecedores', 'Insumos e parcerias'], operate: ['Pedidos B2B', 'Vendas para empresas'], icon: '📋', route: '/em-desenvolvimento?feature=b2b-orders' },
          { consume: ['Estoque', 'O que está disponível'], operate: ['Estoque', 'Entrada, saída e contagem'], icon: '📦', route: '/empresa' },
          { consume: ['Acompanhar entrega', 'Rastrear pedido'], operate: ['Rotas e entregas', 'Logística e motorista'], icon: '🚚', route: '/em-desenvolvimento?feature=routes' },
        ],
      },
      {
        title: 'Comprar e abastecer',
        items: [
          { consume: ['Comparar fornecedores', 'Preços e condições'], operate: ['Fornecedores', 'Cadastro e cotação'], icon: '🏭', route: '/em-desenvolvimento?feature=suppliers' },
          { consume: ['Caixa', 'Saldo e movimentos'], operate: ['Receber e cobrar', 'Pagamentos e caixa'], icon: '💰', route: '/banco' },
          { consume: ['Condições', 'Crédito e prazo'], operate: ['Condições de pagamento', 'Crédito e prazo'], icon: '💳', route: '/em-desenvolvimento?feature=payment-terms', tone: 'discover' },
        ],
      },
      {
        title: 'Crescer carteira',
        items: [
          { consume: ['Conhecer clientes', 'Networking B2B'], operate: ['CRM e clientes', 'Histórico e funil'], icon: '👤', route: '/crm' },
          { consume: ['Vitrine', 'Marketplace B2B'], operate: ['Marketplace', 'Vitrine e ofertas'], icon: '🛒', route: '/marketplace' },
          { consume: ['Campanhas', 'Ofertas ativas'], operate: ['Lançar campanha', 'Promoções e divulgação'], icon: '📢', route: '/em-desenvolvimento?feature=campaigns', tone: 'discover' },
        ],
      },
    ],
  },
  oficina_servicos: {
    key: 'oficina_servicos',
    label: 'Oficina / Assistência Técnica',
    icon: '🔧',
    color: '#10b981',
    displayNameKeywords: ['oficina', 'mecanica', 'mecânica', 'auto eletrica', 'auto elétrica', 'borracharia', 'assistencia', 'assistência tecnica', 'assistência técnica', 'conserto', 'reparo'],
    suggestedQuickActions: ['ordens-servico', 'agenda-oficina', 'pecas-estoque', 'orcamentos-os', 'tecnicos-equipe'],
    tagline: 'ordens de serviço, peças e agenda',
    sidebarPriorities: ['/services', '/perfil?tab=agenda', '/marketplace', '/banco', '/extrato'],
    intentGroups: [
      {
        title: 'Atender clientes',
        items: [
          { consume: ['Buscar serviço', 'Marcar reparo'], operate: ['Ordens de serviço', 'Aberturas e andamento'], icon: '🛠️', route: '/service-orders' },
          { consume: ['Orçamento', 'Pedir preço'], operate: ['Orçamentos', 'Emitir e aprovar'], icon: '📐', route: '/em-desenvolvimento?feature=quotes' },
          { consume: ['Agenda', 'Próximos atendimentos'], operate: ['Agenda da oficina', 'Reservar e remarcar'], icon: '📅', route: '/perfil?tab=agenda' },
        ],
      },
      {
        title: 'Operar oficina',
        items: [
          { consume: ['Peças disponíveis', 'Estoque'], operate: ['Peças em estoque', 'Entrada, saída e contagem'], icon: '⚙️', route: '/empresa' },
          { consume: ['Buscar fornecedores', 'Peças e ferramentas'], operate: ['Comprar insumos', 'Marketplace de fornecedores'], icon: '🛒', route: '/marketplace' },
          { consume: ['Técnicos disponíveis', 'Quem está no time'], operate: ['Técnicos', 'Escala e produtividade'], icon: '👷', route: '/em-desenvolvimento?feature=team', tone: 'discover' },
        ],
      },
      {
        title: 'Crescer',
        items: [
          { consume: ['Caixa', 'Saldo e movimentos'], operate: ['Receber e cobrar', 'Pagamentos e caixa'], icon: '💰', route: '/banco' },
          { consume: ['Conhecer clientes', 'Networking local'], operate: ['Publicar conteúdo', 'Dicas e antes/depois'], icon: '✏️', route: '/social' },
          { consume: ['Fidelidade', 'Clube de clientes'], operate: ['Fidelidade', 'Programa e recompensas'], icon: '⭐', route: '/em-desenvolvimento?feature=loyalty', tone: 'discover' },
        ],
      },
    ],
  },
  escola_curso: {
    key: 'escola_curso',
    label: 'Escola / Curso',
    icon: '🎓',
    color: '#eab308',
    displayNameKeywords: ['escola', 'colegio', 'colégio', 'curso', 'academia', 'instituto', 'faculdade', 'ensino', 'school'],
    suggestedQuickActions: ['alunos-turmas', 'agenda-aulas', 'material-didatico', 'frequencia', 'mensalidades'],
    tagline: 'alunos, turmas e agenda acadêmica',
    sidebarPriorities: ['/perfil?tab=agenda', '/eventos', '/banco', '/social', '/extrato'],
    intentGroups: [
      {
        title: 'Ensinar',
        items: [
          { consume: ['Próximas aulas', 'Programação'], operate: ['Agenda de aulas', 'Turnos, salas e disciplinas'], icon: '📅', route: '/perfil?tab=agenda' },
          { consume: ['Alunos', 'Quem está matriculado'], operate: ['Alunos e turmas', 'Matrícula e turmas'], icon: '🎓', route: '/em-desenvolvimento?feature=students' },
          { consume: ['Material didático', 'Conteúdo e apostilas'], operate: ['Material didático', 'Publicar e organizar'], icon: '📚', route: '/em-desenvolvimento?feature=teaching-material', tone: 'discover' },
        ],
      },
      {
        title: 'Administrar',
        items: [
          { consume: ['Frequência', 'Histórico de presença'], operate: ['Frequência', 'Lançar presença'], icon: '✅', route: '/em-desenvolvimento?feature=attendance' },
          { consume: ['Mensalidades', 'Histórico de pagamento'], operate: ['Mensalidades', 'Cobrança e baixa'], icon: '💰', route: '/em-desenvolvimento?feature=tuition' },
          { consume: ['Equipe', 'Professores'], operate: ['Equipe', 'Cargos e escalas'], icon: '👥', route: '/em-desenvolvimento?feature=team', tone: 'discover' },
        ],
      },
      {
        title: 'Comunicar',
        items: [
          { consume: ['Eventos', 'Próximas datas'], operate: ['Criar evento', 'Encontros e formaturas'], icon: '🎭', route: '/eventos' },
          { consume: ['Conhecer alunos', 'Comunidade escolar'], operate: ['Publicar conteúdo', 'Avisos e novidades'], icon: '✏️', route: '/social' },
          { consume: ['Campanhas', 'Programas e bolsas'], operate: ['Lançar campanha', 'Divulgação e captação'], icon: '📢', route: '/em-desenvolvimento?feature=campaigns', tone: 'discover' },
        ],
      },
    ],
  },
  coletivo_organizacao: {
    key: 'coletivo_organizacao',
    label: 'Coletivo / Organização',
    icon: '🌱',
    color: '#84cc16',
    displayNameKeywords: ['coletivo', 'associaca', 'associação', 'instituto', 'ong', 'fundaca', 'fundação', 'cooperativa', 'sindicato', 'movimento'],
    suggestedQuickActions: ['projetos-coletivos', 'voluntarios-equipe', 'doacoes-arrecadacao', 'votacoes-internas', 'prestacao-contas'],
    tagline: 'projetos, voluntários e transparência',
    sidebarPriorities: ['/grupos', '/impacto', '/em-desenvolvimento?feature=votes', '/transparencia', '/banco'],
    intentGroups: [
      {
        title: 'Coordenar',
        items: [
          { consume: ['Projetos abertos', 'O que está em andamento'], operate: ['Projetos', 'Organizar iniciativas'], icon: '🌱', route: '/em-desenvolvimento?feature=projects' },
          { consume: ['Voluntários', 'Quem está participando'], operate: ['Voluntários', 'Inscrever e mobilizar'], icon: '🤝', route: '/em-desenvolvimento?feature=volunteers' },
          { consume: ['Agenda', 'Próximas atividades'], operate: ['Marcar atividade', 'Encontros e mutirões'], icon: '📅', route: '/agenda-unificada' },
        ],
      },
      {
        title: 'Mobilizar',
        items: [
          { consume: ['Doações abertas', 'Como contribuir'], operate: ['Doações e arrecadação', 'Metas e prestação'], icon: '💚', route: '/fundo-regional' },
          { consume: ['Campanhas ativas', 'Mobilização atual'], operate: ['Lançar campanha', 'Divulgação e segmentação'], icon: '📢', route: '/em-desenvolvimento?feature=campaigns' },
          { consume: ['Eventos', 'Próximas datas'], operate: ['Criar evento', 'Encontros e atos'], icon: '🎭', route: '/eventos', tone: 'discover' },
        ],
      },
      {
        title: 'Decidir e prestar contas',
        items: [
          { consume: ['Votações abertas', 'Decisões em curso'], operate: ['Abrir votação', 'Consulta e apuração'], icon: '🗳️', route: '/em-desenvolvimento?feature=votes' },
          { consume: ['Transparência', 'Acompanhar movimentos'], operate: ['Prestar contas', 'Medição e transparência'], icon: '📑', route: '/em-desenvolvimento?feature=accountability' },
          { consume: ['Impacto', 'Resultados visíveis'], operate: ['Medir impacto', 'Indicadores e relatórios'], icon: '🔍', route: '/transparencia', tone: 'discover' },
        ],
      },
    ],
  },
};

/**
 * Normaliza string para comparação heurística (lowercase, sem acento).
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/**
 * Resolve businessProfile a partir do display_name da empresa (heurística).
 * Retorna a primeira correspondência por keyword (ordem do catálogo).
 * Quando backend expuser activity.mainActivityDescription, adicionar parâmetro
 * `activityDescription?: string` e tentar essa via primeiro.
 *
 * Retorna null se nenhum perfil bater — caller cai em PROFILE_PJ genérico.
 */
export function resolveBusinessProfile(
  displayName: string | null | undefined,
  activityDescription?: string | null
): BusinessProfileDefinition | null {
  const haystacks: string[] = [];
  if (activityDescription) haystacks.push(normalize(activityDescription));
  if (displayName) haystacks.push(normalize(displayName));
  if (haystacks.length === 0) return null;

  for (const profile of Object.values(BUSINESS_PROFILES_CATALOG)) {
    for (const keyword of profile.displayNameKeywords) {
      const needle = normalize(keyword);
      if (haystacks.some((h) => h.includes(needle))) {
        return profile;
      }
    }
  }
  return null;
}

/**
 * Lista todos os perfis (para futuros onboarding/seletor).
 */
export function listBusinessProfiles(): BusinessProfileDefinition[] {
  return Object.values(BUSINESS_PROFILES_CATALOG).sort((a, b) =>
    a.label.localeCompare(b.label, 'pt-BR')
  );
}
