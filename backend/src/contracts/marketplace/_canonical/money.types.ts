// Primitivos monetários e percentuais — docs/01_normative/07_NOMENCLATURA_CANONICA.md
// §4.7 centavos, §4.8 basis points, §4.10 moeda.
// Construir sempre via helpers (as*) ou parse* na fronteira; não atribuir number cru a tipos branded.

declare const Iso4217Brand: unique symbol;
declare const RateBpsBrand: unique symbol;

/**
 * Código ISO 4217 validado (3 letras maiúsculas) — §4.10.
 * Não usar string solta; usar `asIso4217CurrencyCode` ou `parseIso4217FromUnknown`.
 */
export type Iso4217CurrencyCode = string & { readonly [Iso4217Brand]: typeof Iso4217Brand };

/**
 * Basis points (§4.8). 100 = 1%, 10_000 = 100%.
 * Limite por defeito 10_000 (percentual puro); use `maxBps` maior para multiplicadores (ex. surge).
 */
export type RateBps = number & { readonly [RateBpsBrand]: typeof RateBpsBrand };

const ISO4217_RE = /^[A-Z]{3}$/;

export function asIso4217CurrencyCode(code: string): Iso4217CurrencyCode {
  const u = code.trim().toUpperCase();
  if (!ISO4217_RE.test(u)) {
    throw new RangeError(`ISO 4217 inválido (esperado 3 letras A-Z): ${JSON.stringify(code)}`);
  }
  return u as Iso4217CurrencyCode;
}

export function parseIso4217FromUnknown(v: unknown): Iso4217CurrencyCode {
  if (typeof v !== 'string') {
    throw new TypeError(`currency deve ser string, recebido ${typeof v}`);
  }
  return asIso4217CurrencyCode(v);
}

export interface MoneyAmountCents {
  amountCents: number;
  currency: Iso4217CurrencyCode;
}

/**
 * Montante em centavos ≥ 0, com moeda canónica.
 * Única forma recomendada de construir `MoneyAmountCents` no código.
 */
export function asMoneyAmountCents(amountCents: number, currency: string): MoneyAmountCents {
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new RangeError(`amountCents deve ser inteiro ≥ 0, recebido ${amountCents}`);
  }
  return {
    amountCents,
    currency: asIso4217CurrencyCode(currency),
  };
}

export function parseMoneyAmountFromUnknown(
  v: unknown,
  currencyFallback?: string
): MoneyAmountCents {
  if (v === null || v === undefined) {
    throw new TypeError('montante ausente');
  }
  if (typeof v === 'object' && v !== null && 'amountCents' in v && 'currency' in v) {
    const o = v as Record<string, unknown>;
    const ac = o.amountCents;
    const cur = o.currency;
    if (typeof ac !== 'number' || !Number.isInteger(ac) || ac < 0) {
      throw new TypeError('amountCents inválido em objeto monetário');
    }
    if (typeof cur !== 'string') {
      throw new TypeError('currency inválida em objeto monetário');
    }
    return asMoneyAmountCents(ac, cur);
  }
  if (typeof v === 'number' && currencyFallback) {
    return asMoneyAmountCents(v, currencyFallback);
  }
  throw new TypeError('formato de montante não reconhecido (use { amountCents, currency })');
}

export type AsRateBpsOptions = { maxBps?: number };

export function asRateBps(value: number, options?: AsRateBpsOptions): RateBps {
  const maxBps = options?.maxBps ?? 10_000;
  if (!Number.isInteger(value) || value < 0 || value > maxBps) {
    throw new RangeError(
      `RateBps deve ser inteiro em [0, ${maxBps}] (§4.8), recebido ${value}`
    );
  }
  return value as RateBps;
}

export function parseRateBpsFromUnknown(v: unknown, options?: AsRateBpsOptions): RateBps {
  if (typeof v !== 'number' || !Number.isInteger(v)) {
    throw new TypeError(`RateBps deve ser inteiro, recebido ${typeof v}`);
  }
  return asRateBps(v, options);
}

/**
 * Discriminated union canónica: dinheiro (centavos + moeda) OU taxa (bps), nunca ambos.
 * Usar em incentivos, vouchers, penalidades ao modelar “valor da regra” de alto nível.
 */
export type CanonicalMonetaryOrRate =
  | { variant: 'money'; money: MoneyAmountCents }
  | { variant: 'rate'; rateBps: RateBps };

export function moneyBranch(m: MoneyAmountCents): CanonicalMonetaryOrRate {
  return { variant: 'money', money: m };
}

export function rateBranch(bps: RateBps): CanonicalMonetaryOrRate {
  return { variant: 'rate', rateBps: bps };
}

// --- Centavos com brand nominal (ledger / saldo): §4.7, “tipo semântico > primitivo solto”. ---

declare const MoneyCentsBrand: unique symbol;
declare const PositiveMoneyCentsBrand: unique symbol;

/** Saldo ou agregado em centavos; inteiro (pode ser negativo). */
export type MoneyCents = number & { readonly [MoneyCentsBrand]: typeof MoneyCentsBrand };

/** Magnitude de linha no ledger (credit/debit); inteiro estritamente positivo. */
export type PositiveMoneyCents = number & { readonly [PositiveMoneyCentsBrand]: typeof PositiveMoneyCentsBrand };

/**
 * Fronteira: converte entrada externa para centavos assinados.
 * Use em DTOs, query params e qualquer `unknown`.
 */
export function toMoneyCents(value: unknown): MoneyCents {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new TypeError(`MoneyCents exige inteiro (centavos), recebido ${typeof value}: ${String(value)}`);
  }
  return value as MoneyCents;
}

/** Quando o número já foi validado como inteiro no domínio (ex.: retorno de agregação SQL). */
export function asMoneyCents(value: number): MoneyCents {
  return toMoneyCents(value);
}

export function toPositiveMoneyCents(value: unknown): PositiveMoneyCents {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new TypeError(`PositiveMoneyCents exige inteiro, recebido ${typeof value}: ${String(value)}`);
  }
  if (value <= 0) {
    throw new RangeError(
      `PositiveMoneyCents deve ser > 0 (magnitude de linha de ledger), recebido ${value}`
    );
  }
  return value as PositiveMoneyCents;
}

export function toNonNegativeMoneyCents(value: unknown): MoneyCents {
  const n = toMoneyCents(value);
  if (n < 0) {
    throw new RangeError(`Valor em centavos não pode ser negativo aqui, recebido ${n}`);
  }
  return n;
}