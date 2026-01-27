// frontend/src/services/event-wizard-rules.ts
// Regras declarativas para Event Wizard Adaptativo
// 🔴 BLINDAGEM: Regras são declarativas, não hardcoded
// 🔴 BLINDAGEM: Nenhuma automação silenciosa

import type {
  EventWizardContext,
  WizardQuestion,
  ServiceSuggestion,
  ModuleActivation,
  WizardConfiguration,
} from '../types/event-wizard';

/**
 * Regras de perguntas por contexto
 */
export function getWizardConfiguration(context: EventWizardContext): WizardConfiguration {
  const questions: WizardQuestion[] = [];
  const serviceSuggestions: ServiceSuggestion[] = [];
  const moduleActivations: ModuleActivation[] = [];

  // Perguntas base (sempre presentes)
  questions.push({
    id: 'needs_assistance',
    question: 'Quer ajuda para organizar este evento?',
    helpText: 'Podemos te ajudar a encontrar fornecedores e serviços adequados.',
    type: 'yes_no',
    required: false,
  });

  // Capacidade prevista (obrigatória para compatibilidade)
  questions.push({
    id: 'expected_attendance',
    question: 'Quantas pessoas você espera no evento?',
    helpText: 'Isso nos ajuda a encontrar artistas e serviços adequados ao tamanho do evento.',
    type: 'number',
    required: true,
  });

  // Perguntar se já tem local definido ANTES de perguntar sobre infraestrutura
  questions.push({
    id: 'has_venue',
    question: 'Você já tem um local definido para o evento?',
    helpText: 'Se você já sabe onde será o evento, podemos perguntar sobre a infraestrutura disponível.',
    type: 'yes_no',
    required: false,
  });

  // Infraestrutura do local (só aparece se já tem local)
  questions.push({
    id: 'venue_infrastructure',
    question: 'O que o local já possui disponível?',
    helpText: 'Selecione todos os itens que o local já tem. Isso evita contratar o que já existe.',
    type: 'multiple_choice',
    options: [
      { value: 'PA', label: 'PA (Sistema de som)' },
      { value: 'monitor', label: 'Monitor de retorno' },
      { value: 'backline', label: 'Backline (instrumentos)' },
      { value: 'iluminação', label: 'Iluminação' },
      { value: 'palco', label: 'Palco' },
      { value: 'som', label: 'Som básico' },
      { value: 'energia', label: 'Energia elétrica adequada' },
      { value: 'internet', label: 'Internet/WiFi' },
      { value: 'estacionamento', label: 'Estacionamento' },
      { value: 'camarim', label: 'Camarim' },
      { value: 'área de carga', label: 'Área de carga/descarga' },
      { value: 'elevador', label: 'Elevador' },
    ],
    required: false,
    showCondition: (answers) => answers.has_venue === true,
  });

  // Serviços operacionais necessários (só aparece se precisa de ajuda)
  questions.push({
    id: 'operational_services',
    question: 'Quais serviços operacionais você precisa?',
    helpText: 'Selecione todos os serviços que você precisa contratar para o evento.',
    type: 'multiple_choice',
    options: [
      { value: 'limpeza', label: 'Limpeza' },
      { value: 'segurança', label: 'Segurança' },
      { value: 'recepcionista', label: 'Recepcionista' },
      { value: 'garçom', label: 'Garçom/Garçonete' },
      { value: 'cozinha', label: 'Equipe de cozinha' },
      { value: 'bar', label: 'Equipe de bar' },
      { value: 'fotografia', label: 'Fotografia' },
      { value: 'filmagem', label: 'Filmagem' },
    ],
    required: false,
    showCondition: (answers) => answers.needs_assistance === true,
  });

  // Comidas e bebidas (só aparece se precisa de ajuda)
  questions.push({
    id: 'food_and_beverages',
    question: 'O que você deseja servir de comidas e bebidas?',
    helpText: 'Selecione todos os itens que você precisa para o evento.',
    type: 'multiple_choice',
    options: [], // Será preenchido por tipo de evento
    required: false,
    showCondition: (answers) => answers.needs_assistance === true,
  });

  // Perguntas específicas por tipo de evento
  if (context.eventSubtype === 'birthday') {
    questions.push({
      id: 'birthday_help',
      question: 'Precisa de ajuda com comida, decoração ou música?',
      helpText: 'Para aniversários, geralmente precisamos de buffet, decoração e som.',
      type: 'yes_no',
      required: false,
      showCondition: (answers) => answers.needs_assistance === true,
    });

    // Itens específicos para aniversário (só aparece se precisa de ajuda)
    questions.push({
      id: 'birthday_items',
      question: 'Quais itens você precisa para a festa?',
      helpText: 'Selecione todos os itens que você precisa para o aniversário.',
      type: 'multiple_choice',
      options: [
        { value: 'decoração', label: 'Decoração temática' },
        { value: 'mesa_doces', label: 'Mesa de doces' },
        { value: 'brindes', label: 'Brindes/Lembrancinhas' },
      ],
      required: false,
      showCondition: (answers) => answers.needs_assistance === true,
    });

    // Atualizar opções de comidas e bebidas para aniversário
    const foodBeveragesQuestion = questions.find(q => q.id === 'food_and_beverages');
    if (foodBeveragesQuestion) {
      foodBeveragesQuestion.options = [
        { value: 'bolo', label: 'Bolo' },
        { value: 'salgados', label: 'Salgados' },
        { value: 'doces', label: 'Doces' },
        { value: 'bebidas_alcoolicas', label: 'Bebidas alcoólicas' },
        { value: 'bebidas_nao_alcoolicas', label: 'Bebidas não alcoólicas' },
        { value: 'buffet_completo', label: 'Buffet completo' },
        { value: 'coffee_break', label: 'Coffee break' },
        { value: 'brunch', label: 'Brunch' },
      ];
    }

    serviceSuggestions.push(
      {
        category: 'Buffet/Comida',
        description: 'Buffet para aniversário',
        canCreateBundle: true,
      },
      {
        category: 'Decoração',
        description: 'Decoração temática',
        canCreateBundle: true,
      },
      {
        category: 'Som/Música',
        description: 'DJ ou banda para festa',
        canCreateBundle: true,
      },
      {
        category: 'Confeitaria',
        description: 'Bolo e doces personalizados',
        canCreateBundle: true,
      }
    );
  }

  if (context.eventSubtype === 'nightclub') {
    questions.push({
      id: 'nightclub_genre',
      question: 'Qual o gênero musical principal?',
      helpText: 'Isso nos ajuda a encontrar artistas adequados.',
      type: 'multiple_choice',
      options: [
        { value: 'electronic', label: 'Eletrônica' },
        { value: 'hiphop', label: 'Hip Hop' },
        { value: 'rock', label: 'Rock' },
        { value: 'sertanejo', label: 'Sertanejo' },
        { value: 'funk', label: 'Funk' },
        { value: 'other', label: 'Outro' },
      ],
      required: false,
      showCondition: (answers) => answers.needs_assistance === true,
    });

    questions.push({
      id: 'nightclub_lineup',
      question: 'Quer organizar um line-up (sequência de artistas)?',
      helpText: 'Podemos te ajudar a encontrar múltiplos artistas e organizar a ordem.',
      type: 'yes_no',
      required: false,
      showCondition: (answers) => answers.needs_assistance === true,
    });

    // Atualizar opções de comidas e bebidas para balada
    const foodBeveragesQuestionNightclub = questions.find(q => q.id === 'food_and_beverages');
    if (foodBeveragesQuestionNightclub) {
      foodBeveragesQuestionNightclub.options = [
        { value: 'bebidas_alcoolicas', label: 'Bebidas alcoólicas (bar completo)' },
        { value: 'bebidas_nao_alcoolicas', label: 'Bebidas não alcoólicas' },
        { value: 'petiscos', label: 'Petiscos' },
        { value: 'finger_food', label: 'Finger food' },
        { value: 'open_bar', label: 'Open bar' },
      ];
    }

    serviceSuggestions.push(
      {
        category: 'Artistas',
        description: 'Artistas por gênero musical',
        canCreateBundle: true,
        discoveryFilters: {
          actorType: 'user', // Artistas geralmente são users
        },
      },
      {
        category: 'Som/Iluminação',
        description: 'Equipamento de som e iluminação',
        canCreateBundle: true,
      }
    );

    moduleActivations.push({
      module: 'bundles',
      reason: 'Line-up de artistas pode ser organizado como bundle',
    });
  }

  if (context.eventSubtype === 'corporate') {
    questions.push({
      id: 'corporate_budget',
      question: 'Tem orçamento controlado?',
      helpText: 'Para eventos corporativos, podemos ajudar a controlar custos.',
      type: 'yes_no',
      required: false,
      showCondition: (answers) => answers.needs_assistance === true,
    });

    questions.push({
      id: 'corporate_rigid_schedule',
      question: 'O horário é rígido?',
      helpText: 'Eventos corporativos geralmente têm horários fixos.',
      type: 'yes_no',
      required: false,
      showCondition: (answers) => answers.needs_assistance === true,
    });

    // Atualizar opções de comidas e bebidas para corporativo
    const foodBeveragesQuestion = questions.find(q => q.id === 'food_and_beverages');
    if (foodBeveragesQuestion) {
      foodBeveragesQuestion.options = [
        { value: 'coffee_break', label: 'Coffee break' },
        { value: 'brunch', label: 'Brunch' },
        { value: 'almoço', label: 'Almoço' },
        { value: 'jantar', label: 'Jantar' },
        { value: 'cocktail', label: 'Cocktail' },
        { value: 'bebidas_alcoolicas', label: 'Bebidas alcoólicas' },
        { value: 'bebidas_nao_alcoolicas', label: 'Bebidas não alcoólicas' },
        { value: 'buffet_completo', label: 'Buffet completo' },
      ];
    }

    serviceSuggestions.push(
      {
        category: 'Serviços Técnicos',
        description: 'Som, projeção, internet',
        canCreateBundle: true,
      },
      {
        category: 'Coffee Break',
        description: 'Coffee break ou catering',
        canCreateBundle: false,
      }
    );

    moduleActivations.push({
      module: 'calendar',
      reason: 'Eventos corporativos precisam de agenda rígida',
    });

    if (context.actorType === 'page') {
      moduleActivations.push({
        module: 'financial',
        reason: 'Empresas geralmente precisam de controle financeiro',
      });
    }
  }

  // Se não foi definido por tipo de evento, usar opções genéricas
  const foodBeveragesQuestion = questions.find(q => q.id === 'food_and_beverages');
  if (foodBeveragesQuestion && (!foodBeveragesQuestion.options || foodBeveragesQuestion.options.length === 0)) {
    foodBeveragesQuestion.options = [
      { value: 'bebidas_alcoolicas', label: 'Bebidas alcoólicas' },
      { value: 'bebidas_nao_alcoolicas', label: 'Bebidas não alcoólicas' },
      { value: 'petiscos', label: 'Petiscos' },
      { value: 'finger_food', label: 'Finger food' },
      { value: 'buffet_completo', label: 'Buffet completo' },
      { value: 'coffee_break', label: 'Coffee break' },
    ];
  }

  // Perguntas específicas por tipo de actor
  if (context.actorType === 'user') {
    questions.push({
      id: 'user_budget_aware',
      question: 'Tem um orçamento em mente?',
      helpText: 'Isso nos ajuda a sugerir serviços adequados.',
      type: 'yes_no',
      required: false,
      showCondition: (answers) => answers.needs_assistance === true,
    });
  }

  if (context.actorType === 'page') {
    questions.push({
      id: 'page_recurring',
      question: 'Este evento é recorrente?',
      helpText: 'Empresas podem ter eventos semanais ou mensais.',
      type: 'yes_no',
      required: false,
    });

    if (context.eventSubtype === 'nightclub') {
      questions.push({
        id: 'page_recurring_availability',
        question: 'Quer filtrar artistas por disponibilidade recorrente?',
        helpText: 'Artistas que tocam regularmente podem ser mais adequados.',
        type: 'yes_no',
        required: false,
        showCondition: (answers) => answers.page_recurring === true && answers.needs_assistance === true,
      });
    }
  }

  // Módulos base
  moduleActivations.push({
    module: 'services',
    reason: 'Eventos geralmente precisam de serviços',
  });

  moduleActivations.push({
    module: 'calendar',
    reason: 'Eventos precisam de agenda',
  });

  return {
    context,
    questions,
    serviceSuggestions,
    moduleActivations,
    skipSteps: [], // Nenhum passo é obrigatório
  };
}

/**
 * Gera texto de ajuda contextual
 */
export function getContextualHelpText(context: EventWizardContext, questionId: string): string | undefined {
  if (context.eventSubtype === 'birthday' && questionId === 'birthday_help') {
    return 'Para aniversários, geralmente precisamos de buffet, decoração e som. Podemos te ajudar a encontrar fornecedores.';
  }

  if (context.eventSubtype === 'nightclub' && questionId === 'nightclub_lineup') {
    return 'Um line-up organiza a sequência de artistas. Podemos criar um bundle com múltiplos artistas no mesmo horário.';
  }

  if (context.eventSubtype === 'corporate' && questionId === 'corporate_rigid_schedule') {
    return 'Eventos corporativos geralmente têm horários fixos. Vamos garantir que todos os serviços estejam disponíveis no horário exato.';
  }

  return undefined;
}

