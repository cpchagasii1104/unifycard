# GATES

Registro de gates de validação estrutural.

**Índice de documentos núcleo (ancoragem):** [`docs/CORE_DOCUMENTS.md`](../CORE_DOCUMENTS.md)

**Nomenclatura e ciclo de vida:** `docs/01_normative/07_NOMENCLATURA_CANONICA.md` — §17.6.

Gates de **ledger / fronteira financeira** (quando existirem): §17.6.1 — allowlist derivada do mapa real de writers; não apenas exclusão por ficheiro único.

| Gate | Descrição |
|------|-----------|
| [Marketplace — bordas pedido/estoque/PDV](./MARKETPLACE_ORDER_BOUNDARIES_AUDIT_GATE.md) | Diff/PR: sem bypass de `order.service`, variant explícita, idempotência, compat de API |
| [Payments — ledger / autoridade financeira](./PAYMENTS_LEDGER_BOUNDARIES_AUDIT_GATE.md) | Norma + allowlist (rascunho); `bankTransactionService` e caminhos canónicos; §17.6.1 |
