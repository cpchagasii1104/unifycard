# Decisão — Duas tabelas de discrepância (convergência futura)

**Status:** vigente  
**Data:** 2026-03-17

## Situação

| Tabela | Origem | Uso |
|--------|--------|-----|
| `reconciliation_discrepancies` | Migration **0026** (legado) | Tipos `gateway` \| `bank` \| `settlement`; fluxo manual / gateway vs banco |
| `reconciliation_ledger_discrepancies` | Migration **0053** (Prompt 52) | Tipos `ledger_mismatch` \| `account_mismatch` \| `orphan_*`; amarrado a `reconciliation_runs` |

Coexistência é **aceitável temporariamente**; não há colisão de nomes nem de PK.

## Regra canônica (bank-core / constitucional)

- **SSOT de diagnóstico ledger ↔ transações ↔ contas:** `reconciliation_runs` + `reconciliation_ledger_discrepancies`.
- **Legado 0026:** continua válido apenas enquanto existirem consumidores que gravam/leem `reconciliation_discrepancies` (gateway, settlement, etc.).

## Regra futura (obrigatória na próxima fase de reconciliação)

1. **Inventariar** todos os writes/reads em `reconciliation_discrepancies`.
2. **Convergir** para um dos caminhos:
   - **A)** Estender o modelo Prompt 52 (tipos + metadados JSONB) e **migrar dados** legados → descontinuar gravação na tabela antiga; ou
   - **B)** Manter duas famílias com **nomes explícitos** (ex.: renomear legado para `reconciliation_gateway_discrepancies`) e documentar fronteiras.
3. **Descontinuar** a tabela não escolhida após janela de leitura (dump/archive opcional).

Até lá: **não** misturar os dois modelos na mesma UI/API sem prefixar origem (`engine: prompt_52` vs `engine: legacy_0026`).

## Referências

- `backend/migrations/0026_reconciliation_discrepancies.sql`
- `backend/migrations/0053_reconciliation_engine.sql`
- `backend/migrations/0055_reconciliation_discrepancies_legacy_marker.sql` (COMMENTS no schema)
