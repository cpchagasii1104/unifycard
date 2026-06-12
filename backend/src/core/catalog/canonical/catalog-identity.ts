// catalog-identity.ts
// DECISION-0117 (A/B/H) — normalização de identidade do catálogo canônico.
//
// Marca: "Nestlé"/"Nestle"/"NESTLE" não podem virar identidades distintas — a
// normalização para IDENTIDADE (não para exibição) remove acento, colapsa
// espaços e baixa caixa. O valor exibido segue sendo o que foi cadastrado;
// a forma normalizada governa dedup no pipeline (única porta de escrita).
//
// Variante: os eixos discriminadores PARTICIPAM do fingerprint (não vivem só
// em JSON livre). GTIN presente ⇒ o GTIN é a identidade (GTIN distinto ⇒
// variante distinta). Sem GTIN ⇒ md5 determinístico dos eixos normalizados.

import { createHash } from 'crypto';

/** Normaliza texto para IDENTIDADE: trim, colapsa espaços, NFD sem acentos, lowercase. */
export function normalizeForIdentity(value: string | null | undefined): string {
  if (value == null) return '';
  return String(value)
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Forma de identidade da MARCA (dedup); '' quando ausente. Exibição preserva o original. */
export function normalizeBrandForIdentity(brand: string | null | undefined): string {
  return normalizeForIdentity(brand);
}

export interface VariantFingerprintInput {
  gtin?: string | null;
  variantName: string;
  netContentValue?: number | string | null;
  netContentUnit?: string | null;
  packageType?: string | null;
  isReturnable?: boolean | null;
  discriminatorAttributes?: Record<string, unknown> | null;
}

/** JSON canônico (chaves ordenadas) dos atributos discriminadores extras. */
function canonicalDiscriminatorJson(attrs: Record<string, unknown> | null | undefined): string {
  if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs)) return '{}';
  const keys = Object.keys(attrs).sort();
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = attrs[k];
    if (v === null || v === undefined || v === '') continue;
    out[normalizeForIdentity(k)] = normalizeForIdentity(String(v));
  }
  return JSON.stringify(out);
}

/**
 * Fingerprint v1 da variante canônica. GTIN não-vazio ⇒ identidade = GTIN.
 * Senão, a identidade são os EIXOS DISCRIMINADORES (conteúdo|unidade|embalagem|
 * retornabilidade|attrs), todos normalizados — o NOME é rótulo de apresentação
 * e NÃO participa quando há eixo material ("COCA 1 L" ≡ "Coca 1L" se os eixos
 * coincidem). Só sem NENHUM eixo o nome normalizado vira a identidade (fallback).
 */
export function computeVariantFingerprintV1(input: VariantFingerprintInput): string {
  const gtin = input.gtin == null ? '' : String(input.gtin).trim();
  if (gtin !== '') {
    return createHash('md5').update(gtin).digest('hex');
  }
  const ncv =
    input.netContentValue === null || input.netContentValue === undefined
      ? ''
      : String(Number(input.netContentValue));
  const attrsJson = canonicalDiscriminatorJson(input.discriminatorAttributes);
  const axes = [
    ncv,
    normalizeForIdentity(input.netContentUnit),
    normalizeForIdentity(input.packageType),
    input.isReturnable === true ? 'returnable' : input.isReturnable === false ? 'disposable' : '',
    attrsJson === '{}' ? '' : attrsJson,
  ];
  const hasMaterialAxis = axes.some((a) => a !== '');
  const parts = hasMaterialAxis ? axes : [normalizeForIdentity(input.variantName)];
  return createHash('md5').update(parts.join('|')).digest('hex');
}
