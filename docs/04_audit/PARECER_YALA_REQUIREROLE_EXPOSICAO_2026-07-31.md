# PARECER YALA — MEDIÇÃO DE EXPOSIÇÃO DE `requireRole` · 2026-07-31

**Auditora:** YALA (independente) · **Modo:** guardião, read-only.
**Origem:** achado lateral meu de 2026-07-30. O selo `df8045a11` declara que **não cobre**
`requireRole` — logo este caminho de autoridade nunca foi medido.
**Banco de TODAS as provas: `unificard_dev`** (banco oficial; `backend/.env`).
**Método:** execução real da função SQL (3 cenários) + leitura das rotas + queries de estado.

---

## 🟢 NÃO HÁ ESCALADA NEM VAZAMENTO — NÃO ESCALEI, E EXPLICO POR QUÊ

O mandato manda parar e escalar se houver (a) vazamento cross-tenant ou (b) concessão viva
alcançando dinheiro fora da PORTA-01. **Executei os dois testes e nenhum se confirmou como
explorável hoje.** Resumo antes do detalhe, para não inflar:

| pergunta | resposta medida |
|---|---|
| `actor_has_any_role` concede? | **SIM** — `t` para o par real (provado por execução) |
| respeita tenant? | **SIM** — `f` cross-tenant (provado) |
| PORTA_HOLD alcança `requireRole`? | **NÃO** — lacuna estrutural real |
| existe rota HTTP viva para conceder a role? | **NÃO** — a rota de grant é gated por `requirePermission` (deny-all) |
| quantos portadores? | **1** (Clayton, no tenant dele) |
| alguma rota move dinheiro real? | **NÃO** — a única que escreve no Bank é pinada em moeda `TEST` |

---

## 1 · O QUE AS ROTAS EXPÕEM (inventário, não amostra)

Corrigindo meu próprio número de 2026-07-30: eu disse "10 rotas usando `requireRole`" — o certo é
**9 arquivos de rota, ~40 rotas**. (Os outros 7 arquivos que casam o grep são **comentários** ou o
próprio plugin.) Inventário completo, ESCRITA marcada, e o eixo sensível:

| arquivo | rotas | tipo | eixo sensível |
|---|---|---|---|
| `core/identity/identity.routes.ts` (1174→1554) | **14** — KYB PJ: cria pedido, aprova/rejeita, registra/revisa/supersede documento, fila `pending`, **download do arquivo** (`/pj/kyb/documents/:id/file`) | 9 ESCRITA · 5 leitura | 🔴 **IDENTIDADE** (documento fiscal PJ, dado sensível) |
| `core/companies/companies.routes.ts` (795→1072) | **6** — fila de documentos, muda status de documento, **`POST /:companyId/admin/override-verified`**, submit-validation, fila de validação, review | 4 ESCRITA · 2 leitura | 🔴 **IDENTIDADE/AUTORIDADE** (override de verificação) |
| `core/catalog/catalog-governance.routes.ts` (224→393) | **8** — fila de curadoria + aprovar/rejeitar produto e serviço canônico | 7 ESCRITA · 1 leitura | catálogo (plataforma-wide) |
| `core/catalog/category-review.routes.ts` (17,53,93) | **3** — fila + aprovar/rejeitar categoria | 2 ESCRITA · 1 leitura | catálogo |
| `core/categories/categories.routes.ts` (64,146) | **2** — escrita em árvore de categorias | 2 ESCRITA | catálogo (Lei 7) |
| `core/categories/ssot-admin.routes.ts` (22) | **1** — leitura admin de SSOT | leitura | — |
| `core/media-assets/media-assets.routes.ts` (116,133,156) | **3** — attach/detach canônico de mídia | 3 ESCRITA | catálogo |
| 🔴 `core/unifybank/test-currency.routes.ts` (46,124) | **2** — `POST /admin/test-currency/emit`, `GET /admin/test-currency/ledger` | 1 ESCRITA · 1 leitura | 🔴 **DINHEIRO** (escreve no Bank) |
| `modules/economy/policy-engine/economic-policy-admin.routes.ts` (112) | **4** (gate único `adminGate`) — vocabulário, listagem, **`POST /admin/policies`**, **`/admin/policies/:id/activate`** | 2 ESCRITA · 2 leitura | 🔴 **DINHEIRO (configuração)** |

**O que um portador da role `admin` consegue hoje:** aprovar/rejeitar KYB de PJ e **baixar
documento fiscal**; **marcar empresa como verificada por override**; governar catálogo canônico e
árvore de categorias da plataforma inteira; **criar e ativar versão de policy econômica** (os
percentuais do split); e **emitir saldo** no Bank em moeda `TEST`.

---

## 2 · QUEM TEM O PAPEL — e o caminho de concessão

**Medido (`unificard_dev`):** `user_roles` tem **1 linha**.
- usuário `9305ac13-…` = **`cpchagasii@hotmail.com` (Clayton)**, tenant `a3859c3e-…`
  ("Comunidade Inicial Unificard").
- role **`admin`** (`603b44d9-…`, `is_system_role=true`), atribuída em **2026-07-27 21:18:57**,
  **`assigned_by` = NULL** (concedida por script, não por ato humano rastreável em HTTP —
  provavelmente `scripts/grant-admin-role-to-real-account.ts`, que usa o writer governado).
- Existem 4 roles no tenant (`admin`, `manager`, `merchant`, `user`); **só `admin` tem portador**.

**Caminho de escalada — FECHADO no HTTP (PROVADO).** Existe rota viva de concessão
(`core/rbac/role.routes.ts:155` → `assignRoleToUser`), **mas ela é gated por
`fastify.requirePermission(['roles:assign'])`** (`:161`) → `actor_has_permission` → `RETURN FALSE`
→ **403 sempre**. Idem `roles:create`/`update`/`delete`/`read`. **Nenhum admin consegue criar outro
admin pela API.** As únicas vias são `INSERT` direto no banco ou rodar script com credencial de
banco — isto é, quem já tem o banco. **Não é auto-concessão; é privilégio semeado fora da
aplicação.** Grau: PROVADO.

---

## 3 · `actor_has_any_role` RESPEITA TENANT — **SIM** (executado, não lido)

Definição viva (`pg_get_functiondef`): `SECURITY DEFINER`, `JOIN user_roles ur … AND
ur.tenant_id = p_tenant_id`, `WHERE a.actor_id = p_actor_id AND a.tenant_id = p_tenant_id`.
**Dupla ancoragem de tenant** (no actor e no vínculo). Execuções reais:

```
actor_has_any_role(tenant_real,  actor_de_Clayton, {admin}) → t   ← CONCEDE
actor_has_any_role(OUTRO_tenant, actor_de_Clayton, {admin}) → f   ← tenant-scoped
actor_has_any_role(tenant_real,  actor_de_Clayton, {owner}) → f   ← papel inexistente
actor_has_permission(tenant_real, actor_de_Clayton, admin, view_consolidated_balance) → f
```
A última linha é o contraste que fecha a tese: **mesmo actor, mesmo tenant — a função de ROLE
concede, a de PERMISSION nega.** O `t` é a prova de que este caminho é vivo e concessivo.
**Não há vazamento cross-tenant. NÃO escalei porque não há o que escalar aqui.**

⚠️ Resíduo teórico (SUSPEITO, não explorável hoje): o `JOIN roles r ON ur.role_id = r.role_id`
**não filtra `r.tenant_id`**. Uma linha de `user_roles` do tenant A apontando para uma `roles` do
tenant B chamada `admin` casaria. A FK (`user_roles_role_id_fkey`) **não impede** isso — não é
composta por tenant. Hoje só existe um tenant com roles, então é inexplorável; num cenário
multi-tenant real com writer descuidado, é o vetor. **Correção barata: acrescentar
`AND r.tenant_id = p_tenant_id`.** Não é achado de exploração — é blindagem que falta.

Nota: a função é `SECURITY DEFINER` → **ignora RLS** por desenho. Correto para um decisor de
autoridade, mas significa que o tenant vem **inteiramente** do parâmetro; a segurança depende do
`req.tenant.id` do plugin, não do banco.

---

## 4 · 🔴 A PORTA-01 **NÃO** ALCANÇA `requireRole` — LACUNA ESTRUTURAL CONFIRMADA

**Este era o ataque mais importante do mandato, e ele se confirma — com material menor do que o
estrutural.**

`PORTA_HOLD_KEYS` (`company-policy-registry.ts:230-243`) é consultado **em um único lugar**:
`authorizationService.canActAs` (`authorization.service.ts:93`). O caminho de `requireRole` é
`rbac.plugin.ts:235` → `validateActionContext` → `assertActorRepresentable` (`canRepresentActor`)
→ `rbacService.actorHasAnyRole` → SQL. **Em nenhum ponto ele consulta `PORTA_HOLD_KEYS`.** O deny
terminal das 7 chaves de dinheiro **não existe** neste caminho — ele é fail-closed por acidente
(`actor_has_permission`), não por desenho, e `requireRole` não tem esse acidente.

**Consequência material medida — e é menor do que a estrutural:**
- 🟠 **`POST /admin/test-currency/emit`** é a **única** rota `requireRole` que escreve no Bank
  (`test-currency.service.ts:85` → `transactionService.transfer` → `bank_ledger`/
  `bank_transactions`). Gates: `requireRole(['admin'])` **+** `requireFinancialRiskClearance`.
  **PORTA_HOLD nunca é consultado.** Contenções reais: (a) a moeda é **pinada em constante**
  (`TEST_CURRENCY`, `:17`) — não há parâmetro de moeda na rota nem no service, logo **não emite
  BRL**; (b) teto de 1.000.000; (c) 1 portador; (d) `bank_ledger` e `bank_transactions` estão em
  **0 linhas** hoje. **Gravidade: LARANJA** (porta lateral real para o writer do Bank, contida por
  pin de moeda — não por decisão de PORTA).
- 🟢 **`economic-policy-admin`** parecia a pior e **não é**: o `adminGate` é uma **conjunção** —
  `requireRole(['admin'])` **E** `requirePermission('economic_policy:manage')` do guard factory
  (`require-permission.guard.ts:77`), que delega a `authorityService.canPerformAction` →
  `authorizationService.canActAs` → **PORTA_HOLD é consultado**. Ou seja, a superfície que
  configura os percentuais do split **está** sob o decisor PORTA-aware. (A chave
  `economic_policy:manage` não está em `PORTA_HOLD_KEYS` — e isso é **conforme** `DECISION-0166
  D6`: *admin configura, admin NÃO move dinheiro*.)

**Formulação honesta do risco:** não é "porta lateral para o dinheiro" no sentido de mover BRL.
É que **a garantia estrutural que a casa acredita ter — "as 7 chaves negam terminalmente" — não
vale em um dos dois decoradores**, e a única rota que hoje usa esse decorador para escrever no
Bank fica de pé sobre um `const` de moeda. Se amanhã alguém parametrizar a moeda, ou pendurar
outra rota financeira em `requireRole`, **nada estrutural barra**.

---

## 5 · O QUE ACONTECE QUANDO A FASE 6 RELIGAR

- **Autoridade dupla, não contraditória, mas não-conjuntiva.** Hoje `requirePermission` nega tudo,
  então quem passa passa por `requireRole`. Quando a FASE 6 acender, as duas superfícies concedem
  **em paralelo**, cada uma com sua fonte de verdade (`user_roles`/`roles` × permissões). Só
  `economic-policy-admin` as usa **em conjunção** — as outras 8 dependem de **uma** delas.
  Se o RBAC real não replicar exatamente o conjunto que a role `admin` concede hoje, o resultado
  é divergência silenciosa nos dois sentidos (rota que passa a negar quem trabalhava; rota que
  passa a permitir quem não devia).
- 🔴 **O risco maior é o inverso do temido:** as ~40 rotas `requireRole` **não estão mascaradas**
  hoje — elas **funcionam**. Portanto qualquer defeito atrás delas (tabela-fantasma, writer
  errado) **já está exposto** ao portador, e o inventário do painel — que trata a camada de
  decorators como uniformemente fail-closed — **não as conta**. O
  `F-SCHEMA-GHOST-REACHABILITY-SWEEP` precisa incluir estas ~40, e elas são **prioritárias**
  sobre as 176 chamadas de `requirePermission`, porque estas últimas ainda estão atrás do deny.

---

## CORREÇÕES SUGERIDAS (nenhuma aplicada — read-only)
1. **Painel:** parar de descrever a camada como "tudo fail-closed". Registrar as duas superfícies
   com seus números: `requirePermission` 176 chamadas/44 arquivos **negando**; `requireRole` ~40
   rotas/9 arquivos **concedendo**, 1 portador.
2. **`actor_has_any_role`:** acrescentar `AND r.tenant_id = p_tenant_id` ao join de `roles`
   (blindagem barata; a FK não cobre).
3. **`test-currency`:** decidir se a rota entra no regime da PORTA-01 (chave própria em
   `PORTA_HOLD_KEYS`) ou se o pin de moeda vira **invariante guard-policiada** — hoje a garantia é
   um `const` que qualquer refactor bem-intencionado desfaz.
4. **Antes da FASE 6:** inventariar as ~40 rotas `requireRole` (reachability + substrato), porque
   elas **não** ganham inventário de graça pelo deny — já estão vivas.

## O QUE NÃO AUDITEI (declarado)
- **Não subi o backend nem chamei as rotas por HTTP.** As provas são: execução real da função SQL
  (3 cenários + contraste), leitura dos gates e queries de estado. Não medi o comportamento de
  ponta a ponta de nenhuma das ~40 rotas.
- Não auditei o interior dos handlers (o que cada writer faz, se há tabela-fantasma atrás) — é
  exatamente a correção 4.
- Não avaliei se `requireFinancialRiskClearance` é fail-open ou fail-closed (li a assinatura, não
  provei o comportamento).
- Não auditei a resolução de `req.tenant.id` (de onde vem o tenant que a função recebe).
- `unificard_local` (aposentado) não foi tocado.

---
*Read-only respeitado. Única escrita: este arquivo.*
