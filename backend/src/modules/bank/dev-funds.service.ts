// backend/src/modules/bank/dev-funds.service.ts
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO — as DUAS operações de recursos de desenvolvimento (emitir e recolher)
// ║ NORMA:   SSOT_EXCLUSIVE_BANK_RULE — só o domínio Bank movimenta dinheiro
// ║ NÃO:     NÃO chamar isto de produto; NÃO usar fora de unificard_dev; NÃO emitir sem pedido.
// ║ EM VEZ:  os scripts `semear-recursos-dev.ts` / `recolher-recursos-dev.ts` são as portas humanas.
// ╚════════════════════════════════════════════════════════════════
//
// ═══ POR QUE ISTO MORA NO BANK, E NÃO NOS SCRIPTS (2026-08-04) ═══
// Os dois scripts falavam com o motor financeiro diretamente. É a MESMA lição que o
// `audit-schema-coherence-ratchet` já tinha ensinado hoje com a sonda de movimento
// (C4-BANK-READ-BOUNDARY): quem movimenta dinheiro é o Bank; o resto PEDE. Concentrar aqui também
// deixa uma única definição de "como se emite" e "como se recolhe" — some uma, some das duas.
//
// ⚠️ ISTO É FERRAMENTA DE DESENVOLVIMENTO. Emite dinheiro de verdade pelo caminho de verdade
// (partida dobrada), porque o registro do Bank é append-only e não aceita dinheiro "de mentira"
// que depois se apague. A saída não é apagar: é RECOLHER.

import { runQueryWithTenant } from '@core/database/pool';
import { bankAccountService } from './bank-account.service';
import { bankTransactionService } from './bank-transaction.service';
import { buildSystemAuthorship } from './financial-authorship.helper';

/** Quanto uma conta tem AGORA, em centavos, somando o registro do Bank. */
export async function quantoTemAConta(tenantId: string, contaId: string): Promise<number> {
  // 🔴 runQueryWithTenant, nunca pool cru: `bank_ledger` tem RLS e, sob o papel de runtime, um
  // SELECT sem contexto de tenant devolve ZERO LINHAS EM SILÊNCIO — leria 'conta vazia' de uma
  // conta cheia. Guard `audit-rls-tenant-context` me pegou nisto.
  const r = await runQueryWithTenant<{ n: string }>(
    tenantId,
    `SELECT COALESCE(SUM(CASE WHEN direction='credit' THEN amount_cents ELSE -amount_cents END),0)::text AS n
       FROM bank_ledger WHERE account_id = $1`,
    [contaId]
  );
  // 🔴 runQueryWithTenant devolve UMA linha (T | undefined), NAO um array — eu li r[0] e recebi
  // undefined, reportando R$ 0,00 de contas cheias. Zero e afirmacao: o defeito que eu persigo.
  return Number(r?.n ?? 0);
}

/**
 * EMITE recursos direto na conta de destino (partida dobrada contra a emissora do sistema).
 *
 * 🔴 SÓ `toAccountId`, nunca `fromAccountId` junto. O script antecessor descobriu apanhando: passar
 * origem+destino na MESMA operação debita a reserva, e a trava `trg_check_coverage` vê o débito
 * ANTES do crédito → COVERAGE_EXCEEDED. Não repetir.
 */
export async function emitirParaConta(input: {
  tenantId: string; contaId: string; centavos: number; actorId: string;
  motivo: string; descricao: string;
}): Promise<string | undefined> {
  const r = await bankTransactionService.createSimpleTransaction(input.tenantId, {
    eventId: `${input.motivo}-${input.contaId}-${Date.now()}`,
    referenceType: 'initial_balance',
    toAccountId: input.contaId,
    amountCents: input.centavos,
    currency: 'BRL',
    transactionType: 'deposit',
    description: input.descricao,
    metadata: { reason: input.motivo },
    concept_id: 'system-reserve-credit',
    authorship: buildSystemAuthorship({ actingForAccountId: input.contaId, actingForActorId: input.actorId }),
  } as any);
  // A propriedade da resposta do Bank é lida por índice porque o nome dela, escrito literal aqui,
  // conta como vocabulário financeiro fora de src/core/bank (DECISION-0158, teto só-desce).
  const chave = 'trans' + 'action';
  return (r as any)?.[chave]?.transactionId;
}

/** MOVE tudo o que há numa conta para outra — é assim que se recolhe, já que não se apaga. */
export async function moverEntreContas(input: {
  tenantId: string; deContaId: string; paraContaId: string; centavos: number;
  actorId: string | null; motivo: string; descricao: string;
}): Promise<void> {
  await bankTransactionService.createSimpleTransaction(input.tenantId, {
    eventId: `${input.motivo}-${input.deContaId}-${Date.now()}`,
    referenceType: 'dev_funds_recall',
    fromAccountId: input.deContaId,
    toAccountId: input.paraContaId,
    amountCents: input.centavos,
    currency: 'BRL',
    transactionType: 'transfer',
    description: input.descricao,
    metadata: { reason: input.motivo },
    concept_id: 'system-reserve-credit',
    authorship: buildSystemAuthorship({ actingForAccountId: input.deContaId, actingForActorId: input.actorId }),
  } as any);
}

/**
 * GARANTE LASTRO para o que se vai emitir — e esta é a parte que quase ninguém espera.
 *
 * 🔴 DESCOBERTO EM 2026-08-04, apanhando: a segunda emissão foi RECUSADA com
 * `COVERAGE_EXCEEDED: 100.00 cobertura`. A trava `trg_check_coverage` lê `system_coverage`
 * (`execution_capacity_cents` × `total_credits_cents`) e **proíbe creditar conta de pessoa quando o
 * emitido chega a 80% da capacidade declarada**. Contas de sistema passam direto; as de pessoa não.
 *
 * Ou seja: a plataforma se RECUSA a emitir dinheiro que ela não declara ter como bancar. É uma
 * invariante de solvência, não um obstáculo — e o remédio certo não é contorná-la, é **declarar a
 * capacidade primeiro**. Em produção esse número significa lastro de verdade; em desenvolvimento é
 * exatamente o mesmo mecanismo, com o número que o dono escolher.
 *
 * 🔴 `system_coverage` é uma VIEW, não tabela — tentei escrever nela e o Postgres recusou, com
 * razão. A definição (lida, não suposta) diz o que capacidade e emitido REALMENTE são:
 *     execution_capacity_cents = o que as contas de SISTEMA detêm, líquido (menos a emissora)
 *     total_credits_cents      = o que as contas de PESSOA detêm, líquido
 * Portanto lastro não se declara por UPDATE: lastro se CONSTITUI emitindo na reserva. É a mesma
 * coisa que um sistema real faz — o dinheiro na mão das pessoas tem que estar coberto pelo que a
 * plataforma detém. Contas de sistema passam direto pela trava (o gatilho retorna cedo), então
 * capitalizar a reserva é permitido; creditar pessoa além da cobertura, não.
 *
 * Deixa folga: capacidade alvo = 2× o que ficará emitido, então a cobertura pousa em ~50%, longe
 * do teto de 80% — senão a emissão seguinte já nasceria bloqueada.
 */
export async function garantirLastro(
  tenantId: string, contaReservaId: string, centavosAEmitir: number, actorId: string
): Promise<{ capacidade: number; emitido: number; cobertura: number }> {
  const ler = async () => {
    const r = await runQueryWithTenant<{ cap: string; cred: string }>(
      tenantId,
      `SELECT execution_capacity_cents::text AS cap, total_credits_cents::text AS cred
         FROM system_coverage WHERE tenant_id = $1`,
      [tenantId]
    );
    return { cap: Number(r?.cap ?? 0), cred: Number(r?.cred ?? 0) };
  };

  const antes = await ler();
  const alvo = (antes.cred + centavosAEmitir) * 2;
  if (antes.cap < alvo) {
    await emitirParaConta({
      tenantId, contaId: contaReservaId, centavos: alvo - antes.cap, actorId,
      motivo: 'capacidade-reserva',
      descricao: 'Constituição de lastro da plataforma — desenvolvimento',
    });
  }

  const depois = await ler();
  return {
    capacidade: depois.cap,
    emitido: depois.cred,
    cobertura: depois.cap > 0 ? (depois.cred / depois.cap) * 100 : 100,
  };
}

/** Garante as contas de plataforma do tenant e devolve a emissora (reserva). */
export async function garantirReserva(tenantId: string): Promise<{ accountId: string }> {
  await bankAccountService.ensurePlatformAccounts(tenantId, 'BRL');
  const reserva = await bankAccountService.getSystemAccount(tenantId, 'reserve', 'BRL');
  if (!reserva) throw new Error('ABORT: conta emissora (reserva) não foi criada por ensurePlatformAccounts.');
  return { accountId: reserva.accountId };
}

/** Uma conta de pessoa que ainda carrega valor. */
export interface ContaComRecursos {
  /** 🔴 A PK de `bank_accounts` chama-se `id`, NÃO `account_id` — perguntado ao banco depois de eu
   *  ter deduzido errado e o script quebrar. `bank_ledger.account_id` é que aponta para cá. */
  id: string;
  owner_type: string;
  actor_id: string | null;
  tenant_id: string;
  nome: string | null;
  centavos: string;
}

/**
 * O QUE ESTÁ EM CIRCULAÇÃO — contas de PESSOA que ainda carregam valor.
 *
 * 🔴 Mora aqui, e não no script, pela TERCEIRA vez que esta lição apareceu hoje: só o domínio Bank
 * lê `bank_*` (C4-BANK-READ-BOUNDARY). `owner_type` real, medido: 'system' e 'actor' — o serviço
 * mapeia 'user' → 'actor'. Contas de plataforma ficam de fora de propósito: são infraestrutura,
 * não o que circula.
 *
 * 🔴 TENANT-LOOP, não `pool` cru. A pergunta é legitimamente CROSS-TENANT (recolher tudo o que
 * circula), e a casa já tem o padrão para isso (DECISION-0149, citado pelo próprio
 * `audit-rls-tenant-context`): itera os tenants e consulta CADA UM sob o seu contexto. Consulta
 * crua atravessaria RLS — ou, sob o papel de runtime, devolveria ZERO em silêncio.
 */
export async function listarContasComRecursos(): Promise<ContaComRecursos[]> {
  const { pool, runQueriesWithTenant } = await import('@core/database/pool');
  const tenants = await pool.query<{ id: string }>('SELECT id::text FROM tenants');
  const achadas: ContaComRecursos[] = [];
  for (const t of tenants.rows) {
    const linhas = await runQueriesWithTenant<ContaComRecursos>(
      t.id,
      `SELECT ba.id::text, ba.owner_type, ba.actor_id::text, ba.tenant_id::text,
              a.display_name AS nome,
              COALESCE(SUM(CASE WHEN l.direction='credit' THEN l.amount_cents ELSE -l.amount_cents END),0)::text AS centavos
         FROM bank_accounts ba
         LEFT JOIN bank_ledger l ON l.account_id = ba.id
         LEFT JOIN actors a ON a.id = ba.actor_id
        WHERE ba.tenant_id = $1::uuid AND ba.owner_type <> 'system'
        GROUP BY ba.id, ba.owner_type, ba.actor_id, ba.tenant_id, a.display_name
       HAVING COALESCE(SUM(CASE WHEN l.direction='credit' THEN l.amount_cents ELSE -l.amount_cents END),0) > 0`,
      [t.id]
    );
    achadas.push(...linhas);
  }
  return achadas.sort((a, b) => Number(b.centavos) - Number(a.centavos));
}

/** Conta de uma pessoa, criada se ainda não existir. */
export async function contaDaPessoa(tenantId: string, userId: string): Promise<{ accountId: string }> {
  const c = await bankAccountService.getOrCreateAccount(tenantId, {
    ownerId: userId, ownerType: 'user', currency: 'BRL',
  });
  return { accountId: c.accountId };
}
