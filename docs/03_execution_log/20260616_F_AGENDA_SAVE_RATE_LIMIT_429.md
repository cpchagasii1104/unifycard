# 2026-06-16 — F-AGENDA-SAVE-RATE-LIMIT-429

A tela `/perfil` não conseguia concluir o save da agenda: aparecia `Rate limit exceeded, retry in 1 minute` e a UI
mantinha `Você tem alterações não salvas na agenda`. O contrato honesto (frente anterior) estava CORRETO — a tela
não mentia que salvou; o problema era um **429** bloqueando o save. Parent `7e104d70` · branch `rescue-structural` ·
dev **389 (ZERO migration)** · **frontend-only**.

## Pré-flight

HEAD `7e104d70` · branch `rescue-structural` · `frontend/`+`backend/` limpos (só `tmpschema.ts` untracked, baseline).

## READ-FIRST / Diagnóstico

- **Limiter por-rota:** `unified-availability.routes.ts` registra `@fastify/rate-limit` com `max:60`/min
  (`skipOnError:false`) no escopo do plugin → todas as rotas `/availability/*` compartilham 60/min. (Limiter GLOBAL
  em `app.builder.ts` = 5000/min dev · 100/min prod — não é o gargalo aqui.)
- **`apiFetch` (client.ts):** SEM retry automático → não amplifica.
- **Causa-raiz — request storm em `ProfileAgenda.loadAgenda`:** o laço `for (availability of availabilitiesData)`
  fazia **`listBookings` + `listParticipants` por janela** + `detectConflicts` por participante. A grade semanal é
  materializada em MUITAS janelas (faixa × dia × horizonte 8 semanas). Ex.: Seg–Sex × 2 faixas = 5×2×8 = **80 janelas
  → ~162 requests a `/availability/*` num único load** → estoura 60/min instantaneamente. Quando o usuário clica em
  Salvar, já está rate-limited → `PUT /availability/weekly-template` retorna **429**.
- **Consumo real:** `bookings`/`participantsMap` alimentam SÓ os cards `availabilities.slice(0,5)` (Disponibilidades
  Ativas). `conflictsMap` é setado mas **NUNCA exibido** (não é passado ao `ProfileAgendaForm`) — fan-out morto.
- **NODE_ENV / hipóteses:** o 60/min do plugin é igual em dev e prod; o storm estoura qualquer um. **Hipótese A
  (request storm) confirmada** como causa-raiz. Hipótese B (relaxar rate-limit) descartada — o GO pede "corrigir
  storm antes de relaxar rate-limit", e pós-fix 60/min é folgado. Hipótese C (UX do 429) aplicada como acabamento.

## Correção (frontend cirúrgico)

- **`ProfileAgenda.tsx` (`loadAgenda`):** busca bookings/participants só das **5 janelas exibidas**
  (`availabilitiesData.slice(0,5)`); laço de `detectConflicts` **removido** (`conflictsMap` vira `{}` — não exibido).
  Requests no load: **~162 → ≤12** (1 `listAvailabilities` + 1 `fetchTemporalPurposes` + 5×2), constante
  independente do tamanho da agenda. Imports órfãos (`detectConflicts`, `AvailabilityConflict`) removidos.
- **`AvailabilityScheduleEnhanced.tsx` (`persistSchedule` catch):** traduz erro de rate-limit (regex
  `rate limit|too many requests|429|retry in`) numa mensagem clara — "Muitas tentativas em pouco tempo. Aguarde
  cerca de 1 minuto e clique em Salvar novamente." — **mantendo dirty** (não finge que salvou; não esconde o erro).
- **Backend / rate-limit NÃO tocado** (o storm fix bastou). Catálogo de finalidades já não refetcha (cache
  `temporalPurposes.length>0`). Save já é 1 PUT (guard `saveState==='saving'` + botões `disabled`).

## Provas

| Prova | Resultado |
| --- | --- |
| frontend typecheck (`tsc --noEmit`) | **0 erros** |
| backend | **INTOCADO** (git diff backend vazio) |
| validate:actor-writer-boundaries / bank-ledger-boundaries | GATE OK / GATE OK |
| validate:regression-guards | rc=0 |
| validate-architectural-patterns --strict | exit 0 · critical_new=0 |
| e2e temporal-purpose (regressão) | **15/15** (finalidade por slot persiste+lê de volta; nada regrediu) |

**Call-trace (sem harness de componente no frontend):**
1. **Abrir `/perfil` não dispara tempestade:** `loadAgenda` = `listAvailabilities` (1) + `fetchTemporalPurposes`
   (1, cacheado) + bookings/participants só dos 5 cards (≤10) = **≤12 requests**, antes ~162.
2. **Catálogo não refetcha em loop:** `temporalPurposes.length>0 ? cache : fetch` — 1 fetch por sessão.
3. **Salvar = no máximo 1 PUT:** `persistSchedule` retorna cedo se `saveState==='saving'`; botões `disabled` durante o save.
4. **Sucesso limpo limpa dirty:** ramo `summary.status==='clean'` → `clearDirty()`.
5. **429 mantém dirty + mensagem clara:** ramo `catch` não toca dirty/originalSchedule; mostra a mensagem traduzida.
6. **Após a janela do rate-limit:** com o load enxuto (≤12) e 60/min, o usuário salva normalmente.
7. **Finalidade por slot intacta:** e2e 15/15 (nada do fluxo de purpose foi tocado).

## DT / NÃO TOCADO

- **Sem DECISION nova** (frontend-only). **Sem DT nova** (correção de defeito de fan-out, não decisão arquitetural).
- **NÃO tocado:** DECISION-0132 · `availability.purpose_concept_id` · 4 concepts · booking gate · backend ·
  migration · banco · Bank/ledger/payout/split/recovery · matching/social/promo.

## Estado

**CLOSED / YALA PASS COM RESSALVA.** Fecha SÓ como **F-AGENDA-SAVE-RATE-LIMIT-429**: o save da agenda destravou ao
eliminar a tempestade de requests do `loadAgenda` (≤12 no load, antes ~162); o 429 (quando ocorrer) mantém dirty e
mostra mensagem clara; nenhuma regressão na frente CLOSED de finalidade temporal; rate-limit de produção intocado. dev 389.

## YALA RESEAL / RE-RESEAL — PASS COM RESSALVA

- **Veredito:** **PASS COM RESSALVA** (re-reseal READ-ONLY). Commit material `17f25d66` · HEAD do reseal `c7e02d61` ·
  branch `rescue-structural`. Conclusão: **CLOSED / YALA PASS COM RESSALVA**; fila HOLD da agenda **limpa funcionalmente**.
- **Provas confirmadas:** fix **frontend-only** vivo e INALTERADO no HEAD (ProfileAgenda.tsx / AvailabilityScheduleEnhanced.tsx
  sem diff entre `17f25d66` e HEAD); `loadAgenda` ~162 → **≤12 requests constantes** (bookings/participants só dos 5
  cards exibidos; laço morto de `detectConflicts` removido); **save NÃO chama loadAgenda** e não duplica (guard
  `saveState==='saving'`); **429 = erro honesto** (mensagem clara, **dirty preservado**, sem sucesso falso);
  **backend/rate-limit INTOCADO**; zero migration/schema/backend material; zero Bank/Core/contacts/suppliers/RLS/RBAC.
- **Ressalva R1 (não bloqueante → DT):** a correção está provada por **call-trace estático** (sem harness de
  componente no frontend) + e2e de não-regressão; **falta guard/teste AUTOMATIZADO de request-count** que morda se
  `loadAgenda` voltar ao fan-out por janela/participante, reintroduzir `detectConflicts` em loop, ou mascarar 429.
  Registrada como **DT-AGENDA-LOAD-REQUEST-COUNT-NO-GUARD (OPEN)** — não bloqueia o fechamento; R1 NÃO corrigida aqui.
- **Selo:** commit docs-only `docs: seal agenda rate-limit reseal`. Estado final: **CLOSED / YALA PASS COM RESSALVA**.
