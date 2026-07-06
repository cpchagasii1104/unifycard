// backend/src/modules/venue/venue.routes.ts
// SPRINT 92: MENU + COMANDA (TAB) + QR ORDERING
//
// 🔴 F-VENUE-SCHEMA-GHOST-FAIL-CLOSED-CONTAINMENT (DT-MODULE-VENUE-FROZEN-PRE-RESTAURANT-VERTICAL;
// Lote L5 item 3, 2026-07-06). O módulo `venue` está MONTADO — `venuePublicRoutes` é registrado SEM auth
// (app.builder.ts:214-215, rota PÚBLICA) — e os services batem em `tabs`/`menus`/`menu_items` — tabelas que
// **não são criadas por NENHUMA migration canônica** (`to_regclass=NULL` para as três, verificado no
// unificard_dev). → schema ghost: qualquer acesso emitiria `42P01 relation does not exist` (500 cru). A
// vertical restaurant (tabs/menus/QR) segue congelada, sem decisão de produto. Por ser rota PÚBLICA, é a
// mais urgente do lote — alcançável por qualquer um sem login.
//
// Decisão (2026-07-06, GO de Clayton "siga o fluxo de correções respeitando leis e normas"): substituir o
// 500 cru por contenção fail-closed HONESTA (blanket): 501 nomeado, ZERO chamada a service/repository, ZERO
// acesso ao DB, em TODAS as rotas (admin + public). A rota financeira `/t/:qrToken/orders/:orderId/pay` fica
// contida ANTES do firewall financeiro (`venue-financial-firewall`) — estritamente mais seguro (o caminho de
// dinheiro nem é alcançado). Contenção ≠ remoção: services/repos/types/firewall preservados para quando a
// vertical restaurant abrir (frente própria: pdv+venue juntos). Mesmo padrão de organization/automation.
import type { FastifyInstance } from 'fastify';

const VENUE_SCHEMA_GHOST_CONTAINED = {
  ok: false,
  code: 'VENUE_SCHEMA_GHOST_CONTAINED',
  message:
    'Venue module (menu / tab / QR ordering) is not available because its canonical schema ' +
    '(tabs / menus / menu_items) has not been materialized. ' +
    '(DT-MODULE-VENUE-FROZEN-PRE-RESTAURANT-VERTICAL)',
};

// Handler de contenção único — curto-circuito fail-closed (501) ANTES de qualquer service/repository/DB.
const contained = async (_req: any, reply: any) =>
  reply.status(501).send(VENUE_SCHEMA_GHOST_CONTAINED);

/**
 * Rotas ADMIN/AUTH para Venue — contidas (schema ghost).
 */
const venueAdminRoutes = async (fastify: FastifyInstance) => {
  // ── MENU (create/add-item/availability/list-active) ──
  fastify.post('/menus', contained);
  fastify.post('/menus/:id/items', contained);
  fastify.patch('/menus/items/:itemId/availability', contained);
  fastify.get('/menus/active', contained);

  // ── TAB / COMANDA (open/list/close/orders) ──
  fastify.post('/tabs/open', contained);
  fastify.get('/tabs', contained);
  fastify.post('/tabs/:id/close', contained);
  fastify.post('/tabs/:id/orders', contained);
};

/**
 * Rotas PÚBLICAS (QR ordering, sem auth) para Venue — contidas (schema ghost).
 */
const venuePublicRoutes = async (fastify: FastifyInstance) => {
  // ── VITRINE PÚBLICA POR SLUG (menu público / abrir comanda) ──
  fastify.get('/v/:slug/menu', contained);
  fastify.post('/v/:slug/tabs/open', contained);

  // ── QR ORDERING POR TOKEN (ler mesa / pedidos / itens / submit / pay) ──
  fastify.get('/t/:qrToken', contained);
  fastify.post('/t/:qrToken/orders', contained);
  fastify.post('/t/:qrToken/orders/:orderId/items', contained);
  fastify.post('/t/:qrToken/orders/:orderId/submit', contained);
  // /pay: contido ANTES do firewall financeiro — o caminho de dinheiro nem é alcançado.
  fastify.post('/t/:qrToken/orders/:orderId/pay', contained);
};

export { venueAdminRoutes, venuePublicRoutes };
