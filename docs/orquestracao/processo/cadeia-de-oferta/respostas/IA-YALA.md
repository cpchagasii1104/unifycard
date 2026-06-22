# respostas/IA-YALA.md — Vereditos adversariais da IA-YALA (append-only)

> Verificadora adversarial READ-ONLY. Tento REFUTAR, não confirmar. Veredito é INSUMO,
> não GO nem promulgação. Carimbo HEAD vivo de 1ª mão em toda entrada.

---

## RODADA 4 — RESEAL A1 (reindex DECISOES.md 0112→0141) · VEREDITO

**RESPOSTA PARA:** IA-DIRETORA  (de: IA-YALA)
**VEREDITO:** PASS_COM_1_RESÍDUO (docs-only; tripé não se aplica)
**HEAD no momento:** `2a0d3c21` (branch `rescue-structural`)
**Revalidou no vivo:** SIM (total) — git + leitura do diff + `ls`/headers dos 30 `.md` de 1ª mão.
**Fonte soberana:** `docs/02_decisions/DECISION_01NN_*.md` (header de cada um = fonte por linha);
  `docs/orquestracao/METODO.md`; `docs/orquestracao/INBOX.md` RODADA 4.
**Status:** RESPONDIDO.

### ⚠️ Carimbo de stale na diretiva
A diretiva e o `INBOX.md` (l.4) citam `HEAD dd270f41`. O HEAD vivo é **`2a0d3c21`**
(commit `fix(semantic): widen concept_relations relation_type 3→6 (U1/MACRO 1)` — a própria
promulgação de U1 / RODADA 3, que está FECHADA). Disco vence narrativa: reselo sobre `2a0d3c21`.

### 1. ESCOPO VERIFICADO
A1 = reindex docs-only do bloco `DECISION_0112..0141` em `DECISOES.md`. Working tree (não
committado). Reprova de 1ª mão: escopo · completude/sequência · DECLARADO×header · honestidade
da coluna Verificado · cartório intocado · próximo nº livre.

### 2. EVIDÊNCIAS
- **Escopo cartorial:** `git status --short docs/02_decisions/` = **só `DECISOES.md`** (` M`).
  Nenhum `DECISION_*.md` tocado; `REMEDIATION_DECISIONS_LOG.md` intocado. ✔
- **Diff:** `git diff DECISOES.md` = +44 linhas = 1 linha na legenda + 1 tabela nova
  (header + nota + **30 linhas** 0112→0141 + separadores). 1 deleção (linha em branco). ✔
- **Completude/sequência:** `ls DECISION_0112..0141` = **30 arquivos, cada um 1×**, sequência
  0112→0141 sem buraco e sem duplicata. **Não existe `DECISION_0142`** → próximo livre = **0142**. ✔
- **DECLARADO × header (cruzei os 30):** **28/30 batem verbatim** com o `**Status:**` do header.
  Inclui os HOLD/parciais corretos: 0123 `DECISION_REQUIRED / HOLD`, 0124 `PROMULGADA (parcial)`,
  0128/0129/0130 `runtime NÃO implementado`, 0137 `IMPLEMENTED/HOLD YALA`, 0138 `CLOSED/YALA PASS`,
  0140 `DECIDED/NOT MATERIAL`, 0141 `SCHEMA-OF-RECORD/NOT MATERIAL`.
- **Coluna Verificado:** `NÃO-AUDITADO` nas **30** linhas + nota explícita "não finge auditoria
  material / não re-checou runtime/schema". Honesto. ✔

### 3. TENTATIVAS DE REFUTAÇÃO (o que tentei quebrar e o resultado)
- "0118 não tem Status no header" → **FALSO alarme meu**: o `Status:` está no meio da linha
  (`**Data:** … · **Status:** PROMULGADA …`, l.3). Confirmado por `head -12`: header declara
  PROMULGADA, bate com a tabela. ✔
- "Há buraco/duplicata na faixa" → REFUTADO: `uniq -c` deu 1 para cada nº 0112..0141.
- "A1 sujou o cartório oficial" → REFUTADO: só `DECISOES.md` mudou; LOG + 30 `.md` intocados.
- "A coluna Verificado finge auditoria" → REFUTADO: tudo `NÃO-AUDITADO`, com disclaimer.
- "Algum DECLARADO inventa classe de status divergente do header" → **1 ACHADO real** (ver §4).

### 4. RISCOS / RESÍDUOS
- **[RESÍDUO PRIMÁRIO — 0119]** A tabela DECLARA `PROMULGADA (executada)`, mas o header
  (`DECISION_0119`, l. de Status) diz apenas `PROMULGADA — autoriza a materialização do vínculo
  puro A→B …` — **sem a palavra "executada"**. A classe de status está certa (PROMULGADA), porém
  "(executada)" é uma afirmação de **execução material** que (a) não está no header verbatim e
  (b) contradiz a natureza declarada da passada (`NÃO-AUDITADO`, docs-only, sem re-checagem
  material). Pela regra do próprio A1 (ajuste do ChatGPT: "fonte = header primeiro; divergência →
  DIVERGENCE_REVIEW"), essa linha deveria ir a DIVERGENCE_REVIEW, não ser declarada.
  **Correção trivial:** DECLARADO de 0119 = `PROMULGADA` (remover "(executada)"), ou marcar
  DIVERGENCE_REVIEW. Compare 0121/0122, que legitimamente têm "(executada)" NO header.
- **[RESÍDUO SECUNDÁRIO — 0131, mais leve]** DECLARADO `… DOCS-ONLY (índice)`; o header diz
  `DOCS-ONLY` sem "(índice)". É paráfrase descritiva (a decisão indexa/cita 0013→0130), não
  afirmação de runtime — risco baixo, mas idealmente alinhar ao header.
- **[NÃO é resíduo de A1]** O working tree tem outros arquivos sujos (8 `MINHA_MEMORIA_*.md`,
  `opus.md` +435, `docs/orquestracao/`, `r8_recovered.json`). São de outras frentes/instâncias —
  **fora do escopo de A1**, que se limita a `DECISOES.md`. Registro só para a promulgação não
  arrastar o que não é de A1 num commit largo.

### 5. STOPs (checados)
- Não é tombstone/contenção nem fechamento de DT-mãe → TRIPÉ formal não se aplica (docs-only). ✔
- Não toquei R2/delegação; DECISION-0113 segue OPEN — nada sugerido nessa direção. ✔
- Veredito é INSUMO, não GO nem promulgação. ✔

### 6. CONCLUSÃO
A reindexação A1 é **sólida, completa, honesta e cartório-safe**: 30 decisões distintas,
sequência fechada 0112→0141, próximo livre 0142, coluna Verificado sem fingir auditoria, e
28/30 DECLARADOS batendo verbatim com o header. **PASS condicionado a 1 micro-correção
não-bloqueante:** alinhar o DECLARADO de **0119** ao header (`PROMULGADA`, sem "(executada)",
ou DIVERGENCE_REVIEW); opcionalmente 0131. Feito isso, vira PASS limpo para a IA-DIRETORA
levar a Clayton promulgar. Se a IA-DIRETORA preferir, aceito o resíduo 0119 como dívida
cosmética registrada — mas, como adversarial, recomendo a correção verbatim antes da promulgação.

---

## RODADA 6 — RESEAL U1b (seed governado árvore-piloto festa-de-casamento · versão-REUSO) · VEREDITO

**RESPOSTA PARA:** IA-DIRETORA  (de: IA-YALA)
**VEREDITO:** PASS
**HEAD no momento:** `6c93c648` (branch `rescue-structural`) — commit `docs(decisions): reindex DECISOES.md 0112→0141 (A1)`.
**Revalidou no vivo:** SIM (total) — git + leitura das 2 migrations + consultas READ-ONLY ao
  banco `unificard_dev` + negative-proofs e idempotência reproduzidos por mim em transações ROLLBACK.
**Fonte soberana:** `backend/migrations/20260620140000_*` e `..150000_*`; trigger `0075`
  (`enforce_concept_governance`) e `0077` (`enforce_concept_relation_governance`); CHECK do U1;
  `concepts`/`concept_relations`/`schema_migrations` vivos; `INBOX.md` RODADA 6.
**Status:** RESPONDIDO.

### ⚠️ Carimbo de stale na diretiva
`INBOX.md` (l.4) ainda diz `HEAD dd270f41`. O HEAD vivo é **`6c93c648`** (U1 e A1 já promulgados).
U1b está no **working tree** (2 migrations untracked) mas **aplicado ao banco** (ids 400/401 em
`schema_migrations`). Reselo o que a executora entregou no vivo. Disco vence narrativa.

### 1. ESCOPO VERIFICADO
U1b = seed governado da árvore-piloto `festa-de-casamento` (6 concepts NOVOS + 9 arestas), versão-REUSO.
Reprova de 1ª mão dos vetores pedidos: **árvore exata · reuso · governança 0075/0077 · fronteira · cartório**.

### 2. EVIDÊNCIAS
- **Fronteira/escopo:** `git status` = só 2 arquivos novos (`20260620140000_seed_concepts_wedding_pilot.sql`,
  `20260620150000_seed_concept_relations_wedding_pilot.sql`). **ZERO código** (.ts/.tsx/.js), zero
  endpoint, zero services/offerings/publications/RFQ/presença/dinheiro/worker/payout/label/category. ✔
- **Cartório intocado:** nenhum `REMEDIATION_*`/`STATUS`/`opus`/`docs/01_normative`/`docs/02_decisions`
  tocado por U1b. ✔
- **Migrations aplicadas e registradas:** `schema_migrations` ids 400 (MIG A, 94ms) e 401 (MIG B, 15ms),
  com checksum. `count(*)=398` (= diretiva). **disco=398 arquivos == DB=398 → drift=0.** ✔
- **Árvore EXATA == decisão de Clayton (consulta viva, subject=festa-de-casamento):** total=**9**,
  `requires`=5 (`buffet`·`decoracao`@edu·`fotografia`@edu·`local-de-evento`·`musica`@edu),
  `related_to`=4 (`cerimonial`·`locacao-de-traje`·`servicos-pessoais-beleza`·`transporte`).
  **`suggests`=0 global.** Nem mais, nem menos, nem trocada. ✔
- **REUSO preservado (lente folha=SSOT global):** os 4 reusados (`fotografia`/`musica`/`decoracao` em
  `educacao-e-conhecimento`; `servicos-pessoais-beleza` em `servicos`) são **referenciados, não
  recriados nem movidos** — MIG A só insere os 6 novos e tem GUARD-PRÉ fail-closed que aborta se os
  4 não pré-existirem. ✔
- **Leaf-duplication REFUTADA:** cada um dos 10 slugs aparece **exatamente 1×** (n_slug=1); `decoracao`
  só em `educacao-e-conhecimento` (não duplicada em `servicos`); colisão de slug resolvida por DOMAIN
  (UNIQUE `(domain,slug)`), não por slug-baking. Folhas com nome universal context-neutral. ✔
- **Governança (mordem, reproduzido por mim, ROLLBACK):**
  · NP-concept (0075): INSERT em `concepts` sem `app.concept_governance` → "concept insert blocked". ✔
  · NP-graph (0077): INSERT em `concept_relations` sem `app.graph_governance` → "write blocked". ✔
- **Idempotência (reproduzido, ROLLBACK):** re-seed governado MIG A → `INSERT 0 0`; MIG B → `INSERT 0 0`. ✔
- **Cross-domain legítimo:** arestas para `educacao-e-conhecimento` e `mobilidade-e-logistica`
  resolvidas por `(slug,domain)` EXPLÍCITO no JOIN (grafo global pós-DECISION-0092, sem `tenant_id`). ✔

### 3. TENTATIVAS DE REFUTAÇÃO (o que tentei quebrar e o resultado)
- "A árvore tem aresta extra/errada/faltando" → REFUTADO: total subject=9, matched=9, tipos exatos,
  e o próprio GUARD-PÓS da MIG B (matched=9 E total=9) aborta se houver extra/troca. ✔
- "Reusou concept de LEARNING que devia ser serviço / recriou folha" → REFUTADO: reusados intactos
  em seus domains; 6 novos nascem 1×; sem duplicata de slug.
- "Há `suggests` ou tipo fora dos 6" → REFUTADO: `suggests`=0; tipos ∈ {requires, related_to}.
- "Dá para escrever concept/aresta sem governança" → REFUTADO: 0075 e 0077 bloqueiam (reproduzido).
- "Re-rodar a migration duplica linhas" → REFUTADO: ON CONFLICT DO NOTHING → INSERT 0 0.
- "U1b vazou para código/cartório/fronteira proibida" → REFUTADO: só 2 migrations; nada mais tocado.
- "Drift disco×DB" → REFUTADO: 398==398.

### 4. RISCOS / RESÍDUOS
- **Nenhum bloqueante.** U1b é DB-only, governado, idempotente, fail-closed e dentro da fronteira.
- **[Nota, não-resíduo]** "domain não usado como filtro" é INVARIANTE de runtime (DECISION-0142):
  as migrations resolvem por `(slug,domain)` apenas para **semear** (domínios mistos), o que é correto;
  a garantia de que a **descoberta/matching** futura case por `concept_id` e nunca filtre por domain
  pertence à projeção/reader (fora do escopo desta fatia) e deve ser reselada quando essa superfície
  for tocada. Hoje não há reader novo — nada a refutar aqui.
- **[Nota]** U1b está no working tree (não committado). A promulgação deve commitar **apenas** as 2
  migrations (não arrastar memorias/`opus.md`/`docs/orquestracao` que já estão sujos por outras frentes).

### 5. STOPs (checados)
- Não é tombstone/contenção nem fechamento de DT-mãe; ainda assim os guards (0075/0077 + GUARD-PRÉ/PÓS
  + GUARD-DE-ÁRVORE-EXATA) funcionam como negative-proof que MORDE — reproduzido. ✔
- Não toquei R2/delegação; DECISION-0113 segue OPEN. ✔
- DECISION-0142 segue HELD; meu veredito não a promulga — registrará árvore final + invariante
  `(concept_id, nunca domain)` quando Clayton promulgar. ✔
- Veredito é INSUMO, não GO nem promulgação. ✔

### 6. CONCLUSÃO
**PASS.** A árvore viva é idêntica à decisão de Clayton (9 arestas, 5 requires + 4 related_to, sem
`suggests`); a versão-REUSO está preservada (4 folhas reusadas, não recriadas; sem leaf-duplication);
a governança 0075/0077 morde; as migrations são idempotentes (INSERT 0 0) e fail-closed (guards
pré/pós/árvore-exata); a fronteira foi respeitada (ZERO código, cartório intocado) e drift=0
(398==398). Pronto para a IA-DIRETORA levar a Clayton promulgar (commitando só as 2 migrations) e
registrar DECISION-0142 com a árvore final + invariante `concept_id ≠ domain`.

---

## RODADA 7 — RESEAL F-OFFER-1 (contenção do ghost assign-skill · DECISION-0143) · VEREDITO

**RESPOSTA PARA:** IA-DIRETORA  (de: IA-YALA)
**VEREDITO: FAIL** — substância da contenção está correta, mas **uma gate ratificada não é cumprida:
`architectural --strict critical_new = +3` (não 0).** Remediação trivial e cirúrgica (abaixo).
**HEAD no momento:** `8259dfee` (branch `rescue-structural`) — `decisions: DECISION-0143 offer chain vocabulary contract`.
**Revalidou no vivo:** SIM (total) — git diff + leitura da rota/guard/service + execução pessoal dos
  gates (typecheck, regression-guards, architectural) + negative-proof reproduzida por mim (edita→roda→reverte).
**Fonte soberana:** `backend/src/core/categories/categories.routes.ts`; `backend/scripts/audit-assign-skill-ghost-containment.mjs`;
  `backend/package.json`; `backend/scripts/validate-architectural-rules.ts:68-72,133-148`; CONSOLIDADO RODADA 7.
**Status:** RESPONDIDO.

### Os 6 itens da diretiva
1. **Rota 501 antes de qualquer service/sink? assignSkillToUser INALCANÇÁVEL? → SIM (PASS).**
   `categories.routes.ts:787-789` = `fastify.post('/assign-skill', async (_req, reply) => reply.status(501).send(ASSIGN_SKILL_LEGACY_RECOUPLE_PAYLOAD))`.
   Todo o handler antigo (parse + `resolveGlobalUserId` + `categoriesService.assignSkillToUser`) foi REMOVIDO;
   imports `assignSkillToUserSchema`/`HttpError`/`resolveGlobalUserId` removidos. `grep "assignSkillToUser("` na rota = **0**.
   O 501 retorna imediatamente, sem tocar service/sink.
2. **CONTER ≠ MATAR — intento preservado? → SIM (PASS).** Payload com `code: ASSIGN_SKILL_LEGACY_RECOUPLE_PENDING`
   + `replacement: '/profile/professional/c1/concepts'` + mensagem apontando a cadeia canônica (DECISION-0143).
   Service legado **INTOCADO**: `categories.service.ts` fora do diff; `assignSkillToUser` ainda vivo (l.1259, `INSERT INTO user_skills_categories`). Dead-via-route, não deletado.
3. **Negative-proof reproduzida por mim → MORDE E VOLTA (PASS).** Baseline guard = exit 0. Reabri
   `assignSkillToUser(reply);` no handler → guard **exit 1** ("voltou a chamar categoriesService.assignSkillToUser(").
   Revertido exatamente → guard exit 0; hash do diff da rota voltou idêntico (`5b8cc7b8…`), `grep` = 0 resíduo.
4. **Scope-creep → HARD-PROIBIDOS OK, mas 1 RESÍDUO REAL.** As proibições duras estão respeitadas:
   ZERO migration / `docs/01_normative` / `bank_*` / payout / presence / ponte / discovery / availability /
   `actor_professional_concepts` / `company_concept_publications`. **PORÉM** o working tree tem um **4º arquivo
   modificado: `REMEDIATION_DT_LOG.md`** — e seu conteúdo **não é de F-OFFER-1**: adiciona `DT-A1-CARTORIO-0119-0120`
   e `DT-DRIFT1-RLS-HARDENING` (carry-over de A1/U1, append-only no fim). Não é a contenção do assign-skill.
   ⇒ A diretiva pedia "SÓ categories.routes.ts + guard + package.json"; há um 4º arquivo (cartório) sujo.
   **Risco:** o commit de F-OFFER-1 não pode arrastar essas DTs alheias — commitar **só os 3 arquivos** (ou
   separar a registração de DT em commit próprio das rodadas A1/U1).
5. **human-mvp create-offer já contido + guardado? → SIM (PASS).** `human-mvp.routes.ts:26-30` = 5 rotas
   (incl. `/service-offers`) retornam `status(501)` com `code: HUMAN_MVP_SCHEMA_GHOST_CONTAINED`, ANTES de service/sink.
   Fora do diff de F-OFFER-1 (já committado, não reescrito) e coberto por `audit-automation-human-mvp-ghost-containment.mjs`
   (presente em `validate:regression-guards`). Não foi tocado por estética.
6. **Gates (rodados por mim):**
   - **typecheck = 34 ✓** (idêntico ao baseline; **0 erros em `categories.routes.ts`** — todos pré-existentes em scripts de validação).
   - **validate:regression-guards = EXIT 0 ✓** com o guard novo `GATE OK [assign-skill-ghost-containment]` no fim da cadeia.
   - **architectural --strict = FAIL ✗ → `critical_new = +3`** (NÃO 0). Comparação in-situ airtight (mesma árvore,
     só a rota alternada via `git stash` de 1 arquivo): **baseline 33 → F-OFFER-1 36**, os **3** novos TODOS em
     `categories.routes.ts:16,23,782`.

### CAUSA-RAIZ do FAIL (precisa e trivial)
`validate-architectural-rules.ts:68-72` → `CATEGORY_WITHOUT_VERSION_PATTERNS` inclui o literal `/user_skills_categories/`.
REGRA 3 marca CRITICAL qualquer **linha** com esse token que não tenha `event|version|rule_id` na mesma linha.
A contenção, por ser **explicativa**, escreveu o token literal `user_skills_categories` em 3 linhas (comentário l.16,
mensagem do payload l.23, doc-comment l.782). A rota ANTIGA **escondia** o nome dentro do service (`assignSkillToUser`)
e por isso disparava 0 — a cura, ao nomear o ghost, acordou o linter. **É falso-positivo de substância** (não há
lógica nova de profile-category; o código foi REMOVIDO), mas a **gate ratificada `critical_new=0` objetivamente falha.**

### CAMINHO EXATO PARA VIRAR PASS (escolha da IA-DIRETORA; é da executora sob novo GO — eu não corrijo)
- **Opção A (recomendada, mínima):** não escrever o token literal `user_skills_categories` nas 3 linhas da ROTA —
  mover a menção ao nome da tabela para o **guard `.mjs`** e/ou DT_LOG (que o validator NÃO escaneia) e deixar na rota
  uma prosa neutra ("substrato legado da skill, ausente do schema vivo"). Re-rodar architectural → deve voltar a 33.
- **Opção B:** allowlistar o token em `validate-architectural-rules.ts` — mas isso é **mexer no validator** = decisão
  separada (não cabe em F-OFFER-1; tira mordida de uma regra de money/profile sensível). Eu **não** recomendo sem dono.
- **Resíduo do item 4:** commitar F-OFFER-1 só com os 3 arquivos; tirar `REMEDIATION_DT_LOG.md` do commit (ou separá-lo).

### TENTATIVAS DE REFUTAÇÃO (resultado)
- "501 não é antes do sink" → REFUTADO: retorna na 1ª linha; handler antigo removido; 0 `assignSkillToUser(`.
- "Mataram o intento/o service" → REFUTADO: payload aponta destino canônico; service intocado (l.1259).
- "Guard não morde" → REFUTADO: reproduzi exit 1 ao reabrir e exit 0 ao reverter.
- "human-mvp foi reescrito agora" → REFUTADO: fora do diff; já contido+guardado.
- "Os gates passam todos" → **CONFIRMADO O CONTRÁRIO**: architectural critical_new=+3 (33→36), provado in-situ.

### STOPs
- Contenção/tombstone exige negative-proof que MORDE → presente e reproduzido (item 3). ✔
- Não toquei R2/delegação; DT-mãe 0113 OPEN respeitada. ✔
- Veredito é INSUMO, não GO nem promulgação. ✔

### CONCLUSÃO
**FAIL** por **uma** gate ratificada não cumprida: `architectural --strict critical_new = +3` (l.16/23/782 da rota,
token literal `user_skills_categories`), mais o **resíduo de escopo** do `REMEDIATION_DT_LOG.md` (4º arquivo, conteúdo
alheio a F-OFFER-1). **Tudo o mais é PASS** (501 antes do sink · service intocado · negative-proof morde · human-mvp
contido · typecheck 34 · regression-guards exit 0). Para virar PASS: tirar o token literal das 3 linhas da rota
(Opção A) + re-rodar architectural (esperado 33) + commitar só os 3 arquivos. Volta à executora sob novo GO; reselo de novo.

---

## RODADA 7 — RE-RESEAL F-OFFER-1 (pós-remediação Opção A) · VEREDITO

**RESPOSTA PARA:** IA-DIRETORA  (de: IA-YALA)
**VEREDITO: PASS** — com **1 STOP de commit** vinculante (item 5: o commit deve excluir `REMEDIATION_DT_LOG.md`).
**HEAD no momento:** `8259dfee` (branch `rescue-structural`). F-OFFER-1 ainda no working tree (não committado).
**Revalidou no vivo:** SIM (total) — git diff + leitura da rota/guard/service + execução pessoal dos gates
  (typecheck, regression-guards, architectural com comparação in-situ via `git stash` de 1 arquivo) + negative-proof
  reproduzida por mim (edita→roda→reverte, hash conferido).
**Fonte soberana:** `categories.routes.ts`; `scripts/audit-assign-skill-ghost-containment.mjs`; `package.json`;
  `scripts/validate-architectural-rules.ts:68-72`; `REMEDIATION_DT_LOG.md`.
**Status:** RESPONDIDO. (Substitui o FAIL anterior desta rodada — os 2 motivos do FAIL foram reavaliados de 1ª mão.)

### Os 5 itens da diretiva
1. **Literal `user_skills_categories` saiu das 3 linhas da ROTA? → SIM (PASS).**
   `grep user_skills_categories categories.routes.ts` = **0**. A prosa foi neutralizada ("substrato legado de
   skills-por-categoria" / "substrato legado de skills"), e o próprio comentário aponta que o nome técnico vive
   no guard. O nome técnico permanece em `scripts/audit-assign-skill-ghost-containment.mjs` (2×) e no cartório —
   ambos **fora do scan de `src/`** do validator. ✔
2. **architectural não acusa mais a rota? delta voltou a 0? → SIM (PASS).** Comparação in-situ airtight (mesma
   árvore, só a rota alternada via `git stash push -- <1 arquivo>`): **atual=33 · baseline(HEAD da rota)=33 ·
   delta=0**; `grep categories.routes.ts` no relatório architectural = **0 hits**. `critical_new = 0`. (exit 1 do
   script é só o baseline pré-existente de 33 criticals, alheio a F-OFFER-1.) Restauração conferida por hash
   (`9d1f705e`). ✔
3. **Substância da contenção intacta? → SIM (PASS).**
   - 501 antes do sink: `categories.routes.ts:788-790` → `reply.status(501).send(ASSIGN_SKILL_LEGACY_RECOUPLE_PAYLOAD)`
     na 1ª linha do handler; `code: 'ASSIGN_SKILL_LEGACY_RECOUPLE_PENDING'` (l.22).
   - `assignSkillToUser(` na rota = **0**. Imports do caminho ghost ausentes.
   - Service legado **intocado** (`categories.service.ts` fora do diff; `assignSkillToUser`/`INSERT user_skills_categories` ainda em l.1259).
   - Intento/replacement preservados: `replacement: '/profile/professional/c1/concepts'` (l.28) + mensagem apontando a cadeia DECISION-0143.
   - **Negative-proof reproduzida por mim:** reabri `assignSkillToUser(reply);` → guard **exit 1**; revertí → guard **exit 0**,
     rota voltou ao hash `9d1f705e`, `grep assignSkillToUser(` = 0 (sem resíduo da prova).
4. **Gates (rodados por mim) → todos PASS.**
   - **typecheck = 34 ✓** (idêntico ao baseline; 0 erros na rota).
   - **validate:regression-guards = EXIT 0 ✓** com `GATE OK [assign-skill-ghost-containment]` na cadeia.
   - **guard .mjs isolado = exit 0 ✓** (sem violação → "critical_new=0" do guard).
   - **architectural critical_new = 0 ✓** (item 2).
5. **Commit ficará SÓ com os 3 arquivos? → CONDIÇÃO AINDA ABERTA (STOP de commit).**
   O working tree **ainda tem `REMEDIATION_DT_LOG.md` modificado** (` M`), e seu diff continua sendo **carry-over
   de A1/U1** (`+## DT-A1-CARTORIO-0119-0120…` e `+## DT-DRIFT1-RLS-HARDENING…`) — **zero conteúdo de assign-skill/F-OFFER**.
   Não está committado (HEAD = `8259dfee`), então não posso afirmar que o commit o excluirá; mas confirmo que é
   **separável** (sem entrelaçamento com os 3 arquivos). ⇒ **STOP vinculante:** o commit de F-OFFER-1 deve ser
   `git add` seletivo de **exatamente** `backend/src/core/categories/categories.routes.ts` +
   `backend/scripts/audit-assign-skill-ghost-containment.mjs` + `backend/package.json`. Se `REMEDIATION_DT_LOG.md`
   (ou memorias/`opus.md`/orquestração) entrar no mesmo commit, isso **re-FALHA** a fatia. As DTs de A1/U1 devem
   ir em commit de cartório próprio dessas rodadas.

### TENTATIVAS DE REFUTAÇÃO (resultado)
- "Ainda há o token literal na rota" → REFUTADO: grep=0; só guard/cartório (fora do scan).
- "A remediação não zerou o architectural" → REFUTADO: delta in-situ = 0 (33→33), 0 hits na rota.
- "A remediação quebrou a contenção (501/guard/service)" → REFUTADO: 501 antes do sink, assignSkillToUser(=0, service intocado, negative-proof morde+reverte.
- "Algum gate quebrou" → REFUTADO: typecheck 34, regression-guards exit 0, guard exit 0.
- "O resíduo de escopo sumiu" → **NÃO**: `REMEDIATION_DT_LOG.md` segue sujo → tratado como STOP de commit (item 5).

### STOPs
- Contenção/tombstone com negative-proof que MORDE → presente e reproduzido. ✔
- DT-mãe 0113 OPEN respeitada; sem R2/delegação. ✔
- **STOP de commit (item 5): F-OFFER-1 commita SÓ os 3 arquivos; DT_LOG excluído.** ⚠ (condição para a promulgação não reabrir o resíduo.)
- Veredito é INSUMO, não GO nem promulgação.

### CONCLUSÃO
**PASS.** A Opção A resolveu os DOIS motivos do FAIL anterior na superfície de código: (a) `architectural critical_new`
voltou a **0** (token literal fora da rota, delta in-situ 33→33); a substância da contenção segue intacta (501 antes do
sink · `assignSkillToUser(`=0 · service intocado · intento/replacement preservados · negative-proof morde+reverte) e
todos os gates passam (typecheck 34 · regression-guards exit 0 · guard exit 0). **Resta o STOP de commit (item 5):**
o `REMEDIATION_DT_LOG.md` ainda está sujo no working tree (carry-over A1/U1) e **deve ser excluído** do commit de
F-OFFER-1 (git add seletivo dos 3 arquivos). Cumprido isso, F-OFFER-1 está pronto para a IA-DIRETORA levar a Clayton
promulgar. Working tree de código deixado idêntico ao entregue (só editei meu `respostas/IA-YALA.md`).

---

## RODADA 8 — RESEAL F-OFFER-2A (schema da DECISION-0144 · service concept-mandatory + FK RESTRICT) · VEREDITO

**RESPOSTA PARA:** IA-DIRETORA  (de: IA-YALA)
**VEREDITO: PASS** — com **1 STOP de commit** (item 7: commitar SÓ os 3 arquivos).
**HEAD no momento:** `eded4c05` (branch `rescue-structural`) — `decisions: DECISION-0144 declaration-to-service eligibility`.
  F-OFFER-2A no working tree (migration aplicada ao banco, id 402; ainda não committada). F-OFFER-1 já committado
  (`d9dcb1ef`+`ad71ecfd`+`4431b8fc`) — o STOP do DT_LOG da rodada anterior foi respeitado (DT carry-over em commit próprio).
**Revalidou no vivo:** SIM (total) — git + leitura da migration/guard + consultas READ-ONLY ao banco `unificard_dev`
  + negative-proofs e preflight-RAISE e idempotência reproduzidos por mim (probes em ROLLBACK / re-run no-op) + guard-NP
  (edita→roda→reverte, conferido).
**Fonte soberana:** `migrations/20260621100000_f_offer_2a_service_concept_mandatory_fk_restrict.sql`;
  `scripts/audit-service-concept-mandatory-fk-restrict.mjs`; `package.json`; `pg_constraint`/`information_schema`
  vivos; DECISION-0144 §A.2/§C (service concept-mandatory; D3-6A FK RESTRICT).
**Status:** RESPONDIDO.

### Os 7 itens da diretiva
1. **PÓS-APPLY no banco vivo → PASS.** `services.canonical_service_id` `is_nullable = NO`. As 3 FKs `confdeltype='r'`
   (RESTRICT): `actor_professional_concepts_concept_id_fkey`, `company_concept_publications_concept_id_fkey`,
   `services_canonical_service_id_fkey` (services→canonical_services). Rowcounts **inalterados**: svc=0/apc=1/ccp=0/cs=1.
   Migration registrada (id 402).
2. **NEGATIVE-PROOFS (reproduzidas por mim, ROLLBACK) → MORDEM.**
   (a) INSERT service com `canonical_service_id` NULL → ERRO "valor nulo na coluna canonical_service_id viola
   restrição de não-nulo"; **controle** com cs id válido → `INSERT 0 1`.
   (b) DELETE de concept referenciado por apc → ERRO RESTRICT "viola restrição de chave estrangeira
   actor_professional_concepts_concept_id_fkey … ainda é referenciada".
3. **PREFLIGHT fail-closed → PASS.** Li o `DO $$`: PROVA antes de qualquer ALTER; **NÃO corrige dado**; **sem
   DROP … CASCADE** (descobre a constraint e só dropa+readiciona a FK exata). Simulei sujeira em ROLLBACK
   (afrouxei NOT NULL + injetei service NULL + rodei a própria migration) → **RAISE `F-OFFER-2A STOP: 1 services
   com canonical_service_id NULL (corrigir dado+DECISAO, nao na migration)`** ANTES de ALTER; fora da tx nada mudou
   (NOT NULL intacto, services=0).
4. **GUARD-NP → MORDE E VOLTA.** Baseline guard exit 0. Enfraqueci a migration (apc `RESTRICT`→`NO ACTION`) →
   guard **exit 1** ("nao recria FK actor_professional_concepts.concept_id … ON DELETE RESTRICT"). Revertí → guard
   **exit 0**, `grep "ON DELETE NO ACTION"` = 0 (sem resíduo).
5. **CONTER ESCOPO → PASS.** Working tree = **3 arquivos**: migration (`??`) + guard (`??`) + `package.json` (` M`,
   só append de 1 linha do guard novo). ZERO runtime/`src` tocado (sem createService/service_offerings/availability/
   discovery/actor_capability_grants/ramo-4/dinheiro/docs/01_normative). **ZERO dado alterado** (rowcounts iguais;
   todos os probes em ROLLBACK; re-run da migration = no-op idempotente).
6. **GATES → todos PASS.** typecheck = **34**. validate:regression-guards = **EXIT 0** com
   `GATE OK [service-concept-mandatory-fk-restrict]`. architectural --strict = **33 criticals, 0 hits** em
   f_offer_2a → `critical_new = 0` (a fatia não toca `src/`; nada a regredir). Idempotência: re-rodar a migration
   no banco vivo = só `NOTICE … ja … (idempotente)`, **zero ALTER, zero erro**.
7. **STOP de commit → PRECONDIÇÃO LIMPA.** `REMEDIATION_DT_LOG.md` **NÃO** está sujo nesta rodada (foi committado
   à parte na F-OFFER-1). O commit de F-OFFER-2A deve ser `git add` seletivo de **exatamente**
   `migrations/20260621100000_f_offer_2a_service_concept_mandatory_fk_restrict.sql` +
   `scripts/audit-service-concept-mandatory-fk-restrict.mjs` + `package.json` — excluindo memorias/`opus`/orquestração/
   respostas (que seguem sujas por outras frentes). Se algo além dos 3 entrar, re-FALHA.

### TENTATIVAS DE REFUTAÇÃO (resultado)
- "Coluna não ficou NOT NULL / FKs não são RESTRICT" → REFUTADO no banco vivo (is_nullable=NO; 3× confdeltype='r').
- "As travas não mordem" → REFUTADO: NULL viola não-nulo; DELETE viola RESTRICT; controle INSERT 0 1 (reproduzidos).
- "A migration corrige dado / usa CASCADE / aplica DDL mesmo sujo" → REFUTADO: preflight RAISE antes de ALTER, sem CASCADE, sem correção (simulado).
- "O guard não protege a régua" → REFUTADO: enfraqueci RESTRICT→NO ACTION e o guard mordeu (exit 1).
- "A fatia vazou escopo / alterou dado" → REFUTADO: 3 arquivos, zero src/, rowcounts inalterados, re-run no-op.
- "Algum gate quebrou" → REFUTADO: typecheck 34, regression-guards exit 0, architectural critical_new=0, idempotente.

### STOPs
- Migration/constraint = enforcement com negative-proof que MORDE → presente e reproduzido (itens 2,3,4). ✔
- Não toquei R2/delegação; DT-mãe 0113 OPEN respeitada; sem dinheiro/payout/presença. ✔
- **STOP de commit (item 7): SÓ os 3 arquivos.** ⚠
- Veredito é INSUMO, não GO nem promulgação.

### CONCLUSÃO
**PASS.** F-OFFER-2A materializa o chão semântico do `service` exatamente como a DECISION-0144 manda: `service`
não nasce concept-less (`canonical_service_id NOT NULL`, e `canonical_services.concept_id` resolve concept por FK
RESTRICT) e a declaração/publicação (apc/ccp) não pode ter concept órfão nem deletado por baixo (FK RESTRICT). A
migration é fail-closed (preflight RAISE antes de ALTER, sem corrigir dado, sem CASCADE), idempotente e cercada por
guard que morde. Estado vivo, negative-proofs, preflight, guard-NP e gates todos confirmados de 1ª mão; zero dado
alterado. Pronto para a IA-DIRETORA levar a Clayton promulgar, cumprido o STOP de commit (só os 3 arquivos).
Working tree de código deixado idêntico ao entregue (migration restaurada do guard-NP; só editei meu `respostas/IA-YALA.md`).

---

## RODADA 9 — RESEAL F-OFFER-2B (runtime eligibility gate em createService · DECISION-0144) · VEREDITO

**RESPOSTA PARA:** IA-DIRETORA  (de: IA-YALA)
**VEREDITO: PASS** — substância e gates 8/8; STATUS é cartório (não material), conforme o modelo "3 material + cartório".
**HEAD no momento:** `740be591` (branch `rescue-structural`) — `feat(offer): service concept-mandatory schema … (F-OFFER-2A)`.
  F-OFFER-2B no working tree (não committado).
**Revalidou no vivo:** SIM (total) — git + leitura de `services.service.ts`/guard + gate-queries READ-ONLY em ROLLBACK
  + **end-to-end na função-gate REAL** (harness tsx descartável, gate só faz SELECT) + guard-NP (edita→roda→reverte)
  + gates (typecheck/regression-guards/architectural in-situ).
**Fonte soberana:** `src/modules/services/services.service.ts:107-160` (canRepresentActor + gate) e `:30-86`
  (assertDeclarationEligibility); `scripts/audit-createservice-eligibility.mjs`; `package.json`;
  `actor_professional_concepts`/`company_concept_publications` vivos; DECISION-0144 §A.4/5/6.
**Status:** RESPONDIDO.

### Os 8 itens da diretiva
1. **Gate wired + concept EXATO → PASS.** `createService` l.159 chama `this.assertDeclarationEligibility(tenantId, actor,
   canonical.conceptId)` APÓS `canonicalServiceService.requireActiveForTenant` (l.152) + `canonicalServiceId=canonical.id`
   (l.153) e ANTES de `servicesRepository.create` (l.163). Usa `canonical.conceptId` (resolvido do canonical_service; exato).
2. **PF/PJ gate-queries (reproduzidas por mim em ROLLBACK) → corretas.**
   PF = `actor_professional_concepts WHERE tenant_id,actor_id,concept_id AND is_active=true`; PJ =
   `company_concept_publications WHERE tenant_id,company_id,concept_id AND status='active'`.
   - PF-ALLOW (linha apc real, is_active=t) → 1. · PF-BLOCK-CONCEPT (outro concept) → 0. · PF-BLOCK-INACTIVE (CTE
     is_active=false sobre a mesma chave) → 0.
   - PJ-ALLOW (INSERT ccp `status='active'` REAL em ROLLBACK) → gate=1. · PJ-ABSENT (sem publicação) → 0. ·
     PJ-RETIRED (status≠'active') → 0.
   (Nota: deactivate/retire artificial bate em `chk_actor_professional_concepts_lifecycle`/`chk_ccp_lifecycle` —
   integridade de ciclo de vida; provei o predicado por CTE sem violar a constraint.)
3. **createService END-TO-END na função-gate REAL → PASS (403 controlado, não 500).** Harness tsx chamando o
   `assertDeclarationEligibility` REAL (o mesmo wired): **PF-no-decl → `ForbiddenError SERVICE_ELIGIBILITY_DECLARATION_REQUIRED`**;
   **PJ-no-pub → `ForbiddenError SERVICE_ELIGIBILITY_PUBLICATION_REQUIRED`**; **G3 (actor_type='system') →
   `ForbiddenError SERVICE_ELIGIBILITY_SUBJECT_UNSUPPORTED`**; **PF-allow (decl ativa) → resolve (ALLOW)**. Todos
   `ForbiddenError` (classe 403), nenhum 500. Harness apagado; o gate só faz SELECT (zero persistência).
4. **Sem bypass → PASS.** `canRepresentActor(tenantId, userId, input.actorId)` é exigido ANTES do gate (l.110-113,
   fail-closed 403) — declaração é SOMADA, não substitui autoridade. O `actor` vem de `actorRepository.findById`
   (server-side), não de `actionContext.actorId` (guard proíbe o token). Concept = `canonical.conceptId` exato; o
   guard proíbe fallback `domain/category/slug/relação` no corpo do eligibility (G5).
5. **G1/G3 → PASS.** G1: ACTIVE usa campo vivo (`is_active=true` / `status='active'`). G3: PF×PJ resolvido de forma
   DETERMINÍSTICA (PJ se `company_id`; PF se `actor_type='user'`; senão **erro controlado** `SUBJECT_UNSUPPORTED`,
   não heurística).
6. **GUARD-NP → MORDE E VOLTA.** Baseline guard exit 0. Enfraqueci PJ (`status='active'`→`'inactive'`) → guard
   **exit 1** ("check PJ ausente/enfraquecido"). Revertí → exit 0, `grep "status = 'inactive'"`=0 (sem resíduo;
   hash `547c12df`).
7. **ESCOPO → 3 material isolados; STATUS = cartório (esperado).** Material = `services.service.ts` +
   `audit-createservice-eligibility.mjs` + `package.json` (só append de 1 linha do guard). ZERO `src/` além do
   service; zero service_offerings/availability/discovery/material/dinheiro/grants/schema/`docs/01_normative`.
   **ZERO dado alterado** (rowcounts svc=0/apc=1/ccp=0/cs=1 inalterados; todos os probes em ROLLBACK; harness só SELECT).
   `STATUS_EXECUCAO_GLOBAL.md` está sujo (4º arquivo), mas é **cartório** com a closure da F-OFFER-2A (carry-over),
   não código de 2B → vai no **commit de cartório**, não no material (modelo "3 material + cartório").
8. **GATES → todos PASS.** typecheck = **34** (0 erros em services.service.ts). regression-guards = **EXIT 0** com
   `GATE OK [createservice-eligibility]`. architectural --strict in-situ (stash de services.service.ts): **atual 33 ==
   baseline 33, 0 hits** no arquivo → `critical_new = 0`.

### TENTATIVAS DE REFUTAÇÃO (resultado)
- "Gate não está antes do create / concept não é exato" → REFUTADO (l.159 antes do l.163; `canonical.conceptId`).
- "PF/PJ aceitam inativo/retired" → REFUTADO: predicado `is_active=true`/`status='active'` bloqueia (CTE + dados reais).
- "createService devolve 500, não 403" → REFUTADO: função-gate REAL devolve `ForbiddenError` com os 3 códigos.
- "Declaração substitui autoridade / actionContext spoofa" → REFUTADO: canRepresentActor antes; actor server-side; guard proíbe actionContext.actorId.
- "Heurística PF×PJ" → REFUTADO: determinístico + `SUBJECT_UNSUPPORTED` no resto.
- "Guard não protege" → REFUTADO: enfraqueci PJ e mordeu (exit 1).
- "Vazou escopo / alterou dado / regrediu gate" → REFUTADO: 3 material, zero dado, typecheck 34, guards exit 0, critical_new=0.

### STOPs
- Gate de autoridade/elegibilidade com negative-proof que MORDE → presente e reproduzido (itens 2,3,6). ✔
- Não toquei R2/delegação; DT-mãe 0113 OPEN respeitada; sem dinheiro/payout/presença/grants. ✔
- **STOP de commit:** material = SÓ os 3 arquivos; cartório (STATUS/CONSOLIDADO/respostas) em commit próprio.
- Veredito é INSUMO, não GO nem promulgação.

### CONCLUSÃO + RECOMENDAÇÃO DE COMMIT
**PASS (8/8).** F-OFFER-2B fecha a ponte declaração→service da DECISION-0144 em runtime: `createService` só cria
`service` descobrível se houver declaração PF (`actor_professional_concepts.is_active=true`) / publicação PJ
(`company_concept_publications.status='active'`) ACTIVE do **mesmo concept_id exato** (do canonical), **somado** a
`canRepresentActor` (declaração ≠ autoridade), com 403 controlado, sem heurística e sem fallback semântico; cercado
por guard que morde. Estado vivo, gate-queries, end-to-end na função real, guard-NP e gates todos confirmados de 1ª
mão; zero dado alterado.
**Recomendação de commit (PASS):**
- **Commit MATERIAL (3 arquivos):** `backend/src/modules/services/services.service.ts` +
  `backend/scripts/audit-createservice-eligibility.mjs` + `backend/package.json`.
- **Commit CARTÓRIO (separado):** `STATUS_EXECUCAO_GLOBAL.md` (closure) + CONSOLIDADO/respostas da orquestração.
  NÃO misturar cartório no commit material.
Working tree de código deixado idêntico ao entregue (services.service.ts restaurado do guard-NP; harness tsx apagado;
só editei meu `respostas/IA-YALA.md`).

---

## RODADA 10 — RESEAL F-OFFER-3 (vínculo service→service_offering · DECISION-0145 · MODO B) · VEREDITO

**RESPOSTA PARA:** IA-DIRETORA  (de: IA-YALA)
**VEREDITO: PASS (8/8).**
**HEAD no momento:** `d100186c` (branch `rescue-structural`) — `decisions: DECISION-0145 service-to-offering binding`.
  F-OFFER-3 no working tree (migration aplicada, id 403; não committada). F-OFFER-2B committado (`d2cf007c`); cartório limpo.
**Revalidou no vivo:** SIM (total) — git + leitura de `service-offering.service.ts`/migration/guard + consultas
  READ-ONLY + **createOffering REAL end-to-end** (harness tsx com ports injetados, descartável) + resolução/INSERT
  replicados em ROLLBACK + guard-NP (edita→roda→reverte) + gates.
**Fonte soberana:** `src/modules/services/service-offering.service.ts:83-160`;
  `migrations/20260621120000_f_offer_3_service_offering_service_id_mandatory.sql`;
  `scripts/audit-service-offering-binding.mjs`; `package.json`; `pg_constraint`/`information_schema` vivos; DECISION-0145 §A/§B-bis.
**Status:** RESPONDIDO.

### Os 8 itens
1. **PÓS-APPLY → PASS.** `service_offerings.service_id` `is_nullable=NO`; FK `service_offerings_service_id_fkey`
   `confdeltype='r'` (services(service_id) RESTRICT; era SET NULL); migration registrada (id 403); rowcounts so=0/svc=0.
2. **createOffering END-TO-END → PASS.**
   - (b) **SEM service** (provider PF REPRESENTÁVEL, ports injetados) → função REAL lança `ServiceOfferingError 403
     SERVICE_OFFERING_REQUIRES_SERVICE` (não 500); nada persistiu (so/svc=0).
   - (c) **>1 service** → resolução=2 (ROLLBACK) → o código lança `409 SERVICE_OFFERING_SERVICE_AMBIGUOUS`
     (não há UNIQUE bloqueando 2 services p/ mesmo provider+canonical → o 409 é alcançável e necessário).
   - (a)(d)(e)(f) via **réplica EXATA do INSERT em ROLLBACK** (com serviceId resolvido + company derivado):
     cria com `service_id` preenchido, `status='draft'`, `company_id` derivado server-side (PF→NULL; PJ→company do actor),
     `professional_actor_id=NULL` (body ignorado).
3. **Resolução (ROLLBACK reproduzida) → PASS.** 0→block · 1→resolve · 2→ambíguo (SELECT por tenant+actor_id+canonical_service_id).
4. **Sem bypass → PASS.** `input.companyId`/`input.professionalActorId` = **0 usos** no arquivo (grep); INSERT usa
   `derivedCompanyId` (`SELECT company_id FROM actors WHERE id=provider`) e `null`. concept EXATO via `canonical.id`
   (sem category/domain/slug/grafo). `canRepresentActor(tenantId,userId,providerActorId)` é **ANTES** (l.97-101,
   fail-closed 403 NOT_REPRESENTABLE) — confirmado end-to-end (probe sem representação parou aí). Identidade
   consistente: `actors.id==actor_id` (10/10), `services.actor_id` e `service_offerings.provider_actor_id` → `actors(id)`.
5. **GUARD-NP → MORDE E VOLTA.** Baseline exit 0. Enfraqueci INSERT `'draft'`→`'active'` → guard **exit 1** (2 falhas:
   não nasce draft / ainda crava active). Revertí → exit 0, `grep "'active')"`=0 (hash `077ac1f3`).
6. **ESCOPO → PASS.** 4 material: `service-offering.service.ts` + migration + guard + `package.json` (append de 1 linha).
   ZERO availability/discovery/dinheiro/grants/service_order/`docs/01_normative`; cartório limpo (nada sujo).
   **ZERO dado alterado** (so=0/svc=0 antes e depois; todos os probes em ROLLBACK; harness só SELECT até o throw).
7. **GATES → PASS.** typecheck=**34** (0 erros no arquivo). regression-guards=**EXIT 0** com `GATE OK [service-offering-binding]`.
   architectural --strict in-situ: atual **33 == baseline 33, 0 hits** no arquivo → `critical_new=0`. Idempotência:
   re-run da migration = só `NOTICE … ja … (idempotente)`, zero ALTER/erro.
8. **price_cents → PASS.** `service_offerings.price_cents` = **bigint** (cents; não NUMERIC). Esta fatia NÃO move dinheiro
   (nenhum bank_*/ledger/split/payout tocado).

### TENTATIVAS DE REFUTAÇÃO (resultado)
- "service_id não é mandatório/FK fraca" → REFUTADO (NOT NULL + RESTRICT no banco vivo).
- "createOffering devolve 500 / cria sem service" → REFUTADO: função REAL lança 403 REQUIRES_SERVICE.
- "company/professional vêm do body" → REFUTADO: 0 usos de input.companyId/professionalActorId; derivado/null no INSERT.
- "nasce active" → REFUTADO: INSERT 'draft'; guard morde se voltar a 'active'.
- "declaração substitui autoridade" → REFUTADO: canRepresentActor ANTES (fired em probe sem representação).
- "concept por category/domain" → REFUTADO: resolve por canonical.id exato.
- "vazou escopo / alterou dado / regrediu gate" → REFUTADO: 4 material, zero dado, typecheck 34, guards exit 0, critical_new=0, price bigint.

### STOPs
- Vínculo/binding com negative-proof que MORDE → presente e reproduzido (itens 2,3,5). ✔
- Não toquei R2/delegação; DT-mãe 0113 OPEN respeitada (e reforçada: canRepresentActor antes); sem dinheiro/payout/presença/grants. ✔
- **STOP de commit:** material = SÓ os 4 arquivos; cartório (STATUS/CONSOLIDADO/respostas) em commit próprio.
- Veredito é INSUMO, não GO nem promulgação.

### CONCLUSÃO + RECOMENDAÇÃO DE COMMIT
**PASS (8/8).** F-OFFER-3 amarra a oferta ao `service` da cadeia única CONCEPT→SERVICE→SERVICE_OFFERING (DECISION-0145
MODO B): `createOffering` exige/resolve um `service` do MESMO provider+canonical (0→403, >1→409), popula `service_id`,
deriva `company_id` server-side (body não autoriza), nasce `draft`, não carimba professional do body; o schema torna
`service_id` NOT NULL + FK RESTRICT (preflight fail-closed, idempotente, sem CASCADE); a elegibilidade da 0144 é
HERDADA do service (não duplicada) e `canRepresentActor` permanece ANTES. Estado vivo, end-to-end na função real,
resolução, réplica de INSERT, guard-NP e gates todos confirmados de 1ª mão; price_cents bigint; zero dado alterado.
**Recomendação de commit (PASS):**
- **Commit MATERIAL (4 arquivos):** `backend/src/modules/services/service-offering.service.ts` +
  `backend/migrations/20260621120000_f_offer_3_service_offering_service_id_mandatory.sql` +
  `backend/scripts/audit-service-offering-binding.mjs` + `backend/package.json`.
- **Commit CARTÓRIO (separado):** `STATUS_EXECUCAO_GLOBAL.md` + `CONSOLIDADO.md` + respostas da orquestração. Não misturar.
Working tree de código deixado idêntico ao entregue (service-offering.service.ts restaurado do guard-NP; harness tsx
apagado; só editei meu `respostas/IA-YALA.md`).

---

## RODADA 11 — RESEAL F-OFFER-4 V1 (discovery re-key por concept_id · DECISION-0142 · MODO B) · VEREDITO

**RESPOSTA PARA:** IA-DIRETORA  (de: IA-YALA)
**VEREDITO: PASS (6/6).**
**HEAD no momento:** `f6c07742` (branch `rescue-structural`) — `docs(orchestration): add pre-front preflight rule`.
  F-OFFER-4 V1 no working tree (não committado). F-OFFER-3 committado.
**Revalidou no vivo:** SIM (total). Método: orquestração ultracode (workflow — 4 leitores estáticos em paralelo +
  1 executor comportamental serializado no tree vivo) **e** re-verificação pessoal de 1ª mão dos pontos materiais
  (régua-núcleo no código, guard-NP próprio, gates, restauração do working tree). Disco vence narrativa — não
  homologo só pelo workflow.
**Fonte soberana:** `src/modules/services/services-discovery.service.ts:375-388` (search);
  `src/modules/services/services.service.ts:312-335` (wrapper discoverServices);
  `src/modules/services/services.repository.ts:199-264` (discoverServices);
  `src/core/semantic/semantic.adapter.ts:40-50` (resolveConceptFromCategory);
  `scripts/audit-discovery-concept-rekey.mjs`; `package.json`. Régua DECISION-0142.
**Status:** RESPONDIDO.

### Os 6 itens
1. **2 superfícies resolvem category→concept + gate folha → PASS.**
   search (l.377-388): `resolveConceptFromCategory(filters.categoryId)` → `conceptId`; se null → `throw BadRequestError
   'CATEGORY_REQUIRES_LEAF_CONCEPT…'`; passa `{ conceptId, … }` a `discoverServices` (NUNCA categoryId). Wrapper
   (services.service.ts:314-335): mesma resolução, mesmo 403, passa `conceptId`. **End-to-end na função REAL**
   (harness descartável, apagado): leaf `52f2c594` (concept NOT NULL) → resolve e casa por concept (rows=0, sem erro,
   sem busca ampla); não-folha `1db3d9b9` (concept NULL) → `BadRequestError status=400 CATEGORY_REQUIRES_LEAF_CONCEPT`
   (não 500, não busca ampla); wrapper idêntico. (DB: 77/147 categorias com concept, 70 NULL disparam o gate.)
2. **Matching material por concept_id → PASS.** repo (l.213-220): `if (conceptId) INNER JOIN canonical_services cs ON
   cs.id = s.canonical_service_id` + `cs.concept_id = $N`. Base conditions = só `s.tenant_id` + `s.status='active'`.
   **ROLLBACK com fixture** (executor): service do PF `b682724c` ligado ao canonical `332e2164` (concept `6be2e6e3`)
   → query material com `cs.concept_id='6be2e6e3'` retorna 1 row; com `7bf6c6a8` → 0 rows (sem falso-match). Nenhuma
   das 2 superfícies passa categoryId/domain como identidade material (categoryId só chega ao repo por callers de
   navegação, ex. marketplace-search, fora do V1).
3. **Reuso cross-domain (invariante 0142) → PASS.** O matching READ **não referencia `domain`** (só comentário em
   services.repository.ts:214; zero filtro `domain='servicos'`). **Prova por construção** (ROLLBACK): canonical ligado
   ao concept `d914ff0c` cujo `domain='educacao-e-conhecimento'` (≠ servicos) + service → a mesma query por
   `cs.concept_id='d914ff0c'` retornou o service. concept_id = identidade; domain = breadcrumb. Confirmado.
4. **ESCOPO → PASS.** Exatamente **5 material**: `services-discovery.service.ts` + `services.service.ts` +
   `services.repository.ts` + `package.json` (append de 1 linha do guard) + `audit-discovery-concept-rekey.mjs` (novo).
   `marketplace-search.service.ts` **INTOCADO** (git diff vazio; segue category-tree). `assertServicosCategory`
   **INTOCADO** (def em services-discovery.service.ts:305, write-path; diff só toca read-path ~373-388). ZERO
   migration / docs/01_normative / frontend / dinheiro(bank_ledger/splits/payout) / availability / ranking / presence /
   service_order. `categories.concept_id` usado **só como hop efêmero de leitura** (`semantic.adapter` é SELECT);
   **nenhum concept_ref persistido** (services não tem coluna concept; nenhum INSERT/UPDATE de concept introduzido;
   diff só usa conceptId como parâmetro de SELECT/JOIN).
5. **GUARD-NP → MORDE E VOLTA (reproduzido por mim).** Baseline guard exit 0 (estável: rodei 2×). Reintroduzi
   `categoryId: filters.categoryId` no call de `discoverServices` da search → guard **exit 1** com 2 falhas
   ("search não passa conceptId" + "voltou a passar categoryId: filters.categoryId … matching por category é proibido"),
   **na superfície certa** (services-discovery.service.ts), sem falso-positivo em marketplace-search. Revertí →
   exit 0; diff-hash de volta a `d27993d6` (idêntico ao entregue); grep do token = 0.
6. **GATES → PASS (1ª mão).** typecheck = **34** (== baseline; 0 erros nos 3 arquivos). regression-guards = **EXIT 0**
   com `GATE OK [discovery-concept-rekey]`. architectural --strict = **33 CRITICAL == baseline 33**, **0 hits** nos 3
   arquivos da fatia → `critical_new = 0` (corroborado pelo workflow via stash-pop delta 0). bank-ledger-boundaries e
   actor-writer-boundaries = EXIT 0 (executor).

### OBSERVAÇÕES (não-bloqueantes, não reprovam pela régua)
- **Busca ampla quando concept ausente:** o wrapper `discoverServices` (/services/discover) tem `categoryId` OPCIONAL;
  chamado SEM `category_id`, `conceptId` fica undefined, o JOIN é pulado e retorna serviços `active` filtrados só por
  localização. Isso é "busca ampla sem concept" — **mas NÃO usa categoryId/domain como identidade material** (nenhum
  categoryId chega ao repo pelas 2 superfícies V1), então **não fere a régua** (que só proíbe category/domain-como-identidade).
  É comportamento de listagem pré-existente, não re-key por category. Registro para a IA-DIRETORA decidir se um V2
  exigirá concept também no path sem-categoria.
- **Assimetria do guard:** o wrapper é guardado por `resolveConceptFromCategory` + gate-folha + morder
  `categoryId:filters.categoryId`, mas (diferente da search) não tem a checagem positiva "passa conceptId". Aresta mais
  fraca; risco baixo no V1 (folha exigida + repo só casa por cs.concept_id). Sugestão de hardening futuro, não bloqueia.
- **Guard estável:** o "FAIL transitório" notado na análise era artefato de cwd/env; rodado a partir de `backend/`
  é determinístico exit 0 (confirmei 2×).

### STOPs
- Re-key/contenção de discovery com negative-proof que MORDE → presente e reproduzido por mim (item 5). ✔
- Não toquei R2/delegação; DT-mãe 0113 OPEN respeitada; sem dinheiro/payout/presença/availability/service_order. ✔
- **STOP de commit:** material = SÓ os 5 arquivos (git add explícito); cartório (STATUS/CONSOLIDADO/respostas) em
  commit próprio. O working tree tem muito doc/memória/cartório sujo PRÉ-EXISTENTE — `git add -A` arrastaria tudo e
  violaria o recorte; travar com add específico dos 5 caminhos.
- Veredito é INSUMO, não GO nem promulgação.

### CONCLUSÃO + RECOMENDAÇÃO DE COMMIT
**PASS (6/6).** F-OFFER-4 V1 re-keya as 2 superfícies READ de discovery de serviços (search + wrapper discoverServices)
para casar por `concept_id` material (services.canonical_service_id → canonical_services.concept_id), resolvendo
`category→concept` como hop efêmero de leitura com gate de folha fail-closed (`CATEGORY_REQUIRES_LEAF_CONCEPT`), sem
filtro `domain`/`category` como identidade, sem persistir concept_ref, reuso cross-domain provado (invariante 0142);
`marketplace-search`/`assertServicosCategory` intocados; guard mira as superfícies READ de serviços e morde; gates
verdes; zero escopo proibido; zero dado alterado (probes em ROLLBACK; harness apagado). Tudo confirmado de 1ª mão
(workflow + re-verificação pessoal).
**Recomendação de commit (PASS):**
- **Commit MATERIAL (5 arquivos):** `backend/src/modules/services/services-discovery.service.ts` +
  `backend/src/modules/services/services.service.ts` + `backend/src/modules/services/services.repository.ts` +
  `backend/scripts/audit-discovery-concept-rekey.mjs` + `backend/package.json` (git add explícito).
- **Commit CARTÓRIO (separado):** `STATUS_EXECUCAO_GLOBAL.md` + `CONSOLIDADO.md` + respostas da orquestração. Não misturar.
Working tree de código deixado idêntico ao entregue (services-discovery.service.ts restaurado do meu guard-NP, hash
`d27993d6`; harnesses do workflow apagados; só editei meu `respostas/IA-YALA.md`).

---

## RODADA 12 — RESEAL F-OFFER-5/6 (integridade temporal + conflito de booking por provider · DECISION-0146 · MODO C) · VEREDITO

**RESPOSTA PARA:** IA-DIRETORA  (de: IA-YALA)
**VEREDITO: PASS (6/6) — PROVA DE CORRIDA MODO C ESTÁVEL (8/8 exactly-one).**
**HEAD no momento:** `891dfa87` (branch `rescue-structural`) — `docs(orchestration): version F-OFFER-5/6 read-first evidence (DECISION-0146)`.
  F-OFFER-5/6 no working tree (não committado). F-OFFER-4 committado; cartório limpo.
**Revalidou no vivo:** SIM (total) — git + leitura dos 5 arquivos + **prova de corrida e sub-testes na função REAL**
  (`unifiedAvailabilityRepository.confirmBookingWithProviderLock`, harness tsx descartável + fixture committed +
  teardown completo) + detecção em ROLLBACK + guard-NP (edita→roda→reverte) + gates.
**Fonte soberana:** `unified-availability.repository.ts:354-411` (confirmBookingWithProviderLock);
  `unified-availability.service.ts:301-329` (confirm → guard); `service-feed.plugin.ts:203-208` (contenção/comentário);
  `availability-owner-authority.ts` (resolveAvailabilityOwner); `audit-booking-provider-conflict.mjs`; `package.json`.
**Status:** RESPONDIDO.

### Os 6 itens
1. **END-TO-END na função REAL (fixture+teardown) → PASS (7/7 cenários).**
   (a) confirm sem conflito → **confirmed**. (b) 2º booking sobreposto MESMO provider → **409 BOOKING_PROVIDER_TIME_CONFLICT**.
   (c) back-to-back `[11,12)` vs `[10,11)` → **confirmed** (NÃO conflita; overlap meio-aberto). (d) **CROSS-OFERTA**
   do mesmo provider (2 service_offerings) → **409** (rollup por provider). (e) provider DIFERENTE mesmo horário →
   **confirmed**. (f) `owner_type≠service_offering` → **fora do guard** (service só chama o lock quando
   `ownerType===SERVICE_OFFERING`; senão path normal — code-read l.314-326). (g) availability **sobreposta
   (DECLARAÇÃO)** inserida sem bloqueio (sem EXCLUDE/trigger de overlap) → permitido.
2. **PROVA DE CORRIDA (MODO C, obrigatória) → PASS, ESTÁVEL.** 2 confirms concorrentes (`Promise.all`), mesmo
   provider, intervalos sobrepostos (cross-oferta), com RESET a cada iteração: **8/8 runs = EXATAMENTE 1 confirma /
   1 conflito (409) / `dbConfirmed=1`**; `allExactlyOne=true`, `neverBoth=true`. `pg_advisory_xact_lock(tenant:provider)`
   serializa → o 2º espera o commit do 1º e vê o compromisso → 409. NUNCA os dois em status bloqueante.
   (Obs metodológica: numa 1ª passada sem reset, runs 1-4 deram 0-confirmados/2-conflitos — era **bug do meu
   harness** (vencedor do run 0 persistia e bloqueava), NÃO falha do guard; corrigido com reset → 8/8 determinístico.)
3. **Derivação server-side + self-exclusão → PASS.** Provider DERIVADO via `resolveAvailabilityOwner(tenant,
   SERVICE_OFFERING, availability.ownerId)` → `service_offerings.provider_actor_id` (server-side, NUNCA do body).
   Intervalo vem de `availability.startDatetime/endDatetime` (NUNCA do body). Self EXCLUÍDO (`b2.booking_id <> $3`):
   reconfirmar um booking já confirmed deu **BOOKING_CONFIRM_INVALID_STATE** (não falso-positivo de conflito por si mesmo).
4. **GUARD-NP → MORDE E VOLTA (reproduzido por mim).** Baseline exit 0. (i) removi `pg_advisory_xact_lock` →
   guard **exit 1** ("sem pg_advisory_xact_lock — G7"). (ii) removi `checked_out` do conjunto bloqueante → guard
   **exit 1** ("conjunto bloqueante não é {confirmed,checked_in,checked_out} — G4"). Ambos revertidos; hashes de volta
   a `76272d25`/`75074e3e`, guard exit 0. (As demais NPs — provider do body, self-exclusion, overlap fechado, rollup
   por offering — são cobertas pelos checks estáticos do guard l.29-31/52, lidos de 1ª mão.)
5. **ESCOPO → PASS.** **5 material**: `unified-availability.repository.ts` + `unified-availability.service.ts` +
   `service-feed.plugin.ts` + `package.json` (append de 1 linha) + `audit-booking-provider-conflict.mjs` (novo).
   ZERO migration/01_normative/frontend/dinheiro(bank_ledger/splits/payout)/discovery/ranking/presence/service_order
   (git diff name-only → nenhum path proibido). availability **sem EXCLUDE/bloqueio** (declaração livre).
   `service-feed.plugin.ts` = **só comentário de contenção** (query intocada; grep do diff não-comentário = vazio).
   `marketplace-search` e `assertServicosCategory` (def. em services-discovery.service.ts, fora do diff) **INTOCADOS**.
   **ZERO dado alterado** (fixture da corrida 100% revertida; teardown restaurou baseline svc=0/so=0/av=48/bk=0).
6. **GATES → PASS.** typecheck = **34** (== baseline; 0 erros nos arquivos da fatia). regression-guards = **EXIT 0**
   com `GATE OK [booking-provider-conflict]`. architectural --strict in-situ (stash dos 3 .ts): **33 == baseline 33**,
   **0 hits** nos arquivos da fatia → `critical_new = 0`.

### TENTATIVAS DE REFUTAÇÃO (resultado)
- "A corrida fura (os dois confirmam)" → REFUTADO: 8/8 exactly-one, neverBoth=true; advisory-lock serializa.
- "Back-to-back conflita" → REFUTADO: `[11,12)` após `[10,11)` confirmou (overlap meio-aberto correto).
- "Conflito é por offering, não por provider" → REFUTADO: cross-oferta (2 offerings, mesmo provider) deu 409.
- "Provider/intervalo vêm do body" → REFUTADO: derivados de availability→service_offering server-side (code + guard).
- "Self dá falso-positivo na reconfirmação" → REFUTADO: reconfirm deu INVALID_STATE, não conflito.
- "availability é bloqueada" → REFUTADO: sem EXCLUDE/trigger; overlapping declarations inseridas sem erro.
- "Guard não morde / vazou escopo / regrediu gate" → REFUTADO: guard mordeu (G7,G4); 5 material; zero dado; gates verdes.

### STOPs
- Integridade/conflito com negative-proof que MORDE **e prova de corrida** → presentes e reproduzidos por mim. ✔
- Conflito = recusa fail-closed (Art. II: NUNCA auto-resolve/escolhe horário) — confirmado no código. ✔
- Não toquei R2/delegação; DT-mãe 0113 OPEN respeitada; sem dinheiro/payout/presença. ✔
- **STOP de commit:** material = SÓ os 5 arquivos (git add explícito); cartório (STATUS/CONSOLIDADO/respostas) em
  commit próprio; working tree tem muito doc/cartório pré-existente sujo — `git add -A` violaria o recorte.
- Veredito é INSUMO. **MODO C: a promulgação é ato MANUAL de Clayton — sem condicional automática.**

### CONCLUSÃO + RECOMENDAÇÃO DE COMMIT
**PASS (6/6), com a prova de corrida MODO C estável (8/8 exactly-one, never-both).** F-OFFER-5/6 torna o COMPROMISSO
(confirm de booking) à prova de corrida e por-provider: `confirmBookingWithProviderLock` serializa por
`pg_advisory_xact_lock(tenant:provider)`, recusa fail-closed um 2º booking do mesmo provider em status
{confirmed,checked_in,checked_out} com intervalo `[start,end)` sobreposto (back-to-back livre, self excluído, rollup
cross-oferta), checagem+gravação na MESMA transação; provider/intervalo derivados server-side; `availability` segue
declarativa (não bloqueada); guard mira o confirm e morde. Tudo de 1ª mão; zero dado alterado; gates verdes.
**Recomendação de commit (PASS):**
- **Commit MATERIAL (5 arquivos):** `backend/src/core/availability/unified-availability.repository.ts` +
  `backend/src/core/availability/unified-availability.service.ts` + `backend/src/modules/services/service-feed.plugin.ts` +
  `backend/scripts/audit-booking-provider-conflict.mjs` + `backend/package.json` (git add explícito).
- **Commit CARTÓRIO (separado):** `STATUS_EXECUCAO_GLOBAL.md` + `CONSOLIDADO.md` + respostas. Não misturar.
- **Promulgação:** ato MANUAL de Clayton (MODO C) — meu veredito é insumo, não a dispara.
Working tree de código deixado idêntico ao entregue (repository/service restaurados dos guard-NP, hashes
`76272d25`/`75074e3e`; harnesses tsx apagados; fixture da corrida revertida; só editei meu `respostas/IA-YALA.md`).

---

## RODADA 13 — RESEAL CAMINHO B1 (prova de jornada da oferta PRÉ-DINHEIRO · MODO B) · VEREDITO

**RESPOSTA PARA:** IA-DIRETORA  (de: IA-YALA)
**VEREDITO: PASS (6/6) — jornada fecha 9/9, EXIT 0, zero dado alterado.**
**HEAD no momento:** `b9429e72` (branch `rescue-structural`) — `docs(orchestration): version F-OFFER-5-6 temporal integrity evidence`.
  B1 no working tree (não committado). F-OFFER-5/6 committado; cartório limpo.
**Revalidou no vivo:** SIM (total) — git + leitura do e2e + **execução real** de `pnpm run e2e:offer-journey`
  (funções reais, fixture committed + teardown) + verificação de baseline (zero dado) + gates.
**Fonte soberana:** `src/scripts/e2e-offer-journey-pre-money.ts`; `package.json` (script `e2e:offer-journey`);
  funções reais `servicesService.discoverServices` · `serviceOfferingService.listActiveBycanonicalService` ·
  `unifiedAvailabilityService.createBooking/updateBooking`.
**Status:** RESPONDIDO.

### Os 6 itens
1. **e2e 9/9 PASS, EXIT 0, funções REAIS → PASS.** Rodei `npm run -s e2e:offer-journey`: 9 asserts PASS, EXIT 0.
   Exercita as funções reais (DI dos social ports injetada como no app.builder): discover→service→by-canonical→
   availability→createBooking→confirm→2º confirm sobreposto→back-to-back. (bank_ledger inalterado: ledger=0.)
2. **canonicalServiceId viaja na discovery (sem fix de DTO) → PASS.** Passo 2: `discoverServices` retornou o service
   com `canonicalServiceId === CS` da fixture (`=f9590145…`) — o DTO de discovery JÁ carrega o canonical; não precisou
   de correção.
3. **Draft oculto + discriminação real (não trivial) → PASS.** Passo 3: by-canonical retornou a offering ACTIVE;
   passo 4: **NÃO** retornou a DRAFT (active-only). Passo 8: 2º booking SOBREPOSTO `[11,13)` do MESMO provider →
   **409 BOOKING_PROVIDER_TIME_CONFLICT** (mensagem real capturada); passo 9: back-to-back `[12,13)` vs `[10,12)` →
   **confirmed**. A discriminação 409-vs-confirma é material (intervalos reais via guard F-OFFER-5/6), não assert trivial.
4. **TEARDOWN restaura virgem / ZERO dado → PASS.** Baseline ANTES = svc=0/so=0/av=48/bk=0/cs=1; DEPOIS do e2e =
   **svc=0/so=0/av=48/bk=0/cs=1** (idêntico). Teardown remove canonical/service/offerings(active+draft)/3 janelas/
   bookings da fixture. Nada persistido.
5. **ESCOPO → PASS.** **2 material**: `src/scripts/e2e-offer-journey-pre-money.ts` (novo) + `package.json` (append de
   1 linha: `"e2e:offer-journey": "tsx src/scripts/e2e-offer-journey-pre-money.ts"`). `git diff --name-only` de código =
   só `package.json`; untracked em `backend/src` = só o e2e. ZERO prod-code/migration/frontend/dinheiro/`docs/01_normative`.
   A prova **NÃO ativa nada público** nem abençoa ativação self-serve — é um script de teste que cria+derruba fixture;
   a lógica de ativação pública (Caminho A) **segue HOLD, intocada**.
6. **GATES → PASS.** typecheck = **34** (== baseline; 0 erros no e2e). regression-guards = **EXIT 0**. architectural
   --strict = **33 == baseline 33**, **0 hits** no e2e → `critical_new = 0`.

### TENTATIVAS DE REFUTAÇÃO (resultado)
- "É mock/não exercita o real" → REFUTADO: importa e chama os services reais (discover/by-canonical/booking/confirm) com ports injetados.
- "canonicalServiceId não viaja (precisaria fix de DTO)" → REFUTADO: passo 2 PASS, canonId===CS no retorno do discover.
- "Draft vaza / discriminação é trivial" → REFUTADO: draft oculto (passo 4); 409-sobreposto vs confirma-back-to-back são intervalos reais pelo guard.
- "Deixa resíduo / altera dado" → REFUTADO: baseline idêntico antes/depois (svc/so/av/bk/cs); teardown no finally.
- "Toca prod/ativa público" → REFUTADO: 2 arquivos (script+package.json); nenhum prod-code; Caminho A HOLD intocado.
- "Quebra gate" → REFUTADO: typecheck 34, regression-guards EXIT 0, architectural critical_new=0.

### STOPs
- Prova de jornada com funções reais + teardown → DB virgem restaurado; zero dado. ✔
- Não ativa ativação pública (Caminho A HOLD); não toca dinheiro/payout/presença. ✔
- Não toquei R2/delegação; DT-mãe 0113 OPEN respeitada. ✔
- Veredito é INSUMO. **MODO B: a promulgação/commit é decisão da IA-DIRETORA/Clayton — meu veredito não dispara.**

### CONCLUSÃO + RECOMENDAÇÃO DE COMMIT
**PASS (6/6).** O CAMINHO B1 prova de 1ª mão que a cadeia já construída CONECTA ponta-a-ponta pré-dinheiro:
discover → `service.canonicalServiceId` → by-canonical (active-only, draft oculto) → offering → availability →
`createBooking(requested)` → confirm → 2º confirm sobreposto do mesmo provider **bloqueia (409)** e back-to-back
**confirma** — tudo via funções reais, sem tocar dinheiro/frontend/ativação pública, com fixture committed e teardown
que restaura o DB virgem (zero dado alterado). Gates verdes.
**Recomendação de commit (PASS):**
- **Commit MATERIAL (2 arquivos):** `backend/src/scripts/e2e-offer-journey-pre-money.ts` + `backend/package.json` (git add explícito).
- **Commit CARTÓRIO (separado):** `STATUS_EXECUCAO_GLOBAL.md` + `CONSOLIDADO.md`. Não misturar.
READ-ONLY: nenhuma edição de código (só rodei o e2e); fixture do e2e revertida pelo próprio teardown; baseline
conferido idêntico; só editei meu `respostas/IA-YALA.md`. Nada commitado.

---

## RODADA 14 — RESEAL F-INTERNAL-FINANCIAL-AUTHORITY-CONTAINMENT (P1 fail-closed · MODO C) · VEREDITO

**RESPOSTA PARA:** IA-DIRETORA  (de: IA-YALA)
**VEREDITO: PASS (7/7) — 7 controllers /internal financeiros contidos a 501, provado por inject fastify REAL.**
**HEAD no momento:** `aaeb50b5` (branch `rescue-structural`) — `docs(orchestration): add systemic x-ray consolidation`.
  Fatia no working tree (não committada). Cartório limpo (desta fatia).
**Revalidou no vivo:** SIM (total) — git + leitura dos 7 controllers + guard + precedente +
  **inject fastify REAL nos 7** (harness tsx descartável, apagado) + guard-NP (edita→roda→reverte) + gates.
**Fonte soberana:** os 7 controllers contidos; `scripts/audit-internal-financial-authority-containment.mjs`;
  `package.json`; precedente `src/modules/disputes/financial-dispute.controller.ts`. DECISION-0113 (tenant de cliente ≠ autoridade).
**Status:** RESPONDIDO.

### Os 7 itens
1. **501 na função REAL (inject fastify) → PASS.** Registrei cada um dos 7 plugins num fastify e injetei uma rota
   representativa **com `tenant_id` forjado no body** → **ALL_CONTAINED=true**: os 7 retornam **HTTP 501 +
   `code: INTERNAL_FINANCIAL_AUTHORITY_CONTAINED`** (audit GET /financial/audit/export, freeze POST /financial/freezes,
   governance POST /governance/proposals, dashboard GET /financial/dashboard, ops-panel GET /financial/transactions,
   simulator POST /financial/simulate-payment, treasury POST /treasury/accounts). Prova estrutural irrefutável: cada
   handler é `async (_req, reply) => reply.status(501).send(CONTAINED)` — `_req` ignorado, **nenhum** service/SELECT antes do 501.
2. **Services/repos/bank INTACTOS → PASS.** `git diff --name-only` (código) = **só os 7 controllers + `package.json`**
   (guard untracked). Nenhum `*repository*`/`*.service.*`/`bank*`/`ledger`/`payout`/`worker`/`migration` no diff
   (financial-freeze-repository/governance/treasury/bank* preservados para um futuro caller seguro).
3. **ZERO entrada de cliente / service material nos 7 → PASS.** grep não-comentário nos 7 = **0** de
   `req.body`/`req.query`/`pool.query`/`getClientWithTenant`/bank services. Além disso, os 7 têm **ZERO imports
   material** (sem service/repository/pool). `tenant_id` declarado pelo cliente é ignorado (provado no inject com body forjado → 501).
4. **Vazamentos específicos fechados → PASS.** audit-export NÃO exporta mais `bank_*` cross-tenant (501, sem pool.query);
   simulator NÃO cria tenant/users/cadeia bancária por HTTP (269→sumiu para 501, sem service); dashboard/ops-panel NÃO
   leem SSOT cross-tenant (501, sem pool.query). Todos cobertos por 501 + grep-proibidos=0 + zero-imports-material.
5. **ZERO Bank/Core/ledger/splits/payout/worker/PORTA-1/migration → PASS.** Nenhum desses paths no diff; payout externo
   permanece fechado (intocado). A fatia só DESLIGA superfície HTTP insegura; não toca causalidade financeira.
6. **GUARD-NP → MORDE E VOLTA (reproduzido por mim).** Baseline guard exit 0. Reintroduzi `req.body` no POST do freeze →
   guard **exit 1** ("lê req.body — a contenção vazou"). Revertí → exit 0; hash de volta a `af1b05f2`.
7. **GATES → PASS.** typecheck = **34** (== baseline; 0 erros nos 7). regression-guards = **EXIT 0** com
   `GATE OK [internal-financial-authority-containment]`. `validate:actor-writer-boundaries` = **GATE OK [actor-writer §4.8.1]**;
   `validate:bank-ledger-boundaries` = **GATE OK [bank-ledger §4.6]**. architectural --strict = **33 == baseline 33**,
   **0 hits** nos 7 → `critical_new = 0`.

### TENTATIVAS DE REFUTAÇÃO (resultado)
- "Algum caminho chama service/SELECT antes do 501" → REFUTADO: handlers são 501 puro; grep-proibidos=0; zero imports material; inject deu 501.
- "tenant_id do body vira autoridade" → REFUTADO: inject com body `{tenant_id: deadbeef…}` → 501 (ignorado).
- "Mexeram em repos/services/bank/migration" → REFUTADO: diff = só 7 controllers + package.json.
- "audit-export/simulator/dashboard ainda vazam SSOT/criam cadeia" → REFUTADO: 501 puro, sem pool.query/service.
- "Guard não morde" → REFUTADO: req.body reintroduzido → exit 1; revertido → exit 0.
- "Quebra gate / toca dinheiro" → REFUTADO: typecheck 34, regression/actor-writer/bank-ledger OK, critical_new=0, zero path financeiro.

### STOPs
- Contenção/tombstone com negative-proof que MORDE → presente e reproduzido (item 6); + prova viva por inject (item 1). ✔
- `tenant_id` de cliente ≠ autoridade (DECISION-0113) — respeitado e provado. ✔
- DT-mãe 0113 OPEN respeitada; payout externo fechado; sem Bank/ledger/worker. ✔
- **STOP de commit:** material = os 9 artefatos (7 controllers + guard + package.json) via git add explícito; cartório
  (STATUS + REMEDIATION_DT_LOG) em commit próprio. (Obs: a diretiva diz "8 arquivos"; são **9** = 7 + guard + package.json.)
- Veredito é INSUMO. **MODO C: a promulgação é ato MANUAL de Clayton — sem condicional.**

### CONCLUSÃO + RECOMENDAÇÃO DE COMMIT
**PASS (7/7).** Os 7 controllers financeiros `/internal` montados FORA do protectedScope (que liam `tenant_id` de
body/query como autoridade e/ou liam/escreviam SSOT de dinheiro cross-tenant sem subject server-side) foram reduzidos
a **501 `INTERNAL_FINANCIAL_AUTHORITY_CONTAINED`** — provado na função real (inject fastify, 7/7, mesmo com tenant_id
forjado), com handlers 501-puros (zero req.body/req.query/pool.query/service/imports material), services/repos/bank
intactos para um futuro caller seguro, guard que morde, e zero toque em Bank/Core/payout/migration. Gates verdes.
**Recomendação de commit (PASS):**
- **Commit MATERIAL (9 artefatos):** os 7 controllers (`audit/financial-audit-export`, `freezes/financial-freeze`,
  `governance/governance-proposal`, `observability/{financial-dashboard,financial-operations-panel,financial-simulator}`,
  `treasury/treasury-account`) + `scripts/audit-internal-financial-authority-containment.mjs` + `package.json` (git add explícito).
- **Commit CARTÓRIO (separado):** `STATUS_EXECUCAO_GLOBAL.md` + `REMEDIATION_DT_LOG.md` (DT **CLOSED_AS_CONTAINED**). Não misturar.
- **Promulgação:** ato MANUAL de Clayton (MODO C) — meu veredito é insumo, não a dispara.
READ-ONLY: inject harness tsx apagado; guard-NP do freeze revertido (hash `af1b05f2`, guard exit 0); demais 6
controllers não editados por mim (só registrados no inject); só editei meu `respostas/IA-YALA.md`. Nada commitado.

---

## RODADA 15 — RESEAL F-OFFER-B2-FRONTEND-SERVICE-OFFERING-WIRING (jornada de serviço pré-dinheiro · MODO B) · VEREDITO

**RESPOSTA PARA:** IA-DIRETORA  (de: IA-YALA)
**VEREDITO: PASS (8/8) — com 1 RESÍDUO pré-existente registrado (handlePayment legado, fora do escopo B2).**
**HEAD no momento:** `f67e1509` (branch `rescue-structural`) — `docs: record yala reseal for internal financial containment`.
  B2 no working tree (não committado). Cartório limpo.
**Revalidou no vivo:** SIM (total) — git + leitura dos 5 frontend + `availability.ts` (wrapper) + typecheck frontend
  **e** backend + B1 e2e + gates backend. (Frontend-only: sem probe de DB próprio; o e2e usa o backend já provado.)
**Fonte soberana:** `frontend/src/api/{service-discovery.ts,offerings.ts,availability.ts}`;
  `frontend/src/components/{ServiceOfferingSelector.tsx,ServicePostCard.tsx}`;
  `frontend/src/pages/ServiceDiscoveryDetailPage.tsx`. DECISION-0142/0144/0145/0146.
**Status:** RESPONDIDO.

### Os 8 itens
1. **ZERO dinheiro/checkout/migration no DIFF → PASS (com resíduo pré-existente).** O diff dos 5 é money-free:
   service-discovery `+canonicalServiceId`; ServicePostCard remove o placebo de agendamento; DetailPage renderiza o
   selector; offerings.ts/Selector são novos e pré-dinheiro. **RESÍDUO (não-bloqueante, NÃO introduzido por B2):**
   `ServicePostCard.handlePayment` (linha ~70) é **pré-existente** (FORA do diff B2 — único hunk é `@@ -53,12 +53,13`),
   chama `confirmCTA` + `alert('Pagamento realizado com sucesso!')`. B2 não o tocou (escopo = booking pré-dinheiro);
   recomendo tratá-lo numa frente própria de dinheiro/CTA (placebo de pagamento ainda vivo nesse card legado).
2. **ZERO legado /services/:id/bookings → PASS.** Reserva só via `availability.ts`: `createBooking` → `POST
   /availability/bookings`; `confirmBooking` → `PUT /availability/bookings/:id` (status='confirmed'). O Selector usa
   esses wrappers; nenhum `/services/*/bookings` nos 5.
3. **canonicalServiceId TRANSPORTADO + by-canonical → PASS.** `DiscoveredService.canonicalServiceId` adicionado ao DTO
   e **mapeado do backend** (`service.canonicalServiceId ?? null`) — não derivado no front. `offerings.ts.getOfferingsByCanonical`
   consome `GET /services/offerings/by-canonical/:id`; o Selector lista por ele.
4. **ACTIVE-only + availability por service_offering → PASS.** by-canonical é active-only **no backend** (B1 passo 4
   prova draft não vaza); o front não revalida nem mostra draft (apenas projeta o que o backend devolve). Slots via
   `listAvailabilities({ ownerType: 'service_offering', ownerId: o.id, status: 'active' })`.
5. **409 com UX específica + confirm OWNER-only → PASS.** `isProviderTimeConflict(e)` detecta `BOOKING_PROVIDER_TIME_CONFLICT`
   → mensagem honesta ("já existe compromisso confirmado deste prestador…"). `confirm` só é chamado se
   `activeActorId === selected.providerActorId`; para o cliente, a reserva fica **'requested'** ("aguardando confirmação
   do prestador"). (Defesa real é server-side: backend liga canRepresentActor; o front só projeta.)
6. **PLACEBO removido + requesterActorId só de sessão → PASS.** O `alert('Serviço agendado com sucesso!')` +
   `onScheduleSuccess()` sem booking foi REMOVIDO (vira erro honesto "agendamento por este card descontinuado").
   `requesterActorId` vem **só de `waitForActorContext()`** (actor ativo de sessão), nunca de input/hardcode/localStorage;
   sem actor ativo → bloqueia ("entre/escolha um perfil"). Nenhum placebo de agendamento no Selector.
7. **GATES → PASS.** frontend typecheck = **0** (0 erros nos 5). backend typecheck = **34** (B2 não toca backend).
   **B1 e2e = 9/9 PASS** (a jornada que B2 liga está viva). regression-guards = **EXIT 0**. architectural --strict =
   **33 == baseline 33** → `critical_new = 0` (B2 é frontend; backend intocado). actor-writer/bank-ledger: GATE OK
   (inalterados — B2 não toca backend; confirmados verdes na RODADA 14 sobre o mesmo backend).
8. **Front projeta verdade (não cria capability/saldo/autoridade) + valida response → PASS.** Os componentes só LEEM
   (getOfferingsByCanonical, listAvailabilities) e criam booking via API canônica com actor de sessão; não concedem
   capability/authority/saldo (o confirm OWNER-only é UX; a autoridade é server-side). `offerings.ts` valida
   `res?.ok && Array.isArray(res.data)` antes de usar; `book()` usa as respostas reais da API para notice/error (sem
   sucesso fabricado). `fmtPrice` apenas EXIBE o preço da oferta (projeção), não cobra.

### TENTATIVAS DE REFUTAÇÃO (resultado)
- "B2 adiciona dinheiro/checkout" → REFUTADO: diff money-free; o handlePayment é pré-existente, fora do diff (registrado como resíduo).
- "Usa o legado /services/:id/bookings" → REFUTADO: só /availability/bookings (createBooking/confirmBooking).
- "canonicalServiceId é derivado no front" → REFUTADO: transportado do DTO (mapeado do backend).
- "Mostra/contrata draft" → REFUTADO: active-only no backend; front só projeta; B1 passo 4 prova.
- "Cliente confirma / placebo de sucesso" → REFUTADO: confirm OWNER-only, cliente para em 'requested'; placebo removido.
- "requesterActorId de input/hardcode" → REFUTADO: só waitForActorContext (sessão); bloqueia sem actor.
- "Front cria autoridade / não valida response" → REFUTADO: só projeta; valida res.ok/Array antes de sucesso.
- "Quebra typecheck/e2e/gate" → REFUTADO: front 0, back 34, e2e 9/9, regression EXIT 0, critical_new=0.

### STOPs
- Frontend nunca cria verdade — projeta verdade resolvida (Lei operacional) — confirmado. ✔
- Pré-dinheiro: B2 não move dinheiro; ativação pública / checkout fora; payout fechado. ✔ (resíduo handlePayment = frente própria.)
- Não toquei R2/delegação; DT-mãe 0113 OPEN respeitada. ✔
- **STOP de commit:** material = os 5 frontend (git add explícito); cartório (STATUS/CONSOLIDADO) em commit próprio.
- Veredito é INSUMO. **MODO B: promulgação/commit é ato de Clayton — meu veredito não dispara.**

### CONCLUSÃO + RECOMENDAÇÃO DE COMMIT
**PASS (8/8).** B2 conecta a jornada de serviço pré-dinheiro na tela usando o backend já provado (B1): discovery
transporta `canonicalServiceId` → `ServiceOfferingSelector` lista ofertas ACTIVE via by-canonical → disponibilidade
por `service_offering` → `createBooking('requested')` via `/availability/bookings` → confirm OWNER-only com UX honesta
para o 409 por provider. Frontend projeta verdade (actor de sessão, sem placebo, valida response, não cria autoridade/
dinheiro). Gates verdes (front 0 / back 34 / e2e 9/9 / regression EXIT 0 / critical_new 0). **Único resíduo:** o
`handlePayment` legado pré-existente em ServicePostCard (fora do diff/escopo) — frente própria de dinheiro.
**Recomendação de commit (PASS):**
- **Commit MATERIAL (5 frontend):** `frontend/src/api/service-discovery.ts` + `frontend/src/api/offerings.ts` +
  `frontend/src/components/ServiceOfferingSelector.tsx` + `frontend/src/components/ServicePostCard.tsx` +
  `frontend/src/pages/ServiceDiscoveryDetailPage.tsx` (git add explícito).
- **Commit CARTÓRIO (separado):** `STATUS_EXECUCAO_GLOBAL.md` + `CONSOLIDADO.md`. Não misturar.
- **Promulgação:** ato de Clayton (MODO B) — meu veredito é insumo.
READ-ONLY: não editei nenhum arquivo de código (só li + rodei typecheck/e2e/gates); o e2e do B1 se auto-limpou
(baseline svc=0/so=0/av=48/bk=0); nenhum harness; só editei meu `respostas/IA-YALA.md`. Nada commitado.

---

## RODADA 16 — RESEAL P3 / F-SERVICE-OFFERING-ACTIVATION-SAFE-PUBLICATION (DECISION-0147 · MODO B/C) · VEREDITO

**RESPOSTA PARA:** IA-DIRETORA  (de: IA-YALA)
**VEREDITO: PASS (8/8) — gate (todos os ramos PJ/PF na função real), state-machine, cascatas e booking-gate provados.**
**HEAD no momento:** `e0e8e4ff` (branch `rescue-structural`) — `decisions: DECISION-0147 safe service offering activation`.
  P3 no working tree (não committado). Cartório limpo.
**Revalidou no vivo:** SIM (total) — git + leitura dos 8 + 2 e2e rodados + **gate REAL (assertOfferingActivationEligibility)
  exercitado em TODOS os ramos** (harness descartável + fixtures committed + teardown) + guard-NP (2×) + gates.
**Fonte soberana:** `services-offering-activation-gate.ts`; `service-offering.service.ts` (updateOwnOffering);
  `unified-availability.service.ts` (booking-gate); `company-publications.service.ts` + `professional-c1.service.ts`
  (cascatas); `audit-offering-activation-safe.mjs`; `e2e-offer-activation-p3.ts`; `package.json`. DECISION-0147 (Q1-Q5).
**Status:** RESPONDIDO.

### Os 8 itens
1. **e2e → PASS.** `e2e:offer-activation-p3` = **6/6 PASS, EXIT 0** (PF válido · PF sem-decl→DECLARATION_REQUIRED ·
   PF ATL→ACTOR_BLOCKED · PJ sem-pub→PUBLICATION_REQUIRED · cascata PF suspende active · booking-gate draft→OFFERING_NOT_ACTIVE).
   `e2e:offer-journey` = **9/9 PASS** (não regrediu).
2. **STATE-MACHINE → PASS (código + e2e).** updateOwnOffering: matriz explícita `to==='active' && from∈{draft,suspended}`
   OU `to==='suspended' && from==='active'`; resto → **409 SERVICE_OFFERING_INVALID_TRANSITION** (active→draft cai aqui).
   status só processado se `input.status != null && != atual` → não free-form do body; `→active` chama o gate.
   (gate-on-active exercitado pelo e2e/harness; matriz é condicional puro pré-IO.)
3. **GATE PJ → PASS (todos os ramos na função REAL, harness+teardown).** sem publicação→**PUBLICATION_REQUIRED** (e2e);
   primary_company_type NULL→**COMPANY_NOT_OPERATIONAL**; operacional + page-actor sem fiscal_identity→**KYB_REQUIRED**;
   tudo válido (publicação+operacional+KYB-approved)→**ativa** (NO_THROW). **Achado:** `evaluateKybLayer` aplica
   SOMENTE a `actor_type='page'` (page→company→fiscal_identities.kyb_status, fail-closed) — confirmado: provider
   user-actor pula KYB, page-actor sem fiscal → bloqueia. Correto.
4. **GATE PF → PASS (todos os ramos na função REAL).** **civil-null** (global_user dedicado, `full_name`→NULL, com
   declaração)→**CIVIL_MINIMUM_REQUIRED**; sem-declaração→**DECLARATION_REQUIRED** (e2e); ATL→**ACTOR_BLOCKED** (e2e);
   válido (decl+CPF+full_name+identity+não-ATL)→**ativa** (NO_THROW). Sem metadata/inferência (lê SSOT vivo).
5. **CASCATAS → PASS.** PF (e2e behavioral): base revogada (`retireConcept`) → offering active vira **suspended**,
   ATÔMICO (BEGIN→retire decl→UPDATE service_offerings suspended→COMMIT, sem DELETE/dinheiro). PJ (código):
   `retireAllActivePublicationsForCompanyTx` recebe o client da tx do KYB-revoke → `UPDATE service_offerings SET
   status='suspended' ... company_id` na MESMA tx; guard proíbe `DELETE FROM service_offerings`.
6. **BOOKING-GATE → PASS.** createBooking em offering draft → **OFFERING_NOT_ACTIVE** (e2e); em active → ok (journey
   e2e passo 6). Código: ownerType=service_offering → SELECT status → `!== 'active'` → fail-closed.
7. **ESCOPO + GUARD-NP → PASS.** **8 material** (5 modificados: unified-availability/company-publications/professional-c1/
   service-offering.service + package.json; 3 novos: gate + guard + e2e). ZERO migration/frontend/dinheiro/Bank/Core/
   payout/ledger; DECISION-0147 **intocada**. **GUARD-NP (2×):** removi o `SERVICE_OFFERING_INVALID_TRANSITION` →
   guard **exit 1** ("sem state-machine"); quebrei `cpf IS NOT NULL`→`IS NULL` no gate → guard **exit 1** ("PF KYC-lite
   sem CPF/full_name"). Ambos revertidos (svc `e009fe2e`, gate `a247d43f`, guard exit 0).
8. **GATES → PASS.** typecheck = **34** (== baseline). regression-guards = **EXIT 0** com `GATE OK [offering-activation-safe]`.
   actor-writer = **GATE OK [§4.8.1]**; bank-ledger = **GATE OK [§4.6]**. architectural --strict = **33 == baseline 33**,
   **0 hits** nos arquivos da fatia → `critical_new = 0`.

### TENTATIVAS DE REFUTAÇÃO (resultado)
- "active→draft passa / status free-form" → REFUTADO: matriz → 409 INVALID_TRANSITION; status só transição controlada.
- "Algum ramo do gate não fecha" → REFUTADO: TODOS os 8 ramos (PJ pub/operacional/KYB/válido; PF decl/civil/ATL/válido) provados na função real.
- "civil/KYB são triviais" → REFUTADO: civil-null com global_user dedicado→CIVIL_MINIMUM; KYB com page-actor sem fiscal→KYB_REQUIRED.
- "Cascata apaga/move dinheiro / não é atômica" → REFUTADO: suspend (não delete), mesma tx; PF behavioral, PJ código.
- "Booking aceita offering não-active" → REFUTADO: draft→OFFERING_NOT_ACTIVE (e2e).
- "Gate lê metadata" → REFUTADO: só SSOT vivo; guard proíbe profile.metadata/localStorage.
- "Vazou escopo / quebrou gate / guard não morde" → REFUTADO: 8 material, zero proibido, gates verdes, guard mordeu 2×.

### STOPs
- Ativação/cascata/booking com negative-proof que MORDE + prova viva por função real → presentes e reproduzidos. ✔
- Elegibilidade VIVA na ativação (não metadata); fail-closed; cascata suspende (não apaga); sem dinheiro/Bank/payout. ✔
- Não toquei R2/delegação; DT-mãe 0113 OPEN respeitada. ✔
- **STOP de commit:** material = os 8 (git add explícito); cartório (STATUS + DECISOES/REMEDIATION) em commit próprio.
- Veredito é INSUMO. **MODO C: a promulgação é ato MANUAL de Clayton — sem condicional.**

### CONCLUSÃO + RECOMENDAÇÃO DE COMMIT
**PASS (8/8).** P3 torna a ATIVAÇÃO de service_offering segura (DECISION-0147): state-machine fail-closed
(status nunca free-form; active→draft 409), gate de elegibilidade VIVA revalidada na ativação — PJ (publicação ACTIVE
+ empresa operacional + KYB approved, KYB só para page-actor) e PF (declaração ACTIVE + civil mínimo CPF/full_name/
identity + não-ATL), sem metadata; cascata atômica que SUSPENDE (não apaga) offerings active quando a base cai
(KYB/publicação revogada PJ; declaração retirada PF); e booking só em offering active. Tudo provado de 1ª mão (2 e2e +
gate real em todos os ramos + cascata + booking-gate + guard-NP 2×); gates verdes; zero dado alterado (probes com teardown).
**Recomendação de commit (PASS):**
- **Commit MATERIAL (8):** `services-offering-activation-gate.ts` + `service-offering.service.ts` +
  `unified-availability.service.ts` + `company-publications.service.ts` + `professional-c1.service.ts` +
  `audit-offering-activation-safe.mjs` + `e2e-offer-activation-p3.ts` + `package.json` (git add explícito).
- **Commit CARTÓRIO (separado):** `STATUS_EXECUCAO_GLOBAL.md` (+ DECISOES/REMEDIATION se aplicável). Não misturar.
- **Promulgação:** ato MANUAL de Clayton (MODO C) — meu veredito é insumo.
READ-ONLY: harnesses tsx apagados; guard-NPs revertidos (svc `e009fe2e`, gate `a247d43f`); fixtures com teardown
(zero resíduo: companies/actors Yala=0; svc/so/bk=0); só editei meu `respostas/IA-YALA.md`. Nada commitado.

---

## RODADA 17 — RESEAL ADVERSARIAL F-CHECKOUT-FINANCIAL-RUNTIME-CONTAINMENT (commit 823699e3 · DINHEIRO) · VEREDITO

**RESPOSTA PARA:** IA-DIRETORA  (de: IA-YALA)
**VEREDITO: PASS** — nenhum caminho LIVE de checkout/eventos alcança bank_* com a flag OFF; contenção fail-closed
provada (e2e 4/4 + Δ bank_*=0 + negative-proof posicional que MORDE). **1 RESÍDUO de defesa-em-profundidade** (writer
morto ungated) → bloco IA-DINHEIRO abaixo.
**HEAD no momento:** `823699e3` (branch `rescue-structural`) — `fix(checkout): fail-close event checkout financial runtime`
  (a fatia É o HEAD; committada).
**Revalidou no vivo:** SIM (total) — git + leitura do firewall/CheckoutService/event-economy/audit + **sweep de TODOS
  os callers** dos métodos de bank-integration + `e2e:checkout-containment` rodado + negative-proof estático (audit) que
  MORDE (remover gate / mover gate p/ depois do banco). ROLLBACK/READ-ONLY (NP estático = não moveu dinheiro).
**Fonte soberana:** `checkout-financial-firewall.ts`; `CheckoutService.ts:24`; `event-economy.service.ts:48`;
  `bank-integration.port.ts`/`bank-integration.service.ts` (sink); `audit-checkout-financial-containment.mjs`;
  `e2e-checkout-financial-containment.ts`. DECISION-0110 (padrão fail-closed espelhado).
**Status:** RESPONDIDO.

### Refutação dos 3 pontos
1. **Algum caminho ainda alcança bank_* com flag OFF? → NÃO (nenhum LIVE).** Sweep completo dos callers de
   `processEventTicketPayment`/`processEventConsumptionPayment` (os 2 sinks reais): (a) `CheckoutService.processCheckout`
   — gate l.24 ANTES de `mockUnifyCardCharge` (l.54) e `bankIntegration` (l.71/89) ✓; (b) `eventEconomyService.processCheckout`
   — gate l.48 antes da delegação (l.84) ✓; (c) `bank-integration.service.ts` = a DEFINIÇÃO do sink; (d)
   `events-payment.service.processEventPayment` = **MORTO** (único "caller" é um COMENTÁRIO em event-economy.service:14;
   zero rota/importer vivo) — não alcança bank_* por não ser reachable. marketplace/organizer/bundle: **sem trilho bank**
   (grep vazio). `e2e:checkout-containment` = **4/4 PASS** (flag default OFF · CheckoutService→DISABLED · eventEconomy→DISABLED ·
   **Δ bank_ledger=0/tx=0/splits=0**). ⇒ Nenhuma rota viva escapa.
2. **Negative-proof MORDE? → SIM (estático, sem mover dinheiro).** Audit faz checagem POSICIONAL (`gate-index < bank-index`).
   NP1: removi o `assertCheckoutFinancialRuntimeEnabled` de CheckoutService → audit **exit 1** ("processCheckout sem gate …
   gate ausente"). NP2: movi o gate p/ DEPOIS de `mockUnifyCardCharge`/`bankIntegration` → audit **exit 1** ("gate DEPOIS
   da delegação ao banco"). Revertido via `git checkout` (diff vazio `e69de29b`, gate de volta na l.24, audit exit 0).
   (Optei pelo NP estático: remover/mover o gate e rodar o caminho REAL escreveria em bank_* no SSOT — evitei mutação de dinheiro.)
3. **Contenção não ligou dinheiro / não alterou ledger-split-payout / createBooking intocado? → CONFIRMADO.** Commit
   823699e3 = 6 arquivos: firewall (novo) + audit (novo) + e2e (novo) + `CheckoutService.ts` (+5 = import+gate) +
   `event-economy.service.ts` (+5 = import+gate) + `package.json` (script e2e). **NÃO** toca bookings/bank_ledger/
   bank_splits/payout/migration. Flag **default OFF** (`=== 'true'`); **SEPARADO** de `SERVICE_FINANCIAL_RUNTIME_ENABLED`
   (audit morde se conflacionar). createBooking intocado.

### RISCOS / RESÍDUOS
- **[RESÍDUO de defesa-em-profundidade — não-bloqueante, vira DT p/ IA-DINHEIRO]** O gate está na CAMADA DOS CALLERS
  (CheckoutService + eventEconomy), não no SINK (`bank-integration.service.processEvent*Payment`). Há um caller
  **ungated porém MORTO**: `events-payment.service.processEventPayment` (sem rota/importer). Hoje **não escapa** (morto),
  mas é um bypass LATENTE: se alguém religar uma rota a ele, escreve bank_* sem passar pelo firewall. Recomendação
  (IA-DINHEIRO): empurrar o gate p/ DENTRO de `bank-integration` (cobre TODOS os callers presentes/futuros) OU conter/
  remover `events-payment.service` (dead-code) numa fatia própria. Registrar como DT.

### STOPs
- Contenção de dinheiro com negative-proof que MORDE → presente (posicional, 2 NPs). ✔
- Flag default OFF; nenhum dinheiro movido; ledger/split/payout intocados; createBooking intocado. ✔
- DT-mãe 0113 OPEN respeitada; payout externo fechado. ✔
- Veredito é INSUMO; promulgação/abertura da flag (revalidando a cadeia real de pagamento) é ato soberano de Clayton.

### CONCLUSÃO
**PASS.** Os trilhos VIVOS de checkout/eventos que alcançavam bank_* (CheckoutService.processCheckout e
eventEconomyService.processCheckout — rotas /api/checkout/event-ticket, /api/checkout/event-consumption, /events/:id/checkout)
estão contidos fail-closed ANTES de qualquer mock/bank, com flag default OFF e separada do trilho de serviço; e2e prova
4/4 + Δ bank_*=0; o negative-proof posicional MORDE (remover ou mover o gate). Nenhuma rota viva escapa. Único resíduo:
um writer MORTO ungated (`events-payment.service`) — defesa-em-profundidade, tratado no bloco IA-DINHEIRO como DT.

---

### BLOCO PARA IA-DINHEIRO (de: IA-YALA)

**RESPOSTA PARA: IA-DINHEIRO**
**VEREDITO (eixo dinheiro): CONTENÇÃO VÁLIDA — zero dinheiro movido, com 1 DT de defesa-em-profundidade.**
- **Δ bank_ledger/bank_transactions/bank_splits = 0** com a flag OFF (e2e + sweep). Flag `CHECKOUT_FINANCIAL_RUNTIME_ENABLED`
  default OFF, fail-closed, SEPARADA de `SERVICE_FINANCIAL_RUNTIME_ENABLED` (DECISION-0110). Mock de cobrança (always-success)
  NÃO destrava liquidação real enquanto OFF (gate antes do mock).
- **Cadeia material confirmada:** rota → processCheckout (gateado) → `mockUnifyCardCharge` → `bankIntegration.processEvent*Payment`
  → INSERT bank_ledger/transactions/splits. O gate intercepta ANTES do mock. A liquidação real (escrow/split) NÃO foi
  alterada; o caminho fica preservado p/ a cadeia canônica futura (cobrança real → liquidação governada).
- **DT-CHECKOUT-FINANCIAL-GATE-AT-CALLER-NOT-SINK (OPEN, MÉDIA):** o gate vive nos callers, não no sink. `events-payment.service.
  processEventPayment` é um writer de bank_* **ungated e MORTO** (sem rota). Não escapa hoje, mas é bypass latente.
  **Convergência:** mover o `assert` p/ dentro de `bank-integration.service.processEvent*Payment` (defesa-em-profundidade,
  cobre todo caller) e/ou conter/remover o dead-code `events-payment.service`. Critério: todo caminho a bank_* via
  checkout/evento passa pelo gate por construção (não por disciplina de caller).
- **Abertura da flag** (quando a cadeia real de pagamento existir) exige revalidar auth/autorização/idempotência da
  liquidação — é ato soberano de Clayton, não desta fatia.

READ-ONLY: negative-proof estático (não moveu dinheiro); CheckoutService restaurado (`git checkout`, diff vazio, audit exit 0);
e2e self-contido (Δ bank_*=0); só editei meu `respostas/IA-YALA.md`. Nada commitado.
