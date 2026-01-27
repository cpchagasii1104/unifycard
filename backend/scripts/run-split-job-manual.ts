// scripts/run-split-job-manual.ts
// Script para rodar split job manualmente em dev
// FASE 10: Validação e hardening

import { postEventSplitJob } from '../src/jobs/post-event-split.job';

/**
 * Executa split job para um evento específico
 * 
 * USO:
 *   npx ts-node scripts/run-split-job-manual.ts <tenantId> <eventId>
 * 
 * EXEMPLO:
 *   npx ts-node scripts/run-split-job-manual.ts 123e4567-e89b-12d3-a456-426614174000 789e0123-e45b-67c8-d901-234567890abc
 */

const tenantId = process.argv[2];
const eventId = process.argv[3];

async function main() {
  if (!tenantId || !eventId) {
    console.error('❌ Uso: npx ts-node scripts/run-split-job-manual.ts <tenantId> <eventId>');
    process.exit(1);
  }

  console.log(`[Split Job Manual] Processando evento ${eventId} para tenant ${tenantId}`);

  try {
    await postEventSplitJob.execute(tenantId, eventId);
    console.log('✅ Split job executado com sucesso');
  } catch (error) {
    console.error('❌ Erro ao executar split job:', error);
    process.exit(1);
  }
}

main();














