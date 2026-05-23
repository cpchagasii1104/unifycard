// Double Spend Global Guard — lock em memória por conta (proteção extra)

const accountLocks = new Map<string, boolean>();

export async function lockAccount(accountId: string) {
  if (accountLocks.get(accountId)) {
    throw new Error('ACCOUNT_LOCKED');
  }
  accountLocks.set(accountId, true);
}

export async function unlockAccount(accountId: string) {
  accountLocks.delete(accountId);
}