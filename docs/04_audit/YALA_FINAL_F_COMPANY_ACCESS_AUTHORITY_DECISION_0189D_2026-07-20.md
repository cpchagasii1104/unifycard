# YALA FINAL — SELO INDEPENDENTE · F-COMPANY-ACCESS-AUTHORITY · DECISION-0189D (arco 0189→0189D)

## 1. Identificação da campanha
- **Campanha:** F-COMPANY-ACCESS-AUTHORITY
- **Decisões:** DECISION-0189 · 0189A · 0189B · 0189C · **0189D** (arco final)
- **Objeto do selo:** material da DECISION-0189D (partição exata de autoridade de membership) + arco final.

## 2. Branch, base, arco e HEAD auditados
- **Branch:** `rescue-structural`
- **HEAD auditado (selado):** `95f87075b1e9c1a4943d56b0bd6f9b7e2d37ec35`
- **Arco 0189D:**
  - base pré-0189D: `dd0e6780570a41ccad621184caee5f3bc84cf99c`
  - decisão docs-only: `c7cc43c91ba6d857cc06b4a31083a2c1984897f9`
  - material (code-only): `db96098a45e485ecab86bd1942341ec480bf6803`
  - cartório pré-Yala: `95f87075b1e9c1a4943d56b0bd6f9b7e2d37ec35`
- **Arco integrado:** `8397b41cb..95f87075b` = 27 commits.

## 3. Data da auditoria
2026-07-20.

## 4. Natureza da auditoria
Auditoria **YALA independente**, **read-only** (nada editado/commitado; provas reproduzidas em clone
efêmero destruído; banco dev intocado). O selo foi emitido pela instância independente; a executora
apenas ARQUIVA o parecer, sem se autosselar e sem emitir veredito próprio.

## 5. Veredito literal
> **VEREDITO A · SELO COMPLETO MATERIAL DECISION-0189D E ARCO FINAL F-COMPANY-ACCESS-AUTHORITY**

## 6. Único próximo ato autorizado pela Yala
- UM commit final docs-only de selo (arquivar este parecer no cartório), material `db96098a4`
  byte-intacto, **nenhuma nova correção de código no ato do selo**. Depois STOP.
- Hardening do guard (P1/P2/P3) e promoção do validador 0189d ao CI = **FRENTE FUTURA PRÓPRIA**,
  fora do selo.

## 7. Limitações e observações não bloqueantes
**OBSERVAÇÕES DE ROBUSTEZ NÃO BLOQUEANTES · FORA DO SELO MATERIAL · NÃO CORRIGIDAS NESTE ATO:**
- **P1:** variante *braced* do retorno (`if (caller.can_manage_company) { return; }` antes do
  comentário-âncora no ceiling) poderia escapar do regex; hardening de 1 char sugerido; o validador
  comportamental do próprio commit pega em runtime (caso D1).
- **P2:** limites de regex para indireção semântica (alias/helper/shadow-object) e âncoras
  territoriais (o anchor da autoria §1.3 não fixa o JOIN tenant/company); cobertos pelo validador
  comportamental, que porém não está no runner (é DB-gated, YALA-time).
- **P3:** ausência de strip de comentários na seção 5e do guard.

**Limitações justificadas registradas pela Yala:** frontend typecheck/build NÃO reproduzidos (frontend
intocado por 0189D; BE typecheck 0 reproduzido); fresh/upgrade canônico N/A (0189D não adiciona
migration — upgrade dd0e67805→95f87075b aplica ZERO migrations). Nenhuma é condição de selo.

## 8. Transcrição integral do parecer YALA independente
Transcrição LITERAL e INTEGRAL do parecer recebido, entre os marcadores, sem paráfrase, corte ou
correção.

<<< INÍCIO DO PARECER YALA >>>

```text
════════════════════════════════════════════════════════════════════════════════
PARECER YALA · AUDITORIA INDEPENDENTE READ-ONLY
F-COMPANY-ACCESS-AUTHORITY · DECISION-0189D (arco 0189→0189D)
Data: 2026-07-20 · Auditor: YALA independente · Modo: read-only (nada editado/commitado)
════════════════════════════════════════════════════════════════════════════════

BASE E ARCO AUDITADOS (fato verificado)
- Branch: rescue-structural · HEAD: 95f87075b1e9c1a4943d56b0bd6f9b7e2d37ec35
- Cadeia: dd0e67805 (base pré-0189D) → c7cc43c91 (docs) → db96098a4 (material) → 95f87075b (cartório)
- Parents conferem (c7cc43c91.parent=dd0e67805; db96098a4.parent=c7cc43c91; 95f87075b.parent=db96098a4).
- Reflog: 3 entradas "commit:" frescas — SEM amend/rebase/squash. dd0e67805 e os 20 commits anteriores
  intactos (arco integrado 8397b41cb..95f87075b = 27 commits). 3 untracked preexistentes preservados,
  fora de todos os commits.

ARQUIVOS POR COMMIT + DIFFSTATS (fato verificado — escopo EXATO)
- c7cc43c91 (docs-only): DECISION_0189D_EXACT_MEMBERSHIP_AUTHORITY_PARTITION.md (+87) ·
  REMEDIATION_DT_LOG.md (+7) · dividatecnica.md (+6). Nada além. ✔
- db96098a4 (material, code-only): company-access-invitations.service.ts (+14/-…) ·
  company-membership-commands.service.ts (+6/-…) · company-access-invitations.routes.ts (+26) ·
  audit-company-access-authority-foundation.mjs (+40) · tests/support/validate-yala-0189d-
  membership-partition.ts (+165). NENHUM migration/schema/catálogo/PermissionKey/Fiscal/Bank/frontend. ✔
- 95f87075b (cartório): REMEDIATION_DT_LOG.md (+9) · dividatecnica.md (+5) · EXECUTION_LOG_F_COMPANY_
  ACCESS_AUTHORITY_2026-07-19.md (+33). Nada além. ✔

RASTREABILIDADE NORMATIVA
- SSOT de autoridade = authorization.service (canActAs) + company-policy-registry (§1.1/§13.3 0189).
- DECISION-0189D §2 preserva a matriz §13.3, declara manage_members TERMINAL/EXATA p/ membership comum e
  company:manage_governance (=can_manage_company) EXATA p/ alvo/grant PROTEGIDO; proíbe superset/fallback
  implícito; NÃO cria manage_access/can_manage_access/can_view_fiscal/PermissionKey/catálogo v3/migration;
  member_status = única verdade (is_active já dropado na F4). GO docs-only NÃO autoriza material (§3);
  material veio em commit separado (db96098a4) sob GO próprio — ordem correta (docs→material→cartório).

ANÁLISE DOS QUATRO GATES (fato verificado no diff + fonte atual)
Os 4 fallbacks não-autorizados de can_manage_company foram ELIMINADOS:
  1. inviteMember (service:176): `if (!caller.can_manage_members)` — removido `&& !caller.can_manage_company`. ✔
  2. acceptInvitation revalidação do convidador (service:358): `if (inviter.can_manage_members !== true)`
     — removido `&& inviter.can_manage_company !== true`. ✔
  3. revokeInvitation (service:530): `if (!caller.can_manage_members)` — removido o OR. ✔
  4. assertAdministrationCeiling (commands:158-163): removido `if (caller.can_manage_company) return;`
     para alvo COMUM → comum exige can_manage_members exato. ✔
Nenhum OR/alias/helper/ternário residual: varredura de TODOS os can_manage_company no módulo companies =
apenas usos LEGÍTIMOS (roteamento de alvo PROTEGIDO commands:152; último-gestor :181/:186/:414;
transferGovernance atômica :347/:352; grant-ceiling exemption em alterGrants :303; colunas/comentários).
Nenhum caminho paralelo (writer/rota/wrapper) restaura a brecha. GET fila = canActAs('manage_members')
direto (:135). Mensagens de erro NÃO são a única proteção — os gates são estruturais (throw por ausência
de coluna, não por texto).

ANÁLISE APROFUNDADA AUTORIA × AUTORIDADE (§5 — parte de maior risco) — CORRETA
Helper `requireRepresentsActingActor` (routes:30-76), usado SÓ pelas rotas de escrita do ciclo (create:96,
revoke:149); GET usa canActAs('manage_members'); accept/decline = token+invitee.
- Membership ATIVA conta como AUTORIA apenas (represents=true), nunca como AUTORIDADE.
- Query da autoria: identidade server-side (resolveGlobalUserId de userId=req.user, não client) · tenant $1
  server-side · COMPANY-SCOPED (JOIN a.company_id=cu.company_id AND a.id=actingActorId → só a empresa DONA
  do actor declarado) · member_status='active' (rejeita suspenso/revogado/pendente) · fail-closed no catch.
  → membro não pode vestir actor arbitrário nem membership de outra empresa (user-actor tem company_id NULL,
  não casa o JOIN; outra empresa → caller não é membro lá).
- A decisão FINAL de autoridade é do SERVICE, sob lockCallerMembership FOR UPDATE (can_manage_members exato).
  Governance-only PASSA a autoria mas o service NEGA (MANAGE_MEMBERS_REQUIRED); manage_members-only ALCANÇA
  o service e é PERMITIDO. A rota NÃO decide autoridade por membership. canRepresentActor NÃO é alargado (query
  local; demais callers intocados). Provado comportamentalmente (caso E, abaixo). ✔

ANÁLISE TRANSACIONAL DO ACEITE (§6) — FAIL-CLOSED
Revalidação do convidador (service:355-361): inviter deve ser member_status='active' E can_manage_members===true
(SEM fallback de can_manage_company). Locks: BEGIN → lockCompany → lockCallerMembership FOR UPDATE →
lock do convite; leitura da autoridade DENTRO da tx sob FOR UPDATE — sem janela TOCTOU (perda de manage_members
entre emissão e aceite invalida no momento do lock). Convite expirado/revogado/recusado/usado não aceita;
one-use, idempotente, vinculado ao invitee autenticado; zero capability/membership/delegação antes do aceite.
Provado (caso C: convidador que perde só manage_members mantendo can_manage_company → INVITER_LOST_AUTHORITY). ✔

ANÁLISE DO CEILING (§7) — PARTIÇÃO EXATA
assertAdministrationCeiling (commands:148-169): alvo PROTEGIDO → exige can_manage_company e RETURN (sem
conjunção artificial com manage_members, :156); alvo COMUM → exige can_manage_members exato (governança não
é superset, :161); subset target⊆caller preservado (:165). alterGrants: protegido→governança (:299);
não-protegido→ceiling do caller. Provado (D1 governance-only nega comum · D2 manage_members administra comum ·
D3 manage_members NÃO administra protegido · D4 governança administra protegido sem manage_members). ✔

LIFECYCLE ÚNICO (§8) — is_active MORTO
Coluna is_active AUSENTE em company_users (dev, information_schema). Nenhum is_active reintroduzido no range
(grep vazio). member_status única verdade. Guard morde reintrodução (§5b). ✔

GUARD E MUTATIONS (§9) — EXTENDIDO E MORDENDO
Guard audit-company-access-authority-foundation.mjs = ESTENDIDO (+40, seção 5e), não substituído: todos os
invariantes 0189/0189A/0189B/0189C intactos + os 4 gates 0189D + a fronteira de autoria. Ancoragem ESTRUTURAL
(marcador DECISION-0189D + condição if isolada + CONTAGEM de gates fail-closed ≥3/≥1), não depende de nº de
linha, indentação nem texto de erro. Ligado ao runner (:199). Clean tree exit 0.
7/7 mutações hostis DECLARADAS MORDEM (reproduzido em cópia descartável, tree real intocada):
  1 OR na emissão · 2 fallback no aceite · 3 fallback na revogação · 4 return de governança p/ comum ·
  5 inferência por role · 6 inferência por is_primary · 7 remoção/inversão da autoria (sombra do fino).
Falso-PASS em reformatação honesta: 0. Falso-FAIL em código legítimo: 0.
OBSERVAÇÕES DE ROBUSTEZ (além das 7 declaradas — NÃO são gap material; código atual está correto e provado):
  · P1 (não-bloqueante): variante BRACED `if (caller.can_manage_company) { return; }` posta ANTES do
    comentário-âncora no ceiling escaparia (regex só casa `) return` sem chave). É a única evasão plausível
    como regressão ACIDENTAL futura. Hardening de 1 char: `\)\s*\{?\s*return`. O validador comportamental
    (mesmo commit) pega em runtime (caso D1).
  · P2: indireção semântica (alias/helper/shadow-object mantendo can_manage_company fora da condição
    ancorada) e o anchor da autoria (§1.3) não fixa o JOIN tenant/company — limites inerentes de regex;
    cobertos pelo validador comportamental, que porém NÃO está no runner (é DB-gated, YALA-time).
  · P3: seção 5e não faz strip de comentários (smuggling só para adversário deliberado).
Recomendação NÃO-bloqueante p/ frente futura: broaden o regex do return braced (P1) e promover o validador
0189d a passo CI DB-gated. Nenhum P0. Nenhum gap MATERIAL.

PROVAS REPRODUZIDAS DE PRIMEIRA MÃO (comandos + saída real; fixtures só em clone efêmero destruído)
- runner completo (`node scripts/run-regression-guards.mjs`): exit 0 · "todos os guards passaram (200)".
- red-gates-baseline: financial-ssot 591/591 · financial-vocabulary 3889/3889 · typecheck-gate 0/0 (GATE OK).
- backend typecheck (`tsc -p tsconfig.build.json --noEmit`): exit 0.
- git diff --check dd0e67805..95f87075b: LIMPO (sem CRLF/whitespace).
- teste 0189D (validate-yala-0189d-membership-partition, em clone efêmero unificard_0189d_clone com marcador):
  **14/14** (A1/A2 convite · B1/B2 revogação · C revalidação-aceite · D1–D4 ceiling comum×protegido ·
  E autoria≠autoridade · F1 is_active ausente · F2 Δbank=0 · F3 catálogo sem manage_access/view_fiscal), exit 0.
- F4 lifecycle-cutover (mesmo clone): **16/16** (inclui exclusividade nas 2 direções, DELETE físico bloqueado
  por FK, dupla revogação concorrente linearizada), exit 0.
- F5 invitations (mesmo clone): **23/23** — ciclo de convite NÃO regrediu pelo gate exato, exit 0.
- guard standalone: exit 0; 7/7 mutações declaradas mordem.
- Clone efêmero DESTRUÍDO ao final (pg_database count=0); banco dev INTOCADO.
Nenhuma prova tocou banco não-efêmero. Não copiei contagens da executora — reexecutei.
NÃO REPRODUZIDO (limitação justificada — code-only, sem frontend no range): frontend typecheck/build (frontend
intocado por 0189D; BE typecheck 0 reproduzido). fresh/upgrade canônico: N/A (0189D não adiciona migration —
upgrade dd0e67805→95f87075b aplica ZERO migrations; confirmado git). Não é condição de selo.

RATCHETS
financial-ssot 591 (teto 591, não elevado) · financial-vocabulary 3889 (teto 3889) · typecheck-gate 0.
red-gates-baseline.json intocado no range. Nenhum baseline elevado; nenhum guard afrouxado; nenhum removido.

PORTA 01 E Δbank
Nenhuma migration/schema/coluna/catálogo/PermissionKey. Ausência de manage_access/can_manage_access/
can_view_fiscal. Nenhum cálculo fiscal/Invoicing/NF-e. Nenhuma alteração em Bank/split/ledger/transaction.
PORTA 01 fechada. Δbank=0 (bank_ledger=0 · bank_transactions=0 · bank_splits=0 · bank_accounts=16 =
baseline). Nenhum caller financeiro novo; nenhum frontend funcional novo.

RESÍDUOS / CARTÓRIO
Cartório (95f87075b) registra "MATERIAL 0189D EXECUTADO E PROVADO · NÃO SELADO · CANDIDATO À AUDITORIA YALA
FINAL INDEPENDENTE"; NÃO simula parecer nem declara "YALA SELADA" (grep vazio). As 4 colisões registradas
como RESOLVIDAS pelo material (sem apagar histórico); nenhuma DT adjacente fechada; nenhuma DT nova. Os 3
untracked preexistentes mantidos fora dos commits; zero alteração tracked residual; sem push/merge.

────────────────────────────────────────────────────────────────────────────────
VEREDITO A · SELO COMPLETO MATERIAL DECISION-0189D E ARCO FINAL F-COMPANY-ACCESS-AUTHORITY
────────────────────────────────────────────────────────────────────────────────
Fundamento: escopo e commits exatos; partição normativa (manage_members comum × governança protegido)
implementada corretamente; autoria NÃO virou autoridade (membership = autoria; service decide autoridade
sob lock; sem spoof; sem alargar canRepresentActor); os 4 fallbacks eliminados; revalidação do aceite
transacional e fail-closed; ceiling/grants protegidos/último-gestor corretos; guard estendido e 7/7 mutações
declaradas mordem (0 falso-PASS/0 falso-FAIL); TODAS as provas reproduzidas verdes por mim (0189D 14/14 ·
F4 16/16 · F5 23/23 · runner 200 · typecheck 0 · diff-check limpo · ratchets 591/3889/0); Bank/Fiscal/PORTA 01
intactos; Δbank=0; sem contaminação nem gap MATERIAL. As observações de robustez do guard (P1 braced-return;
P2 indireção/anchor da autoria; P3 comment) são NÃO-BLOQUEANTES — o código atual está correto e provado, e o
validador comportamental do próprio commit cobre a classe em runtime.

ÚNICO PRÓXIMO ATO AUTORIZADO:
- UM commit final docs-only de selo (arquivar este parecer no cartório), material byte-intacto (db96098a4
  inalterado), NENHUMA nova correção de código no ato do selo. Depois STOP.
- Hardening do guard (P1/P2/P3) e promoção do validador 0189d ao CI = FRENTE FUTURA PRÓPRIA, fora do selo.
════════════════════════════════════════════════════════════════════════════════
```

<<< FIM DO PARECER YALA >>>
