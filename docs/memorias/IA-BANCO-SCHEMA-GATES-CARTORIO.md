# IA-17 — Banco/Schema/Gates/Cartório

## 1. Carimbo
- **HEAD:** `aaeb50b5` (branch `rescue-structural`) — verificado de 1ª mão (`git rev-parse`).
- **Data/hora:** 2026-06-22.
- **Git status:** 56 entradas (memórias `M` + `opus.md M` + untracked docs/imgs/outputs 0131); **zero** modificação de código/migration/schema.
- **READ-ONLY confirmado:** SIM — só `SELECT`/catálogo (`pg_catalog`/`information_schema`)/`pg_get_functiondef`/`EXPLAIN` não-EXECUTE/`rg`/`grep`. Colunas explícitas; **nenhum `SELECT *`** nos meus probes.
- **Arquivo criado/atualizado:** `docs/memorias/IA-17-BANCO-SCHEMA-GATES-CARTORIO.md` (este).
- **Memória lida:** `docs/memorias/MINHA_MEMORIA_BANCO_DE_DADOS.md` **ENCONTRADA** (até 18ª atualização, HEAD `891dfa87`). Também lidos: REMEDIATION_DECISIONS_LOG.md, REMEDIATION_DT_LOG.md, STATUS_EXECUCAO_GLOBAL.md, DECISION-0131-INSTRUMENTO-DECISAO.md, F-AUTHORITY-MAP-0131-v2.md, PLANO-DEFINITIVO-0131-EXECUTORA.md.
- **Banco/schema consultado:** `unificard_dev` (conexão `postgres`); 272 tabelas BASE em `public`; catálogo `pg_class/pg_constraint/pg_index/pg_trigger/pg_policy/pg_roles/pg_proc`.
- **Migrations consultadas:** `backend/migrations/*.sql` (400) × `schema_migrations` (400) — reconciliação `comm` por `filename`.
- **Docs/cartório consultados:** acima + `backend/package.json` scripts, `.github/workflows/*.yml`.
- **Comandos/probes usados:** `git rev-parse/status`; `psql` (count exato, NUNCA `n_live_tup`); `to_regclass`; `information_schema.columns`; `pg_constraint(contype c/f/u/x)`; `pg_index`/`pg_get_indexdef`; `pg_trigger`; `pg_policies`/`pg_class.relrowsecurity`; `pg_roles`; `has_table_privilege`; `pg_get_functiondef`; `rg/grep` em `backend/src` e `migrations`. Workflow READ-ONLY de apoio (11 auditores) + **reconfirmação pessoal de 1ª mão dos achados headline** (RLS-theatre, hardening aplicada, bank_splits, RLS-off money).
- **Confirmação de que nenhuma migration foi rodada:** SIM — nenhuma.
- **Confirmação de que nenhuma escrita no banco foi feita:** SIM — só leitura; probes descartados; zero INSERT/UPDATE/DELETE/DDL/GRANT/REVOKE/policy/índice.

## 2. Escopo
**Auditado (eixo 17):** estado do banco vivo (migrations applied/drift, roles, grants, RLS, extensões, schemas, contagem de tabelas); migrations (ordem/gaps/dups, RLS, NUMERIC/timestamp); tipos críticos (*_cents/NUMERIC/timestamp/boolean); constraints/FK/CHECK; índices materiais; RLS/grants/roles; schema das tabelas financeiras, identidade/actor/autoridade, semântica, temporal, comercial; SELECT */devLog/writes diretos no código vivo; gates/guards; divergência cartório×schema.
**Fora (handoff):** lógica de negócio profunda de dinheiro-runtime, autoridade, semântica, oferta, tempo, marketplace, produtos, locações, assinaturas, logística, frontend — registrados em §8.

## 3. Memória/cartório vs estado vivo
| Fonte | Afirma | Vivo (1ª mão) | Classificação |
|---|---|---|---|
| REMEDIATION_DECISIONS_LOG / STATUS | `db_role_rls_hardening` "READY/PROVEN-EPHEMERAL / **NOT LIVE IN DEV**"; "drift=1 (395 disco × 394 DB)" | migration `20260620120000_db_role_rls_hardening` **APLICADA** (em `schema_migrations`); RLS+FORCE+policies INSTALADAS em 62 tabelas/78 policies; **drift=0 (400=400)** | **CONTRADITA / STALE** — está aplicada, não "not live"; mas RLS é **inerte em runtime** (superuser) → o "not live" estava certo pelo motivo errado |
| MINHA_MEMORIA_BANCO (R2, HEAD dd270f41) | drift=1; RLS OFF nos 6 planos de autoridade | drift=0; RLS agora **ON** nas tabelas de autoridade/payout (catálogo) — mas inerte sob `postgres` | **STALE** (avançou; hardening aplicada depois) |
| MINHA_MEMORIA_BANCO (F-OFFER-2..6) | services.canonical_service_id NULLABLE; schema_migrations 398/400 por HEAD | NOT NULL agora; 400 no HEAD atual | **STALE** (pré-estado superado por F-OFFER-2A/3) |
| DECISION-0131 (3 arquivos untracked) | docs-only, **não promulgada**, aguarda rulings §B de Clayton | baseline coerente (0/0/0 approval; 9 delegações revogadas/0 ativas; RBAC dormant; RLS instalada) | **CONFIRMADA** (não-promulgada; ops não-vivo) |
| F-AUTHORITY-MAP-0131-v2 | actor_has_permission=RETURN FALSE; KYB frágil (PJ por global_user_id NULL) | `chk_actor_requires_identity` NÃO cobre company/actor_organizational (gap KYB confirmado no CHECK) | **CONFIRMADA** |
| "migration 395 = RLS" (brief) | a RLS é a 395 | RLS-hardening é **id 398** (`20260620120000`); o id 395 é `rename_..._amount_to_amount_cents` | **CONTRADITA** (confusão id×nº; a RLS existe e está aplicada) |

## 4. Mapa macro banco/schema
`MIGRATION (400=400, FECHA)` → `SCHEMA VIVO (272 tabelas, FECHA)` → `CONSTRAINT (valor/enum FORTE; unicidade-temporal AUSENTE → FECHA_COM_RISCO)` → `FK/INDEX (FK ok p/ maioria; 35 sem FK + 297/619 sem índice líder → FECHA_COM_RISCO)` → `RLS/GRANT (instalada mas INERTE em runtime superuser → NÃO_FECHA p/ público/money)` → `REPOSITORY/QUERY (boundary ledger limpo; ~150 SELECT * → FECHA_COM_RISCO)` → `GATE/GUARD (rodam em CI mas só regex de CÓDIGO, não schema vivo → FECHA_COM_RISCO)` → `CARTÓRIO (declara hardening CLOSED/NOT-LIVE; vivo aplicado-mas-inerte → drift, INCONCLUSIVE até reconciliar)` → `VERDADE OPERACIONAL (dev virgem; money HOLD)`.

## 5. Matriz do eixo
| item | fecha/não-fecha | evidência viva | blocker | risco | próxima frente | modo |
|---|---|---|---|---|---|---|
| migrations aplicadas | FECHA | 400 schema_migrations | não | — | — | FAST-PATH |
| migrations pendentes | FECHA | comm diff vazio (0/0) | não | — | — | FAST-PATH |
| drift schema vs repo | FECHA | 400=400 filename-match | não | gaps id 304/306/308 cosmético | — | FAST-PATH |
| drift schema vs cartório | NÃO_FECHA | cartório "NOT LIVE/drift=1" × vivo aplicado/drift=0 | público(doc) | cartório stale induz erro ops | MODO_B_CARTORIO_RECONCILIATION | MODO B |
| amount_cents BIGINT | FECHA | 101/101 *_cents = bigint | não | — | — | FAST-PATH |
| NUMERIC dinheiro | FECHA | 0 money; numerics=qty/pct/score | não | product_offers.price legado (RFC-003, catálogo) | HANDOFF_DINHEIRO | — |
| TIMESTAMPTZ | FECHA | 0 timestamp-without-tz | não | — | — | FAST-PATH |
| SELECT * | FECHA_COM_RISCO | ~150 em 67 arquivos prod | não | acoplamento/leak money/authority | FAST-PATH_SCHEMA_GUARD (higiene) | MODO B |
| devLog | FECHA_COM_RISCO | @utils/devLog em core/groups | não | logger nomeado; checar gate NODE_ENV | cleanup | FAST-PATH |
| boolean naming | FECHA | 9 app fora de is_/has_/can_ (requires_* ok) | não | cosmético | — | cleanup |
| bank_ledger | FECHA_COM_RISCO | RLS t/t + 5 triggers (no_update/no_delete/non_neg) | não | superuser pode DISABLE trigger/bypass RLS | HANDOFF_DINHEIRO | MODO C |
| bank_transactions | FECHA_COM_RISCO | RLS t/t; só triggers BEFORE INSERT (sem no_update/delete) | não | UPDATE/DELETE não barrado por trigger | HANDOFF_DINHEIRO | MODO C |
| payment_intents | NÃO_FECHA | **RLS OFF** (f/f); amount_cents bigint | money | isolamento só app | HANDOFF_DINHEIRO | 3 PARALELAS |
| bank_splits | NÃO_FECHA | RLS t/t; **sem trigger no_update/no_delete** (só validate_total) | money | **split MUTÁVEL no banco** | HANDOFF_DINHEIRO | 3 PARALELAS |
| wallets | FECHA_COM_RISCO | actor_wallet_* não existem; actor_wallet_payout/recovery sim (RLS t/t, FK RESTRICT) | não | sem trigger append-only nessas | HANDOFF_DINHEIRO | MODO C |
| recovery tables | FECHA_COM_RISCO | recovery_obligations/entries RLS t/t, FK RESTRICT | não | sem trigger imutabilidade | HANDOFF_DINHEIRO | MODO C |
| payout tables | NÃO_FECHA | `payout_requests` thin (RLS OFF, sem FK-approval, status livre) × `actor_wallet_payout_requests` (forte) | money | **dupla verdade de payout** | HANDOFF_DINHEIRO | 3 PARALELAS |
| RLS 395 (=398) | PARCIAL | migration aplicada + 62 tab/78 pol INSTALADAS, mas inerte (superuser) | público | RLS theatre | MODO_B_RLS_395_APPLY_VERIFY | MODO B/C |
| grants/revokes | NÃO_FECHA | postgres tem ALL; REVOKE só na role NOLOGIN não usada | público | role real irrestrita | MODO_B_RLS_395_APPLY_VERIFY | MODO B |
| roles/app role | NÃO_FECHA | runtime=postgres(super+bypass); unificard_app=NOLOGIN; app_role=login s/ grants | público | role least-priv não plugada | MODO_B_RLS_395_APPLY_VERIFY | MODO B |
| actor/users/company schema | FECHA_COM_RISCO | FKs coerentes; 0 órfãos GUI; actor_type CHECK=10/3 vocab; chk_requires_identity não cobre company | não | DT vocab + gap KYB | HANDOFF_AUTORIDADE | DECISION |
| concepts/categories schema | FECHA | concept_id FK em 6 tabelas (RESTRICT); chk_n2; relation_type CHECK 6 | não | — | HANDOFF_SEMANTICA | FAST-PATH |
| services/service_offerings schema | FECHA | service_offerings.canonical_service_id RESTRICT; service_id mandatório (F-OFFER-3) | não | company_id proveniência livre (F-OFFER-3) | HANDOFF_OFERTA | — |
| availability/bookings schema | NÃO_FECHA | TIMESTAMPTZ ok; **sem start<end CHECK; sem unique/EXCLUDE conflict-guard** | MTP-booking | double-booking só app | HANDOFF_TEMPO + MODO_B_SCHEMA_CONSTRAINT_HARDENING | MODO B |
| products/inventory schema | FECHA_COM_RISCO | MATERIAL (vazio exceto canonical_products=35); inventory append-only trigger ativo; products.price_cents sem CHECK≥0 | não | products sem nonneg | HANDOFF_PRODUTOS | — |
| rentals schema | INCONCLUSIVE | rentals*/rental_resources* AUSENTES (to_regclass NULL) | não | fechamento vazio | HANDOFF (IA-LOCACOES) | DECISION |
| subscriptions schema | INCONCLUSIVE | subscriptions/plans/entitlements AUSENTES | não | fechamento vazio | HANDOFF (IA-ASSINATURAS) | DECISION |
| service_orders/logistics | FECHA_COM_RISCO | service_orders MATERIAL (enum status); fulfillment/logistics AUSENTE | não | logística greenfield | HANDOFF_LOGISTICA | — |
| constraints/FKs | FECHA_COM_RISCO | valor/enum forte; 35 tabelas sem FK (money/authority) | não | integridade referencial app-dependente | MODO_B_SCHEMA_CONSTRAINT_HARDENING | MODO B |
| indexes críticos | FECHA_COM_RISCO | conflict-guard ok; bank_ledger sem composite hot-path; 297/619 FK sem índice | não | perf/lock no money multi-tenant | MODO_B_INDEX_HARDENING | MODO B |
| triggers | FECHA_COM_RISCO | bank_ledger append-only ativo; bank_splits/payment_* sem | não | imutabilidade parcial | HANDOFF_DINHEIRO | MODO C |
| gates actor-writer | FECHA | validate:actor-writer-boundaries em CI | não | regex de código | — | — |
| gates bank-ledger | FECHA | validate:bank-ledger-boundaries em CI (regex INSERT/UPDATE bank_) | não | regex de código | — | — |
| regression guards | FECHA_COM_RISCO | 81 audit-*.mjs + 3 em CI | não | só CÓDIGO, não schema vivo | GATE hardening | MODO B |
| architectural patterns | FECHA_COM_RISCO | `validate-architectural-patterns.mjs` AUSENTE; existe `-rules.ts` fora da cadeia/CI | não | gap nominal | — | — |
| DECISION-0131 | PARCIAL | não promulgada; baseline coerente | não(dev) | aguarda rulings §B Clayton | DECISION_0131_RECONCILIATION | DECISION |
| cartório vs schema | NÃO_FECHA | hardening declarado CLOSED/NOT-LIVE × aplicado-mas-inerte | público(doc) | indução a erro ops | MODO_B_CARTORIO_RECONCILIATION | MODO B |

## 6. Achados críticos

**RLS-01 — RLS THEATRE: runtime conecta como superuser, RLS inerte.** `DATABASE_URL` usa `postgres` (`rolsuper=t`, `rolbypassrls=t`, `is_superuser=on`). 62 tabelas com RLS+FORCE e 78 policies são **incondicionalmente ignoradas** em runtime. `unificard_app` (NOSUPER/NOBYPASS, grants mínimos) existe mas é **`rolcanlogin=FALSE`** (não conecta); `app_role` tem login mas **0 grants**. Preflight fail-closed `runDbRoleRlsPreflight` existe só no validate-script, **não wired no boot**. Evidência: `pg_roles`; `current_user=postgres/is_superuser=on`; `has_table_privilege('postgres','bank_ledger','DELETE')=t`. Impacto: isolamento multi-tenant depende 100% do código (`set_config app.current_tenant`). **Bloqueia público? SIM (parcial). Bloqueia dinheiro real? SIM (HOLD).** Exige DECISION? não (é ato ops + wiring). Exige 3 paralelas? **SIM** (toca RLS financeiro). Exige YALA? SIM. Modo: **MODO_B_RLS_395_APPLY_VERIFY** + handoff IA-AUTORIDADE/IA-DINHEIRO/ops. _Mitigação atual: é DEV (NODE_ENV≠production); triggers append-only de bank_ledger ativos._

**CARTORIO-DB-01 — drift cartório×vivo na RLS-hardening.** Cartório (STATUS/REMEDIATION) declara `F-DB-ROLE-AND-RLS-HARDENING` **CLOSED/DOCS-ONLY/NOT-LIVE-IN-DEV** e "drift=1". Vivo: migration **aplicada** (id 398, em `schema_migrations`), RLS **instalada** (62/78), **drift=0**. O texto "not live" descreve o ROLE (correto), mas o cartório não registra que a migration **foi aplicada ao dev** nem que a RLS está instalada-porém-inerte. Risco: ops pode (a) reaplicar/assumir pendência inexistente, ou (b) achar que RLS protege quando é teatro. Modo: **MODO_B_CARTORIO_RECONCILIATION** + handoff IA-DOCUMENTOS/IA-DECISOES-DT. **Não editei cartório.**

**LEDGER-SCHEMA-01 — `bank_splits` mutável (split não imutável no banco).** `bank_ledger` tem `bank_ledger_no_update`+`bank_ledger_no_delete`+`non_negative_balance` (append-only material). `bank_splits` tem **apenas** `bank_splits_validate_total` (BEFORE INSERT OR UPDATE) — **UPDATE/DELETE de split é permitido** pelo banco; imutabilidade do rateio só é garantida pela app. Invariante "split imutável após ledger" **não protegida no schema**. Bloqueia dinheiro real? **SIM (HOLD).** 3 paralelas? **SIM.** Handoff IA-DINHEIRO. Modo MODO_C.

**RLS-02 — 7 tabelas monetárias com RLS OFF.** `payment_intents`, `payment_transactions`, `payout_requests`, `bank_settlements`, `ledger_snapshots`, `service_payment_requests`, `treasury_split_executions` = `rls=f/forced=f`. Mesmo com role least-priv plugada, essas não filtram por tenant no banco. Bloqueia dinheiro real? **SIM (HOLD).** 3 paralelas? **SIM.** Handoff IA-DINHEIRO.

**MONEY-DUP-01 — dupla verdade de payout.** `payout_requests` (thin: sem RLS, sem FK de aprovação, `status` text livre) coexiste com `actor_wallet_payout_requests` (RLS t/t, cadeia FK approval/settlement/bank_transaction RESTRICT). Risco de **bypass do gate de aprovação** via tabela legada. Handoff IA-DINHEIRO. 3 paralelas.

**TIME-GUARD-01 — conflict-guard de booking ausente no banco.** `bookings`/`availability`/`schedule_slots`: **sem UNIQUE/EXCLUDE** (contype x|u = 0) e **sem CHECK start<end**. Double-booking e janela invertida só são evitados por código (`unified-availability.repository.ts` faz a checagem + `pg_advisory_xact_lock`, mas nada no substrato barra). Bloqueia MTP-booking? **PARCIAL.** Handoff IA-TEMPO. Modo MODO_B_SCHEMA_CONSTRAINT_HARDENING (na janela virgem: bookings=0).

**FK-01 — 35 tabelas base sem FK (money/authority incluídas).** Relevantes: `actor_debts`, `actor_delegations` (authority — só CHECK de status), `payout_requests`, `bank_settlements`, `treasury_split_executions`, `governance_financial_actions`, `financial_disputes/freezes`. Linhas money/authority podem referenciar actor/conta inexistente sem recusa do banco. `actor_registry.entity_id` polimórfico degenerado (sem `entity_type`/CHECK). Modo MODO_B_SCHEMA_CONSTRAINT_HARDENING.

**GATE-DB-01 — gates não verificam schema vivo.** 81 `audit-*.mjs` + `guard-financial-regression.ts` + `sql-regression-lint.ts` rodam em CI, mas **100% por `readFileSync`+regex sobre `.ts`** — nenhum abre `pg`/`pg_catalog`. Os únicos que checam schema vivo (RLS isolation, payout TOCTOU, payout e2e) são `*.ps1` efêmeros **fora do CI**. Logo um merge pode quebrar RLS/role/TOCTOU/drift de schema **sem gate vermelho**. `validate-architectural-patterns.mjs` (citado) **não existe** (o real é `-rules.ts`, fora da cadeia). Handoff IA-DECISOES-DT/ops.

**INDEX-01 — gaps de índice no money/multi-tenant (perf, não-blocker).** `bank_ledger` sem composite do hot-path (`tenant_id,account_id` + `created_at DESC`); `bank_ledger.tenant_id` e `bank_splits.tenant_id` sem índice (seq scan em cleanup/RLS por tenant); `service_offerings.{service_id,professional_actor_id,company_id}` sem índice; **297/619 FKs (48%) sem índice líder**. Modo MODO_B_INDEX_HARDENING (money → ratificado, não autônomo).

**SELECT-STAR-01 — ~150 `SELECT *` em produção.** 67 arquivos, incl. substrato sensível: `actor-wallet-payout.service.ts` (4, incl. `SELECT * ... FOR UPDATE`), `rbac/role` (10), `payout/escrow/invoicing.repository`, `unified-availability` (7). Acoplamento frágil a schema + risco de leak se mappers não filtrarem. **Não é write perigoso, não toca causalidade.** Frente própria de higiene (priorizar money/authority). Modo FAST-PATH_SCHEMA_GUARD.

**ACTOR-TYPE-01 — DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION confirmada.** `actors_actor_type_check` aceita **10 valores de 3 vocabulários** (`user/page/group/channel` + `actor_human/actor_organizational/actor_system` + `person/company/system`). Runtime só usa `user`/`page`. Convergência pendente (norma assintótica). Handoff IA-ACTOR.

**KYB-01 — `chk_actor_requires_identity` não cobre company.** Exige `global_user_id` só para `user/actor_human/person` → PJ/company-actor pode existir sem `global_user_id` pelo CHECK (bate com gap KYB do 0131). Sem órfão hoje. Handoff IA-AUTORIDADE.

**COMERCIO-ABSENT-01 — rentals/subscriptions/plans/entitlements/fulfillment AUSENTES.** `to_regclass`=NULL. Qualquer fechamento desses eixos é **vazio** (sem tabela). Coerente com RAIO-X IA-13 (locação=enum-only). Handoff IA-LOCACOES/IA-ASSINATURAS/IA-LOGISTICA — modo DECISION (modelar antes de existir).

## 7. Gaps de conexão
- **Banco↔role:** schema endurecido (RLS/role) × runtime não-endurecido (postgres). Gap de wiring ops (ALTER ROLE LOGIN + DATABASE_URL + preflight no boot).
- **Cartório↔banco:** cartório declara hardening "not live/drift=1"; banco diz aplicada/drift=0/inerte. Gap de registro.
- **Gate↔schema:** gates só leem código; drift de schema/RLS não é barrado em CI. Gap de cobertura.
- **Schema↔invariante:** split imutável / no-overlap booking / FK money-authority são invariantes do sistema **não materializados no schema** (dependem da app).
- **Código↔schema:** ~150 SELECT * acoplam código a schema (gap de disciplina de projeção).

## 8. Handoffs para outras IAs
- **IA-DINHEIRO:** LEDGER-SCHEMA-01 (split mutável) · RLS-02 (7 money RLS-off) · MONEY-DUP-01 (payout dupla verdade) · bank_transactions/wallets/recovery sem trigger imutabilidade · product_offers.price NUMERIC legado. **exige_3_paralelas=SIM.**
- **IA-AUTORIDADE:** RLS-01 (role/RLS runtime) · KYB-01 (chk_actor_requires_identity não cobre company) · actor_delegations sem FK.
- **IA-ACTOR:** ACTOR-TYPE-01 (3 vocabulários) · relação `global_users`×`identities` (2 namespaces de identidade fiscal — não provei a equivalência).
- **IA-TEMPO:** TIME-GUARD-01 (sem conflict-guard/EXCLUDE/start<end no banco) · `unified_availability` AUSENTE (SSOT vivo = `availability`) · schedules/schedule_slots vivos-mas-NÃO-SSOT (DECISION-0014).
- **IA-SEMANTICA / IA-OFERTA:** concept/category/services/service_offerings schema = FECHA (FKs/CHECK ok); company_id proveniência livre em service_offerings (F-OFFER-3).
- **IA-PRODUTOS-ESTOQUE:** products MATERIAL mas `products.price_cents` sem CHECK≥0; inventory append-only ativo.
- **IA-LOCACOES-RECURSOS / IA-ASSINATURAS-RECORRENCIA / IA-LOGISTICA:** COMERCIO-ABSENT-01 (substrato inexistente → modelar via DECISION).
- **IA-DOCUMENTOS / IA-DECISOES-DT:** CARTORIO-DB-01 (reconciliar STATUS/REMEDIATION) · GATE-DB-01 (gate não-cobre-schema) · DECISION-0131 não-promulgada.
- **IA-YALA:** reseal obrigatório de qualquer fatia derivada (RLS apply, constraint hardening, money).

## 9. Riscos para MTP
- **Bloqueia MTP:** TIME-GUARD-01 se o MTP inclui booking econômico (double-booking só app-enforced) — endereçável grátis (bookings=0) via MODO_B_SCHEMA_CONSTRAINT_HARDENING.
- **Não bloqueia MTP mas corrigir:** SELECT * (higiene), INDEX-01 (perf), FK-01 (integridade).
- **V2:** rentals/subscriptions/logistics (AUSENTES).
- **Cleanup:** boolean naming, gaps id de migration, colisão timestamp 20260427120000.
- **Exige decisão:** DECISION-0131 (rulings §B), modelo de locação/assinatura.
- **Exige 3 paralelas:** tudo financeiro (RLS money, split, payout).

## 10. Riscos para público e dinheiro real
- **Antes de público:** RLS-01 (plugar role least-priv + preflight no boot) — sem isso, isolamento multi-tenant é só-código. CARTORIO-DB-01 (não promover sob doc enganoso).
- **Antes de dinheiro real (HOLD_FINANCEIRO):** RLS-02 (RLS off em 7 money) · LEDGER-SCHEMA-01 (split mutável) · MONEY-DUP-01 (payout dupla verdade) · trigger imutabilidade ausente em bank_transactions/wallets/recovery · grants destrutivos no role real (bank_ledger DELETE/UPDATE).
- **RLS/grant:** RLS-01/RLS-02/grants-revokes (role real irrestrita).
- **Migration drift:** NENHUM (400=400).
- **Constraint/FK:** FK-01 (35 sem FK) · TIME-GUARD-01.
- **Tipo financeiro:** zero (amount_cents BIGINT ✓; NUMERIC money ✗).
- **Tempo:** start<end + conflict-guard ausentes.
- **Gates:** GATE-DB-01 (não cobre schema vivo).
- **Exige DECISION:** 0131 reconciliation; modelo locação/assinatura.
- **Exige MODO C:** money-schema hardening (toca ledger/split/wallet).
- **Exige 3 paralelas:** todos os achados financeiros.
- **HOLD:** dinheiro real até checklist §13.

## 11. Veredito final
**FECHA_COM_RISCO** (para o eixo banco/schema em geral) · **HOLD_FINANCEIRO** (para dinheiro real).
Racional: migrations 100% alinhadas (400=400, drift=0), dinheiro material 100% BIGINT cents (zero NUMERIC monetário), tempo 100% TIMESTAMPTZ, CHECKs de valor/enum fortes e maduros, catálogo semântico material vivo, boundary do ledger limpo, append-only do bank_ledger ativo, gates rodam em CI. **Mas** com riscos estruturais nomeados que **bloqueiam público e dinheiro real**: RLS-theatre (runtime superuser), split mutável, RLS-off em 7 money, payout dupla-verdade, conflict-guard de booking ausente, gates cegos a schema vivo, e drift cartório×vivo. Nenhum é silencioso — todos documentados aqui.

## 12. Próxima frente recomendada
1. **MODO_B_RLS_395_APPLY_VERIFY** (segurança, antes de público): `ALTER ROLE unificard_app WITH LOGIN` → apontar `DATABASE_URL` runtime para ela → wirar `runDbRoleRlsPreflight` no boot (fail-closed) → habilitar RLS nas tabelas money que estão OFF → verificar isolamento (rodar os `*.ps1` efêmeros e colocá-los em CI). **Toca RLS financeiro → 3_PARALELAS_OBRIGATORIAS + YALA.**
2. **MODO_B_CARTORIO_RECONCILIATION** (IA-DOCUMENTOS/IA-DECISOES-DT): reconciliar STATUS/REMEDIATION (hardening aplicada-mas-inerte, não "not live").
3. **HANDOFF_DINHEIRO** com **3_PARALELAS_OBRIGATORIAS**: split imutável, RLS money, payout dupla-verdade, triggers append-only.
4. **MODO_B_SCHEMA_CONSTRAINT_HARDENING** (janela virgem): conflict-guard booking + start<end CHECK + FK money/authority.
> Justificativa do modo: o eixo não tem blocker de **migration/tipo** (esses FECHAM); os blockers são de **RLS/role (ops+3-paralelas)**, **constraint temporal (MODO B virgem)** e **schema financeiro (MODO C/3-paralelas)**. Nada é FAST-PATH autônomo no que toca money/RLS.

## 13. Checklist mínimo antes de dinheiro real
- [ ] **bank_ledger protegido** — triggers append-only ✓ vivos, MAS RLS inerte sob superuser ✗ → plugar role least-priv.
- [x] **amount_cents BIGINT** — 101/101 ✓.
- [x] **zero NUMERIC financeiro** — ✓ (resíduo product_offers.price legado, não-settlement, RFC-003).
- [ ] **split imutável** — ✗ `bank_splits` sem trigger no_update/no_delete.
- [ ] **RLS/grants aplicados** — instalados ✗ inertes (runtime postgres); 7 money RLS-off; REVOKE só na role NOLOGIN.
- [ ] **recovery/payout constraints** — recovery FK RESTRICT ✓; `payout_requests` legado sem RLS/FK-approval ✗ (dupla verdade).
- [~] **idempotency keys** — `payment_intents`/`bank_transactions` têm `idempotency_key` UNIQUE WHERE NOT NULL ✓; verificar cobertura em payout/recovery (handoff IA-DINHEIRO).
- [ ] **FK/constraints financeiras** — 35 tabelas sem FK incl money; reforçar.
- [~] **gates passando** — regression-guards verde em CI ✓, mas **não cobrem schema vivo** ✗.
- [x] **schema vivo sem drift** — 400=400 ✓.
- [ ] **YALA PASS** — pendente para qualquer fatia derivada.

## 14. Resumo executivo
- HEAD `aaeb50b5`, `unificard_dev`: **migrations 400=400, drift ZERO**; 272 tabelas; 4 extensões.
- **Dinheiro material 100% BIGINT cents** (101 colunas), **zero NUMERIC/money** de caixa, **100% TIMESTAMPTZ** — invariantes de tipo SÃOS.
- **Achado headline (RLS-01): RLS é teatro** — runtime conecta como `postgres` (superuser+bypassrls); 62 tabelas/78 policies inertes; role hardened `unificard_app` existe mas é NOLOGIN; preflight não wired no boot.
- **Drift cartório×vivo (CARTORIO-DB-01):** cartório diz hardening "NOT LIVE IN DEV/drift=1"; vivo = **aplicada (id 398)/drift=0/inerte**.
- **Financeiro HOLD:** `bank_splits` mutável (sem trigger imutabilidade); 7 tabelas money com RLS OFF; `payout_requests` legado duplica `actor_wallet_payout_requests` (risco de bypass de aprovação).
- **Tempo:** sem conflict-guard (UNIQUE/EXCLUDE) nem start<end CHECK em bookings/availability → double-booking só app-enforced (grátis corrigir, bookings=0).
- **Integridade:** 35 tabelas sem FK (money/authority incluídas); 297/619 FKs sem índice líder (perf/lock no money multi-tenant).
- **Gates (GATE-DB-01):** rodam em CI mas só fazem regex de CÓDIGO; nenhum verifica schema vivo; checagens reais de RLS/TOCTOU são `*.ps1` fora do CI.
- **Higiene:** ~150 `SELECT *` em produção (incl. money/authority); boundary do ledger limpo; nenhum write fora de boundary; nenhuma mutação de append-only em produção.
- **Veredito: FECHA_COM_RISCO** (eixo) / **HOLD_FINANCEIRO** (dinheiro). Próxima: **MODO_B_RLS_395_APPLY_VERIFY** + **3 PARALELAS** para o financeiro. DECISION-0131 não-promulgada (aguarda Clayton).

---
*IA-17 — READ-ONLY estrito. Nenhuma migration rodada, nenhuma escrita no banco, nenhum código/runtime/schema/cartório alterado, nenhum commit. Análise = INSUMO, não GO. Achados financeiros → IA-DINHEIRO com 3 paralelas.*
