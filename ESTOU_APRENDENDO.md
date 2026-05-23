# ESTOU APRENDENDO — Documento de Transferência de Conhecimento

**Status:** APENAS APRENDIZADO — Este documento NÃO é normativo, NÃO altera código, NÃO substitui documentação oficial.

**Propósito:** Transferir conhecimento entre sessões de IA para continuidade de trabalho.

**Criado:** 2026-04-26

**Última sessão:** 2026-04-26 — Visão Além do Alcance (auditoria técnica profunda, análise crítica honesta, recomendações estratégicas).

---

## AVISO IMPORTANTE

Este documento é um **resumo de aprendizado** criado por uma IA após ler extensivamente a documentação e código do UnifiCard. Ele serve para que outra sessão de IA possa retomar o trabalho com contexto.

**NÃO USE ESTE DOCUMENTO PARA:**
- Tomar decisões arquiteturais
- Substituir leitura dos documentos normativos
- Justificar alterações de código

**USE ESTE DOCUMENTO PARA:**
- Ganhar contexto inicial rapidamente
- Saber onde procurar informação detalhada
- Entender a filosofia do sistema antes de agir

**SEMPRE LEIA OS DOCUMENTOS ORIGINAIS ANTES DE QUALQUER AÇÃO.**

---

## ÍNDICE

1. [O Que É o UnifiCard](#1-o-que-é-o-unificard)
2. [A Filosofia Central](#2-a-filosofia-central)
3. [Arquitetura Constitucional](#3-arquitetura-constitucional)
4. [Os 12 Artigos da Constituição](#4-os-12-artigos-da-constituição)
5. [As 7 Leis Operacionais](#5-as-7-leis-operacionais)
6. [SSOT — Fontes Únicas de Verdade](#6-ssot--fontes-únicas-de-verdade)
7. [Modelo de Identidade](#7-modelo-de-identidade)
8. [Domínio Financeiro (Bank)](#8-domínio-financeiro-bank)
9. [Modelo Semântico (CONCEPT)](#9-modelo-semântico-concept)
10. [Ontologia de Domínios (12 N0)](#10-ontologia-de-domínios-12-n0)
11. [Estrutura do Backend](#11-estrutura-do-backend)
12. [Estado Atual de Implementação](#12-estado-atual-de-implementação)
13. [Gaps Conhecidos](#13-gaps-conhecidos)
14. [Protocolo de Agentes (IA)](#14-protocolo-de-agentes-ia)
15. [Ordem de Leitura Obrigatória](#15-ordem-de-leitura-obrigatória)
16. [Padrões Técnicos (Nomenclatura)](#16-padrões-técnicos-nomenclatura)
17. [O Que o Sistema NÃO Faz](#17-o-que-o-sistema-não-faz)
18. [Visão de Futuro](#18-visão-de-futuro)
19. [Próximos Passos Sugeridos](#19-próximos-passos-sugeridos)
20. [Auditoria de Falhas Identificadas](#20-auditoria-de-falhas-identificadas)
21. [Visão Além do Alcance — Análise Crítica](#21-visão-além-do-alcance--análise-crítica)

---

## 1. O QUE É O UNIFICARD

O UnifiCard **não é** um app, uma startup ou um marketplace comum.

É uma **infraestrutura econômica programável** — um sistema operacional social onde:

- Dinheiro flui por caminhos auditáveis
- Identidade é inviolável
- Semântica é explícita
- Tempo é centralizado
- Autoridade é rastreável
- História é imutável

**Analogia:** Se Uber/iFood são "plataformas que conectam", UnifiCard é "infraestrutura que as pessoas possuem".

**Tese central:** IA commoditiza matching, previsão e análise. O que sobra de valor é confiança (quem é real), história (o que aconteceu) e comunidade (quem responde por quem). UnifiCard é exatamente isso.

---

## 2. A FILOSOFIA CENTRAL

### Princípio Supremo

> "O sistema é único. Nenhuma camada pode criar uma realidade paralela."

### O Que Isso Significa

- Um fato = uma fonte de verdade (SSOT)
- Um conceito = um nome
- Uma pessoa/entidade = um actor
- Uma transação financeira = passa pelo Bank

### Princípio Cooperativista

> "Quem participa mais, contribui mais e gera valor, deve ser proporcionalmente recompensado."

### O Que o Sistema Defende

- Transparência radical (ledger imutável)
- Distribuição de poder (grupos com contas próprias)
- Responsabilidade humana inescapável (CPF como raiz)
- Impossibilidade de reescrever história (append-only)

---

## 3. ARQUITETURA CONSTITUCIONAL

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONSTITUIÇÃO (Imutável)                       │
│  12 Artigos — Alteração requer emenda formal                     │
│  Arquivo: docs/01_normative/CONSTITUICAO_UNIFICARD.md           │
├─────────────────────────────────────────────────────────────────┤
│                    LEIS OPERACIONAIS (7 Leis)                    │
│  Sequência · Forward-Only · Falha Deve Falhar · SSOT · etc.     │
│  Arquivo: docs/01_normative/LEIS_OPERACIONAIS_UNIFICARD.md      │
├─────────────────────────────────────────────────────────────────┤
│                    CORE IMUTÁVEL                                 │
│  Agenda · Actors · Eventos · Identidade · Publicação · Audit    │
│  Arquivo: docs/01_normative/CORE_IMUTAVEL.md                    │
├─────────────────────────────────────────────────────────────────┤
│                    LEI DE COERÊNCIA SISTÊMICA                    │
│  Pilares · Camadas · Soberania · Ordem de Composição            │
│  Arquivo: docs/01_normative/LEI_DE_COERENCIA_SISTEMICA_...md    │
├─────────────────────────────────────────────────────────────────┤
│                    CONTRATOS DE DOMÍNIO                          │
│  Financial · Identity · Temporal · Authority · Categories        │
│  Diretório: docs/01_normative/CORE_*_CONTRACT.md                │
├─────────────────────────────────────────────────────────────────┤
│                    MÓDULOS OPERACIONAIS                          │
│  Bank · Marketplace · Rides · Events · Social · Work · etc.     │
│  Diretório: backend/src/modules/                                │
└─────────────────────────────────────────────────────────────────┘
```

### Hierarquia de Precedência

```
CONSTITUIÇÃO > LEIS > CORE_IMUTÁVEL > CONTRATOS > CÓDIGO
```

Em caso de conflito, o nível superior prevalece. Sempre.

---

## 4. OS 12 ARTIGOS DA CONSTITUIÇÃO

| Artigo | Título | Essência |
|--------|--------|----------|
| I | Soberania do Ator | Todo ator é soberano. Nenhum controla outro. Não existem contas-deus. |
| II | Agenda como Verdade Única | Conflito nunca gera ação automática. Gera fato → alerta → humano. |
| III | Feed como Orquestrador Visual | Feed não executa. Plugins apenas declaram DTOs e ações possíveis. |
| IV | Inbox como Read-Model | Inbox organiza fatos. Não decide, não prioriza, não ranqueia. |
| V | Economia com Consentimento | Toda movimentação exige ator + evento + consentimento explícito. |
| VI | Ausência de Juiz Automático | Sistema não arbitra disputas sociais nem determina vencedores. |
| VII | Proibição de Crescimento do Core | Core não recebe features. Só contratos, blindagens, correções. |
| VIII | Meta-Observabilidade Social | Observa padrões, não indivíduos. Sem vigilância individual. |
| IX | Anti-Automação Ética | Consentimento não pode virar reflexo. Fricção permitida, manipulação não. |
| X | Direito à Opacidade Pessoal | Nenhum indivíduo pode ser inferido de dados agregados. |
| XI | Governança e Emendas | Mudanças são públicas, justificadas, nunca silenciosas. |
| XII | O que o Sistema NÃO Fará | Lista explícita de proibições (ver seção 17). |

**Arquivo:** `docs/01_normative/CONSTITUICAO_UNIFICARD.md`

---

## 5. AS 7 LEIS OPERACIONAIS

| Lei | Nome | Regra |
|-----|------|-------|
| 1 | Sequência Obrigatória | Genesis → Backend → Frontend → Declaração. Não inverter. |
| 2 | Forward-Only | Após tag GENESIS_v1, migrations não podem ser alteradas. |
| 3 | Falha Deve Falhar | Proibido IF NOT EXISTS em migrations constitucionais. |
| 4 | Estrutura Prevalece | NOT NULL permanece. ENUM não reduz. |
| 5 | SSOT Absoluto | UnifyBank é única fonte financeira. Nenhum ledger paralelo. |
| 6 | Rastreabilidade Total | Cada fase gera commit isolado + tag. |
| 7 | Governança Semântica | CONCEPT é SSOT semântico. Slug não tem validade. |

**Arquivo:** `docs/01_normative/LEIS_OPERACIONAIS_UNIFICARD.md`

---

## 6. SSOT — FONTES ÚNICAS DE VERDADE

### Tabela de SSOTs

| Domínio | SSOT | Writer Canônico | Proibição |
|---------|------|-----------------|-----------|
| **Dinheiro** | `bank_ledger` + `bank_transactions` | `modules/bank/*` EXCLUSIVO | UPDATE, DELETE, ledger paralelo |
| **Identidade** | `actors` | `actor-writer.service.ts` | INSERT direto, inferência |
| **Semântica** | `concepts` | `concept-governance.service.ts` | Slug como identidade |
| **Quantidade** | `inventory_movements` | Append-only | Estoque como saldo |
| **Tempo** | Agenda Universal | `time-service` (pendente) | Agendas paralelas |
| **Autoridade** | LEI §4.9 | `authority-decision.service.ts` | Fail-open |

### Regras Críticas

1. **Ninguém fora do Bank toca em `bank_*`** — nem SELECT direto em queries de negócio
2. **Toda criação de actor passa pelo writer** — `ensureUserActor()` é o único caminho
3. **concept_id é obrigatório em transações** — 23/23 paths implementados (Passo 3-B)
4. **Ledger é append-only** — estorno é nova transação, nunca UPDATE

**Arquivo:** `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md`

---

## 7. MODELO DE IDENTIDADE

### Hierarquia Constitucional

```
actor_human (CPF)           → raiz irrenunciável de autoridade
    ↓
actor_organizational        → empresa/CNPJ (NUNCA soberano)
    ↓
actor_system                → automação (NUNCA cria autoridade)
```

### Regras Fundamentais

- Todo `actor` não-humano precisa de `responsible_actor_id` → CPF
- Responsabilidade civil sempre termina em pessoa física
- Bloquear humano bloqueia todas as entidades que ele ancora
- `actor_id` ≠ `user_id` ≠ `global_user_id` (não confundir)

### Distinção Crítica

| Conceito | O que é | O que NÃO é |
|----------|---------|-------------|
| Identity | Quem é (CPF, autenticação) | Papel, permissão, conta |
| Actor | Quem age (entidade operacional) | Identity, perfil |
| Permission | O que pode fazer | Herdada de identity |
| Authority | Quem autorizou (cadeia) | Apenas permissão |

### Writer Canônico

```typescript
// ÚNICO caminho para criar actor
ensureUserActor(tenantId, userId)
  → verifica users(id).global_user_id
  → encontra ou cria actors(id)
  → retorna actor_id
```

**Arquivo:** `docs/01_normative/CORE_IDENTITY_AND_ACTORS_CONTRACT.md`

---

## 8. DOMÍNIO FINANCEIRO (BANK)

### Soberania Absoluta

O Bank é **soberano absoluto** sobre dinheiro. Nenhum módulo externo pode:

- SQL direto em tabelas `bank_*`
- Calcular saldo próprio
- Criar ledger paralelo
- Inferir posição financeira
- Definir locking sobre contas

### Estrutura de Dados

```
bank_accounts       → contas (owner_type + owner_id)
bank_transactions   → transações atômicas (append-only)
bank_ledger         → verdade contábil (credit/debit, append-only)
bank_splits         → divisão de valores (SUM = transaction.amount_cents)
```

### Ciclo Econômico Implementado

```
TRANSAÇÃO
    │
    ├── bank_transaction (SSOT)
    │       └── concept_id (semântica: 23/23 paths ✅)
    │
    ├── bank_ledger (append-only)
    │       └── direction: credit | debit
    │
    └── bank_splits (distribuição)
            ├── regional_fund (comunidade local)
            ├── community_fund (plataforma social)
            ├── system_reserve (sustentabilidade)
            ├── governance_pool (decisões coletivas)
            ├── driver/provider (quem executou)
            ├── referral (quem indicou)
            └── platform_fee (operação)
```

### Regras de Imutabilidade

- Splits são **imutáveis**
- Ledger é **append-only**
- Saldos são **calculados, não armazenados**
- Estornos são **novas transações**, nunca edição

**Arquivo:** `docs/01_normative/CORE_FINANCIAL_CONTRACT.md`

---

## 9. MODELO SEMÂNTICO (CONCEPT)

### O Que É CONCEPT

CONCEPT é a **fonte única de verdade semântica** — define "o que algo é".

```typescript
interface Concept {
  canonical_id: UUID;           // Imutável após criação
  display_names: LocalizedName[];
  slug: string;                 // Human-readable, NÃO é identidade
  domain: Domain;               // Domínio N0
  execution: ExecutionSpec;     // transactional | continuous | project | batch
  pillars: ConceptPillars;      // money, time, identity, state, event, authority
}
```

### O Que NÃO É Identidade Semântica

- `slug` — artefato técnico
- `metadata` — dados auxiliares
- `category_id` — navegação
- `canonical_product` — materialização operacional

### Encadeamento Canônico

```
CONCEPT (SSOT semântico)
    ↓
canonical_products (materialização operacional)
    ↓
products / variants (catálogo por tenant)
    ↓
categories (navegação, TREE)
```

### Regra de Ouro

Se houver conflito entre `canonical_product` e `CONCEPT` → **CONCEPT prevalece**.

**Arquivo:** `docs/01_normative/18_DOMAIN_ONTOLOGY_UNIFICARD.md`

---

## 10. ONTOLOGIA DE DOMÍNIOS (12 N0)

### Critério Formal para ser N0

1. **Entidades próprias** — não redutíveis a composição de outros
2. **Invariantes únicas** — regras não modeláveis como especialização
3. **Ciclo operacional próprio** — execução distinta

### Os 12 Domínios Core

| # | Domínio | Critério | Essência |
|---|---------|----------|----------|
| 1 | pessoas-e-identidades | 1 | CPF, pessoa física |
| 2 | organizacoes-e-instituicoes | 1 | CNPJ, personalidade jurídica |
| 3 | comunidades-e-grupos | 1+2 | Pertencimento, moderação |
| 4 | produtos-e-comercio | 1+3 | SKU, estoque, preço |
| 5 | servicos | 1+3 | Prestação, execução variável |
| 6 | ativos-corporativos | 1+2 | Uso operacional (não liquidez) |
| 7 | financas-e-economia | 2+3 | Ledger, liquidez, transação |
| 8 | mobilidade-e-logistica | 2+3 | Roteamento, entrega |
| 9 | cultura-lazer-e-eventos | 1+3 | Evento, agenda, capacidade |
| 10 | saude-e-bem-estar | 2 | Ética médica, sigilo |
| 11 | educacao-e-conhecimento | 2+3 | Certificação, progressão |
| 12 | governanca-e-decisao | 2 | Quórum, voto, assembleia |

### Domínio Condicional

- `construcao-e-infraestrutura` — elegível mas não ativado (depende de ART)

**Arquivo:** `docs/01_normative/18_DOMAIN_ONTOLOGY_UNIFICARD.md`

---

## 11. ESTRUTURA DO BACKEND

### Organização de Pastas

```
backend/src/
├── core/           # Infraestrutura & SSOT (50+ diretórios)
│   ├── actors/         # Registry de atores
│   ├── bank/           # Ports/interfaces do Bank (não implementação)
│   ├── categories/     # Taxonomia (N1 → N2)
│   ├── concepts/       # SSOT semântico
│   ├── events/         # Event-driven (outbox, bus, idempotency)
│   ├── identity/       # Linking, KYC, profiles
│   └── ...
│
├── modules/        # Lógica de negócio (75+ domínios)
│   ├── bank/           # IMPLEMENTAÇÃO exclusiva do financeiro
│   ├── marketplace/    # Orders, payments, catalog
│   ├── rides/          # Ride-hailing completo
│   ├── events/         # Organização de eventos
│   ├── social/         # Rede social
│   ├── work/           # Marketplace de trabalho
│   └── ...
│
├── contracts/      # Definições de API
├── adapters/       # Integrações externas (Pix, etc.)
├── plugins/        # Sistema de plugins
└── migrations/     # 140+ migrations
```

### Padrão Arquitetural

```
HTTP Routes (fastify)
    ↓
DTOs (zod schemas)
    ↓
Service (business logic)
    ↓
Repository (data access)
    ↓
PostgreSQL + RLS (tenant isolation)
```

### Event-Driven

- **Event Outbox Pattern** — eventos na mesma transação que writes
- **Idempotency Keys** — previne duplicação
- **DLQ** — eventos falhos vão para handler_failures

---

## 12. ESTADO ATUAL DE IMPLEMENTAÇÃO

### Módulos Concluídos (2026-04-26)

| Módulo | Status | Data |
|--------|--------|------|
| Identity (reconciliação) | ✅ CONCLUÍDO | 2026-04-18 |
| Core (tempo, eventos) | ✅ CONCLUÍDO | 2026-04-24 |
| Marketplace | ✅ CONCLUÍDO | 2026-04-19 |
| Orders | ✅ CONCLUÍDO | 2026-04-19 |
| Services | ✅ CONCLUÍDO | 2026-04-19 |
| Bank/Payments + Escrow | ✅ CONCLUÍDO | 2026-04-19 |
| Rides | ✅ CONCLUÍDO | 2026-04-19 |
| Social | ✅ CONCLUÍDO | 2026-04-19 |
| Events | ✅ CONCLUÍDO | 2026-04-20 |
| Profile | ✅ CONCLUÍDO | 2026-04-20 |
| Trust | ✅ CONCLUÍDO | 2026-04-20 |
| Live-chat / Inbox | ✅ CONCLUÍDO | 2026-04-20 |

### FASE 4 — CONCLUÍDA (2026-04-24)

Quadrinho de autoridade fechado:
- **C47** FIXED — `actor_has_permission` convertido para fail-closed
- **C52** FIXED — payment_intents writers unificados, E2E 6/6 fluxos
- **C53** FIXED — catches 42P01 com strict/permissive mode
- **C54** FIXED — 9 caminhos financeiros com authority gate
- **C55** FIXED — authority-decision.service convertido para fail-closed
- **C56** FIXED — real-margin.service reescrito para usar bank_ledger como SSOT
- **C57** FIXED — authority_roots FK para actors confirmada

### FASE 5 — CONCLUÍDA (2026-04-29)

- **C2 FIXED** — bank_transactions.concept_id NOT NULL aplicado (sessão anterior)
- **C63 FIXED** — SSOT temporal consolidado (sessão 2026-04-29)
  - G1 FECHADO: gates actor-writer-boundaries + bank-ledger-boundaries no CI
  - D.1: migration 20260530509000 (colunas unified_availability_id + unified_booking_id)
  - D.2: createBooking aceita trx opcional (repository + service)
  - D.3: checkout-ticket.service.ts migrado para fluxo canônico
  - D.4: REVOKE INSERT/UPDATE em schedules e schedule_slots aplicado

### Violações Rastreadas — atualizado 2026-04-29

| Métrica | Valor | Variação vs início da sessão |
|---------|-------|------|
| Total | 57 | +1 (C63 numerado formalmente) |
| FIXED | 32 | +15 (C63 + entregas desta sessão) |
| OPEN | 17 | -10 |
| DECISION_PENDING | 7 | -3 |
| ALLOWLISTED | 3 | estável |
| IN_PROGRESS | 0 | C2 e C63 encerrados |

### Próximo passo prioritário (definido em sessão 2026-04-29)

**G2 — E2E transversal** (prioridade máxima)
- Criar script de validação cobrindo: evento → RFQ → booking → payment → settlement → split
- Sem isso o sistema não tem prova viva de comportamento ponta-a-ponta
- Todos os componentes existem no código; falta o script orquestrador

Após G2:
- C13 triagem final (ALLOWLISTED, pode ser encerrado formalmente)
- C36/C38/C39 (status/type/state genéricos — housekeeping §07)

**Arquivos de status:**
- `STATUS_EXECUCAO_GLOBAL.md`
- `SYSTEM_REMEDIATION_STATUS.md`

---

## 13. GAPS CONHECIDOS

### Críticos (antes de produção)

1. **C2 Passo 3-C** — 7 call sites sem concept_id (RFC pendente)
2. **C13 EXPANDIDO** — 96 arquivos referenciam `bank_*`, 23 fazem SQL direto, ~13 violam fronteira de escrita
3. **NOVO: Fail-opens financeiros** — 3 locais em `bank-integration.service.ts` (bypass de limite)
4. **NOVO: Fail-opens autenticação** — 10+ locais em auth.routes, webauthn.routes, auth-rate-limit.service
5. **C22 OPEN** — `users.id` + `users.user_id` duplicados

### Estruturais (antes de escala)

4. **Gates no CI ausentes** — actor-writer-boundaries e bank-ledger-boundaries (G1)
5. **E2E transversal** — fluxo evento→RFQ→settlement não testado (G2)
6. **Time-service** — RFC-003 pendente (antes de agenda/reservas)
7. **Frontend** — arquitetura definida mas não implementada

### Violações OPEN por categoria

| Categoria | IDs | Total |
|-----------|-----|-------|
| Tabelas fantasma | C31, C32, C33, C34, C35 | 5 |
| Status/Type genérico | C36, C38, C39 | 3 |
| Nomenclatura | C11, C23, C28, C30, C41, C42, C43 | 7 |
| Monetário | C15, C40 | 2 |
| RLS | C18 | 1 |
| Identity/Actor | C50, C51 | 2 |
| Outros | C6, C7, C19, C29 | 4 |

### Positivos Confirmados (Deep Dive 2026-04-25)

- **trg_check_atl** no banco cobre 100% INSERTs — ATL protegido
- **Reconciliação financeira** completa com 36 arquivos e worker dedicado
- **Padrão outbox** garante eventos como consequência — enforcement sólido
- **RLS+FORCE** em todas as tabelas bank_*

---

## 14. PROTOCOLO DE AGENTES (IA)

### Modos de Operação

| Modo | O que faz | O que NÃO faz |
|------|-----------|---------------|
| GUARDIÃO | Audita, detecta violações, gera relatórios | Alterar código |
| EXECUTOR | Executa tarefas autorizadas, registra progresso | Decidir arquitetura |

### GATE Obrigatório (antes de qualquer alteração)

1. Qual pilar afetado? (identity, semântico, financeiro, temporal)
2. Qual SSOT governa?
3. Estrutura já existe?
4. Risco de duplicação de verdade?
5. Precedência causal respeitada? (Mutation → Estado → Dinheiro → Evento)
6. Fronteira financeira violada?

**Se qualquer resposta for incerta → ABORTAR**

### Proibições Absolutas para IAs

- Criar SSOT paralelo
- Duplicar lógica de pilar
- Inferir estado fora do SSOT
- Código fora do Bank acessar `bank_ledger`
- INSERT direto em `actors`

**Arquivo:** `docs/01_normative/00_AGENT_PROTOCOL.md`

---

## 15. ORDEM DE LEITURA OBRIGATÓRIA

Antes de qualquer trabalho no sistema, ler nesta ordem:

```
1. docs/01_normative/00_AGENT_PROTOCOL.md (este protocolo)
2. docs/01_normative/CONSTITUICAO_UNIFICARD.md
3. docs/01_normative/LEIS_OPERACIONAIS_UNIFICARD.md
4. docs/01_normative/CORE_IMUTAVEL.md
5. docs/01_normative/LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md
6. docs/01_normative/07_NOMENCLATURA_CANONICA.md
7. docs/01_normative/SSOT_REGISTRY_UNIFICARD.md
8. docs/01_normative/18_DOMAIN_ONTOLOGY_UNIFICARD.md
```

Para domínios específicos, adicionar:
- Financial: `CORE_FINANCIAL_CONTRACT.md`
- Identity: `CORE_IDENTITY_AND_ACTORS_CONTRACT.md`
- Temporal: `CORE_TEMPORAL_CONTRACT.md`

---

## 16. PADRÕES TÉCNICOS (NOMENCLATURA)

### Banco de Dados

| Conceito | Padrão | Exemplo |
|----------|--------|---------|
| Tabelas | snake_case, plural | `bank_transactions` |
| Colunas monetárias | `_cents`, BIGINT | `amount_cents` |
| Taxas | `_bps` (basis points) | `fee_rate_bps` (100 = 1%) |
| Timestamps | sufixo `_at` | `created_at`, `paid_at` |
| Booleanos | prefixo `is_/has_/can_` | `is_active`, `has_split` |
| Status | snake_case, verbos | `pending`, `completed` |
| Soft delete | `deleted_at` (não `is_deleted`) | `deleted_at IS NULL = ativo` |

### Código

| Conceito | Padrão |
|----------|--------|
| Services | `*.service.ts` |
| Repositories | `*.repository.ts` |
| Routes | `*.routes.ts` |
| Types | `*.types.ts` |
| Schemas (zod) | `*.schemas.ts` |

### Proibições

- `lat/lng` → usar `latitude/longitude`
- `qty` → usar `quantity`
- `duration_min` → usar `duration_minutes`
- Float para dinheiro → usar centavos (BIGINT)

**Arquivo:** `docs/01_normative/07_NOMENCLATURA_CANONICA.md`

---

## 17. O QUE O SISTEMA NÃO FAZ

### Proibições Constitucionais (Artigo XII)

- ❌ Não otimizará comportamento humano
- ❌ Não corrigirá desigualdade automaticamente
- ❌ Não ranqueará pessoas
- ❌ Não esconderá poder atrás de UX
- ❌ Não substituirá decisão humana

### Proibições Financeiras

- ❌ Inferir valores implicitamente
- ❌ Otimizar por heurística
- ❌ Misturar saldos entre Actors
- ❌ Criar exceções temporárias
- ❌ UPDATE em ledger

### Proibições de Identidade

- ❌ Inferir Actor a partir de Identity
- ❌ Assumir Actor default
- ❌ Herdar permissão implicitamente

---

## 18. VISÃO DE FUTURO

### O Que o Sistema Prova

Quando funcionar na prática:

1. **Matching pode ser aberto** — não precisa de Uber
2. **Dados podem ser do usuário** — não da plataforma
3. **Escala vem de cooperação** — não concentração
4. **IA commoditiza algoritmos** — valor está em confiança

### O Que Já Existe

- ✅ Constituição digital
- ✅ Leis operacionais
- ✅ SSOT implementados
- ✅ Ciclo econômico funcionando
- ✅ 70-75% da infraestrutura

### O Que Falta

- 🔲 E2E real com pessoas
- 🔲 Frontend
- 🔲 Comunicação da ideia
- 🔲 Escala gradual (100 → 1000 → mercado)

---

## 19. PRÓXIMOS PASSOS SUGERIDOS

### Para Fechar FASE 5 (C2 concept_id)

1. **RFC para 7 call sites pendentes** — concepts não incluídos nos 24 aprovados
2. **Passo 3-C** — tornar concept_id obrigatório no DTO
3. **Passo 5** — Gate CI que rejeita NULLs em concept_id
4. **Passo 6** — ALTER COLUMN SET NOT NULL (fecha C2)

### Para Fechar Violações OPEN Restantes

1. **C13** — Análise individual dos 37 arquivos (writes vs reads)
2. **Gates CI** — Adicionar actor-writer-boundaries e bank-ledger-boundaries
3. **Tabelas fantasma** — C31-C35 (criar migrations ou remover código)
4. **Nomenclatura** — C23, C28, C30, C41, C42 (housekeeping)

### Para Primeiro E2E Real

1. Escolher um fluxo simples (ex: grupo faz evento, vende ingresso)
2. Garantir que split funciona end-to-end
3. Validar que regional_fund recebe parte
4. Demonstrar transparência via API

### Para Escala

1. Frontend alinhado à constituição
2. Documentação para usuários (não só técnica)
3. Onboarding de 100 pessoas que entendem a ideia
4. Feedback loop para ajustes

---

## 20. AUDITORIA DE FALHAS IDENTIFICADAS

**Data:** 2026-04-26 (atualizado)
**Modo:** GUARDIÃO (sem edições de código)
**Sessão:** Auditoria sistemática de violações SSOT e padrões

### 20.1 VIOLAÇÕES BANK SSOT — C13 (OPEN) — EXPANDIDO

**96 arquivos** referenciam `bank_*` fora de `modules/bank/` (auditoria Sessão 4):
- **23 arquivos** fazem SQL direto (SELECT/INSERT/UPDATE)
- **~13 arquivos** violam fronteira de escrita (CRÍTICO)
- **~10 arquivos** são reads analíticos (candidatos a allowlist)

| Tipo | Tratamento Previsto |
|------|---------------------|
| Leituras analíticas/relatórios | Candidatos a allowlist FASE 5 |
| Writes fora do módulo | Migrar para `modules/bank/` |
| Leituras de saldo diretas | Substituir por API do Bank |

**Regra violada:** LEI §4.6 — "Código fora de `modules/bank/` PROIBIDO de acessar `bank_*`"

**Status:** Análise individual pendente para separar writes (CRÍTICO) de reads analíticos (allowlist).

### 20.2 PADRÕES FAIL-OPEN — C55 (FIXED ✅)

~~Validações que falham silenciosamente em vez de bloquear.~~

**CORRIGIDO em 2026-04-24:**
- `authority-decision.service.ts` convertido para strict/permissive mode
- Default `strict` (fail-closed)
- `permissive` só funciona com `NODE_ENV=development`
- 6 skips para bloqueio em strict mode

### 20.3 CONCEPT_ID AUSENTE — C2 BLOQUEADOR 3-C

**7 call sites** de transação financeira sem `concept_id`:

| # | Arquivo | Linha | Status |
|---|---------|-------|--------|
| 1 | `payment-execution.service.ts` | 434 | RFC PENDENTE |
| 2 | `payment-execution.service.ts` | 951 | RFC PENDENTE |
| 3 | `payment-execution.service.ts` | 967 | RFC PENDENTE |
| 4 | `payment-execution.service.ts` | 1046 | RFC PENDENTE |
| 5 | `payment-execution.service.ts` | 1144 | RFC PENDENTE |
| 6 | `payment-execution.service.ts` | 1212 | RFC PENDENTE |
| 7 | `transaction.service.ts` | 36 | RFC PENDENTE |

**Regra violada:** LEI §7 — "Governança Semântica" — toda transação DEVE ter `concept_id`.

**Ação sugerida:** RFC formal para concepts adicionais não incluídos nos 24 aprovados.

### 20.4 SCHEMA DRIFT — C53 (FIXED ✅) + RESIDUAIS

**CORRIGIDO em 2026-04-24:**
- 6 catches 42P01 em compliance/events/observability tratados
- `authority-mode.ts` extraído com strict/permissive

**Residuais a auditar:** catches em migrations e seeds (não-críticos em runtime).

### 20.5 COMPARAÇÃO COM VIOLAÇÕES DOCUMENTADAS

| ID | Violação | Status Atual | Notas |
|----|----------|--------------|-------|
| C2 | concept_id rollout | IN_PROGRESS | 23/23 paths ✅, Bloqueador 3-C: 7 sites |
| C13 | Bank SSOT boundary | OPEN | 37 arquivos identificados |
| C52 | payment_intents dual-writer | FIXED ✅ | E2E 6/6 fluxos |
| C53 | catches 42P01 críticos | FIXED ✅ | strict/permissive mode |
| C54 | paths financeiros sem authority | FIXED ✅ | 9 paths corrigidos |
| C55 | authority fail-open | FIXED ✅ | Convertido fail-closed |
| C56 | real-margin via metadata | FIXED ✅ | Usa bank_ledger como SSOT |
| C57 | authority_roots sem FK | FIXED ✅ | FK confirmada |

### 20.6 PRIORIZAÇÃO PARA PRÓXIMA SESSÃO

**CRÍTICO (bloqueia FASE 5):**
1. [ ] RFC C2 3-C para os 7 call sites pendentes
2. [ ] Após RFC: Passo 3-C (tipo obrigatório no DTO)
3. [ ] Passo 5: Gate CI zero NULLs
4. [ ] Passo 6: ALTER COLUMN SET NOT NULL

**ALTO (antes de E2E real):**
5. [ ] Análise individual C13 (writes vs reads analíticos)
6. [ ] Adicionar gates CI: `bank-ledger-boundaries`, `actor-writer-boundaries`
7. [ ] E2E transversal: fluxo evento→RFQ→settlement

**MÉDIO (housekeeping):**
8. [ ] Resolver tabelas fantasma (C31-C35)
9. [ ] Nomenclatura canônica (C23, C28, C30, C41, C42)

### 20.7 FAIL-OPENS NÃO DOCUMENTADOS (DESCOBERTOS SESSÃO 4)

**Severidade CRÍTICA — Domínio financeiro:**

| Arquivo | Linhas | Risco |
|---------|--------|-------|
| `bank-integration.service.ts` | 145, 239, 334 | Bypass de limite permite transação indevida |

**Severidade ALTA — Autenticação:**

| Arquivo | Linhas | Risco |
|---------|--------|-------|
| `auth.routes.ts` | 114, 257, 374, 549 | Brute force possível |
| `webauthn.routes.ts` | 110, 238 | Ataque de replay |
| `auth-rate-limit.service.ts` | 282, 329, 395 | Rate limit inefetivo |

**Severidade MÉDIA — Rate limiting:**

| Arquivo | Linhas |
|---------|--------|
| `event-rfq.service.ts` | 71 |
| `system-notification.service.ts` | 33, 36 |
| `hobby-rate-limit.service.ts` | 60, 99 |
| `business-rate-limit.service.ts` | 115 |
| `event-rate-limit.service.ts` | 116 |

**Total:** 20+ padrões fail-open, 3 em domínio financeiro crítico.

**Regra violada:** LEI §3 (Falha Deve Falhar)

**Ação sugerida:** Converter todos para fail-closed, começando pelos 3 financeiros.

### 20.8 COMANDOS ÚTEIS PARA AUDITORIA

```bash
# Buscar violações Bank SSOT (C13)
grep -r "bank_ledger\|bank_transactions\|bank_accounts" backend/src --include="*.ts" | grep -v "modules/bank/"

# Verificar concept_id no C2
grep -rn "createTransaction\|executePayment" backend/src/modules/bank --include="*.ts"

# Buscar tabelas fantasma
grep -rn "audit_events\|webauthn_challenges\|webauthn_credentials\|category_ai_logs\|partner_employees" backend/src --include="*.ts"

# Buscar fail-opens
grep -rn "FAIL.OPEN\|fail.open\|bypass" backend/src --include="*.ts"

# Verificar status das violações
cat SYSTEM_REMEDIATION_STATUS.md | grep -E "^\| C[0-9]+ \|"
```

---

## 21. VISÃO ALÉM DO ALCANCE — ANÁLISE CRÍTICA

**Data:** 2026-04-26
**Modo:** GUARDIÃO (análise sem edições)
**Natureza:** Avaliação honesta do projeto pelo agente após leitura profunda

### 21.1 O QUE VOCÊ CONSTRUIU

Você criou algo raro: um sistema com **consciência arquitetural profunda**. A maioria dos projetos nasce do código e documenta depois. Você fez o inverso — uma Constituição, Leis, SSOTs, protocolos de execução, e só então código.

A Constituição é filosoficamente admirável:
- "Nenhum ator controla outro ator"
- "Conflito gera fato. Fato gera alerta. Alerta vai para o humano."
- "O sistema não arbitra disputas sociais"
- "Consentimento sem atenção é ficção jurídica"

**Isso não é engenharia comum. É engenharia ética.**

### 21.2 PREOCUPAÇÕES IDENTIFICADAS

#### A. Complexidade normativa competindo com produto

O `00_AGENT_PROTOCOL.md` tem **886 linhas**. Define como IAs devem ler, verificar, abortar, registrar. Especifica "prova de rastreabilidade", "ambiguidade de domínio", "precedência entre documentos", "anti half-read"...

**Pergunta crítica:** Quantas pessoas além de você conseguem operar esse sistema?

Se a resposta for "só eu e a IA", existe um **single-point-of-failure** disfarçado de governança distribuída.

#### B. Gap significativo entre norma e código

A auditoria encontrou:
- **96 arquivos** violando boundary do Bank (norma diz PROIBIDO)
- **20+ fail-opens** em código financeiro e autenticação (norma diz fail-closed)
- **Tabelas fantasma** referenciadas em código (C31-C35)
- **56 violações** rastreadas, 27 ainda OPEN

Se as normas existem há tempo e as violações persistem, **algo no processo não está funcionando**.

#### C. Escopo gigantesco

Marketplace, rides, social, events, work, groups, governance, treasury, escrow, ledger, bank, profiles, categories, concepts, N0, N1, N2, actors, authority, compliance...

Cada um é um **produto inteiro** em empresas normais. Você está construindo um **sistema operacional social completo**.

#### D. Remediação aparentemente infinita

FASE 4 concluída. FASE 5 em execução. C2 bloqueado em 3-C. Novas violações descobertas na auditoria. Gates ausentes do CI.

**Pergunta:** Quando isso estabiliza? Qual é o critério de "pronto para um usuário real"?

### 21.3 A PERGUNTA NÃO FEITA

> "Estou construindo um sistema ou estou construindo uma documentação que descreve um sistema?"

O que se observa:
- Documentação normativa: **excepcional**
- Rastreabilidade de violações: **excelente**
- Protocolos de agente: **rigorosos**
- Código funcionando em produção: **?**

### 21.4 AUDITORIA TÉCNICA COMPLETA (2026-04-26)

#### Violações CRÍTICAS descobertas (não documentadas antes):

| Categoria | Arquivos | Severidade |
|-----------|----------|------------|
| Fail-open em domínio financeiro | `bank-integration.service.ts` (3 locais) | CRÍTICO |
| Fail-open em autenticação | `auth.routes.ts` (4), `webauthn.routes.ts` (2), `auth-rate-limit.service.ts` (4) | ALTO |
| Write em bank_* fora do módulo | `saga-compensation.handler.ts`, `bank-settlement-repository.ts` | CRÍTICO |
| Metadata como fonte financeira | 4 arquivos derivam valores de metadata | ALTO |

#### Detalhamento fail-opens financeiros:

```
modules/bank/bank-integration.service.ts:145 — bypass de limite
modules/bank/bank-integration.service.ts:239 — bypass de limite
modules/bank/bank-integration.service.ts:334 — bypass de limite
```

**Risco:** Transação pode ser executada mesmo quando limite deveria bloquear.

#### Detalhamento fail-opens de autenticação:

```
core/auth/auth.routes.ts:114, 257, 374, 549
core/auth/webauthn.routes.ts:110, 238
core/rate-limiting/auth-rate-limit.service.ts:282, 329, 395
```

**Risco:** Brute force e ataques de replay possíveis em modo fail-open.

#### Bank SSOT boundary (C13 expandido):

- **96 arquivos** referenciam `bank_*` tables
- **23 arquivos** fazem SQL direto (SELECT/INSERT/UPDATE)
- Apenas **~10** estão em `modules/bank/`
- **~13 arquivos violam** fronteira de escrita

Arquivos com write fora do módulo:
- `core/sagas/handlers/saga-compensation.handler.ts`
- `modules/bank-settlement/bank-settlement-repository.ts`

#### Tabelas fantasma confirmadas (C31-C35):

| Tabela | Referenciada em |
|--------|-----------------|
| `audit_events` | `core/audit/audit.service.ts` |
| `webauthn_challenges` | `core/auth/webauthn.repository.ts` |
| `webauthn_credentials` | `core/auth/webauthn.repository.ts` |
| `category_ai_logs` | `core/categories/categories.repository.ts` |
| `partner_employees` | `core/companies/company-validation.service.ts`, `core/audit/audit.service.ts` |

#### Schema drift residual (42P01/42703):

Além dos corrigidos em C53, ainda existem:
- `seed-dev-complete.ts` — 42703
- `tenant.service.ts` — 42703
- `bank-transaction.service.ts` — 42703
- `event-outbox.processor.ts` — 42P01
- `event-bus.ts` — 42P01
- `outbox-metrics.service.ts` — 42P01

### 21.5 AVALIAÇÃO HONESTA

#### O que está CERTO:

| Aspecto | Avaliação |
|---------|-----------|
| Arquitetura de pilares | Bank como soberano, Actor como identidade, CONCEPT como semântica |
| Separação de preocupações | Ledger vs read-model vs navegação |
| Filosofia de produto | Sem ranking humano, sem juiz automático |
| Metodologia de remediação | Sintoma vs causa, DECISION antes de código |

#### O que NÃO está certo:

| Aspecto | Avaliação |
|---------|-----------|
| Velocidade de execução | Documentação cresce mais rápido que código funcionando |
| Simplicidade operacional | Sistema complexo demais para uma pessoa manter |
| Priorização | Tudo parece igualmente importante |
| Validação com usuário | Zero usuários reais testaram o sistema |

### 21.6 RECOMENDAÇÕES CONCRETAS

#### 1. Congelar documentação normativa por 30 dias

A documentação já é boa o suficiente. Cada hora refinando protocolo é uma hora não gasta fechando violações ou validando com usuário.

#### 2. Escolher UM fluxo e fazer funcionar end-to-end

Sugestão: Evento com ingresso → pagamento → split para organizador e fundo regional → entrega do QR code.

Se isso funciona sem violar SSOTs, você tem produto.

#### 3. Simplificar protocolo de agente

Um agente não precisa de 886 linhas para ajudar. Precisa saber:
- Quem é SSOT do quê
- O que é proibido
- Onde está o código

O resto é ruído.

#### 4. Aceitar violações temporárias

C23 (createdAt vs created_at) não vai matar ninguém. C2 3-C (7 call sites sem concept_id) também não. Foque no que impede usuário real de usar o sistema.

#### 5. Trazer um segundo humano

Se só você entende o sistema, o sistema morre com você. Complexidade sem redundância de conhecimento é fragilidade.

### 21.7 CONCLUSÃO DA ANÁLISE

Você construiu uma **catedral normativa impressionante**. Agora precisa de **gente rezando dentro dela**.

O sistema está bem desenhado. Mas sistemas não existem no papel — existem quando alguém usa.

A pergunta não é "as regras estão certas?"

A pergunta é: **"Alguém consegue usar isso amanhã?"**

- Se a resposta for **sim**: você está no caminho certo.
- Se a resposta for **"não, porque ainda faltam X violações"**: talvez as violações não sejam o bloqueador real.

### 21.8 COMANDOS DA AUDITORIA (REFERÊNCIA)

```bash
# Fail-open patterns
grep -rn "FAIL.OPEN\|fail.open\|bypass.*validation" backend/src --include="*.ts"

# Bank boundary violations (96 arquivos)
grep -r "bank_ledger\|bank_transactions\|bank_accounts" backend/src --include="*.ts" | grep -v "modules/bank/"

# SQL direto em bank_* (23 arquivos)
grep -r "SELECT.*FROM bank_\|INSERT INTO bank_\|UPDATE bank_" backend/src --include="*.ts"

# Tabelas fantasma
grep -rn "audit_events\|webauthn_challenges\|webauthn_credentials\|category_ai_logs\|partner_employees" backend/src --include="*.ts"

# Schema drift residual
grep -rn "42P01\|42703" backend/src --include="*.ts"

# INSERT em actors (verificar writer)
grep -rn "INSERT INTO actors" backend/src --include="*.ts"

# Metadata com valores monetários
grep -rn "metadata.*amount\|amount.*metadata" backend/src --include="*.ts"
```

---

## NOTA FINAL

Este documento captura o estado de conhecimento de sessões de IA em 2026-04-26.

**Sessões registradas:**
1. **Sessão 1:** Leitura completa do sistema, criação das seções 1-19
2. **Sessão 2:** Auditoria GUARDIÃO, adição da seção 20 com falhas identificadas
3. **Sessão 3:** Correção de aprendizados — FASE 4 CONCLUÍDA confirmada, C52-C57 FIXED
4. **Sessão 4:** Visão Além do Alcance — auditoria técnica profunda + análise crítica honesta

**Descobertas importantes da Sessão 4:**
- 96 arquivos referenciam bank_* (não 37 como documentado)
- 20+ fail-opens em autenticação e financeiro não documentados
- 3 fail-opens críticos em `bank-integration.service.ts`
- Writes em bank_* fora do módulo: `saga-compensation.handler.ts`, `bank-settlement-repository.ts`
- Gap significativo entre documentação normativa e realidade do código
- Recomendação: congelar docs, focar em E2E com usuário real

**Correções importantes da Sessão 3:**
- C55 (fail-open authority) já está FIXED — não é mais pendente
- C52, C53, C54, C56, C57 todos FIXED em FASE 4 (2026-04-24)
- Bloqueador atual é C2 Passo 3-C (7 call sites)
- Violações: 56 total, 17 FIXED, 27 OPEN, 10 DECISION_PENDING

**O sistema está em construção ativa.** Sempre verifique:
- `STATUS_EXECUCAO_GLOBAL.md` para estado atual
- `SYSTEM_REMEDIATION_STATUS.md` para violações
- Git log para commits recentes

**Para continuar o trabalho:**
1. Leia a Seção 20 para ver as falhas pendentes
2. Compare com `SYSTEM_REMEDIATION_STATUS.md` atual
3. Priorize: C2 3-C → C13 → Gates CI → Housekeeping
4. Opere em modo GUARDIÃO até receber autorização para EXECUTOR

**Antes de agir, sempre pergunte ao humano:**
> "Este conhecimento ainda está atualizado? O que mudou desde a última sessão?"

---

## 22. LEVANTAMENTO RFC C2 3-C — CALL SITES BLOQUEADORES

**Data:** 2026-04-26
**Modo:** GUARDIÃO (somente leitura)
**Propósito:** Detalhe técnico para RFC de concepts adicionais

### 22.1 RESUMO EXECUTIVO

**9 call sites** identificados como bloqueadores do Passo 3-C:
- 6 em `payment-execution.service.ts` (domínio commerce)
- 1 em `transaction.service.ts` (wrapper legado)
- 2 em `financial-simulator.controller.ts` (domínio devtools)

**Concepts necessários:**
- 6 novos concepts para commerce (marketplace/payment flows)
- 2 novos concepts para devtools (simulação financeira)
- 1 wrapper sem concept próprio (callers devem especificar)

### 22.2 DETALHAMENTO — PAYMENT-EXECUTION.SERVICE.TS

#### Call Site #1 — Linha 434

**Função:** `executePayment` (linha 95)
**referenceType:** N/A (não especificado)
**Semântica:** Pagamento marketplace via escrow — buyer → escrow_payments

```typescript
// 5 linhas de contexto antes:
        });
        const eventId = uuidv4();
        // C56: order_id OBRIGATÓRIO — transação de receita marketplace (escrow payment)
        bankResult = await bankTransactionService.transfer(tenantId, {
          eventId,
          fromAccountId: userWalletAccountId,
          toAccountId: escrowPaymentsAccountId,
          amountCents: intent.amountCents,
          currency: intent.currency as BankCurrency,
          transactionType: 'transfer',
          description: `Marketplace payment (escrow): Order ${intent.orderId}`,
```

**concept_id sugerido:** `marketplace-escrow-payment`

---

#### Call Site #2 — Linha 951

**Função:** `settlePaymentToSeller` (linha 898)
**referenceType:** `'settlement'`
**Semântica:** Settlement fase 1 — escrow → clearing

```typescript
// 5 linhas de contexto antes:
    };
    const { buildSystemAuthorship } = await import('../bank/financial-authorship.helper');
    const descOrder = options?.orderId ? ` (Order ${options.orderId})` : '';
    // C56: order_id de receita marketplace (settlement)
    const r1 = await bankTransactionService.transfer(tenantId, {
      eventId: uuidv4(),
      fromAccountId: escrowAccount.accountId,
      toAccountId: clearingAccount.accountId,
      amountCents,
      currency,
      transactionType: 'transfer',
      description: `Settlement: escrow → clearing${descOrder}`,
      metadata: { ...settlementMetadataBase, purpose: 'settlement' },
      referenceType: 'settlement',
```

**concept_id sugerido:** `marketplace-settlement-escrow-to-clearing`

---

#### Call Site #3 — Linha 967

**Função:** `settlePaymentToSeller` (linha 898)
**referenceType:** `'seller_settlement'`
**Semântica:** Settlement fase 2 — clearing → seller_pending

```typescript
// 5 linhas de contexto antes:
      orderId: options?.orderId,
      authorship: buildSystemAuthorship({ actingForAccountId: escrowAccount.accountId }),
      treasurySource: 'treasury:settlement',
    });
    // C56: order_id de receita marketplace (settlement)
    const r2 = await bankTransactionService.transfer(tenantId, {
      eventId: uuidv4(),
      fromAccountId: clearingAccount.accountId,
      toAccountId: sellerPendingAccount.accountId,
      amountCents,
      currency,
      transactionType: 'transfer',
      description: `Seller settlement: clearing → seller_pending${descOrder}`,
      metadata: { ...settlementMetadataBase, purpose: 'seller_settlement' },
      referenceType: 'seller_settlement',
```

**concept_id sugerido:** `marketplace-settlement-clearing-to-seller`

---

#### Call Site #4 — Linha 1046

**Função:** `releaseSellerFunds` (linha 992)
**referenceType:** `'dispute_release'`
**Semântica:** Liberação após disputa — seller_pending → seller_available

```typescript
// 5 linhas de contexto antes:
    };
    const { buildSystemAuthorship } = await import('../bank/financial-authorship.helper');
    const descOrder = options?.orderId ? ` (Order ${options.orderId})` : '';
    // C56: order_id de receita marketplace (dispute_release)
    const result = await bankTransactionService.transfer(tenantId, {
      eventId: uuidv4(),
      fromAccountId: sellerPendingAccount.accountId,
      toAccountId: sellerAvailableAccount.accountId,
      amountCents,
      currency,
      transactionType: 'transfer',
      description: `Dispute release: seller_pending → seller_available${descOrder}`,
      metadata,
      referenceType: 'dispute_release',
```

**concept_id sugerido:** `marketplace-funds-release`

---

#### Call Site #5 — Linha 1144

**Função:** `requestSellerPayout` (linha 1076)
**referenceType:** `'payout_request'`
**Semântica:** Solicitação de saque — seller_available → seller_payout

```typescript
// 5 linhas de contexto antes:
      purpose: 'payout_request',
      seller_company_id: sellerCompanyId,
    };
    const { buildSystemAuthorship } = await import('../bank/financial-authorship.helper');
    const result = await bankTransactionService.transfer(tenantId, {
      eventId: uuidv4(),
      fromAccountId: sellerAvailableAccount.accountId,
      toAccountId: sellerPayoutAccount.accountId,
      amountCents,
      currency,
      transactionType: 'transfer',
      description: `Payout request: seller_available → seller_payout (${payoutRequestId})`,
      metadata,
      referenceType: 'payout_request',
```

**concept_id sugerido:** `seller-payout-request`

---

#### Call Site #6 — Linha 1212

**Função:** `confirmBankPayout` (linha 1167)
**referenceType:** `'bank_payout'`
**Semântica:** Confirmação payout bancário — seller_payout → bank_settlement

```typescript
// 5 linhas de contexto antes:
      purpose: 'payout_bank_settlement',
      seller_company_id: sellerCompanyId,
    };
    const { buildSystemAuthorship } = await import('../bank/financial-authorship.helper');
    const result = await bankTransactionService.transfer(tenantId, {
      eventId: uuidv4(),
      fromAccountId: sellerPayoutAccount.accountId,
      toAccountId: bankSettlementAccount.accountId,
      amountCents,
      currency,
      transactionType: 'transfer',
      description: `Bank payout confirmation: seller_payout → bank_settlement (${bankTransferId})`,
      metadata,
      referenceType: 'bank_payout',
```

**concept_id sugerido:** `seller-payout-bank-settlement`

---

### 22.3 DETALHAMENTO — TRANSACTION.SERVICE.TS

#### Call Site #7 — Linha 36

**Função:** `transfer` (linha 16)
**referenceType:** `input.referenceType` (dinâmico — vem do caller)
**Semântica:** Legacy wrapper para transferências internas

```typescript
// 5 linhas de contexto antes:
    const authorship: FinancialAuthorshipContext = buildSystemAuthorship({
      actingForAccountId: input.fromAccount,
      actingForActorId: 'system',
    });

    return bankTransactionService.transfer(tenantId, {
      eventId,
      fromAccountId: input.fromAccount,
      toAccountId: input.toAccount,
      amountCents: input.amountCents,
      currency: 'BRL',
      transactionType: 'transfer',
      description: `Legacy transfer: ${eventId}`,
      metadata: input.metadata,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      authorship,
    });
```

**concept_id:** N/A — wrapper; concept_id deve ser definido pelo **caller**
**Callers documentados:** distribution.service, split.service, social-work-payment.service, test-currency.service
**Nota:** Este serviço é `@system-context` — NÃO expor via rota HTTP.

---

### 22.4 DETALHAMENTO — FINANCIAL-SIMULATOR.CONTROLLER.TS

#### Call Site #8 — Linha 113

**Função:** `POST /financial/simulate-payment` handler (linha 23)
**referenceType:** `'simulation_deposit'`
**Semântica:** Depósito de teste — system_reserve → buyer_wallet

```typescript
// 5 linhas de contexto antes:
      }

      const systemAuth = buildSystemAuthorship({ actingForAccountId: systemReserve.accountId });

      await bankTransactionService.transfer(tenantId, {
        eventId: uuidv4(),
        fromAccountId: systemReserve.accountId,
        toAccountId: buyerWallet.accountId,
        amountCents: SIMULATION_AMOUNT_CENTS,
        currency: 'BRL',
        transactionType: 'transfer',
        description: 'Simulation deposit',
        referenceType: 'simulation_deposit',
        referenceId: uuidv4(),
        authorship: systemAuth,
        treasurySource: 'treasury:simulation',
      });
```

**concept_id sugerido:** `test-simulation-deposit`
**Domínio:** devtools
**Nota:** Bloqueado em produção (`NODE_ENV === 'production'` → 403)

---

#### Call Site #9 — Linha 127

**Função:** `POST /financial/simulate-payment` handler (linha 23)
**referenceType:** `'simulation_payment'`
**Semântica:** Pagamento de teste — buyer_wallet → escrow

```typescript
// 5 linhas de contexto antes:
        treasurySource: 'treasury:simulation',
      });

      await bankTransactionService.transfer(tenantId, {
        eventId: uuidv4(),
        fromAccountId: buyerWallet.accountId,
        toAccountId: escrowAccount.accountId,
        amountCents: SIMULATION_AMOUNT_CENTS,
        currency: 'BRL',
        transactionType: 'transfer',
        description: 'Simulation payment',
        referenceType: 'simulation_payment',
        referenceId: paymentIntentId,
        authorship: buildSystemAuthorship({ actingForAccountId: buyerWallet.accountId }),
      });
```

**concept_id sugerido:** `test-simulation-payment`
**Domínio:** devtools
**Nota:** Bloqueado em produção (`NODE_ENV === 'production'` → 403)

---

### 22.5 TABELA RESUMO PARA RFC

| # | Arquivo | Linha | Função | referenceType | concept_id sugerido | Domínio |
|---|---------|-------|--------|---------------|---------------------|---------|
| 1 | payment-execution.service.ts | 434 | executePayment | (sem) | marketplace-escrow-payment | commerce |
| 2 | payment-execution.service.ts | 951 | settlePaymentToSeller | settlement | marketplace-settlement-escrow-to-clearing | commerce |
| 3 | payment-execution.service.ts | 967 | settlePaymentToSeller | seller_settlement | marketplace-settlement-clearing-to-seller | commerce |
| 4 | payment-execution.service.ts | 1046 | releaseSellerFunds | dispute_release | marketplace-funds-release | commerce |
| 5 | payment-execution.service.ts | 1144 | requestSellerPayout | payout_request | seller-payout-request | commerce |
| 6 | payment-execution.service.ts | 1212 | confirmBankPayout | bank_payout | seller-payout-bank-settlement | commerce |
| 7 | transaction.service.ts | 36 | transfer | (dinâmico) | N/A — depende do caller | — |
| 8 | financial-simulator.controller.ts | 113 | POST /simulate-payment | simulation_deposit | test-simulation-deposit | devtools |
| 9 | financial-simulator.controller.ts | 127 | POST /simulate-payment | simulation_payment | test-simulation-payment | devtools |

**Totais:**
- 6 concepts novos para payment-execution (commerce)
- 2 concepts novos para simulator (devtools)
- 1 wrapper sem concept próprio (callers devem especificar)

---

## 23. FAIL-OPENS CRÍTICOS — PESQUISA 2

### 23.1 BANK-INTEGRATION.SERVICE.TS — 3 FAIL-OPENS

**Padrão identificado:** Validação de limite diário (`bankLimitService.validateLimit`) com catch que faz fail-open quando ocorre erro diferente de 403.

#### Fail-Open #1 — Linha 145

**Função:** `processEventTicketPayment` (linha 116)
**Validação bypassada:** Limite diário de pagamento (`payment_out`)

```typescript
  async processEventTicketPayment(
    tenantId: string,
    input: {
      eventId: string;
      buyerUserId: string;
      amountCents: number;
      currency?: BankCurrency;
      idempotencyKey?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<{ transactionId: string; splits: Array<{ accountId: string; amountCents: number }> }> {
    const { eventId, buyerUserId, currency = 'BRL', idempotencyKey, metadata } = input;
    const amountCents = parsePositiveMoneyToCents(input.amountCents, 'amountCents');

    // SPRINT 36.2: Validar limite diário (enforcement)
    try {
      const { bankLimitService } = await import('./bank-limit.service');
      await bankLimitService.validateLimit(
        tenantId,
        buyerUserId,
        'payment_out',
        amountCents,
        buyerUserId
      );
    } catch (limitError: any) {
      // Re-throw erro de limite (já tem statusCode 403)
      if (limitError.statusCode === 403) {
        throw limitError;
      }
      // Se não for erro de limite, logar mas não bloquear (fail-open)   ← CRÍTICO
      console.warn('[BankLimit] Erro ao validar limite (não bloqueante):', limitError);
    }
```

**Risco:** Se `bankLimitService.validateLimit` lançar erro que não seja 403 (conexão, timeout, bug), o pagamento de ingresso prossegue SEM validação de limite.

---

#### Fail-Open #2 — Linha 239

**Função:** `processEventConsumptionPayment` (linha 210)
**Validação bypassada:** Limite diário de pagamento (`payment_out`)

```typescript
  async processEventConsumptionPayment(
    tenantId: string,
    input: {
      eventId: string;
      buyerUserId: string;
      amountCents: number;
      currency?: BankCurrency;
      idempotencyKey?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<{ transactionId: string; splits: Array<{ accountId: string; amountCents: number }> }> {
    // ... mesma estrutura ...
    try {
      await bankLimitService.validateLimit(...);
    } catch (limitError: any) {
      if (limitError.statusCode === 403) {
        throw limitError;
      }
      // Se não for erro de limite, logar mas não bloquear (fail-open)   ← CRÍTICO
      console.warn('[BankLimit] Erro ao validar limite (não bloqueante):', limitError);
    }
```

**Risco:** Pagamento de consumo em evento pode prosseguir SEM validação de limite.

---

#### Fail-Open #3 — Linha 334

**Função:** `processServiceBookingPayment` (linha 303)
**Validação bypassada:** Limite diário de pagamento (`payment_out`)

```typescript
  async processServiceBookingPayment(
    tenantId: string,
    input: {
      bookingId: string;
      serviceId: string;
      buyerUserId: string;
      providerUserId: string;
      amountCents: number;
      currency?: BankCurrency;
      idempotencyKey?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<{ transactionId: string; splits: Array<{ accountId: string; amountCents: number }> }> {
    // ... mesma estrutura ...
    try {
      await bankLimitService.validateLimit(...);
    } catch (limitError: any) {
      if (limitError.statusCode === 403) {
        throw limitError;
      }
      // Se não for erro de limite, logar mas não bloquear (fail-open)   ← CRÍTICO
      console.warn('[BankLimit] Erro ao validar limite (não bloqueante):', limitError);
    }
```

**Risco:** Pagamento de booking de serviço pode prosseguir SEM validação de limite.

---

### 23.2 SAGA-COMPENSATION.HANDLER.TS — VIOLAÇÃO BOUNDARY

**Arquivo:** `backend/src/core/sagas/handlers/saga-compensation.handler.ts`
**Tipo de acesso:** SELECT (leitura)
**Violação:** C13 (acesso a `bank_transactions` fora de `modules/bank/`)

```typescript
// Linhas 121-128:
  // SSOT de liquidação em `bank_transactions`: `internal_completed_at` (não há coluna `status` na tabela).
  // Equivale semanticamente a "transação completed" no domínio; alinhado a `compensateTransaction`.
  const txRow = await runQueryWithTenant<{ internal_completed_at: Date | null }>(
    tenantId,
    `SELECT internal_completed_at FROM bank_transactions
     WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1`,
    [tenantId, originalTransactionId]
  );
```

**Nota:** Este é um SELECT, não INSERT/UPDATE/DELETE. Ainda assim viola a fronteira Bank (LEI §4.6).
**Recomendação:** Expor método no Bank para verificar status de liquidação de transação.

---

### 23.3 VIOLAÇÃO C13 — EXPANSÃO CONFIRMADA

**Contagem atualizada:** **84 arquivos** acessam `bank_ledger`, `bank_transactions`, `bank_accounts` ou `bank_splits` fora de `modules/bank/`.

**Arquivo com WRITE fora do Bank:**
- `modules/bank-settlement/bank-settlement-repository.ts` — faz INSERT INTO e UPDATE em `bank_settlements`

```typescript
// Linha 55:
    `INSERT INTO bank_settlements (tenant_id, payout_id, amount_cents, currency, status)
// Linha 118:
    `UPDATE bank_settlements
```

---

### 23.4 PRÓXIMOS PASSOS RECOMENDADOS

1. **RFC C2 3-C:** Criar RFC propondo os 8 novos concepts (6 commerce + 2 devtools)
2. **Fail-Opens financeiros:** Converter para fail-closed (3 locais em bank-integration.service.ts)
3. **C13 encapsulamento:** Expor API no Bank para saga-compensation e bank-settlement
4. **Após RFC aprovado:** Executar Passo 3-C → 5 → 6

---

*Documento gerado em MODO GUARDIÃO — sem alterações de código.*

---

## 24. §C2 Passo 3-C — concept_id obrigatório em tipos TypeScript

**Data:** 2026-04-28
**Commits:** 43a7c5d1 → a6cf46bd (9 commits)
**Arquivos editados:** 13 (6 tipos diretos + 1 indireto + 7 callers propagados)

### 24.1 OBJETIVO

Tornar `concept_id` obrigatório nos tipos TypeScript (de `concept_id?: string` para `concept_id: string`), eliminando `| undefined` em `CreateBankTransactionInput` e tipos relacionados.

### 24.2 METODOLOGIA — PROTOCOLO TURBO v5

**Fase 1 — Classificação:**
- Pattern: `concept_id?: string;` (exato)
- ESCOPO DIRETO: importa bank-transaction.types + chama createTransaction/transfer
- ESCOPO INDIRETO: aprovação explícita necessária
- FORA: union types (`| null`), comentários, domínios externos (canonical, vehicles, rides)

**Fase 2 — Edição cirúrgica:**
- `str_replace` exato (proibido reescrever arquivo)
- git diff completo após cada edição (diff > 10 linhas = PARAR)
- TSC comparativo via arquivo (baseline → after → diff)
- PARAR se propagação para arquivo não editado

**Fase 3 — Validação global:**
- Zero `concept_id?:` no escopo bank
- TSC final sem novos erros
- Validações de boundary (actor-writer, bank-ledger, regression)

### 24.3 ARQUIVOS EDITADOS

**ESCOPO DIRETO (6):**
1. `bank-transaction.types.ts:97` — `CreateBankTransactionInput` (tipo raiz)
2-6. `bank-transaction.service.ts` — 5 inline types (L860, 912, 1147, 1195, 1436)

**ESCOPO INDIRETO (1):**
7. `bank-ledger.service.ts:65` — `CreateTransactionFromIntentInput` (aprovado explicitamente, DECISION-C2-013)

**PROPAGAÇÃO AUTORIZADA (7 callers):**
8. `payout.service.ts:155` → `'seller-payout-bank-settlement'`
9-12. `validate-financial-flow-real.ts` (3×), `seed-initial-balance.ts`, `verify-simple-tx-double-entry.ts` → `'system-reserve-credit'`
13. `bank-integration.service.ts:513, 871` → `'ride-payment'` (2 ocorrências, DECISION-C2-011)
14. `backfill-payment-splits-to-bank.ts:256` → `'service-booking-payment'` (DECISION-C2-012)

### 24.4 DECISÕES ARQUITETURAIS

**DECISION-C2-011:** bank-integration.service.ts L871 → `'ride-payment'`
- Método `processRidePayment` usa mesmo concept que L513
- Consistência semântica: ambos processam pagamento de corrida

**DECISION-C2-012:** backfill-payment-splits-to-bank.ts → `'service-booking-payment'`
- Script de backfill histórico usa natureza econômica ORIGINAL dos dados
- `metadata.backfill: true` distingue em queries
- Não é emissão de moeda (rejeitado `'system-reserve-credit'`)

**DECISION-C2-013:** bank-ledger.service.ts aprovado como ESCOPO INDIRETO
- Arquivo vive em `modules/bank/`, faz INSERT direto em `bank_transactions`
- Runtime guard existente: "C2: concept_id obrigatório"
- Tipo `CreateTransactionFromIntentInput` deve ser consistente com `CreateBankTransactionInput`

### 24.5 RESULTADOS

**TSC:**
- Baseline: 95 erros (pré-existentes)
- Final: 91 erros (redução de 4 erros corrigidos)
- **Zero novos erros introduzidos**

**Validações de boundary:**
- ✅ actor-writer boundaries: GATE OK
- ✅ bank-ledger boundaries: GATE OK
- ✅ regression guards: GATE OK

**Grep final:**
- Zero `concept_id?:` no escopo bank (modules/bank/, core/economy/)
- 2 union types `concept_id?: string | null` FORA do escopo (canonical-product-db.types.ts, vehicles.service.ts)

### 24.6 PRÓXIMOS PASSOS (C2)

1. **Validação banco:** Confirmar zero NULLs em `bank_transactions.concept_id`
2. **Migration NOT NULL:** `ALTER COLUMN concept_id SET NOT NULL`
3. **C2 FIXED:** Marcar violação como resolvida

### 24.7 LIÇÕES APRENDIDAS

**Propagação em cascata:**
- Tornar campo obrigatório em tipo raiz propaga erros para todos os callers
- 2 rodadas de propagação necessárias (4 callers iniciais + 7 adicionais)
- Decisões semânticas necessárias para cada caller (qual `concept_id` usar)

**Classificação rigorosa:**
- Protocolo TURBO v5 exige classificação ANTES de edição
- ESCOPO INDIRETO requer aprovação explícita (evita edições indevidas)
- Union types (`| null`) automaticamente FORA (não são pattern exato)

**TSC via arquivo:**
- Baseline/after/diff via arquivo evita comparação mental
- Propagação detectada imediatamente via linhas "+"
- Permite rastreamento preciso de novos erros vs pré-existentes

---

**FIM DO DOCUMENTO DE APRENDIZADO**

---

## ATUALIZAÇÃO 2026-04-30 — Sessão G2 PASS + Reconciliação

**IMPORTANTE:** O conteúdo das seções 19, 20.3 e a NOTA FINAL estão desatualizados.
Use as informações abaixo como fonte de verdade para o estado atual.

### Estado confirmado (prevalece sobre seções anteriores deste documento)

**FECHADOS desde 2026-04-26 (data da última atualização deste doc):**
- C2 FIXED COMPLETO (2026-04-28): Passo 3-C concluído, SET NOT NULL aplicado,
  is_nullable=NO confirmado no banco. Gates 4/4 PASS. NÃO há mais bloqueador 3-C.
- C63 FIXED (2026-04-29): schedules/schedule_slots READ-ONLY via REVOKE.
  unified_availability e unified_bookings são os SSOTs temporais ativos.
- G1 FECHADO (2026-04-29): gates actor-writer-boundaries e bank-ledger-boundaries
  adicionados ao CI workflow.
- G2 PIPELINE E2E TRANSVERSAL PASS (2026-04-30, DECISION-0015):
  Modo A A1-A10 todos verdes. Modo B todas falsificacoes rejeitadas. EXIT CODE 0.
  Fluxo validado: RFQ -> Quote -> Accept -> PaymentRequest -> Execution -> Ledger -> Outbox.
- 5 gaps de schema materializados: bank_limit_change_requests, bank_policies,
  bank_transactions.metadata, authority_trust_levels, service_payment_executions.
- Fail-opens financeiros CORRIGIDOS (2026-04-28): 5 locais em bank-integration.service.ts
  convertidos para fail-closed (throw 503 LIMIT_SERVICE_UNAVAILABLE).
- Tabelas fantasma C31-C35 FIXED (2026-04-28): audit_events, webauthn_credentials,
  webauthn_challenges, category_ai_logs, partner_employees criadas via migrations.
- C11, C18, C41, C42 FIXED (2026-04-28).
- C22 ALLOWLISTED: users.id + users.user_id sao identicos por constraint e trigger.

**PRIORIDADE ATUAL (substitui secao 19 e NOTA FINAL):**
1. Implementar gate validate:repository-schema-coherence (DECISION-0015, causa raiz G2)
2. Corrigir 2a ocorrencia slug hardcoded: bank-integration.service.ts:910 (processRidePayment)
3. Criar snapshot formal em docs/99_archive/ para fechar ciclo da remediacao

**NAO fazer agora:**
- PRE (feature nova — bloqueada durante remediacao)
- Compliance regulatorio (trabalho subsequente)
- Nomenclatura EIXO 2-9 (FASE 7)

**Dividas tecnicas registradas em DECISION-0015:**
- amount vs amount_cents em service_payment_executions (divergencia canonica consciente)
- Tabelas auxiliares fail-open: system_notifications, business_audit_logs, authority_delegations
