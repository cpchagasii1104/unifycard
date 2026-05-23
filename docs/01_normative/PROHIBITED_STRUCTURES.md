# PROHIBITED STRUCTURES — SSOT UnifiCard

Este documento lista **estruturas, tabelas, padrões e arquiteturas
explicitamente PROIBIDOS** como fonte de verdade, autoridade de decisão
ou cálculo de estado no sistema UnifiCard.

Qualquer uso fora do permitido aqui é considerado **violação grave de SSOT**
e **violação constitucional de autoridade**.

Este documento:
- complementa o `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md`
- é subordinado à `AUTHORITY_LAW.md`
- é **normativo, vinculante e não interpretável**

---

## PRINCÍPIO FUNDAMENTAL

> Estrutura proibida **pode existir**,  
> mas **nunca pode decidir estado, autoridade ou verdade**.

Uso permitido ≠ uso como fonte de decisão.

Leitura que influencia decisão é **autoridade implícita** — e é proibida.

---

## MINI-CORES CLANDESTINOS (DECISION-0021)

É proibido criar, em qualquer módulo, estrutura que funcione como autoridade local para verdade já soberana em outro domínio.

Exemplos proibidos:
- `rides_location`, `delivery_addresses`, `event_regions` como SSOT territorial paralelo;
- `patient_health_flags` em módulo de saúde como SSOT humano sensível fora do profile/consentimento;
- agenda local por módulo contradizendo Agenda Universal / Unified Availability;
- saldo, carteira ou extrato local contradizendo Bank/ledger;
- árvore semântica local contradizendo CONCEPT / categorias canônicas.

Regra: módulo pode operar workflow, experiência, cache e projeção. Não pode redefinir a verdade compartilhada nem criar writer clandestino.

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

### PADRÃO PROIBIDO: FAIL-OPEN EM GATE DE AUTORIDADE

Um **gate de autoridade** é qualquer ponto de execução que verifica ATL, KYC,
Guardianship ou `authority_roots`, chama `requireFinancialRiskClearance` ou equivalente,
e ocorre **antes** de uma operação financeira irreversível.

**Regra:** todo gate de autoridade opera em modo fail-closed. Ausência de actor,
erro de negócio ou falha de infraestrutura — todos bloqueiam. Nenhum permite continuação.

**Padrão PROIBIDO:**

```typescript
// ❌ fail-open por filtro de erro
try {
  await requireFinancialRiskClearance(...);
} catch (err) {
  if (err.statusCode === 403) throw err;
  console.warn('falhou:', err.message); // operação prossegue
}

// ❌ bypass silencioso por actor ausente
if (fromActorId) {
  await requireFinancialRiskClearance(...);
}
// se fromActorId for null: gate não é chamado
```

**Padrão OBRIGATÓRIO:**

```typescript
// ✅ fail-closed: sem try/catch, sem bypass por null
const actorId = await resolveActorId(...);
if (!actorId) throw Object.assign(new Error('ACTOR_ID_NOT_RESOLVED'), { statusCode: 400 });
await requireFinancialRiskClearance(...);
```

**Tabela de classificação:**

| Posição do catch | Tipo de erro | Ação correta |
|---|---|---|
| Antes de operação irreversível | Qualquer | `throw` |
| Actor não resolvido | null/undefined | `throw` com 400 |
| Em loop de batch, antes de item | Bloqueio explícito de autoridade | `continue` com `console.error` |
| Em loop de batch, antes de item | Erro de infraestrutura | `throw` |
| Depois de operação já commitada | Side-effect | `warn` + continuar |

Referências: `docs/ssot/AUTHORITY_PRECEDENCE.md §2`, `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md`, `docs/ssot/GATE_2_BLOCKERS.md §PRINCÍPIO ABSOLUTO`



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

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- AUTHORITY_LAW.md
- FALSIFICATION_LOG.md
- LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md

### Referenciado por
- 00_AGENT_PROTOCOL.md
- 00_INDEX.md
- 00_SUMARIO.md
- BANK_SEMANTICS.md
- GATES.md
- GATE_2_BLOCKERS.md
- GATE_2_CHECKS.md
<!-- AUTO-GENERATED-END -->
