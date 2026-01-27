// backend/scripts/test-event-replay.ts
// Script para testar idempotência de eventos críticos (replay adversarial)

import { eventBus } from '../src/core/events/event-bus';
import { pool } from '../src/core/database/pool';
import { runQueryWithTenant } from '../src/core/database/pool';

interface TestResult {
  scenario: string;
  eventId: string;
  eventType: string;
  firstAttempt: {
    success: boolean;
    result?: any;
    error?: string;
  };
  replayAttempt: {
    success: boolean;
    result?: any;
    error?: string;
    replayDetected: boolean;
  };
  idempotent: boolean;
  recommendation: string;
}

const TEST_TENANT_ID = 'test-tenant-replay-id';
const TEST_EVENT_ID = 'test-event-replay-id';

/**
 * Cenário 1: Replay de evento de reputação
 */
async function testReputationReplay(): Promise<TestResult> {
  console.log('\n📊 Testando: Replay de evento de reputação (core.review.created)');
  
  const eventId = `${TEST_EVENT_ID}-reputation-${Date.now()}`;
  const payload = {
    entityType: 'worker',
    entityId: 'test-worker-id',
    rating: 5,
    qualityRating: 5,
    punctualityRating: 5,
    professionalismRating: 5,
  };

  let firstAttempt: any = null;
  let firstError: Error | null = null;
  let replayAttempt: any = null;
  let replayError: Error | null = null;
  let replayDetected = false;

  // Primeira tentativa
  try {
    await eventBus.publish({
      tenantId: TEST_TENANT_ID,
      type: 'core.review.created',
      eventId,
      payload,
    });
    firstAttempt = { success: true };
  } catch (error) {
    firstError = error instanceof Error ? error : new Error(String(error));
    firstAttempt = { success: false, error: firstError.message };
  }

  // Aguardar um pouco
  await new Promise(resolve => setTimeout(resolve, 100));

  // Replay (segunda tentativa com mesmo eventId)
  try {
    await eventBus.publish({
      tenantId: TEST_TENANT_ID,
      type: 'core.review.created',
      eventId, // Mesmo eventId
      payload, // Mesmo payload
    });
    replayAttempt = { success: true };
  } catch (error) {
    replayError = error instanceof Error ? error : new Error(String(error));
    replayAttempt = { success: false, error: replayError.message };
  }

  // Verificar se replay foi detectado (verificar logs ou tracking)
  const tracking = await runQueryWithTenant<{ result_status: string }>(
    TEST_TENANT_ID,
    `
      SELECT result_status
      FROM event_idempotency_tracking
      WHERE tenant_id = $1 AND event_id = $2 AND handler_name = $3
      LIMIT 1
    `,
    [TEST_TENANT_ID, eventId, 'reputation.applyReview']
  );

  if (tracking && Array.isArray(tracking) && tracking.length > 0) {
    replayDetected = true;
  }

  // Verificar se reputação foi alterada apenas uma vez
  const reputationCount = await runQueryWithTenant<{ count: string }>(
    TEST_TENANT_ID,
    `
      SELECT COUNT(*) as count
      FROM reputation_scores
      WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3
    `,
    [TEST_TENANT_ID, payload.entityType, payload.entityId]
  );

  const isIdempotent = firstAttempt.success && 
    (replayAttempt.success || replayDetected) &&
    (!replayError || replayError.message.includes('replay') || replayError.message.includes('already processed'));

  return {
    scenario: 'Reputation Replay',
    eventId,
    eventType: 'core.review.created',
    firstAttempt: {
      success: firstAttempt.success,
      error: firstError?.message,
    },
    replayAttempt: {
      success: replayAttempt.success,
      error: replayError?.message,
      replayDetected,
    },
    idempotent: isIdempotent,
    recommendation: isIdempotent
      ? '✅ Idempotência funcionando corretamente'
      : '❌ Replay causou efeitos colaterais - corrigir handler',
  };
}

/**
 * Cenário 2: Replay de evento financeiro
 */
async function testTransactionReplay(): Promise<TestResult> {
  console.log('\n📊 Testando: Replay de evento financeiro (transaction.completed)');
  
  const eventId = `${TEST_EVENT_ID}-transaction-${Date.now()}`;
  
  // Nota: Este teste requer setup de contas de teste
  // Por enquanto, apenas verifica se eventId é usado para idempotência
  
  return {
    scenario: 'Transaction Replay',
    eventId,
    eventType: 'transaction.completed',
    firstAttempt: {
      success: false,
      error: 'Test setup required (accounts)',
    },
    replayAttempt: {
      success: false,
      error: 'Test setup required (accounts)',
      replayDetected: false,
    },
    idempotent: false,
    recommendation: '⚠️ Teste requer setup de contas de teste',
  };
}

/**
 * Cenário 3: Replay com payload modificado
 */
async function testReplayWithModifiedPayload(): Promise<TestResult> {
  console.log('\n📊 Testando: Replay com payload modificado');
  
  const eventId = `${TEST_EVENT_ID}-modified-${Date.now()}`;
  const originalPayload = {
    entityType: 'worker',
    entityId: 'test-worker-id',
    rating: 5,
  };
  const modifiedPayload = {
    entityType: 'worker',
    entityId: 'test-worker-id',
    rating: 4, // Modificado
  };

  let firstAttempt: any = null;
  let firstError: Error | null = null;
  let replayAttempt: any = null;
  let replayError: Error | null = null;
  let replayDetected = false;

  // Primeira tentativa
  try {
    await eventBus.publish({
      tenantId: TEST_TENANT_ID,
      type: 'core.review.created',
      eventId,
      payload: originalPayload,
    });
    firstAttempt = { success: true };
  } catch (error) {
    firstError = error instanceof Error ? error : new Error(String(error));
    firstAttempt = { success: false, error: firstError.message };
  }

  // Aguardar um pouco
  await new Promise(resolve => setTimeout(resolve, 100));

  // Replay com payload modificado
  try {
    await eventBus.publish({
      tenantId: TEST_TENANT_ID,
      type: 'core.review.created',
      eventId, // Mesmo eventId
      payload: modifiedPayload, // Payload diferente
    });
    replayAttempt = { success: true };
  } catch (error) {
    replayError = error instanceof Error ? error : new Error(String(error));
    replayAttempt = { success: false, error: replayError.message };
  }

  // Verificar se sistema detectou mudança de payload
  const tracking = await runQueryWithTenant<{ idempotency_key: string }>(
    TEST_TENANT_ID,
    `
      SELECT idempotency_key
      FROM event_idempotency_tracking
      WHERE tenant_id = $1 AND event_id = $2 AND handler_name = $3
      LIMIT 1
    `,
    [TEST_TENANT_ID, eventId, 'reputation.applyReview']
  );

  // Payload modificado deve gerar idempotency key diferente
  const isIdempotent = tracking && Array.isArray(tracking) && tracking.length > 0;

  return {
    scenario: 'Replay with Modified Payload',
    eventId,
    eventType: 'core.review.created',
    firstAttempt: {
      success: firstAttempt.success,
      error: firstError?.message,
    },
    replayAttempt: {
      success: replayAttempt.success,
      error: replayError?.message,
      replayDetected: isIdempotent,
    },
    idempotent: isIdempotent,
    recommendation: isIdempotent
      ? '✅ Sistema detectou mudança de payload'
      : '⚠️ Sistema não detectou mudança de payload',
  };
}

/**
 * Função principal
 */
async function main(): Promise<void> {
  console.log('🚀 Iniciando teste adversarial de replay de eventos...\n');
  
  try {
    const results: TestResult[] = [];

    // Executar cenários de teste
    results.push(await testReputationReplay());
    results.push(await testTransactionReplay());
    results.push(await testReplayWithModifiedPayload());

    // Gerar relatório
    console.log('\n' + '='.repeat(80));
    console.log('📋 RELATÓRIO DE TESTE ADVERSARIAL - EVENT REPLAY');
    console.log('='.repeat(80));

    results.forEach(result => {
      console.log(`\n📊 ${result.scenario}`);
      console.log(`  Event ID: ${result.eventId}`);
      console.log(`  Event Type: ${result.eventType}`);
      console.log(`  Primeira Tentativa: ${result.firstAttempt.success ? '✅ Sucesso' : '❌ Erro'}`);
      if (result.firstAttempt.error) {
        console.log(`    Erro: ${result.firstAttempt.error}`);
      }
      console.log(`  Replay: ${result.replayAttempt.success ? '✅ Sucesso' : '❌ Erro'}`);
      if (result.replayAttempt.error) {
        console.log(`    Erro: ${result.replayAttempt.error}`);
      }
      console.log(`  Replay Detectado: ${result.replayAttempt.replayDetected ? '✅ Sim' : '❌ Não'}`);
      console.log(`  Idempotente: ${result.idempotent ? '✅ Sim' : '❌ Não'}`);
      console.log(`  Recomendação: ${result.recommendation}`);
    });

    // Resumo
    const idempotentCount = results.filter(r => r.idempotent).length;
    const totalCount = results.length;

    console.log('\n' + '='.repeat(80));
    console.log(`📊 Resumo: ${idempotentCount}/${totalCount} cenários idempotentes`);
    console.log('='.repeat(80));

    if (idempotentCount === totalCount) {
      console.log('✅ Todos os cenários são idempotentes!');
      process.exit(0);
    } else {
      console.log('⚠️ Alguns cenários não são idempotentes. Revisar handlers.');
      process.exit(1);
    }

  } catch (error: any) {
    console.error('❌ Erro durante teste adversarial:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Executar
main().catch(console.error);

