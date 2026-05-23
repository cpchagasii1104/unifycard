import type { CreateTransactionFromIntentInput, CreateTransactionFromIntentResult } from '@modules/bank/bank-ledger.service';
import { createTransactionFromIntent } from '@modules/bank/bank-ledger.service';

/**
 * Comando explícito: liquidação B2B (intent → transações + outbox interna ao serviço).
 */
export async function completeB2bPaymentFromIntentCommand(
  input: CreateTransactionFromIntentInput
): Promise<CreateTransactionFromIntentResult> {
  return createTransactionFromIntent(input);
}