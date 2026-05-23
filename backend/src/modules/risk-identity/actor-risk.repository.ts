/**
 * Prompt 53 — actor_risk_profile (por actor_id; não altera finanças).
 */

import { runQueryWithTenant } from '@core/database/pool';
import { isActorIdInTenant } from '@modules/identity/actor-ssot.service';

export type RiskLevel = 'low' | 'medium' | 'high' | 'blocked';

export interface ActorRiskProfileRow {
  actorId: string;
  riskScore: number;
  riskLevel: RiskLevel;
  flags: Record<string, unknown>;
  lastEvaluatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function rowToProfile(r: {
  actor_id: string;
  risk_score: string;
  risk_level: string;
  flags: Record<string, unknown>;
  last_evaluated_at: Date | null;
  created_at: Date;
  updated_at: Date;
}): ActorRiskProfileRow {
  return {
    actorId: r.actor_id,
    riskScore: Number(r.risk_score),
    riskLevel: r.risk_level as RiskLevel,
    flags: (r.flags && typeof r.flags === 'object' ? r.flags : {}) as Record<string, unknown>,
    lastEvaluatedAt: r.last_evaluated_at?.toISOString() ?? null,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function assertActorInTenant(
  tenantId: string,
  actorId: string
): Promise<boolean> {
  return isActorIdInTenant(tenantId, actorId);
}

export async function getOrCreateProfile(
  tenantId: string,
  actorId: string
): Promise<ActorRiskProfileRow> {
  const ok = await assertActorInTenant(tenantId, actorId);
  if (!ok) throw new Error('ACTOR_NOT_IN_TENANT');

  await runQueryWithTenant(
    tenantId,
    `INSERT INTO actor_risk_profile (actor_id) VALUES ($1)
     ON CONFLICT (actor_id) DO NOTHING`,
    [actorId]
  );

  const row = await runQueryWithTenant<{
    actor_id: string;
    risk_score: string;
    risk_level: string;
    flags: Record<string, unknown>;
    last_evaluated_at: Date | null;
    created_at: Date;
    updated_at: Date;
  }>(
    tenantId,
    `SELECT actor_id, risk_score::text, risk_level, flags, last_evaluated_at, created_at, updated_at
     FROM actor_risk_profile WHERE actor_id = $1`,
    [actorId]
  );
  if (!row) throw new Error('actor_risk_profile missing after insert');
  return rowToProfile(row);
}

export async function updateRiskScore(
  tenantId: string,
  actorId: string,
  delta: number
): Promise<ActorRiskProfileRow> {
  await getOrCreateProfile(tenantId, actorId);
  const row = await runQueryWithTenant<{
    actor_id: string;
    risk_score: string;
    risk_level: string;
    flags: Record<string, unknown>;
    last_evaluated_at: Date | null;
    created_at: Date;
    updated_at: Date;
  }>(
    tenantId,
    `UPDATE actor_risk_profile
     SET risk_score = LEAST(200, GREATEST(0, risk_score + $2)), updated_at = now()
     WHERE actor_id = $1
     RETURNING actor_id, risk_score::text, risk_level, flags, last_evaluated_at, created_at, updated_at`,
    [actorId, delta]
  );
  if (!row) throw new Error('updateRiskScore failed');
  return rowToProfile(row);
}

export async function setRiskLevel(
  tenantId: string,
  actorId: string,
  level: RiskLevel,
  score?: number
): Promise<void> {
  await getOrCreateProfile(tenantId, actorId);
  if (score !== undefined) {
    await runQueryWithTenant(
      tenantId,
      `UPDATE actor_risk_profile
       SET risk_level = $2, risk_score = LEAST(200, GREATEST(0, $3)), last_evaluated_at = now(), updated_at = now()
       WHERE actor_id = $1`,
      [actorId, level, score]
    );
  } else {
    await runQueryWithTenant(
      tenantId,
      `UPDATE actor_risk_profile
       SET risk_level = $2, last_evaluated_at = now(), updated_at = now()
       WHERE actor_id = $1`,
      [actorId, level]
    );
  }
}

export async function setProfileScoreAndLevel(
  tenantId: string,
  actorId: string,
  score: number,
  level: RiskLevel
): Promise<void> {
  await getOrCreateProfile(tenantId, actorId);
  await runQueryWithTenant(
    tenantId,
    `UPDATE actor_risk_profile
     SET risk_score = LEAST(200, GREATEST(0, $2)), risk_level = $3,
         last_evaluated_at = now(), updated_at = now()
     WHERE actor_id = $1`,
    [actorId, score, level]
  );
}

export async function addFlag(tenantId: string, actorId: string, flag: string): Promise<void> {
  await getOrCreateProfile(tenantId, actorId);
  await runQueryWithTenant(
    tenantId,
    `UPDATE actor_risk_profile
     SET flags = COALESCE(flags, '{}'::jsonb) || jsonb_build_object($2::text, true), updated_at = now()
     WHERE actor_id = $1`,
    [actorId, flag.slice(0, 128)]
  );
}

export async function removeFlag(tenantId: string, actorId: string, flag: string): Promise<void> {
  const p = await runQueryWithTenant<{ flags: Record<string, unknown> }>(
    tenantId,
    `SELECT flags FROM actor_risk_profile WHERE actor_id = $1`,
    [actorId]
  );
  if (!p?.flags || typeof p.flags !== 'object') return;
  const next = { ...p.flags };
  delete next[flag];
  await runQueryWithTenant(
    tenantId,
    `UPDATE actor_risk_profile SET flags = $2::jsonb, updated_at = now() WHERE actor_id = $1`,
    [actorId, JSON.stringify(next)]
  );
}