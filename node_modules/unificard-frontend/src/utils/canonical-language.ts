// frontend/src/utils/canonical-language.ts
// SPRINT 17: Linguagem Canônica & Expectativa Explícita
// Vocabulário canônico e microtextos de expectativa
//
// ═══════════════════════════════════════════════════════════════
// CONCEITO CANÔNICO (SPRINT 29)
// ═══════════════════════════════════════════════════════════════
// CONCEITO: Expectativa Explícita / Não-Ação / Vocabulário Canônico
// NÃO DUPLICAR ESTE CONCEITO
// 
// Este arquivo é o ponto canônico para:
// - Expectativa explícita (microtextos de expectativa)
// - Não-ação (consequências da não-ação)
// - Vocabulário canônico (termos padronizados)
// 
// Arquivos relacionados que USAM este conceito:
// - closure-continuity.ts (usa conceito de não-ação)
// - Componentes que exibem microtextos de expectativa
// 
// Para qualquer necessidade de expectativa/não-ação/vocabulário, use este arquivo.
// 
// ═══════════════════════════════════════════════════════════════
// EVOLUÇÃO CONCEITUAL (SPRINT 31)
// ═══════════════════════════════════════════════════════════════
// Este conceito pode evoluir ao longo do tempo.
// Mudanças de significado devem ser registradas em:
// INSTITUTIONAL_CONCEPT_EVOLUTIONS.md
// ═══════════════════════════════════════════════════════════════

/**
 * VOCABULÁRIO CANÔNICO
 * 
 * Termos padronizados para uso no sistema.
 * Uso correto: usar o termo exato.
 * Uso incorreto: comentário sobre o que evitar.
 */
export const CANONICAL_TERMS = {
  // Atores
  actor: {
    correct: 'ator',
    incorrect: 'usuário' // Usar apenas quando se referir ao usuário humano, não ao ator do sistema
  },
  user: {
    correct: 'usuário',
    incorrect: 'ator' // Usar apenas para pessoa física
  },
  company: {
    correct: 'empresa',
    incorrect: 'organização' // Empresa é termo específico (PJ)
  },
  page: {
    correct: 'página',
    incorrect: 'perfil' // Página é o ator institucional
  },
  
  // Ações
  allocation: {
    correct: 'alocação',
    incorrect: 'distribuição' // Alocação é termo técnico específico
  },
  dispute: {
    correct: 'disputa',
    incorrect: 'reclamação' // Disputa é termo institucional neutro
  },
  execution: {
    correct: 'execução',
    incorrect: 'processamento' // Execução é ação explícita do usuário
  },
  invitation: {
    correct: 'convite',
    incorrect: 'solicitação' // Convite é termo específico
  },
  
  // Recursos
  group: {
    correct: 'grupo',
    incorrect: 'comunidade' // Grupo é termo técnico específico
  },
  transaction: {
    correct: 'transação',
    incorrect: 'pagamento' // Transação é termo mais amplo
  },
  balance: {
    correct: 'saldo',
    incorrect: 'dinheiro' // Saldo é termo técnico específico
  },
} as const;

/**
 * MICROTEXTOS DE EXPECTATIVA
 * 
 * Textos curtos (máx. 2 linhas) que explicam o que o usuário está assumindo
 * ao realizar uma ação crítica. Linguagem neutra, sem promessas ou incentivos.
 */
export const EXPECTATION_TEXTS = {
  createCompany: {
    text: 'Ao criar uma empresa, você está assumindo que os dados informados são corretos e que você tem autoridade para representar esta empresa no sistema.',
    maxLines: 2
  },
  inviteCollaborator: {
    text: 'Ao convidar um colaborador, você está assumindo que esta pessoa tem autorização para atuar em nome da empresa e que os dados de acesso serão compartilhados de forma segura.',
    maxLines: 2
  },
  allocateGroups: {
    text: 'Ao alocar grupos, você está assumindo que a distribuição definida será aplicada a todas as transações futuras até que seja alterada.',
    maxLines: 2
  },
  executeFinancialAction: {
    text: 'Ao executar esta ação financeira, você está assumindo que os valores e destinatários estão corretos e que a transação será processada conforme as regras do sistema.',
    maxLines: 2
  },
  openDispute: {
    text: 'Ao abrir uma disputa, você está assumindo que a solicitação de revisão será analisada conforme os procedimentos institucionais do sistema.',
    maxLines: 2
  },
} as const;

/**
 * CONSEQUÊNCIAS DA NÃO-AÇÃO
 * 
 * Textos passivos que explicam o que acontece enquanto uma ação não é realizada.
 * Nunca usar linguagem punitiva.
 */
export const NON_ACTION_TEXTS = {
  groupAllocation: {
    text: 'Enquanto grupos não forem alocados, o saldo será mantido no fundo regional.',
    passive: true
  },
  memberInvitation: {
    text: 'Até que um membro seja convidado, apenas você terá acesso às funcionalidades da empresa.',
    passive: true
  },
  disputeNotOpened: {
    text: 'Enquanto uma disputa não for aberta, a ação permanecerá no estado atual.',
    passive: true
  },
} as const;

/**
 * Função auxiliar para obter termo canônico
 */
export function getCanonicalTerm(term: keyof typeof CANONICAL_TERMS): string {
  return CANONICAL_TERMS[term].correct;
}

/**
 * Função auxiliar para obter texto de expectativa
 */
export function getExpectationText(action: keyof typeof EXPECTATION_TEXTS): string {
  return EXPECTATION_TEXTS[action].text;
}

/**
 * Função auxiliar para obter texto de não-ação
 */
export function getNonActionText(context: keyof typeof NON_ACTION_TEXTS): string {
  return NON_ACTION_TEXTS[context].text;
}

