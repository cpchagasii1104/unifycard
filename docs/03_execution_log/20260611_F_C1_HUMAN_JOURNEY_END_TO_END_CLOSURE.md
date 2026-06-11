# Execution Log — F-C1-HUMAN-JOURNEY-END-TO-END-CLOSURE

**Data:** 2026-06-11
**Frente:** `F-C1-HUMAN-JOURNEY-END-TO-END-CLOSURE` (macrofrente integrada, checkpoints seriais sem micro-GOs)
**HEAD origem:** `970dc455` (pós-PASS Yala da read purity) · **Branch:** `rescue-structural` · migrations 367→**368**
**Modo:** MIGRATION + BACKEND + FRONTEND + E2E + GATE + DOCS
**Governado por:** GO integrado IA Diretora 2026-06-11 + DECISION-0115 (D1/D2/D3) + DECISION-0080 (+adendo) + DECISION-0062/0074/0113 + LEI_COERENCIA §4.8

---

## 0. Reancoragem + READ-FIRST

HEAD `970dc455` confirmado; 367/367 migrations; tenant `unificard-inicial` vivo (3 tenants);
drift pré-existente intocado (MINHA_MEMORIA_DT/TEMPO/YALA, tmpschema.ts, protegidos).
READ-FIRST via fan-out de 5 auditorias READ-ONLY (gender / perfil pessoal / trilhos C1 /
agenda / Home+identity-me) + leitura direta de todos os arquivos editados.

## CHECKPOINT 0 — Mapa da jornada (gaps materiais)

| Gap | Classe | Veredito |
|-----|--------|----------|
| Register UI oferece 5 gender; zod/CHECK aceitam 3 → 2 opções QUEBRAM o cadastro | BLOCKER | corrigido (CP1) |
| /identity/me fabrica perfil parcial 200 em cadeia quebrada | UX_MISREPRESENTATION | corrigido (CP2) |
| Aliases mortos GET/PUT /profile/profile | LEGACY_FALLBACK | removidos (CP3) |
| /bank/balance/statement/regional-fund: catch → 200+zero/empty/null falso | UX_MISREPRESENTATION (financeira) | corrigido (CP7) |
| api/bank.ts fabrica balanceCents:0 em 401/403 | UX_MISREPRESENTATION | corrigido (CP7) |
| DashboardHome exibe R$ 0,00 p/ null | UX_MISREPRESENTATION | corrigido (CP7) |
| getSystemAccount lança em ausência → reader do fundo 500 p/ fundo não configurado | CONTRACT_DRIFT | corrigido no READER (CP7) |
| Trilhos C1 prof/learning/interest + agenda | — | já canônicos (auditado; prova E2E) |
| PJ tabs re-mascaram extrato; targeting 3v | OUT_OF_SCOPE | DTs registradas |

## CHECKPOINT 1 — GENDER 5 VALORES (CLOSED)

- `packages/contracts/vocabulary.ts`: `GENDER_VALUES = male|female|non_binary|other|prefer_not_to_say` (zod do register herda).
- Migration `20260611130000_expand_global_users_gender_vocabulary.sql`: CHECK 3→5, guard fail-closed, idempotente, dado vivo preservado (1 male + NULLs). Aplicada (368).
- `setUserGenderIfAbsent` (writer canônico set-once) + extração de `upsertProfile` + `hasGender` (core+profile) + validação de completude → `isGender` (5v). Blob continua STRIPADO (gender nunca em metadata).
- `auth.service.register` signature → `Gender` (contracts). Cadeia do register INALTERADA: register → upsertProfile(metadata.gender) → extração → setUserGenderIfAbsent → `global_users.gender` (progressivo pós-commit, DECISION-0115 D3).
- Frontend: `ProfilePersonalForm` 2→5 opções (rótulos do Register); `useProfilePersonalState`/`Profile.tsx` tipados com `Gender`.
- Prova: E2E matriz dos 5 valores (register 201 + `global_users.gender` exato + espelho na releitura + relogin); inválido → 400; blob sem chave gender.
- DECISION-0080: ADENDO factual (5 valores; F2/F3 fechados; casa canônica/set-once/fronteiras preservadas).

## CHECKPOINT 2 — /IDENTITY/ME HONESTO (CLOSED)

Catch de fabricação (~110 linhas reconstruindo perfil parcial em 200) REMOVIDO:
- identity existente → projeção normal (200; profile ausente = ausência explícita, flags `profile_personal_confirmed`/`can_edit_personal_data` já existentes — nenhum SSOT novo);
- cadeia quebrada (global_user ausente/resolução falha) → **409 `IDENTITY_CHAIN_INCOMPLETE`** observável (legado-only pós-nascimento atômico);
- outros erros → 500. GET não cria nada.
Frontend `Profile.tsx`: 409 estrutural → erro exibido (não engolido); ausência progressiva → fluxo normal.
`DT-C1-IDENTITY-ME-ABSENCE-FABRICATION-MASKS-INCOMPLETENESS` → **CLOSED**.

## CHECKPOINT 3 — PERFIL PESSOAL (CLOSED)

Cadeia auditada (writers/readers canônicos): fullName/birthdate→`global_users` (imutáveis pós-lock);
CPF→`identities.tax_id` (0062 F4); gender→`global_users.gender`; endereço→Location Core
(`PUT /profile/residence-address`, CEP-âncora 0074); phone→`profiles.phone`; flags→profiles.
Aliases mortos `GET/PUT /profile/profile` (zero callers) REMOVIDOS.
Prova E2E: preencher→salvar→reler→relogin→persistir (4.1–4.5, 10.2).

## CHECKPOINTS 4–5 — PROFISSIONAL + LEARNING + INTERESTS C1 (CLOSED)

Zero mudança de código necessária (já canônicos): rotas `/profile/{professional,learning,interest}/c1`,
`resolveActorGuarded`+`canRepresentActor` (0113), concept_id FK obrigatório, sem fallback
categoryId→conceptId, blob limpo (migration 20260601160000), legado /profile/learning=501,
frontends com snapshot-diff sem localStorage. Prova E2E: declare/update/retire/**reactivate via PATCH**
(edge 409 da DT-C1-LEARNING-INTEREST-REACTIVATION evitado pelo caminho suportado), releitura, relogin,
isolamento A/B (403 + zero mistura no banco), negativas (concept inexistente/malformado/progress fora do range).

## CHECKPOINT 6 — AGENDA (CLOSED)

Zero mudança de código (já canônica): `PUT /availability/weekly-template` com `canRepresentActor`
ANTES de materializar; SSOT = tabela `availability` (zero metadata.schedule, zero schedules/schedule_slots
legados); timezone IANA obrigatória sem fallback; listagem OWNER-SCOPED fail-closed; zero RBAC-stub;
zero acoplamento econômico. Prova E2E: salvar→reler janelas→editar→relogin→persistir; B isolado;
A grava/lista agenda de B → 403; timezone inválida → 4xx.

## CHECKPOINT 7 — HOME READ SEAL (CLOSED · ZERO FINANCIAL_HARD_STOP)

Todos os reads do mount auditados: NENHUM cria estado (snapshots idênticos no E2E) e NENHUM writer
financeiro existe no caminho (bank_ledger/bank_transactions intactos na jornada inteira).
Catch enganoso corrigido (erro ≠ ausência):
- `/bank/balance`: catch 200+`balanceCents:0` → **500 `BANK_BALANCE_UNAVAILABLE`**; !user/!tenant → 401/400; sem identidade bancária = 200 `hasAccount:false` (ausência honesta; zero=zero).
- `/bank/statement`: catch 200+`entries:[]` → **500 `BANK_STATEMENT_UNAVAILABLE`**; sem identidade = vazio honesto.
- `/bank/regional-fund`: catch 200+null → **500 `REGIONAL_FUND_UNAVAILABLE`**; null em SUCESSO = fundo não configurado; reader trata `getSystemAccount` not-found como ausência (throw fail-closed do adapter PRESERVADO p/ writers de money).
- `/groups/mine`/`/referral/earnings`: já honestos (sem catch mascarador) — intocados.
- Frontend: `api/bank.ts` não fabrica `{balanceCents:0}` em 401/403 (propaga); `DashboardHome` exibe `—` p/ saldo/fundo null e "Extrato indisponível" p/ statement null (distinto de vazio real 📭).

## CHECKPOINT 8 — E2E HUMANO PONTA A PONTA

`validate-pipeline-e2e-c1-human-journey-end-to-end.ts` — **55/55 verdes**. App Fastify real
(auth público + escopo protegido tenant/auth/actionContext/rbac + core/profile(C1)/referral/social/
identity/unifybank/groups/availability). 2 usuários A (non_binary) e B (prefer_not_to_say) + 3 da
matriz gender. 14 seções: cadastro/login · matriz gender+negativo · bootstrap puro · perfil pessoal ·
profissional · learning · interests (add/remove/reactivate) · agenda · Home reads (snapshots) ·
relogin+reabertura TOTAL · isolamento A/B (7 provas) · negativas de payload · zero evento econômico/
zero tenant novo · gate verde + prova negativa (fabricação reintroduzida → gate FALHA → restaurado).
Cleanup por MARKER; zero resíduo.

## CHECKPOINT 14 — GATE

`audit-c1-human-journey-closure.mjs`: **17 CLOSED_C1 · 5 KNOWN_OPEN_OUTSIDE_C1 · 0 FINANCIAL_HARD_STOP
· 0 FORBIDDEN_REGRESSION**. Cobre: gender 5v (contracts/migration/writer/extração/identity-status) ·
identity/me sem fabricação · trilhos C1 actor-guarded · agenda fail-closed · Home catches honestos
(backend+frontend) · trilhos frontend canônicos sem blob/localStorage · Bank writers PROIBIDOS no C1.
Religado em `validate:regression-guards` + `validate:c1-human-journey`. NÃO declara PJ/marketplace/
inventory/convite/system-actor/FASE6/R2.

## Validações (todas verdes)

tsc backend (só baseline geo 2 linhas) · tsc frontend 0 · actor-writer §4.8.1 OK · bank-ledger §4.6 OK ·
regression-guards OK (inclui os 2 gates novos) · `validate:architectural` 37→**35** (minha remoção da
fabricação eliminou 2 pré-existentes; ZERO nova — core.service:20 é o import lifestyle pré-existente
deslocado de linha) · check:migrations OK (368 únicos) · dev-login smoke OK.
Regressões: birth 29/29 · read-purity 32/32 · groups-mine 26/26 · x-actor-id 9/9 · self-escalation 33/33 ·
consolidated 39/39 · legacy-readers 32/32 · members 7/7 · role-vocab 7/7 · feed-contextual 8/8 ·
unread-isolation 20/20 · profile-c1-authorship 16/16 · availability weekly-template 15/15 + read 15/15 +
writes 17/17 + booking 14/14 + conflicts 12/12 · canal3-money 7/7.

## DTs / cartório

- **CLOSED:** DT-C1-IDENTITY-ME-ABSENCE-FABRICATION-MASKS-INCOMPLETENESS.
- **NOVAS OPEN (fora do C1):** DT-PJ-TABS-BANK-READS-MASK-ERRORS · DT-SOCIAL-TARGETING-GENDER-ENUM-3V.
- **Adendos:** DECISION-0080 (5 valores, F2/F3) · DECISION-0115 (jornada fechada).
- **Permanecem OPEN:** convite cross-tenant · pilot_invites · system actor institucional · PJ · inventory ·
  marketplace · DECISION-0113 · FASE 6 · R2 · money fora do C1.

## Commits

- A `fc248f9e` fix(identity): canonicalize five-value gender vocabulary + honest /identity/me
- B `6f3aac97` fix(profile): remove dead /profile/profile aliases from C1 journey
- C/D: sem código necessário (trilhos C1 e agenda já canônicos — provados, não alterados)
- E: Home read seal + E2E jornada + gate + cartório (este commit)

---

**Estado:** JORNADA HUMANA C1 CONCLUÍDA — aguardando reseal Yala (macrofrente C1 fecha com PASS).
