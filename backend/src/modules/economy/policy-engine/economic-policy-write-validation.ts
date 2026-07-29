// backend/src/modules/economy/policy-engine/economic-policy-write-validation.ts
//
// FATIA 2 (F-ECONOMIC-POLICY-ADMIN-FRONT) — validação ANTES de gravar (§4.9.5) para o write API
// de versões de economic_policy. Duas responsabilidades SEPARADAS por desenho:
//
//   1. assertPolicyLinesValid — ÚNICO PONTO DE EXTENSÃO GOVERNADO para validação de PERCENTUAL
//      (bps). Futuros tetos/pisos GOVERNADOS (DECISION-0166 D8, "ajustar dentro de limites
//      governados") entram AQUI como checagem ADITIVA — NÃO como substrato vazio hoje (instrução
//      de Clayton: "pode seguir sem teto/piso, deixe de forma que eu possa configurar"). Nenhuma
//      tabela/coluna de limite é criada nesta fatia — só o ponto de extensão nomeado e comentado
//      abaixo.
//   2. assertCreatePolicyVersionRequestValid — validação ESTRUTURAL do corpo da requisição
//      (campos obrigatórios, change_reason — Artigo XI, enums de tipo de linha/destino/base de
//      cálculo). NÃO trata percentual — fica FORA do ponto de extensão acima por desenho.
//
// HttpError.badRequest (400) em toda falha de validação — a rota apenas propaga; nenhuma
// mensagem crua de constraint do Postgres é composta aqui (isso é papel do tradutor de erro na
// própria rota, para os poucos casos que só o banco consegue detectar — ex.: coerência
// territorial via FK composta).

import { HttpError } from '@core/errors/http-error';
import {
  ECONOMIC_POLICY_APPLIES_TO_WRITABLE,
  REGIONAL_ORIGIN_BASIS_RESOLVABLE_MVP,
  REGIONAL_FUND_LEVEL_RESOLVABLE_MVP,
  type EconomicPolicyLineType,
  type EconomicPolicyDestinationType,
  type RegionalOriginBasis,
  type RegionalFundLevel,
} from './economic-policy.types';

/** Vocabulário físico do CHECK do Postgres (migrations 20260530561000 + 20260530565000). */
const LINE_TYPES: readonly EconomicPolicyLineType[] = [
  'revenue_share',
  'platform_fee',
  'regional_fund',
  'reserve',
  'referral',
  'group_allocation',
  'channel_commission',
  'custom',
];

/** Vocabulário físico do CHECK do Postgres (mesmas duas migrations acima). */
const DESTINATION_TYPES: readonly EconomicPolicyDestinationType[] = [
  'receiver_actor',
  'actor_wallet',
  'platform_fees',
  'platform_revenue',
  'regional_fund',
  'risk_reserve',
  'referrer_actor_wallet',
  'group_wallet',
  'channel_actor_wallet',
  'escrow_payments',
  'custom',
];

// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CONTIDO
// ║ NORMA:   economic-policy.types.ts (REGIONAL_*_RESOLVABLE_MVP, guard-policiada); resolver
// ║          byte-pinned continua a autoridade de comportamento
// ║ NÃO:     tratar os 7/5 valores abaixo como "publicáveis" — é só o CHECK físico do Postgres
// ║ EM VEZ:  assertLineShapeValid abaixo já rejeita no publish via REGIONAL_*_RESOLVABLE_MVP
// ╚════════════════════════════════════════════════════════════════
/** Enum canônico DECISION-0049 (migration 20260530567000). */
const REGIONAL_ORIGIN_BASIS_VALUES: readonly RegionalOriginBasis[] = [
  'payer_identity_residence',
  'receiver_identity_residence',
  'receiver_company_operational',
  'receiver_company_hq',
  'service_location',
  'transaction_location',
  'explicit_economic_region',
];

/** Enum canônico DECISION-0166 D2 (migration 20260710120000). */
const REGIONAL_LEVEL_VALUES: readonly RegionalFundLevel[] = [
  'planet',
  'country',
  'state',
  'city',
  'neighborhood',
];

/** CHECK físico de economic_policies.policy_type (migration 20260530560000). */
const POLICY_TYPES = ['COMMISSION_SPLIT', 'ACCESS_PASS', 'HYBRID', 'ZERO_FEE', 'CONTRACTUAL'] as const;

export interface PolicyLineRequestBody {
  lineType: string;
  destinationType: string;
  destinationKey?: string | null;
  regionalOriginBasis?: string | null;
  regionalLevel?: string | null;
  bps?: number | null;
  fixedAmountCents?: number | null;
  appliesTo: string;
  conditionType?: string | null;
  conditionJson?: Record<string, unknown>;
  priority?: number;
  metadata?: Record<string, unknown>;
}

export interface CreatePolicyVersionRequestBody {
  policyCode: string;
  policyType: string;
  moduleContext: string;
  vertical?: string | null;
  actorType?: string | null;
  serviceType?: string | null;
  pricingModel?: string | null;
  settlementFlow?: string | null;
  countryId?: string | null;
  stateId?: string | null;
  cityId?: string | null;
  categoryId?: string | null;
  channel?: string | null;
  campaignId?: string | null;
  priority?: number;
  effectiveFrom: string;
  effectiveUntil?: string | null;
  metadata?: Record<string, unknown>;
  changeReason: string;
  lines: PolicyLineRequestBody[];
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * PONTO DE EXTENSÃO GOVERNADO ÚNICO — validação de PERCENTUAL (bps) de uma versão de policy.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * Regra material (COMMENT ON TABLE economic_policy_lines, migration 20260530561000): a soma dos
 * bps de uma policy precisa fechar 10000 (100%); o resolver (calculatePolicySplits, em
 * economic-policy-engine.service.ts) aplica floor + resíduo de arredondamento para a primeira
 * linha revenue_share. Esse resíduo é APENAS centavos de arredondamento por linha — nunca um
 * percentual inteiro deixado em aberto de propósito. Uma policy cujas linhas somem, por exemplo,
 * 11000 bps (110%) faria o resíduo ficar negativo; se a linha revenue_share não tiver como
 * absorver sem ela mesma ficar negativa, o resolver falha (CALCULATION_INVALID) — em tempo de
 * execução real, não em tempo de configuração. Esta função move essa falha para ANTES da
 * gravação (§4.9.5 do protocolo).
 *
 * FUTURO (DECISION-0166 D8, "ajustar dentro de limites governados"): tetos/pisos por linha ou por
 * policy (ex.: platform_fee nunca abaixo de X bps) entram AQUI como checagem ADITIVA, lendo
 * limites configurados quando essa governança existir — NÃO criar tabela/coluna de limite vazia
 * agora (Clayton: "pode seguir sem teto/piso, deixe de forma que eu possa configurar"). Este
 * comentário É o ponto de extensão — o próximo autor adiciona a checagem aqui, não reescreve a
 * função nem cria uma segunda.
 */
export function assertPolicyLinesValid(lines: PolicyLineRequestBody[]): void {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw HttpError.badRequest('economic_policy: ao menos uma linha (lines) é obrigatória.');
  }

  let bpsSum = 0;
  let hasBpsLine = false;
  let hasRevenueShare = false;

  for (const [idx, line] of lines.entries()) {
    const hasBps = line.bps !== null && line.bps !== undefined;
    const hasFixed = line.fixedAmountCents !== null && line.fixedAmountCents !== undefined;

    if (!hasBps && !hasFixed) {
      throw HttpError.badRequest(
        `economic_policy: linha ${idx} precisa de bps ou fixedAmountCents (nenhum dos dois foi informado).`
      );
    }
    if (hasBps) {
      const bps = line.bps as number;
      if (!Number.isInteger(bps) || bps < 0 || bps > 10000) {
        throw HttpError.badRequest(
          `economic_policy: linha ${idx} — bps deve ser inteiro entre 0 e 10000 (recebido: ${line.bps}).`
        );
      }
      hasBpsLine = true;
      bpsSum += bps;
    }
    if (hasFixed) {
      const fixed = line.fixedAmountCents as number;
      if (!Number.isInteger(fixed) || fixed < 0) {
        throw HttpError.badRequest(
          `economic_policy: linha ${idx} — fixedAmountCents deve ser inteiro maior ou igual a 0 (recebido: ${line.fixedAmountCents}).`
        );
      }
    }
    if (line.lineType === 'revenue_share') hasRevenueShare = true;
  }

  if (hasBpsLine) {
    if (bpsSum !== 10000) {
      throw HttpError.badRequest(
        `economic_policy: soma dos bps das linhas = ${bpsSum} — precisa fechar exatamente 10000 ` +
          '(100%). O resolver não tolera percentual não preenchido: o resíduo que ele absorve é ' +
          'apenas arredondamento de centavos, nunca uma fatia inteira ausente.'
      );
    }
  }

  // Fora do `if (hasBpsLine)` de propósito: uma policy composta SÓ de fixedAmountCents (sem
  // nenhuma linha bps) também precisa de uma linha revenue_share absorvedora — o resolver
  // (calculatePolicySplits) aplica o drift de arredondamento à primeira linha revenue_share
  // INCONDICIONALMENTE, tenha a policy linhas percentuais, fixas, ou ambas. Antes desta checagem
  // viver aqui dentro do bloco bps, uma policy só-fixa escapava desta exigência inteira: publicava
  // limpa e só falhava em tempo de PAGAMENTO real (DRIFT_NO_REVENUE_SHARE) — o pior momento
  // possível para descobrir o problema.
  if (!hasRevenueShare) {
    throw HttpError.badRequest(
      'economic_policy: nenhuma linha revenue_share entre as linhas informadas — o resolver ' +
        'precisa de uma linha revenue_share para absorver o resíduo de arredondamento (K_pe_7); ' +
        'sem ela, a resolução falha em tempo de pagamento real.'
    );
  }
}

/** Validação ESTRUTURAL (não-percentual) de uma linha individual. */
function assertLineShapeValid(line: PolicyLineRequestBody, idx: number): void {
  if (!isNonEmptyString(line.lineType) || !(LINE_TYPES as readonly string[]).includes(line.lineType)) {
    throw HttpError.badRequest(`economic_policy: linha ${idx} — lineType inválido: ${String(line.lineType)}.`);
  }
  if (
    !isNonEmptyString(line.destinationType) ||
    !(DESTINATION_TYPES as readonly string[]).includes(line.destinationType)
  ) {
    throw HttpError.badRequest(
      `economic_policy: linha ${idx} — destinationType inválido: ${String(line.destinationType)}.`
    );
  }
  if (
    !isNonEmptyString(line.appliesTo) ||
    !(ECONOMIC_POLICY_APPLIES_TO_WRITABLE as readonly string[]).includes(line.appliesTo)
  ) {
    throw HttpError.badRequest(
      `economic_policy: linha ${idx} — appliesTo precisa ser uma das bases graváveis ` +
        `(${ECONOMIC_POLICY_APPLIES_TO_WRITABLE.join('|')}); recebido: ${String(line.appliesTo)}.`
    );
  }
  if (
    line.regionalOriginBasis != null &&
    !(REGIONAL_ORIGIN_BASIS_VALUES as readonly string[]).includes(line.regionalOriginBasis)
  ) {
    throw HttpError.badRequest(
      `economic_policy: linha ${idx} — regionalOriginBasis inválido: ${line.regionalOriginBasis}.`
    );
  }
  if (line.regionalLevel != null && !(REGIONAL_LEVEL_VALUES as readonly string[]).includes(line.regionalLevel)) {
    throw HttpError.badRequest(`economic_policy: linha ${idx} — regionalLevel inválido: ${line.regionalLevel}.`);
  }
  if (line.lineType === 'regional_fund' && line.regionalLevel == null) {
    throw HttpError.badRequest(
      `economic_policy: linha ${idx} — regional_fund exige regionalLevel (DECISION-0166 D2).`
    );
  }
  if (line.lineType !== 'regional_fund' && line.regionalLevel != null) {
    throw HttpError.badRequest(`economic_policy: linha ${idx} — regionalLevel só é permitido em linha regional_fund.`);
  }
  if (line.lineType === 'regional_fund' && !line.destinationKey && !line.regionalOriginBasis) {
    throw HttpError.badRequest(
      `economic_policy: linha ${idx} — regional_fund sem destinationKey exige regionalOriginBasis (DECISION-0049).`
    );
  }

  // ── Fail-closed na FRONTEIRA de publicação, não em tempo de pagamento real ─────────────────
  // Os dois campos acima já validaram que basis/level são valores FÍSICOS válidos (CHECK do
  // Postgres). Isso não basta: o resolver de pagamento (byte-pinned, fora de alcance aqui) REJEITA
  // incondicionalmente 3 dos 7 valores de basis e SEGURA (HOLD, 501) o nível 'neighborhood' — sem
  // este check, uma policy publicável hoje ficaria garantida a falhar quando o dinheiro se move.
  // REGIONAL_ORIGIN_BASIS_RESOLVABLE_MVP / REGIONAL_FUND_LEVEL_RESOLVABLE_MVP são a DECLARAÇÃO
  // guard-policiada (economic-policy.types.ts) do que o resolver hoje resolve de fato.
  if (line.lineType === 'regional_fund') {
    if (
      line.regionalOriginBasis != null &&
      !(REGIONAL_ORIGIN_BASIS_RESOLVABLE_MVP as readonly string[]).includes(line.regionalOriginBasis)
    ) {
      throw HttpError.badRequest(
        `economic_policy: linha ${idx} — regionalOriginBasis='${line.regionalOriginBasis}' não é resolvível ` +
          'hoje pelo pagador (o resolver de pagamento rejeita este valor em tempo de execução — ' +
          `DECISION-0049, MVP). Use uma das bases resolvíveis: ${REGIONAL_ORIGIN_BASIS_RESOLVABLE_MVP.join(', ')}.`
      );
    }
    if (
      line.regionalLevel != null &&
      !(REGIONAL_FUND_LEVEL_RESOLVABLE_MVP as readonly string[]).includes(line.regionalLevel)
    ) {
      throw HttpError.badRequest(
        `economic_policy: linha ${idx} — regionalLevel='${line.regionalLevel}' está em HOLD no resolver de ` +
          'pagamento (nível neighborhood, DECISION-0166 D4 — catálogo de bairros governado, mas resolver ' +
          `ainda não religado a ele). Use um dos níveis resolvíveis: ${REGIONAL_FUND_LEVEL_RESOLVABLE_MVP.join(', ')}.`
      );
    }
  }
}

/**
 * Validação ESTRUTURAL do corpo inteiro da requisição de criação de versão (não-percentual — ver
 * assertPolicyLinesValid acima para bps). Chamada ANTES de qualquer escrita (§4.9.5).
 */
export function assertCreatePolicyVersionRequestValid(body: CreatePolicyVersionRequestBody): void {
  if (!isNonEmptyString(body.policyCode)) {
    throw HttpError.badRequest('economic_policy: policyCode é obrigatório.');
  }
  if (!isNonEmptyString(body.policyType) || !(POLICY_TYPES as readonly string[]).includes(body.policyType as any)) {
    throw HttpError.badRequest(`economic_policy: policyType inválido: ${String(body.policyType)}.`);
  }
  if (!isNonEmptyString(body.moduleContext)) {
    throw HttpError.badRequest('economic_policy: moduleContext é obrigatório.');
  }
  if (!isNonEmptyString(body.effectiveFrom) || Number.isNaN(Date.parse(body.effectiveFrom))) {
    throw HttpError.badRequest('economic_policy: effectiveFrom é obrigatório e precisa ser uma data ISO válida.');
  }
  if (body.effectiveUntil != null) {
    if (Number.isNaN(Date.parse(body.effectiveUntil))) {
      throw HttpError.badRequest('economic_policy: effectiveUntil precisa ser uma data ISO válida.');
    }
    if (Date.parse(body.effectiveUntil) <= Date.parse(body.effectiveFrom)) {
      throw HttpError.badRequest('economic_policy: effectiveUntil precisa ser posterior a effectiveFrom.');
    }
  }
  // ARTIGO XI da Constituição — "emendas públicas, justificadas, nunca silenciosas": obrigatório,
  // não-vazio, nunca implícito.
  if (!isNonEmptyString(body.changeReason)) {
    throw HttpError.badRequest(
      'economic_policy: changeReason é obrigatório — toda nova versão precisa de justificativa ' +
        'explícita do autor (Artigo XI da Constituição).'
    );
  }
  if (!Array.isArray(body.lines)) {
    throw HttpError.badRequest('economic_policy: lines precisa ser um array.');
  }
  body.lines.forEach((line, idx) => assertLineShapeValid(line, idx));

  // PONTO DE EXTENSÃO GOVERNADO — ver assertPolicyLinesValid acima.
  assertPolicyLinesValid(body.lines);
}
