# INVENTARIO FACTUAL DO CORE - UNIFICARD

## Auditoria Institucional - Fase 0

**Data:** 2026-01-22
**Escopo:** `backend/src/core/` completo
**Objetivo:** Inventario factual sem sugestoes de correcao

---

## 1. ESTRUTURA GERAL DO CORE

### 1.1 Estatisticas

| Metrica | Valor |
|---------|-------|
| Total de modulos/pastas | 75+ |
| Total de arquivos TypeScript | 450+ |
| Documentos em /treinamento | 70+ |
| Niveis de hierarquia documental | 4 |

### 1.2 Padrao Arquitetural Comum

Cada modulo segue o padrao:
- `.module.ts` - Definicao do modulo Fastify
- `.service.ts` - Logica de negocio
- `.routes.ts` - Endpoints HTTP
- `.types.ts` - Interfaces TypeScript
- `.repository.ts` - Acesso a dados (quando aplicavel)
- `.schemas.ts` - Validacao Zod (quando aplicavel)

---

## 2. INVENTARIO COMPLETO DE MODULOS

### 2.1 Modulos de Dominio Principal

| Modulo | Localizacao | Arquivos | Responsabilidade Declarada |
|--------|-------------|----------|---------------------------|
| **ai** | `/core/ai/` | 25+ | Engine de IA, LLM adapter, tarefas |
| **auth** | `/core/auth/` | 9 | Autenticacao JWT, WebAuthn |
| **authorization** | `/core/authorization/` | 8 | Permissoes, delegacao, ownership |
| **rbac** | `/core/rbac/` | 6 | Roles e permissions genericas |
| **categories** | `/core/categories/` | 17 | Gestao de categorias, validacao |
| **catalog** | `/core/catalog/` | 15 | Produtos canonicos, pricing |
| **companies** | `/core/companies/` | 7 | Gestao de empresas |
| **economy** | `/core/economy/` | 30+ | Sistema economico, ledger, splits |
| **events** | `/core/events/` | 40+ | Dominio de eventos, lifecycle |
| **profile** | `/core/profile/` | 20+ | Perfil de usuario, inferencias |
| **identity** | `/core/identity/` | 6 | Identidade, links globais |

### 2.2 Modulos de Infraestrutura

| Modulo | Localizacao | Arquivos | Responsabilidade Declarada |
|--------|-------------|----------|---------------------------|
| **database** | `/core/database/` | 3 | Pool de conexoes, schema validator |
| **db** | `/core/db/` | 4 | Migrations, seeds, schema guard |
| **config** | `/core/config/` | 7 | Configuracao, feature flags |
| **logging** | `/core/logging/` | 3 | Logger estruturado |
| **observability** | `/core/observability/` | 5 | Metricas, projections passivas |
| **instrumentation** | `/core/instrumentation/` | 3 | Plugin de instrumentacao |

### 2.3 Modulos de Suporte

| Modulo | Localizacao | Arquivos | Responsabilidade Declarada |
|--------|-------------|----------|---------------------------|
| **notify** | `/core/notify/` | 12 | Notificacoes multi-canal |
| **memory** | `/core/memory/` | 7 | Contexto persistente do usuario |
| **feed** | `/core/feed/` | 10 | Feed social, plugins |
| **reputation** | `/core/reputation/` | 8 | Reputacao, trust, penalties |
| **matching** | `/core/matching/` | 4 | Matching de servicos |
| **referral** | `/core/referral/` | 4 | Programa de indicacao |

### 2.4 Modulos Especializados

| Modulo | Localizacao | Arquivos | Responsabilidade Declarada |
|--------|-------------|----------|---------------------------|
| **unifybank** | `/core/unifybank/` | 12 | Transferencias P2P, governanca |
| **orchestrator** | `/core/orchestrator/` | 15 | Roteamento de intents |
| **checkout** | `/core/checkout/` | 5 | Fluxo de checkout |
| **availability** | `/core/availability/` | 5 | Disponibilidade unificada |
| **calendar** | `/core/calendar/` | 4 | Calendario unificado |
| **pilot** | `/core/pilot/` | 15 | Observacao de piloto |

---

## 3. DUPLICIDADES CONCEITUAIS IDENTIFICADAS

### 3.1 ECONOMY vs UNIFYBANK

**Sobreposicao: 85%**

| Conceito | Economy | UnifyBank |
|----------|---------|-----------|
| Contas financeiras | `accounts/account.service.ts` | Via `bankPortsRegistry` |
| Transferencias | `transactions/transaction.service.ts` | `bank-p2p-transfer.service.ts` |
| Ledger | Tabela `ledger` | Tabela `bank_ledger` |
| Splits | `split.service.ts` | `createTransactionWithSplit()` |

**Problema:** Duas fontes de verdade para dados financeiros. Economy usa acesso direto, UnifyBank usa abstracoes (ports).

---

### 3.2 AUTH vs AUTHORIZATION vs RBAC

**Tres sistemas de permissoes coexistindo:**

| Sistema | Arquivo Principal | Modelo |
|---------|-------------------|--------|
| Auth | `auth.service.ts` | JWT + identidade |
| Authorization | `authorization.service.ts` | Actor + ownership + delegation |
| Business Auth | `business-authorization.service.ts` | Organization roles (LEGACY) |
| RBAC | `rbac.service.ts` | Roles genericas |

**Problema:** `business-authorization.service.ts` esta marcado como LEGACY mas ainda e usado em:
- `business-authorization.routes.ts`
- `categories.service.ts`
- `reputation/penalty.service.ts`

**Mapas desincronizados:**
- `permission-keys.ts`: 61 PermissionKeys
- `business-permissions.types.ts`: 26 BusinessActions
- Nao ha validacao de sincronia entre eles

---

### 3.3 MEMORY (AI) vs MEMORY (Core)

| Aspecto | `/core/ai/memory/` | `/core/memory/` |
|---------|-------------------|-----------------|
| Persistencia | Arquivo JSON | PostgreSQL |
| Proposito | Chat history | Preferencias usuario |
| Status | **NAO USADO** (orfao) | Ativo em producao |

**Problema:** Modulo `/core/ai/memory/` nao e importado em nenhum arquivo da aplicacao.

---

### 3.4 ORCHESTRATOR vs EVENTS

| Aspecto | Orchestrator | Events |
|---------|--------------|--------|
| Nome confuso | `orchestrator.service.ts` | `event-creation.orchestrator.ts` |
| Proposito | Intent dispatch | Domain lifecycle |
| Camada | API (user intent) | Dominio (event state) |

**Problema:** Tres arquivos chamados "orchestrator":
1. `orchestrator.service.ts` - Intent dispatcher
2. `event-creation.orchestrator.ts` - Event sequencer
3. `canonical-orchestrator.service.ts` - Event aggregator (so loga)

---

### 3.5 CATALOG/CATEGORY-REVIEW vs CATEGORIES

| Funcionalidade | `categories.service` | `category-review.service` |
|----------------|----------------------|---------------------------|
| `getPendingCategories()` | Via repository | Query SQL duplicada |
| `approveCategory()` | Implementacao completa | Wrapper que delega |
| `rejectCategory()` | Implementacao completa | Wrapper que delega |

**Problema:** `category-review.service` reimplementa query SQL ao inves de usar metodo existente.

---

## 4. CONFLITOS DE NAMING

### 4.1 Singular vs Plural

**Padrao dominante:** SINGULAR (78%)

**Excecoes com PLURAL (21%):**

| Pasta | Arquivos Internos | Inconsistencia |
|-------|-------------------|----------------|
| `reviews/` | `review.service.ts` | Pasta plural, arquivos singular |
| `tenants/` | `tenant.service.ts` | Pasta plural, arquivos singular |
| `alerts/` | `alert.service.ts` | Pasta plural, arquivos singular |
| `events/` | `event.service.ts` | Pasta plural, arquivos singular |
| `categories/` | `categories.service.ts` + `category-*.ts` | Misto |
| `companies/` | `companies.service.ts` + `company-*.ts` | Misto |

### 4.2 Diretorios Vazios/Orfaos

| Diretorio | Status |
|-----------|--------|
| `/core/category/` | VAZIO - 0 arquivos |
| `/core/fund/` | VAZIO - 0 arquivos |

**Nota:** Existe `/core/economy/fund/` que e o modulo real de fund.

### 4.3 Termos Similares Confusos

| Par de Termos | Risco |
|---------------|-------|
| `category/` vs `categories/` | Alto - pasta vazia vs ativa |
| `fund/` (vazio) vs `economy/fund/` | Alto - duplicacao aparente |
| `policy/` vs `policy-resolution/` | Medio - nomes similares |
| `city/` vs `city-readiness/` | Medio - compostos |

---

## 5. SOBREPOSICAO DE RESPONSABILIDADES

### 5.1 Matriz de Sobreposicao

| Dominio | Modulos Envolvidos | Tipo de Conflito |
|---------|-------------------|------------------|
| Financeiro | economy, unifybank | Duas implementacoes paralelas |
| Permissoes | auth, authorization, rbac, business-auth | Quatro sistemas coexistindo |
| Categorias | categories, catalog/category-review | Logica SQL duplicada |
| Memoria | ai/memory, memory | Modulo orfao vs ativo |
| Orquestracao | orchestrator, events | Naming ambiguo |

### 5.2 Caminhos Duplicados para Mesma Operacao

**Criar Conta Financeira:**
```
Caminho 1: accountService.createAccount()           [economy]
Caminho 2: bankPortsRegistry.getBankAccount().getOrCreateAccount()  [unifybank]
```

**Verificar Permissao:**
```
Caminho 1: authorizationService.canActAs()          [authorization]
Caminho 2: businessAuthorizationService.checkPermission()  [business-auth - LEGACY]
Caminho 3: rbacService.userHasPermission()          [rbac]
```

**Aprovar Categoria:**
```
Caminho 1: categoriesService.approveCategory()      [categories]
Caminho 2: categoryReviewService.approveCategory()  [catalog] -> delega para caminho 1
```

---

## 6. AMBIGUIDADES ESTRUTURAIS

### 6.1 Fonte de Verdade Indefinida

| Dominio | Candidatos | Problema |
|---------|------------|----------|
| Contas financeiras | `accounts` table, `bank_accounts` table | Qual e canonical? |
| Ledger | `ledger` table, `bank_ledger` table | Double-entry duplicado |
| Permissoes | JWT payload, DB queries | Qual prevalece se divergirem? |

### 6.2 Modulos com Responsabilidade Ambigua

| Modulo | Ambiguidade |
|--------|-------------|
| `canonical-orchestrator.service.ts` | So faz `console.log`, proposito real nao implementado |
| `ai/memory/` | Nunca importado, proposito indefinido |
| `business-authorization.service.ts` | Marcado LEGACY mas ainda integrado |

### 6.3 Dependencias Circulares Potenciais

```
events/register-handlers.ts
  -> importa orchestrator/executors/*.ts
  -> orchestrator/adapters/*.ts importa events/event-bus.ts
```

**Risco:** Dependencia circular entre events e orchestrator via handlers.

---

## 7. DOCUMENTACAO DE TREINAMENTO

### 7.1 Hierarquia de Autoridade (4 Niveis)

| Nivel | Tipo | Exemplos |
|-------|------|----------|
| 1 | CORE E CONTRATOS | CORE_IMUTAVEL.md, *_CONTRACT.md |
| 2 | GOVERNANCA | ARCHITECTURAL_GUARDRAILS.md |
| 3 | ROLES DE IA | ROLE_GUARDIA, ROLE_EXECUTORA |
| 4 | CHECKLISTS | CHECK_DUPLICIDADE_OBRIGATORIO.md |

### 7.2 Conceitos Canonicos Declarados

| Conceito | Documento | Principio |
|----------|-----------|-----------|
| Agenda Universal | AGENDA_UNIVERSAL_CONTRACT.md | Tempo e unico e centralizado |
| Decisao | Decision_Safety_and_Containment_Contract.md | Sistema nao decide |
| Identidade | IDENTITY_CORE_CONTRACT.md | Actor explicito em tudo |
| Categorias | Category_System_Contract_UnifiCard.md | Categorias nunca decidem |

### 7.3 Estruturas Imutaveis (CORE_IMUTAVEL.md)

7 estruturas declaradas como nao duplicaveis:
1. Agenda Universal
2. Actors
3. Eventos
4. Identidade
5. Publicacao
6. Auditoria
7. Observabilidade

---

## 8. MAPA DE MODULOS POR RESPONSABILIDADE

### 8.1 Responsabilidade Declarada vs Real

| Modulo | Declarada | Real Inferida | Divergencia |
|--------|-----------|---------------|-------------|
| `economy` | Sistema economico core | Ledger + splits + contas | Nenhuma |
| `unifybank` | Banco unificado | Duplica economy com abstracoes | **ALTA** |
| `authorization` | Permissoes actor-based | Ownership + delegation + capabilities | Nenhuma |
| `business-auth` | Permissoes organization-based | LEGACY ainda usado | **ALTA** |
| `ai/memory` | Chat history | **NAO USADO** | **CRITICA** |
| `category-review` | Revisao admin de categorias | Wrapper sobre categories | **MEDIA** |
| `canonical-orchestrator` | Agregador de eventos canonicos | Apenas logging | **ALTA** |

---

## 9. RESUMO DE ACHADOS

### 9.1 Duplicidades Criticas

1. **Economy vs UnifyBank** - Duas implementacoes financeiras paralelas
2. **Auth/Authorization/RBAC/BusinessAuth** - Quatro sistemas de permissao
3. **ai/memory (orfao)** - Modulo nunca utilizado

### 9.2 Sobreposicoes Significativas

1. **category-review reimplementa SQL** de categories
2. **Tres "orchestrators"** com propositos diferentes
3. **Duas tabelas de ledger** sem fonte de verdade clara

### 9.3 Conflitos de Naming

1. **7 pastas plural com arquivos singular**
2. **2 diretorios vazios** (category/, fund/)
3. **Termos confusos** (fund vs economy/fund)

### 9.4 Ambiguidades Estruturais

1. **Fonte de verdade financeira** indefinida
2. **Modulos LEGACY** ainda integrados
3. **Dependencias circulares** potenciais events<->orchestrator

---

## 10. PROXIMOS PASSOS SUGERIDOS

> **NOTA:** Este documento e um inventario factual.
> Nenhuma correcao, refatoracao ou implementacao foi realizada.
> As decisoes sobre como resolver os achados devem ser tomadas em fase posterior.

---

*Fim do Inventario Factual - Fase 0*
