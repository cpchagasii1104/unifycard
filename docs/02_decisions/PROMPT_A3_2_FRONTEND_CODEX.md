# PROMPT DE EXECUÇÃO A3.2 (FRONTEND — papel unificado Claude) — migrar a aba Profissional para o C1

> **NOTA 2026-06-04:** o frontend/UX passou a ser alçada do **Claude** (papel unificado backend + frontend/UX). A regra original "FRONTEND = Codex" foi reatribuída; o SELO A3.2 já registra que a executora `unificard` (Claude) executou esta fatia. Texto mantido como artefato, com o papel ajustado para Claude.
>
> **STATUS: FINAL — escopo estrito.**
> Derivado do DESENHO_A3 PROMULGADO (`c6830926`) + SELO A3.1 (`526b1c6f` / `c3e16365`). Não reabre
> decisões. **Alçada: FRONTEND = Claude (papel unificado).** Escritor único: só o frontend (Claude) toca
> `frontend/src`. Pós-execução, auditoria do diff + verificação backend (re-sweep C1,
> não-persistência fora do C1).

## PRÉ-LEITURAS OBRIGATÓRIAS
- docs/02_decisions/DESENHO_A3_PROFISSIONAL_LEGADO_PARA_C1.md (promulgado — norte vinculante).
- docs/02_decisions/SELO_A3_1_INFERENCE_DESACOPLAMENTO.md (A3.1 backend já selada).
- docs/02_decisions/SELO_A2_C1_PERFIL_PROFISSIONAL.md + DECISION-0063 (contrato C1).
- Lei operacional vinculante: "frontend nunca cria verdade — projeta verdade resolvida".

## ETAPA 0 — ANCORAGEM (explícita)
```
git branch --show-current
git rev-parse HEAD
git status --short
git log --oneline -8
```
- Confirmar que o HEAD inclui o **selo documental A3.1 `c3e16365`** (não só o commit de código `526b1c6f`).
- Se `git status --short` NÃO estiver limpo → **PARAR**.
- Sujeira em frontend/src ou backend/src → **PARAR**.

## BASELINE (capturar ANTES de editar — prova, não otimismo)
- Ler `frontend/package.json` e identificar os scripts REAIS de typecheck/build/lint.
- Rodar esses scripts ANTES da edição e registrar o estado:
  - baseline VERDE, ou
  - erro PRÉ-EXISTENTE (fora da fatia).
- **Critério A3.2:** não criar erro NOVO nos arquivos tocados. Erro pré-existente fora da fatia não bloqueia.
- Se houver erro PRÉ-EXISTENTE nos ARQUIVOS-ALVO antes da edição → **reportar antes de tocar**.

## READ-FIRST OBRIGATÓRIO — BLAST RADIUS DO FRONTEND
- Mapear TODOS os callers de `getProfessionalProfile` e `updateProfessionalProfile`
  (frontend/src/api/categories.ts:~231/~280 + qualquer outro consumidor).
- **TRAVA:** se essas funções legadas forem usadas por MAIS DE UMA superfície, NÃO repontar globalmente.
  Preferir criar funções C1 EXPLÍCITAS novas (ex.: `getProfessionalC1`, `updateProfessionalBioC1`,
  `declareProfessionalConceptC1`, `updateProfessionalConceptC1`, `retireProfessionalConceptC1`) e migrar
  **só a aba Profissional**. Se o blast radius for MAIOR que a aba Profissional → **PARAR e reportar**.

## CONTRATO C1 — LER NO BACKEND, NÃO ASSUMIR POR MEMÓRIA
- O frontend (Claude) DEVE ler `backend/src/core/profile/professional-c1/professional-c1.routes.ts` e
  `professional-c1.types.ts` e distinguir:
  - **request body = snake_case**; **response DTO = camelCase** (wrapper `professional_bio` é snake).
- Mapear a assimetria no ADAPTER do frontend. **NÃO alterar backend.** Não assumir shape.
- Referência (re-confirmar no código):
  - READ GET /profile/professional/c1 → `{ concepts: [{conceptId, sourceCategoryId, skillLevel,
    yearsExperience, isActive, declaredAt, updatedAt, retiredAt}], professional_bio }`
  - WRITE: PUT /c1/bio `{professional_bio}` · POST /c1/concepts `{concept_id, source_category_id?,
    skill_level(1..5), years_experience?(0..80|null)}` · PATCH /c1/concepts/:conceptId `{skill_level?,
    years_experience?, reactivate?:true}` (vazio→400) · DELETE /c1/concepts/:conceptId.

## TRAVA DE IDENTIDADE — concept_id (DURA)
- A aba seleciona profissão pela árvore/autocomplete de categorias (category_id). C1 declara por **concept_id**.
- Confirmar POR ENDPOINT do backend se a árvore/autocomplete expõe `concept_id` REAL.
- **Se NÃO houver `concept_id` → PARAR e reportar** (vira gap/DT de backend).
- NÃO mandar `category_id` como `concept_id`. NÃO hardcodar tabela de conceitos no frontend.
  NÃO criar taxonomia no frontend.
- `source_category_id` só pode entrar como breadcrumb SE houver `concept_id` soberano resolvido.

## SAVE GRANULAR (não há mais PUT-bundle)
- bio → `PUT /profile/professional/c1/bio`
- conceito NOVO → `POST /c1/concepts`
- conceito ALTERADO → `PATCH /c1/concepts/:conceptId`
- conceito REMOVIDO → `DELETE /c1/concepts/:conceptId`
- **PATCH vazio é PROIBIDO** (backend responde 400) — evitar no frontend (só PATCH com campo material).
- **TRAVA:** se não conseguir calcular com segurança o DIFF entre estado inicial e estado editado
  (novo / alterado / removido), **PARAR e reportar**. NÃO inventar PUT-bundle.

## REDUÇÃO DE ESCOPO — campos fora do C1
- preço, serviços, availability, workers, educação, certificação, capability, authority →
  **removidos, desabilitados, ou marcados "em breve"**.
- Esses campos **NÃO** podem ser salvos em `metadata`, **NÃO** no legado, **NÃO** em payload escondido.

## PROIBIÇÕES (vinculantes)
- NÃO mandar `actorId` no body de nenhuma chamada; usar `apiFetch` + headers/contexto existentes
  (Authorization / x-tenant-id / x-action-context já injetados pelo client).
- Frontend não cria verdade (não concede capability/authority; não cria taxonomia).
- NÃO tocar backend, C1, legado, migration, financeiro, Interesses/Aprendizado, docs/status.

## VALIDAÇÃO (usar scripts REAIS do projeto)
- Rodar os scripts reais de typecheck/build/lint (do `frontend/package.json`) — **não inventar script** —
  e comparar com o BASELINE: zero erro NOVO nos arquivos tocados.
- **"Zero legado" condicionado a blast radius:**
  - PRIMEIRO mapear todos os callers de `getProfessionalProfile`/`updateProfessionalProfile`.
  - Se usadas SOMENTE pela aba Profissional → pode substituir/remover as chamadas legadas.
  - Se usadas por OUTRA superfície → **PARAR e reportar** (não migrar globalmente).
  - **NÃO apagar função legada COMPARTILHADA sem prova de blast radius.**
  - `grep` final deve provar **zero chamada ativa DA ABA PROFISSIONAL** ao legado `/profile/professional`
    sem `/c1`.
- Inspeção de rede (ou prova equivalente) mostrando que a aba usa `/profile/professional/c1`.
- Prova de que NENHUM `actorId` é enviado no body.
- Prova de que NADA fora do C1 é persistido (metadata/legado/payload escondido).

## ESCOPO / COMMIT
- Commit ISOLADO frontend: só `frontend/src` + arquivos estritamente necessários de frontend.
- NÃO tocar backend · NÃO migrations · NÃO docs/status.
- `git diff --cached --name-only` = só frontend. SEM merge/rebase/push.

## RELATÓRIO FINAL
HEAD antes/depois (com selo c3e16365 confirmado) · baseline (verde/erro pré-existente) · blast radius dos
callers legados · arquivos alterados · prova do `concept_id` resolvido por backend (ou STOP) · scripts reais
rodados (typecheck/build/lint) comparados ao baseline · grep zero-legado-sem-/c1 (escopo aba Profissional) ·
prova de rede usando /c1 · prova sem actorId no body · prova de não-persistência fora do C1 · confirmação
backend/C1/legado/migration/financeiro/docs intocados · escritor único · sem merge/rebase/push.
