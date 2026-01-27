# GATE 2 — BLOCKERS DE SSOT (BLOQUEIO ESTRUTURAL)

Este documento ativa formalmente o **Gate 2 — Bloqueio Estrutural** do plano SSOT.

A partir deste ponto, o sistema entra em **modo de contenção**:
- Nenhuma nova violação de SSOT é permitida
- Nenhum código novo pode escrever ou decidir estado fora do Bank
- Nenhuma autoridade implícita pode ser introduzida
- Qualquer exceção implica **FALHA de Gate**

Este arquivo é **normativo e vinculante**.

---

## ESTADO DO GATE

- **Gate:** 2
- **Status:** ATIVO
- **Objetivo:** Impedir novas violações enquanto o legado é removido
- **Escopo:** Backend inteiro
- **Pré-requisito:** Gate 1 (SSOT Registry) FECHADO

---

## PRINCÍPIO ABSOLUTO

> Durante o Gate 2,  
> **não se corrige legado criando novo legado**.

Qualquer atalho introduzido aqui invalida todo o plano.

---

## BLOQUEIOS ATIVOS (OBRIGATÓRIOS)

Enquanto o Gate 2 estiver ativo, é **explicitamente proibido**:

---

### 1. NOVAS ESCRITAS EM ESTRUTURAS PROIBIDAS

Não pode ser introduzido **nenhum código novo** que:

- escreva em tabelas legacy
- atualize saldo fora do `bank_ledger`
- persista estado financeiro fora do Bank
- calcule ou consolide dinheiro fora do Bank

Lista mínima (não exaustiva):

- `accounts`
- `ledger` (legacy)
- `transactions` (legacy)
- `payment_transactions`
- `payment_splits`
- `payment_intent_splits`
- `event_*` financeiros
- `settlements`
- `region_accounts`
- `unifycard_transactions`
- qualquer tabela de saldo fora do `bank_ledger`

Regra:
> **Se não está no SSOT_REGISTRY como writer permitido, é proibido.**

---

### 2. NOVAS LEITURAS DECISÓRIAS DE LEGADO

É proibido adicionar código que:

- use estruturas legacy para **decisão**
- calcule saldo, reputação, liberação ou bloqueio a partir de legado
- trate cache, relatório ou projeção como verdade
- derive estado financeiro sem referência ao Bank

Leitura **somente informativa** é permitida **apenas se**:
- não influencia decisão
- não desbloqueia fluxo
- não altera estado
- não condiciona comportamento financeiro

Regra dura:
> **Leitura que influencia decisão é autoridade implícita — e é proibida.**

---

### 3. CRIAÇÃO DE ATALHOS “TEMPORÁRIOS”

É explicitamente proibido:

- “só por enquanto”
- “depois a gente refatora”
- duplicar estado para ganhar performance
- criar shadow tables, caches ou flags financeiras

Gate 2 existe **exatamente** para impedir isso.

---

## EXCEÇÕES

❌ **Exceções NÃO são permitidas durante o Gate 2.**

Qualquer necessidade de exceção implica:

- FALHA imediata do Gate 2
- Registro obrigatório no `FALSIFICATION_LOG.md`
- Revisão do plano antes de qualquer avanço

Exceção silenciosa = **violação grave de SSOT**.

---

## FISCALIZAÇÃO

Durante o Gate 2:

- Revisão manual é **obrigatória**
- Nenhum PR / commit funcional pode:
  - tocar dinheiro
  - alterar fluxo financeiro
  - introduzir novo writer
  - criar nova decisão implícita

- Testes **também** obedecem estas regras
- Refactors não podem reintroduzir superfícies proibidas

---

## RELAÇÃO COM OUTROS ARTEFATOS

Este Gate é sustentado por:

- `SSOT_REGISTRY.md` — autoridades únicas
- `PROHIBITED_STRUCTURES.md` — o que nunca pode decidir
- `WRITE_SURFACE_BASELINE.md` — evidência antes/depois
- `FALSIFICATION_LOG.md` — registro de tentativas

Violação de qualquer um = violação do Gate 2.

---

## CRITÉRIO DE SAÍDA DO GATE 2 (PASS)

O Gate 2 só pode ser declarado **PASSOU** quando:

- Nenhuma nova violação estrutural é possível
- Escritas proibidas são mecanicamente bloqueadas
- Imports perigosos estão removidos ou inacessíveis
- Guardas de SSOT estão ativos
- `WRITE_SURFACE_BASELINE.md` reflete o estado pós-bloqueio
- Existe evidência verificável (diff, grep, checklist)

Somente após isso:
- Gate 2 pode ser **FECHADO**
- Gate 3 pode prosseguir sem risco de regressão

---

## STATUS

- **Gate 2:** ATIVO (BLOQUEIO ESTRUTURAL EM VIGOR)
- **Gate 3:** FECHADO (remoção de escritas proibidas já executada)
- **Gate 4+:** A VALIDAR

---

## REGRA FINAL

> Durante o Gate 2,  
> **qualquer nova violação invalida o sistema como SSOT-safe.**

Não é bug.  
Não é descuido.  
É **falha de governança**.

---

FIM DO GATE 2 — BLOCKERS DE SSOT
