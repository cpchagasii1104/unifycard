// backend/src/modules/rentals/pricing-estimate.ts
// Estimativa de preço PRÉ-DINHEIRO (F-RENTAL-PRICING-QUANTITY-GEO-MVP Fase 2). É ANÚNCIO/ESTIMATIVA:
// não cria cobrança, hold, reserva nem toca Bank (Δbank=0). Backend é a autoridade (front só renderiza).
// Dinheiro SEMPRE cents/BIGINT (inteiro).
//
// MENOR CUSTO REAL (correção 2026-07-08, doc): o guloso decrescente podia mentir — ex.: diária=10000,
// semanal=80000, 8 dias → guloso 1 semana+1 dia=90000, mas 8 diárias=80000. Como o produto promete a
// melhor combinação para o usuário, usa-se PROGRAMAÇÃO DINÂMICA de menor custo sobre a duração
// discretizada em HORAS (unidade base = 1h). custo[h] = min custo pra cobrir h horas usando qualquer
// faixa. Cobrir "pelo menos" a duração (a última unidade pode exceder — é o padrão de locação: você
// paga a diária cheia mesmo usando 20h). Determinístico e auditável (breakdown reconstruído).
import { RENTAL_PRICING_UNIT_HOURS as UNIT_HOURS, type RentalPricingUnit } from './rentable-resource.types';

export interface PricingTier { unit: RentalPricingUnit; priceCents: number; }
export interface EstimateLine { unit: RentalPricingUnit; qty: number; unitPriceCents: number; subtotalCents: number; }
export interface PriceEstimate {
  available: boolean;
  estimatedPriceCents: number;
  currency: 'BRL';
  breakdown: EstimateLine[];
  periodHours: number;
  disclaimer: string;
}

const DISCLAIMER = 'Estimativa. Pagamento ainda não acontece pelo sistema.';

export function estimatePrice(tiers: PricingTier[], startAt: Date, endAt: Date): PriceEstimate {
  const ms = endAt.getTime() - startAt.getTime();
  const periodHours = ms > 0 ? Math.ceil(ms / 3_600_000) : 0;
  const usable = tiers.filter((t) => t.priceCents > 0);

  if (periodHours <= 0 || usable.length === 0) {
    return { available: false, estimatedPriceCents: 0, currency: 'BRL', breakdown: [], periodHours, disclaimer: DISCLAIMER };
  }

  // DP: cost[h] = menor custo (cents) para cobrir >= h horas. from[h] = faixa usada na transição ótima.
  // Cobrir "pelo menos": ao aplicar uma faixa de H horas a partir de h, o alvo é max(0, h - H) — a
  // unidade absorve o excedente (paga a unidade cheia). Isso torna cost[periodHours] o mínimo global.
  const N = periodHours;
  const INF = Number.MAX_SAFE_INTEGER;
  const cost = new Array<number>(N + 1).fill(INF);
  const from = new Array<PricingTier | null>(N + 1).fill(null);
  cost[0] = 0;
  for (let h = 1; h <= N; h++) {
    for (const t of usable) {
      const prev = Math.max(0, h - UNIT_HOURS[t.unit]);
      if (cost[prev] !== INF && cost[prev] + t.priceCents < cost[h]) {
        cost[h] = cost[prev] + t.priceCents;
        from[h] = t;
      }
    }
  }

  if (cost[N] === INF) {
    return { available: false, estimatedPriceCents: 0, currency: 'BRL', breakdown: [], periodHours, disclaimer: DISCLAIMER };
  }

  // reconstrói o breakdown (agrega por unidade)
  const counts = new Map<RentalPricingUnit, { qty: number; unitPriceCents: number }>();
  let h = N;
  while (h > 0) {
    const t = from[h]!;
    const c = counts.get(t.unit) ?? { qty: 0, unitPriceCents: t.priceCents };
    c.qty += 1;
    counts.set(t.unit, c);
    h = Math.max(0, h - UNIT_HOURS[t.unit]);
  }
  // ordena do maior período pro menor por UNIT_HOURS (deriva do vocabulário, sem literais paralelos)
  const breakdown: EstimateLine[] = [...counts.entries()]
    .sort((a, b) => UNIT_HOURS[b[0]] - UNIT_HOURS[a[0]])
    .map(([unit, c]) => ({ unit, qty: c.qty, unitPriceCents: c.unitPriceCents, subtotalCents: c.qty * c.unitPriceCents }));

  return { available: true, estimatedPriceCents: cost[N], currency: 'BRL', breakdown, periodHours, disclaimer: DISCLAIMER };
}
