# IA-01 — Cadastro/Auth/Onboarding

> RAIO X READ-FIRST do eixo de entrada do usuário (cadastro → auth → user → actor →
> tenant → referral → requiresOnboarding → primeira tela). **Nenhum código, migration,
> norma, decision ou cartório foi editado.** Único artefato de escrita: este arquivo.

---

## 1. Carimbo

- **HEAD:** `aaeb50b5182120888a72418775a9d211e33bff4d`
- **Branch:** `rescue-structural`
- **Data/hora:** 2026-06-21
- **Git status:** sujo de docs/imagens não rastreados (memórias, .png, .txt de gates); **nenhum arquivo de runtime modificado** por este raio X.
- **READ-ONLY confirmado:** SIM — só leitura de arquivos, grep e SQL `SELECT`/`count`/catálogo (`pg_constraint`, `pg_indexes`). Zero `INSERT/UPDATE/DELETE/TRUNCATE`, zero migration.
- **Arquivo criado:** `docs/memorias/IA-CADASTRO-AUTH-ONBOARDING.md`
- **Banco/schema consultado:** `unificard_dev` (via `DATABASE_URL` do `backend/.env`), schema `public`.
- **Comandos/probes usados:** leitura integral de `auth.routes.ts` + `auth.service.ts` (register/login); fan-out de 8 leitores READ-ONLY (frontend, rotas auth, actor-birth, tenant, onboarding, identidade/SSOT, schema, testes) + passe adversarial de verificação em 12 achados críticos; queries diretas em `pg_constraint`/`pg_indexes` para `profiles`/`global_users`/`users` e checagem de commingling `global_user_id → N users`.

---

## 2. Escopo

**Auditado (dentro do eixo):** tela de cadastro e login do frontend; payload enviado; contrato HTTP de `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/check-cpf`, `/auth/check-referral`; nascimento atômico `global_user → user → profile → identity → actor`; estratégia de tenant; `requiresOnboarding` e navegação pós-cadastro (AuthWrapper / ProtectedRoute / OnboardingWrapper / `/perfil`); persistência de dados civis (full_name, birthdate, gender, CPF) e seu SSOT; referral público; segurança no nascimento (spoof de tenant/actor); contrato frontend↔backend↔schema; testes vivos.

**Fora do escopo (apenas handoff, sem auditoria profunda):** perfil/abas após a primeira entrada; PJ/empresa; service/offering/marketplace; dinheiro/payout/split/recovery; agenda/booking; KYC material; frontend completo.

---

## 3. Mapa macro do fluxo

```
cadastro            → FECHA
  (Register.tsx → POST /auth/register, apiFetchPublic)
auth backend        → FECHA
  (register/login/refresh/logout/check-cpf/check-referral; Zod; bcrypt; JWT+token_version)
criação de user     → FECHA
  (users INSERT atômico, email único por tenant)
criação de actor    → FECHA
  (ensureUserActorTx DENTRO da transação; fail-closed → ROLLBACK; sem órfão)
tenant              → FECHA
  (server-side `unificard-inicial`; x-tenant-id IGNORADO; zero tenant user-*)
identity/dados civis→ FECHA_COM_RISCO
  (global_users SSOT por CPF; gender em global_users c/ CHECK; gravação pós-commit best-effort)
referral            → FECHA
  (público, server-side, erro técnico NÃO bloqueia; só 400/inválido bloqueia)
requiresOnboarding  → FECHA_COM_RISCO
  (true no register; computa no login; é HINT de UX, NÃO há gate de backend)
primeira tela       → FECHA
  (/perfil carrega com perfil vazio; modal + banner + CTAs; sem beco sem saída)
```

Elo mais frágil: **identity/dados civis** e **enforcement de onboarding** (ver §5 e §8).

---

## 4. Matriz do eixo

| item | fecha/não-fecha | evidência viva | blocker | risco | próxima frente | modo |
|---|---|---|---|---|---|---|
| tela de cadastro | FECHA | `Register.tsx:245-253` (payload), `:72-90`/`:101-138` (debounce cpf/referral) | não | baixo | — | FAST-PATH |
| payload frontend | FECHA | `{email,password,cpf,fullName?,birthdate?,gender?,referralCode?}` `Register.tsx:245-253` | não | baixo | — | FAST-PATH |
| register backend | FECHA | `auth.routes.ts:54-190`, `auth.service.ts:201-447` | não | baixo | — | FAST-PATH |
| login backend | FECHA | `auth.routes.ts:193-296`, `auth.service.ts:449-560` (lookup por email) | não | baixo | — | FAST-PATH |
| /me ou sessão | FECHA (via JWT) | sem rota `/auth/me`; sessão = JWT `auth.plugin.ts:10-124` (injeta `req.user`) | não | baixo | — | FAST-PATH |
| referral | FECHA | `auth.routes.ts:599-661`; erro técnico→500 honesto, não bloqueia (`Register.tsx:123-128`) | não | baixo | — | FAST-PATH |
| criação de user | FECHA | `auth.service.ts:317-332` (INSERT atômico) | não | baixo | — | FAST-PATH |
| criação de actor | FECHA | `auth.service.ts:353` `ensureUserActorTx` dentro da tx; fail-closed | não | baixo | — | FAST-PATH |
| tenant | FECHA | `auth.service.ts:213-226` (`unificard-inicial` server-side; `void tenantId`) | não | baixo | — | FAST-PATH |
| requiresOnboarding | FECHA_COM_RISCO | `auth.service.ts:440` (register=true), `:541-549` (login computa) | não | médio | onboarding enforcement | MODO B |
| redirect pós-cadastro | FECHA | `App.tsx:114-118` → `/perfil` se true | não | baixo | — | FAST-PATH |
| /perfil inicial | FECHA | `ProtectedRoute.tsx:20-22` (só auth+tenant); `Profile.tsx` hidrata vazio sem 404 | não | baixo | — | FAST-PATH |
| birthdate | FECHA | `auth.service.ts:303-307` grava `global_users.birthdate DATE` (atômico) | não | baixo | — | FAST-PATH |
| gender | FECHA_COM_RISCO | SSOT `global_users.gender` + CHECK; **gravação pós-commit best-effort** `auth.service.ts:387-400` | não | médio | tornar gender atômico ou re-prompt | MODO B |
| full_name | FECHA | gravado atômico em `global_users.full_name` `:303` | não | baixo | — | FAST-PATH |
| CPF/documento | FECHA_COM_RISCO | `global_users.cpf` UNIQUE; **sem gate de unicidade de CONTA por CPF no backend** | não (FE bloqueia) | alto | DECISION unicidade-de-conta-por-CPF | DECISION |
| metadata residual | FECHA | `profile.service.ts:278` remove `gender` do metadata (sem dual-write) | não | baixo | — | FAST-PATH |
| GET criando estado | FECHA_COM_RISCO | `payment-method.routes.ts:92` `getActiveActor→ensureUserActor` em GET (fail-closed, latente) | não | médio | read-purity | MODO B / HANDOFF AUTORIDADE |
| testes existentes | FECHA_COM_RISCO | 5 e2e vivos (birth/referral/PJ/groups); **sem e2e da jornada onboarding completa** | não | médio | e2e jornada | MODO B |

---

## 5. Achados críticos

> Os achados abaixo já incorporam o **passe adversarial de verificação** (12 críticos re-checados contra código/schema vivo). Onde o raio X inicial exagerou a severidade, a correção está marcada.

### ACTOR-01 — Nascimento atômico do actor (SAUDÁVEL, confirmado)
- **Descrição:** o actor humano nasce DENTRO da transação de cadastro (`global_user → user → profile → identity → actor`), via `ensureUserActorTx`. Falha em qualquer passo → ROLLBACK total. Token só após COMMIT.
- **Evidência:** `auth.service.ts:300-365` (`withTransaction`), `:353` (`ensureUserActorTx`); `actor.repository.ts:57-146`/`:157-215` fail-closed (lança se `global_user_id` ausente). DB: 8 users / 8 user-actors (1:1), 0 órfãos.
- **Impacto:** usuário nasce com identidade + actor válidos; não há reparo lazy em request autenticado.
- **Bloqueia MTP?** Não · **público?** Não · **dinheiro?** Não · **DECISION?** Não · **YALA?** Não · **Modo:** FAST-PATH.

### CAD/SSOT-CPF-01 — Backend NÃO impõe unicidade de CONTA por CPF (autoridade)
- **Descrição:** `global_users.cpf` é UNIQUE, então a **identidade global** é única por CPF. Mas o cadastro não rejeita uma SEGUNDA conta (email diferente) com o MESMO CPF: o `INSERT ... ON CONFLICT (cpf) DO UPDATE SET cpf = EXCLUDED.cpf` é no-op (preserva a identidade existente e **descarta silenciosamente** os `full_name`/`birthdate` novos enviados), depois cria um `users` novo apontando para o mesmo `global_user_id`, e `profiles` aceita (NÃO há UNIQUE de CPF em profiles — só `UNIQUE(tenant_id,user_id)`). Resultado possível: N contas → 1 `global_user_id`.
- **Correção adversarial vs. raio X inicial:** o framing "perda silenciosa de dados civis JÁ GRAVADOS" e "onboarding em beco sem saída" foi **REFUTADO/superdimensionado** — o `ON CONFLICT` *preserva* os dados existentes (não apaga); birthdate é opcional no register e **preenchível em `/perfil`** (a imutabilidade só trava pós-onboarding). O risco real é o **oposto**: dados NOVOS submetidos por um segundo registrante são ignorados, e ele herda a identidade do primeiro. A barreira hoje é só de **frontend** (`/auth/check-cpf` + botão desabilitado) — e frontend não é autoridade (viola "frontend nunca cria verdade").
- **Evidência:** `auth.service.ts:303-307`; live `pg_constraint`/`pg_indexes` em `profiles` → só `profiles_tenant_user_key UNIQUE(tenant_id,user_id)`, **sem** unique em `cpf`. DB hoje: `SELECT global_user_id, count(*) FROM users GROUP BY 1 HAVING count(*)>1` → **vazio** (sem commingling vivo; gap é latente, alcançável por chamada direta à API).
- **Impacto:** identidade — múltiplas contas sob um CPF por bypass de UI. "Commingling de bank_ledger" alegado pelo verificador é **provavelmente superestimado** (cada user tem actor_id próprio; dinheiro é keyed por actor/wallet, não por global_user_id) — exige confirmação da IA-BANCO.
- **Bloqueia MTP?** Não (happy-path bloqueado no FE) · **público?** Risco · **dinheiro?** Risco (confirmar IA-BANCO) · **DECISION?** SIM (política: CPF = 1 conta? múltiplas contas/tenants sob 1 CPF?) · **YALA?** SIM · **Modo:** DECISION · **Handoff:** IA-AUTORIDADE + IA-BANCO.

### GENDER-01 — Gender no SSOT certo, mas gravação pós-commit best-effort
- **Descrição:** SSOT de gender é `global_users.gender` (TEXT + CHECK de 5 valores), set-once via `setUserGenderIfAbsent` (`WHERE gender IS NULL`); `profile.service.ts:278` remove gender do metadata (sem dual-write). PORÉM no register o gender (e o re-`fullName`) são gravados no bloco **pós-commit best-effort** (`try/catch` que engole erro), não na transação atômica. `birthdate`/`full_name` SÃO atômicos no INSERT de `global_users`.
- **Evidência:** `auth.service.ts:387-400` (pós-commit `upsertProfile`, `catch` silencioso); `chk_global_users_gender` (live); `vocabulary.ts:9` `GENDER_VALUES`.
- **Impacto:** se o upsert pós-commit falhar, gender não persiste (nascimento segue válido). Vocabulário alinhado FE↔BE↔DB (sem divergência). Perda silenciosa possível só de gender, não de identidade.
- **Bloqueia MTP?** Não · **público?** Não · **dinheiro?** Não · **DECISION?** Não · **YALA?** Não · **Modo:** MODO B (tornar atômico ou re-prompt no onboarding).

### ACTOR-02 — GET cria estado por acidente (read-impurity, contido)
- **Descrição:** `GET /payment-methods` chama `getActiveActor → ensureUserActor`; se o actor não existir, o GET o criaria como efeito colateral (viola `F-C1-AUTO-REACHABLE-READ-PURITY`).
- **Correção adversarial:** a atribuição a `GET /economy/accounts/me` estava **ERRADA** (esse `getActiveActor` está no `GET /` de listagem, não no `/me`). O comportamento é **fail-closed** (lança, não cria silenciosamente, se faltar identidade). Como todo user já nasce com actor (ACTOR-01), o risco é **latente**.
- **Evidência:** `payment-method.routes.ts:66-115` (`:92`), `actor.helpers.ts:25`.
- **Bloqueia MTP?** Não · **público?** Risco · **dinheiro?** Não · **DECISION?** Não · **YALA?** SIM · **Modo:** MODO B · **Handoff:** IA-AUTORIDADE.

### ONBOARD-ENFORCE-01 — `requiresOnboarding` é HINT de UX, não gate de backend
- **Descrição:** `requiresOnboarding=true` sempre no register; no login = `!isOnboardingCompleted` (set quando `fullName+birthdate+gender` presentes). O frontend roteia `/perfil` vs `/home`, mas **nenhum middleware de backend** bloqueia features para quem não completou onboarding. Não há e2e da jornada completa (register→completar→relogar→`/home`).
- **Evidência:** `auth.service.ts:440`,`:541-549`; `profile.service.ts:309-359`; `App.tsx:117-118`; ausência de script `validate-pipeline-e2e-*` da jornada completa.
- **Correção adversarial:** o critério de completude **está definido** (3 campos), não é "indefinido"; o gap é (a) falta de e2e comportamental e (b) onboarding ser soft-gate.
- **Bloqueia MTP?** Parcial (se onboarding for pré-requisito de feature; se for opcional, não) · **público?** Parcial · **dinheiro?** Não · **DECISION?** SIM (onboarding é obrigatório?) · **YALA?** SIM · **Modo:** MODO B / DECISION.

### REF-ACTOR-01 — Sem UNIQUE de schema para user-actor (dedup só por app)
- **Descrição:** não há tabela `actor_users`; relação é `actors.user_id` (FK nullable). Não existe UNIQUE `(tenant_id,user_id,actor_type='user')` — a unicidade do actor humano é garantida só por idempotência de app (`findOrCreateUserActor`). Qualquer INSERT direto fora do writer canônico criaria duplicata silenciosa.
- **Evidência:** migration `0064` (FK + índice não-único); `actor.repository.ts:57-76`.
- **Bloqueia MTP?** Não · **público?** Risco · **dinheiro?** Não · **DECISION?** SIM (criar UNIQUE parcial?) · **YALA?** Não · **Modo:** DECISION · **Handoff:** IA-AUTORIDADE.

### DTO-TENANT-01 — tenantId vem do JWT; register continua se faltar
- **Descrição:** o frontend extrai `tenantId` do payload do JWT (não de `response.data.tenantId`). Login **aborta** com erro fatal se faltar; **register apenas loga e continua** para o onboarding.
- **Evidência:** `Register.tsx:255-271`, `Login.tsx:43-68`, `client.ts:204-248`.
- **Impacto:** baixo na prática (backend sempre embute `tenantId` no token). Inconsistência register vs login é cosmética/defensiva.
- **Bloqueia MTP?** Não · **público?** Não · **dinheiro?** Não (backend sempre emite tenantId) · **DECISION?** Não · **YALA?** Não · **Modo:** FAST-PATH (baixa prioridade).

### SEC — Segurança no nascimento (SAUDÁVEL)
- `RegisterBody`/`LoginBody` **não** aceitam `actor_id`/`tenant_id` (sem spoof). Tenant resolvido server-side; `x-tenant-id` ignorado no register, derivado do user no login, obrigatório no refresh/logout. Rate-limit multicamada (IP/tenant/email) com fail-open. `token_version` invalida sessões no logout. JWT é a única autoridade de tenant (`auth.plugin.ts`).

---

## 6. Gaps de conexão (frontend ↔ backend ↔ schema ↔ onboarding)

1. **Unicidade de CPF**: FE bloqueia via `check-cpf`; **BE não rejeita** segunda conta por CPF. Verdade de unicidade mora no frontend (anti-padrão). → CAD/SSOT-CPF-01.
2. **Gender**: contrato e schema alinhados, mas a gravação no nascimento é **pós-commit best-effort** (não atômica como birthdate/full_name). → GENDER-01.
3. **Onboarding**: `requiresOnboarding` é projeção; **não há enforcement de backend**. Frontend é o único guardião da jornada. → ONBOARD-ENFORCE-01.
4. **Read-purity**: `GET /payment-methods` pode materializar actor (latente, fail-closed). → ACTOR-02.
5. **Schema actor**: ausência de UNIQUE para user-actor; integridade confiada à idempotência de app. → REF-ACTOR-01.
6. **Cobertura de teste**: nascimento/referral/tenant provados; jornada onboarding ponta-a-ponta e provisionamento pós-commit (`actor_referral_codes`, best-effort) **sem e2e**.

---

## 7. Handoffs para outras IAs

- **IA-AUTORIDADE:** CAD/SSOT-CPF-01 (gate server-side de unicidade de conta por CPF), ACTOR-02 (read-purity em GET money), REF-ACTOR-01 (UNIQUE de user-actor). `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` segue OPEN.
- **IA-PERFIL-SSOT:** GENDER-01 (gravação atômica de gender), persistência/imutabilidade de dados civis pós-register (write-once por design, sem e2e), `is_profile_personal_confirmed` / DECISION-0120.
- **IA-BANCO:** confirmar/refutar "commingling de bank_ledger" se múltiplas contas compartilham `global_user_id` (suspeita de superestimação — dinheiro é por actor/wallet).
- **IA-ACTOR:** vocabulário `actor_type` (`user`/`actor_human`/`person` coexistem no CHECK; runtime usa só `user`).
- **IA-EMPRESA-PJ:** fluxo PJ/onboarding empresarial (fora deste eixo; e2e PJ já passa).
- **IA-FRONTEND-UX-CONTRATOS:** DTO-TENANT-01 (uniformizar register vs login no tenantId ausente); CTAs de onboarding.
- **IA-DECISOES-DT:** registrar DECISION de política de unicidade-de-conta-por-CPF e de obrigatoriedade de onboarding.

---

## 8. Riscos para MTP

- **Bloqueia MTP:** nada no happy-path. Cadastro→actor→tenant→`/perfil`→completar perfil funciona ponta-a-ponta e é provado na camada de nascimento.
- **Não bloqueia, mas deve ser corrigido (autoridade/integridade):** unicidade de conta por CPF no backend (CAD/SSOT-CPF-01); read-purity em `GET /payment-methods` (ACTOR-02); gravação atômica de gender (GENDER-01); UNIQUE de user-actor (REF-ACTOR-01).
- **Exige decisão de produto:** onboarding é obrigatório (gate de backend) ou opcional/progressivo? (ONBOARD-ENFORCE-01). Política de CPF (uma conta por CPF? convite cross-tenant — hoje `DT-C1-TENANT-INVITE-RESOLUTION-NO-SUBSTRATE`).
- **Só cleanup/cobertura:** e2e da jornada onboarding completa; teste de idempotência do provisionamento pós-commit; uniformizar DTO-TENANT-01.

---

## 9. Veredito final

**FECHA_COM_RISCO.**

O nascimento do usuário é **estruturalmente sólido**: atômico, fail-closed, sem órfãos, tenant resolvido server-side (sem fragmentação, sem spoof), identidade ancorada por CPF, actor válido no nascimento, referral não-bloqueante, primeira tela sem beco sem saída. Os riscos são **de autoridade/integridade e de decisão de produto** — não de happy-path: (1) ausência de gate server-side de unicidade de conta por CPF (barreira só no frontend), (2) onboarding como hint de UX sem enforcement de backend, (3) gravação de gender best-effort, (4) read-impurity latente em GET de dinheiro, (5) ausência de UNIQUE de schema para user-actor.

---

## 10. Próxima frente recomendada

**Modo: DECISION** → seguida de **MODO B**.

A próxima raiz é **decisão-dependente**, não executora-autônoma: antes de codar, Clayton/IA-DIRETORA precisa promulgar **(a) política de unicidade-de-conta-por-CPF** (uma identidade global = quantas contas? gate server-side fail-closed no register?) e **(b) se o onboarding é obrigatório** (gate de backend) ou progressivo. Com a DECISION tomada, a execução é MODO B cirúrgico: gate de CPF no register + (opcional) middleware de onboarding + gravação atômica de gender + read-purity em `GET /payment-methods`. Mapear como **HANDOFF_AUTORIDADE** para a IA de autoridade conduzir o gate de identidade, com confirmação da IA-BANCO sobre commingling.

Justificativa: o eixo "fecha com risco" e nenhum risco bloqueia o MTP do happy-path; portanto não há urgência de FAST-PATH, e abrir código sem a política de CPF/onboarding seria a executora decidindo o que cabe à norma.

---

## 11. Resumo executivo (≤10 bullets)

- Cadastro **FECHA_COM_RISCO**; nascimento `global_user→user→profile→identity→actor` é **atômico e fail-closed** (8 users / 8 actors / 0 órfãos).
- Usuário **nasce com actor válido SIM** (criado na transação, não lazy); reads não criam actor no happy-path.
- Tenant **NÃO é isolado por usuário**: register resolve `unificard-inicial` server-side e ignora `x-tenant-id`; tenant `user-*` legado existe mas inerte.
- **Sem spoof** de tenant/actor (body não aceita `actor_id`/`tenant_id`); rate-limit multicamada; sessão via JWT+`token_version` (não há rota `/auth/me`).
- **Risco alto (autoridade):** backend não impõe unicidade de conta por CPF — só o frontend (`check-cpf`) bloqueia; gap latente (sem commingling vivo hoje). Exige DECISION.
- Birthdate/full_name gravados **atomicamente** em `global_users`; **gender** vai por caminho **pós-commit best-effort** (pode falhar silenciosamente) — SSOT e vocabulário corretos.
- **Sem perda de dados civis já gravados** (o `ON CONFLICT` preserva); o framing inicial de "perda silenciosa/beco sem saída" foi superdimensionado e corrigido no passe adversarial.
- `requiresOnboarding` leva à tela certa (`/perfil`) **SIM**, mas é **hint de UX sem enforcement de backend**; falta e2e da jornada completa.
- Referral **não bloqueia** cadastro por erro técnico (429/500/rede → indeterminado); só 400/inválido bloqueia.
- Veredito: **FECHA_COM_RISCO** · MTP **NÃO_BLOQUEIA** · próxima frente **DECISION (unicidade-CPF + onboarding) → MODO B / HANDOFF_AUTORIDADE**.
