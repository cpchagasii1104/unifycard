// BOOT.ts - ÚNICO ENTRYPOINT DO BACKEND
import { loadBackendEnv } from './src/core/db/load-backend-env';
import { isFinancialWorkerEnabled } from './src/workers/financial-worker-gate';
import { assertSensitivePermissionsHaveCapabilityMapping } from './src/core/authorization/permission-keys';
import { assertCompanyPolicyRegistryExhaustive } from './src/core/authorization/company-policy-registry';
import { validateEnv } from './src/core/config/env-validation';

loadBackendEnv();
assertSensitivePermissionsHaveCapabilityMapping();
// DECISION-0189 R3 (boot fail-closed): toda PermissionKey precisa de classificação explícita
// no COMPANY_POLICY_REGISTRY — chave sem handler/classificação NÃO cai em ownership: derruba o boot.
assertCompanyPolicyRegistryExhaustive();

// ─────────────────────────────────────────────────────────────
// VALIDAÇÃO DE VARIÁVEIS DE AMBIENTE (ANTES DE QUALQUER COISA)
// ─────────────────────────────────────────────────────────────
try {
  validateEnv();
  console.log('✅ [BOOT] Validação de variáveis de ambiente: OK');
} catch (error) {
  console.error('❌ [BOOT] ERRO FATAL: Validação de variáveis de ambiente falhou');
  console.error(error);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// MARCA D'ÁGUA DE DIAGNÓSTICO
// ─────────────────────────────────────────────────────────────
console.log(
  'RUN TAG:',
  process.env.UNIFICARD_RUN || 'SEM_TAG',
  'PID:',
  process.pid
);
console.log('🔵 [BOOT] BOOT.ts carregado (ÚNICO ENTRYPOINT)');

// ─────────────────────────────────────────────────────────────
// BUILD APP — implementação em src/app.builder.ts (PLANO FASE T)
// ─────────────────────────────────────────────────────────────
import * as net from 'net';

import { buildApp } from './src/app.builder';
export { buildApp };

// ─────────────────────────────────────────────────────────────
// FUNÇÃO AUXILIAR: Verificar se porta está em uso
// ─────────────────────────────────────────────────────────────
async function checkPortInUse(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true); // Porta está em uso
      } else {
        resolve(false); // Outro erro, assumir que porta está livre
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(false); // Porta está livre
    });
    
    server.listen(port, host);
  });
}

// ─────────────────────────────────────────────────────────────
// CONFIGURAÇÃO DE PORTA E HOST
// ─────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// ─────────────────────────────────────────────────────────────
// START SERVER (BOOTSTRAP LINEAR E SEGURO)
// ─────────────────────────────────────────────────────────────
export async function startServer(): Promise<void> {
  console.log('🚀 [BOOT] starting server');
  console.log(`[BOOT] Porta configurada: ${PORT}`);
  console.log(`[BOOT] Host configurado: ${HOST}`);

  // Schema Guard: Valida schema mínimo ANTES de iniciar servidor
  const { validateSchemaOrDie } = await import('./src/core/db/schema-guard');
  await validateSchemaOrDie();

  // Import dinâmico do DB (NUNCA no topo)
  const { getDatabaseInfo, logDatabaseConnectionInfo } =
    await import('./src/core/database/pool');

  logDatabaseConnectionInfo();

  try {
    await Promise.race([
      getDatabaseInfo(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout (5s)')), 5000)
      ),
    ]);
  } catch (err) {
    console.warn('⚠️ [BOOT] DB indisponível (não bloqueante):', err);
  }

  // ── DB ROLE / RLS PRE-FLIGHT (F-DB-ROLE-AND-RLS-HARDENING) ──────────────────
  // Fail-closed em produção se o runtime estiver como superuser/BYPASSRLS ou as tabelas
  // financeiras não tiverem RLS+FORCE+policy (anti "RLS theatre"). Fora de produção: aviso alto.
  try {
    const { runDbRoleRlsPreflight } = await import('./src/core/database/db-role-rls-preflight');
    await runDbRoleRlsPreflight();
  } catch (err) {
    console.error('❌ [BOOT] ERRO FATAL: DB role/RLS pre-flight fail-closed (money runtime inseguro):', err);
    throw err;
  }

  // ── CATÁLOGO DE PERMISSÕES EMPRESARIAIS (DECISION-0189 R16) — FAIL-CLOSED ───
  // O código (company-policy-registry) é soberano; o banco é materialização versionada.
  // Digest divergente/ausente = chave mudando de significado silenciosamente → boot FALHA.
  try {
    const { pool } = await import('./src/core/database/pool');
    const { assertCompanyPermissionCatalogInSync } = await import('./src/core/authorization/company-policy-registry');
    await assertCompanyPermissionCatalogInSync(pool);
    console.log('✅ [BOOT] Catálogo de permissões empresariais em sincronia (digest OK)');
  } catch (err) {
    console.error('❌ [BOOT] ERRO FATAL: catálogo de permissões empresariais divergente do código (DECISION-0189 R16):', err);
    throw err;
  }

  console.log('[BOOT] Construindo aplicação Fastify...');
  const app = await buildApp();
  console.log('[BOOT] Aplicação Fastify construída com sucesso');

  // Registrar handlers de eventos SOMENTE AGORA
  try {
    const { registerCoreHandlers } =
      await import('./src/core/events/register-handlers');
    await registerCoreHandlers();
    console.log('[BOOT] Handlers de eventos registrados');
  } catch (err) {
    console.warn('[BOOT] Aviso: Erro ao registrar handlers de eventos (não bloqueante):', err);
  }

  // Verificar se a porta está ocupada ANTES de tentar iniciar o servidor
  console.log(`[BOOT] Verificando disponibilidade da porta ${PORT}...`);
  const isPortInUse = await checkPortInUse(PORT, HOST);
  if (isPortInUse) {
    const errorMsg = [
      '='.repeat(60),
      '❌ ERRO FATAL: Porta já está em uso',
      '='.repeat(60),
      `Porta configurada: ${PORT}`,
      `Host: ${HOST}`,
      '',
      'AÇÃO REQUERIDA:',
      '  1. Encerre o processo que está usando a porta, OU',
      '  2. Defina outra porta via variável de ambiente PORT',
      '',
      'Para identificar o processo que usa a porta:',
      `  Windows: netstat -ano | findstr :${PORT}`,
      `  Linux/Mac: lsof -i :${PORT} ou netstat -tulpn | grep :${PORT}`,
      '='.repeat(60),
    ].join('\n');
    console.error(errorMsg);
    throw new Error(`Porta ${PORT} já está em uso. Encerre o processo que usa a porta ou defina outra PORT.`);
  }
  console.log(`[BOOT] Porta ${PORT} disponível`);

  console.log(`[BOOT] Iniciando servidor HTTP na porta ${PORT}, host ${HOST}...`);
  try {
    const address = await app.listen({ port: PORT, host: HOST });
    console.log(`[BOOT] Servidor HTTP iniciado com sucesso: ${address}`);
  } catch (err: any) {
    // Se ainda assim ocorrer EADDRINUSE (race condition), tratar explicitamente
    if (err.code === 'EADDRINUSE') {
      const errorMsg = [
        '='.repeat(60),
        '❌ ERRO FATAL: Porta já está em uso (EADDRINUSE)',
        '='.repeat(60),
        `Porta configurada: ${PORT}`,
        `Host: ${HOST}`,
        '',
        'AÇÃO REQUERIDA:',
        '  1. Encerre o processo que está usando a porta, OU',
        '  2. Defina outra porta via variável de ambiente PORT',
        '',
        'Para identificar o processo que usa a porta:',
        `  Windows: netstat -ano | findstr :${PORT}`,
        `  Linux/Mac: lsof -i :${PORT} ou netstat -tulpn | grep :${PORT}`,
        '='.repeat(60),
      ].join('\n');
      console.error(errorMsg);
      throw new Error(`Porta ${PORT} já está em uso (EADDRINUSE). Encerre o processo que usa a porta ou defina outra PORT.`);
    }
    console.error('❌ [BOOT] ERRO FATAL ao iniciar servidor HTTP:', err);
    throw err;
  }

  console.log('='.repeat(60));
  console.log('✅ SERVIDOR INICIADO COM SUCESSO');
  console.log('='.repeat(60));
  console.log(`[BOOT] PID: ${process.pid}`);
  console.log(`[BOOT] URL: http://localhost:${PORT}`);
  console.log(`[BOOT] HEALTH: http://localhost:${PORT}/health`);
  console.log(`[BOOT] AUTH: http://localhost:${PORT}/auth/login`);
  console.log(`[BOOT] Servidor escutando na porta ${PORT}`);
  console.log('='.repeat(60));

  // Financial Operations Monitor — verificações a cada 30s (somente leitura)
  try {
    const { pool } = await import('./src/core/database/pool');
    const { runFinancialOperationsCheck, CHECK_INTERVAL_MS } = await import('./src/core/observability/financial-operations-monitor');
    setInterval(() => {
      runFinancialOperationsCheck(pool).catch((err) => {
        console.warn('[BOOT] Financial Operations Check error:', err);
      });
    }, CHECK_INTERVAL_MS);
    console.log(`[BOOT] Financial Operations Monitor: check a cada ${CHECK_INTERVAL_MS / 1000}s`);
  } catch (err) {
    console.warn('[BOOT] Aviso: Financial Operations Monitor não iniciado (não bloqueante):', err);
  }

  // Payment Worker — consome fila payment-events (Redis/BullMQ); opcional se REDIS_ENABLED=false
  try {
    const { startPaymentWorker } = await import('./src/workers/payment-worker');
    if (startPaymentWorker()) {
      console.log('[BOOT] Payment Worker iniciado (fila payment-events)');
    }
  } catch (err) {
    console.warn('[BOOT] Aviso: Payment Worker não iniciado:', err);
  }

  // Settlement Worker — processa PaymentIntents escrowed → seller_pending (a cada 10s).
  // 🔒 DORMÊNCIA ESTRUTURAL (35p / F-RLS-PREFLIGHT-SETTLEMENT-RELEASE-WORKER-DEFAULT-OFF):
  // claima payment_intents CROSS-TENANT antes do tenant-context; payment_intents NÃO tem RLS →
  // o flip RLS-físico NÃO o torna inerte (inércia atual = tabela vazia, não contenção estrutural).
  // settle escreve external_settled_at em bank_transactions. DEFAULT-OFF (ENABLE_SETTLEMENT_WORKER='true').
  if (isFinancialWorkerEnabled('ENABLE_SETTLEMENT_WORKER')) {
    try {
      const { startSettlementWorker } = await import('./src/workers/settlement-worker');
      startSettlementWorker();
      console.log('[BOOT] Settlement Worker iniciado (ENABLE_SETTLEMENT_WORKER=true; escrowed → seller_pending a cada 10s)');
    } catch (err) {
      console.warn('[BOOT] Aviso: Settlement Worker não iniciado:', err);
    }
  } else {
    console.log('[BOOT] Settlement Worker DESLIGADO (default-off; ENABLE_SETTLEMENT_WORKER≠true) — claim cross-tenant + payment_intents sem RLS; religar só após #34 tenant-loop.');
  }

  // Release Worker — processa PaymentIntents settled → seller_available (a cada 10s); MOVE DINHEIRO.
  // 🔒 DORMÊNCIA ESTRUTURAL (35p): mesmo claim cross-tenant + payment_intents sem RLS; release executa
  // transfer seller_pending→seller_available (escreve bank_ledger). DEFAULT-OFF (ENABLE_RELEASE_WORKER='true').
  if (isFinancialWorkerEnabled('ENABLE_RELEASE_WORKER')) {
    try {
      const { startReleaseWorker } = await import('./src/workers/release-worker');
      startReleaseWorker();
      console.log('[BOOT] Release Worker iniciado (ENABLE_RELEASE_WORKER=true; settled → seller_available a cada 10s)');
    } catch (err) {
      console.warn('[BOOT] Aviso: Release Worker não iniciado:', err);
    }
  } else {
    console.log('[BOOT] Release Worker DESLIGADO (default-off; ENABLE_RELEASE_WORKER≠true) — move dinheiro (seller_pending→seller_available); religar só após #34 tenant-loop.');
  }

  // Idempotency keys cleanup — remove registros > 24h (função cleanup_idempotency_keys, a cada 1h)
  try {
    const { startIdempotencyCleanupWorker } = await import(
      './src/workers/idempotency-cleanup-worker'
    );
    startIdempotencyCleanupWorker();
    console.log('[BOOT] Idempotency Cleanup Worker iniciado (intent.execute keys > 24h)');
  } catch (err) {
    console.warn('[BOOT] Aviso: Idempotency Cleanup Worker não iniciado:', err);
  }

  // Event outbox — publica eventos apenas após commit (retry seguro; idempotência event_id)
  try {
    const { startEventOutboxWorker } = await import('./src/workers/event-outbox-worker');
    startEventOutboxWorker();
    console.log('[BOOT] Event Outbox Worker iniciado (fila event_outbox → event_log)');
  } catch (err) {
    console.warn('[BOOT] Aviso: Event Outbox Worker não iniciado:', err);
  }

  try {
    const { startHandlerFailureWorker } = await import('./src/workers/handler-failure-worker');
    startHandlerFailureWorker();
    console.log('[BOOT] Handler Failure Worker iniciado (event_handler_failures → retry por handler_key)');
  } catch (err) {
    console.warn('[BOOT] Aviso: Handler Failure Worker não iniciado:', err);
  }

  try {
    const { startSagaTimeoutWorker } = await import('./src/workers/saga-timeout.worker');
    startSagaTimeoutWorker();
    console.log('[BOOT] Saga Timeout Worker iniciado (order_sagas timeout → cancelled + outbox)');
  } catch (err) {
    console.warn('[BOOT] Aviso: Saga Timeout Worker não iniciado:', err);
  }

  // INFRA-3 — reconciliação SSOT vs derivados (só leitura; `RECONCILIATION_INTERVAL_MS`, default 60s)
  try {
    const { startReconciliationScheduledWorker } = await import(
      './src/workers/reconciliation-scheduled.worker'
    );
    startReconciliationScheduledWorker();
    console.log(
      '[BOOT] Reconciliation Scheduled Worker iniciado (INFRA-3 runFullReconciliation + métricas drift)'
    );
  } catch (err) {
    console.warn('[BOOT] Aviso: Reconciliation Scheduled Worker (INFRA-3) não iniciado:', err);
  }

  // Payout Worker — CANÔNICO system-only (F-PAYOUT-WORKER-SYSTEM-ONLY-SEAL, DECISION-0128).
  // 🔒 DEFAULT-OFF (ENABLE_PAYOUT_WORKER='true' estrito; sem auto-enable por NODE_ENV). Consome SOMENTE
  // actor_wallet_payout_requests approved → executor SELADO executeActorWalletPayout (recovery lock + Bank port).
  // O worker LEGADO seller_available→seller_payout está TOMBSTONED (payout-worker.ts) e não é mais iniciado.
  if (isFinancialWorkerEnabled('ENABLE_PAYOUT_WORKER')) {
    try {
      const { startActorWalletPayoutWorker } = await import('./src/workers/actor-wallet-payout-worker');
      startActorWalletPayoutWorker();
      console.log('[BOOT] ActorWallet Payout Worker iniciado (ENABLE_PAYOUT_WORKER=true; approved payouts a cada 10s)');
    } catch (err) {
      console.warn('[BOOT] Aviso: ActorWallet Payout Worker não iniciado:', err);
    }
  } else {
    console.log('[BOOT] ActorWallet Payout Worker DESLIGADO (default-off; ENABLE_PAYOUT_WORKER≠true).');
  }

  // Reversal Worker — Prompt 51: reversals pending → transfer espelhado (a cada 30s).
  // 🔒 DORMÊNCIA ESTRUTURAL: move dinheiro; dispute/reversal contido. DEFAULT-OFF (ENABLE_REVERSAL_WORKER='true').
  if (isFinancialWorkerEnabled('ENABLE_REVERSAL_WORKER')) {
    try {
      const { startReversalWorker } = await import('./src/workers/reversal-worker');
      startReversalWorker();
      console.log('[BOOT] Reversal Worker iniciado (ENABLE_REVERSAL_WORKER=true; reversals a cada 30s)');
    } catch (err) {
      console.warn('[BOOT] Aviso: Reversal Worker não iniciado:', err);
    }
  } else {
    console.log('[BOOT] Reversal Worker DESLIGADO (default-off; ENABLE_REVERSAL_WORKER≠true) — dispute/reversal contido.');
  }

  // Bank Settlement Worker — processa bank_settlements (pending → seller_payout → bank_settlement, a cada 10s).
  // 🔒 DORMÊNCIA ESTRUTURAL: executor de dinheiro (trilho legado seller). DEFAULT-OFF (ENABLE_BANK_SETTLEMENT_WORKER='true').
  if (isFinancialWorkerEnabled('ENABLE_BANK_SETTLEMENT_WORKER')) {
    try {
      const { startBankSettlementWorker } = await import('./src/workers/bank-settlement-worker');
      startBankSettlementWorker();
      console.log('[BOOT] Bank Settlement Worker iniciado (ENABLE_BANK_SETTLEMENT_WORKER=true; pending settlements a cada 10s)');
    } catch (err) {
      console.warn('[BOOT] Aviso: Bank Settlement Worker não iniciado:', err);
    }
  } else {
    console.log('[BOOT] Bank Settlement Worker DESLIGADO (default-off; ENABLE_BANK_SETTLEMENT_WORKER≠true) — Core EXECUTION HOLD.');
  }

  // Reconciliation Engine (Prompt 52) — diagnóstico ledger/transactions/contas, a cada 5min (configurável)
  try {
    const { startReconciliationEngineWorker } = await import(
      './src/workers/reconciliation-engine-worker'
    );
    startReconciliationEngineWorker();
    console.log('[BOOT] Reconciliation Engine Worker iniciado (Prompt 52)');
  } catch (err) {
    console.warn('[BOOT] Aviso: Reconciliation Engine Worker não iniciado:', err);
  }

  // Risk Identity Reconcile (53.1) — reavalia score a partir de eventos (15min default)
  try {
    const { startRiskIdentityReconcileWorker } = await import(
      './src/workers/risk-identity-reconcile.worker'
    );
    startRiskIdentityReconcileWorker();
    console.log('[BOOT] Risk Identity Reconcile Worker (53.1)');
  } catch (err) {
    console.warn('[BOOT] Aviso: Risk Identity Reconcile Worker não iniciado:', err);
  }

  // Observabilidade financeira / SLA (alert · metrics · risk · sla-monitor) — leem tabelas financeiras
  // CROSS-TENANT (sem tenant-context). 🔒 DORMÊNCIA (F-RLS-PREFLIGHT-WORKER-DORMANCY-SWEEP + DECISION-0149):
  // sob unificard_app/NOBYPASSRLS rodariam CEGOS (0 linhas → métrica/alerta/risco/SLA falsos). NÃO movem
  // dinheiro, mas default-off até #34 tenant-loop. Antes ligavam incondicionalmente (runbook §1.7 era inefetivo).

  // Financial Alert Worker — detecção de anomalias (LARGE_PAYOUT, SETTLEMENT_FAILED, PAYOUT_FAILED, a cada 60s)
  if (isFinancialWorkerEnabled('ENABLE_FINANCIAL_ALERT_WORKER')) {
    try {
      const { startFinancialAlertWorker } = await import('./src/workers/financial-alert-worker');
      startFinancialAlertWorker();
      console.log('[BOOT] Financial Alert Worker iniciado (ENABLE_FINANCIAL_ALERT_WORKER=true; anomaly alerts a cada 60s)');
    } catch (err) {
      console.warn('[BOOT] Aviso: Financial Alert Worker não iniciado:', err);
    }
  } else {
    console.log('[BOOT] Financial Alert Worker DESLIGADO (default-off; ENABLE_FINANCIAL_ALERT_WORKER≠true) — leitura cross-tenant cega sob RLS; religar só após #34 tenant-loop.');
  }

  // Financial Metrics Worker — agregação de métricas (total_volume, total_payouts, total_settlements, total_transactions, a cada 5min)
  if (isFinancialWorkerEnabled('ENABLE_FINANCIAL_METRICS_WORKER')) {
    try {
      const { startFinancialMetricsWorker } = await import('./src/workers/financial-metrics-worker');
      startFinancialMetricsWorker();
      console.log('[BOOT] Financial Metrics Worker iniciado (ENABLE_FINANCIAL_METRICS_WORKER=true; aggregation a cada 5min)');
    } catch (err) {
      console.warn('[BOOT] Aviso: Financial Metrics Worker não iniciado:', err);
    }
  } else {
    console.log('[BOOT] Financial Metrics Worker DESLIGADO (default-off; ENABLE_FINANCIAL_METRICS_WORKER≠true) — agregação cross-tenant cega sob RLS; religar só após #34 tenant-loop.');
  }

  // Risk Analysis Worker — detecção de risco (MANY_PAYOUTS, LARGE_TRANSACTION, MANY_PAYMENT_ATTEMPTS, a cada 60s)
  if (isFinancialWorkerEnabled('ENABLE_RISK_ANALYSIS_WORKER')) {
    try {
      const { startRiskAnalysisWorker } = await import('./src/workers/risk-analysis-worker');
      startRiskAnalysisWorker();
      console.log('[BOOT] Risk Analysis Worker iniciado (ENABLE_RISK_ANALYSIS_WORKER=true; risk detection a cada 60s)');
    } catch (err) {
      console.warn('[BOOT] Aviso: Risk Analysis Worker não iniciado:', err);
    }
  } else {
    console.log('[BOOT] Risk Analysis Worker DESLIGADO (default-off; ENABLE_RISK_ANALYSIS_WORKER≠true) — análise cross-tenant cega sob RLS; religar só após #34 tenant-loop.');
  }

  // Financial SLA Monitor — atrasos operacionais (settlement_delay, payout_delay, bank_settlement_delay, a cada 60s)
  if (isFinancialWorkerEnabled('ENABLE_SLA_MONITOR_WORKER')) {
    try {
      const { startSlaMonitorWorker } = await import('./src/workers/sla-monitor-worker');
      startSlaMonitorWorker();
      console.log('[BOOT] Financial SLA Monitor iniciado (ENABLE_SLA_MONITOR_WORKER=true)');
    } catch (err) {
      console.warn('[BOOT] Aviso: Financial SLA Monitor não iniciado:', err);
    }
  } else {
    console.log('[BOOT] Financial SLA Monitor DESLIGADO (default-off; ENABLE_SLA_MONITOR_WORKER≠true) — monitor cross-tenant cego sob RLS; religar só após #34 tenant-loop.');
  }

  // Ledger Snapshot Worker — snapshots periódicos de saldo por conta (a cada 10 min)
  try {
    const { startLedgerSnapshotWorker } = await import('./src/workers/ledger-snapshot-worker');
    startLedgerSnapshotWorker();
    console.log('[BOOT] Ledger Snapshot Worker iniciado');
  } catch (err) {
    console.warn('[BOOT] Aviso: Ledger Snapshot Worker não iniciado:', err);
  }

  // Governance Execution Worker — executa propostas aprovadas (a cada 60s)
  try {
    const { startGovernanceExecutionWorker } = await import('./src/workers/governance-execution-worker');
    startGovernanceExecutionWorker();
    console.log('[BOOT] Governance Execution Worker iniciado');
  } catch (err) {
    console.warn('[BOOT] Aviso: Governance Execution Worker não iniciado:', err);
  }

  // Governance Financial Action Worker — processa ações financeiras via PaymentIntent (a cada 60s)
  try {
    const { startGovernanceFinancialActionWorker } = await import('./src/workers/governance-financial-action-worker');
    startGovernanceFinancialActionWorker();
    console.log('[BOOT] Governance Financial Action Worker iniciado');
  } catch (err) {
    console.warn('[BOOT] Aviso: Governance Financial Action Worker não iniciado:', err);
  }

  // Treasury Distribution Worker — cria governance_financial_actions a partir de treasury_distributions (a cada 60s)
  // 🔴 F-BANK-SPLIT-PIPELINE-CONSOLIDATION Fase 1E-1b (DECISION-0165 D5/D8, sistema virgem): irmão gêmeo
  //    do treasury-split-worker — bootava SEM gate financeiro. Agora GATED default-OFF (mesmo padrão);
  //    gate ANTES de startTreasuryDistributionWorker() → nenhum ciclo/mutação. Corpo/schema/regra intocados.
  if (isFinancialWorkerEnabled('ENABLE_TREASURY_DISTRIBUTION_WORKER')) {
    try {
      const { startTreasuryDistributionWorker } = await import('./src/workers/treasury-distribution-worker');
      startTreasuryDistributionWorker();
      console.log('[BOOT] Treasury Distribution Worker iniciado (ENABLE_TREASURY_DISTRIBUTION_WORKER=true)');
    } catch (err) {
      console.warn('[BOOT] Aviso: Treasury Distribution Worker não iniciado:', err);
    }
  } else {
    console.log('[BOOT] Treasury Distribution Worker DESLIGADO (default-off; ENABLE_TREASURY_DISTRIBUTION_WORKER≠true) — worker de tesouraria; religar só via pipeline canônico/PORTA-1.');
  }

  // Treasury Split Engine — split automático (sent settlements → regional_fund, community_fund, etc.)
  // 🔴 F-BANK-SPLIT-PIPELINE-CONSOLIDATION Fase 1E-1 (DECISION-0165 D5/D8, sistema virgem): este worker
  //    bootava SEM gate financeiro (ao contrário dos ~9 outros workers, todos isFinancialWorkerEnabled),
  //    executando o treasury-split (caminho paralelo/legado) contido APENAS pelo sink firewall. Agora
  //    GATED default-OFF (mesmo padrão) — não boota sem ENABLE_TREASURY_SPLIT_WORKER=true. O gate roda
  //    ANTES de o worker iniciar → nenhum ciclo/claim/executeSplit ocorre; zero mutação.
  if (isFinancialWorkerEnabled('ENABLE_TREASURY_SPLIT_WORKER')) {
    try {
      const { startTreasurySplitWorker } = await import('./src/workers/treasury-split-worker');
      startTreasurySplitWorker();
      console.log('[BOOT] Treasury Split Engine iniciado (ENABLE_TREASURY_SPLIT_WORKER=true)');
    } catch (err) {
      console.warn('[BOOT] Aviso: Treasury Split Engine não iniciado:', err);
    }
  } else {
    console.log('[BOOT] Treasury Split Engine DESLIGADO (default-off; ENABLE_TREASURY_SPLIT_WORKER≠true) — split treasury é caminho paralelo/legado; religar só via pipeline canônico/PORTA-1.');
  }

  // Governance Funding Worker — propostas aprovadas (community_project_funding) → PaymentIntent
  try {
    const { startGovernanceFundingWorker } = await import('./src/workers/governance-funding-worker');
    startGovernanceFundingWorker();
    console.log('[BOOT] Governance Funding Worker iniciado');
  } catch (err) {
    console.warn('[BOOT] Aviso: Governance Funding Worker não iniciado:', err);
  }

  // Governance Funding Commitment Worker — commitment (intenção) → valida saldo → treasury→escrow → PaymentIntent.
  // 🔒 DORMÊNCIA ESTRUTURAL (F-RLS-PREFLIGHT-WORKER-DORMANCY-SWEEP): MONEY-WRITE — executa
  // bankTransactionService.transfer(treasury→escrow) (escreve bank_ledger) e claima commitments CROSS-TENANT
  // antes do tenant-context; freio anterior = fila vazia (comportamental), não contenção. DEFAULT-OFF
  // (ENABLE_GOVERNANCE_FUNDING_COMMITMENT_WORKER='true'); religar só após #34 tenant-loop.
  if (isFinancialWorkerEnabled('ENABLE_GOVERNANCE_FUNDING_COMMITMENT_WORKER')) {
    try {
      const { startGovernanceFundingCommitmentWorker } = await import('./src/workers/governance-funding-commitment-worker');
      startGovernanceFundingCommitmentWorker();
      console.log('[BOOT] Governance Funding Commitment Worker iniciado (ENABLE_GOVERNANCE_FUNDING_COMMITMENT_WORKER=true)');
    } catch (err) {
      console.warn('[BOOT] Aviso: Governance Funding Commitment Worker não iniciado:', err);
    }
  } else {
    console.log('[BOOT] Governance Funding Commitment Worker DESLIGADO (default-off; ENABLE_GOVERNANCE_FUNDING_COMMITMENT_WORKER≠true) — move dinheiro (treasury→escrow); religar só após #34 tenant-loop.');
  }
}

// ─────────────────────────────────────────────────────────────
// ENTRYPOINT (ÚNICO PONTO DE EXECUÇÃO)
// ─────────────────────────────────────────────────────────────
console.log('='.repeat(60));
console.log('🚀 INICIANDO BACKEND UNIFICARD');
console.log('='.repeat(60));
console.log(`[BOOT] Node version: ${process.version}`);
console.log(`[BOOT] NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`[BOOT] PID: ${process.pid}`);
console.log('='.repeat(60));

startServer().catch((err) => {
  console.error('='.repeat(60));
  console.error('❌ [BOOT] ERRO FATAL ao iniciar servidor:');
  console.error('='.repeat(60));
  console.error(err);
  console.error('='.repeat(60));
  process.exit(1);
});
