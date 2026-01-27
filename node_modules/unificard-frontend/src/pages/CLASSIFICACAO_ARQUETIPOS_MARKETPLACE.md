# CLASSIFICAÇÃO DE ARQUÉTIPOS - MÓDULO MARKETPLACE

Status: CANÔNICO — CLASSIFICAÇÃO INSTITUCIONAL  
Data: 2024  
Escopo: Módulo Marketplace — Frontend

---

## CLASSIFICAÇÃO OBRIGATÓRIA

Esta classificação segue os arquétipos canônicos definidos em `ARQUETIPOS_PAGINA_CANONICOS.md`.

---

## 1️⃣ HOME / DISCOVERY PAGE

Páginas de entrada, descoberta e navegação inicial.

### MarketplaceHomePage.tsx
**Rota:** `/marketplace`  
**Arquétipo:** Home / Discovery Page

**Justificativa:**
- Página de entrada do marketplace
- Contém seletor de domínio (DomainSelector)
- Não decide nada
- Não valida nada
- Apenas navegação inicial

**Conformidade:** ✅

---

## 2️⃣ CATEGORY / COLLECTION PAGE

Páginas de organização visual por categoria.

### MarketplaceDomainPage.tsx
**Rota:** `/marketplace/:domain` (ex: `/marketplace/market`, `/marketplace/services`)  
**Arquétipo:** Category / Collection Page

**Justificativa:**
- Exibe segmentos (categories) de um domínio
- Categorias são descritivas
- Apenas navegação e leitura
- Não influencia regra ou permissão

**Conformidade:** ✅

### MarketplaceSegmentPage.tsx
**Rota:** `/marketplace/:domain/:segment`  
**Arquétipo:** Category / Collection Page

**Justificativa:**
- Lista empresas de um segmento específico
- Organização visual por categoria/segmento
- Apenas navegação e leitura
- Não decide nada

**Conformidade:** ✅

### DepartmentPage.tsx
**Rota:** `/marketplace/department/:departmentId`  
**Arquétipo:** Category / Collection Page

**Justificativa:**
- Exibe branches (Products/Services) de um departamento
- Organização visual por categoria
- Apenas navegação e leitura
- Não influencia regra ou permissão

**Conformidade:** ✅

### CategoryNavigationPage.tsx
**Rota:** `/marketplace/c/:path`  
**Arquétipo:** Category / Collection Page

**Justificativa:**
- Navegação por categorias aninhadas
- Organização visual por categoria
- Apenas navegação e leitura

**Conformidade:** ✅

---

## 3️⃣ ENTITY LISTING PAGE

Listagem homogênea de entidades.

### MarketplacePage.tsx
**Rota:** `/marketplace` (com tabs: home, catalog, products, inventory, orders, payments)  
**Arquétipo:** Entity Listing Page (HÍBRIDA - mistura responsabilidades)

**Justificativa:**
- Contém múltiplas listagens (produtos, pedidos, pagamentos)
- Comparação visual
- Navegação
- Zero decisão

**Observações:**
- ⚠️ **HÍBRIDA**: Mistura Entity Listing Page com Draft / Management Page
- Tabs "orders" e "payments" são mais adequadas ao arquétipo Draft / Management Page
- Recomendação: Separar em páginas distintas conforme arquétipos

**Conformidade:** ⚠️ PARCIAL (requer refatoração)

---

## 4️⃣ ENTITY DETAIL PAGE

Visualização focada em UMA entidade.

### MarketplaceStorePage.tsx
**Rota:** `/store/:storeId`  
**Arquétipo:** Entity Detail Page (HÍBRIDA - mistura responsabilidades)

**Justificativa:**
- Visualização focada em UMA loja
- Read-model puro (exibe dados da loja)
- Contém CTAs explícitos (adicionar ao carrinho, checkout)
- Não executa decisão automaticamente

**Observações:**
- ⚠️ **HÍBRIDA**: Mistura Entity Detail Page com Action / Checkout Page
- Contém lógica de checkout integrada (deveria estar em página separada)
- Contém PDV (Ponto de Venda) - funcionalidade específica que mistura responsabilidades
- Recomendação: Extrair checkout para página dedicada (Action / Checkout Page)

**Conformidade:** ⚠️ PARCIAL (requer refatoração)

---

## 5️⃣ ACTION / CHECKOUT PAGE

Página de decisão humana explícita.

### CheckoutPage.tsx
**Rota:** `/checkout/:checkoutId`  
**Arquétipo:** Action / Checkout Page

**Justificativa:**
- Página de decisão humana explícita (confirmação de checkout)
- Confirmação consciente
- Impacto visível (pagamento)
- Nenhuma decisão implícita

**Conformidade:** ✅

---

## 6️⃣ ENTITY DECLARATION / CREATION PAGE

Página de declaração progressiva de intenção.

### StoreOnboardingWizard.tsx
**Rota:** (não identificada nas rotas principais - possivelmente modal ou rota protegida)  
**Arquétipo:** Entity Declaration / Creation Page (HÍBRIDA - usa wizard)

**Justificativa:**
- Criação de loja (declaração progressiva)
- Permite seleção de categorias e configuração
- Nenhuma validação decisória (loja apenas seleciona recortes)

**Observações:**
- ⚠️ **HÍBRIDA**: Usa wizard (steps obrigatórios)
- Conforme padrão canônico, deveria ser declaração progressiva sem wizard obrigatório
- Recomendação: Refatorar para remover wizard obrigatório

**Conformidade:** ⚠️ PARCIAL (requer refatoração)

---

## 7️⃣ DRAFT / MANAGEMENT PAGE

Página de acompanhamento e gestão.

### MyOrdersPage.tsx
**Rota:** `/my-orders`  
**Arquétipo:** Draft / Management Page

**Justificativa:**
- Acompanhamento de pedidos do comprador
- Status informativo
- Histórico
- Decisões sempre explícitas (visualizar chat, acordo, evidências)

**Conformidade:** ✅

---

## PÁGINAS NÃO CLASSIFICÁVEIS

Nenhuma página identificada como não classificável.

---

## RESUMO POR ARQUÉTIPO

### ✅ Conformes (4 páginas)
- MarketplaceHomePage.tsx → Home / Discovery Page
- MarketplaceDomainPage.tsx → Category / Collection Page
- MarketplaceSegmentPage.tsx → Category / Collection Page
- DepartmentPage.tsx → Category / Collection Page
- CategoryNavigationPage.tsx → Category / Collection Page
- CheckoutPage.tsx → Action / Checkout Page
- MyOrdersPage.tsx → Draft / Management Page

### ⚠️ Parciais / Híbridas (2 páginas)
- MarketplacePage.tsx → Entity Listing Page (mistura com Draft / Management Page)
- MarketplaceStorePage.tsx → Entity Detail Page (mistura com Action / Checkout Page)
- StoreOnboardingWizard.tsx → Entity Declaration / Creation Page (usa wizard obrigatório)

---

## OBSERVAÇÕES INSTITUCIONAIS

1. **MarketplacePage.tsx** mistura responsabilidades de Entity Listing Page com Draft / Management Page. Recomendação: Separar tabs "orders" e "payments" em página dedicada.

2. **MarketplaceStorePage.tsx** mistura responsabilidades de Entity Detail Page com Action / Checkout Page. Recomendação: Extrair lógica de checkout para página dedicada (CheckoutPage já existe).

3. **StoreOnboardingWizard.tsx** usa wizard obrigatório, violando padrão canônico de declaração progressiva. Recomendação: Refatorar para remover wizard obrigatório.

---

## OBSERVAÇÕES FINAIS

Esta classificação é OBRIGATÓRIA e deve ser respeitada em todas as refatorações.

Qualquer alteração que viole os arquétipos canônicos é INSTITUCIONALMENTE INVÁLIDA.

Páginas híbridas devem ser refatoradas para aderir a um único arquétipo canônico.

