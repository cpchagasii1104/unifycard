# PROHIBITED STRUCTURES — SSOT UnifiCard

Este documento lista **estruturas, tabelas, padrões e arquiteturas
explicitamente PROIBIDOS** como fonte de verdade, autoridade de decisão
ou cálculo de estado no sistema UnifiCard.

Qualquer uso fora do permitido aqui é considerado **violação grave de SSOT**
e **violação constitucional de autoridade**.

Este documento:
- complementa o `SSOT_REGISTRY.md`
- é subordinado à `AUTHORITY_LAW.md`
- é **normativo, vinculante e não interpretável**

---

## PRINCÍPIO FUNDAMENTAL

> Estrutura proibida **pode existir**,  
> mas **nunca pode decidir estado, autoridade ou verdade**.

Uso permitido ≠ uso como fonte de decisão.

Leitura que influencia decisão é **autoridade implícita** — e é proibida.

---

## ESTRUTURAS FINANCEIRAS PROIBIDAS (LEGACY)

As estruturas abaixo **NUNCA** podem:
- decidir saldo
- calcular estado financeiro
- ser tratadas como autoridade final
- reconstruir verdade contábil
- decidir quitação, dívida ou disponibilidade

### Tabelas proibidas

- `accounts`
- `ledger` (legacy)
- `transactions` (legacy)
- `region_accounts`
- `wallets` (se existir)
- qualquer tabela de saldo fora de `bank_ledger`
- `cached_balances` fora de `bank_accounts`

Uso permitido:
- histórico
- visualização
- debug
- migração assistida **temporária e documentada**

Uso proibido:
- decisão
- cálculo
- consolidação
- autoridade implícita ou explícita

---

## ESTRUTURAS DE PAGAMENTO NÃO-CANÔNICAS

Estas estruturas **NÃO SÃO SSOT** e **NÃO PODEM** decidir dinheiro:

- `payment_transactions`
- `payment_splits`
- `payment_intent_splits`
- `settlements`
- `payout_transactions`
- `escrow_transactions`
- `unifycard_transactions`

Uso permitido:
- logs operacionais
- integração com adquirentes
- rastreabilidade técnica
- conciliação informativa

Uso proibido:
- cálculo de saldo
- split final
- decisão financeira
- marcação de estado final (`PAID`, `SETTLED`, `COMPLETED`)

---

## ESTRUTURAS DECLARATIVAS / INTERMEDIÁRIAS (NÃO-SSOT)

Estas estruturas **NUNCA** decidem dinheiro nem autoridade:

- `event_split_declarative`
- `event_refund`
- `event_chargeback`
- `service_payment_requests`
- `service_payment_executions`
- `payment_intents` (pré-financeiro)

Uso permitido:
- intenção
- orquestração
- workflow
- pré-financeiro
- notificação

Uso proibido:
- autoridade financeira
- substituição de ledger
- persistência de verdade contábil
- inferência de saldo, quitação ou responsabilidade econômica

---

## ESTRUTURAS DE AUTORIDADE PROIBIDAS (NOVO — CRÍTICO)

As estruturas abaixo **NUNCA** podem decidir autoridade,
responsabilidade ou poder de ação:

### ❌ Proibições absolutas

- Flags booleanas de poder (`is_admin`, `is_owner`, `is_superuser`)
- Enums de status como fonte de autoridade
- Campos derivados usados como decisão (`role`, `tier`, `plan`)
- Permissões sem:
  - tempo
  - escopo
  - contexto
- Autoridade inferida de:
  - posse de entidade
  - vínculo técnico
  - existência de relacionamento
- “Admin global” implícito
- Overrides emergenciais sem trilha normativa

> Autoridade **não emerge de estrutura**.  
> Autoridade **deriva de Lei + Ator Humano**.

---

## PADRÕES DE CÓDIGO PROIBIDOS

Os seguintes padrões são **explicitamente proibidos**:

- Atualizar saldo fora do `bank_ledger`
- Calcular saldo a partir de estruturas proibidas
- Tratar `cached_balance` como verdade
- JOINs em tabelas proibidas para **decisão**
- Persistir “estado final” em repositório de negócio
- Recalcular split fora do Bank
- Aritmética financeira fora do domínio bancário
- Decisão de autoridade baseada em:
  - flags
  - enums
  - roles
  - claims soltos

---

## LEITURA DECISÓRIA PROIBIDA

É proibido:
- Tomar decisão com base em estruturas proibidas
- Usar dados legacy para:
  - liberar pagamento
  - bloquear conta
  - concluir evento financeiro
  - computar reputação financeira
  - decidir acesso ou benefício econômico
  - decidir autoridade ou permissão

Regra dura:
> **Leitura que influencia decisão é autoridade implícita — e é proibida.**

---

## EXCEÇÕES CONTROLADAS (RARAS)

Exceções **SÓ EXISTEM** se **TODOS** os critérios forem atendidos:

1. Documentadas em `FALSIFICATION_LOG.md`
2. Aprovadas por **Gate de Autoridade Constitucional**
3. Com **prazo de expiração definido**
4. Sem impacto em:
   - decisão financeira final
   - decisão de autoridade
   - ATL, KYC ou Guarda

Exceção sem prazo = **violação estrutural**.

---

## FISCALIZAÇÃO

- Novo uso de estrutura proibida:
  - **FAIL automático** de Gate
  - correção imediata obrigatória
- Refactors **não podem** reintroduzir uso proibido
- Testes **também** obedecem estas regras
- Ambiguidade é tratada como violação

---

## STATUS DE GATES

- **Gate 1:** PROIBIÇÕES DECLARADAS — CONCLUÍDO
- **Gate 2:** BLOQUEIO EM CÓDIGO — A EXECUTAR
- **Gate 3:** REMOÇÃO DE USO — A EXECUTAR

---

FIM DO PROHIBITED STRUCTURES — SSOT UNIFICARD
