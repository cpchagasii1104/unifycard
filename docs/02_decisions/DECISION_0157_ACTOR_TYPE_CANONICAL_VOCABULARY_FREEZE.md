# DECISION-0157 — Vocabulário canônico de `actor_type` (D-C2) + congelamento anti-fragmentação

> **Arquivo canônico.** Fonte append-only viva: `REMEDIATION_DECISIONS_LOG.md` (§ DECISION-0157, inclui ADENDO R3). Criado em 2026-07-03 para fechar a lacuna de rastreabilidade apontada no `auditoria.md` (achado B6).

- **Data:** 2026-07-02
- **Frente:** F-ACTOR-TYPE-VOCABULARY-CANONICAL (achado B6 de `auditoria.md`) · **HEAD (pré-commit):** `f9e6f0cd0`
- **Tipo:** Ontológica / identidade-autoritativa. **PROMULGAÇÃO docs-only** da ontologia + **1 fatia material money-free** (guard de congelamento). É a **D-C2** que o código aguardava.
- **Status:** **PROMULGADA.** Classificação: **VOCABULÁRIO_CONVERGIDO_EM_DADOS_COM_DÍVIDA_DE_LEITURA** — ratifica a ontologia que os DADOS já escolheram.

## Contexto (READ-FIRST vivo, 2026-07-02)
`actors.actor_type` tem CHECK com **10 valores de 3 gerações** (`person/company/system` · `actor_human/actor_organizational/actor_system` · `user/page/group/channel`). Mas o **runtime já convergiu**: em `unificard_dev` só existem `user`(8)/`page`(3)/`group`(1); **zero** linhas em valor legado ou `channel`. Os **writers** vivos escrevem canônico, com exceções pré-existentes (ver ADENDO R3). Os **readers** ainda ramificam pelo vocabulário legado defensivamente. Fonte da fragmentação: a normalização histórica `0012` foi depois revertida em direção pela geração `user/page/group/channel`, sem drenar o CHECK/readers.

## Decisão soberana (Clayton · D-C2)
1. **Vocabulário canônico de `actor_type` = `user` · `page` · `group` · `channel`.** Resposta única para "que tipo de actor é?". `channel` é canônico e reservado (zero writers hoje — permitido).
2. **Valores legados (`person`/`company`/`system` · `actor_human`/`actor_organizational`/`actor_system`) = CONGELADOS-LEGADO.** Nenhum writer NOVO pode produzi-los (enforçado por guard). Os readers que ainda os toleram permanecem por ora (norma assintótica — conter agora, drenar depois com prova); tolerar ≠ ratificar.
3. **Exceção documentada (pré-existente):** writers legados conhecidos são allowlistados no guard (ver ADENDO R3).
4. **NÃO tocar agora (norma assintótica, exige GO próprio):** o CHECK permissivo, os ramos legados dos readers/triggers, e a convergência do writer Genesis. Frente futura `F-ACTOR-TYPE-VOCABULARY-DRAIN-*`.

## Fatia material (money-free)
Guard `audit-actor-type-vocabulary-freeze.mjs` (em `validate:regression-guards`) — **morde** se qualquer arquivo FORA do allowlist escrever `actor_type` legado. Congela o vocabulário: nenhum novo writer legado. NÃO toca CHECK/readers/dados/dinheiro. Negative-proof: guard morde writer legado sintético. **Δbank=0.**

## Consequências
B6 do `auditoria.md` **contido** (fragmentação congelada; drenagem = frente própria com GO). `DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION` passa de OPEN para CONTAINED/FROZEN.

## 📌 ADENDO R3 (2026-07-02, append-only)
A afirmação "EXATAMENTE 1 writer legado vivo" estava imprecisa. Inventário correto: **3 writers legados pré-existentes** (todos allowlistados; produção nasce só canônico): (1) `identity.service.ts:314` `'actor_human'` — SCRIPT-ONLY (private ← `ensureCanonicalActorChain` ← só `validate-financial-flow-real.ts`; NÃO é produção viva); (2) migration histórica `0012`; (3) `seeds/036_seed_e2e_c52_payment_intents.sql:118` `'company'` (fixture E2E). Correção material do guard: HEAD `7d311484e` (walk cobre `seeds/`, detecção posicional em `INSERT INTO actors`, C52 allowlistado). A decisão soberana permanece inalterada.

- **Responsável:** Clayton / IA-DIRETORA (executor: Claude Fable 5).
- **Referências:** `auditoria.md` (B6) · DECISION-0062 · `REMEDIATION_DT_LOG.md` (DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION).
