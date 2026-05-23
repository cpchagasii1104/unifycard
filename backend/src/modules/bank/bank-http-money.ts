// backend/src/modules/bank/bank-http-money.ts
// Fronteira HTTP / JSON do módulo Bank — docs/01_normative/07_NOMENCLATURA_CANONICA.md §4.7
// Nenhum montante monetário entra no domínio sem conversão explícita a partir de wire (unknown).

import {
  asMoneyCents,
  toMoneyCents,
  toPositiveMoneyCents,
  type MoneyCents,
  type PositiveMoneyCents,
} from '@contracts/marketplace/canonical';

/**
 * Centavos inteiros (assinados) a partir de valor de wire.
 * Aceita `number` ou `string` numérica; rejeita decimais na unidade “centavo” e não-finitos.
 *
 * @param fieldName rótulo para erros (ex.: `body.amountCents`, `query.limitCents`).
 */
export function parseMoneyToCents(value: unknown, fieldName: string): MoneyCents {
  const n = typeof value === 'string' ? Number(value.trim()) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new TypeError(
      `${fieldName}: esperado inteiro de centavos (§4.7), recebido ${JSON.stringify(value)}`
    );
  }
  if (!Number.isInteger(n)) {
    throw new TypeError(
      `${fieldName}: centavos devem ser inteiros. Se a unidade forem reais/dólares decimais, use parseMajorDecimalToCents.`
    );
  }
  return toMoneyCents(n);
}

/**
 * Como `parseMoneyToCents`, mas exige valor estritamente positivo (magnitude de pagamento / linha de débito).
 */
export function parsePositiveMoneyToCents(value: unknown, fieldName: string): PositiveMoneyCents {
  const cents = parseMoneyToCents(value, fieldName);
  return toPositiveMoneyCents(cents);
}

/**
 * Unidades monetárias **decimais maiores** (ex.: `10.50` BRL) → centavos inteiros.
 * Usar apenas quando o contrato HTTP documentar explicitamente decimal maior (não centavos).
 * Arredondamento: `Math.round(major * 100)` (meia-unidade para cima).
 *
 * @param fieldName rótulo para erros
 */
export function parseMajorDecimalToCents(value: unknown, fieldName: string): MoneyCents {
  let n: number;
  if (typeof value === 'string') {
    const t = value.trim();
    if (!/^-?\d+(\.\d{1,2})?$/.test(t)) {
      throw new TypeError(
        `${fieldName}: formato decimal inválido (esperado até 2 casas decimais), recebido ${JSON.stringify(value)}`
      );
    }
    n = Number(t);
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    n = value;
  } else {
    throw new TypeError(`${fieldName}: esperado number ou string decimal, recebido ${typeof value}`);
  }
  return asMoneyCents(Math.round(n * 100));
}

/**
 * Saída legível para APIs que exijam decimal maior (ex.: `"12.34"`).
 * Não usar para persistência; persistir sempre centavos inteiros.
 */
export function formatCentsToMoney(cents: MoneyCents): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(cents));
  const major = Math.floor(abs / 100);
  const minor = abs % 100;
  return `${sign}${major}.${minor.toString().padStart(2, '0')}`;
}