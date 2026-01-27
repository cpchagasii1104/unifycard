// scripts/run-scheduler-manual.ts
// Script para rodar scheduler manualmente em dev
// FASE 10: Validação e hardening

import { eventScheduler } from '../src/jobs/event-scheduler';

/**
 * Executa jobs do scheduler manualmente
 * 
 * USO:
 *   npx ts-node scripts/run-scheduler-manual.ts processEndedEvents
 *   npx ts-node scripts/run-scheduler-manual.ts lockUpcomingEvents
 *   npx ts-node scripts/run-scheduler-manual.ts expirePenalties
 *   npx ts-node scripts/run-scheduler-manual.ts processOverdueDebts
 *   npx ts-node scripts/run-scheduler-manual.ts dailyDebtEscalationJob
 */

const command = process.argv[2];

async function main() {
  console.log(`[Scheduler Manual] Executando: ${command}`);

  try {
    switch (command) {
      case 'processEndedEvents':
        await eventScheduler.processEndedEvents();
        console.log('✅ Eventos finalizados processados');
        break;

      case 'lockUpcomingEvents':
        await eventScheduler.lockUpcomingEvents();
        console.log('✅ Escrows de eventos próximos bloqueados');
        break;

      case 'expirePenalties':
        await eventScheduler.expirePenalties();
        console.log('✅ Penalidades expiradas processadas');
        break;

      case 'processOverdueDebts':
        await eventScheduler.processOverdueDebts();
        console.log('✅ Débitos vencidos processados');
        break;

      case 'dailyDebtEscalationJob':
        await eventScheduler.dailyDebtEscalationJob();
        console.log('✅ Escalação diária de débitos executada');
        break;

      default:
        console.error('❌ Comando inválido. Use: processEndedEvents | lockUpcomingEvents | expirePenalties | processOverdueDebts | dailyDebtEscalationJob');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Erro ao executar scheduler:', error);
    process.exit(1);
  }
}

main();

