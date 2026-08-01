// src/modules/work/work.module.ts
import { FastifyPluginAsync } from 'fastify';

import jobRoutes from './jobs/job.routes';
import workerRoutes from './workers/worker.routes';
import skillsRoutes from './skills/skill.routes';
import applicationRoutes from './applications/application.routes';
import assignmentRoutes from './assignments/assignment.routes';
import workInsightsRoutes from './work-insights.routes';
import instantRoutes from '../work-instant/instant.routes';
import workerStatusRoutes from '../work-instant/worker-status.routes';
import statusRoutes from '../work-instant/status.routes';
import dispatcherPlugin from '../work-instant/dispatcher/dispatcher.plugin';
import { containModule } from '@core/product-scope/out-of-scope-containment';

// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CONTIDO — fora do mínimo de produto (F-OUT-OF-SCOPE-CONTAINMENT, 2026-08-01)
// ║ NORMA:   decisão de produto de Clayton, 2026-08-01 (cartório REMEDIATION_DT_LOG.md, topo)
// ║ NÃO:     religar work/work-instant materializando as tabelas na mão. TODAS medidas ausentes
// ║          em unificard_dev (jobs, workers, worker_skills, skills, user_skills_categories,
// ║          job_applications, job_assignments, reputation_scores) — o módulo não é dívida
// ║          técnica quebrada, é ESCOPO NÃO INICIADO. NÃO apagar módulo/arquivo/rota.
// ║ EM VEZ:  UMA linha (o addHook abaixo) contém os 10 sub-registros de uma vez, na borda, ANTES
// ║          de qualquer handler/service/SQL. Religar = apagar essa linha + materializar o
// ║          substrato do archive com GATE. Reversível em horas; nenhum handler foi tocado.
// ╚════════════════════════════════════════════════════════════════
const workModule: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', containModule({
    module: 'work',
    reason: 'out_of_product_minimum',
    missingSubstrate: [
      'jobs', 'workers', 'worker_skills', 'skills', 'user_skills_categories',
      'job_applications', 'job_assignments', 'reputation_scores',
    ],
  }));

  await fastify.register(jobRoutes, { prefix: '/jobs' });
  await fastify.register(workerRoutes, { prefix: '/workers' });
  await fastify.register(skillsRoutes, { prefix: '/skills' });
  await fastify.register(applicationRoutes, { prefix: '/applications' });
  await fastify.register(assignmentRoutes, { prefix: '/assignments' });
  await fastify.register(workInsightsRoutes, { prefix: '/insights' });
  await fastify.register(instantRoutes, { prefix: '/instant' });
  await fastify.register(workerStatusRoutes, { prefix: '/instant' });
  await fastify.register(statusRoutes, { prefix: '/instant' });
  await fastify.register(dispatcherPlugin);
};

export default workModule;
export { workModule };
