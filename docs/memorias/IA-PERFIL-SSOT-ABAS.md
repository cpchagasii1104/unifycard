# IA-02 — Perfil/SSOT/Abas

> RAIO X READ-ONLY. Nenhum código/runtime/migration/norma/decision/DT/status foi editado. Sem commit. Único arquivo escrito: este.

## 1. Carimbo

* **HEAD:** `aaeb50b5182120888a72418775a9d211e33bff4d`
* **Branch:** `rescue-structural`
* **Data/hora:** 2026-06-21
* **Git status:** sujo (apenas docs/memorias/* e artefatos .txt/.png pré-existentes; nenhuma mudança feita por esta auditoria)
* **READ-ONLY confirmado:** SIM — só leitura de código + queries `SELECT` read-only (colunas explícitas, sem `SELECT *`, sem `insert/update/delete/migration`)
* **Arquivo criado/atualizado:** `docs/memorias/IA-02-PERFIL-SSOT-ABAS.md` (criado)
* **Banco/schema consultado:** `unificard_dev` (274 tabelas; via `DATABASE_URL` read-only)
* **Comandos/probes usados:** `git rev-parse/branch/status`, `rg`/`grep` amplo no front+back, `Read` de rotas/services/forms, `psql` em `information_schema.columns`, `pg_constraint`, e `count(*)`/`group by` agregados nas tabelas civis/concept/availability
* **Método de síntese:** 9 agentes de recon read-only em paralelo (frontend-abas, backend-autoridade, ssot-civil, metadata-residual, gender-birthdate, profissional-concepts, interesses-agenda, frontend-api-contract, db-schema-tests) + cross-check. **Ressalva de integridade:** o agente crítico de completude falhou por erro transitório de servidor (529 Overloaded); o cross-check de contradições/lacunas foi refeito manualmente sobre os 9 retornos (convergências confirmadas: full_name dual-write, split-brain `can_edit_personal_data`, CPF multiplicado, birthdate fill 1/8 coerente com 1 único usuário PF).

## 2. Escopo

**Auditado:** rota `/perfil` (frontend) + wrappers de auth/onboarding; as 8 abas reais do perfil; SSOT civil (full_name, birthdate, gender, CPF, telefone, email); SSOT profissional (concepts) e ponte category→concept; metadata residual e flags decisórias; gender e birthdate ponta a ponta; interesses (C1) e agenda-no-perfil (availability); contrato frontend/API (payloads/DTOs/drops/501/placebo/apiFetch); autoridade no UPDATE de perfil; schema vivo das tabelas civis/concept/availability; testes existentes.

**Fora (registrado como handoff, não aprofundado):** cadastro/auth completo, criação de empresa/PJ, services/offers/marketplace, produtos/locação/assinatura, dinheiro/payout/split/recovery, booking/conflito de agenda, logística/presença, grants/delegação de autoridade.

## 3. Mapa macro do fluxo

```
usuário autenticado            FECHA  (ProtectedRoute exige token+tenant; redirect pós-registro → /perfil)
   ↓
/perfil (Profile.tsx)          FECHA_COM_RISCO  (carrega p/ usuário novo sem beco; riscos = UX/higiene)
   ↓
8 abas
   ├─ Pessoal                  FECHA_COM_RISCO  (grava identity+profile+residence; split-brain de trava civil)
   ├─ Profissional (C1)        FECHA            (concept_id soberano; legado 501)
   ├─ Interesses (C1)          FECHA            (actor_interest_concepts; blob limpo)
   ├─ Aprendizado (C1)         FECHA            (learningC1; legado 501)
   ├─ Saúde                    FECHA            (placebo HONESTO 501 — DECISION-0071)
   ├─ Agenda                   FECHA            (SSOT availability; purpose_concept_id)
   ├─ Educação                 FECHA            (event-sourced actor_events)
   └─ PJ (legal)               FECHA            (CompaniesManager; fora do eixo profundo)
   ↓
persistência
   ├─ birthdate/gender         FECHA            (global_users, set-once gender)
   ├─ full_name                FECHA_COM_RISCO  (dois donos de escrita: global_users vs profiles, sem sync)
   ├─ CPF                      FECHA_COM_RISCO  (em até 4 tabelas; UNIQUE só em global_users)
   └─ trava edição civil       NÃO_FECHA        (3 fontes divergem: identity vs profiles.flag vs core.service)
   ↓
SSOT correto
   ├─ identity (civil/KYB)     FECHA_COM_RISCO  (8/16 identities órfãs de global_users, sem FK — handoff)
   ├─ concepts (semântica)     FECHA
   └─ availability (tempo)     FECHA
   ↓
handoff → IA-AUTORIDADE / IA-SEMANTICA(SSOT) / IA-BANCO / IA-TEMPO / IA-MARKETPLACE
```

## 4. Matriz do eixo

| item | fecha/não-fecha | evidência viva | blocker | risco | próxima frente | modo |
|---|---|---|---|---|---|---|
| rota /perfil | FECHA | App.tsx:288 dentro de ProtectedRoute(255)+SocialLayout; ProtectedRoute.tsx:20 token+tenant; redirect App.tsx:118 | — | OnboardingWrapper não cobre /perfil; usa localStorage só p/ escolher tela | — | FAST-PATH |
| carregamento inicial do perfil | FECHA | Profile.tsx:241-249 loadData pós sessionReady; personal_profile=null tratado (360-497); 409 identity não dispara (DB: 8/8 users c/ global_user_id) | — | console.log pesado sem guard DEV (331,344,425,576) | — | FAST-PATH |
| aba dados pessoais | FECHA_COM_RISCO | ProfilePersonalForm; salva updateIdentity+updateProfile+putResidenceAddress (vivos) | split-brain de trava civil (ver SSOT/META) | nome editado pode ser descartado em silêncio | MODO_B_SSOT_PROFILE | MODO B |
| aba dados profissionais | FECHA | ProfileProfessional.tsx:18-22 professionalC1 (concept_id); legado /profile/professional=501 | — | categoria como breadcrumb obrigatório na UI | — | FAST-PATH |
| aba interesses | FECHA | actor_interest_concepts(concept_id+source_category_id); ponte enforced interest-c1.service.ts:66-84; blob interests=[] | — | 7/45 categorias interest sem concept_id (graceful) | IA-SEMANTICA (seed) | FAST-PATH |
| aba agenda | FECHA | ProfileAgenda.tsx:23,32 SSOT availability via PUT /availability/weekly-template; purpose_concept_id | — | rate-limit 60/min no load | IA-TEMPO | FAST-PATH |
| update de perfil (PUT /profile) | FECHA_COM_RISCO | profile.routes.ts:118 userId=req.user.userId (JWT, não body); NÃO aceita actor_id/x-actor-id; NÃO usa ensureUserActor | self-only (sem spoof) MAS escreve por user_id ignorando activeActor (viola actor-first) | perfil é ilha user-keyed; representação/delegação futura sem caminho | HANDOFF_AUTORIDADE | MODO B |
| SSOT full_name | FECHA_COM_RISCO | global_users.full_name (register auth.service.ts:303) vs profiles.full_name (PUT profile.service.ts:384-390); getProfile lê profiles; 0/8 divergente hoje | dois donos de escrita sem sync | drift latente entre perfil e identidade | DECISION_SSOT_CIVIL | DECISION |
| SSOT birthdate | FECHA_COM_RISCO | global_users.birthdate (DATE); set-once de fato só no register; provado vivo (cpchagasii=1981-04-11) | imutabilidade só no frontend (Profile.tsx:852); backend UPDATE sem WHERE birthdate IS NULL | sobrescrita via API direta (cliente como autoridade) | HANDOFF_AUTORIDADE | DECISION |
| SSOT gender | FECHA | global_users.gender + CHECK chk_global_users_gender (5 valores); set-once WHERE gender IS NULL; blob 0 resíduo | — | transporte ainda via metadata.gender; comentário estale auth.service.ts:386 | MODO_B_GENDER_BIRTHDATE (hygiene) | FAST-PATH |
| SSOT CPF/documento | FECHA_COM_RISCO | cpf em até 4 tabelas (profiles/user_profiles/global_users/identities.tax_id); UNIQUE só em global_users; mismatch=0 hoje | profiles.cpf e user_profiles.cpf sem UNIQUE | drift silencioso entre cópias (LGPD) | DECISION_SSOT_CIVIL (DECISION-0062 execução pendente) | DECISION |
| metadata residual (schedule/interests/skills/learnings) | FECHA | DB: 0 profiles com essas chaves; guard 400 ativo (unified-availability.routes.ts:223-227) | — | baixo (drenado + guard) | — | FAST-PATH |
| profile_personal_confirmed (col + metadata) | FECHA_COM_RISCO | tombstone deprecado ainda LIDO em core.service.ts:250-252; confirmFirstAccess não escreve mais | core.service usa flag legada como fonte | projeção can_edit divergente da identity (7/8) | MODO_B_METADATA_CLEANUP | MODO C |
| personal_data_locked | NÃO_FECHA | profile.service.ts:215,220-225,304-307 bloqueia/grava fullName por metadata.personal_data_locked, paralelo à identity; DB: 8 profiles flag=true | autoridade paralela de trava civil no write path | write silenciosamente recusa edição independente da identity | HANDOFF_AUTORIDADE | DECISION |
| canEditPersonalData / lockIdentityCore | FECHA_COM_RISCO | canEditPersonalData (profile.service.ts:628) e frontend lockIdentityCore (Profile.tsx:551,560) delegam à identity (corretos); MAS core.service.ts:316 expõe valor divergente | mesmo campo respondido por 2 rotas com valores divergentes | consumidor de personal_profile.can_edit_personal_data lê errado | MODO_B_SSOT_PROFILE | DECISION |
| dados profissionais (substrato) | FECHA_COM_RISCO | C1 vivo (concept_id); MAS service LEGADO category_id ainda wired em core.service.ts:363 + profile-inference.service.ts:250 (tabelas alvo ausentes → try/catch) + 15 console.log | verdade-paralela latente se tabelas legadas reaparecerem | devLog; reativação acidental | MODO B (DT-DEAD-PROFESSIONAL-LEGACY-SUBSTRATE) | MODO B |
| interesses/categorias/concepts | FECHA_COM_RISCO | category-navigation-bridge exige concept_id NOT NULL; DB: só 77/147 categorias com concept_id | cobertura parcial da ponte de navegação | categorias sem concept bloqueiam derivação (400); semântica C1 intacta | IA-SEMANTICA (backfill) | MODO C |
| agenda/availability | FECHA | DB availability=48, start/end TIMESTAMPTZ, purpose_concept_id (24 populados); sem metadata.schedule (guard 400) | — | — | IA-TEMPO | FAST-PATH |
| endpoints ghost | FECHA_COM_RISCO | backend 501 honesto (professional/learning/health); MAS frontend tem clients vivos sobre 501 sem caller (api/learning.ts, api/health.ts + ProfileHealthForm ~1100 linhas não renderizado) | clients/form mortos no bundle | reuso/reativação acidental bate em 501 | FAST-PATH_PROFILE_DTO (cleanup front) | MODO B |
| testes existentes | NÃO_FECHA | só category-navigation-bridge.test.ts; src/core/identity sem __tests__; 0 testes de birthdate/gender/confirmação civil | ausência de rede de segurança no SSOT civil | regressões silenciosas | MODO B | MODO B |

## 5. Achados críticos

### SSOT / Autoridade civil (núcleo do eixo)

* **SSOT-01 / SSOT-03 — full_name com dois donos de escrita.** Register grava `global_users.full_name` (SSOT); `PUT /profile` grava só `profiles.full_name` (CASE só-se-vazio) + sincroniza `actor display_name`, **nunca** propaga p/ `global_users`. `getProfile` lê `profiles.full_name`. Hoje 0/8 divergentes (seed coincidente), sem garantia. Evidência: auth.service.ts:303; profile.service.ts:139,384-393; identity.service.ts:552. **blocksPublic=true, needsDecision=true, needsYala=true.** Handoff: IA-SEMANTICA/SSOT.
* **SSOT-02 / DB-03 — CPF em até 4 tabelas sem mapper único.** `global_users.cpf` (UNIQUE, SSOT) + `profiles.cpf` + `user_profiles.cpf` (63 linhas, população maior/legada) + `identities.tax_id`. `profile.service.ts:433` chama `user_profiles.cpf` de "fonte operacional do CORE", conflitando com global_users. UNIQUE só no SSOT. Evidência: profile.service.ts:433-491; auth.service.ts:303,338. **needsDecision, exige Yala.** DECISION-0062 (CPF SSOT) já existe → execução F4/F5 pendente. Handoff: IA-BANCO.
* **META-01 / SSOT-03 — `personal_data_locked` governa o write path de fullName em paralelo à autoridade identity.** `profile.service.ts:215` lê `profiles.metadata.personal_data_locked` e, se true, **descarta silenciosamente** fullName do payload (220-225); grava a flag no 1º save (304-307). DECISION-0120 já move a trava civil p/ a camada identity (events). DB: 7/8 profiles com `is_profile_personal_confirmed=false` MAS `personal_data_locked=true`, e 8 eventos `civil_data_confirmed`. **PERIGOSO/AUTORIDADE_INDEVIDA. blocksPublic=true, needsDecision, exige Yala.** Handoff: IA-AUTORIDADE.
* **SSOT-04 / META-02 — split-brain de `can_edit_personal_data`.** `GET /profile`/`core.service.ts:316` projeta de flags legadas (`is_profile_personal_confirmed`); `GET /identity/me` (identity.routes.ts:112) projeta da autoridade canônica (DECISION-0120). Três fontes respondem à mesma pergunta material com valores divergentes em 7/8 usuários. **Mitigante:** o frontend (`lockIdentityCore`, Profile.tsx:551,560) usa a fonte identity — o cadeado visual está correto hoje; o risco é o write path backend + qualquer outro consumidor. **exige Yala.**
* **BIRTHDATE-02 — imutabilidade do nascimento só no frontend.** Diferente de gender (set-once real `WHERE gender IS NULL`), `updateGlobalIdentity` faz `UPDATE` puro sem guard. `POST /identity/update` com birthdate diferente sobrescreve o nascimento confirmado — cliente como autoridade. Evidência: identity.service.ts:678-746 vs :441; Profile.tsx:852. **needsDecision, exige Yala.** Handoff: IA-AUTORIDADE/DT.

### Estrutura de banco

* **DB-02 — 8/16 `identities` órfãs de `global_users`, sem FK.** `identities` (PK global_user_id, 16 linhas) não tem FK p/ global_users; 8 linhas sem registro civil correspondente. Split de SSOT de identidade sem integridade referencial. Agente marcou **blocksMTP=true** — porém é camada identity/KYB (provavelmente identidades PJ/empresa), tangencial ao núcleo PF do perfil. **Handoff: IA-AUTORIDADE/IA-BANCO** (decisão soberana, não executora).
* **DB-04 — gender com empty-string em 7/8 linhas** (deveria ser NULL); coluna sem default canônico. Higiene de SSOT.
* **DB-06 — `identity.service.ts` loga PII (full_name/birthdate) em 37 `console.*`** (:734-739, :749-758). Viola invariante "sem devLog" + risco LGPD em público. **blocksPublic=true.**
* **DB-05 — `actor_self_facts` não existe no banco vivo** (só protótipo `C:\teste`). Tese actor-first de onboarding sem substrato de persistência. INCONCLUSIVE / informativo.

### Profissional / Semântica

* **PROF-01 (FECHA) — perfil profissional vivo usa `concept_id` soberano** (FK ON DELETE RESTRICT → concepts); `source_category_id` é breadcrumb nullable. Aba selada (SELO_A3_2).
* **PROF-02 — service profissional LEGADO (`category_id`=significado, keyed por global_user_id, 15 console.log) ainda wired** em `core.service.ts:363` e `profile-inference.service.ts:250`. Tabelas alvo ausentes → chamada lança e é engolida por try/catch (verdade-paralela latente, não ativa). DT-DEAD-PROFESSIONAL-LEGACY-SUBSTRATE já registrada.
* **PROF-03 / interesses — ponte category→concept parcial:** 77/147 categorias com concept_id (70 NULL); 7/45 categorias `scope='interest'` sem concept (não-declaráveis, degradação graceful). Convergência assintótica de catálogo. Handoff: IA-SEMANTICA.

### Contrato frontend/API

* **FRONT-01 — DTO `Profile` do frontend usa snake_case; backend retorna camelCase.** `profile_personal_confirmed`/`can_edit_personal_data` (api/profile.ts:13-14) chegam **sempre undefined** (backend retorna `profilePersonalConfirmed`/`canEditPersonalData`, profile.service.ts:120-121). Contrato morto/enganoso; sem caller hoje, bug latente se religado.
* **FRONT-02 / FRONT-03 — clients vivos sobre rotas 501 sem caller:** `api/learning.ts` e `api/health.ts` + `ProfileHealthForm.tsx` (~1100 linhas, totalmente wired a upsertHealthFact) presentes no bundle mas não renderizados (a aba Saúde monta `ProfileHealth.tsx`, versão segura). Resíduo morto, armadilha de manutenção.
* **FRONT-04 — `useProfessionalContext` lê `metadata.professional_areas`**, campo só escrito por `seed-test-ecosystem.ts`. Em produção o contexto profissional do header vem sempre vazio (o dado real é concepts C1). Leitura fantasma. Handoff: IA-PROFISSIONAL.
* **FRONT-05 — `PUT /profile/physical` aceita `interests/lifestyle/sexualOrientation` no Body e os dropa em silêncio** (service hardcode `interests=[]`, lifestyle sem sexualOrientation — DECISION-0071/F5). Frontend já não envia. Contrato promete campos LGPD-sensíveis que são engolidos sem erro.
* **FRONT-06 — `PUT /profile/physical` retorna objeto cru (sem envelope `{ok,data}`); client não checa `.ok`** → falha do save físico pode passar como sucesso.
* **FRONT-07 / PERFIL-04 — PII em `console.log` no frontend + UX por `alert()`/`window.location.reload()`** (profile.ts:36, identity.ts:216, Profile.tsx:308,1017,1023). Higiene.

## 6. Gaps de conexão

* **camelCase ↔ snake_case** no DTO canônico de `/profile` (FRONT-01) — dois campos sempre undefined.
* **`can_edit_personal_data`** servido por `GET /profile` (flags legadas) ≠ `GET /identity/me` (autoridade DECISION-0120) — frontend escolhe a fonte certa, mas o backend mantém duas.
* **full_name**: escrito por `/identity` e `/profile` em tabelas diferentes; lido de `profiles` — write e read não convergem no SSOT.
* **`metadata.professional_areas`** lido pelo header mas só escrito por seed; dado real (concepts C1) não alimenta a projeção.
* **endereço residencial**: `Profile.tsx:440` lê `coreProfile.addresses` enquanto `core.service.ts:459-465` ainda lê `profiles.metadata.address` (possível dupla fonte); write vai p/ Location Core. **INCONCLUSIVE** → SSOT/DB.
* **clients/form** apontando p/ rotas 501 (learning/health) sem caller — superfície fantasma no bundle.

## 7. Handoffs para outras IAs

* **IA-CADASTRO-ONBOARDING:** OnboardingWrapper baseado em localStorage (escolhe tela, não cria verdade); fluxo de primeiro acesso/modal; `actor_self_facts` ausente (substrato de onboarding actor-first não materializado).
* **IA-ACTOR:** perfil escreve por `user_id` sem passar por `ensureUserActor`/activeActor (única sub-rota actor-first = residence-address); `actors` 2/10 com global_user_id NULL (páginas); dual-key `users.id`/`users.user_id`.
* **IA-AUTORIDADE:** trava de edição civil split-brain (META-01/SSOT-04); write path `personal_data_locked` paralelo à identity; birthdate sem guard set-once no backend; `identities` 8/16 órfãs sem FK; quem pode editar dado civil.
* **IA-EMPRESA-PJ:** aba "legal" = CompaniesManager; `company_concept_publications` (ponte concept-based de empresa, coerente).
* **IA-SEMANTICA / SSOT:** consolidar SSOT de full_name (writer/reader único); CPF 4-tabelas → 1 dono; backfill concept_id (70/147 categorias, 7/45 interest); blob `metadata` aberto (`additionalProperties:true`) sem allowlist.
* **IA-TEMPO:** agenda operacional/booking/conflito além da grade do perfil (perfil já usa availability corretamente).
* **IA-FRONTEND-UX-CONTRATOS:** FRONT-01..07 (DTO camel/snake, clients 501 mortos, envelope físico, PII em log, alert/reload, professional_areas fantasma).
* **IA-BANCO:** FK `identities↔global_users`; UNIQUE em profiles.cpf/user_profiles.cpf; 63 linhas órfãs em user_profiles; gender empty-string; PII em logs.
* **IA-DECISOES-DT:** DECISION_SSOT_CIVIL (full_name+CPF soberania); execução DECISION-0062/0120; DT-DEAD-PROFESSIONAL-LEGACY-SUBSTRATE.
* **IA-MARKETPLACE:** preço/oferta no legado profissional (hourly_rate/predefined_services/combo_discount_rules); consumidores downstream de concepts/interesses.

## 8. Riscos para MTP

* **Bloqueia MTP (núcleo perfil):** nada impede o usuário de ver/preencher/salvar o perfil. A tela fecha sem beco para usuário novo.
* **Bloqueia MTP de forma PARCIAL (correção material antes de escalar público):**
  - Trava de edição civil split-brain — `PUT /profile` pode **descartar silenciosamente** o nome editado pelo usuário (META-01); o que a UI promete pode contradizer o que o backend faz.
  - birthdate sem guard set-once no backend — dado civil imutável sobrescrevível via API direta.
  - PII civil em logs (identity.service.ts, frontend) — risco LGPD em ambiente público.
* **Não bloqueia, mas deve ser corrigido (SSOT/coerência):** full_name dois donos; CPF em 4 tabelas; `can_edit_personal_data` divergente; FRONT-01/06 (drops/envelope silenciosos).
* **Cleanup (higiene):** clients/form 501 mortos; console.log/alert/reload; gender transporte legado + comentário estale; gender empty-string; professional_areas fantasma; service profissional legado wired.
* **Exige decisão de produto/soberania:** qual tabela é dona de full_name e CPF; destino de `user_profiles` (63 linhas); FK `identities↔global_users` (toca identity/KYB).

## 9. Veredito final

**FECHA_COM_RISCO.**

A superfície do perfil **fecha** — usuário novo entra sem beco, todas as abas de escrita material apontam para endpoints vivos C1/SSOT, gender e agenda estão convergidos e o perfil é self-only (sem vetor de spoof DECISION-0113). O que rebaixa de FECHA para FECHA_COM_RISCO são riscos **materiais de SSOT e autoridade civil**, não becos: a trava de edição civil está em split-brain entre três fontes (com divergência viva em 7/8 profiles e descarte silencioso de fullName), full_name e CPF não têm dono único, birthdate não tem guard set-once no backend, e há PII em logs. Esses pontos não impedem o uso, mas comprometem a coerência (Lei de Coerência Sistêmica) e a confiança do dado civil antes de um público real.

* **Pergunta 1** (/perfil fecha p/ usuário novo): **FECHA_COM_RISCO**
* **Pergunta 2** (SSOT correto p/ civil): **PARCIAL** (birthdate/gender ok; full_name dois donos; CPF multiplicado)
* **Pergunta 3** (civil depende de profiles.metadata): **PARCIAL** (valores não; estado decisório de trava SIM — `personal_data_locked`)
* **Pergunta 4** (flags residuais governam comportamento): **SIM** (`personal_data_locked` no write path; `can_edit_personal_data` divergente no core.service)
* **Pergunta 5** (gender coerente front/back/schema): **SIM** (ressalva: transporte legado via metadata.gender)
* **Pergunta 6** (birthdate coletado/enviado/persistido/exibido): **SIM** (ressalva material: imutabilidade só no frontend)
* **Pergunta 7** (profissional usa CONCEPT): **SIM**
* **Pergunta 8** (perfil usa categorias/metadata como significado): **RISCO/PARCIAL** (caminho vivo usa concept; legado category-based ainda wired; ponte parcial)
* **Pergunta 9** (agenda usa availability ou metadata): **AVAILABILITY**
* **Pergunta 10** (eixo bloqueia MTP): **BLOQUEIA_PARCIAL** (núcleo navegável; trava civil + birthdate + PII em log exigem correção antes de público)

## 10. Próxima frente recomendada

**Modo primário: DECISION → `DECISION_SSOT_CIVIL`**, com fatia executável imediata em **`MODO_B_SSOT_PROFILE`**.

Justificativa: o cluster de maior alavancagem do eixo é a **soberania do dado civil** — full_name (dois donos), CPF (4 tabelas, `user_profiles` 63 linhas), e a trava de edição civil (3 fontes). A parte que é *execução de norma já promulgada* (DECISION-0120 civil-confirmation + DECISION-0062 CPF SSOT) pode entrar como **MODO B** assim que decidido: unificar `GET /profile` e o write path de `upsertProfile` para delegarem a autoridade de trava ao `identityCivilConfirmationService` (remover `personal_data_locked` como decisor) e eliminar a projeção divergente em `core.service.ts:316`. A parte que é *decisão soberana inédita* — qual tabela é dona de full_name/CPF, destino de `user_profiles`, e a FK `identities↔global_users` — exige **DECISION** (e Yala) porque toca identidade/authority e não é ato de executora.

Sequência sugerida (insumo, não diretriz): (1) DECISION_SSOT_CIVIL define donos; (2) MODO_B_SSOT_PROFILE executa a unificação da trava civil sob DECISION-0120; (3) HANDOFF_AUTORIDADE p/ birthdate set-once + FK identities; (4) cleanup higiene (FAST-PATH/MODO_B): clients 501 mortos, PII em log, FRONT-01/06, professional_areas. **HOLD** sobre qualquer mexida em `user_profiles`/`identities` até DECISION.

## 11. Resumo executivo

* O perfil **fecha para usuário novo sem beco**: ProtectedRoute + 8 abas, das quais Profissional/Interesses/Aprendizado/Agenda/Educação são C1/SSOT vivos e Saúde é placebo honesto 501 (DECISION-0071).
* Perfil é **self-only por JWT** — sem vetor de spoof DECISION-0113 — mas escreve por `user_id` **ignorando o activeActor** (viola actor-first; única exceção correta = residence-address).
* **Trava de edição civil em split-brain (NÃO_FECHA):** 3 fontes divergem (identity vs `profiles.personal_data_locked` vs `core.service`); o write path pode **descartar o nome editado em silêncio**; divergência viva em 7/8 profiles.
* **full_name tem dois donos de escrita** (global_users vs profiles, sem sync) e **CPF vive em até 4 tabelas** com UNIQUE só no SSOT — drift latente mascarado por seed.
* **gender** convergido (CHECK 5 valores, set-once, blob limpo); **birthdate** persiste/exibe corretamente mas **imutabilidade só no frontend** (backend sem guard set-once).
* **Semântica via CONCEPT está correta** em profissional/interesses/agenda (`concept_id` soberano, `source_category_id` breadcrumb); ponte category→concept parcial (77/147).
* **Service profissional legado** (`category_id`, console.log) ainda wired em 2 callers, mas inerte (tabelas ausentes → try/catch).
* **Contrato frontend/API** carrega resíduos: DTO camel/snake (campos undefined), clients/form 501 mortos no bundle, `professional_areas` fantasma, drop silencioso de campos LGPD em /physical, envelope cru no PUT físico.
* **Banco:** 8/16 `identities` órfãs de global_users sem FK; PII (full_name/birthdate) em 37 `console.*` no identity.service; `actor_self_facts` inexistente; **zero testes** de SSOT civil/onboarding.
* **Veredito FECHA_COM_RISCO; MTP BLOQUEIA_PARCIAL.** Próxima frente: **DECISION_SSOT_CIVIL** (soberania full_name/CPF/FK) + fatia **MODO_B_SSOT_PROFILE** (unificar trava civil sob DECISION-0120 já promulgada).
