/**
 * Prompt 53 — Risk Engine: score/nível a partir de histórico (determinístico).
 */

import { countEventsByTypeSince, listEventsByActor } from './actor-events.repository';
import { getOrCreateProfile, setProfileScoreAndLevel, type RiskLevel } from './actor-risk.repository';

const WINDOW_DAYS = 180;
const CLEAN_WINDOW_DAYS = 60;

/** Pesos por tipo de evento (últimos WINDOW_DAYS) */
const EVENT_WEIGHTS: Record<string, number> = {
  reversal_executed: 18,
  payment_failed: 12,
  payout_failed: 12,
  cancellation_requested: 6,
  governance_action_failed: 8,
  account_closed: 4,
  suspicious_activity: 22,
};

const ALL_WEIGHTED_TYPES = Object.keys(EVENT_WEIGHTS);

export function scoreToLevel(score: number): RiskLevel {
  if (score >= 81) return 'blocked';
  if (score >= 51) return 'high';
  if (score >= 21) return 'medium';
  return 'low';
}

/**
 * Recalcula risk_score e risk_level a partir de actor_events (janela deslizante).
 */
export async function evaluateActorRisk(
  tenantId: string,
  actorId: string
): Promise<{ score: number; level: RiskLevel }> {
  await getOrCreateProfile(tenantId, actorId);
  const since = new Date();
  since.setDate(since.getDate() - WINDOW_DAYS);

  const counts = await countEventsByTypeSince(tenantId, actorId, ALL_WEIGHTED_TYPES, since);
  let score = 0;
  for (const [type, w] of Object.entries(EVENT_WEIGHTS)) {
    score += (counts.get(type) ?? 0) * w;
  }
  score = Math.min(200, score);

  const events = await listEventsByActor(tenantId, actorId, 200);
  const badTypes = new Set(ALL_WEIGHTED_TYPES);
  const lastBad = events.find((e) => badTypes.has(e.eventType));
  const cleanSince = new Date();
  cleanSince.setDate(cleanSince.getDate() - CLEAN_WINDOW_DAYS);
  const hasRecentBad = events.some(
    (e) => badTypes.has(e.eventType) && new Date(e.createdAt) >= cleanSince
  );
  if (!hasRecentBad && lastBad) {
    const daysSinceBad =
      (Date.now() - new Date(lastBad.createdAt).getTime()) / (86400 * 1000);
    if (daysSinceBad >= CLEAN_WINDOW_DAYS) {
      score = Math.max(0, Math.floor(score * 0.65) - 10);
    }
  }

  score = Math.min(200, Math.max(0, score));
  const level = scoreToLevel(score);
  await setProfileScoreAndLevel(tenantId, actorId, score, level);
  return { score, level };
}