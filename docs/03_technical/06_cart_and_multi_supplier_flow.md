# FASE 5 — CART & MULTI-SUPPLIER FLOW
## Carrinho e Contratação com Múltiplos Fornecedores

**Status:** FASE 5 (Exploração estruturada)  
**Autoridade:** NÃO CANÔNICO · NÃO EXECUTÁVEL · NÃO DECISÓRIO  

Este documento define **como orçamentos de múltiplos fornecedores**
podem ser aceitos ou recusados individualmente e **como isso compõe o carrinho**
sem misturar planejamento com execução ou transação financeira.

---

## PRINCÍPIO FUNDAMENTAL

> **Evento organiza contexto.  
> Proposta é a unidade contratável.  
> Carrinho agrupa decisões.  
> Transação executa compromisso.**

Misturar essas camadas é violação de arquitetura.

---

## ENTIDADES ENVOLVIDAS

### Event (Planejamento)
- `event_ticket`
- `project_name`
- `lifecycle_stage = INTENT_DRAFT | READY_FOR_CONTRACT`

O evento **não é** item de venda.

---

### Proposal (Orçamento / Proposta)
- `proposal_id`
- `supplier_id`
- `scope` (ex: brinquedos, mesas, DJ)
- `value`
- `event_ticket`

📌 **Proposal é a menor unidade contratável do sistema.**

---

### Cart (Carrinho)
- `cart_id`
- lista de `proposal_id`
- `event_ticket`

📌 Carrinho **não cria obrigação** até confirmação explícita.

---

### Transaction (Transação)
- `transaction_id`
- `proposal_id`
- `supplier_id`
- `event_ticket`

📌 Cada transação é:
- independente
- auditável
- rastreável

---

## FLUXO OPERACIONAL (PASSO A PASSO)

### 1️⃣ Recebimento de Orçamentos

Evento `EVT-001` recebe:

- `P-10` → Locação de brinquedos
- `P-11` → Locação de mesas
- `P-12` → DJ

Nenhuma decisão existe nesse momento.

---

### 2️⃣ Decisão Granular (Humana)

O organizador decide individualmente:

- ❌ Recusar `P-10` (brinquedos)
- ✅ Aceitar `P-11` (mesas)
- ✅ Aceitar `P-12` (DJ)

📌 Aceitação é **ato explícito** do usuário.

---

### 3️⃣ Montagem do Carrinho

O sistema cria um carrinho **somente com propostas aceitas**:

```text
Cart CHK-77
- P-11 (mesas)
- P-12 (DJ)

Contexto:
event_ticket = EVT-001
📌 O ticket entra como contexto, não como item.

4️⃣ Confirmação de Contratação
Usuário clica em “Confirmar contratação”.

Neste momento:

nasce o compromisso

nasce a execução

5️⃣ Geração de Transações
O sistema cria uma transação por proposta:

text
Copiar código
TX-201 → P-11 (mesas)
TX-202 → P-12 (DJ)
Cada transação:

pertence a um fornecedor

pode ter pagamento, cancelamento ou reembolso próprios

O QUE NÃO ACONTECE (EXPLICITAMENTE PROIBIDO)
❌ Não existe “transação do evento”
❌ Não existe “contratação obrigatória em bloco”
❌ Não existe pagamento único forçado
❌ Não existe carrinho com itens implícitos
❌ Ticket nunca vira pedido

BENEFÍCIOS DO MODELO
Contratação parcial é natural

Fornecedores não se misturam

Reembolso por item é possível

Escala para eventos grandes

Jurídico protegido

Contabilidade limpa

REGRA FINAL (INQUEBRÁVEL)
Se não houver aceitação explícita,
não existe transação.

O ticket conecta tudo,
mas não executa nada sozinho.