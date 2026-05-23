/**
 * Funding canónico: reserve (system) → conta Bank do fundo regional (mesma chave que o grant/consume).
 *
 * Uso (exemplo):
 * pnpm exec tsx src/scripts/fund-regional-fund-bank-from-reserve.ts \
 *   --tenant fbe13b78-4516-493d-905a-363796aea1d1 \
 *   --country BR --state SP --city SaoPaulo \
 *   --amount-cents 5000000 \
 *   --ref regional-fund-topup-BR-SP-SAO_PAULO-001
 *
 * Requisitos: DATABASE_URL; `city` igual ao fluxo (ex.: SAO_PAULO vs SaoPaulo).
 * Limite por transferência: 5_000_000 centavos (ver transfer-limits).
 * `--ref` é chave lógica idempotente; o serviço deriva `reference_id` UUID (uuidv5) para o DDL.
 */
import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../core/database/pool';
import { regionalFundService } from '../modules/marketplace/regional-fund.service';

dotenv.config({ path: join(process.cwd(), '.env') });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL ausente');
    process.exit(1);
  }

  const tenantId = arg('--tenant') ?? process.env.E2E_TENANT_ID;
  const country = arg('--country');
  const state = arg('--state');
  const city = arg('--city');
  const amountStr = arg('--amount-cents');
  const ref = arg('--ref');

  if (!tenantId || !country || !state || !city || !amountStr || !ref) {
    console.error(
      'Argumentos obrigatórios: --tenant <uuid> --country BR --state SP --city <igual ao fluxo> --amount-cents <int> --ref <idempotência>'
    );
    process.exit(1);
  }

  const amountCents = Number(amountStr);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    console.error('--amount-cents inválido');
    process.exit(1);
  }

  const region = { country, state, city };
  console.log('Top-up regional fund (Bank)', { tenantId, region, amountCents, ref });

  const result = await regionalFundService.topUpRegionalFundBankFromReserve(
    tenantId,
    region,
    amountCents,
    ref
  );

  console.log('OK', {
    transactionId: result.transactionId,
    fromAccountId: result.fromAccountId,
    toAccountId: result.toAccountId,
    fromBalanceCents: result.fromBalanceCents,
    toBalanceCents: result.toBalanceCents,
    ledgerEntries: result.ledgerEntries,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());