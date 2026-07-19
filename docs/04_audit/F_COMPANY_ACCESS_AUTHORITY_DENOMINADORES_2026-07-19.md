# F-COMPANY-ACCESS-AUTHORITY-FOUNDATION — DENOMINADORES (anexo da DECISION-0189)

**Data:** 2026-07-19 · **Base:** HEAD `8397b41cb` · **Gerado por varredura do código vivo** (excluídos `src/scripts/**` e `*.test.ts`, listados à parte como classe própria).

## 0. Baseline material (banco dev `unificard_dev`, capturado antes de qualquer alteração)

| Métrica | Valor |
|---|---|
| bank_ledger | **0** |
| bank_transactions | **0** |
| bank_splits | **0** |
| bank_accounts | 16 |
| company_users total | 1 (active=1, invited=0, suspended=0) |
| company_users com `is_active <> (member_status='active')` | 0 |
| actor_delegations total | 9 · **ativas = 0** |
| companies | 1 |
| typecheck (contracts+backend+frontend) | 0 erros |
| runner de guards | **192/192 VERDES** |

Δbank=0 é trivialmente provável durante toda a campanha (ledger/transações/splits partem de 0 e nenhum writer é criado — PORTA 01 fechada).

## 1. Consumers de `actorCapabilitiesService` (core) — classificação

| Arquivo | Uso | Classe | Destino |
|---|---|---|---|
| `core/unifybank/bank-http.routes.ts` (GET /bank/balance?actorId=) | DECISOR financeiro (sopa de capabilities; `bank.view_balance` é base de page → todo membro ativo lê saldo) | **bare authorization financeira** | F3: `view_financial` terminal |
| `core/unifybank/transparency.routes.ts` (GET /bank/statement?actorId=) | DECISOR financeiro (mesma sopa) | **bare authorization financeira** | F3: `view_financial` terminal |
| `core/actor-coordination/recent-counterparts.service.ts` | gate de acesso (null-check) sobre dado derivado de contrapartes | decisor de acesso | F3: representação + `view_financial` p/ empresa |
| `core/home-feed/home-feed.service.ts` | gate de acesso (null-check); composição de feed | decisor de acesso (não-financeiro) | F3: troca por `canRepresentActor` |
| `core/profile-inference/profile-inference.service.ts` | gate de acesso (null-check) | decisor de acesso (não-financeiro) | F3: troca por `canRepresentActor` |
| `core/actor-capabilities/actor-capabilities.routes.ts` | projeção (endpoint próprio) | projeção | F3: redação (roster exige `manage_members`) |
| `core/unifybank/transparency.service.ts` / `modules/bank/bank-integration*` | comentários/porta — resolução actor→conta, sem decisão | projeção/infra | manter |
| `modules/social/actor-intents.service.ts` + `reputation.service.ts` | usam o `actor-capabilities.service` **do módulo social** (arquivo distinto, `./actor-capabilities.service`) | homônimo fora do denominador core | inalterado (fora de escopo; anotado para não confundir guard) |

## 2. Consumers de `canRepresentActor` — 438 chamadas em 133 arquivos de runtime

Classificação por área (contagem por arquivo no rodapé §2.1). Regra da campanha (DECISION-0189 §1.3): representação de EMPRESA permanece **gestão-gated** — nenhuma dessas rotas se ALARGA; portanto nenhuma vira mais permissiva. Classes:

- **(a) contexto-only legítimo** (seleção/assunção de actor antes de operação já gateada por chave exata): ex. `rbac.plugin.ts` (hint não-soberano), `social-2.0.routes` (posts passam por `requirePermission('publish_feed')`).
- **(b) acompanhado de permission gate exato**: social/votes (KYB-gate 0094), intent-execute (buyer binding), payout* (aprovação financeira própria).
- **(c) bare authorization empresarial a migrar POR ROTA** (CONTIDA gestão-gated nesta campanha; DT-CANREPRESENTACTOR-PER-ROUTE-EXACT-PERMISSION): availability (23), rentals (29), events (11+), services (20+), marketplace (30+), reports/dashboard (16), asset-sale (15), actor-page (7), media-assets (7), invoicing (3), ledger (4) — a fatia FINANCEIRA dessas superfícies é tratada na F3 independentemente (R19).
- **(d) fora de empresa** (actor humano self, grupos, território): groups/* (substrato D9.2), location/territorial, profile/c1, referral actor-code (dono humano).
- **(e) testes/scripts**: `src/scripts/**` (57 arquivos) — atualizados apenas quando o schema os quebrar (F4).
- **(f) guards**: `backend/scripts/audit-*.mjs` — leem o padrão, não o executam.

### 2.1 Contagem por arquivo (runtime, top→baixo)

availability/unified-availability.routes 23 · rentals/rentable-resource.service 17 · rentals/rentable-resource.routes 12 · events/event.routes 11 · services/services.service 10 · reports/reports.routes 10 · groups/group-actor-membership.service 10 · social/social-2.0.routes 9 · marketplace-identity.routes 8 · payment-method.routes 8 · groups/group-institutional-binding.service 8 · events/event-rfq.routes 8 · asset-sale.routes 8 · authority/actor-capability-grant.service 7 · asset-sale.service 7 · actor-page.routes 7 · services.routes 6 · service-order.routes 6 · marketplace-inventory.routes 6 · dashboard.routes 6 · availability-owner-authority 6 · authorization.service 6 (implementação) · identity.routes 5 · (…demais 111 arquivos com ≤4 ocorrências; total 438).

## 3. Rotas financeiras privadas (leitura) — denominador R19 da F3

| Rota | Guarda hoje | Defeito |
|---|---|---|
| `GET /bank/balance?actorId=` | actorCapabilities (sopa) | qualquer membro ativo lê saldo da empresa |
| `GET /bank/statement?actorId=` | actorCapabilities (sopa) | idem |
| `GET /bank/transaction/:id/splits` | **nenhuma além de auth** | topologia integral p/ qualquer autenticado |
| `GET /accounts/*` (`core/economy/accounts/account.routes.ts` — 5 GETs) | por handler (self) | auditar cada um na F3 |
| `GET /ledger/*` (`modules/ledger/ledger.routes.ts` — 3 GETs) | canRepresentActor | representação ≠ view_financial |
| `recent-counterparts` | actorCapabilities | derivado financeiro sem chave exata |
| invoices/AP/AR/event-settlement/economic-overview/reports (leituras) | canRepresentActor/diverso | fatia financeira migra ou fecha fail-closed na F3 |
| `GET /bank/regional-fund` | residência territorial | transparência PÚBLICA do fundo (0177) — fora do view_financial privado |

## 4. Writers de `company_users` (runtime)

| Local | Operação | Destino |
|---|---|---|
| `companies.service.ts:604` | INSERT bootstrap (nascimento atômico) | mantém; materializa SET_V1 (F2) |
| `companies.service.ts:470` | UPDATE `is_primary=false` | rótulo de UI — mantém |
| `companies.service.ts:1206` | UPDATE `can_view_consolidated_inventory` (writer 0116, canManageCompany-gated) | F4: sob administration ceiling |
| `companies.service.ts:2300` | UPDATE `role_description` (self) | rótulo — mantém |
| `company-members.repository.ts:125` | INSERT upsert (ON CONFLICT DO UPDATE) | F4: morre p/ criação direta de active; reentrada governada |
| `company-members.repository.ts:259` | UPDATE role/member_status/metadata | F4: comandos governados |
| `company-members.repository.ts:282` | **DELETE físico** | F4: morre |

## 5. Readers/decisores de `role`/`is_primary`/`is_active` (runtime a matar na F4)

- `companies.service.canManageCompany` (`can_manage_company OR role='owner'`, + `is_active=true`);
- `authorization.service.checkOwnership` (ramos `is_primary=true` e `role='admin'`), `checkOwnershipOnClient` (mesmos ramos), comentários :378/:653;
- `actor-capabilities.service.resolveCompanyMembershipForUser` (`cu.is_active = true`);
- `company-publications.service`, `kyb-request-submit.service`, `modules/social/actor.repository`, `core/navigation/module-projection.routes`, `core/financial-approval/payout-approval-policy.service`, `companies.routes`, `companies.service` (demais `is_active` — 8 arquivos runtime; +40 scripts classe (e));
- DB-side: inventário de views/functions/triggers/índices/RLS/constraints via catálogo do banco efêmero roda NA F4 (gate).

## 6. Consumers de `relationship_type`/scopes de delegação (runtime)

`actor-delegation.repository` (casa atual) · `company-members.service/routes/types` (writer de membership→delegação; cutover F4) · `authorization.service` (checkDelegationPermission — permanece p/ representantes externos) · `actor-capabilities.service/types` (projeção do vínculo) · `governed-vocabularies.manifest` (guard de vocabulário) · social/events/rentals/demands/asset-sale (leem scopes p/ representação externa — INTOCADOS, §6.2 da DECISION).

## 7. Divergência de base registrada

HEAD esperado pela ordem soberana: `e76757898`. HEAD real: `8397b41cb` = `e76757898` + 1 commit **docs-only** (`docs(execution-log): registra selos YALA das Fatias D e A`). Nenhuma mudança material para a campanha; plano preservado sem adaptação.

## 8. Untracked preexistentes preservados (não são desta campanha)

`02_decisions_FULL.txt` · `docs/04_audit/GATE_READONLY_CAMPANHA_FINANCEIRO_FISCAL_2026-07-18.md` · `docs/04_audit/YALA1_AUDITORIA_CAMPANHA_ACD_2026-07-18.md` — intocados.
