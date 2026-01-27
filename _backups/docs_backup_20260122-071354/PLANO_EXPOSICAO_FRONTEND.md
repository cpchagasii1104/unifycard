# PLANO DE EXPOSIÇÃO FRONTEND
## UnifiCard - Decisão Estratégica de Exposição de Capacidades

**Data:** 2025-01-XX  
**Objetivo:** Definir QUÊ será exposto primeiro e COMO, baseado em impacto real  
**Status:** ✅ Plano Definido

---

## RESUMO EXECUTIVO

Foram selecionados **3 DOMÍNIOS** para exposição inicial, totalizando **15 capacidades backend** que serão expostas em **12 telas mínimas**. Os domínios escolhidos atendem aos critérios obrigatórios: backend completo, valor imediato, sem decisões econômicas novas, sem dependências arquiteturais.

**Domínios selecionados:**
1. **SERVICES (Serviços)** - Completar exposição de Availability e Bookings
2. **ORGANIZATION (Organização)** - Funcionários, membros, convites
3. **GROUPS (Grupos)** - Votações e campanhas

---

## DOMÍNIO 1: SERVICES (Serviços)

### Persona Principal
**PJ (Pessoa Jurídica)** - Empresas que oferecem serviços

### Problema Real que Resolve
**"Como gerenciar disponibilidade e reservas dos meus serviços?"**

Atualmente, empresas podem criar serviços e service orders, mas não podem:
- Configurar horários disponíveis para reserva
- Receber e gerenciar solicitações de reserva
- Visualizar agenda de disponibilidade

### Capacidades Backend que Entram no MVP Visual

| # | Capacidade | Endpoint(s) | Status Backend |
|---|-----------|-------------|----------------|
| 1 | **Service Availability** | `POST /services/:id/availability`<br>`GET /services/:id/availability`<br>`PATCH /services/:id/availability/:availabilityId`<br>`DELETE /services/:id/availability/:availabilityId` | ✅ Completo |
| 2 | **Service Bookings** | `POST /services/:id/bookings`<br>`GET /services/:id/bookings`<br>`GET /services/:id/bookings/:bookingId`<br>`PATCH /services/:id/bookings/:bookingId` | ✅ Completo |
| 3 | **Booking Decisions** | `POST /bookings/:id/approve`<br>`POST /bookings/:id/reject` | ✅ Completo |

**Total:** 3 capacidades

### Capacidades Explicitamente Fora do Escopo (MVP)

| # | Capacidade | Motivo |
|---|-----------|--------|
| 1 | **Payment Requests** | Requer decisões econômicas (fora do escopo) |
| 2 | **Payment Execution** | Requer decisões econômicas (fora do escopo) |
| 3 | **Service Resources** | Não essencial para MVP |
| 4 | **Service Feed Plugin** | Já integrado no feed (não precisa tela dedicada) |

### Fluxo Mínimo de Telas

#### 1. Lista de Disponibilidades do Serviço
**Nome:** `ServiceAvailabilityPage`  
**Tipo:** Lista  
**Rota:** `/services/:id/availability`  
**Acesso:** A partir da página do serviço (aba "Disponibilidade")  
**Funcionalidade:**
- Lista todas as disponibilidades do serviço
- Filtros: status (active/paused), tipo (fixed/recurring/on_demand)
- Ações: Criar disponibilidade, Editar, Pausar/Ativar, Remover

#### 2. Criar/Editar Disponibilidade
**Nome:** `ServiceAvailabilityFormPage`  
**Tipo:** Formulário  
**Rota:** `/services/:id/availability/new`<br>`/services/:id/availability/:availabilityId/edit`  
**Acesso:** A partir da lista de disponibilidades  
**Funcionalidade:**
- Campos: tipo, data/hora início, data/hora fim, timezone, capacidade
- Validação visual básica
- Salvar disponibilidade

#### 3. Lista de Reservas do Serviço
**Nome:** `ServiceBookingsPage`  
**Tipo:** Lista  
**Rota:** `/services/:id/bookings`  
**Acesso:** A partir da página do serviço (aba "Reservas")  
**Funcionalidade:**
- Lista todas as reservas do serviço
- Filtros: status (requested/approved/rejected/cancelled/expired)
- Badge contador de reservas pendentes
- Ações: Aprovar, Rejeitar, Ver detalhes

#### 4. Detalhe de Reserva
**Nome:** `ServiceBookingDetailPage`  
**Tipo:** Detalhe + Ação  
**Rota:** `/services/:id/bookings/:bookingId`  
**Acesso:** A partir da lista de reservas  
**Funcionalidade:**
- Exibe detalhes da reserva (cliente, horário, notas)
- Botões: Aprovar, Rejeitar
- Feedback após ação

### Relação com Feed / Perfil / Agenda

- **Feed:** Não relacionado diretamente
- **Perfil:** Não relacionado diretamente
- **Agenda:** **CONECTADO** - Reservas aprovadas podem aparecer na agenda do prestador (já implementado via Calendar Events)

### Integração com Service Orders Existente

- Service Orders já implementado (SPRINT 68)
- Availability e Bookings são **complementares** (não conflitam)
- Fluxo: Cliente faz booking → Prestador aprova → Pode gerar Service Order (futuro)

---

## DOMÍNIO 2: ORGANIZATION (Organização)

### Persona Principal
**PJ (Pessoa Jurídica)** - Empresas que precisam gerenciar equipe

### Problema Real que Resolve
**"Como gerenciar funcionários, membros e permissões da minha empresa?"**

Atualmente, empresas podem criar perfis, mas não podem:
- Convidar usuários para a organização
- Gerenciar membros e seus papéis
- Visualizar estrutura organizacional (filiais, unidades)

### Capacidades Backend que Entram no MVP Visual

| # | Capacidade | Endpoint(s) | Status Backend |
|---|-----------|-------------|----------------|
| 1 | **Organization Invites** | `POST /organization/invites`<br>`GET /organization/invites`<br>`POST /organization/invites/:id/accept`<br>`POST /organization/invites/:id/revoke` | ✅ Completo |
| 2 | **Organization Members** | `GET /organization/members`<br>`POST /organization/members`<br>`PATCH /organization/members/:id`<br>`POST /organization/members/:id/role`<br>`POST /organization/members/:id/remove` | ✅ Completo |
| 3 | **Organization Roles** | `POST /organization/roles`<br>`GET /organization/roles`<br>`PATCH /organization/roles/:id`<br>`DELETE /organization/roles/:id` | ✅ Completo |
| 4 | **Organization Units** | `GET /organization/units`<br>`GET /organization/units/tree`<br>`GET /organization/units/:id`<br>`POST /organization/units`<br>`PATCH /organization/units/:id` | ✅ Completo |

**Total:** 4 capacidades

### Capacidades Explicitamente Fora do Escopo (MVP)

| # | Capacidade | Motivo |
|---|-----------|--------|
| 1 | **Company Employees** | Endpoint diferente (`/api/employees`), pode ser integrado depois |
| 2 | **Company Validation History** | Não essencial para MVP |
| 3 | **Company Audit Alerts** | Não essencial para MVP |
| 4 | **Unit Hierarchy Complex** | MVP apenas lista simples, não árvore completa |

### Fluxo Mínimo de Telas

#### 1. Lista de Membros da Organização
**Nome:** `OrganizationMembersPage`  
**Tipo:** Lista  
**Rota:** `/organization/members`  
**Acesso:** A partir da página da empresa (aba "Membros")  
**Funcionalidade:**
- Lista todos os membros da organização
- Filtros: status, papel (roleKey)
- Exibe: nome, papel, status
- Ações: Mudar papel, Remover membro

#### 2. Convidar Usuário
**Nome:** `OrganizationInvitePage`  
**Tipo:** Formulário  
**Rota:** `/organization/invites/new`  
**Acesso:** A partir da lista de membros (botão "Convidar")  
**Funcionalidade:**
- Campos: email, papel (roleKey), notas (opcional)
- Lista de papéis disponíveis
- Enviar convite

#### 3. Lista de Convites
**Nome:** `OrganizationInvitesPage`  
**Tipo:** Lista  
**Rota:** `/organization/invites`  
**Acesso:** A partir da lista de membros (aba "Convites")  
**Funcionalidade:**
- Lista convites pendentes, aceitos, revogados
- Filtros: status
- Ações: Revogar convite

#### 4. Configurar Papéis
**Nome:** `OrganizationRolesPage`  
**Tipo:** Lista + Formulário  
**Rota:** `/organization/roles`  
**Acesso:** A partir da página da empresa (Configurações → "Papéis")  
**Funcionalidade:**
- Lista papéis existentes
- Criar novo papel (nome, descrição, permissões básicas)
- Editar papel
- Remover papel

#### 5. Lista de Unidades Organizacionais
**Nome:** `OrganizationUnitsPage`  
**Tipo:** Lista  
**Rota:** `/organization/units`  
**Acesso:** A partir da página da empresa (aba "Unidades")  
**Funcionalidade:**
- Lista unidades (matriz, filiais, centros de distribuição)
- Filtros: tipo, unidade pai
- Ações: Criar unidade, Editar, Ver detalhes

### Relação com Feed / Perfil / Agenda

- **Feed:** Não relacionado diretamente
- **Perfil:** **CONECTADO** - Membros aparecem no perfil da empresa
- **Agenda:** Não relacionado diretamente

### Integração com Company Dashboard Existente

- CompanyDashboardPage já existe
- Organization Members pode ser **nova aba** no dashboard
- Não conflita com funcionalidades existentes

---

## DOMÍNIO 3: GROUPS (Grupos)

### Persona Principal
**PF (Pessoa Física)** e **PJ (Pessoa Jurídica)** - Membros de grupos/comunidades

### Problema Real que Resolve
**"Como participar de decisões e campanhas do grupo?"**

Atualmente, grupos têm criação, posts e membros, mas não têm:
- Sistema de votações para decisões coletivas
- Campanhas organizadas pelo grupo
- Timeline de atividades do grupo

### Capacidades Backend que Entram no MVP Visual

| # | Capacidade | Endpoint(s) | Status Backend |
|---|-----------|-------------|----------------|
| 1 | **Group Votes** | `POST /groups/:id/votes`<br>`GET /groups/:id/votes`<br>`GET /groups/:id/votes/:voteId`<br>`POST /groups/:id/votes/:voteId/vote` | ✅ Completo |
| 2 | **Group Campaigns** | `POST /groups/:id/campaigns`<br>`GET /groups/:id/campaigns`<br>`GET /groups/:id/campaigns/:campaignId` | ✅ Completo |
| 3 | **Group Timeline** | `GET /groups/:id/timeline` | ✅ Completo |

**Total:** 3 capacidades

### Capacidades Explicitamente Fora do Escopo (MVP)

| # | Capacidade | Motivo |
|---|-----------|--------|
| 1 | **Group Invites** | Já parcialmente implementado (InvitesPage existe) |
| 2 | **Group Financial Purpose** | Requer decisões econômicas (fora do escopo) |
| 3 | **Group Votes Complex** | MVP apenas votações simples (sim/não), não múltipla escolha |

### Fluxo Mínimo de Telas

#### 1. Lista de Votações do Grupo
**Nome:** `GroupVotesPage`  
**Tipo:** Lista  
**Rota:** `/groups/:id/votes`  
**Acesso:** A partir da página do grupo (aba "Votações")  
**Funcionalidade:**
- Lista votações do grupo
- Filtros: status (open/closed), tipo
- Exibe: título, descrição, status, resultados parciais
- Ações: Criar votação, Ver detalhes, Votar

#### 2. Criar Votação
**Nome:** `GroupVoteCreatePage`  
**Tipo:** Formulário  
**Rota:** `/groups/:id/votes/new`  
**Acesso:** A partir da lista de votações (botão "Nova Votação")  
**Funcionalidade:**
- Campos: título, descrição, opções (sim/não para MVP), data de encerramento
- Criar votação

#### 3. Detalhe de Votação
**Nome:** `GroupVoteDetailPage`  
**Tipo:** Detalhe + Ação  
**Rota:** `/groups/:id/votes/:voteId`  
**Acesso:** A partir da lista de votações  
**Funcionalidade:**
- Exibe detalhes da votação
- Resultados (se encerrada) ou opções para votar (se aberta)
- Botão "Votar" (se ainda não votou)
- Exibe quem já votou (se aplicável)

#### 4. Lista de Campanhas do Grupo
**Nome:** `GroupCampaignsPage`  
**Tipo:** Lista  
**Rota:** `/groups/:id/campaigns`  
**Acesso:** A partir da página do grupo (aba "Campanhas")  
**Funcionalidade:**
- Lista campanhas do grupo
- Filtros: status (active/closed)
- Exibe: título, descrição, status, participantes
- Ações: Criar campanha, Ver detalhes

#### 5. Timeline do Grupo
**Nome:** `GroupTimelinePage`  
**Tipo:** Timeline  
**Rota:** `/groups/:id/timeline`  
**Acesso:** A partir da página do grupo (aba "Timeline")  
**Funcionalidade:**
- Exibe histórico de atividades do grupo (posts, votações, campanhas, eventos)
- Ordenação cronológica
- Filtros: tipo de atividade

### Relação com Feed / Perfil / Agenda

- **Feed:** **CONECTADO** - Votações e campanhas podem aparecer no feed do grupo
- **Perfil:** **CONECTADO** - Grupos aparecem no perfil do usuário
- **Agenda:** Não relacionado diretamente

### Integração com Grupos Existente

- GrupoDetailPage já existe
- Votações e Campanhas podem ser **novas abas** na página do grupo
- Timeline pode ser **nova aba** ou substituir/seguir feed atual

---

## TABELA FINAL DE EXPOSIÇÃO

| DOMÍNIO | CAPACIDADES EXPOSTAS | TELAS | PERSONA | VALOR GERADO |
|---------|---------------------|-------|---------|--------------|
| **SERVICES** | 3 capacidades:<br>1. Service Availability<br>2. Service Bookings<br>3. Booking Decisions | 4 telas:<br>1. ServiceAvailabilityPage (Lista)<br>2. ServiceAvailabilityFormPage (Form)<br>3. ServiceBookingsPage (Lista)<br>4. ServiceBookingDetailPage (Detalhe) | **PJ** (Empresas que oferecem serviços) | **"Gerenciar disponibilidade e reservas dos meus serviços"**<br>- Configurar horários disponíveis<br>- Receber solicitações de reserva<br>- Aprovar/rejeitar reservas<br>- Visualizar agenda de disponibilidade |
| **ORGANIZATION** | 4 capacidades:<br>1. Organization Invites<br>2. Organization Members<br>3. Organization Roles<br>4. Organization Units | 5 telas:<br>1. OrganizationMembersPage (Lista)<br>2. OrganizationInvitePage (Form)<br>3. OrganizationInvitesPage (Lista)<br>4. OrganizationRolesPage (Lista+Form)<br>5. OrganizationUnitsPage (Lista) | **PJ** (Empresas que gerenciam equipe) | **"Gerenciar funcionários, membros e permissões da minha empresa"**<br>- Convidar usuários<br>- Gerenciar membros e papéis<br>- Configurar papéis customizados<br>- Visualizar estrutura organizacional |
| **GROUPS** | 3 capacidades:<br>1. Group Votes<br>2. Group Campaigns<br>3. Group Timeline | 5 telas:<br>1. GroupVotesPage (Lista)<br>2. GroupVoteCreatePage (Form)<br>3. GroupVoteDetailPage (Detalhe)<br>4. GroupCampaignsPage (Lista)<br>5. GroupTimelinePage (Timeline) | **PF e PJ** (Membros de grupos) | **"Participar de decisões e campanhas do grupo"**<br>- Criar e votar em votações<br>- Organizar campanhas<br>- Visualizar histórico de atividades |

**TOTAL:** 10 capacidades expostas em 14 telas

---

## DECISÕES ARQUITETURAIS

### 1. Integração com Telas Existentes

**SERVICES:**
- ServiceAvailabilityPage e ServiceBookingsPage serão **novas abas** na página do serviço (ServicosPage ou página dedicada)
- Não cria conflito com Service Orders (são complementares)

**ORGANIZATION:**
- OrganizationMembersPage será **nova aba** no CompanyDashboardPage
- OrganizationRolesPage será **nova seção** em Configurações da empresa

**GROUPS:**
- GroupVotesPage e GroupCampaignsPage serão **novas abas** no GrupoDetailPage
- GroupTimelinePage pode ser **nova aba** ou substituir feed atual

### 2. Navegação e Acesso

**SERVICES:**
- Acesso: `/servicos` → Selecionar serviço → Aba "Disponibilidade" ou "Reservas"

**ORGANIZATION:**
- Acesso: `/empresa/:companyId` → Aba "Membros" ou "Unidades"

**GROUPS:**
- Acesso: `/grupos/:id` → Aba "Votações", "Campanhas" ou "Timeline"

### 3. Permissões e RBAC

- **SERVICES:** Apenas dono do serviço pode gerenciar disponibilidade e aprovar reservas
- **ORGANIZATION:** Apenas membros com papel adequado podem convidar, gerenciar membros e criar papéis
- **GROUPS:** Apenas membros do grupo podem votar; apenas admins podem criar votações/campanhas

### 4. Estados e Feedback

- Todas as ações são **explícitas** (botões, confirmações)
- Feedback visual após cada ação (toast, mensagem)
- Estados de loading durante requisições
- Validação visual básica em formulários

---

## GARANTIAS DE NÃO MUDANÇA DE DOMÍNIO

### ✅ Regras Preservadas

1. **Backend não alterado**
   - Apenas consumo de endpoints existentes
   - Nenhuma lógica de negócio no frontend
   - Nenhum endpoint novo criado

2. **Decisões humanas**
   - Usuário escolhe horários de disponibilidade
   - Usuário aprova/rejeita reservas manualmente
   - Usuário convida membros manualmente
   - Usuário cria votações e campanhas manualmente

3. **Sem automações**
   - Nenhuma ação automática
   - Nenhuma notificação automática
   - Nenhuma sugestão automática

4. **Sem decisões econômicas**
   - Payment Requests/Execution fora do escopo
   - Group Financial Purpose fora do escopo
   - Apenas gestão operacional

---

## PRÓXIMOS PASSOS

### Fase 1: SERVICES (Prioridade 1)
1. Criar API client para Availability e Bookings
2. Implementar ServiceAvailabilityPage
3. Implementar ServiceAvailabilityFormPage
4. Implementar ServiceBookingsPage
5. Implementar ServiceBookingDetailPage
6. Integrar abas na página do serviço

### Fase 2: ORGANIZATION (Prioridade 2)
1. Criar API client para Organization
2. Implementar OrganizationMembersPage
3. Implementar OrganizationInvitePage
4. Implementar OrganizationInvitesPage
5. Implementar OrganizationRolesPage
6. Implementar OrganizationUnitsPage
7. Integrar abas no CompanyDashboardPage

### Fase 3: GROUPS (Prioridade 3)
1. Criar API client para Votes e Campaigns
2. Implementar GroupVotesPage
3. Implementar GroupVoteCreatePage
4. Implementar GroupVoteDetailPage
5. Implementar GroupCampaignsPage
6. Implementar GroupTimelinePage
7. Integrar abas no GrupoDetailPage

---

## OBSERVAÇÕES IMPORTANTES

### Limitações Aceitas (MVP)

1. **SERVICES:**
   - Apenas disponibilidade fixa (não recorrente complexa)
   - Apenas aprovação/rejeição manual (não automação)
   - Não integra com pagamentos ainda

2. **ORGANIZATION:**
   - Apenas estrutura simples (não hierarquia complexa)
   - Apenas papéis básicos (não permissões granulares)
   - Não integra com Company Employees ainda

3. **GROUPS:**
   - Apenas votações sim/não (não múltipla escolha)
   - Campanhas básicas (não com recursos financeiros)
   - Timeline simples (não filtros avançados)

### Melhorias Futuras (Fora do Escopo)

- Integração com pagamentos (Payment Requests/Execution)
- Automações de aprovação
- Hierarquia organizacional complexa
- Votações múltipla escolha
- Campanhas com recursos financeiros

---

**Status:** ✅ Plano Definido  
**Pronto para:** Implementação Fase 1 (SERVICES)


