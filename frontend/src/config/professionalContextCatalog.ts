// frontend/src/config/professionalContextCatalog.ts
// 2026-05-15: catálogo de "modos profissionais" da pessoa física.
// Materializa diretriz Clayton: "perfil profissional contextual — universos
// operacionais" + "lente operacional vs caixinhas isoladas".
//
// REGRA DE DIVISÃO (memory project_perfil_profissional_contextual):
//   - actor SEPARADO: empresa, banda, ONG, restaurante, comunidade (com agenda
//     própria + operação própria + membros próprios)
//   - CONTEXTO CONTEXTUAL: profissão, skill, interesse, área (NÃO cria actor;
//     sistema reorganiza feed/marketplace/suggestões pelo profile)
//
// Este catálogo define as PROFISSÕES como contextos contextuais.
// Quando user tem profile.metadata.profession='confeiteira', sistema lê este
// catálogo para reorganizar UX (feed, quick actions, sugestões) — sem criar
// actor_type='professional'.
//
// NÃO autoriza criar pages/empresas automaticamente; é apenas adaptação visual
// e de prioridade.

export interface ProfessionalContextDefinition {
  /** Chave canônica armazenada em profile.metadata.profession (lowercase, sem acento). */
  key: string;
  /** Label em português. */
  label: string;
  /** Variante feminina opcional. */
  labelFemale?: string;
  /** Emoji representativo. */
  icon: string;
  /** Cor primária do "modo". */
  color: string;
  /** Áreas/segmentos típicos para sugestão e filtros. */
  areas: string[];
  /** Categorias do marketplace relevantes ao profissional. */
  marketplaceCategories: string[];
  /** Quick actions sugeridas para o modo profissional. */
  suggestedQuickActions: string[];
  /** Tags semânticas que o feed prioriza para esse contexto. */
  feedTags: string[];
}

// Profissões já presentes no seed teste (Maria/Lúcia/João dentista) + extras
// frequentemente citados por Clayton nas diretrizes (pintor, fotógrafo,
// arquiteto, eletricista, etc.). Todas como sub-modos do user PF.
export const PROFESSIONS_CATALOG: Record<string, ProfessionalContextDefinition> = {
  dentista: {
    key: 'dentista',
    label: 'Dentista',
    icon: '🦷',
    color: '#06b6d4',
    areas: ['odontologia', 'implantes', 'estetica_dental', 'ortodontia', 'endodontia'],
    marketplaceCategories: ['materiais_odontologicos', 'equipamentos_clinica', 'cursos_odontologia'],
    suggestedQuickActions: ['atender-paciente', 'agenda-clinica', 'marketplace'],
    feedTags: ['odontologia', 'implantes', 'workshop', 'fornecedores'],
  },
  advogada: {
    key: 'advogada',
    label: 'Advogado(a)',
    icon: '⚖️',
    color: '#3b82f6',
    areas: ['direito_empresarial', 'lgpd', 'consultoria', 'civel', 'trabalhista'],
    marketplaceCategories: ['cursos_juridico', 'consultoria_juridica', 'literatura_juridica'],
    suggestedQuickActions: ['nova-consulta', 'agenda-juridica', 'publicar-conteudo'],
    feedTags: ['juridico', 'lgpd', 'workshop', 'networking_profissional'],
  },
  advogado: {
    key: 'advogado',
    label: 'Advogado(a)',
    icon: '⚖️',
    color: '#3b82f6',
    areas: ['direito_empresarial', 'lgpd', 'consultoria', 'civel', 'trabalhista'],
    marketplaceCategories: ['cursos_juridico', 'consultoria_juridica', 'literatura_juridica'],
    suggestedQuickActions: ['nova-consulta', 'agenda-juridica', 'publicar-conteudo'],
    feedTags: ['juridico', 'lgpd', 'workshop', 'networking_profissional'],
  },
  confeiteira: {
    key: 'confeiteira',
    label: 'Confeiteiro(a)',
    icon: '🎂',
    color: '#ec4899',
    areas: ['doces', 'bolos_casamento', 'festas_infantis', 'sobremesas_finas'],
    marketplaceCategories: ['ingredientes', 'embalagens', 'equipamentos_confeitaria', 'cursos_confeitaria'],
    suggestedQuickActions: ['nova-encomenda', 'agenda-entregas', 'publicar-portfolio'],
    feedTags: ['confeitaria', 'doces', 'casamentos', 'encomendas'],
  },
  confeiteiro: {
    key: 'confeiteiro',
    label: 'Confeiteiro(a)',
    icon: '🎂',
    color: '#ec4899',
    areas: ['doces', 'bolos_casamento', 'festas_infantis', 'sobremesas_finas'],
    marketplaceCategories: ['ingredientes', 'embalagens', 'equipamentos_confeitaria'],
    suggestedQuickActions: ['nova-encomenda', 'agenda-entregas', 'publicar-portfolio'],
    feedTags: ['confeitaria', 'doces', 'casamentos', 'encomendas'],
  },
  fotografo: {
    key: 'fotografo',
    label: 'Fotógrafo(a)',
    icon: '📷',
    color: '#8b5cf6',
    areas: ['casamentos', 'eventos', 'retratos', 'produto', 'comercial'],
    marketplaceCategories: ['equipamentos_foto', 'edicao', 'cursos_fotografia'],
    suggestedQuickActions: ['novo-ensaio', 'agenda-fotos', 'publicar-portfolio'],
    feedTags: ['fotografia', 'casamentos', 'ensaios', 'portfolio'],
  },
  arquiteto: {
    key: 'arquiteto',
    label: 'Arquiteto(a)',
    icon: '📐',
    color: '#f59e0b',
    areas: ['residencial', 'comercial', 'reforma', 'interiores'],
    marketplaceCategories: ['materiais_construcao', 'mobiliario', 'cursos_arquitetura'],
    suggestedQuickActions: ['novo-projeto', 'agenda-cliente', 'publicar-portfolio'],
    feedTags: ['arquitetura', 'reforma', 'interiores', 'projetos'],
  },
  pintor: {
    key: 'pintor',
    label: 'Pintor(a)',
    icon: '🎨',
    color: '#10b981',
    areas: ['residencial', 'comercial', 'textura', 'artistica'],
    marketplaceCategories: ['tintas', 'ferramentas_pintura', 'cursos_pintura'],
    suggestedQuickActions: ['novo-orcamento', 'agenda-obras', 'publicar-antes-depois'],
    feedTags: ['pintura', 'obras', 'antes_depois', 'fornecedores'],
  },
  eletricista: {
    key: 'eletricista',
    label: 'Eletricista',
    icon: '⚡',
    color: '#eab308',
    areas: ['residencial', 'industrial', 'predial', 'automacao'],
    marketplaceCategories: ['ferramentas_eletrica', 'materiais_eletricos', 'cursos_nr10'],
    suggestedQuickActions: ['novo-orcamento', 'agenda-servico', 'publicar-conteudo'],
    feedTags: ['eletrica', 'nr10', 'obras', 'manutencao'],
  },
  personal_trainer: {
    key: 'personal_trainer',
    label: 'Personal Trainer',
    icon: '💪',
    color: '#ef4444',
    areas: ['musculacao', 'funcional', 'reabilitacao', 'outdoor'],
    marketplaceCategories: ['equipamentos_treino', 'suplementacao', 'cursos_educacao_fisica'],
    suggestedQuickActions: ['novo-aluno', 'agenda-treinos', 'publicar-conteudo'],
    feedTags: ['fitness', 'treino', 'saude', 'nutricao'],
  },
  psicologo: {
    key: 'psicologo',
    label: 'Psicólogo(a)',
    icon: '🧠',
    color: '#a855f7',
    areas: ['clinica', 'organizacional', 'infantil', 'casal'],
    marketplaceCategories: ['cursos_psicologia', 'literatura_psicologia', 'testes_psicometricos'],
    suggestedQuickActions: ['nova-sessao', 'agenda-pacientes', 'publicar-conteudo'],
    feedTags: ['psicologia', 'saude_mental', 'workshop', 'networking'],
  },
  musico: {
    key: 'musico',
    label: 'Músico(a) Profissional',
    icon: '🎵',
    color: '#8b5cf6',
    areas: ['ao_vivo', 'estudio', 'aulas', 'composicao'],
    marketplaceCategories: ['instrumentos', 'equipamentos_som', 'cursos_musica'],
    suggestedQuickActions: ['nova-agenda', 'publicar-portfolio', 'networking-artistas'],
    feedTags: ['musica', 'shows', 'instrumentos', 'networking_artistico'],
  },
};

/**
 * Normaliza profissão para chave canônica (lowercase, sem acento, snake_case).
 */
function normalizeProfession(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
    .trim();
}

/**
 * Resolve definição de contexto profissional a partir de string livre.
 * Retorna null se não houver mapeamento no catálogo.
 */
export function resolveProfessionalContext(
  rawProfession: string | null | undefined
): ProfessionalContextDefinition | null {
  const key = normalizeProfession(rawProfession);
  if (!key) return null;
  return PROFESSIONS_CATALOG[key] ?? null;
}

/**
 * Lista de profissões disponíveis (para autocomplete/onboarding).
 */
export function listAvailableProfessions(): ProfessionalContextDefinition[] {
  // Deduplica por label (advogada/advogado, confeiteira/confeiteiro etc.)
  const seen = new Set<string>();
  const result: ProfessionalContextDefinition[] = [];
  for (const def of Object.values(PROFESSIONS_CATALOG)) {
    if (seen.has(def.label)) continue;
    seen.add(def.label);
    result.push(def);
  }
  return result.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}
