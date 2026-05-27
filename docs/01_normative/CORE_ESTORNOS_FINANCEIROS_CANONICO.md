Status: SUBORDINATED
Domain: Financial
Governing Contract: CORE_FINANCIAL_CONTRACT.md
# CORE DE ESTORNOS FINANCEIROS CANÔNICO — UNIFICARD

**Status:** IMUTÁVEL  
**Autoridade:** NÍVEL 1 (CORE / LEI DO SISTEMA)  
**Escopo:** Todo o sistema financeiro do UnifiCard  
**Aplicação:** Código, banco, serviços, IAs e decisões humanas  

---

## DEFINIÇÃO ABSOLUTA

O **CORE DE ESTORNOS FINANCEIROS** é a estrutura única, não duplicável e não substituível que define como operações financeiras são revertidas no UnifiCard.

**Estorno financeiro** é a **reversão determinística** de uma transação financeira anterior, seguindo regras canônicas de:
- **Taxonomia**: classificação explícita do tipo de estorno
- **Split reverso**: espelhamento determinístico do split original
- **Autoria obrigatória**: rastreabilidade completa de quem executou
- **Aprovação**: decisão explícita para estornos manuais
- **Separação de domínios**: Core Financeiro vs Escrow

**Regra absoluta:**  
**Nenhum estorno ocorre sem taxonomia explícita.**  
**Nenhum estorno ocorre sem split reverso determinístico.**  
**Nenhum estorno ocorre sem autoria obrigatória.**  
**Nenhum estorno manual ocorre sem aprovação financeira.**  
**Todo estorno é auditável e rastreável.**

---

## 1. ESTADO ATUAL vs MODELO CANÔNICO

### 1.1 Fluxo Atual de `reverseTransaction`

O código atual implementa `reverseTransaction` em `bank-transaction.service.ts` com as seguintes características:

**Fluxo atual:**
1. Busca transação original por `transactionId`
2. Verifica se transação já foi revertida
3. Busca entradas do ledger da transação original
4. Cria nova transação de reversão (`transactionType='reversal'`)
5. Inverte todas as entradas do ledger (débito ↔ crédito)
6. Marca transação original como `status='reversed'`
7. Restaura saldos exatamente como estavam antes da transação original

**Limitações identificadas (gaps):**

1. **Split não é revertido:**
   - O código atual NÃO reverte splits (`bank_splits`)
   - Apenas reverte entradas do ledger
   - Split original permanece intacto, criando inconsistência

2. **Autoria ausente:**
   - `reverseTransaction` não recebe nem persiste `authorship`
   - Não registra `performed_by_user_id`, `acting_for_actor_id`, `acting_for_account_id`
   - Não registra `authority_source`, `permission_snapshot`, `policy_snapshot`
   - Viola o Core de Autoria Financeira

3. **Aprovação ausente:**
   - Estornos manuais não passam pelo Core de Aprovação Financeira
   - Não há verificação de limites ou coleta de aprovações
   - Viola o Core de Aprovação Financeira (Seção 8)

4. **Taxonomia ausente:**
   - Não há classificação explícita do tipo de estorno
   - Todos os estornos são tratados como `transactionType='reversal'`
   - Não distingue entre estorno externo, refund interno, chargeback, etc.

5. **Separação de domínios ausente:**
   - Não distingue entre estornos do Core Financeiro (`bank_transactions`)
   - E refunds de Escrow (`escrow_accounts`, `escrow_transactions`)
   - Mistura responsabilidades

### 1.2 Modelo Canônico (Este Documento)

O modelo canônico define:

1. **Taxonomia explícita**: cada estorno tem tipo canônico definido
2. **Split reverso determinístico**: espelha split original via engine canônico
3. **Autoria obrigatória**: todos os campos de autoria preenchidos
4. **Aprovação para manuais**: estornos manuais passam pelo Core de Aprovação
5. **Separação de domínios**: Core Financeiro vs Escrow claramente separados

**Regra absoluta:**  
**O código atual NÃO é canônico.**  
**Este documento define o modelo canônico obrigatório.**  
**Toda implementação futura DEVE seguir este modelo.**

---

## 2. TAXONOMIA CANÔNICA DE ESTORNOS

### 2.1 Tipos de Estorno

Cada estorno financeiro DEVE ser classificado explicitamente com um dos seguintes tipos:

#### `external_reversal`
- **Significado:** Reversão iniciada por evento externo (gateway, banco, processador)
- **Exemplos:**
  - Chargeback aberto pelo banco
  - Reversão automática por fraude detectada
  - Cancelamento de pagamento pelo gateway
- **Características:**
  - Não requer aprovação financeira (é evento externo)
  - Requer evento explícito (`event_id` obrigatório)
  - `authority_source='system'` (não é ação humana direta)
  - `performed_by_user_id=NULL` (sistema)

#### `internal_refund`
- **Significado:** Reembolso interno iniciado por operador humano
- **Exemplos:**
  - Reembolso de ingresso cancelado
  - Reembolso de serviço não prestado
  - Reembolso de produto devolvido
- **Características:**
  - **SEMPRE requer aprovação financeira** (ver Seção 6)
  - `authority_source IN ('ownership', 'delegation', 'account_acl')`
  - `performed_by_user_id IS NOT NULL` (ação humana)
  - Passa pelo Core de Aprovação Financeira

#### `chargeback_open`
- **Significado:** Chargeback aberto (disputa iniciada)
- **Exemplos:**
  - Cliente abriu disputa no banco
  - Processador notificou chargeback
- **Características:**
  - Não requer aprovação (é evento externo)
  - Requer evento explícito
  - `authority_source='system'`
  - Pode ser revertido se chargeback for ganho (`chargeback_reversed`)

#### `chargeback_lost`
- **Significado:** Chargeback perdido (disputa perdida)
- **Exemplos:**
  - Disputa foi analisada e perdida
  - Banco decidiu contra o comerciante
- **Características:**
  - Não requer aprovação (é evento externo)
  - Requer evento explícito
  - `authority_source='system'`
  - Estorno é definitivo (não pode ser revertido)

#### `chargeback_reversed`
- **Significado:** Chargeback revertido (disputa ganha)
- **Exemplos:**
  - Chargeback foi contestado com sucesso
  - Banco reverteu a decisão
- **Características:**
  - Não requer aprovação (é evento externo)
  - Requer evento explícito
  - `authority_source='system'`
  - Reverte um `chargeback_open` ou `chargeback_lost` anterior

### 2.2 Regra Absoluta de Taxonomia

**Regra absoluta:**  
**Todo estorno DEVE ter tipo canônico explícito.**  
**Não há estorno "genérico" ou "sem tipo".**  
**O tipo determina regras de aprovação, autoria e split.**

---

## 3. SPLIT REVERSO DETERMINÍSTICO

### 3.1 Princípio Fundamental

**Regra absoluta:**  
**Estorno espelha split original determinísticamente.**  
**Split reverso usa engine canônico (`bank-split-engine.service.ts`).**  
**Proibido cálculo manual ou ajuste histórico.**

### 3.2 Fluxo Canônico de Split Reverso

1. **Buscar splits originais:**
   - Buscar todos os `bank_splits` vinculados à transação original
   - Ordenar por `created_at` (ordem original)

2. **Calcular split reverso:**
   - Para cada split original:
     - `target_account_id` reverso = `target_account_id` original
     - `amount` reverso = `-amount` original (inverte sinal)
     - `percentage` reverso = `percentage` original (mantém)
     - `split_type` reverso = `split_type` original (mantém)
   - Usar `bank-split-engine.service.ts` para validar e calcular
   - **NÃO calcular manualmente**
   - **NÃO ajustar percentuais históricos**

3. **Persistir splits reversos:**
   - Criar novos registros em `bank_splits` com:
     - `transaction_id` = ID da transação de reversão
     - `original_split_id` = ID do split original (novo campo, se necessário)
     - Valores invertidos conforme acima
     - **Autoria obrigatória** (ver Seção 5)

### 3.3 Referência ao Core de Split

Este modelo integra com:
- **`CORE_SPLIT_PAGAMENTO_CANONICO.md`**: Engine canônico, estrutura de `bank_splits`, políticas de split

**Regra absoluta:**  
**Nenhum split reverso é calculado fora do `bank-split-engine.service.ts`.**  
**Nenhum split reverso ajusta percentuais históricos.**  
**Split reverso é determinístico e auditável.**

---

## 4. AUTORIA OBRIGATÓRIA

### 4.1 Integração com Core de Autoria

Todo estorno DEVE incluir autoria completa conforme:
- **`CORE_AUTORIA_FINANCEIRA_IMPLEMENTACAO.md`**: Campos obrigatórios, snapshots, trilha de decisão

### 4.2 Campos Obrigatórios

Cada estorno DEVE preencher:

#### `performed_by_user_id`
- **Estorno externo (`external_reversal`, `chargeback_*`):** `NULL` (sistema)
- **Estorno manual (`internal_refund`):** UUID do usuário que executou (obrigatório)

#### `acting_for_actor_id`
- Actor em nome do qual o estorno foi executado
- Geralmente o mesmo da transação original
- Obrigatório (NOT NULL)

#### `acting_for_account_id`
- Conta em nome da qual o estorno foi executado
- Geralmente a conta origem da transação original
- Obrigatório (NOT NULL)

#### `authority_source`
- **Estorno externo:** `'system'` (obrigatório)
- **Estorno manual:** `'ownership'` | `'delegation'` | `'account_acl'` (obrigatório)

#### `permission_snapshot`
- Snapshot da decisão de permissão no momento do estorno
- Obrigatório (NOT NULL)
- Deve capturar `permissionKey`, `allowed`, `reason`, `actorId`, `userId`, `decidedAt`

#### `policy_snapshot`
- Snapshot da resolução de policy no momento do estorno
- Opcional (pode ser NULL se não houver policy específica)
- Deve capturar `policyKeyResolved`, `decidedAt`

### 4.3 Regra Absoluta de Autoria

**Regra absoluta:**  
**Nenhum estorno ocorre sem autoria completa.**  
**Estorno externo usa `authority_source='system'`.**  
**Estorno manual usa `authority_source` baseado em permissão verificada.**  
**Todos os snapshots são obrigatórios.**

---

## 5. INTEGRAÇÃO COM APROVAÇÃO FINANCEIRA

### 5.1 Referência ao Core de Aprovação

Este modelo integra com:
- **`CORE_APROVACAO_FINANCEIRA_CANONICO.md` (Seção 8)**: Estornos externos vs manuais, limites, aprovação múltipla

### 5.2 Estorno Manual → Sempre Aprovação

**Regra absoluta:**  
**Estorno manual (`internal_refund`) SEMPRE passa pelo Core de Aprovação Financeira.**

**Fluxo obrigatório:**
1. Verificar permissão (`authorization.service.canActAs()`)
2. Avaliar limites de estorno (valor, frequência, etc.)
3. Gerar `approval_request` (se necessário)
4. Coletar aprovações (se necessário)
5. Decisão final: `approved` / `rejected` / `expired`
6. **Apenas se `approved`:** executar estorno

**Regra absoluta:**  
**Nenhum estorno manual ocorre sem aprovação explícita.**  
**Aprovação NÃO altera saldo (ocorre antes do estorno).**  
**Aprovação é auditável e rastreável.**

### 5.3 Estorno Externo → Não Requer Aprovação

**Regra absoluta:**  
**Estorno externo (`external_reversal`, `chargeback_*`) NÃO requer aprovação financeira.**

**Características:**
- É evento externo (não é decisão humana)
- Requer `event_id` obrigatório (rastreabilidade do evento)
- `authority_source='system'`
- Não passa pelo Core de Aprovação (é notificação/evento)

**Regra absoluta:**  
**Estorno externo requer evento explícito.**  
**Estorno externo não requer aprovação.**  
**Estorno externo é rastreável via `event_id`.**

---

## 6. SEPARAÇÃO DE DOMÍNIOS

### 6.1 Core Financeiro (bank_transactions)

**Escopo:**
- Estornos de transações do Core Financeiro
- Transações em `bank_transactions`
- Splits em `bank_splits`
- Ledger em `bank_ledger`

**Responsabilidade:**
- Reversão determinística de transações financeiras
- Split reverso via engine canônico
- Autoria obrigatória
- Aprovação para manuais

**Regra absoluta:**  
**Estornos do Core Financeiro usam `bank_transactions`, `bank_splits`, `bank_ledger`.**  
**Nenhum estorno do Core Financeiro usa estruturas de Escrow.**

### 6.2 Escrow (escrow_accounts, escrow_transactions)

**Escopo:**
- Refunds de eventos que usam Escrow
- Transações em `escrow_transactions`
- Contas em `escrow_accounts`

**Responsabilidade:**
- Refunds baseados em milestones de eventos
- Lógica específica de Escrow (não é estorno de transação)
- Pode criar transações no Core Financeiro quando libera fundos

**Regra absoluta:**  
**Refunds de Escrow NÃO são estornos do Core Financeiro.**  
**Escrow tem lógica própria de refund (milestones, acordos).**  
**Escrow pode criar transações no Core Financeiro, mas não reverte transações existentes.**

### 6.3 Regra Absoluta de Separação

**Regra absoluta:**  
**Core Financeiro e Escrow são domínios separados.**  
**Estorno do Core Financeiro reverte transação existente.**  
**Refund de Escrow libera fundos de custódia (não reverte transação).**  
**Nenhuma lógica de Escrow interfere em estornos do Core Financeiro.**

---

## 7. PRINCÍPIOS INQUEBRÁVEIS

### 7.1 Nenhum Estorno Sem Taxonomia

**Regra absoluta:**  
**Todo estorno DEVE ter tipo canônico explícito.**  
**Não há estorno "genérico" ou "sem tipo".**

### 7.2 Nenhum Estorno Sem Split Reverso

**Regra absoluta:**  
**Todo estorno DEVE reverter splits originais determinísticamente.**  
**Split reverso usa engine canônico.**  
**Proibido cálculo manual ou ajuste histórico.**

### 7.3 Nenhum Estorno Sem Autoria

**Regra absoluta:**  
**Todo estorno DEVE incluir autoria completa.**  
**Todos os campos de autoria são obrigatórios.**  
**Snapshots são obrigatórios.**

### 7.4 Nenhum Estorno Manual Sem Aprovação

**Regra absoluta:**  
**Estorno manual SEMPRE passa pelo Core de Aprovação Financeira.**  
**Aprovação ocorre ANTES do estorno.**  
**Aprovação é auditável.**

### 7.5 Separação de Domínios

**Regra absoluta:**  
**Core Financeiro e Escrow são domínios separados.**  
**Estorno do Core Financeiro reverte transação existente.**  
**Refund de Escrow libera fundos de custódia.**

---

## 8. ESTRUTURAS CANÔNICAS

### 8.1 Tabelas Envolvidas

| Tabela | Responsabilidade | Status |
|--------|------------------|--------|
| `bank_transactions` | Transações financeiras (originais e reversões) | CORE |
| `bank_splits` | Splits originais e reversos | CORE |
| `bank_ledger` | Entradas do ledger (originais e reversas) | CORE |
| `approval_requests` | Solicitações de aprovação para estornos manuais | CORE |
| `escrow_accounts` | Contas de custódia (domínio separado) | ESCROW |
| `escrow_transactions` | Transações de custódia (domínio separado) | ESCROW |

### 8.2 Campos Obrigatórios em `bank_transactions`

Para transações de estorno:

- `transaction_type`: `'reversal'` (obrigatório)
- `original_transaction_id`: ID da transação original (obrigatório)
- `reversal_type`: Tipo canônico (`external_reversal`, `internal_refund`, `chargeback_*`) (obrigatório)
- `event_id`: ID do evento externo (obrigatório para estornos externos)
- **Autoria obrigatória:** `performed_by_user_id`, `acting_for_actor_id`, `acting_for_account_id`, `authority_source`, `permission_snapshot`, `policy_snapshot`

### 8.3 Campos Obrigatórios em `bank_splits`

Para splits reversos:

- `transaction_id`: ID da transação de reversão (obrigatório)
- `original_split_id`: ID do split original (recomendado, para rastreabilidade)
- `amount`: Valor invertido (`-amount` original) (obrigatório)
- `percentage`: Percentual original (mantido) (obrigatório)
- `split_type`: Tipo original (mantido) (obrigatório)
- **Autoria obrigatória:** `performed_by_user_id`, `acting_for_actor_id`, `acting_for_account_id`, `authority_source`, `permission_snapshot`, `policy_snapshot`

---

## 9. FLUXO CANÔNICO DE ESTORNO

### 9.1 Estorno Manual (`internal_refund`)

1. **Verificar permissão:**
   - `authorization.service.canActAs(tenantId, userId, actorId, 'financial:execute_refund')`

2. **Avaliar limites:**
   - Valor do estorno
   - Frequência de estornos
   - Políticas de negócio

3. **Gerar aprovação:**
   - Criar `approval_request` (se necessário)
   - Coletar aprovações (se necessário)
   - Aguardar decisão: `approved` / `rejected` / `expired`

4. **Se aprovado:**
   - Buscar transação original
   - Buscar splits originais
   - Calcular split reverso via `bank-split-engine.service.ts`
   - Criar transação de reversão com:
     - `transaction_type='reversal'`
     - `reversal_type='internal_refund'`
     - Autoria completa
   - Criar splits reversos com autoria completa
   - Criar entradas reversas no ledger com autoria completa
   - Marcar transação original como `status='reversed'`

### 9.2 Estorno Externo (`external_reversal`, `chargeback_*`)

1. **Receber evento:**
   - Validar `event_id` (obrigatório)
   - Validar tipo de estorno (`external_reversal`, `chargeback_open`, `chargeback_lost`, `chargeback_reversed`)

2. **Buscar transação original:**
   - Buscar por `transaction_id` ou `event_id` original

3. **Calcular split reverso:**
   - Buscar splits originais
   - Calcular split reverso via `bank-split-engine.service.ts`

4. **Criar estorno:**
   - Criar transação de reversão com:
     - `transaction_type='reversal'`
     - `reversal_type` = tipo canônico
     - `event_id` = ID do evento externo
     - `authority_source='system'`
     - `performed_by_user_id=NULL`
     - Autoria completa (system)
   - Criar splits reversos com autoria completa (system)
   - Criar entradas reversas no ledger com autoria completa (system)
   - Marcar transação original como `status='reversed'`

---

## 10. INVARIANTES ABSOLUTOS

### 10.1 Integridade Financeira

- **Soma zero:** Estorno + Transação Original = Saldo neutro
- **Split espelhado:** Split Reverso = -Split Original (determinístico)
- **Ledger reverso:** Entradas reversas invertem entradas originais

### 10.2 Rastreabilidade

- **Autoria completa:** Todo estorno tem autoria obrigatória
- **Aprovação auditável:** Estornos manuais têm aprovação rastreável
- **Evento externo:** Estornos externos têm `event_id` obrigatório

### 10.3 Separação de Domínios

- **Core Financeiro:** Estornos revertem transações existentes
- **Escrow:** Refunds liberam fundos de custódia (não revertem transações)

---

## 11. PROIBIÇÕES ABSOLUTAS

### 11.1 Proibições de Implementação

- ❌ **NÃO calcular split reverso manualmente**
- ❌ **NÃO ajustar percentuais históricos no split reverso**
- ❌ **NÃO criar estorno sem taxonomia explícita**
- ❌ **NÃO criar estorno sem autoria completa**
- ❌ **NÃO criar estorno manual sem aprovação**
- ❌ **NÃO misturar lógica de Escrow com estornos do Core Financeiro**
- ❌ **NÃO criar estruturas paralelas de estorno**
- ❌ **NÃO inferir tipo de estorno implicitamente**

### 11.2 Proibições de Negócio

- ❌ **NÃO reverter estorno (estorno é definitivo)**
- ❌ **NÃO criar estorno de estorno**
- ❌ **NÃO ajustar valores históricos no estorno**
- ❌ **NÃO criar estorno parcial (estorno é total)**

---

## 12. REFERÊNCIAS CANÔNICAS

Este documento integra com:

1. **`CORE_APROVACAO_FINANCEIRA_CANONICO.md` (Seção 8)**
   - Estornos externos vs manuais
   - Limites de estorno
   - Aprovação múltipla
   - Replicação de split

2. **`CORE_SPLIT_PAGAMENTO_CANONICO.md`**
   - Engine canônico (`bank-split-engine.service.ts`)
   - Estrutura de `bank_splits`
   - Políticas de split
   - Split reverso determinístico

3. **`CORE_AUTORIA_FINANCEIRA_IMPLEMENTACAO.md`**
   - Campos obrigatórios de autoria
   - Snapshots de permissão e política
   - Trilha de decisão
   - `authority_source` canônico

---

## 13. ENCERRAMENTO

O Core de Estornos Financeiros está **HARDENED** e **IMUTÁVEL**.

**Regra absoluta:**  
**Nenhum estorno ocorre sem seguir este modelo canônico.**  
**Nenhuma exceção é permitida.**  
**Nenhum "atalho técnico" é aceito.**

Qualquer mudança futura:
- Exige alteração explícita deste documento
- Exige decisão institucional
- Exige auditoria formal

Sem isso, a resposta é sempre a mesma:  
**BLOQUEADO.**

---

**Status:** IMUTÁVEL  
**Autoridade:** NÍVEL 1 (CORE / LEI DO SISTEMA)  
**Última atualização:** 2026-05-27 (DECISION-0052)
**Versão:** 1.1

---

## 14. DECISION-0052 — F-REFUND SPLIT-AWARE HARDENING (2026-05-27)

**Contexto.** Em 2026-05-27 a auditoria de estorno do motor existente (`reversal.service.ts` +
`reversal.repository.ts`, do Prompt 51) revelou que o motor JÁ é split-aware desde a sua origem
(`bankSplitRepository.loadSplitLegsForReversal` lê os splits da transação original e cada um vira
uma transferência reversa independente). Portanto, **PE-5 não criou bomba escondida**: o motor já
devolve linha por linha. O que faltava era **etiqueta, assinatura e câmera de segurança** — taxonomia
canônica de tipo de estorno, autoria forte e rastreabilidade do `original_split_id` em cada leg
reversa. Essa decisão fecha esses três pontos e deixa explicitamente para frentes futuras os blocos
de aprovação (Bloco C — requer raio-x do Core de Aprovação Financeira) e segregação `escrow_refunds`
(Bloco F — fora de escopo desta fatia).

### 14.1 Taxonomia canônica de `reversal_type`

Coluna `reversals.reversal_type` (NOT NULL) com CHECK Postgres restringindo a 5 valores:

| valor | semântica | origem | exige `performed_by_user_id`? |
|---|---|---|---|
| `external_reversal` | gateway externo iniciou (PIX devolvido, cartão estornado) | sistêmico | **NÃO** (CHECK bloqueia) |
| `internal_refund` | operador humano da plataforma decidiu refund manual | humano | **SIM** (CHECK bloqueia se NULL) |
| `chargeback_open` | disputa externa aberta (estado contábil intermediário) | sistêmico | NÃO |
| `chargeback_lost` | chargeback perdido (estorno definitivo) | sistêmico | NÃO |
| `chargeback_reversed` | chargeback revertido pela plataforma | sistêmico | NÃO |

CHECKs Postgres garantem invariante mesmo se aplicação for desviada:
- `chk_reversal_type_canonical` — só valores canônicos.
- `chk_internal_refund_requires_user` — `internal_refund` exige `performed_by_user_id` NOT NULL.
- `chk_external_reversal_is_systemic` — `external_reversal` / `chargeback_*` rejeitam `performed_by_user_id`.

### 14.2 Autoria forte (`performed_by_user_id` + `authority_source`)

- `reversals.performed_by_user_id` (UUID, FK `users.user_id`, ON DELETE RESTRICT): NULL para
  sistêmicos, NOT NULL para `internal_refund`. Permite responder "quem foi a pessoa real que
  apertou o botão" em todo estorno manual.
- `reversals.authority_source` (TEXT, CHECK opcional): valores canônicos
  `system` / `ownership` / `delegation` / `account_acl`. Documenta de qual cadeia institucional
  veio a autoridade declarada (compatível com Core de Permissões Financeiras §authority).
- Defesa em camadas: além do CHECK Postgres, `createReversalRequest` lança erro explícito em TS
  (`INTERNAL_REFUND_REQUIRES_PERFORMED_BY_USER` / `SYSTEMIC_REVERSAL_REJECTS_USER`) para mensagem
  amigável antes do banco.

### 14.3 Rastreabilidade `original_split_id` em cada leg

Para cada split original, o motor executa um `transfer` independente do destino para o pagador.
`bank_transactions.metadata` da leg reversa recebe (via UPDATE explícito após `transfer`, porque
`bankTransactionService.transfer` não propaga metadata para `bank_transactions`):

```json
{
  "reversal_id": "<uuid do reversals.id>",
  "original_transaction_id": "<uuid da tx original>",
  "original_split_id": "<uuid do bank_splits.id daquela leg>"
}
```

Linkage também canonicalizado em `bank_transactions.reference_id` via
`uuidv5(reversalId:splitId, REVERSAL_LEG_NAMESPACE)` (determinístico — permite reidempotência
material além da textual). Audit trail de §10.1.2 fica satisfeita.

### 14.4 Idempotência preservada

`requestAndExecuteReversalSync` continua idempotente: 2ª chamada com mesmo `originalTransactionId`
retorna os mesmos `reversal_transaction_ids` sem duplicar legs. Comportamento já existente — agora
validado por E2E.

### 14.5 Fora de escopo desta DECISION

- **Bloco C — approval gate para `internal_refund`.** Foi explicitamente adiado: exige raio-x prévio
  do Core de Aprovação Financeira (CORE_APROVACAO_FINANCEIRA_CANONICO) para decidir se aprovação é
  síncrona/assíncrona, quem é o aprovador canônico, quais limites de valor disparam dupla aprovação.
  Frente futura.
- **Bloco F — segregação `escrow_refunds` vs `reversals`.** Estorno após D-money (revenue_share já
  liberado para `actor_wallet`) tem fluxo material distinto: drena pool de escrow de outros pagamentos
  e deixa wallet do worker com saldo indevido. Rastreado em **DT-PE5-REFUND-POST-DMONEY-CHAIN**.
  Frente futura.

### 14.6 Evidência canônica

- Migration: `backend/migrations/20260530568000_reversals_taxonomy_and_authorship.sql`
- E2E (9 cenários verdes): `backend/src/scripts/validate-pipeline-e2e-refund-split-aware.ts`
  - T1: pagamento PE-5 multi-split + estorno antes D-money (3 legs corretas).
  - T2: `original_split_id` presente em metadata de cada leg.
  - T3: cada leg devolve exatamente seu valor original (net-zero por canal).
  - T4: `reversal_type=external_reversal` + idempotência.
  - T5/T6: CHECK Postgres bloqueia combinações inválidas.
  - T7: TS guard lança erro amigável antes do banco.
  - T8: outbox `payment_intent.status='reversed'` com metadata completa.
  - T9: REMOVIDO (não determinístico — disparava ACTOR_RISK_BLOCKED por anomalia colateral);
        limite material rastreado em DT-PE5-REFUND-POST-DMONEY-CHAIN.

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- CORE_APROVACAO_FINANCEIRA_CANONICO.md
- CORE_FINANCIAL_CONTRACT.md
- CORE_SPLIT_PAGAMENTO_CANONICO.md

### Referenciado por
- 00_INDEX.md
- 00_SUMARIO.md
- CORE_FINANCIAL_CONTRACT.md
- HARDENING_CYCLE_CLOSURE.md
<!-- AUTO-GENERATED-END -->