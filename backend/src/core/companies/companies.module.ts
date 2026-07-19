// src/core/companies/companies.module.ts
// Módulo de empresas (PJ)

import { FastifyPluginAsync } from 'fastify';
import { companiesRoutes } from './companies.routes';
import companyMembersRoutes from './company-members.routes';
import companyAccessInvitationsRoutes from './company-access-invitations.routes';

export const companiesModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(companiesRoutes);
  // 🔴 BLINDAGEM: Rotas de membros (base estrutural, NÃO CRM/ERP completo)
  // Prefixo removido pois o módulo já é registrado com /companies no server.ts
  await fastify.register(companyMembersRoutes);
  // DECISION-0189 (F5): convite/aceite canônico — o ÚNICO caminho (além do bootstrap)
  // que cria membership 'active' (R17). Aceite/recusa do CONVIDADO vive fora deste
  // prefixo (invitationAcceptanceRoutes, app.builder).
  await fastify.register(companyAccessInvitationsRoutes);
};










