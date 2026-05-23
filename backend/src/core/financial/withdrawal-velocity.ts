// Withdrawal Velocity Guard — bloqueio de múltiplos saques em curto período

const withdrawalAttempts = new Map<string, number[]>();

export const withdrawalRules = {
  MAX_WITHDRAWALS_PER_WINDOW: 3,
  WINDOW_MS: 60 * 60 * 1000, // 1 hora
};

export function validateWithdrawalVelocity(tenantId: string, actorId: string) {
  const key = `${tenantId}:${actorId}`;
  const now = Date.now();

  const attempts = withdrawalAttempts.get(key) || [];
  const recent = attempts.filter((t) => now - t < withdrawalRules.WINDOW_MS);

  if (recent.length >= withdrawalRules.MAX_WITHDRAWALS_PER_WINDOW) {
    throw new Error('WITHDRAWAL_VELOCITY_EXCEEDED');
  }

  recent.push(now);
  withdrawalAttempts.set(key, recent);
}