// Conversão de valores vindos do PostgreSQL (numeric/text) para centavos inteiros — sem parseFloat no trilho monetário.
import { asMoneyCents } from '@contracts/marketplace/canonical';

export function integerCentsFromDbWire(value: unknown, field = 'amount'): number {
  if (value == null || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) {
    throw new TypeError(`${field}: valor não numérico para centavos: ${JSON.stringify(value)}`);
  }
  return asMoneyCents(Math.round(n));
}