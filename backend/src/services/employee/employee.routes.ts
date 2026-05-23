// backend/src/services/employee/employee.routes.ts
// LEGACY — BLOQUEADO em 2026-04-28 (C63 FASE 2A)
// DECISION-0014: rota removida do fluxo ativo.
// Código morto confirmado (zero callers, zero registro em app.builder).

import type { FastifyPluginAsync } from 'fastify';

const employeeRoutes: FastifyPluginAsync = async (_fastify) => {
  throw new Error(
    '[C63] employeeRoutes está BLOQUEADO. ' +
    'Use unified-availability.service.ts. DECISION-0014.'
  );
};

export default employeeRoutes;
