// frontend/src/components/events/wizard/WizardPageRegistry.ts
// FASE 5 — WIZARD PAGE REGISTRY
// 🔴 FRONTEND CANÔNICO — CAMADA DERIVADA
// - NÃO cria verdade
// - NÃO decide regras
// - NÃO resolve conflitos
// - Apenas declara estrutura
//
// Fonte única de verdade: treinamento/fases/fase_5_event_creation/FASE_5_WIZARD_PAGE_REGISTRY.md
// Este arquivo implementa EXATAMENTE o Page Registry documentado.

/**
 * Definição de uma página do Wizard
 */
export interface WizardPageDefinition {
  id: string;
  component: string; // Nome do componente (será resolvido dinamicamente)
}

/**
 * Page Registry - Tabela declarativa de composição
 * Mapeia event_type → lista ordenada de páginas
 * 
 * 🔴 REGRA INSTITUCIONAL:
 * - Determinístico
 * - Estático por versão
 * - Auditável
 * - Livre de lógica condicional
 */
export type WizardPageRegistry = {
  [eventType: string]: WizardPageDefinition[];
};

/**
 * Registry canônico conforme FASE_5_WIZARD_PAGE_REGISTRY.md
 * 
 * Event Type: BIRTHDAY
 * Ordem canônica das páginas:
 */
const BIRTHDAY_PAGES: WizardPageDefinition[] = [
  { id: "project_name", component: "CommonProjectNamePage" },
  { id: "birthday_profile", component: "BirthdayProfilePage" },
  { id: "attendance", component: "BirthdayAttendancePage" },
  { id: "location", component: "BirthdayLocationPage" },
  { id: "style_theme", component: "BirthdayStyleThemePage" },
  { id: "activities", component: "BirthdayActivitiesPage" },
  { id: "music_av", component: "BirthdayMusicAVPage" },
  { id: "support_services", component: "BirthdaySupportServicesPage" },
  { id: "time_window", component: "BirthdayTimeWindowPage" },
  { id: "finalize", component: "CommonFinalizePage" },
];

/**
 * Registry completo
 * 
 * 🔴 PROIBIÇÕES ABSOLUTAS:
 * - NÃO conter lógica de negócio
 * - NÃO conter if/else baseados em respostas do usuário
 * - NÃO decidir obrigatoriedade de campos
 * - NÃO inferir necessidades
 * - NÃO criar ou remover páginas dinamicamente
 * - NÃO acessar dados do EventSpec
 * - NÃO executar código assíncrono
 */
const registry: WizardPageRegistry = {
  birthday: BIRTHDAY_PAGES,
  // Outros event_types serão adicionados conforme necessário
};

/**
 * Obtém a lista de páginas para um event_type
 * 
 * @param eventType Tipo do evento
 * @returns Lista ordenada de páginas ou undefined se não registrado
 */
export function getPagesForEventType(eventType: string | null): WizardPageDefinition[] | undefined {
  if (!eventType) {
    return undefined;
  }
  return registry[eventType];
}

/**
 * Verifica se um event_type está registrado
 */
export function isEventTypeRegistered(eventType: string | null): boolean {
  if (!eventType) {
    return false;
  }
  return eventType in registry;
}

