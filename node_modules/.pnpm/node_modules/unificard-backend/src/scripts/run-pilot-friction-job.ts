// backend/src/scripts/run-pilot-friction-job.ts
// SPRINT 14: Script para executar job de fricção manualmente

import 'dotenv/config';
import { runPilotFrictionJob } from '../core/pilot/pilot-friction.job';

async function main() {
  console.log('[PilotFriction] Iniciando job de fricção...');
  
  try {
    await runPilotFrictionJob();
    console.log('[PilotFriction] Job concluído com sucesso');
    process.exit(0);
  } catch (error) {
    console.error('[PilotFriction] Erro ao executar job:', error);
    process.exit(1);
  }
}

main();







