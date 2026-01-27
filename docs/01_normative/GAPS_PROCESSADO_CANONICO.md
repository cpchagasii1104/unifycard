Status: SUBORDINATED
Domain: UNKNOWN
Governing Contract: CORE_IMUTAVEL.md
# GAPS BACKEND/FRONTEND — PROCESSAMENTO CANÔNICO
**Data:** 2026-01-20  
**Fonte:** `GAPS_BACKEND_FRONTEND_UNIFYCARD.docx`  
**Autoridade:** DERIVADA / CONSULTIVA  
**Status:** ✅ PROCESSADO CONFORME REGRAS CANÔNICAS

---

## 🔴 REGRA DE OURO INSTITUCIONAL

> **Backend expõe possibilidades.  
> Frontend expõe decisões.  
> Documento nenhum transforma possibilidade em obrigação.**

---

## ✅ CHECKPOINT ZERO — VERIFICAÇÃO CANÔNICA

### Documentos Canônicos Consultados:
- ✅ `CHECK_DUPLICIDADE_OBRIGATORIO.md`
- ✅ `CORE_IMUTAVEL.md`
- ✅ `AGENDA_UNIVERSAL_CONTRACT.md`
- ✅ `IDENTITY_CORE_CONTRACT.md`
- ✅ `DECISION_CORE_CONTRACT.md`
- ✅ `CORE_VS_MODULOS_CONTRACT.md`
- ✅ `GOLDEN_PATH.md`
- ✅ `MAPA_CANONICO_PERMISSIONS_v1.md`
- ✅ `CLASSIFICACAO_UI_MODULOS_CANONICA.md`
- ✅ `CHECKLIST_PRE_FRONTEND_OBRIGATORIO.md`

---

## 📊 RESUMO EXECUTIVO PROCESSADO

### Estatísticas do Documento Original:
- **Total de arquivos .routes.ts no backend:** 210
- **Módulos sem API no frontend:** 19
- **Core routes sem API no frontend:** 17

### ⚠️ OBSERVAÇÃO CANÔNICA CRÍTICA:

> **"Funcionalidades prontas no backend" ≠ "devem ter UI"**  
> Conforme veredito de guardião, este documento é **INVENTÁRIO TÉCNICO**, não plano aprovado.

---

## 1️⃣ CLASSIFICAÇÃO CANÔNICA DOS MÓDULOS

### A) UI DE USUÁRIO FINAL (PERMITIDO - Lista 1)

#### 🔴 ALTA PRIORIDADE (P0)

| Módulo | Backend | Status | Observação Canônica |
|--------|---------|--------|---------------------|
| **Rides** | ✅ 22 routes | ⚠️ Requer decisão humana | Feed como HUB de descoberta |
| **Work** | ✅ 6 routes | ⚠️ Requer decisão humana | Feed como HUB de descoberta |
| **Work Instant** | ✅ 3 routes | ⚠️ Requer decisão humana | Feed como HUB de descoberta |

**Justificativa Canônica:**
- ✅ Resolvem necessidade de produto (transporte, trabalho)
- ✅ Não violam Core (usam Agenda Universal, Actors)
- ✅ Decisão humana explícita (aceitar corrida, candidatar)
- ⚠️ **REQUER:** Feed como HUB, não menu direto (Golden Path)

---

#### 🟡 MÉDIA PRIORIDADE (P1)

| Módulo | Backend | Status | Observação Canônica |
|--------|---------|--------|---------------------|
| **Live Chat** | ✅ 1 route | ⚠️ Requer decisão humana | Integrar com Social Inbox |
| **Social Chat** | ✅ 1 route | ⚠️ Requer decisão humana | Integrar com Social Inbox |
| **Care** | ✅ 1 route | ⚠️ Requer decisão humana | Feed como HUB |
| **Dispatch** | ✅ 1 route | ⚠️ Requer decisão humana | Integrar com Inbox existente |
| **Inbox** | ✅ 1 route | ⚠️ Requer decisão humana | Social Inbox já existe |
| **Invoicing** | ✅ 1 route | ⚠️ Requer permissão | Admin/Financeiro |
| **PIX/Payments** | ✅ 2 routes | ⚠️ Requer decisão humana | Integrar com Wallet existente |

**Justificativa Canônica:**
- ✅ Resolvem necessidade de produto
- ✅ Não violam Core
- ⚠️ **REQUER:** Integração com componentes existentes (não duplicar)

---

#### 🟢 BAIXA PRIORIDADE (P2)

| Módulo | Backend | Status | Observação Canônica |
|--------|---------|--------|---------------------|
| **Media** | ✅ 1 route | ⚠️ Requer decisão humana | Upload já existe parcialmente |
| **Public Profiles** | ✅ 1 route | ⚠️ Requer decisão humana | Profile já existe |
| **Reports** | ✅ 1 route | ⚠️ Requer permissão | Admin/Institucional |
| **Social Actions** | ✅ 1 route | ⚠️ Requer decisão humana | Integrar com Feed |

---

### B) UI ADMIN/INSTITUCIONAL (RESTRITA - Lista 2)

| Módulo | Backend | Permissão Necessária | Status |
|--------|---------|----------------------|--------|
| **UnifyBank Governance** | ✅ 7 routes | `bank:admin:view` | ⚠️ Requer permissão canônica |
| **Reviews** | ✅ 1 route | N/A (público) | ✅ Pode integrar em páginas existentes |
| **Referral** | ✅ 1 route | N/A (público) | ✅ Pode integrar em Profile |
| **RBAC** | ✅ 1 route | `rbac:admin:view` | ⚠️ Requer permissão canônica |
| **Business Authorization** | ✅ 1 route | `authorization:admin:view` | ⚠️ Requer permissão canônica |
| **Catalog Core** | ✅ 5 routes | N/A (público) | ✅ Pode integrar em Marketplace |
| **Invoicing** | ✅ 1 route | `financial:view_ledger` | ⚠️ Requer permissão canônica |
| **Reports** | ✅ 1 route | `reports:view` | ⚠️ Requer permissão canônica |

**Justificativa Canônica:**
- ✅ Respeitam `MAPA_CANONICO_PERMISSIONS_v1.md`
- ⚠️ **REQUER:** Permissão explícita antes de criar UI

---

### C) SEM UI (INFRAESTRUTURA - Lista 3) ❌ PROIBIDO

| Módulo | Backend | Motivo | Status |
|--------|---------|--------|--------|
| **Policy Engine** | ✅ 1 route | Infraestrutura de decisão | ❌ **PROIBIDO** |
| **Risk Command Center** | ✅ 1 route | Infraestrutura de risco | ❌ **PROIBIDO** (sem permissão admin) |
| **Observability** | ✅ 1 route | Infraestrutura de monitoramento | ❌ **PROIBIDO** (sem permissão admin) |
| **Instrumentation** | ✅ 1 route | Infraestrutura de métricas | ❌ **PROIBIDO** |
| **Orchestrator** | ✅ 1 route | Infraestrutura de orquestração | ❌ **PROIBIDO** |

**Justificativa Canônica:**
- ❌ Violariam `CORE_IMUTAVEL.md` (authorization é Core)
- ❌ Violariam `DECISION_CORE_CONTRACT.md` (não expor decisão como UI)
- ❌ Violariam `CORE_VS_MODULOS_CONTRACT.md` (infraestrutura não é produto)

---

## 2️⃣ CORREÇÕES CANÔNICAS AO DOCUMENTO ORIGINAL

### ❌ VIOLAÇÕES IDENTIFICADAS:

#### 1. Menu Inflation
**Documento Original Propõe:**
```
CORRIDAS [NOVO] - RidesHomePage
TRABALHO [NOVO] - JobsListPage
MENSAGENS [NOVO] - ChatPage
INBOX [NOVO] - InboxPage
```

**Correção Canônica:**
- ❌ **VIOLA** `GOLDEN_PATH.md` (Feed é HUB)
- ✅ **CORREÇÃO:** Feed como HUB de descoberta, não menus separados
- ✅ **CORREÇÃO:** Integrar com componentes existentes (Social Inbox, Feed)

---

#### 2. Confusão Core vs Módulo
**Documento Original Propõe:**
- UI para `policy-engine`
- UI para `orchestrator`
- UI para `authorization`

**Correção Canônica:**
- ❌ **VIOLA** `CORE_IMUTAVEL.md`
- ❌ **VIOLA** `CORE_VS_MODULOS_CONTRACT.md`
- ✅ **CORREÇÃO:** Estes módulos são infraestrutura, não produto

---

#### 3. "Funcionalidade pronta = deve ter UI"
**Documento Original Assume:**
> "Funcionalidades prontas no backend que precisam de UI no frontend"

**Correção Canônica:**
- ❌ **VIOLA** Regra de Ouro Institucional
- ✅ **CORREÇÃO:** Backend expõe possibilidades, frontend expõe decisões
- ✅ **CORREÇÃO:** Decisão humana de produto necessária antes de criar UI

---

## 3️⃣ PLANO CORRIGIDO CONFORME REGRAS CANÔNICAS

### A) RIDES - Sistema de Corridas

**Status Original:** Criar novo menu "CORRIDAS"  
**Status Canônico:** ⚠️ Requer decisão humana de produto

**Correções Obrigatórias:**
- ✅ Feed como HUB de descoberta (não menu direto)
- ✅ Integração com Agenda Universal (disponibilidade)
- ✅ Uso de Actors (passageiro, motorista)
- ✅ Decisão humana explícita (aceitar corrida)

**Páginas Propostas (após aprovação):**
- `RidesHomePage` → Integrar com Feed (descoberta)
- `RideRequestPage` → Modal ou página dedicada
- `RideTrackingPage` → Página dedicada
- `DriverDashboardPage` → Dashboard (requer permissão)

---

### B) WORK - Trabalho e Jobs

**Status Original:** Criar novo menu "TRABALHO"  
**Status Canônico:** ⚠️ Requer decisão humana de produto

**Correções Obrigatórias:**
- ✅ Feed como HUB de descoberta (não menu direto)
- ✅ Integração com Agenda Universal (disponibilidade)
- ✅ Decisão humana explícita (candidatar, contratar)

**Páginas Propostas (após aprovação):**
- `JobsListPage` → Integrar com Feed (descoberta)
- `JobDetailPage` → Página dedicada
- `WorkerDashboardPage` → Dashboard (requer permissão)

---

### C) CHAT - Sistema de Mensagens

**Status Original:** Criar novo menu "MENSAGENS"  
**Status Canônico:** ⚠️ Requer decisão humana de produto

**Correções Obrigatórias:**
- ✅ Integrar com Social Inbox existente (não duplicar)
- ✅ Feed como HUB (notificações aparecem no feed)
- ✅ Não criar menu separado (violaria Golden Path)

**Componentes Propostos (após aprovação):**
- `SocialChatDrawer` → Componente integrado ao Feed
- `ChatRoomPage` → Página dedicada (se necessário)

---

### D) UNIFYBANK - Funcionalidades Faltando

**Status Original:** Integrar em páginas existentes  
**Status Canônico:** ✅ APROVADO (com permissões)

**Correções Obrigatórias:**
- ✅ Integrar com WalletPage existente
- ✅ Requer permissão canônica para funcionalidades admin
- ✅ Não calcular splits no frontend (backend-only)

**Integrações Propostas:**
- `Doações` → WalletPage ou componente dedicado
- `P2P Transfers` → WalletPage
- `Fundo Regional` → FundAdminPanel (requer permissão)

---

### E) REVIEWS - Sistema de Avaliações

**Status Original:** Integrar em múltiplas páginas  
**Status Canônico:** ✅ APROVADO

**Correções Obrigatórias:**
- ✅ Integrar em páginas existentes (não criar novas)
- ✅ Não decidir automaticamente (humano avalia)

**Integrações Propostas:**
- `ServiceDetailPage` → ReviewsList, WriteReview
- `MarketplaceStorePage` → StoreReviews, ProductReviews
- `Profile.tsx` → MyReviews, ReceivedReviews

---

## 4️⃣ ARQUIVOS DE API A CRIAR (APÓS APROVAÇÃO)

### Prioridade P0 (Alta) - Requer Decisão Humana:

| Arquivo | Módulo Backend | Status Canônico |
|---------|----------------|-----------------|
| `rides.ts` | modules/rides (22 routes) | ⚠️ Requer aprovação |
| `work.ts` | modules/work (6 routes) | ⚠️ Requer aprovação |
| `work-instant.ts` | modules/work-instant (3 routes) | ⚠️ Requer aprovação |
| `unifybank.ts` | core/unifybank (7 routes) | ⚠️ Requer permissões |
| `reviews.ts` | core/reviews (1 route) | ✅ Aprovado |

### Prioridade P1 (Média) - Requer Decisão Humana:

| Arquivo | Módulo Backend | Status Canônico |
|---------|----------------|-----------------|
| `live-chat.ts` | modules/live-chat (1 route) | ⚠️ Integrar com Social Inbox |
| `social-chat.ts` | modules/social-chat (1 route) | ⚠️ Integrar com Social Inbox |
| `care.ts` | modules/care (1 route) | ⚠️ Requer aprovação |
| `dispatch.ts` | modules/dispatch (1 route) | ⚠️ Integrar com Inbox |
| `social-inbox.ts` | modules/inbox (1 route) | ⚠️ Verificar duplicação |
| `invoicing.ts` | modules/invoicing (1 route) | ⚠️ Requer permissão |
| `pix.ts` | modules/payments/pix (1 route) | ⚠️ Integrar com Wallet |

### Prioridade P2 (Baixa) - Requer Decisão Humana:

| Arquivo | Módulo Backend | Status Canônico |
|---------|----------------|-----------------|
| `media.ts` | modules/media (1 route) | ⚠️ Verificar duplicação |
| `public-profiles.ts` | modules/public-profiles (1 route) | ⚠️ Verificar duplicação |
| `reports.ts` | modules/reports (1 route) | ⚠️ Requer permissão |

---

## 5️⃣ CRONOGRAMA CORRIGIDO (APÓS APROVAÇÕES)

### ⚠️ OBSERVAÇÃO CANÔNICA:

> **Cronograma original assume aprovação automática.  
> Conforme regras canônicas, cada módulo requer:**
> 1. Decisão humana de produto
> 2. Aplicação do Checklist Pré-Frontend
> 3. Verificação de permissões canônicas
> 4. Aprovação explícita

### Fase 1: Decisão e Aprovação (OBRIGATÓRIA)
- [ ] Revisar módulos da Lista 1 (UI de Usuário Final)
- [ ] Aplicar Checklist Pré-Frontend para cada módulo
- [ ] Aprovar módulos conforme regras canônicas
- [ ] Definir prioridades baseadas em decisão humana

### Fase 2: Implementação (APÓS APROVAÇÃO)
- [ ] Criar APIs aprovadas
- [ ] Criar páginas/componentes aprovados
- [ ] Integrar com Feed (Golden Path)
- [ ] Verificar permissões canônicas

---

## 6️⃣ REGRAS BLOQUEANTES APLICADAS

### ❌ NUNCA criar UI para:
- policy-engine
- orchestrator
- instrumentation
- authorization (sem permissão admin)

### ❌ NUNCA criar menu para:
- Módulos que podem ser descobertos via Feed
- Infraestrutura
- Core interno

### ❌ NUNCA decidir automaticamente:
- Por score
- Por categoria
- Por heurística
- Sem clique explícito

---

## ✅ CONCLUSÃO CANÔNICA

### Status do Documento Original:
- ✅ **Inventário técnico válido**
- ✅ **Diagnóstico correto**
- ⚠️ **Plano requer correções canônicas**

### Correções Aplicadas:
1. ✅ Classificação canônica (Lista 1, 2, 3)
2. ✅ Remoção de menu inflation
3. ✅ Bloqueio de UI para infraestrutura
4. ✅ Integração com Feed (Golden Path)
5. ✅ Verificação de permissões canônicas

### Próximos Passos Obrigatórios:
1. **Decisão Humana de Produto:** Quais módulos realmente precisam de UI?
2. **Aplicação do Checklist:** Verificar cada módulo contra `CHECKLIST_PRE_FRONTEND_OBRIGATORIO.md`
3. **Verificação de Permissões:** Módulos admin requerem permissões canônicas
4. **Integração com Feed:** Respeitar Golden Path

---

**Gerado por:** IA Executora do UnifiCard  
**Baseado em:** Regras Canônicas de `/treinamento`  
**Status:** ✅ PROCESSADO E CORRIGIDO CONFORME REGRAS CANÔNICAS


