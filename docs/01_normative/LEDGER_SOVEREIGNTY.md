# LEDGER SOVEREIGNTY

STATUS: CANÔNICO · VIGENTE · OBRIGATÓRIO

## DECLARAÇÃO

O único ledger financeiro soberano do sistema UnifiCard é:

- Tabela: bank_ledger

## DECISION-0021 — SOBERANIA FORA DE `/core`

`bank_ledger` é o caso canônico de soberania institucional que pode residir fora do diretório físico `/core`.

Sua autoridade não deriva da pasta. Deriva de:
- SSOT declarado;
- writer autorizado;
- enforcement arquitetural;
- impossibilidade de módulos consumidores contradizerem saldo/ledger.

Assim, `modules/bank` pode ser o domínio executor soberano do ledger sem transformar todo Bank em "core físico" nem permitir que outros módulos criem ledgers paralelos.

## DEFINIÇÕES

- bank_ledger:
  - ÚNICO local onde valor financeiro existe
  - Unidade: amount_cents (BIGINT)
  - Sinal definido exclusivamente por direction (credit | debit)
  - Append-only
  - Valor negativo proibido por schema

- bank_transactions:
  - NÃO carrega valor
  - NÃO define saldo
  - NÃO define estado financeiro
  - Atua apenas como âncora de evento/transação

- ledger_entries:
  - NÃO existe no banco real
  - É considerado legado/inválido
  - É proibido criar, usar ou migrar essa estrutura

## PROIBIÇÕES

- É proibido calcular, inferir ou armazenar valor fora de bank_ledger
- É proibido criar novos ledgers paralelos
- É proibido reintroduzir ledger_entries

Esta regra deriva de evidência direta do schema real do Postgres.
Nenhum código pode contradizê-la.

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
_nenhuma referência explícita_

### Referenciado por
- 00_INDEX.md
- 00_SUMARIO.md
<!-- AUTO-GENERATED-END -->
