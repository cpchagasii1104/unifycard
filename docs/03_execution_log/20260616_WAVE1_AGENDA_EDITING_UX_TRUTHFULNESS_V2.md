# 2026-06-16 — F-AGENDA-EDITING-UX-TRUTHFULNESS-V2

A UI de edição da Agenda parava de emitir **recibo falso de persistência**. Parent `382d0f22` · branch
`rescue-structural` · dev **387 (ZERO migration)** · MODO EXECUTOR (ultracode, escopo restrito **frontend-first**).
**Hipótese confirmada:** o bug vivo estava na UI de edição — o SSOT temporal (`unified_availability`) e o
materializador backend já estavam corretos. **Nada de backend/schema/migration/RLS/authority-core tocado.**

## Pré-flight

HEAD `382d0f22` ✓ · branch `rescue-structural` ✓ · dev migrations **387 = 387** ✓ · **`frontend/` working tree
LIMPO** (superfície inteira do patch). Sujeira não-relacionada (memorias, `opus.md`, `clayton.md`/`dividas.md`/
`*.png`/docs institucionais/`backend/tmpschema.ts`) = baseline pré-existente, 100% fora de `frontend/`, NÃO staged
(git add específico). Reportado por disciplina (regra 5); como não toca a superfície e a frente é frontend-first, segui.

## READ-FIRST (workflow read-only, 5 leitores + grep blast-radius)

- **Blast radius LINEAR:** `Profile.tsx → ProfileAgenda → ProfileAgendaForm → AvailabilityScheduleEnhanced` — cada
  componente tem **exatamente 1 consumidor**. Sem acoplamento inesperado (não disparou o fallback de escalonamento).
- **Bug em DUAS camadas compostas:**
  1. **Editor** (`AvailabilityScheduleEnhanced.tsx`): `handleSave`/`handleSaveDay`/`handleSaveDate` chamavam
     `onChange(completeSchedule)` **fire-and-forget** (prop tipada `=> void`, nunca aguardada) e limpavam
     `dirtyDays`/`originalSchedule` **síncrono**, antes de qualquer confirmação do backend.
  2. **Parent** (`ProfileAgenda.tsx`): `handleScheduleChange` (o `onChange`) escondia o PUT real em
     `setTimeout(700ms)` e **descartava** o `MaterializeWeeklyTemplateResult` (`rejected`/`conflicts`/
     `protectedCount`), exibindo só "✓ Preferências salvas"; non-user fazia `return` **silencioso**;
     `onContextChange` era stub com comentário prometendo "persistência futura".
- **Contrato backend (READ-ONLY, não tocado):** `PUT /availability/weekly-template` → `{ ok, data:
  MaterializeWeeklyTemplateResult }`; authority server-side (`ownerId = req.actionContext.actorId`, nunca cliente);
  **partial-apply real** (cada janela com `try/catch` → `conflicts`; janelas com bookings ativos → `protectedCount`,
  não retiradas). Tipo FE já existia em `src/api/availability.ts:143` (`rejected[]`, `conflicts[]`, `protectedCount`).
- **STATUS/DT:** `DT-AGENDA-AVAILABILITY-VIA-DEAD-LEGACY-PUT` **CLOSED** (cadeia de persistência canônica;
  SSOT = `unified_availability`); contexto/non-user explicitamente fora do escopo das frentes F1–F4.

## Correção (frontend cirúrgico)

- **`utils/temporal/materializeResult.ts` (NOVO, puro):** `summarizeMaterializeResult(result)` → `clean` quando
  `rejected+conflicts+protectedCount === 0`, senão `partial` com contagem/mensagem. Defensivo a campos ausentes.
- **`AvailabilityScheduleEnhanced.tsx`:** prop `onChange: => void` → **`onSave: (schedule) =>
  Promise<MaterializeWeeklyTemplateResult>`** (explícito, aguardado). Novo `saveState`
  (`idle|saving|saved|partial|error`). `buildCompleteSchedule()` extraído; **`persistSchedule()`** aguarda `onSave`
  e: em **clean** → `setOriginalSchedule` + `setSchedule` + `clearDirty` + "Agenda salva"; em **partial** → NÃO limpa
  dirty/original, mostra "salvo parcialmente — N não aplicados" com detalhe; em **erro** → mantém dirty/original,
  mostra erro. Os 3 handlers (`handleSave`/`handleSaveDay`/`handleSaveDate` — calendário incluso) chamam
  `persistSchedule`; botões `disabled` enquanto `saving` (rótulo "⏳ Salvando…"); banner de feedback honesto no topo.
  **700ms debounce não existe mais** no caminho de save (era do parent). Seletores de contexto WORK/LEISURE/STUDY
  (semanal + calendário) **ocultos+desabilitados** via `showContextSelector` (antes prop morta, agora gateia o render).
- **`ProfileAgendaForm.tsx`:** prop `handleScheduleChange` → `onSave`; `onContextChange` removido. Para
  `actor_type !== 'user'` renderiza **bloco explícito** ("agenda pessoal; ator ativo é empresa/grupo; selecione seu
  ator de Pessoa Física") em vez do editor — sem afordância que finge persistir. Editor montado só p/ user, com
  `showContextSelector={false}`.
- **`ProfileAgenda.tsx`:** `handleScheduleChange` debounced removido → **`handleSaveSchedule`** async que
  retorna `Promise<MaterializeWeeklyTemplateResult>` (guarda actor/non-user lançando erro = defesa em profundidade,
  nunca no-op silencioso; timezone IANA obrigatória; faz o PUT e devolve o resultado). **NÃO muta `schedule` no
  save** — o prop `availability` fica referencialmente estável durante a sessão, então o `useEffect` de parse do
  editor não refaz e não limpa `dirtyDays` por fora (essa era a 2ª via do recibo falso). Toast falso + `saveStatus`/
  `saveTimerRef`/cleanup + stub de contexto removidos. Imports `useRef`/`useState` (órfãos) removidos; tipo do
  resultado importado.

## Provas

| Prova | Resultado |
| --- | --- |
| frontend typecheck (`tsc --noEmit`) | **0 erros** (4 arquivos tocados limpos) |
| vitest `materializeResult.test.ts` | **6/6** (clean; rejected/conflicts/protectedCount→partial; misto soma; defensivo) |
| call-trace manual (sem harness de componente) | ver abaixo |
| verificação adversarial (3 lentes, Explore) | **HOLDS** / refuted=false em todas |
| validate:actor-writer-boundaries / bank-ledger-boundaries | GATE OK / GATE OK |
| validate:regression-guards (chain) | rc=0 (sem regressão) |
| validate-architectural-patterns `--strict` | exit 0 · `critical_new=0` (varre backend/src → 0 atribuível ao frontend) |

**Por que call-trace e não teste de componente:** o frontend **não tem harness de componente** (sem `test` em
`vite.config.ts`, sem vitest.config, `test:invariants` aponta p/ dir inexistente, sem `@testing-library/react`).
Há vitest puro (node) — usado p/ o núcleo de verdade (`summarizeMaterializeResult`). O fluxo DOM é coberto por
call-trace:

1. **Editar sem clicar Salvar não persiste:** edições passam por `updateSchedule` (marca `dirtyDays`, sem `onSave`);
   o antigo `onChange`-automático não existe. PUT só em clique explícito.
2. **PUT só no save explícito:** `handleSave*` → `persistSchedule` → `await onSave` → `putWeeklyAvailabilityTemplate`.
3. **dirty limpa só após Promise limpa:** `clearDirty()` só no ramo `summary.status==='clean'` pós-`await`.
4. **rejected/conflicts/protectedCount → aviso, não sucesso:** ramo `partial` mantém dirty + banner "salvo
   parcialmente" com contagem (prova unitária do mapeamento em vitest).
5. **Erro HTTP mantém dirty:** ramo `catch` não toca dirty/original; mostra erro.
6. **handleSaveDate (calendário) mesmo contrato:** chama o mesmo `persistSchedule`.
7. **non-user não edita nem falha em silêncio:** ProfileAgendaForm bloqueia com mensagem; `handleSaveSchedule`
   lança erro p/ non-user (defesa).
8. **Verificação adversarial:** 3 lentes (false-receipt / debounce-nonuser-context-onChange / partial-regression)
   tentaram refutar e retornaram HOLDS — confirmaram clear clean-only, parse-effect estável durante save, contexto
   oculto, `onChange` sem resíduo, cadeia linear intacta.

## DT / Resíduos

- **DT-AGENDA-CONTEXT-WORK-LEISURE-STUDY-NOT-PERSISTED (OPEN):** contexto não persistido nesta frente; persistir
  exige decisão/DT própria (modelo CONCEPT), nunca blob/metadata. Selector oculto até lá.
- **Resíduo cosmético (não-bloqueador):** `isEmpty` (hint de empty-state) pode lingerar após o 1º save até reload —
  efeito DELIBERADO de não mutar `schedule` no save (evita o reset por prop que limparia dirty = recibo falso).
  Self-heal no próximo `loadAgenda`.

## NÃO FECHADO / NÃO TOCADO

Backend / materializador / authority-core / SSOT temporal `unified_availability` / `schedules` / `schedule_slots` /
migration / RLS / Bank / ledger / booking writes / availability service / money/payout/split/recovery. Persistência
de contexto. Fluxo de agenda para owners non-user (existe no backend; esta tela só não o finge).

## Estado

**IMPLEMENTED / HOLD PARA RESEAL**. Fecha SÓ como **F-AGENDA-EDITING-UX-TRUTHFULNESS-V2**: a interface passou a
representar a **verdade do save** — não marca salvo antes do backend confirmar, não esconde
`rejected`/`conflicts`/`protectedCount`, cobre o modo calendário, bloqueia non-user com mensagem, e não deixa o
contexto parecer persistido. SSOT temporal segue em `unified_availability`; nenhum backend heroico. dev 387.
