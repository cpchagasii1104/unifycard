# CLASSIFICAÇÃO DE ARQUÉTIPOS - MÓDULO FOOD / SERVIÇOS / PEDIDOS

Status: CANÔNICO — CLASSIFICAÇÃO INSTITUCIONAL  
Data: 2024  
Escopo: Módulo Food/Serviços/Pedidos — Frontend

---

## CLASSIFICAÇÃO OBRIGATÓRIA

Esta classificação segue os arquétipos canônicos definidos em `ARQUETIPOS_PAGINA_CANONICOS.md`.

---

## 1️⃣ HOME / DISCOVERY PAGE

Páginas de entrada, descoberta e navegação inicial.

### ServiceDiscoveryPage.tsx
**Rota:** `/discover/services` (inferida do código)  
**Arquétipo:** Home / Discovery Page

**Justificativa:**
- Página de descoberta de serviços
- Contém filtros de busca (categoria, cidade, estado, data, disponibilidade)
- Lista serviços descobertos
- Não decide nada
- Não valida nada
- Apenas navegação e descoberta

**Conformidade:** ✅

### ServicosPage.tsx
**Rota:** `/servicos` (inferida do código)  
**Arquétipo:** Home / Discovery Page

**Justificativa:**
- Lista ofertas de serviço do feed
- Filtra posts com `intent = service_offer`
- Não decide nada
- Não valida nada
- Apenas exibição de feed filtrado

**Conformidade:** ✅

---

## 2️⃣ CATEGORY / COLLECTION PAGE

Páginas de organização visual por categoria.

**Nenhuma página identificada neste arquétipo para o módulo Food/Serviços/Pedidos.**

---

## 3️⃣ ENTITY LISTING PAGE

Listagem homogênea de entidades.

### ServicesListPage.tsx
**Rota:** `/services` (inferida do código)  
**Arquétipo:** Entity Listing Page

**Justificativa:**
- Lista serviços do actor ativo
- Comparação visual de serviços
- Filtro por status (draft, active, paused)
- Navegação para detalhes
- Zero decisão

**Conformidade:** ✅

### ServiceOrdersPage.tsx
**Rota:** `/service-orders` (inferida do código)  
**Arquétipo:** Entity Listing Page

**Justificativa:**
- Lista ordens de serviço (service orders)
- Comparação visual de ordens
- Filtro por status (DRAFT, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED)
- Navegação para detalhes
- Zero decisão

**Conformidade:** ✅

### ServiceBookingsPage.tsx
**Rota:** `/services/:id/bookings` (inferida do código)  
**Arquétipo:** Entity Listing Page

**Justificativa:**
- Lista reservas (bookings) de um serviço específico
- Comparação visual de reservas
- Filtro por status (requested, cancelled, expired)
- Navegação e visualização
- Zero decisão (cancelamento é ação explícita, não decisão automática)

**Conformidade:** ✅

### ServiceBookingRequestsPage.tsx
**Rota:** `/service-booking-requests` (inferida do código)  
**Arquétipo:** Entity Listing Page (HÍBRIDA - mistura responsabilidades)

**Justificativa:**
- Lista solicitações de booking para prestadores
- Comparação visual de solicitações
- Filtro por serviço

**Observações:**
- ⚠️ **HÍBRIDA**: Mistura Entity Listing Page com Action/Decision Page
- Contém ações de aceitar/rejeitar booking (linhas 113-171)
- Ações são explícitas e requerem confirmação, mas estão na mesma página
- Recomendação: Considerar separar ações em página dedicada ou manter como está se ações forem apenas CTAs explícitos

**Conformidade:** ⚠️ PARCIAL (requer análise)

### MyOrdersPage.tsx
**Rota:** `/my-orders` (inferida do código)  
**Arquétipo:** Entity Listing Page

**Justificativa:**
- Lista pedidos do usuário (orders)
- Comparação visual de pedidos
- Filtro por status (negotiation, in_execution, completed, cancelled, disputed)
- Navegação para detalhes
- Zero decisão

**Observações:**
- Pode incluir pedidos de food delivery, marketplace, service orders
- É hub unificado de pedidos do comprador

**Conformidade:** ✅

---

## 4️⃣ ENTITY DETAIL PAGE

Visualização focada em UMA entidade.

### ServiceDiscoveryDetailPage.tsx
**Rota:** `/discover/services/:id` (inferida do código)  
**Arquétipo:** Entity Detail Page

**Justificativa:**
- Visualização focada em UMA entidade (serviço descoberto)
- Read-model puro (exibe dados do serviço)
- Contém CTAs explícitos (Ver Disponibilidade, Solicitar Contato)
- Não executa decisão automaticamente
- CTAs apenas navegam ou abrem modais

**Conformidade:** ✅

### ServiceDetailPage.tsx
**Rota:** `/services/:id` (inferida do código)  
**Arquétipo:** Entity Detail Page

**Justificativa:**
- Visualização focada em UMA entidade (serviço)
- Read-model puro (exibe dados do serviço)
- Contém CTAs explícitos para navegação (Disponibilidade, Reservas)
- Não executa decisão automaticamente
- CTAs apenas navegam

**Conformidade:** ✅

### ServiceOrderDetailPage.tsx
**Rota:** `/service-orders/:id` (inferida do código)  
**Arquétipo:** Entity Detail Page (HÍBRIDA - mistura responsabilidades)

**Justificativa:**
- Visualização focada em UMA entidade (service order)
- Read-model puro (exibe dados da ordem)
- Contém CTAs explícitos (Confirmar, Iniciar, Completar, Cancelar)

**Observações:**
- ⚠️ **HÍBRIDA**: Mistura Entity Detail Page com Action/Decision Page
- Contém ações de confirmação, início, conclusão e cancelamento (linhas 114-199)
- Ações são explícitas e requerem confirmação, mas estão na mesma página
- Recomendação: Considerar separar ações em página dedicada ou manter como está se ações forem apenas CTAs explícitos com confirmação

**Conformidade:** ⚠️ PARCIAL (requer análise)

### UserServiceTracker.tsx
**Rota:** `/user-service-tracker/:requestId` (inferida do código)  
**Arquétipo:** Entity Detail Page (HÍBRIDA - mistura responsabilidades)

**Justificativa:**
- Visualização focada em UMA entidade (service request)
- Read-model puro (exibe timeline e status)
- Contém CTAs explícitos (Confirmar Conclusão, Disputar, Avaliar)

**Observações:**
- ⚠️ **HÍBRIDA**: Mistura Entity Detail Page com Action/Decision Page
- Contém ações de confirmação, disputa e avaliação
- Ações são explícitas, mas estão na mesma página
- Recomendação: Considerar separar ações em página dedicada ou manter como está se ações forem apenas CTAs explícitos

**Conformidade:** ⚠️ PARCIAL (requer análise)

---

## 5️⃣ ACTION / CHECKOUT PAGE

Página de decisão humana explícita.

**Nenhuma página identificada exclusivamente neste arquétipo para o módulo Food/Serviços/Pedidos.**

**Observação:** Checkout de pedidos de food delivery provavelmente usa a mesma `CheckoutPage.tsx` do marketplace, que já está classificada.

---

## 6️⃣ ENTITY DECLARATION / CREATION PAGE

Página de declaração progressiva de intenção.

### CreateServiceOrderPage.tsx
**Rota:** `/service-orders/new` (inferida do código)  
**Arquétipo:** Entity Declaration / Creation Page

**Justificativa:**
- Criação de service order
- Formulário de declaração progressiva
- Campos podem ser preenchidos progressivamente
- Validação apenas na submissão final
- Nenhum wizard obrigatório

**Conformidade:** ✅

### ServiceAvailabilityPage.tsx
**Rota:** `/services/:id/availability` (inferida do código)  
**Arquétipo:** Entity Declaration / Creation Page (HÍBRIDA - mistura responsabilidades)

**Justificativa:**
- Gerenciamento de disponibilidade do serviço
- Permite criar novas disponibilidades
- Lista disponibilidades existentes

**Observações:**
- ⚠️ **HÍBRIDA**: Mistura Entity Declaration / Creation Page com Entity Listing Page
- Contém formulário de criação (linhas 148-204)
- Contém lista de disponibilidades existentes (linhas 227-255)
- Recomendação: Considerar separar criação de listagem, ou manter como está se for apenas gestão de uma entidade específica

**Conformidade:** ⚠️ PARCIAL (requer análise)

---

## 7️⃣ DRAFT / MANAGEMENT PAGE

Página de acompanhamento e gestão.

**Nenhuma página identificada exclusivamente neste arquétipo para o módulo Food/Serviços/Pedidos.**

**Observação:** Páginas de gestão podem estar misturadas com Entity Listing Page ou Entity Detail Page.

---

## RESUMO POR ARQUÉTIPO

### Home / Discovery Page
- ServiceDiscoveryPage.tsx ✅
- ServicosPage.tsx ✅

### Category / Collection Page
- Nenhuma página identificada

### Entity Listing Page
- ServicesListPage.tsx ✅
- ServiceOrdersPage.tsx ✅
- ServiceBookingsPage.tsx ✅
- ServiceBookingRequestsPage.tsx ⚠️ PARCIAL
- MyOrdersPage.tsx ✅

### Entity Detail Page
- ServiceDiscoveryDetailPage.tsx ✅
- ServiceDetailPage.tsx ✅
- ServiceOrderDetailPage.tsx ⚠️ PARCIAL
- UserServiceTracker.tsx ⚠️ PARCIAL

### Action / Checkout Page
- Nenhuma página identificada (usa CheckoutPage.tsx do marketplace)

### Entity Declaration / Creation Page
- CreateServiceOrderPage.tsx ✅
- ServiceAvailabilityPage.tsx ⚠️ PARCIAL

### Draft / Management Page
- Nenhuma página identificada exclusivamente

---

## OBSERVAÇÕES INSTITUCIONAIS

1. **ServiceBookingRequestsPage.tsx** mistura responsabilidades de Entity Listing Page com Action/Decision Page. Recomendação: Verificar se ações de aceitar/rejeitar são apenas CTAs explícitos ou se constituem lógica de decisão integrada.

2. **ServiceOrderDetailPage.tsx** mistura responsabilidades de Entity Detail Page com Action/Decision Page. Recomendação: Verificar se ações de confirmação/início/conclusão são apenas CTAs explícitos ou se constituem lógica de decisão integrada.

3. **UserServiceTracker.tsx** mistura responsabilidades de Entity Detail Page com Action/Decision Page. Recomendação: Verificar se ações de confirmação/disputa/avaliação são apenas CTAs explícitos ou se constituem lógica de decisão integrada.

4. **ServiceAvailabilityPage.tsx** mistura responsabilidades de Entity Declaration / Creation Page com Entity Listing Page. Recomendação: Considerar se é apenas gestão de uma entidade específica (serviço) ou se requer separação.

---

## PÁGINAS NÃO CLASSIFICÁVEIS

**Nenhuma página identificada como não classificável.**

Todas as páginas podem ser classificadas em um arquétipo canônico, mesmo que parcialmente (híbridas).

---

## OBSERVAÇÕES FINAIS

Esta classificação é OBRIGATÓRIA e deve ser respeitada em todas as refatorações.

Qualquer alteração que viole os arquétipos canônicos é INSTITUCIONALMENTE INVÁLIDA.

Páginas híbridas devem ser refatoradas para aderir a um único arquétipo canônico, conforme autorização institucional.

---

FIM DO DOCUMENTO

