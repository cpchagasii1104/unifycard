# DECOMPOSIÇÃO DAS 1928 VIOLAÇÕES DO GATE `schema-coherence`

**Produzido pela DIREÇÃO em 2026-07-30, por medição de 1ª mão** contra o `unificard_dev` e o
JSON `docs/_reports/schema-coherence-violations-2026-07-30.json` (commit `01c54f53e`).

> **Por que este arquivo existe:** o número "1928 violações" paralisou a decisão de religar o
> gate por semanas, porque ninguém sabia do que ele era feito — o gate escondia a própria
> lista. Com a lista aberta, o número se decompõe em **um evento histórico** e três resíduos.
> **Não são 136 problemas. É um só, com cauda longa.**

## O corte, número a número

| bucket | ocorrências | o que é |
|---|---|---|
| Harnesses (`backend/src/scripts/`) | **1173** | Não é superfície de escrita viva. **Medido, não decidido** — excluir diretório por nome muda o que o gate significa. Campo `inScripts` existe para isso. |
| 🔴 **Código órfão do `REBASE-03`** | **591** | 136 nomes cujas tabelas estão definidas nas **313 migrations arquivadas**. Ver abaixo. |
| `C13` + `C3` (fronteira de módulo) | **41** | `bank_splits` 11 · `bank_transactions` 10 · `bank_ledger` 6 · `bank_settlements` 6 · `bank_accounts` 4 · `actors` 4. **As tabelas EXISTEM** — o defeito é o acesso fora do módulo. **Dívida já catalogada**, dono Clayton, prazo 2026-09-30. |
| Bugs de parser ainda no gate | **~25** | Funções SQL chamadas via `FROM` (`unnest`, `fn_grant_actor_capability`, `fn_revoke_actor_capability_grant`, `get_user_permissions`, `detect_availability_conflicts`, `rides_find_nearby_drivers`, `rides_calculate_realtime_earnings`, `rides_check_driving_limit`, `rides_calculate_zone_pressure`) e palavras-chave/aliases (`lateral`, `now`, `public`, `created_at`, `u`, `com`). **Terceira classe de bug do próprio gate**, depois de catálogo do sistema e alias de CTE. |
| **Genuinamente sem explicação** | **~49** | ~19 nomes: `reports` 7 · `accounts` 5 · `risk_flags` 4 · `payment_intent_splits` 3 · `payout_transactions` 3 · `media_context_dimension_norm` 2 · `report_events` 2 · `transactions` 1 · e tabelas `rides_*` que **não** estão no arquivo. |

⚠️ O campo `type` do JSON vale `table` para **todos** os 706 fora de harnesses — ele **não
distingue motivo**. A separação entre "tabela fantasma" e "fronteira de módulo" foi feita
pela direção consultando `information_schema` nome a nome. Quem for usar o JSON precisa
refazer esse cruzamento, não confiar no `type`.

## 🔴 A raiz: `[REBASE-03] Fechamento Constitucional`

```
commit 705792271   Clayton Pereira Chagas   2026-02-11 23:58:18 -0300
[REBASE-03] Fechamento Constitucional
```

Esse commit **criou** `backend/migrations_archive/` com **313 arquivos `.sql`** — todos
versionados, nenhum aplicado. É a terceira reconstrução do sistema, a que produziu a tag
`GENESIS_CONSTITUCIONAL_v1`. Hoje o conjunto vivo tem 549 migrations.

**O schema foi reconstruído; o código que usava o schema antigo ficou onde estava.** Daí
os 591: `rides_*`, `organization_*`, `payout_orders`, `notify_queue`,
`user_group_allocations`, `cultural_*`, `human_mvp_*`, `pilot_*`, `loyalty_*`,
`user_memory_*`, `observability_*` e mais.

**Isso NÃO é 136 dívidas. É uma decisão de fevereiro cuja cauda nunca foi varrida.**

## O que já foi contido — e prova que o padrão existe

`docs/03_execution_log/20260616_F_ORGANIZATION_SCHEMA_GHOST_FAIL_CLOSED_CONTAINMENT.md`
(2026-06-16) tratou exatamente disto para `organization_*`: constatou *"zero `CREATE TABLE`
… organization_invites/members/units/roles"*, provou `to_regclass=NULL` em DB efêmera FULL,
registrou que *"toda rota emitiria 42P01"*, e marcou **`organization_members` como TOMBSTONE
conhecido** (`DECISION_0131_AUTHORITY_GRAMMAR.md:137`), com guard
`audit-rbac-stub-and-tombstones.mjs`.

🔴 **Ou seja: parte da cauda JÁ foi contida com rito próprio, e parte não.** A pergunta certa
não é *"o que fazer com 136 tabelas"* — é **"quais dos 136 já têm contenção/tombstone e quais
estão nus"**. É pergunta de inventário documental, não de arquitetura.

## Ordem recomendada pela direção

1. **Mapa de cobertura da cauda do REBASE-03** (read-only, instância DOCUMENTOS): cruzar os
   136 nomes contra os documentos de encerramento/contenção existentes. Converte 591 em
   *"já decidido"* × *"nunca contido"*.
2. **Terceira classe de bug do parser** (~25): mesma natureza objetiva das duas já
   consertadas em `01c54f53e`. Fatia pequena.
3. **Os ~49 sem explicação**: só depois de 1 e 2, quando for a única coisa que sobrou.

⛔ **NÃO religar o gate no runner antes de 1 e 2.** Com 1802 vermelhos, ele entra como guard
permanentemente vermelho — a armadilha que a própria Yala tem no mandato para caçar.

⚠️ Lembrete de ordem geral: **ninguém encosta na FASE 6 do RBAC** antes de a cauda estar
mapeada — o `RETURN FALSE` de `actor_has_permission` mascara 176 chamadas em 44 arquivos de
rota, e pelo menos uma escreve em tabela que não existe. Ver
`PAINEL_DIVIDA_VIVA.md`.
