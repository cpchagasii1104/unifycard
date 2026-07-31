// frontend/src/api/trust.ts
// API client para Trust & Integrity Engine
// 🔴 BLINDAGEM: Frontend apenas exibe score, não calcula

import { apiFetch, apiFetchJson } from './client';

/**
 * Nível de risco
 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';

/**
 * Trust Profile
 */
export interface TrustProfile {
  profileId: string;
  tenantId: string;
  actorId: string;
  currentScore: number;
  riskLevel: RiskLevel;
  totalEvents: number;
  positiveEvents: number;
  negativeEvents: number;
  lastEventAt: string | null;
  lastUpdatedAt: string;
  createdAt: string;
}

/**
 * Trust Event
 */
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO
// ║ NORMA:   docs/01_normative/07_NOMENCLATURA_CANONICA.md §4.34
// ║ NÃO:     LOW/MEDIUM/HIGH — vocabulário de priority; trust_events.severity é TEXT com CHECK
// ║          novo, filtro com valor antigo devolveria 0 linhas para sempre, em silêncio.
// ║ EM VEZ:  CRITICAL/ERROR/WARNING/INFO/AUDIT — bate com o CHECK vivo. (RiskLevel, campo
// ║          separado — LOW/MEDIUM/HIGH/BLOCKED — não é regido por §4.34, não mexido.)
// ╚════════════════════════════════════════════════════════════════
export interface TrustEvent {
  eventId: string;
  tenantId: string;
  actorId: string;
  eventType: string;
  severity: 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO' | 'AUDIT';
  scoreImpact: number;
  contextType: string;
  contextId: string;
  evidencePackId: string;
  metadata: Record<string, any> | null;
  createdAt: string;
}

/**
 * Resultado de verificação
 */
export interface CanProceedResult {
  canProceed: boolean;
  reason?: string;
  riskLevel: RiskLevel;
  currentScore: number;
}

/**
 * Busca trust profile por actor
 */
export async function getTrustProfile(actorId: string): Promise<TrustProfile> {
  return apiFetchJson<TrustProfile>(`/trust/profile/${actorId}`);
}

/**
 * Verifica se pode prosseguir com ação
 */
export async function canProceedWithAction(input: {
  action: string;
  actorId: string;
  contextType?: string;
  contextId?: string;
}): Promise<CanProceedResult> {
  const response = await apiFetch('/trust/can-proceed', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao verificar trust' }));
    throw new Error(error.error || 'Erro ao verificar trust');
  }

  return response.json();
}




