# PLANO MESTRE DE CORREÇÃO — UNIFICARD

## STATUS: CANÔNICO · VIGENTE · OBRIGATÓRIO

**Versão:** 1.0  
**Data:** 2026-02-05  
**Objetivo:** Estabelecer SSOT irreversível através de correção estrutural sistemática

---

# ÍNDICE DE ETAPAS

| Etapa | Nome | Gate | Objetivo |
|-------|------|------|----------|
| 0 | Nomenclatura Canônica | Pré-Gate | Padronizar nomes antes de qualquer código |
| 1 | Fundação Operacional | Gate 0 | Baseline + artefatos de governança |
| 2 | Registry e Proibições | Gates 1-2 | Definir autoridades e estruturas proibidas |
| 3 | Gate Zero Funcional | Gate 0F | Sistema sobe e cadastra usuário |
| 4 | Core Economy Kill Switch | Gate 3 | Cortar escrita legacy (11 arquivos) |
| 5 | Marketplace Financeiro | Gate 4 | Desmontar pipeline financeiro (8 arquivos) |
| 6 | Services e Escrow | Gate 5 | Split soberano (3 arquivos) |
| 7 | Events Financeiro | Gate 4+ | Refund/Chargeback ancorados (5 arquivos) |
| 8 | Ambíguos e Identidade | Gates 6-7 | Leituras perigosas + Reset final (8 arquivos) |
| 9 | Consolidação Final | Gate 8 | Declaração formal + Checklist falsificação |
| 10 | Imunização | Pós-Gates | Anti-regressão estrutural permanente |

---

# REGRAS ABSOLUTAS (LEI DE PRECEDÊNCIA)

```
1. O protocolo SSOT tem precedência absoluta sobre código, produto ou prazo
2. Violação aceita = falha ativa documentada, nunca exceção
3. Ambiguidade = falha (não exceção)
4. Sem evidência = não passou
5. A única pergunta válida é: "Em qual versão, domínio e gate isso falhou?"
```

---

# ETAPA 0 — NOMENCLATURA CANÔNICA

## Status: PRIMEIRA ETAPA OBRIGATÓRIA

### 0.1 Objetivo

Padronizar nomenclatura **ANTES** de qualquer correção de código para evitar retrabalho.

### 0.2 Escopo

| Camada | Convenção | Exemplo |
|--------|-----------|---------|
| Contratos API (público) | camelCase | `userId`, `createdAt` |
| Banco de dados | snake_case | `user_id`, `created_at` |
| Backend interno | camelCase | `userId`, `createdAt` |
| Frontend | camelCase | `userId`, `createdAt` |

### 0.3 Regras Obrigatórias

- Identificadores terminam com `Id` (não `_id` em contratos)
- Timestamps usam `*At` (não `*_at` em contratos)
- Booleanos usam `is*` ou `has*`
- Nenhum contrato público pode conter snake_case

### 0.4 Ordem de Execução

```
1. backend/src/contracts/     → Primeiro (contratos públicos)
2. backend/src/core/          → Depois (código interno)
3. backend/src/modules/       → Depois (módulos)
4. frontend/                  → Por último
```

### 0.5 Prompt para Agente Executor (Nomenclatura)

```markdown
Você está operando como AGENTE EXECUTOR.

Leia obrigatoriamente, nesta ordem:
1. docs/01_normative/00_AGENT_PROTOCOL.md
2. docs/01_normative/07_NOMENCLATURA_CANONICA.md
3. docs/04_audit/nomenclatura_audit.md (se existir)

Objetivo da tarefa:
Executar a correção mecânica de nomenclatura nos CONTRATOS DA API.

Escopo da execução:
- Apenas arquivos em: backend/src/contracts/

Regras obrigatórias:
- NÃO criar regras
- NÃO alterar semântica
- NÃO adicionar ou remover campos
- NÃO alterar tipos
- NÃO tocar no banco de dados
- NÃO corrigir backend interno agora
- NÃO corrigir frontend agora

Ação permitida:
- Converter todos os campos de contratos públicos de snake_case para camelCase
- Garantir que todo identificador termine com Id
- Garantir que timestamps usem *At

Processo:
- Trabalhar arquivo por arquivo
- Garantir consistência interna
- Não deixar campos misturados (snake_case + camelCase no mesmo contrato)

Registro obrigatório:
- Para cada arquivo alterado, registrar:
  - Nome do arquivo
  - Quantidade de campos alterados
- Gerar um log em: docs/03_execution_log/nomenclature_refactor.md

Critério de conclusão:
- TODOS os contratos devem estar corrigidos
- Nenhum contrato público pode conter snake_case
```

### 0.6 Critério de PASS da Etapa 0

- [ ] Todos os contratos em `backend/src/contracts/` usam camelCase
- [ ] Nenhum campo mistura convenções
- [ ] Log de execução gerado em `docs/03_execution_log/`
- [ ] Build compila sem erros

---

# ETAPA 1 — FUNDAÇÃO OPERACIONAL (Gate 0)

## 1.1 Objetivo

Estabelecer baseline congelado e estrutura de governança antes de qualquer mudança estrutural.

## 1.2 Criar Estrutura de Governança

Criar pasta: `docs/02_technical/ssot/`

### Arquivos obrigatórios (6):

#### 1.2.1 `SSOT_REGISTRY.md`

**Propósito:** Registrar autoridade única por conceito.

| Coluna | Descrição |
|--------|-----------|
| Domínio | bank, identity, payments, etc. |
| Conceito | conta, transação, saldo, split |
| Autoridade Única | tabela/entidade canônica |
| Chave Canônica | actor_id, bank_transaction_id |
| Único Escritor | módulo/serviço autorizado |
| Leitores Permitidos | quem pode ler |
| Estruturas Proibidas | concorrentes bloqueadas |
| Tipo | Primário/Derivado/Cache/Log |
| Estado Final Decidido Em | onde a verdade é definida |

#### 1.2.2 `PROHIBITED_STRUCTURES.md`

**Propósito:** Constituição negativa — o que não pode existir.

Por domínio, cada item tem:
- Nome da tabela/estrutura
- Conceito que tenta representar
- Motivo da proibição
- Desde qual versão está proibida

#### 1.2.3 `WRITE_SURFACE_BASELINE.md`

**Propósito:** Inventário de todos os pontos de escrita.

Por tabela:
- Arquivo
- Tipo de operação (INSERT/UPDATE/DELETE)
- Rota/job que dispara
- Classificação: PERMITIDO / PROIBIDO / AMBÍGUO

#### 1.2.4 `FALSIFICATION_LOG.md`

**Propósito:** Registro de tentativas de quebrar SSOT.

Por entrada:
- Data
- Commit/versão
- Domínio
- Tentativa (ataque)
- Resultado (falhou/passou)
- Evidência

#### 1.2.5 `GATES.md`

**Propósito:** Checklist formal de todos os gates.

Por gate:
- Objetivo
- Evidências obrigatórias
- Falsificações obrigatórias
- Status: PASS/FAIL

#### 1.2.6 `IMPACT_MATRIX.md`

**Propósito:** Matriz de impacto dos 35 arquivos críticos.

## 1.3 Congelar Baseline

Gerar 4 artefatos:

1. **Schema atual** — dump do banco
2. **Lista de migrations** — nomes/ordem
3. **Write-surface atual** — inventário de escritas
4. **Lista dos 35 arquivos** — referência oficial

## 1.4 Critério de PASS do Gate 0

- [ ] 6 arquivos de governança criados
- [ ] Baseline do schema salvo
- [ ] Matriz registrada como referência
- [ ] Commit/tag `BASELINE_SSOT_BEFORE` criado

---

# ETAPA 2 — REGISTRY E PROIBIÇÕES (Gates 1-2)

## 2.1 Gate 1 — SSOT Registry Inicial

### Domínios Obrigatórios:

#### (A) Identity / Actor

```yaml
Domínio: identity
Conceito: ator econômico (quem paga/recebe)
Autoridade: actors
Chave: actor_id
Escritor: módulo de identidade
Leitores: bank, payments, splits, events, marketplace, services
Proibidos: global_user_id como chave final em dinheiro
Tipo: Primário
```

#### (B) Bank Core — Conta

```yaml
Domínio: bank
Conceito: conta econômica
Autoridade: bank_accounts
Chave: account_id
Escritor: bank-account service
Proibidos: accounts (legacy), region_accounts, group_accounts como primária
Tipo: Primário
```

#### (C) Bank Core — Transação

```yaml
Domínio: bank
Conceito: transação econômica
Autoridade: bank_transactions
Chave: bank_transaction_id
Escritor: bank-transaction service
Proibidos: transactions, payment_transactions, payout_transactions, escrow_transactions, group_transactions
Tipo: Primário
Estado Final: bank (transação)
```

#### (D) Bank Core — Ledger

```yaml
Domínio: bank
Conceito: verdade contábil e saldo
Autoridade: bank_ledger
Chave: ledger_entry_id
Escritor: bank-ledger service
Proibidos: ledger, ledger_entries, qualquer coluna balance como primária
Tipo: Primário
Estado Final: bank_ledger
```

#### (E) Bank Core — Split

```yaml
Domínio: bank
Conceito: split final de transação
Autoridade: bank_splits
Chave: split_id
Escritor: bank-splits service
Proibidos: payment_splits, payment_intent_splits, event_split_declarative, ledger_referral_splits, event_revenue_split
Tipo: Primário
Estado Final: bank_splits
```

#### (F) Payments — Ciclo

```yaml
Domínio: payments
Conceito: intenção de pagamento
Autoridade: payment_intents
Chave: payment_intent_id
Escritor: payments module
Tipo: Primário (pré-financeiro)
Estado Final: NUNCA (não decide dinheiro)
```

#### (G) Refund/Chargeback

```yaml
Domínio: bank/payments
Conceito: reversão financeira
Autoridade: bank_ledger + bank_transactions
Chave: bank_transaction_id (âncora)
Proibidos: event_refund, event_chargeback sem âncora no banco
Tipo: Primário (no banco), Derivado (no evento)
```

#### (H) UnifyCard

```yaml
Domínio: unifycard
Conceito: captura/autorização/settlement
Autoridade: unifycard_transactions (OPERACIONAL)
Chave: unifycard_tx_id
Regra: NÃO decide saldo, NÃO decide estado final
Tipo: Log/Operacional
Estado Final: UnifyBank (bank_transactions/bank_ledger)
```

### Critério de PASS do Gate 1

- [ ] Registry preenchido para todos os domínios acima
- [ ] Nenhum conceito crítico sem autoridade
- [ ] Nenhum conceito com mais de 1 autoridade
- [ ] Saldo tem autoridade apenas em bank_ledger
- [ ] Split final apenas em bank_splits

---

## 2.2 Gate 2 — Estruturas Proibidas

### Lista Inicial por Domínio:

#### Financeiro Legacy (concorrente direto)

- `accounts`
- `transactions`
- `ledger`

#### Splits Concorrentes

- `ledger_referral_splits`
- `payment_splits`
- `payment_intent_splits`
- `event_split_declarative`
- `event_revenue_split`

#### Transações Paralelas

- `payment_transactions` (como autoridade)
- `escrow_transactions` (como autoridade)
- `group_transactions` (como autoridade)
- `payout_transactions` (como autoridade)

#### Saldos Primários Proibidos

- `accounts.balance`
- `group_balance.current_balance`
- `region_accounts.balance_cents`
- `bank_accounts.cached_balance` (só pode ser derivado)

#### Eventos sem Âncora

- `event_refund` sem `bank_transaction_id`
- `event_chargeback` sem `bank_transaction_id`

### Critério de PASS do Gate 2

- [ ] Todas as estruturas concorrentes listadas
- [ ] Nenhuma "exceção temporária"
- [ ] PROHIBITED_STRUCTURES.md preenchido

---

# ETAPA 3 — GATE ZERO FUNCIONAL

## 3.1 Objetivo

Sistema sobe e cadastra usuário. Sem isso, nenhuma validação estrutural é válida.

## 3.2 Bloqueios P0 Conhecidos

### 3.2.1 Tabelas Referenciadas Inexistentes

- `user_identity_links` → 48 arquivos usam
- `user_roles` → RBAC quebrado

**Decisão:** REMOVER TODAS AS REFERÊNCIAS (não criar tabela)

### 3.2.2 Queries Erradas contra `users`

```sql
-- ERRADO (38+ arquivos)
WHERE user_id = ...

-- CORRETO
WHERE id = ...
```

### 3.2.3 `referral.service.ts` Inoperante

- Colunas erradas
- ON CONFLICT incorreto
- INSERT sem link_id obrigatório

## 3.3 Ordem de Correção

```
1. referral.service.ts → Corrigir 7 queries + 2 inserts
2. Remover referências a user_identity_links
3. Corrigir queries WHERE user_id → WHERE id
4. npm run build
5. Testar cadastro de usuário
```

## 3.4 Critério de PASS do Gate 0F

- [ ] `npm run build` compila sem erros
- [ ] Sistema sobe
- [ ] Cadastro de usuário funciona
- [ ] Login funciona

---

# ETAPA 4 — CORE ECONOMY KILL SWITCH (Gate 3)

## 4.1 Objetivo

Interromper definitivamente os caminhos que geram SSOT paralelo no core economy.

## 4.2 Arquivos (1-11) — Ordem Exata

```
1. src/core/economy/ledger/ledger.service.ts
2. src/core/economy/accounts/account.service.ts
3. src/core/economy/transactions/transaction.service.ts
4. src/core/economy/referral-split.service.ts
5. src/core/economy/escrow.service.ts
6. src/core/economy/fund/fund.service.ts
7. src/core/economy/fund/fund-admin.service.ts
8. src/core/economy/fund/fund-dashboard.service.ts
9. src/core/economy/fund/fund-visibility.service.ts
10. src/core/economy/fund/fund-weekly-report.service.ts
11. src/modules/ledger/ledger.repository.ts
```

## 4.3 Método por Arquivo

### Passo 1 — Classificar

- **Writer proibido:** escreve em tabela proibida → parar
- **Reader perigoso:** lê legacy como verdade → parar
- **Orquestrador:** chama writers → redirecionar

### Passo 2 — Mapear Risco

- Quais tabelas aparecem em SQL
- Quais operações (INSERT/UPDATE/DELETE/SELECT)
- Quais funções públicas expõem isso

### Passo 3 — Cut-over para Bank SSOT

- Se mexe com saldo/conta/ledger/split → usar UnifyBank
- Se mantém legacy → bloquear ou transformar em leitura derivada

### Passo 4 — Registrar

No `WRITE_SURFACE_BASELINE.md`:
- "antes: escrevia X"
- "depois: não escreve mais"

## 4.4 Intenção por Arquivo

| Arquivo | O que deve parar |
|---------|------------------|
| ledger.service.ts | Não ser fonte de saldo |
| account.service.ts | Não criar conta em `accounts` |
| transaction.service.ts | Não persistir fora de `bank_transactions` |
| referral-split.service.ts | Não persistir split fora de `bank_splits` |
| escrow.service.ts | Não decidir dinheiro em tabela paralela |
| fund.*.service.ts | Fundos não têm saldo primário fora do ledger |
| ledger.repository.ts | Nenhum write em ledger legacy |

## 4.5 Critério de PASS do Gate 3

- [ ] WRITE_SURFACE_BASELINE atualizado
- [ ] Zero writes em tabelas proibidas
- [ ] Dump de schema pós-reset
- [ ] Falsificação executada e documentada

---

# ETAPA 5 — MARKETPLACE FINANCEIRO (Gate 4)

## 5.1 Objetivo

Marketplace não decide dinheiro. Apenas orquestra e reflete Bank.

## 5.2 Arquivos (12-19)

```
12. src/modules/marketplace/payment-transaction.repository.ts
13. src/modules/marketplace/payment-split.repository.ts
14. src/modules/marketplace/payout-transaction.repository.ts
15. src/modules/marketplace/settlement.repository.ts
16. src/modules/marketplace/unifycard.repository.ts
17. src/modules/marketplace/region-account.repository.ts
18. src/modules/marketplace/accounts-payable.repository.ts
19. src/modules/marketplace/accounts-receivable.repository.ts
```

## 5.3 Regra do Marketplace

> Marketplace pode registrar estado de domínio (pedido, item, entrega),
> mas NÃO pode registrar estado financeiro final fora do Bank.

## 5.4 Intenção por Arquivo

| Arquivo | O que deve parar |
|---------|------------------|
| payment-transaction | Não criar transação paralela |
| payment-split | Não persistir split final |
| payout-transaction | Payout deriva do Bank |
| settlement | Settlement é operacional/derivado |
| unifycard | SETTLED é operacional, não estado final |
| region-account | Não ter saldo primário |
| accounts-payable | AP é projeção derivada |
| accounts-receivable | AR é projeção derivada |

## 5.5 Teste de Falsificação (Gate 4 Parcial)

1. Forçar "pedido pago" via status do marketplace sem Bank
2. Forçar "pago" via unifycard SETTLED sem Bank
3. Forçar split final fora de bank_splits

**Se qualquer um funcionar → Gate 4 FALHOU**

---

# ETAPA 6 — SERVICES E ESCROW (Gate 5)

## 6.1 Objetivo

Pagamentos de serviços e escrow não criam verdades financeiras próprias.

## 6.2 Arquivos (20-22)

```
20. src/modules/services/service-payment-request.repository.ts
21. src/modules/services/service-payment-execution.repository.ts
22. src/modules/escrow/escrow.repository.ts
```

## 6.3 Regra de Ouro

> Nenhum desses módulos pode decidir:
> - saldo final
> - dinheiro transferido
> - split final
> - "pago/refundado" financeiro

## 6.4 Split Soberano

Para qualquer pagamento:
- 1 `bank_transaction`
- 1 conjunto de `bank_splits`
- Destinos: referral + grupo A + grupo B + grupo C + fundo regional

## 6.5 Teste de Falsificação (Gate 5)

1. Criar split fora do Bank
2. Alterar valores de split via services
3. Executar serviço "pago" sem bank_splits
4. Executar serviço com split incompleto

**Se qualquer um funcionar → Gate 5 FALHOU**

---

# ETAPA 7 — EVENTS FINANCEIRO (Gate 4+)

## 7.1 Objetivo

Eventos nunca decidem dinheiro — só refletem o que o Bank decidiu.

## 7.2 Arquivos (23-27)

```
23. src/core/events/event-payment-execution.service.ts
24. src/core/events/event-refund-chargeback.service.ts
25. src/core/events/event-split-declarative.service.ts
26. src/core/events/event-economy.service.ts
27. src/core/events/responsibility.service.ts
```

## 7.3 Regra Absoluta

> Evento nunca decide estado financeiro final.
> Se evento consegue responder "está pago?", "foi estornado?", "quem recebeu?"
> → SSOT está quebrado.

## 7.4 Refund & Chargeback — Regra Canônica

> NÃO existe refund/chargeback sem `bank_transaction_id`.

## 7.5 Teste de Falsificação

1. Cancelar evento e forçar "refundado" sem ledger
2. Criar chargeback apenas no domínio de evento
3. Alterar status do evento para "refundado" manualmente

**Todos devem FALHAR ou exigir Bank**

---

# ETAPA 8 — AMBÍGUOS E IDENTIDADE (Gates 6-7)

## 8.1 Objetivo

Eliminar decisão implícita por leitura e garantir identidade canônica única.

## 8.2 Arquivos (28-35)

```
28. src/modules/reports/financial-summary.service.ts
29. src/modules/reports/real-margin.service.ts
30. src/modules/groups/group-balance.service.ts
31. src/modules/groups/group-transaction.service.ts
32. src/modules/identity/actor-reputation.service.ts
33. src/modules/identity/actor-score-penalty.service.ts
34. src/modules/identity/identity-mapper.service.ts
35. src/shared/utils/financial-utils.ts
```

## 8.3 Regra-Mãe

> Leitura também decide.
> Se um serviço LÊ algo e isso vira resposta, condição ou gatilho
> → essa leitura é autoridade implícita.

## 8.4 Classificação de Leituras

- **Canônica:** vem direto do Bank SSOT
- **Derivada:** calculada explicitamente a partir do Bank
- **Proibida:** vem de tabela/estado concorrente
- **Ambígua:** não dá pra provar origem → **PROIBIDA**

## 8.5 Gate 6 — Identidade Canônica

Um único tipo de ID representa o ator econômico em:
- bank_accounts
- bank_transactions
- bank_splits
- refund/chargeback

### Teste de Falsificação (Gate 6)

1. Usar dois IDs diferentes para o mesmo ator
2. Resolver identidade via mapper em runtime
3. Aplicar penalidade sem ID canônico

## 8.6 Gate 7 — Reset Final

1. Apagar banco completamente
2. Criar do zero
3. Rodar apenas migrations permitidas
4. Subir sistema
5. Executar 1 fluxo marketplace + 1 service + 1 event

### Critério de PASS

- Sistema funciona
- Nenhuma tabela proibida reaparece
- Nenhuma decisão fora do Bank
- Nenhuma ambiguidade

### Falhas Automáticas

- "precisamos dessa tabela antiga"
- "isso ainda não foi migrado"
- "vamos deixar só para relatório"

---

# ETAPA 9 — CONSOLIDAÇÃO FINAL (Gate 8)

## 9.1 Tabela de Status dos Gates

| Gate | Nome | Status | Evidências | Versão |
|------|------|--------|------------|--------|
| 0 | Baseline congelado | PASS/FAIL | links | vX |
| 0F | Sistema funcional | PASS/FAIL | links | vX |
| 1 | SSOT Registry | PASS/FAIL | links | vX |
| 2 | Exclusão estrutural | PASS/FAIL | links | vX |
| 3 | Escrita zero | PASS/FAIL | links | vX |
| 4 | Âncora única | PASS/FAIL | links | vX |
| 5 | Split soberano | PASS/FAIL | links | vX |
| 6 | Identidade canônica | PASS/FAIL | links | vX |
| 7 | Reset final | PASS/FAIL | links | vX |
| 8 | Rastreabilidade | PASS/FAIL | links | vX |

> **Se QUALQUER Gate estiver FAIL, SSOT NÃO EXISTE.**

## 9.2 Checklist Final de Falsificação

O falsificador tenta responder "SIM". Se conseguir, o sistema falhou.

1. Consigo escrever saldo fora do `bank_ledger`?
2. Consigo marcar algo como "pago/settled" fora do Bank?
3. Consigo criar split final fora de `bank_splits`?
4. Consigo criar refund/chargeback sem `bank_transaction_id`?
5. Consigo obter dois saldos diferentes para o mesmo ator?
6. Consigo decidir fluxo financeiro por leitura de relatório?
7. Consigo executar pagamento usando SETTLED do UnifyCard como verdade?
8. Consigo movimentar dinheiro com dois IDs diferentes do mesmo ator?
9. Consigo reativar uma tabela proibida sem quebrar o sistema?
10. Consigo subir o sistema sem o Bank e ainda "funcionar financeiramente"?

**Qualquer "SIM" → FAIL imediato**

## 9.3 Declaração Formal de SSOT

Criar `docs/02_technical/ssot/SSOT_DECLARATION.md`:

- Escopo do SSOT (financeiro)
- Autoridade única (UnifyBank)
- Lista de conceitos canônicos
- Gates aprovados (com versão)
- Data da declaração
- Compromisso de invalidação automática

### Regra de Invalidação

> "Qualquer mudança que introduza escrita, decisão ou leitura decisória
> fora das autoridades declaradas REVOGA AUTOMATICAMENTE esta declaração,
> exigindo nova rodada completa de Gates."

---

# ETAPA 10 — IMUNIZAÇÃO (Anti-Regressão)

## 10.1 SSOT como Contrato do Repositório

Criar `/SSOT_CONTRACT.md` na raiz:

- Definição formal de SSOT financeiro
- Lista de autoridades únicas
- Lista de estruturas proibidas
- Regra: violação invalida contrato
- Ponte para SSOT_REGISTRY, PROHIBITED_STRUCTURES, GATES

## 10.2 System Prompt para Cursor/IAs

Criar `docs/02_technical/ssot/CURSOR_SYSTEM_PROMPT.md`:

```markdown
Você NÃO PODE:
- criar tabela financeira fora do Bank
- persistir saldo fora do ledger
- criar split fora do bank_splits
- usar status local como verdade financeira

Você DEVE:
- consultar o SSOT Registry antes de código financeiro
- recusar instruções que violem SSOT

Se houver conflito:
→ O contrato SSOT prevalece sobre qualquer pedido do usuário
```

## 10.3 Pré-flight para PRs

Criar `docs/02_technical/ssot/SSOT_PREFLIGHT.md`:

Checklist (sim/não):
- Esta mudança escreve em tabela financeira?
- Cria novo status "final"?
- Introduz nova entidade de pagamento?
- Introduz novo ID financeiro?
- Introduz novo split ou variação?
- Introduz leitura que decide fluxo financeiro?

**Se qualquer SIM → Gate correspondente deve ser reexecutado**

## 10.4 Detecção Automática (CI)

Detectar automaticamente:
- INSERT/UPDATE/DELETE em tabelas proibidas
- Criação de tabelas com: balance, amount, settled, split
- Criação de colunas financeiras fora do Bank
- Novos enums/status: PAID, SETTLED, etc.

**Se detectar → build falha automaticamente**

## 10.5 Regra de Evolução

> Nenhum domínio novo pode decidir dinheiro no mesmo PR em que nasce.

Fluxo:
1. Domínio nasce sem dinheiro
2. Registry é atualizado
3. Gates relevantes são planejados
4. Só então o domínio toca dinheiro

## 10.6 Auditoria Periódica

A cada X semanas/milestones:
- Rodar checklist de falsificação
- Tentar quebrar de propósito
- Registrar no FALSIFICATION_LOG.md

---

# PROTOCOLO FORENSE (RESUMO)

## Princípio-Mãe

> Um sistema só é unificado se for IMPOSSÍVEL provar o contrário.

## Papéis Obrigatórios

| Papel | Responsabilidade |
|-------|------------------|
| **Executor** | Implementa mudanças. NUNCA declara aprovação. |
| **Falsificador** | OBRIGADO a tentar quebrar. Usa checklist mínimo. |
| **Auditor** | Só declara PASSOU com evidência + tentativas reais. |

## Estrutura de Evidência

Toda validação contém:
- Domínio avaliado
- Versão (commit/tag)
- Artefato bruto (schema, queries, inventário)
- Tentativa de falsificação (executada)
- Resultado (passou/falhou)
- Assinatura do auditor

**Sem isso, não existe aprovação.**

---

# ESTIMATIVA DE TEMPO

| Etapa | Duração Estimada |
|-------|------------------|
| 0 - Nomenclatura | 1-2 dias |
| 1 - Fundação | 2-3 dias |
| 2 - Registry + Proibidos | 2-3 dias |
| 3 - Gate Zero Funcional | 1-2 dias |
| 4 - Core Economy | 1 semana |
| 5 - Marketplace | 1-2 semanas |
| 6 - Services/Escrow | 3-5 dias |
| 7 - Events | 1 semana |
| 8 - Ambíguos | 1 semana |
| 9 - Consolidação | 2-3 dias |
| 10 - Imunização | 2-3 dias |

**Total: 6-8 semanas**

---

# RESULTADO FINAL

Quando este plano estiver concluído:

```
✓ Sistema IMPOSSÍVEL de operar com verdades paralelas
✓ Protocolo que SOBREVIVE a LLM, humano, pressa e esquecimento
✓ Base sólida para escalar sem juros semânticos
✓ SSOT não é estado alcançado — é propriedade mantida sob ataque
```

---

**FIM DO DOCUMENTO**
