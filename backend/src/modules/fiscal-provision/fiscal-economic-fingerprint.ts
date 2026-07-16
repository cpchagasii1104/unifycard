// backend/src/modules/fiscal-provision/fiscal-economic-fingerprint.ts
// FISCAL-4E — DECISION-0179 D11 + DECISION-0182.
//
// Fingerprint fiscal-econômico DETERMINÍSTICO e canônico do CONTEXTO que alteraria a materialização
// da reserva fiscal. É EVIDÊNCIA/idempotência, nunca saldo. Vive em coluna dedicada
// (bank_transactions.fiscal_economic_context_fingerprint / fiscal_provision_events.
// fiscal_economic_context_fingerprint), NUNCA embutido em reference_id.
//
// SEPARAÇÃO SELADA (DECISION-0179 D11, errata):
//   IDENTIDADE DA OPERAÇÃO (externa) = (tenant_id, reference_type, reference_id) — raiz de idempotência,
//     vive na tuple de referência do bank_transaction / fiscal_provision_event, combinada pelo repository.
//   IDENTIDADE DO PAYLOAD (interna)  = fiscal_economic_context_fingerprint — este hash.
//   Por isso `reference_type` e `reference_id` NÃO entram no preimage. `tenant_id` permanece apenas
//   como DIMENSÃO MATERIAL / isolamento de contexto, nunca como substituto da tuple externa.
// Regras: mesma tuple + MESMO fingerprint = idempotente; mesma tuple + fingerprint DIFERENTE =
//   IDEMPOTENCY_PAYLOAD_MISMATCH (enforçado no repository); tuple diferente + mesmo fingerprint = operação
//   distinta (sem colisão de idempotência). Alterar SÓ reference_id/reference_type NÃO muda este hash.
// Determinismo: serialização canônica (chaves de objeto ordenadas; arrays não-ordenados ordenados por
//   chave canônica explícita; arrays materialmente ordenados preservam ordem); distinção null/ausente/
//   vazio quando material; valores monetários inteiros; sha256 (runtime, sem dep nova); zero timestamp.

import { createHash } from 'node:crypto';

/** Fatos fiscal-econômicos do PAYLOAD que determinam a materialização (NÃO a identidade externa da operação). */
export interface FiscalEconomicFingerprintInput {
  // dimensão material / isolamento (NÃO é a tuple externa de idempotência)
  tenantId: string;
  // identidade fiscal e enquadramento
  fiscalIdentityId: string;
  taxpayerKind: string;
  taxRegime: string | null;
  platformRevenueStream: string | null;
  conceptId: string | null;
  // território (papéis distintos)
  fiscalJurisdiction: unknown;
  buyerTerritory: unknown;
  // policy/versões
  economicPolicyId: string | null;
  taxRuleVersions: Array<{ taxRuleId: string; version: number }>;
  // moeda + valores inteiros (centavos)
  currency: string;
  commissionGrossCents: number;
  taxReserveCents: number;
  commissionDistributableCents: number;
  // continuação residual (DECISION-0182): source line + destino preservado
  sourceLineIdentity: unknown;
  sourceDestination: unknown;
  // reversão
  eventKind: 'provision' | 'full_reversal';
  reversesEventId: string | null;
  // versão do schema/snapshot
  snapshotVersion: number;
}

/**
 * Serialização canônica: chaves de objeto ordenadas recursivamente; arrays preservam ordem semântica
 * (o chamador já normaliza a ordem quando ela é irrelevante — ex.: taxRuleVersions ordenado por id).
 * Distingue explicitamente null (JSON null) de ausente (chave omitida) e vazio ('' / [] / {}).
 * Números inteiros exigidos nos campos monetários (validação fail-closed).
 */
function canonicalize(value: unknown): unknown {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) out[k] = canonicalize(obj[k]);
    return out;
  }
  return value;
}

function assertInt(name: string, n: number): void {
  if (!Number.isInteger(n)) {
    throw Object.assign(new Error(`FISCAL_FINGERPRINT_NON_INTEGER: ${name}=${n}`), { statusCode: 422 });
  }
}

/** Normaliza taxRuleVersions em ordem determinística (por taxRuleId, depois version). */
function normalizeRuleVersions(v: Array<{ taxRuleId: string; version: number }>): Array<[string, number]> {
  return [...v]
    .map((r) => [r.taxRuleId, r.version] as [string, number])
    .sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] < b[0] ? -1 : 1));
}

export function computeFiscalEconomicFingerprint(input: FiscalEconomicFingerprintInput): string {
  assertInt('commissionGrossCents', input.commissionGrossCents);
  assertInt('taxReserveCents', input.taxReserveCents);
  assertInt('commissionDistributableCents', input.commissionDistributableCents);
  assertInt('snapshotVersion', input.snapshotVersion);

  // Payload canônico e ESTÁVEL (versão do algoritmo do fingerprint fixada em 'v1').
  // NÃO contém reference_type/reference_id (identidade externa da operação — vive na tuple).
  const payload = {
    v: 'fiscal-economic-fingerprint/v1',
    tenantId: input.tenantId,
    fiscalIdentityId: input.fiscalIdentityId,
    taxpayerKind: input.taxpayerKind,
    taxRegime: input.taxRegime,
    platformRevenueStream: input.platformRevenueStream,
    conceptId: input.conceptId,
    fiscalJurisdiction: canonicalize(input.fiscalJurisdiction),
    buyerTerritory: canonicalize(input.buyerTerritory),
    economicPolicyId: input.economicPolicyId,
    taxRuleVersions: normalizeRuleVersions(input.taxRuleVersions),
    currency: input.currency,
    commissionGrossCents: input.commissionGrossCents,
    taxReserveCents: input.taxReserveCents,
    commissionDistributableCents: input.commissionDistributableCents,
    sourceLineIdentity: canonicalize(input.sourceLineIdentity),
    sourceDestination: canonicalize(input.sourceDestination),
    eventKind: input.eventKind,
    reversesEventId: input.reversesEventId,
    snapshotVersion: input.snapshotVersion,
  };

  const canonicalJson = JSON.stringify(canonicalize(payload));
  return createHash('sha256').update(canonicalJson).digest('hex');
}
