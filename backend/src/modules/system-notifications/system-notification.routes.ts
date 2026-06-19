// backend/src/modules/system-notifications/system-notification.routes.ts
// 🔴 R8C SYSTEM-NOTIFICATION SCHEMA-GHOST CONTAINMENT (DECISION-0113 / DECISION-0131 §B7 / Z2 · 2026-06-18):
// A tabela `system_notifications` é SCHEMA-GHOST — existia como `migrations/257_create_system_notifications.sql`,
// foi MOVIDA para `migrations_archive/0921_system_notifications.sql` e NÃO está no schema canônico (set de 394
// migrations) nem em unificard_dev (to_regclass('public.system_notifications') = null). Toda rota deste módulo
// era (a) DEAD-AT-DB — o repository faz INSERT/UPDATE/SELECT numa tabela inexistente → 42P01/500; e (b)
// UNGATED-AUTHORITY — os writers de read-state confiavam em recipientActorId client-declared (W2 body/
// actionContext) ou em NENHUM dono (W1 só por notification_id) como autoridade (canal-1/0113). Como o substrato
// não existe, a correção honesta é CONTER fail-closed (501 nomeado) ANTES de qualquer service/DB — NÃO religar,
// NÃO criar migration, NÃO redesenhar. Materializar o schema + binding canônico (canRepresentActor) é frente
// própria (DECISION-0071-style), fora do escopo R8C. As rotas permanecem registradas (não removidas).

import { FastifyPluginAsync } from 'fastify';

const CONTAINED = {
  error: 'System notifications are temporarily unavailable (schema not materialized).',
  code: 'SYSTEM_NOTIFICATION_SCHEMA_GHOST_CONTAINED',
} as const;

const systemNotificationRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /system-notifications — listar (dead-at-db → contido).
  fastify.get('/system-notifications', async (_req, reply) => reply.status(501).send(CONTAINED));

  // GET /system-notifications/unread-count — contar não lidas (dead-at-db → contido).
  fastify.get('/system-notifications/unread-count', async (_req, reply) => reply.status(501).send(CONTAINED));

  // GET /system-notifications/:notificationId — buscar por id (dead-at-db → contido).
  fastify.get<{ Params: { notificationId: string } }>(
    '/system-notifications/:notificationId',
    async (_req, reply) => reply.status(501).send(CONTAINED)
  );

  // POST /system-notifications/:notificationId/read — W1 markAsRead (dead-at-db + ungated → contido).
  fastify.post<{ Params: { notificationId: string } }>(
    '/system-notifications/:notificationId/read',
    async (_req, reply) => reply.status(501).send(CONTAINED)
  );

  // POST /system-notifications/mark-all-read — W2 markAllAsRead (dead-at-db + ungated → contido).
  // (body ignorado: a contenção não lê recipient client-declared.)
  fastify.post('/system-notifications/mark-all-read', async (_req, reply) => reply.status(501).send(CONTAINED));
};

export default systemNotificationRoutes;
