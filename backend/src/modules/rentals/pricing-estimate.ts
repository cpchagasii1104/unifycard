// backend/src/modules/rentals/pricing-estimate.ts
// Estimativa de preço PRÉ-DINHEIRO (F-RENTAL-PRICING-QUANTITY-GEO-MVP Fase 2). É ANÚNCIO/ESTIMATIVA:
// não cria cobrança, hold, reserva nem toca Bank (Δbank=0). Backend é a autoridade (front só renderiza).
// Dinheiro SEMPRE cents/BIGINT. Heurística GULOSA DECRESCENTE, determinística e documentada: cobre o
// período com as maiores unidades disponíveis primeiro; o resto arredonda 1 da menor unidade (como
// locadora: "2 semanas + 3 dias"). Não é o ótimo global — é previsível e auditável (breakdown).
import type { RentalPricingUnit } from './rentable-resource.types';

const UNIT_HOURS: Record<RentalPricingUnit, number> = {
  por_hora: 1, por_dia: 24, por_semana: 168, por_mes: 720, por_semestre: 4320, por_ano: 8760,
};

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
  const usable = tiers.filter((t) => t.priceCents > 0).sort((a, b) => UNIT_HOURS[b.unit] - UNIT_HOURS[a.unit]);

  if (periodHours <= 0 || usable.length === 0) {
    return { available: false, estimatedPriceCents: 0, currency: 'BRL', breakdown: [], periodHours, disclaimer: DISCLAIMER };
  }

  const breakdown: EstimateLine[] = [];
  let remaining = periodHours;
  for (const t of usable) {
    const h = UNIT_HOURS[t.unit];
    const qty = Math.floor(remaining / h);
    if (qty > 0) {
      breakdown.push({ unit: t.unit, qty, unitPriceCents: t.priceCents, subtotalCents: qty * t.priceCents });
      remaining -= qty * h;
    }
  }
  // resto (< menor unidade): arredonda 1 da MENOR unidade disponível
  if (remaining > 0) {
    const smallest = usable[usable.length - 1];
    const existing = breakdown.find((l) => l.unit === smallest.unit);
    if (existing) { existing.qty += 1; existing.subtotalCents += smallest.priceCents; }
    else breakdown.push({ unit: smallest.unit, qty: 1, unitPriceCents: smallest.priceCents, subtotalCents: smallest.priceCents });
  }

  const estimatedPriceCents = breakdown.reduce((s, l) => s + l.subtotalCents, 0);
  return { available: true, estimatedPriceCents, currency: 'BRL', breakdown, periodHours, disclaimer: DISCLAIMER };
}
