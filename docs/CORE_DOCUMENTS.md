# Documentos núcleo — ponto de ancoragem

**Começar aqui** ao orientar agentes, revisores ou novos membros; depois seguir as ligações — não o contrário.

**Finalidade:** evitar que orientações se percam entre muitos ficheiros. Documentos novos ou guias longos devem **ligar explicitamente** a pelo menos um destes núcleos (ou a um documento que por sua vez os referencie).

**Regra:** não duplicar norma; **apontar** para o núcleo e acrescentar só o específico do tema.

---

## 1. Constituição do sistema (SSOT e identidade)

| Documento | Uso |
|-----------|-----|
| [`01_normative/01_SSOT.md`](./01_normative/01_SSOT.md) | Fontes de verdade por domínio; o que é proibido duplicar. |
| [`01_normative/SSOT_REGISTRY_UNIFICARD.md`](./01_normative/SSOT_REGISTRY_UNIFICARD.md) | Registo operacional de SSOT (bank, ledger, payments, identity, …). Inclui **DOCUMENTAÇÃO ÚNICA** para dinheiro, centavos e ledger (não contradizer noutros READMEs). |
| [`01_normative/INVARIANTES_OPERACIONAIS_LEDGER.md`](./01_normative/INVARIANTES_OPERACIONAIS_LEDGER.md) | Par obrigatório com o registo: invariantes físico vs. financeiro. |
| [`01_normative/CORE_FINANCIAL_CONTRACT.md`](./01_normative/CORE_FINANCIAL_CONTRACT.md) | Contrato financeiro core (alinhado a PR checklist e SSOT bank). |

---

## 2. Nomenclatura e governança de CI/CD

| Documento | Uso |
|-----------|-----|
| [`01_normative/07_NOMENCLATURA_CANONICA.md`](./01_normative/07_NOMENCLATURA_CANONICA.md) | Lei única de nomes; **§17.6** (gates de auditoria: artefatos e nomes); **§17.6.1** (fronteira financeira / ledger). |

---

## 3. Gates de auditoria estrutural (PR / diffs)

| Documento | Uso |
|-----------|-----|
| [`04_audit/GATES.md`](./04_audit/GATES.md) | Índice de todos os gates; ponte para norma §17.6. |
| [`04_audit/MARKETPLACE_ORDER_BOUNDARIES_AUDIT_GATE.md`](./04_audit/MARKETPLACE_ORDER_BOUNDARIES_AUDIT_GATE.md) | Pedido / estoque / PDV — funil `order.service`. |
| [`04_audit/PAYMENTS_LEDGER_BOUNDARIES_AUDIT_GATE.md`](./04_audit/PAYMENTS_LEDGER_BOUNDARIES_AUDIT_GATE.md) | Ledger / autoridade financeira — `bankTransactionService` e allowlist (rascunho até decisão formal). |

---

## 4. Protocolo de agentes e execução (quando aplicável)

| Documento | Uso |
|-----------|-----|
| [`01_normative/00_AGENT_PROTOCOL.md`](./01_normative/00_AGENT_PROTOCOL.md) | Regras para agentes/CI que operam sobre o repo. |

---

## 5. Mapa de relações (resumo)

```text
01_SSOT + SSOT_REGISTRY  →  o que é verdade por domínio
07_NOMENCLATURA          →  nomes + §17.6 / §17.6.1 (gates)
04_audit/GATES + *GATE  →  como validar PRs sem regressão estrutural
```

---

## 5.1 PDV e pedidos HTTP — **fonte única** (runtime)

| Superfície | Papel |
|------------|--------|
| **`POST /pdv/*`** (`backend/src/modules/pdv/`) | PDV canónico: sessão + criação de pedido via **`order.service`** → **PostgreSQL**. |
| **`POST /marketplace/orders`** (e rotas de itens / fluxo em `marketplace-orders.routes.ts`) | Pedidos marketplace canónicos: **`order.service`** → **PostgreSQL**. |
| **`POST /marketplace/pdv/order`**, **`/marketplace/pdv/customer`** | **Removidos.** Resposta **410 Gone** com corpo explicativo — não usar; não há variante em memória exposta. |

**Nota:** `MarketplaceOrdersModule` (Map) pode ainda existir para **dependências internas** (ex. dispatch) até refatoração; **não** é entrada HTTP suportada para PDV.

---

## 6. Manutenção

- Ao criar um gate novo: seguir §17.6; registar em `04_audit/GATES.md`; não criar norma paralela com outro nome.
- Ao adicionar um “documento mestre” novo: **atualizar esta lista** ou justificar por que não é núcleo.
