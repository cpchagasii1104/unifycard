# 2026-06-15 — ONDA LEVE DECISION-0131 · A1 (HIGIENE CARTORIAL / ALINHAMENTO)

Pós-fechamentos da onda leve 0131 (PDV-seal · B3f · C4 · B1f · E1 · E2). A1 = **cartório puro, ZERO runtime**: alinhar
STATUS/DT/oplog, corrigir stale relevante, registrar resíduos. **Nenhum `.ts`/`.sql`/migration/guard/package tocado.**
HEAD `f41be7b8` · branch `rescue-structural` · dev **385/385**. READ-FIRST: workflow read-only de 4 auditores
(STATUS / DT-log / execution-logs / stale-sweep) + leitura 1ª mão.

## Achado (auditoria de consistência)

- **STATUS** (6 entradas): todas presentes, selo EXATO, lineage de commit correto (`git log` confere a cadeia
  ef4ea717→…→f41be7b8), nenhum HEAD antigo como "atual", **nenhum overclaim**. Limpo.
- **execution-logs**: os 6 docs existem (PDV F0/F2A/F2B/F2C, B3f, C4, B1f, E1, E2); E1 não declara availability/agenda/
  booking fechados (mantém R1 runner órfão como resíduo); E2 não declara decommission físico (mantém leitura legada),
  e afirma o REVOKE APLICADO (flag o stale doc). Limpo.
- **DT-log** (6 DTs): todas presentes, status correto (5 OPEN-residue + DT-PDV com componente CLOSED **com prova**:
  guard GATE OK / e2e 12/12 / neg-proof 10 bites; operador×empresa segue OPEN). Nenhum DT material CLOSED sem prova.

## Inconsistências corrigidas (cartório)

1. **DT-AVAILABILITY (E1) — erro factual corrigido:** a observação E1 afirmava que `AUTHORITY_ENFORCEMENT_MODEL.md`
   referencia um `AUTHORITY_LAW.md` **inexistente** — **FALSO** (verificado 1ª mão: `docs/01_normative/AUTHORITY_LAW.md`
   EXISTE, 7970 bytes, CANÔNICO·CONSTITUCIONAL; a ref em AEM:10 está correta). Claim retirado.
2. **STATUS E2 — selo alinhado ao canônico:** "Fecha SÓ como" passou de "TEMPORAL TOMBSTONE / LEGACY WRITE-PATH
   REGRESSION LOCK" → **"TEMPORAL LEGACY WRITE-PATH TOMBSTONE / REGRESSION LOCK"** (forma canônica do GO; cosmético).
3. **DT-TEMPORAL R4 — segundo bloco stale registrado:** além do "não aplicada" (SSOT_REGISTRY ~L25-26), o A1 localizou
   um SEGUNDO bloco stale (SSOT_REGISTRY ~L32-36: "Violação Ativa C63 CRITICAL / 6 WRITE paths ativos / IN_PROGRESS")
   que contradiz o estado vivo (write-path tombstoned, guard CLOSED=5). Ambos REGISTRADOS como resíduo.
4. **Índice consolidado** prepended ao STATUS: tabela única (frente → commit → selo EXATO → NÃO-fecha → DT) como
   artefato de alinhamento da onda leve.

## NÃO corrigido (proibição + regra de parada respeitadas)

- **`docs/01_normative/SSOT_REGISTRY_UNIFICARD.md`** (stale "não aplicada" + "C63 IN_PROGRESS / 6 writers") e
  **`CORE_TEMPORAL_HARDENING_CONTRACT.md`** (header SUBORDINATED/UNKNOWN vs corpo CANONICAL) são **docs NORMATIVAS**.
  Proibição A1: "editar norma soberana sem GO específico"; regra de parada: correção material → **registrar, não
  corrigir**. Registrados como resíduo (DT-TEMPORAL R4 / DT-AVAILABILITY obs). **Requer GO de correção normativa.**
- O texto "REVOKE não aplicada" **NÃO existe em cartório** (STATUS/DT/oplog) — só na NORMATIVA. O cartório já reflete a
  verdade (aplicado).

## Confirmações de não-overclaim (verificadas)

availability/agenda/booking (E1) · temporal/decommission-físico (E2) · DECISION-0113 inteira / as 31 rotas (B1f) ·
reversal engine/rides bridge (C4) · groups/invites-mine (B3f) · PDV-produto/operador×empresa (PDV) — **nenhum** declarado
fechado. Cada selo é estreito por design. C1_MONEY (subconjunto das 31) segue OPEN.

## Verificação / Gates

- `git diff --name-only` = **cartório-only** (STATUS/DT/opus/execution-log; zero `.ts`/`.sql`/scripts/package).
- `validate:regression-guards` → **rc=0** (chain íntegra; nada tocado em runtime/guard).
- _(REMEDIATION_DECISIONS_LOG NÃO precisou de entrada: a onda leve é guard-lock/tombstone, não DECISION soberana entre
  alternativas.)_

## Estado

A1 **IMPLEMENTED / HOLD PARA RESEAL**. Fecha SÓ como **CARTÓRIO DA ONDA LEVE 0131 ALINHADO**: índice consolidado +
correção de stale cartorial + resíduos normativos registrados (não editados). Nenhum runtime/escopo novo. dev 385.
**Resíduo p/ GO futuro:** correção dos 2 blocos stale em SSOT_REGISTRY + header de CORE_TEMPORAL_HARDENING (normativos).
