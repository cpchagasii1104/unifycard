// src/core/location/postal-code-normalizer.ts
// FASE B (RFC B1-D · D-B) — normalização postal POR PAÍS.
//
// 🔴 A regra brasileira de 8 dígitos NÃO é regra global: cada país tem seu normalizador; país sem
//    normalizador registrado → não suportado (o resolver responde `country_not_supported`).
// 🔴 O código postal normalizado NUNCA é identidade territorial — é só a chave de consulta ao
//    provider/cache. Zeros à esquerda são preservados; máscara permitida é removida; letras,
//    comprimento divergente e payload excessivo são rejeitados fail-closed.

export type PostalCodeNormalization = { ok: true; value: string } | { ok: false };

/** Entrada bruta acima disso nem é normalizada — contenção de payload malicioso/excessivo. */
const MAX_RAW_POSTAL_INPUT_LENGTH = 16;

/** BR: remove SOMENTE máscara permitida (hífen/espaço) e exige exatamente 8 dígitos. */
function normalizeBrazilPostalCode(raw: string): PostalCodeNormalization {
  const unmasked = raw.replace(/[\s-]/g, '');
  if (!/^\d{8}$/.test(unmasked)) return { ok: false };
  return { ok: true, value: unmasked };
}

/** Registro por país (ISO alpha-2 uppercase). Apenas BR possui normalizador nesta fase. */
const POSTAL_NORMALIZERS_BY_COUNTRY: Record<string, (raw: string) => PostalCodeNormalization> = {
  BR: normalizeBrazilPostalCode,
};

export function hasPostalNormalizerForCountry(isoAlpha2: string): boolean {
  return Object.prototype.hasOwnProperty.call(POSTAL_NORMALIZERS_BY_COUNTRY, isoAlpha2);
}

export function normalizePostalCodeForCountry(
  isoAlpha2: string,
  raw: string | null | undefined
): PostalCodeNormalization {
  if (typeof raw !== 'string') return { ok: false };
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_RAW_POSTAL_INPUT_LENGTH) return { ok: false };
  const normalizer = POSTAL_NORMALIZERS_BY_COUNTRY[isoAlpha2];
  if (!normalizer) return { ok: false };
  return normalizer(trimmed);
}
