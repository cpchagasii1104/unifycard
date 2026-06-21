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
