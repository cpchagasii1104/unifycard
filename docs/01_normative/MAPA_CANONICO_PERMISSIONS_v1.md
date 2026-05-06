Status: SUBORDINATED
Domain: UNKNOWN
Governing Contract: CORE_IMUTAVEL.md
# MAPA CANÔNICO DE PERMISSÕES v1
## UnifyCard - Authorization System

**Data:** 12 de Janeiro de 2026  
**Status:** CONGELADO (v1.0)  
**Tipo:** DOCUMENTO CONSTITUCIONAL  

**Propósito:**
- Fonte única de verdade para permissões
- Previne permission creep
- Mapeia domínios → permissions → capabilities
- Usado por código e política

---

## 🔒 REGRAS IMUTÁVEIS

### 1. Este documento é CONSTITUCIONAL
```
✅ Pode ser evoluído (v2, v3...)
❌ Não pode ser ignorado
❌ Não pode criar permissions ad-hoc
❌ Não pode duplicar semânticas
```

### 2. Hierarquia de autoridade
```
1. Este mapa (v1) define o que existe
2. Código usa enums derivados deste mapa
3. Política decide quem tem o quê
4. UI reflete política (não inventa)
```

### 3. Adição de nova permission
```
Processo:
1. Propor no PR (justificar)
2. Adicionar neste mapa
3. Bump version (v1.1, v2.0...)
4. Atualizar enum no código
5. Documentar capability necessária

❌ NUNCA adicionar direto no código
```

---

## 📋 MAPA DE DOMÍNIOS

### Domínios Ativos (v1)

```
1. feed          → Rede social (posts, comentários)
2. bank          → Sistema financeiro (ledger, transações)
3. events        → Eventos (criar, publicar, fechar)
4. groups        → Grupos (criar, gerenciar, fechar)
5. services      → Serviços (oferecer, agendar)
6. rides         → Corridas (solicitar, aceitar, pagar)
7. companies     → Empresas (membros, delegações)
8. votes         → Votações (criar, votar)
9. institutional → Permissões institucionais (sistema, piloto)
10. marketplace   → Marketplace (catálogo, produtos, pedidos, pagamentos)
11. reports       → Relatórios operacionais e gerenciais
```

---

## 🗺️ PERMISSIONS POR DOMÍNIO

### FEED (Social)

#### `publish_feed`
```yaml
domain: feed
description: Publicar posts no feed social
capability_required: can_publish_feed
applies_to:
  - POST /social/posts
  - POST /social/posts/:postId/comments
  - POST /social/posts/:postId/reactions
who_can_have:
  - user actors (PF) → sempre
  - company actors → se registry tem can_publish_feed
  - event actors → se registry tem can_publish_feed
  - group actors → se registry tem can_publish_feed
```

#### `moderate_feed`
```yaml
domain: feed
description: Moderar posts (ocultar, deletar)
capability_required: can_moderate_content
applies_to:
  - DELETE /social/posts/:postId
  - PATCH /social/posts/:postId/moderate
who_can_have:
  - admin users
  - group admins (dentro do grupo)
  - event organizers (posts do evento)
```

---

### BANK (Financial)

#### `manage_financial`
```yaml
domain: bank
description: Executar transações financeiras
capability_required: can_hold_assets
applies_to:
  - POST /bank/transfer
  - POST /bank/withdraw
  - POST /bank/deposit
who_can_have:
  - user actors → sempre (próprio saldo)
  - company actors → se registry tem can_hold_assets
  - group actors → se treasury ativo
```

#### `receive_funds`
```yaml
domain: bank
description: Receber pagamentos/transferências
capability_required: can_receive_funds
applies_to:
  - Implicit (ser destinatário de transação)
who_can_have:
  - user actors → sempre
  - company actors → se registry tem can_receive_funds
  - event actors → se registry tem can_receive_funds
  - group actors → se registry tem can_receive_funds
```

#### `view_financial`
```yaml
domain: bank
description: Ver extratos e saldos
capability_required: (nenhuma - ownership suficiente)
applies_to:
  - GET /bank/balance
  - GET /bank/statement
who_can_have:
  - owner do actor
  - delegated users (se scopes contém view_financial)
```

---

### EVENTS (Events)

#### `create_events`
```yaml
domain: events
description: Criar novos eventos
capability_required: can_publish_feed
applies_to:
  - POST /events
who_can_have:
  - user actors → sempre
  - company actors → se registry tem can_publish_feed
  - group actors → se registry tem can_publish_feed
```

#### `manage_events`
```yaml
domain: events
description: Editar, publicar, fechar eventos
capability_required: (ownership)
applies_to:
  - PATCH /events/:eventId
  - POST /events/:eventId/publish
  - POST /events/:eventId/close
who_can_have:
  - organizer do evento
  - delegated users (se scopes contém manage_events)
```

#### `manage_attendees`
```yaml
domain: events
description: Gerenciar participantes (check-in, etc)
capability_required: (ownership)
applies_to:
  - POST /events/:eventId/checkin
  - GET /events/:eventId/attendees
who_can_have:
  - organizer do evento
  - delegated users (se scopes contém manage_attendees)
```

---

### GROUPS (Groups)

#### `create_groups`
```yaml
domain: groups
description: Criar novos grupos
capability_required: can_publish_feed
applies_to:
  - POST /groups
who_can_have:
  - user actors → sempre
  - company actors → se registry tem can_publish_feed
```

#### `manage_groups`
```yaml
domain: groups
description: Editar, fechar grupos
capability_required: (ownership + admin role)
applies_to:
  - PATCH /groups/:groupId
  - POST /groups/:groupId/close
who_can_have:
  - admin do grupo
  - delegated users (se scopes contém manage_groups)
```

#### `manage_members`
```yaml
domain: groups
description: Adicionar, remover, promover membros
capability_required: can_delegate
applies_to:
  - POST /groups/:groupId/members
  - DELETE /groups/:groupId/members/:memberId
  - PATCH /groups/:groupId/members/:memberId/role
who_can_have:
  - admin do grupo
  - delegated users (se scopes contém manage_members)
```

---

### SERVICES (Services)

#### `offer_services`
```yaml
domain: services
description: Oferecer serviços
capability_required: can_publish_feed + can_receive_funds
applies_to:
  - POST /services
who_can_have:
  - user actors → sempre (PF profissionais)
  - company actors → se registry tem ambos capabilities
```

#### `manage_bookings`
```yaml
domain: services
description: Aceitar, recusar bookings
capability_required: (ownership)
applies_to:
  - POST /services/:serviceId/bookings/:bookingId/accept
  - POST /services/:serviceId/bookings/:bookingId/reject
who_can_have:
  - prestador do serviço
  - delegated users (se scopes contém manage_bookings)
```

---

### RIDES (Rides)

#### `request_ride`
```yaml
domain: rides
description: Solicitar corrida
capability_required: (nenhuma - ação básica)
applies_to:
  - POST /rides
who_can_have:
  - qualquer user actor autenticado
```

#### `accept_ride`
```yaml
domain: rides
description: Aceitar corrida (motorista)
capability_required: can_receive_funds
applies_to:
  - POST /rides/:rideId/accept
who_can_have:
  - user actors → se profile é motorista verificado
  - company actors → se registry tem can_receive_funds (ex: frota)
```

#### `manage_ride`
```yaml
domain: rides
description: Iniciar, completar, cancelar corrida
capability_required: (ownership - driver ou passenger)
applies_to:
  - POST /rides/:rideId/start
  - POST /rides/:rideId/complete
  - POST /rides/:rideId/cancel
who_can_have:
  - driver assigned
  - passenger (apenas cancel)
```

---

### COMPANIES (Companies)

#### `manage_members`
```yaml
domain: companies
description: Adicionar, remover membros da empresa
capability_required: can_delegate
applies_to:
  - POST /companies/:companyId/members
  - DELETE /companies/:companyId/members/:memberId
who_can_have:
  - owner da company
  - delegated users (se scopes contém manage_members)
```

#### `delegate`
```yaml
domain: companies
description: Criar delegações (dar permissões a outros)
capability_required: can_delegate
applies_to:
  - POST /companies/:companyId/delegations
  - DELETE /companies/:companyId/delegations/:delegationId
who_can_have:
  - owner da company
  - delegated users COM is_transitive=true (raro)
```

---

### VOTES (Votes)

#### `create_vote`
```yaml
domain: votes
description: Criar votações
capability_required: (ownership de grupo ou evento)
applies_to:
  - POST /groups/:groupId/votes
  - POST /events/:eventId/votes
who_can_have:
  - admin do grupo
  - organizer do evento
```

#### `cast_vote`
```yaml
domain: votes
description: Votar em votação
capability_required: (membership)
applies_to:
  - POST /votes/:voteId/cast
who_can_have:
  - membros do grupo
  - participantes do evento
```

---

## 🎯 CAPABILITIES MAPEADAS

### Capabilities Institucionais

```yaml
can_publish_feed:
  description: Pode publicar no feed social
  granted_to:
    - user actors (sempre)
    - company actors (via registry)
    - event actors (via registry)
    - group actors (via registry)
  enables:
    - publish_feed
    - create_events
    - create_groups
    - offer_services

can_receive_funds:
  description: Pode receber dinheiro
  granted_to:
    - user actors (sempre)
    - company actors (via registry)
    - event actors (via registry)
    - group actors (via registry)
  enables:
    - receive_funds
    - accept_ride (para motoristas)
    - offer_services (receber pagamento)

can_hold_assets:
  description: Pode manter saldo no Bank
  granted_to:
    - user actors (sempre)
    - company actors (via registry)
    - group actors (via treasury)
  enables:
    - manage_financial
    - executar transações

can_delegate:
  description: Pode delegar permissões a outros
  granted_to:
    - company owners
    - group admins
    - event organizers
  enables:
    - manage_members
    - delegate
    - criar delegações

can_moderate_content:
  description: Pode moderar conteúdo
  granted_to:
    - admin users
    - group admins (escopo: dentro do grupo)
    - event organizers (escopo: posts do evento)
  enables:
    - moderate_feed
```

---

## 🔐 MATRIZ DE DECISÃO

### Como determinar se user pode fazer ação?

```
1. Ação requer permission? (consultar mapa acima)
   SIM → continuar
   NÃO → permitir (ação pública)

2. Permission requer capability?
   SIM → verificar se actor tem capability (via registry)
   NÃO → continuar (ownership suficiente)

3. User tem ownership do actor?
   SIM → PERMITIR
   NÃO → verificar delegação

4. User tem delegação ativa?
   SIM → verificar se scopes contém permission
     SIM → PERMITIR
     NÃO → NEGAR
   NÃO → NEGAR
```

---

## 📊 EXEMPLOS DE DECISÃO

### Exemplo 1: User publica post

```yaml
Ação: POST /social/posts
Permission requerida: publish_feed
Capability requerida: can_publish_feed

Decisão:
1. User actor sempre tem can_publish_feed? SIM
2. User tem ownership do próprio actor? SIM
→ PERMITIR
```

### Exemplo 2: Funcionário publica em nome da empresa

```yaml
Ação: POST /social/posts
Body: { actingActorId: 'company-123' }
Permission requerida: publish_feed
Capability requerida: can_publish_feed

Decisão:
1. Company actor tem can_publish_feed? (verificar registry)
   → SIM (está no registry)
2. User tem ownership do company actor? NÃO
3. User tem delegação ativa para company-123? SIM
4. Delegação inclui 'publish_feed' nos scopes? SIM
→ PERMITIR
```

### Exemplo 3: User tenta transferir dinheiro da empresa

```yaml
Ação: POST /bank/transfer
Body: { actingActorId: 'company-123', amount: 10000 }
Permission requerida: manage_financial
Capability requerida: can_hold_assets

Decisão:
1. Company actor tem can_hold_assets? (verificar registry)
   → SIM
2. User tem ownership do company actor? NÃO
3. User tem delegação ativa para company-123? SIM
4. Delegação inclui 'manage_financial' nos scopes? NÃO
→ NEGAR (delegação não permite operações financeiras)
```

### Exemplo 4: Motorista aceita corrida

```yaml
Ação: POST /rides/:rideId/accept
Permission requerida: accept_ride
Capability requerida: can_receive_funds

Decisão:
1. User actor tem can_receive_funds? SIM (sempre)
2. User tem ownership do próprio actor? SIM
3. User é motorista verificado? (verificar profile)
   → SIM
→ PERMITIR
```

---

## 🚨 ANTI-PADRÕES (NÃO FAZER)

### ❌ Anti-padrão 1: Permission ad-hoc
```typescript
// ERRADO
if (user.canDoThis) { ... }

// CORRETO
const auth = await authorizationService.canActAs(
  tenantId, userId, actorId, 'manage_financial'
);
```

### ❌ Anti-padrão 2: Lógica espalhada
```typescript
// ERRADO
if (user.role === 'admin' || 
    user.id === company.ownerId || 
    user.permissions.includes('manage')) { ... }

// CORRETO
const auth = await authorizationService.canActAs(
  tenantId, userId, actorId, 'manage_members'
);
```

### ❌ Anti-padrão 3: Permission sem mapa
```typescript
// ERRADO (permission não existe no mapa v1)
requirePermission('super_admin_god_mode')

// CORRETO (usar permissions existentes)
requirePermission('manage_members')
```

### ❌ Anti-padrão 4: Hardcode de roles
```typescript
// ERRADO
if (user.role === 'owner') { ... }

// CORRETO
// Ownership já é verificado por canActAs()
// Não precisa de role hardcoded
```

---

## 🔄 PROCESSO DE EVOLUÇÃO

### Adição de Nova Permission

**Passo a passo:**

1. **Identificar necessidade**
   ```
   Nova feature: Usuário pode arquivar posts
   Domínio: feed
   Permission nova: archive_posts
   ```

2. **Adicionar ao mapa**
   ```yaml
   archive_posts:
     domain: feed
     description: Arquivar posts próprios
     capability_required: (ownership)
     applies_to:
       - POST /social/posts/:postId/archive
     who_can_have:
       - autor do post
   ```

3. **Bump version**
   ```
   v1.0 → v1.1 (minor: adição de permission)
   ```

4. **Atualizar enum**
   ```typescript
   export type PermissionKey = 
     | 'publish_feed'
     | 'manage_financial'
     | 'archive_posts' // NOVO
     // ...
   ```

5. **Documentar changelog**
   ```markdown
   ## v1.1 (2026-01-20)
   - Added: archive_posts permission
   - Applies to: POST /social/posts/:postId/archive
   ```

---

## 📚 CHANGELOG

### v1.3 (2026-01-XX) - Marketplace PDV Permissions

**Permissions adicionadas:**
```
marketplace: marketplace_pdv_sell, marketplace_pdv_manage_customers, marketplace_pdv_view_customers
```

**Justificativa:**
- PDV (Ponto de Venda) requer permissões específicas para operações físicas
- Separação entre venda física (pdv_sell) e gestão de clientes (pdv_manage_customers, pdv_view_customers)
- Escopo: store / company (operações locais da loja)
- Tipo: action (operações que modificam estado)

---

### v1.2 (2026-01-XX) - Reports & Consolidation Permissions

**Permissions adicionadas:**
```
reports: view_consolidated_reports
```

**Justificativa:**
- Multi-empresa requer controle de visibilidade de dados
- Consolidação é leitura (não executa economia)
- Sem permissão, usuário só vê própria unidade
- Com permissão, pode ver dados consolidados (matriz + filiais)

---

### v1.1 (2026-01-XX) - Marketplace Permissions

**Permissions adicionadas:**
```
marketplace: marketplace_manage_catalog, marketplace_manage_products, marketplace_manage_inventory, marketplace_manage_orders, marketplace_execute_payments, marketplace_manage_splits, marketplace_execute_payouts
```

**Justificativa:**
- Marketplace requer controle granular de operações
- Separação entre gestão (catalog/products/inventory/orders) e execução financeira (payments/payouts)
- Permissões financeiras requerem capability can_hold_assets

---

### v1.0 (2026-01-12) - Initial Release

**Permissions criadas:**
```
feed: publish_feed, moderate_feed
bank: manage_financial, receive_funds, view_financial
events: create_events, manage_events, manage_attendees
groups: create_groups, manage_groups, manage_members
services: offer_services, manage_bookings
rides: request_ride, accept_ride, manage_ride
companies: manage_members, delegate
votes: create_vote, cast_vote
institutional: invite_pilot_user
```

**Capabilities definidas:**
```
can_publish_feed
can_receive_funds
can_hold_assets
can_delegate
can_moderate_content
```

**Status:** CONGELADO

---

## 🎯 IMPLEMENTAÇÃO NO CÓDIGO

### 1. Enum de Permissions

**Arquivo:** `src/core/authorization/permission-keys.ts`

```typescript
/**
 * PERMISSION KEYS v1.0
 * Derivado de MAPA_CANONICO_PERMISSIONS_v1.md
 * NÃO modificar sem atualizar o mapa
 */

export type PermissionKey = 
  // FEED
  | 'publish_feed'
  | 'moderate_feed'
  
  // BANK
  | 'manage_financial'
  | 'receive_funds'
  | 'view_financial'
  
  // EVENTS
  | 'create_events'
  | 'manage_events'
  | 'manage_attendees'
  
  // GROUPS
  | 'create_groups'
  | 'manage_groups'
  | 'manage_members'
  
  // SERVICES
  | 'offer_services'
  | 'manage_bookings'
  
  // RIDES
  | 'request_ride'
  | 'accept_ride'
  | 'manage_ride'
  
  // COMPANIES
  | 'delegate'
  
  // VOTES
  | 'create_vote'
  | 'cast_vote';

/**
 * Mapa de capabilities requeridas por permission
 */
export const PERMISSION_CAPABILITIES: Record<PermissionKey, string | null> = {
  // FEED
  publish_feed: 'can_publish_feed',
  moderate_feed: 'can_moderate_content',
  
  // BANK
  manage_financial: 'can_hold_assets',
  receive_funds: 'can_receive_funds',
  view_financial: null, // ownership suficiente
  
  // EVENTS
  create_events: 'can_publish_feed',
  manage_events: null, // ownership suficiente
  manage_attendees: null, // ownership suficiente
  
  // GROUPS
  create_groups: 'can_publish_feed',
  manage_groups: null, // ownership + admin role
  manage_members: 'can_delegate',
  
  // SERVICES
  offer_services: 'can_publish_feed', // simplificado
  manage_bookings: null, // ownership suficiente
  
  // RIDES
  request_ride: null, // ação básica
  accept_ride: 'can_receive_funds',
  manage_ride: null, // ownership suficiente
  
  // COMPANIES
  delegate: 'can_delegate',
  
  // VOTES
  create_vote: null, // ownership de grupo/evento
  cast_vote: null, // membership suficiente
};
```

---

### 2. Aplicação nas Rotas

**Arquivo:** `src/modules/social/social.routes.ts`

```typescript
import { requirePermission } from '@core/authorization/require-permission.guard';

const socialRoutes: FastifyPluginAsync = async (fastify) => {
  // Publicar post
  fastify.post('/posts', {
    preHandler: [requirePermission('publish_feed')],
  }, async (req, reply) => {
    // Handler
  });

  // Moderar post
  fastify.delete('/posts/:postId', {
    preHandler: [requirePermission('moderate_feed')],
  }, async (req, reply) => {
    // Handler
  });
};
```

**Arquivo:** `src/core/unifybank/transparency.routes.ts`

```typescript
import { requirePermission } from '@core/authorization/require-permission.guard';

const bankRoutes: FastifyPluginAsync = async (fastify) => {
  // Transferir dinheiro
  fastify.post('/transfer', {
    preHandler: [requirePermission('manage_financial')],
  }, async (req, reply) => {
    // Handler
  });

  // Ver saldo (não precisa de permission específica)
  fastify.get('/balance', async (req, reply) => {
    // Handler - ownership verificado por middleware
  });
};
```

---

### MARKETPLACE (Marketplace)

### canonical_products:create
- **Capability requerida:** `null` (marketplace_manage_catalog já cobre via onboarding)
- **Descrição:** Permite criar ou reutilizar canonical_products INDUSTRIAL via API direta.
- **Quem pode ter:** tenant com MARKETPLACE_STORE_CREATE ou papel industrial explícito.
- **Status:** declarada para uso futuro; rota direta ainda não exposta publicamente.
- **Nota §5.1:** distinção explícita indústria vs distribuidor autorizado permanece decisão de produto; até lá o gate de entrada para canónicos no marketplace é `MARKETPLACE_STORE_CREATE` no onboarding — ver `docs/01_normative/ADR_CANONICAL_CREATE_AUTHORITY.md`.

#### `marketplace_manage_catalog`
```yaml
domain: marketplace
description: Gerenciar catálogo (categorias, atributos)
capability_required: null
applies_to:
  - POST /marketplace/categories
  - POST /marketplace/attributes
who_can_have:
  - user actors (PF) → ownership suficiente
  - company actors → ownership suficiente
```

#### `marketplace_manage_products`
```yaml
domain: marketplace
description: Gerenciar produtos e variantes
capability_required: null
applies_to:
  - POST /marketplace/products
  - POST /marketplace/products/:productId/variants
who_can_have:
  - user actors (PF) → ownership suficiente
  - company actors → ownership suficiente
```

#### `marketplace_manage_inventory`
```yaml
domain: marketplace
description: Gerenciar estoque (movimentações, lotes)
capability_required: null
applies_to:
  - POST /marketplace/inventory/movements
  - POST /marketplace/inventory/lots
who_can_have:
  - user actors (PF) → ownership suficiente
  - company actors → ownership suficiente
```

#### `marketplace_manage_orders`
```yaml
domain: marketplace
description: Gerenciar pedidos (criar, modificar, cancelar)
capability_required: null
applies_to:
  - POST /marketplace/orders
  - POST /marketplace/orders/:orderId/items
  - DELETE /marketplace/orders/:orderId/items/:itemId
  - POST /marketplace/orders/:orderId/submit
  - POST /marketplace/orders/:orderId/cancel
who_can_have:
  - user actors (PF) → ownership suficiente
  - company actors → ownership suficiente
```

#### `marketplace_execute_payments`
```yaml
domain: marketplace
description: Executar pagamentos (criar intent, autorizar, executar)
capability_required: can_hold_assets
applies_to:
  - POST /marketplace/payment-intents
  - POST /marketplace/payment-intents/:intentId/authorize
  - POST /marketplace/payments/execute
who_can_have:
  - user actors (PF) → se tem can_hold_assets
  - company actors → se tem can_hold_assets
```

#### `marketplace_manage_splits`
```yaml
domain: marketplace
description: Gerenciar splits de pagamento (definir divisão)
capability_required: null
applies_to:
  - POST /marketplace/payment-splits/define
who_can_have:
  - user actors (PF) → ownership suficiente
  - company actors → ownership suficiente
```

#### `marketplace_execute_payouts`
```yaml
domain: marketplace
description: Executar payouts (repasses financeiros)
capability_required: can_hold_assets
applies_to:
  - POST /marketplace/payouts/execute
who_can_have:
  - user actors (PF) → se tem can_hold_assets
  - company actors → se tem can_hold_assets
```

#### `marketplace_pdv_sell`
```yaml
domain: marketplace
description: Realizar vendas físicas via PDV (Ponto de Venda)
capability_required: null
applies_to:
  - POST /marketplace/pdv/order
who_can_have:
  - user actors (PF) → ownership suficiente
  - company actors → ownership suficiente
scope: store / company
type: action
note: |
  Permissão para operações de venda física (PDV).
  Não requer capability financeira pois o pagamento é processado separadamente.
```

#### `marketplace_pdv_manage_customers`
```yaml
domain: marketplace
description: Gerenciar clientes da loja (criar, atualizar)
capability_required: null
applies_to:
  - POST /marketplace/pdv/customer
who_can_have:
  - user actors (PF) → ownership suficiente
  - company actors → ownership suficiente
scope: store / company
type: action
note: |
  Permissão para criar e gerenciar clientes específicos da loja.
  Clientes podem ser anônimos ou vinculados a usuários do sistema.
```

#### `marketplace_pdv_view_customers`
```yaml
domain: marketplace
description: Visualizar informações de clientes da loja
capability_required: null
applies_to:
  - GET /marketplace/pdv/customer/:customerId
who_can_have:
  - user actors (PF) → ownership suficiente
  - company actors → ownership suficiente
scope: store / company
type: action
note: |
  Permissão para consultar dados de clientes cadastrados na loja.
  Leitura apenas, não permite modificação.
```

---

### REPORTS (Reports)

#### `view_consolidated_reports`
```yaml
domain: reports
description: Ver relatórios consolidados (matriz + filiais)
capability_required: null
applies_to:
  - GET /reports/sales?consolidated=true
  - GET /reports/inventory?consolidated=true
  - GET /reports/financial?consolidated=true
  - GET /dashboard/overview?consolidated=true
who_can_have:
  - usuários com permissão explícita (atribuição manual)
  - usuários da matriz (se configurado)
note: |
  Sem esta permissão, usuário só vê dados da própria unidade organizacional.
  Com esta permissão, pode ver dados consolidados (matriz + filiais).
```

---

### INSTITUTIONAL (Institucional)

#### `invite_pilot_user`
```yaml
domain: institutional
description: Convidar usuários para o piloto fechado
capability_required: null
applies_to:
  - POST /admin/pilot/invites
who_can_have:
  - admin users (atribuição manual)
  - system operators
note: |
  Permissão especial para controle de acesso ao piloto.
  NÃO atribuída automaticamente.
  Apenas admins do sistema devem recebê-la manualmente.
```

---

## 🔍 SANITY CHECKS

### Checklist de Validação

```
[ ] Toda permission está no mapa v1
[ ] Toda permission tem domínio definido
[ ] Toda permission tem capability mapeada (ou null)
[ ] Toda rota mutável tem permission associada
[ ] Nenhuma permission duplicada
[ ] Enum no código sincronizado com mapa
[ ] PERMISSION_CAPABILITIES sincronizado com mapa
```

### Testes de Regressão

```typescript
describe('Permission System Integrity', () => {
  it('should have all permissions mapped', () => {
    const mapPermissions = ['publish_feed', 'manage_financial', ...];
    const codePermissions = Object.keys(PERMISSION_CAPABILITIES);
    
    expect(codePermissions).toEqual(mapPermissions);
  });

  it('should not allow undefined permissions', () => {
    expect(() => {
      requirePermission('undefined_permission' as any);
    }).toThrow();
  });
});
```

---

## 📊 ESTATÍSTICAS v1

```
Total de permissions: 32 (v1.3)
Total de capabilities: 5
Total de domínios: 11

Distribuição:
- feed: 2 permissions
- bank: 3 permissions
- events: 3 permissions
- groups: 3 permissions
- services: 2 permissions
- rides: 3 permissions
- companies: 2 permissions
- votes: 2 permissions
- institutional: 1 permission
- marketplace: 10 permissions (7 gestão + 3 PDV)
- reports: 1 permission
```

---

## 🎯 STATUS FINAL

**Status:** ✅ v1.3 (Marketplace PDV adicionado)  
**Data:** 12 de Janeiro de 2026 (v1.0), XX de Janeiro de 2026 (v1.1), XX de Janeiro de 2026 (v1.3)  
**Próxima revisão:** Após piloto REAL  
**Evolução:** v1.4+ apenas com justificativa  

**Uso:**
- ✅ Código deriva deste mapa
- ✅ Política usa este mapa
- ✅ Documentação referencia este mapa
- ❌ Nenhuma permission fora deste mapa

---

**Este documento é a fonte única de verdade para permissions no UnifyCard. Toda adição, remoção ou modificação de permission DEVE atualizar este documento primeiro.** 🔒

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- CORE_IMUTAVEL.md

### Referenciado por
- 00_INDEX.md
- ADR_CANONICAL_CREATE_AUTHORITY.md
- CORE_APROVACAO_FINANCEIRA_CANONICO.md
- CORE_PERMISSOES_FINANCEIRAS_CANONICO.md
- GAPS_PROCESSADO_CANONICO.md
- HARDENING_CYCLE_CLOSURE.md
- IDENTITY_CORE_CONTRACT.md
- LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md
- PROCESSAMENTO_GAPS_CANONICO.md
<!-- AUTO-GENERATED-END -->