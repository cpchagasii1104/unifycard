// backend/src/modules/fiscal/fiscal-profile.types.ts
// DECISION-0166 D9 (Lei do Contador) — Fase 4b: CASA CANÔNICA ÚNICA do perfil fiscal.
//
// Vocabulário ratificado no D9.5. Este é o ÚNICO TaxRegime do sistema — os dois vocabulários
// fantasmas ('MEI'|'LUCRO_PRESUMIDO'|'LUCRO_REAL' de company-profile e 'MEI'|'SIMPLES'|
// 'PRESUMIDO'|'REAL' de tax-profile) convergiram para cá na 4b. Grafias curtas (SIMPLES/
// PRESUMIDO/REAL) NÃO são regime canônico.
//
// O sistema NÃO é autoridade fiscal e NÃO substitui contador: quem configura o enquadramento
// é o contribuinte/contador/admin autorizado; ausência de configuração = FISCAL_CONFIG_MISSING
// (nunca regime inventado, nunca exceção engolida como dado).

export const TAX_REGIMES = [
  'MEI',
  'SIMPLES_NACIONAL',
  'LUCRO_PRESUMIDO',
  'LUCRO_REAL',
  'OTHER',
] as const;

export type TaxRegime = (typeof TAX_REGIMES)[number];

/** Status canônico de configuração fiscal ausente (D9.2) — rastro, nunca silêncio. */
export const FISCAL_CONFIG_MISSING = 'fiscal_config_missing' as const;

export interface FiscalProfile {
  id: string;
  tenantId: string;
  /** Âncora canônica: fiscal_identities (CNPJ + KYB) — nunca texto solto. */
  fiscalIdentityId: string;
  actorId: string | null;
  taxRegime: TaxRegime;
  status: 'draft' | 'active' | 'deprecated';
  version: number;
  effectiveFrom: string;
  effectiveUntil: string | null;
  configuredByActorId: string | null;
  source: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CreateFiscalProfileInput {
  tenantId: string;
  fiscalIdentityId: string;
  actorId?: string | null;
  taxRegime: TaxRegime;
  effectiveFrom?: Date;
  configuredByActorId?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown>;
}
