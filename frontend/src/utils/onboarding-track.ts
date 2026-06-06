// frontend/src/utils/onboarding-track.ts
// F-PJ-ONBOARDING-MODULES-DERIVED-FROM-CLASSIFICATION
// Deriva o TRILHO INICIAL recomendado do onboarding PJ a partir do `domain` do concept classificado.
// 🔴 PROJEÇÃO de verdade resolvida — NÃO cria verdade. A verdade operacional é o par soberano
//    (companies.primary_company_type_id / primary_concept_id). `modules` é compat de UX, NÃO governa runtime.
// 🔴 Financeiro NUNCA é módulo operacional (Bank é infraestrutura, não checkbox de gosto).

import type { CompanyModules } from '../types/company-onboarding';

export interface OnboardingTrack {
  /** false quando o domínio é desconhecido/null → fallback honesto, sem inventar escolha. */
  derivable: boolean;
  /** Trilho principal derivado (apresentação). */
  items: string[];
  /** Observação honesta (complementos / bloqueios). */
  note: string | null;
  /** Compat de UX (NÃO operacional). financial sempre false. */
  modules: CompanyModules;
}

/**
 * Mapa domain → trilho recomendado. Slug NÃO é identidade; o domínio vem do backend (DECISION-0105/0107).
 * Verticais produto-first (`produtos-e-comercio`) → Trilho A (catálogo/estoque/oferta).
 * Verticais serviço (`servicos`) → Serviços + Agenda (pagamento/booking bloqueados até a cadeia financeira).
 */
export function deriveOnboardingTrackFromConceptDomain(
  domain: string | null | undefined
): OnboardingTrack {
  switch (domain) {
    case 'produtos-e-comercio':
      return {
        derivable: true,
        items: ['Produtos e catálogo', 'Estoque e disponibilidade', 'Ofertas e preços'],
        note: 'Depois você poderá adicionar serviços complementares, se fizer sentido.',
        modules: { services: false, events: false, calendar: false, financial: false },
      };
    case 'servicos':
      return {
        derivable: true,
        items: ['Serviços', 'Agenda e disponibilidade'],
        note: 'Pagamentos e reservas financeiras ficam bloqueados até a cadeia financeira estar pronta.',
        modules: { services: true, events: false, calendar: true, financial: false },
      };
    case 'cultura-lazer-e-eventos':
      return {
        derivable: true,
        items: ['Eventos (trilho reservado)'],
        note: 'O trilho de eventos é reservado para uma etapa futura.',
        modules: { services: false, events: true, calendar: false, financial: false },
      };
    default:
      return {
        derivable: false,
        items: [],
        note: 'Não foi possível derivar os módulos desta atividade. Confirme a atividade principal.',
        modules: { services: false, events: false, calendar: false, financial: false },
      };
  }
}
