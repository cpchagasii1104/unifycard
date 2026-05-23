// Financial Rate Limits + Transfer Limits — proteção contra abuso

export const transferLimits = {
  MAX_TRANSFER_CENTS: 50_000_00, // 500.00
  MAX_DAILY_TRANSFER_CENTS: 200_000_00, // 2000.00
};

export function validateTransferLimit(amountCents: number) {
  if (amountCents > transferLimits.MAX_TRANSFER_CENTS) {
    throw new Error('TRANSFER_LIMIT_EXCEEDED');
  }
}

const dailyTransferUsage = new Map<string, number>();

export function validateDailyTransferLimit(
  tenantId: string,
  actorId: string,
  amountCents: number
) {
  const key = `${tenantId}:${actorId}`;
  const used = dailyTransferUsage.get(key) || 0;
  const next = used + amountCents;

  if (next > transferLimits.MAX_DAILY_TRANSFER_CENTS) {
    throw new Error('DAILY_TRANSFER_LIMIT_EXCEEDED');
  }

  dailyTransferUsage.set(key, next);
}