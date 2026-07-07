// frontend/src/api/composer.ts
// F2 — o composer PROJETA o contrato C1 (server-driven, actor-adaptativo). A tela NUNCA decide
// quais atos existem: GET /composer/contract enumera os ActorIntent (SSOT) com enabled/gated/deeplink.
import { apiFetch } from './client';

export interface ComposerIntentOption {
  intent: string; // ActorIntent governado (identidade)
  label: string;  // projeção UX
  enabled: boolean;
  gatedBy?: string;
  deeplink?: string;
}

export async function getComposerContract(
  actorId: string,
  mode: 'consuming' | 'operating' = 'operating'
): Promise<{ intents: ComposerIntentOption[] }> {
  const response = await apiFetch(`/composer/contract?actorId=${encodeURIComponent(actorId)}&mode=${mode}`);
  const body = await response.json();
  return body.data;
}
