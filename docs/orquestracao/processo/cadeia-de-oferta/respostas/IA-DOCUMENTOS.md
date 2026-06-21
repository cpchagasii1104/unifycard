# Respostas — IA-DOCUMENTOS (Documentação, Cartório e Hierarquia · READ-ONLY)

> Append-only. Só esta instância escreve aqui. Cada resposta carimba HEAD + fonte + status.

---

## RODADA 4 — RESEAL A1 (reindex `DECISOES.md` 0112→0141) · 2026-06-20

**HEAD no momento:** `2a0d3c21` (vivo no disco — `git rev-parse HEAD`).
⚠️ **Nota de re-baseline:** o gatilho citou `dd270f41`; o HEAD **vivo é `2a0d3c21`** (commit U1, "widening concept_relations 3→6"). Disco vence narrativa — carimbo no vivo. A1 foi executada **sobre** este HEAD (working tree, ainda não commitada).
**Revalidou no vivo:** SIM (1ª mão — `git status`, `git diff`, leitura do arquivo).
**Fonte soberana usada:** `git diff -- docs/02_decisions/DECISOES.md` (working tree) · `docs/02_decisions/DECISOES.md:1-7` (disclaimer + header) · `docs/02_decisions/DECISOES.md:97-128` (bloco novo) · `git diff --name-only` (escopo).
**Charge do meu eixo (RODADA 4):** confirmar que o índice **NÃO virou norma** (segue índice/auditoria); sem norma acidental; "Verificado=NÃO-AUDITADO" **não finge** auditoria material.

### VEREDITO (eixo IA-DOCUMENTOS): **PASS**
O reindex A1 é **edição de índice/auditoria**, não promulgação. O índice permanece índice; a honestidade do denominador e do "NÃO-AUDITADO" está preservada; nenhum cartório-fonte foi tocado. (O PASS/FAIL adversarial final é da IA-YALA; a consistência cartorial por-DECISION é da IA-DECISOES-DT — fico na minha raia.)

### 1. EVIDÊNCIAS (arquivo:linha / git)
- **Índice NÃO virou norma — disclaimer intacto** (`DECISOES.md:5-7`): *"Este arquivo é **índice / auditoria operacional**… **NÃO** é fonte normativa soberana. É mapa, não território."* O `git diff` tem **44 inserções, 0 deleções** → o disclaimer de topo **não foi tocado**. O bloco novo abre reafirmando a natureza: *"passada A1, docs-only… não re-checou runtime/schema; **não finge auditoria material**"* (`:99-103`).
- **Header histórico preservado (append-only)** (`DECISOES.md:3`): a linha original *"**Gerado:** 2026-06-06"* **NÃO foi reescrita**; o bloco A1 carrega carimbo próprio *"(reindex A1 · 2026-06-20)"* (`:97`). Isto **respeita** o meu STOP "não reescrever cabeçalho histórico" — a defasagem foi corrigida por **acréscimo datado**, não por sobrescrita do carimbo de geração.
- **Denominador honesto / completo** — 30 linhas `0112→0141` contíguas (regex `^\| 01(1[2-9]|[2-3][0-9]|4[0-1]) \|` → **count = 30**), **sem buraco, sem duplicata**; nota declara "Próximo nº livre: **0142**" (`:103`). Coerente com o meu mapa de §14.6.1 (LOG já em dia até 0141; o índice era o defasado).
- **"Verificado = NÃO-AUDITADO" honesto em TODAS as 30 linhas** — a coluna `Verificado` é `NÃO-AUDITADO` nas 30 (não há IMPLEMENTADO/PARCIAL fabricado nesta passada docs-only). O `DECLARADO` reproduz o **header do próprio `.md`** (fonte soberana por linha), não opinião do índice — ex.: 0123 = `DECISION_REQUIRED / HOLD`; 0128/0129/0130 = `PROMULGADA/NORMATIVA — runtime NÃO implementado`; 0136 = `MATERIALIZADA (Slice 1A)`. Reportar o header alheio ≠ promulgar.
- **Cartório-fonte intocado** — `git diff --name-only -- REMEDIATION_DECISIONS_LOG.md "docs/02_decisions/DECISION_*.md"` = **vazio**. A única mudança em `docs/02_decisions/` é o próprio `DECISOES.md` (índice). LOG e os 30 `.md` originais **não foram editados**. Escopo = exatamente o prometido pela executora.

### 2. RISCOS (residual, do meu eixo)
- **0119/0120 sem entrada-própria no corpo do LOG** (achado lateral do meu §14.6.1) — o índice agora **lista** 0119/0120 como `PROMULGADA`, mas no corpo do `REMEDIATION_DECISIONS_LOG.md` elas só aparecem **citadas dentro da 0131**, sem `## DECISION-0119/0120` próprio. **Não é regressão de A1** (A1 só mexeu no índice), mas o denominador cartorial **não está 100% fechado** enquanto esse ruling não correr (item **A1-b**, dono = IA-DECISOES-DT + Clayton). Honestidade: A1 fecha o **índice**; não fecha o **gap 0119/0120-no-LOG**.
- **Leitura futura tratando o índice como verdade** — mitigado pelo disclaimer + pelo "NÃO-AUDITADO" explícito; manter assim. Se uma passada futura trocar `NÃO-AUDITADO` por estado material, isso exige prova-viva (IA-BANCO), não pode ser preenchido no índice por inferência.

### 3. RECOMENDAÇÃO (onde/como — descrever, não escrever no cartório)
- **Aceitar A1 como reseal-PASS documental.** O índice está coerente, honesto e dentro da natureza "auditoria, não norma". Nada a corrigir no meu eixo.
- **Manter A1-b (0119/0120-no-LOG) como item separado e aberto**, com denominador honesto ("índice 0112–0141 OK; 2 decisões sem entrada-própria no LOG = ruling pendente"). Não emendar o corpo do LOG retroativamente — se for gap real, **nova entrada append-only** (IA-DECISOES-DT + Clayton), nunca `##` inserido no meio do histórico.
- **No commit de A1**, o índice continua `docs/02_decisions/` (auditoria) — não migra para `01_normative/`; permanece não-soberano por construção.

### 4. FRONTEIRA (cruza com outro dono)
- **IA-DECISOES-DT:** consistência cartorial fina por-DECISION (DECLARADO×header de cada `.md`, sem buraco/dup, nº livre 0142) e o **ruling 0119/0120** são do eixo dela. Eu confirmo a **forma documental** (índice ≠ norma; append-only; honestidade do NÃO-AUDITADO) — não a semântica de cada decisão.
- **IA-YALA:** veredito adversarial final PASS/FAIL (docs-only). Meu PASS é só do eixo documental.
- **IA-BANCO:** qualquer futura troca de `NÃO-AUDITADO`→estado material exige prova-viva de runtime/schema, fora do meu alcance read-only → eu marcaria INCONCLUSIVO.

### 5. STOPs
- NÃO editei `DECISOES.md`, o LOG, nem qualquer `.md` de DECISION — só **li** (`git diff`/leitura).
- NÃO tratar o índice reindexado como fonte soberana; reindexar ≠ promulgar.
- NÃO declarar o **denominador cartorial inteiro** fechado: A1 fecha o índice 0112–0141; o gap 0119/0120-no-LOG segue aberto (A1-b).
- Análise = **insumo** para a IA-DIRETORA; não é GO.

**Status: RESPONDIDO** (HEAD vivo `2a0d3c21`; gatilho citava `dd270f41` — stale, revalidado e corrigido no disco).
