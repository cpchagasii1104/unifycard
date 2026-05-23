// Payout Safety Guard — cooldown após recebimento (proteção contra saque imediato)

const payoutCooldown = new Map<string, number>();

export const payoutRules = {
  PAYOUT_COOLDOWN_MS: 24 * 60 * 60 * 1000, // 24 horas
};

export function registerFundsReceived(tenantId: string, actorId: string) {
  const key = `${tenantId}:${actorId}`;
  payoutCooldown.set(key, Date.now());
}

export function validatePayoutCooldown(tenantId: string, actorId: string) {
  const key = `${tenantId}:${actorId}`;
  const last = payoutCooldown.get(key);
  if (!last) return;

  const now = Date.now();
  const elapsed = now - last;

  if (elapsed < payoutRules.PAYOUT_COOLDOWN_MS) {
    throw new Error('PAYOUT_COOLDOWN_ACTIVE');
  }
}