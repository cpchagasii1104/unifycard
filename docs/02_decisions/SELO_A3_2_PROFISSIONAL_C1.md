# SELO A3.2 — Migração da aba Profissional (legado → C1) + reparo runtime R3

## A3.2 — SELADA (aba Profissional no C1 actor-first) — 2026-06-01
Selada por Clayton após ratificação independente do ChatGPT.
Fatia de execução do `DESENHO_A3` promulgado (`c6830926`), encerrando a Frente 1 (tirar a aba
Profissional do serviço legado morto e ligá-la ao substrato C1 selado).

**Clayton OVERRIDOU** a regra "Codex faz frontend" e autorizou a executora `unificard` (Claude) a
executar o frontend desta fatia.

### Cadeia de commits selada
| Commit | Camada | Conteúdo |
|--------|--------|----------|
| `1958ab05` | backend | Expõe `categories.concept_id` como `conceptId` nos endpoints profissionais (tree/autocomplete/children), **GATED por contexto** (OPÇÃO B — só `context=professional` explícito; marketplace/produto/transacional NÃO recebem, 07 §4262/4278). Sem migration (coluna já existia; FK → `concepts`). |
| `98a75ad0` | frontend | Migra a aba Profissional para `/profile/professional/c1`: load `getProfessionalC1`; save **granular** (novo→POST, alterado→PATCH, removido→DELETE, bio→PUT); `conceptId` real do backend; `source_category_id` = breadcrumb; redução de escopo (preço/serviços/availability/workers/capability/authority saem como "em breve", nunca em metadata/legado); sem `actorId` no body. ProfileAgenda + `updateProfessionalProfile` (compartilhada) INTACTOS. |
| `e1400562` | backend | `/categories/:id/children` exige `?context=professional` **explícito** para surfaçar `conceptId` (default seguro; sem contexto, conceptId não é exposto). |
| `31e31419` | backend | Remove catch amplo de `getProfessionalC1` que mascarava erro real (500/401/403) como perfil vazio — falha passa a ser visível. |
| `361c2671` | frontend | **A3.2-R3**: a expansão de áreas profissionais (`toggleCategory`) passa a chamar `getCategoryChildren(categoryId, 'professional')`. Sem o contexto explícito, a folha chegava sem `conceptId` e a trava C1 do `addSkill` bloqueava a declaração. `getCategoryChildren` ganhou param `context` opcional (retrocompatível). |

### Ratificação tripla
- **Opus** — coordenador/parecer.
- **ChatGPT** — auditoria independente dos brutos (incl. reparos `e1400562` + `31e31419` + R3 `361c2671`).
- **Clayton** — selo.

### Invariantes preservados (provados)
- **`concept_id` soberano:** a profissão declarável exige `conceptId` real vindo do backend (FK → `concepts`, Lei 7). Sem fallback `conceptId = categoryId`; `categoryId` NUNCA vira identidade semântica. Prova runtime R3: `GET /categories/:id/children?context=professional` retorna `conceptId` real nas folhas (ex.: "Medicina" → 3 folhas com conceptId FK→concepts); sem o contexto, `conceptId` AUSENTE.
- **`source_category_id` apenas breadcrumb:** usado só como rastreio/label de origem da seleção e resolução de nome contra a árvore; nunca como identidade nem como `concept_ref` transacional.
- **C1 backend selado intacto:** `backend/src/core/profile/professional-c1/*` não tocado; contrato de escrita preservado (WRITE snake_case / READ camelCase + wrapper `professional_bio`).
- **Legado não usado pela aba:** zero `getProfessionalProfile` e zero `updateProfessionalProfile` invocados no fluxo de leitura/escrita da aba Profissional (componente + hook). A função compartilhada `updateProfessionalProfile` permanece definida para a Agenda, fora desta aba.
- **Agenda fora do escopo:** ProfileAgenda intocado; persistência de availability via Agenda não alterada nesta fatia.
- **Zero financeiro:** nenhum toque em bank/ledger/split/payout/wallet.
- **Zero migration:** nenhuma migration criada ou alterada (coluna `concept_id` já existia).

### Validação aceita
- frontend `tsc --noEmit` = **0**.
- Gates backend sem regressão: `validate:actor-writer-boundaries` OK · `validate:bank-ledger-boundaries` OK ·
  `validate:regression-guards` OK · `validate-architectural-patterns --strict` **`critical_new=0`**,
  `critical_total=20` sem aumento (baseline legado preservado).
- Prova runtime pelo fluxo real (login dev → actor resolvido dinamicamente pelo `userId`, não hardcoded;
  porta alternativa 3010). Persistência C1 (POST/PATCH/DELETE + bio PUT) já provada na execução A3.2;
  R3 prova que o botão "Adicionar" recebe a folha com `conceptId` real.

### O que A3.2 NÃO resolve (registrado para não virar fantasma)
- **Aprendizado / Interesses:** fora do escopo, bloqueados.
- **Saúde:** fora do escopo, intocada.
- **Agenda (camada TEMPO/C3):** fora do escopo. Pendência conhecida: a Agenda persiste availability via
  `updateProfessionalProfile` (PUT legado morto) → dívida a registrar como
  `DT-AGENDA-AVAILABILITY-VIA-DEAD-LEGACY-PUT` em **commit documental próprio** (NÃO neste selo).
- **C2/C3 profissional** (preço/serviços/availability): saíram da aba como "em breve"; são frentes
  posteriores com ratificação própria. C1 declara identidade/competência; NÃO é SSOT de preço/oferta/
  availability/capability.

### Fila após o selo
- **A3.2:** SELADA. Frente 1 (aba Profissional legado → C1) fechada tecnicamente.
- **Próximo (documental):** registrar `DT-AGENDA-AVAILABILITY-VIA-DEAD-LEGACY-PUT` + housekeeping
  (5 `.txt` de evidência `A3_2_*` + destino do `frontend_src_completo.txt`) + destino final do legado
  `/profile/professional` (410/501 vs intocado) — fatia própria.
- **Próxima frente de valor (Clayton sequencia):** C2/C3 do perfil profissional OU Interesses/Lei 7.
- **Bloqueados:** Interesses/Aprendizado · financeiro · migration.
