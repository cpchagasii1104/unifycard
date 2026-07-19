# DECISION-0189B — CONDIÇÕES FINAIS DE SELO YALA (C1–C4 + ISOLAMENTO)

> Adendo terminal da DECISION-0189 / DECISION-0189A. Promulgado por ratificação soberana
> (Clayton, 2026-07-19) para fechar integralmente as condições C1–C4 da última auditoria YALA
> e eliminar a dependência silenciosa de REPEATABLE READ na exclusividade membership×delegação.
> **Docs-only estrito nesta etapa (A): zero código, zero migration, zero schema.** O material
> das decisões abaixo é implementado nas Etapas B–F desta campanha; o selo é da YALA independente
> (a executora NÃO se autossela).

HEAD de promulgação: `6f9e4d969`. Branch: `rescue-structural`.

---

## 1. DECISÕES RATIFICADAS (D1–D8)

### D1 — PORTA 01 permanece FECHADA
Nenhuma operação de **movimentação, captura, payout, pagamento ou criação de split** pode ser
autorizada. O bloqueio é ESTRUTURAL no decisor — nunca dependente de "não há dados" ou "a tabela
não existe".

### D2 — GET /payouts/orders DESATIVADO enquanto PORTA 01 fechada
- NÃO pode listar orders do tenant.
- NÃO pode aceitar ausência de `actorId` como "listar tudo".
- NÃO pode reutilizar `financial:execute_payout` como permissão de LEITURA.
- Resposta uniforme: **HTTP 503 `{ code: 'PORTA_01_CLOSED' }`** (idêntica com e sem `actorId`).
- Abertura futura = OUTRA campanha, com: PermissionKey PRÓPRIA de leitura; filtro obrigatório por
  actor/empresa; recurso resolvido server-side; `view_financial` terminal; audit trail; no-store.

### D3 — HOLD terminal exaustivo (antes de qualquer fallback)
Entram no HOLD terminal, negados ANTES de self/ownership/role/capability/delegation/grants/
canRepresentActor:
- `financial:execute_payout`
- `marketplace_execute_payments`
- `split:create`
- `marketplace_execute_payouts` (já em HOLD — 0189A D7)
- `marketplace_manage_splits` (já em HOLD — 0189A D7)
- `financial:view_all_ledger` (já em HOLD — 0189A D7; leitura consolidada sem atribuição viva)

O inventário (anexo §Matriz) confirma que estas são as ÚNICAS chaves vivas que movimentam,
capturam, pagam, liquidam ou dividem dinheiro. Nenhum alias equivalente adicional foi encontrado
(`manage_financial`/`financial_terms:confirm`/`receive_funds` são gestão/recepção passiva, não
movimento; permanecem fora do HOLD para não bloquear leitura/gestão legítima). Rotas de settlement
e region-account já estão CONTIDAS por 403 hard (sink morto, sem caller vivo) — preservadas.

### D4 — Reactions e comments com autorização EXATA
- PermissionKey: `interact_feed`
- Actor capability: `can_interact_feed`
- Subject grant: `company_users.can_interact_feed`

Política:
- user actor por si → self permitido;
- empresa → membership ATIVA + `can_interact_feed` + capability;
- representante externo → delegação EXPLÍCITA cobrindo `interact_feed`;
- grupos/canais sem substrato → fail-closed;
- `role`, `owner`, `is_primary`, `can_manage_company` e `canRepresentActor` NÃO autorizam.

`can_interact_feed`: TRUE no `GESTOR_INICIAL_PERMISSION_SET`; convidável; delegável; NÃO protegida;
default FALSE para memberships existentes; NUNCA derivada de role ou `can_manage_company`.

### D5 — Reactions/comments autorizam o actor que PRATICARÁ a ação
O post-alvo é carregado server-side. Body/query NÃO troca actor, empresa, tenant ou recurso
autorizado.

### D6 — economic-overview fail-closed em indisponibilidade
- verifica disponibilidade das dependências ANTES da consulta;
- retorna **503 controlado** quando indisponível;
- NUNCA devolve `error.message`, SQLSTATE, SQL ou nome de tabela;
- detalhes internos SOMENTE no log com correlation/request id;
- mantém no-store;
- persiste audit ANTES do disclosure; **falha de audit IMPEDE a resposta financeira**.

### D7 — Invoices explicitamente fechadas enquanto o substrato não existir
A criação futura das tabelas NÃO abre as rotas automaticamente. Existe **porta de ativação
separada, fechada por default**. Ativação futura = nova campanha com fixtures reais não-vazias.
"Schema existe" nunca é, sozinho, autorização.

### D8 — Exclusividade membership×delegação: isolamento fail-closed
- `READ COMMITTED` → suportado com advisory lock + recheck;
- `SERIALIZABLE` → suportado, aceitando serialization failure;
- `REPEATABLE READ` → **rejeitado fail-closed** (exception estável) — o recheck sob snapshot
  congelado do RR não enxerga o COMMIT concorrente, então a exclusividade seria violada
  silenciosamente; a operação deve ABORTAR;
- isolamento desconhecido/não suportado → fail-closed (exception estável).

---

## 2. MAPEAMENTO C1–C4 → D
- **C1 (fechamento financeiro / PORTA 01 sem fresta)** → D1 + D2 + D3.
- **C2 (erros e indisponibilidade sem vazamento; invoices sem abertura automática)** → D6 + D7.
- **C3 (feed interaction exato, sem sombra de representação)** → D4 + D5.
- **C4 (isolamento de exclusividade sem dependência silenciosa de nível)** → D8.

## 3. NÃO-OBJETIVOS (trava de escopo)
- NÃO cria writer financeiro nem religa PORTA 01.
- NÃO edita migration histórica; NÃO reescreve os 13 commits anteriores.
- NÃO fecha DT global de `canRepresentActor` (rotas legitimamente contidas seguem OPEN); apenas
  reactions/comments SAEM do denominador ao ganhar chave exata `interact_feed`.
- NÃO usa "schema-ghost"/"zero linhas" como argumento de segurança em ponto algum.

Anexo de inventário: `docs/04_audit/F_COMPANY_ACCESS_AUTHORITY_FINANCIAL_INVENTORY_2026-07-19.md`.
