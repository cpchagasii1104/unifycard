// company-readiness.service.ts
// 🟢 F-COMPANY-READINESS-PROJECTION — projeção READ-ONLY de readiness de OFERTA por company/provider/concept.
//
// Consome o PREDICADO ÚNICO `evaluateOfferingActivationEligibility` (a MESMA fonte que o P3 activation gate
// usa para dar throw) — NÃO há segunda regra, logo UI e gate NUNCA divergem ("UI diz pronto" vs "gate deixa ativar").
// Marcos são PROJEÇÃO/diagnóstico, NÃO autoridade: não autorizam dinheiro, não substituem P3/P5/KYB/authority.
// NÃO escreve nada. As booleans companyReady/providerReady/sellerReady são DERIVADAS de `reasons` (o detalhe é o SSOT).

import {
  evaluateOfferingActivationEligibility,
  type OfferingActivationEligibilityInput,
} from '@modules/services/services-offering-activation-gate';

export interface CompanyOfferingReadiness {
  /** SSOT da projeção: a oferta deste concept pode ser ATIVADA (= o P3 gate deixaria). */
  ready: boolean;
  /** Códigos OFFERING_ACTIVATION_* faltantes (detalhe autoritativo; companyReady/etc. derivam daqui). */
  reasons: string[];
  /** Derivado: empresa operacional + KYB aprovado (PJ). PF (sem company) = N/A → true. */
  companyReady: boolean;
  /** Derivado: provider elegível (PJ: KYB; PF: civil-mínimo + não-bloqueado). */
  providerReady: boolean;
  /** Derivado: oferta ativável (= ready; inclui publicação/declaração do concept). */
  sellerReady: boolean;
}

const has = (reasons: string[], code: string): boolean => reasons.some((r) => r.includes(code));

/**
 * Readiness READ-ONLY de uma oferta (provider × company × concept). Lê o predicado único; não escreve.
 * Autoridade de leitura é responsabilidade do caller (rota): canRepresentActor(provider) server-side.
 */
export async function getCompanyOfferingReadiness(
  input: OfferingActivationEligibilityInput
): Promise<CompanyOfferingReadiness> {
  const { ok, reasons } = await evaluateOfferingActivationEligibility(input);
  const isPJ = input.companyId != null;
  return {
    ready: ok,
    reasons,
    companyReady: isPJ
      ? !has(reasons, 'COMPANY_NOT_OPERATIONAL') && !has(reasons, 'KYB_REQUIRED')
      : true, // PF: sem company → companyReady N/A
    providerReady: isPJ
      ? !has(reasons, 'KYB_REQUIRED')
      : !has(reasons, 'CIVIL_MINIMUM_REQUIRED') && !has(reasons, 'ACTOR_BLOCKED'),
    sellerReady: ok,
  };
}
