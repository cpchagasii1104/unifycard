# DECISION-0070 — Expansão governada de categories por IA não é identidade semântica

**Status:** RATIFICADA — DOCS-ONLY (split documental de DT após auditoria read-only) (2026-06-01).
**Sessão:** 2026-06-01 (pós-auditoria READ-ONLY da `DT-PROFILE-FRONTEND-DRIVES-TAXONOMY`).
**Decisor:** Clayton (split da DT + classificação do resíduo).
**Commit âncora:** HEAD origem `9149e523`.
**Documento canônico:** este arquivo.
**Complementa (sem revogar):** DECISION-0064 (governança semântica Learning/Interest), DECISION-0068
(surfacing de conceptId em contextos declarativos), `SELO_C1_LEARNING_INTEREST.md`.
**Vinculada a:** `DT-PROFILE-FRONTEND-DRIVES-TAXONOMY` (reduzida), `DT-PROFESSIONAL-EDUCATION-COMPANY-AI-CATEGORY-EXPANSION` (nova).

---

## 1. Contexto

A `DT-PROFILE-FRONTEND-DRIVES-TAXONOMY` nasceu do risco de o **frontend dirigir taxonomia** (criar/sugerir
categoria/semântica contornando a governança de CONCEPT). A auditoria read-only (HEAD `9149e523`) verificou:

- **Learning** (`ProfileLearning.tsx`): **neutralizado** — não chama mais `createCategoryWithAI`/
  `suggestCategoryPath` (Fatia 4b; só comentário remanescente).
- **Interest** (`ProfilePhysical`): **neutralizado** — catálogo fake e texto livre removidos; usa a árvore real
  `scope='interest'` (Fatia 4c).
- **C1 declarativo** (professional/learning/interest) **exige `conceptId`** (trava); **sem fallback
  `conceptId ← categoryId`** em nenhum fluxo (provado F1–F4, 4b/4c).
- **Fluxos ainda vivos** que dirigem criação de `categories` por IA:
  - **Profissional** — `ProfileProfessional.tsx` (UI renderizada): `suggestCategoryPath('professional')`
    (classifica, sem write) + `createCategoryWithAI('professional')` (cria category).
  - **Educação/Empresas** — `profile-education-companies.service.ts` (backend, UI-triggered):
    `createCategoryWithAI({context:'education'})` e `{context:'company'}`.
- **Governança material** no backend: política de admissão **BLOCK/REVIEW/ALLOW**, status
  `pending_review` + `requires_review`, auditoria `source:'ai'`. O endpoint `/categories/ai-create` exige
  usuário autenticado; a governança real está no **service**, não no gate de rota.

## 2. Escolha

**Não neutralizar mecanicamente agora.** Classificar o resíduo vivo (Profissional/Educação/Empresas) como
**expansão GOVERNADA de NAVEGAÇÃO (`categories`)**, **não** criação de **identidade semântica (`concepts`)**.
Manter como **DT própria, DEFERRED**, até decisão de produto.

## 3. Justificativa

- **`createCategoryWithAI` cria `categories`, não `concepts`** — não escreve em `concepts` nem atribui
  `concept_id` à categoria criada. A concept governance (`app.concept_governance`) é só migration.
- **Categorias sem `concept_id` NÃO são declaráveis no C1** — a trava `conceptId` obrigatória bloqueia a
  declaração (professional/learning/interest). Portanto a expansão por IA não vira **identidade declarada**.
- **`concept_id` continua identidade semântica** (Lei 7); **`category_id` continua navegação/breadcrumb**.
- **Existe policy/review/auditoria** — a criação não é inserção arbitrária: passa por BLOCK/REVIEW/ALLOW,
  fila `pending_review` e log `source:'ai'`. É expansão **mediada e auditável**, não drift cru.

## 4. Vetos (vinculantes — permanecem)

- ❌ Frontend **não pode criar CONCEPT**.
- ❌ Frontend **não pode usar `categoryId` como identidade**.
- ❌ **Sem fallback `conceptId ← categoryId`**.
- ❌ Categorias IA **sem `conceptId` não podem ser gravadas como declaração C1** (trava obrigatória).
- ❌ A expansão de navegação por IA **não** abre exceção para semântica: o que define "o que algo é"
  continua sendo **CONCEPT** via governança.

## 5. Consequência

- **`DT-PROFILE-FRONTEND-DRIVES-TAXONOMY` reduzida**: o núcleo semântico (identidade/CONCEPT) está resolvido
  (Learning/Interest neutralizados; C1 concept-first; sem `categoryId` como identidade; frontend não cria
  CONCEPT). Permanece **PARTIALLY MITIGATED** apontando para a DT específica.
- **Nova DT** `DT-PROFESSIONAL-EDUCATION-COMPANY-AI-CATEGORY-EXPANSION` (DEFERRED) rastreia o resíduo vivo de
  **navegação governada por IA** (Profissional + Educação/Empresas).

## 6. Decisão futura de produto (não nesta DECISION)

Para a nova DT, três caminhos possíveis (decisão de Clayton, fatia executora própria):
1. **Manter** a capacidade governada (DEFERRED — aceitar expansão por IA com policy/review).
2. **Neutralizar** como Learning/Interest (UI só declara da árvore existente; sugestão vira intenção sem
   criar `categories`).
3. **Transformar** a sugestão em **fila formal de governança** sem criação imediata (REVIEW sempre, nunca
   `auto_active`).

Esta DECISION **não** escolhe entre (1)/(2)/(3) — apenas classifica o resíduo e separa a dívida.

## 7. Superada por

(em aberto — decisão vigente)
