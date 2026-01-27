# SPRINT 92 — MENU + COMANDA (TAB) + QR ORDERING (BAR/RESTAURANTE)

## OBJETIVO

Permitir que um usuário, dentro da página pública do estabelecimento (public profile), veja o cardápio, adicione itens e crie um pedido vinculado a uma comanda/mesa. O fechamento pode ser:
- **A) PAGA AGORA** (PIX/UNIFYCARD) ou
- **B) CONTA ABERTA** (paga depois no caixa/PDV), com QR para validação/consulta rápida.

---

## 1. MIGRATIONS

### `233_create_menus.sql`
Tabelas para menus de estabelecimento:
- `menus`: id, tenant_id, actor_id, name, is_active, metadata, created_at
- `menu_items`: id, menu_id, product_variant_id, display_name, description, is_available, sort_order, metadata, created_at
- Índices: (tenant_id, actor_id), (tenant_id, is_active), (menu_id, sort_order)
- RLS habilitado

### `234_create_tabs.sql`
Tabela para comandas:
- `tabs`: id, tenant_id, actor_id, opened_by_contact_id, opened_by_user_id, status (OPEN|CLOSED|CANCELLED), table_label, qr_token (UNIQUE), opened_at, closed_at, metadata, created_at, updated_at
- Índices: (tenant_id, actor_id, status), (tenant_id, qr_token)
- RLS habilitado

### `235_create_tab_orders.sql`
Tabela de ligação entre comandas e pedidos:
- `tab_orders`: id, tenant_id, tab_id, order_id, created_at
- Constraint UNIQUE (tenant_id, tab_id, order_id)
- RLS habilitado

---

## 2. BACKEND MODULE

### 2.1 Types
- `venue-menu.types.ts`: Menu, MenuItem, CreateMenuInput, AddMenuItemInput, MenuWithItems
- `tab.types.ts`: Tab, TabStatus, OpenTabInput, TabFilters, TabWithOrders

### 2.2 Repositories
- `venue-menu.repository.ts`: CRUD de menus e itens
- `tab.repository.ts`: CRUD de tabs, geração de QR token único

### 2.3 Services

#### `VenueMenuService`
- `createMenu()`: Cria menu
- `addMenuItem()`: Adiciona item ao menu
- `setItemAvailability()`: Altera disponibilidade
- `listActiveMenu()`: Lista menu ativo com itens

#### `TabService`
- `openTab()`: Abre comanda e gera QR token
- `getTabByToken()`: Busca comanda por QR token (read-only)
- `getTabWithOrders()`: Busca comanda com orders vinculados
- `attachOrderToTab()`: Vincula order à comanda
- `closeTab()`: Fecha comanda (registra resumo)
- `listTabs()`: Lista comandas com filtros
- `createOrderForTab()`: Cria Order DRAFT vinculado à comanda

---

## 3. ROTAS REST

### 3.1 Admin/Auth (`/venue/*`)

#### Menu
- **POST** `/venue/menus` — Cria menu
- **POST** `/venue/menus/:id/items` — Adiciona item ao menu
- **PATCH** `/venue/menus/items/:itemId/availability` — Altera disponibilidade
- **GET** `/venue/menus/active?actorId=...` — Lista menu ativo

#### Tabs
- **POST** `/venue/tabs/open` — Abre comanda
- **GET** `/venue/tabs?actorId=...&status=OPEN` — Lista comandas
- **POST** `/venue/tabs/:id/close` — Fecha comanda
- **POST** `/venue/tabs/:id/orders` — Cria order e vincula à comanda

### 3.2 Públicas (sem auth)

#### Menu
- **GET** `/v/:slug/menu` — Retorna menu ativo (read-only)
  - Resolve `actorId` pelo public profile slug

#### Tabs
- **POST** `/v/:slug/tabs/open` — Abre comanda (rate limit)
  - Cria/usar Contact se fornecido (idempotente)
  - Retorna `qrToken`
- **GET** `/t/:qrToken` — Status da comanda (read-only, rate limit)
- **POST** `/t/:qrToken/orders` — Cria order vinculado (rate limit)
- **POST** `/t/:qrToken/orders/:orderId/items` — Adiciona item (rate limit)
- **POST** `/t/:qrToken/orders/:orderId/submit` — Submete order (rate limit)
- **POST** `/t/:qrToken/orders/:orderId/pay` — Pagar agora (rate limit)
  - Suporta PIX/UNIFYCARD
  - Retorna QR code PIX se método PIX

---

## 4. INTEGRAÇÃO COM ORDERS

### 4.1 Criação de Order
- `createOrderForTab()` cria Order DRAFT com metadata:
  ```json
  {
    "tab_id": "...",
    "source": "VENUE",
    "channel": "ON_PREMISE",
    "qr_token": "...",
    "contact_id": "..."
  }
  ```

### 4.2 Adição de Itens
- Usa `OrderService.addItem()` que já reserva estoque automaticamente
- Source: `'PDV'` (para venue orders)

### 4.3 Submissão
- Usa `OrderService.submitOrder()` normalmente

### 4.4 Pagamento
- **Pagar Agora**: Cria PaymentIntent → autoriza → executa via PaymentExecutionService
- **Conta Aberta**: Mantém order SUBMITTED, pagamento feito depois no PDV/caixa

---

## 5. FRONTEND

### 5.1 Páginas

#### `VenuePublicPage.tsx` (`/v/:slug`)
- Abas: "Cardápio", "Eventos", "Sobre"
- Cardápio: Lista itens do menu, preço, disponibilidade
- Botão "Abrir Comanda" → abre tab e recebe `qrToken`
- Após abrir: mostra "Acompanhar Comanda" e navega para `/t/:qrToken`

#### `TabPage.tsx` (`/t/:qrToken`)
- Mostra mesa/identificação, pedidos em andamento
- Permite adicionar itens e submeter
- **Pagar Agora**: PIX mostra QR e polling, UNIFYCARD fluxo normal
- **Conta Aberta**: Mostra "Pagamento no caixa/PDV"

### 5.2 API Client

#### `api/venue.ts`
Funções para comunicação com backend:
- `getPublicMenu()`
- `openPublicTab()`
- `getTabByToken()`
- `createTabOrder()`
- `addItemToTabOrder()`
- `submitTabOrder()`
- `payTabOrder()`

---

## 6. FLUXOS

### 6.1 Fluxo: Conta Aberta
1. Usuário acessa `/v/:slug`
2. Vê cardápio e abre comanda → recebe `qrToken`
3. Acessa `/t/:qrToken`
4. Adiciona itens (reserva estoque)
5. Submete order
6. Escolhe "Conta Aberta"
7. PDV/caixa encontra order normal e recebe depois

### 6.2 Fluxo: Pagar Agora (PIX)
1. Usuário acessa `/v/:slug` e abre comanda
2. Adiciona itens e submete
3. Escolhe "Pagar Agora" → método PIX
4. Sistema cria PaymentIntent e executa
5. Retorna QR code PIX
6. Usuário escaneia e paga
7. Webhook PIX marca como SUCCESS
8. Order fica pago

### 6.3 Fluxo: Pagar Agora (UNIFYCARD)
1. Similar ao PIX, mas sem QR code
2. Fluxo normal de PaymentExecution
3. Se SUCCESS imediato, order fica pago

---

## 7. GUARDRAILS

✅ **Social/public profile NÃO executa economia**
- Menu apenas exibe produtos
- Tab apenas organiza pedidos

✅ **Pedido sempre é Order do marketplace**
- Não criar sistema paralelo
- Reutiliza OrderService, PaymentExecutionService

✅ **Estoque usa reserva**
- `OrderService.addItem()` já reserva estoque
- Evita dupla venda

✅ **"Conta aberta" NÃO cria pagamento automaticamente**
- Order fica SUBMITTED
- Pagamento feito depois no PDV

✅ **QR é apenas token/ponte**
- Não é dinheiro
- Apenas busca status/itens (read-only)

✅ **Tudo auditável**
- Todas as ações registram eventos
- Metadata preservado

---

## 8. SEGURANÇA

### 8.1 QR Token
- Gerado com `randomBytes(32).toString('hex')` (64 caracteres)
- Não adivinhável
- Único por tenant

### 8.2 Rate Limit
- Rotas públicas têm rate limit (mesmo padrão de Payment Links)
- Previne abuso

### 8.3 Validação
- Tab deve estar OPEN para criar/adicionar itens
- Order deve pertencer à tab (validação em todas as rotas)
- Contact criado de forma idempotente (via taxId/phone/email)

---

## 9. COMO O PDV FECHA A CONTA

1. PDV busca orders com `metadata.source = 'VENUE'` e `metadata.tab_id`
2. Ou busca orders por `metadata.qr_token`
3. Recebe normalmente via PaymentExecutionService
4. Após pagamento, order fica pago
5. Tab pode ser fechada manualmente (registra resumo)

---

## 10. INVARIANTES

- Tab OPEN pode ter múltiplos orders
- Order DRAFT pode ter itens adicionados
- Order SUBMITTED não pode ter itens adicionados
- Tab CLOSED não pode ter novos orders
- QR token é único e não expira (mas tab pode ser fechada)

---

## 11. ARQUIVOS CRIADOS/MODIFICADOS

### Backend
- `backend/migrations/233_create_menus.sql`
- `backend/migrations/234_create_tabs.sql`
- `backend/migrations/235_create_tab_orders.sql`
- `backend/src/modules/venue/venue-menu.types.ts`
- `backend/src/modules/venue/venue-menu.repository.ts`
- `backend/src/modules/venue/venue-menu.service.ts`
- `backend/src/modules/venue/tab.types.ts`
- `backend/src/modules/venue/tab.repository.ts`
- `backend/src/modules/venue/tab.service.ts`
- `backend/src/modules/venue/venue.routes.ts`
- `backend/src/modules/marketplace/marketplace.routes.ts` (registro das rotas admin)
- `backend/src/server.ts` (registro das rotas públicas)

### Frontend
- `frontend/src/api/venue.ts`
- `frontend/src/pages/VenuePublicPage.tsx`
- `frontend/src/pages/VenuePublicPage.css`
- `frontend/src/pages/TabPage.tsx`
- `frontend/src/pages/TabPage.css`
- `frontend/src/App.tsx` (rotas)

### Documentação
- `SPRINT_92_MENU_COMANDA_QR.md` (este arquivo)

---

## 12. CRITÉRIOS DE PRONTO

- ✅ Estabelecimento publica menu e itens
- ✅ Usuário abre comanda via página pública e recebe `qrToken`
- ✅ Usuário cria order vinculado e adiciona itens (reserva estoque)
- ✅ Usuário pode pagar agora (PIX/UNIFYCARD) ou deixar conta aberta
- ✅ PDV consegue encontrar o pedido normal e receber no caixa depois
- ✅ Nada fora do core: tudo via Order/Payment existentes
- ✅ Frontend mínimo funcional
- ✅ Documentação completa

---

**Status:** ✅ CONCLUÍDO



