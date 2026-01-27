# CLASSIFICAÇÃO CANÔNICA DE MÓDULOS PARA UI
**Data:** 2026-01-20  
**Autoridade:** DERIVADA / CONSULTIVA  
**Baseado em:** Veredito de Guardião sobre GAPS_BACKEND_FRONTEND_UNIFYCARD  
**Status:** APROVADO PARA DECISÃO HUMANA

---

## 🔴 REGRA DE OURO INSTITUCIONAL

> **Backend expõe possibilidades.  
> Frontend expõe decisões.  
> Documento nenhum transforma possibilidade em obrigação.**

---

## 📋 CLASSIFICAÇÃO CANÔNICA

Este documento classifica módulos backend em **3 categorias** baseadas em:

- `CORE_IMUTAVEL.md`
- `CORE_VS_MODULOS_CONTRACT.md`
- `GOLDEN_PATH.md`
- `DECISION_CORE_CONTRACT.md`
- `HIERARQUIA_E_AUTORIDADE_DOS_DOCUMENTOS.md`

---

## 1️⃣ UI DE USUÁRIO FINAL (PERMITIDO)

**Definição:** Módulos que podem ter interface para usuários finais (PF, empresas, grupos)  
**Critério:** Resolvem necessidade de produto, não infraestrutura  
**Autorização:** Decisão humana de produto necessária antes de implementar

### ✅ MÓDULOS APROVADOS PARA UI

#### A) TRANSPORTE E MOBILIDADE

| Módulo | Backend Status | Frontend Status | Prioridade | Observação |
|--------|----------------|-----------------|------------|------------|
| **Rides (Corridas)** | ✅ 75% completo | ❌ 0% | 🔴 ALTA | App passageiro + motorista |
| **Work Instant** | ✅ 90% completo | ❌ 0% | 🟡 MÉDIA | Serviços sob demanda |

**Justificativa Canônica:**
- Resolvem necessidade de produto (transporte, serviços)
- Não violam Core (usam Agenda Universal, Actors, Decisão Humana)
- Feed pode ser HUB de descoberta (conforme Golden Path)

**Requisitos Obrigatórios:**
- ✅ Integração com Agenda Universal (disponibilidade)
- ✅ Uso de Actors (passageiro, motorista, prestador)
- ✅ Decisão humana explícita (aceitar corrida, aceitar serviço)
- ✅ Feed como HUB de descoberta (não menu direto)

---

#### B) TRABALHO E SERVIÇOS

| Módulo | Backend Status | Frontend Status | Prioridade | Observação |
|--------|----------------|-----------------|------------|------------|
| **Work (Serviços)** | ✅ 85% completo | ⚠️ 40% | 🟡 MÉDIA | Listagem, detalhes, booking |
| **Jobs** | ✅ 60% completo | ❌ 0% | 🟢 BAIXA | Oportunidades de trabalho |

**Justificativa Canônica:**
- Resolvem necessidade de produto (encontrar trabalho, contratar serviços)
- Não violam Core (usam Actors, não decidem automaticamente)
- Podem integrar com Feed (descoberta)

**Requisitos Obrigatórios:**
- ✅ Feed como HUB de descoberta (não menu direto)
- ✅ Decisão humana explícita (candidatar, contratar)
- ✅ Integração com Agenda Universal (disponibilidade)

---

#### C) COMUNICAÇÃO E INTERAÇÃO

| Módulo | Backend Status | Frontend Status | Prioridade | Observação |
|--------|----------------|-----------------|------------|------------|
| **Mensagens** | ✅ 70% completo | ⚠️ 30% | 🟡 MÉDIA | Chat, inbox |
| **Inbox** | ✅ 60% completo | ⚠️ 20% | 🟡 MÉDIA | Central de notificações |

**Justificativa Canônica:**
- Resolvem necessidade de produto (comunicação entre usuários)
- Não violam Core (usam Actors, não decidem automaticamente)
- Podem integrar com Feed (notificações de interações)

**Requisitos Obrigatórios:**
- ✅ Feed como HUB (notificações aparecem no feed)
- ✅ Não criar menu separado (violaria Golden Path)
- ✅ Integração com Social Inbox (já existe)

---

#### D) PRODUTO E COMÉRCIO

| Módulo | Backend Status | Frontend Status | Prioridade | Observação |
|--------|----------------|-----------------|------------|------------|
| **Marketplace** | ✅ 90% completo | ✅ 80% | 🟢 BAIXA | Já implementado |
| **Reviews** | ✅ 70% completo | ⚠️ 40% | 🟡 MÉDIA | Avaliações |

**Justificativa Canônica:**
- Marketplace já existe e está funcionando
- Reviews complementam Marketplace
- Não violam Core

---

### ⚠️ MÓDULOS EM ANÁLISE (REQUER DECISÃO HUMANA)

| Módulo | Status | Requer Análise | Motivo |
|--------|--------|----------------|--------|
| **Grupos** | ✅ 55% | ⚠️ SIM | Pode violar Golden Path se virar menu |
| **Votações** | ✅ 85% | ✅ OK | Já integrado com Feed |

**Ação Necessária:**
- Grupos: Verificar se Feed é HUB suficiente
- Votações: Manter integração com Feed

---

## 2️⃣ UI ADMIN / INSTITUCIONAL (RESTRITA)

**Definição:** Módulos que podem ter interface apenas para atores institucionais  
**Critério:** Requerem permissão explícita (`MAPA_CANONICO_PERMISSIONS_v1.md`)  
**Autorização:** Apenas com actor institucional + permissão canônica

### ✅ MÓDULOS APROVADOS PARA UI ADMIN

| Módulo | Permissão Necessária | Actor Tipo | Observação |
|--------|----------------------|------------|------------|
| **UnifyBank Governance** | `bank:admin:view` | system | Dashboard administrativo |
| **Rides Admin** | `rides:admin:view` | system | Gestão de corridas |
| **Fund Admin** | `fund:admin:view` | system | Gestão do Fundo Regional |
| **Dispatch Dashboards** | `dispatch:admin:view` | system | Orquestração de serviços |
| **Dashboard Operacional** | `dashboard:view` | user/page | Já implementado |

**Justificativa Canônica:**
- Respeitam `MAPA_CANONICO_PERMISSIONS_v1.md`
- Requerem permissão explícita
- Não violam Core (apenas visualização administrativa)

**Requisitos Obrigatórios:**
- ✅ Verificação de permissão via `authorization.service.canActAs()`
- ✅ Actor institucional (system) ou permissão delegada
- ✅ Não aparecem em menu padrão (apenas via permissão)

---

## 3️⃣ SEM UI (INFRAESTRUTURA)

**Definição:** Módulos que NUNCA devem ter interface de usuário  
**Critério:** São infraestrutura, não produto  
**Autorização:** NUNCA criar UI para estes módulos

### ❌ MÓDULOS PROIBIDOS DE UI

| Módulo | Motivo | Alternativa |
|--------|--------|-------------|
| **policy-engine** | Infraestrutura de decisão | Nenhuma - é interno |
| **risk-command-center** | Infraestrutura de risco | Dashboard admin (se permitido) |
| **observability** | Infraestrutura de monitoramento | Dashboard admin (se permitido) |
| **instrumentation** | Infraestrutura de métricas | Dashboard admin (se permitido) |
| **orchestrator** | Infraestrutura de orquestração | Nenhuma - é interno |
| **rbac** | Infraestrutura de permissões | Nenhuma - é interno |
| **authorization** | Core de decisão | Nenhuma - é interno |

**Justificativa Canônica:**
- Violariam `CORE_IMUTAVEL.md` (authorization é Core)
- Violariam `DECISION_CORE_CONTRACT.md` (não expor decisão como UI)
- Violariam `CORE_VS_MODULOS_CONTRACT.md` (infraestrutura não é produto)

**Regra Absoluta:**
> **Estes módulos NUNCA podem ganhar UI genérica só porque existem routes.  
> Eles são infraestrutura, não produto.  
> Se virar UI sem contrato explícito → ANTICORE DE DECISÃO.**

---

## 📊 RESUMO POR CATEGORIA

### UI de Usuário Final
- **Total:** 8 módulos
- **Status:** Requer decisão humana de produto
- **Prioridade:** Alta (Rides), Média (Work, Mensagens), Baixa (Jobs, Reviews)

### UI Admin/Institucional
- **Total:** 5 módulos
- **Status:** Requer permissão canônica
- **Prioridade:** Média (apenas para atores institucionais)

### Sem UI (Infraestrutura)
- **Total:** 7 módulos
- **Status:** PROIBIDO criar UI
- **Prioridade:** N/A (nunca implementar)

---

## ⚠️ RISCOS IDENTIFICADOS

### 1. Menu Inflation
**Risco:** Criar menus CORRIDAS, TRABALHO, MENSAGENS, INBOX  
**Violação:** Golden Path (Feed é HUB)  
**Solução:** Feed como HUB de descoberta, não menus separados

### 2. Confusão Core vs Módulo
**Risco:** Misturar core routes com módulos de negócio  
**Violação:** CORE_VS_MODULOS_CONTRACT.md  
**Solução:** Classificação explícita (este documento)

### 3. UI de Infraestrutura
**Risco:** Criar UI para policy-engine, authorization, etc.  
**Violação:** CORE_IMUTAVEL.md, DECISION_CORE_CONTRACT.md  
**Solução:** Lista explícita de proibidos (seção 3)

---

## ✅ PRÓXIMOS PASSOS OBRIGATÓRIOS

1. **Decisão Humana de Produto:**
   - Quais módulos da Lista 1 realmente precisam de UI?
   - Qual a prioridade de cada um?
   - Como integrar com Feed (Golden Path)?

2. **Verificação de Permissões:**
   - Módulos da Lista 2 requerem permissões canônicas?
   - Quais atores podem acessar?

3. **Checklist Pré-Frontend:**
   - Criar gate obrigatório antes de qualquer UI
   - Verificar conformidade canônica

---

**Gerado por:** IA Executora do UnifiCard  
**Baseado em:** Veredito de Guardião  
**Status:** ✅ APROVADO PARA DECISÃO HUMANA

