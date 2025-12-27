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

const workModule: FastifyPluginAsync = async (fastify) => {
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
