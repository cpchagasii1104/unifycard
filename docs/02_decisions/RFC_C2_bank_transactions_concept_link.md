# RFC C2 — bank_transactions: vínculo semântico ao CONCEPT SSOT

**Status:** DECIDIDO · Opção 1 (concept_id) · 2026-04-24
**Escopo:** decidir apenas o nome da coluna. Rollout, tipo/NULL-ability e nome de parâmetro TS são RFC separado.

## 1. Contexto
C2 (`SYSTEM_REMEDIATION_STATUS.md`): `bank_transactions` não tem campo que amarre cada transação ao CONCEPT SSOT. LEI §4.10.6: *"sem concept_ref válido, a operação financeira carece de significado."*

## 2. Decisão já travada (fora do escopo deste RFC)
- Nova coluna: `UUID NOT NULL`
- FK → `concepts(concept_id)` — SSOT semântico (MIGRATIONS_FULL.txt:3033–3039)
- Zero fallback: sem NULL final, sem inferência, sem metadata

## 3. Decisão em aberto: nome da coluna
- **Opção 1 — `concept_id`** · alinha com 07_NOMENCLATURA §4.4 e com 100% do schema atual.
- **Opção 2 — `concept_ref`** · alinha com o vocabulário narrativo da LEI §4.10 e com o nome da violação C2 no plano de remediação.

## 4. Evidência
**07_NOMENCLATURA §4.4 Chaves** (01_NORMATIVE_FULL.txt:2828–2837, literal):
> *"Chave primária: `id`. Chave estrangeira: `<entidade>_id`. ✔ `profiles.user_id` · ❌ `userId`."*

**FKs existentes apontando para `concepts(concept_id)` — todas seguem `<prefixo>concept_id`:**
- `categories.concept_id` — MIGRATIONS_FULL.txt:3044
- `tenant_concept_offerings.concept_id` — :3117
- `concept_relations.subject_concept_id` / `object_concept_id` — :3284–3285
- `company_type_allowed_concepts.concept_id` — :6153
- `canonical_products.concept_id` — :6214
- `products.concept_id` — :9743
- `canonical_concept_resolution_queue.resolved_concept_id` — :9818

**Ocorrências de `concept_ref` / `concept_reference` como coluna em qualquer tabela:** **zero** (`grep -c` em MIGRATIONS_FULL.txt).

**LEI §4.10** usa `concept_ref` como **termo de runtime** (valor devolvido pelo `concept-offer-refs.adapter.ts`), não como prescrição de nome-de-coluna. Nenhum artefato normativo prescreve `concept_ref` como nome de coluna.

## 5. Análise
A coluna persiste uma FK para `concepts(concept_id)`; 07_NOMENCLATURA §4.4 nomeia isso de uma única forma. Adotar `concept_ref` criaria a primeira exceção do schema à §4.4 em 199 tabelas. Precedência §2.2.7 AGENT_PROTOCOL: 07_NOMENCLATURA é regra executável (schema); LEI §4.10 é prosa sobre runtime. Não há conflito real — há dois níveis, e o nome da coluna pertence ao nível da §4.4.

## 6. Recomendação
**Opção 1 — `concept_id`.** A coluna é a FK; a §4.4 rege. `concept_ref` permanece como termo de runtime (nome do parâmetro TS, valor retornado pelo adapter, label em logs).

## 7. Impacto do nome na execução
Contagem de call sites não muda (23 arquivos, 44 chamadas — Passo 0 Item 5). Muda apenas a string do campo no DTO/INSERT.

## 8. Critério de saída
Clayton escolhe **Opção 1** ou **Opção 2**. Este RFC é atualizado com `DECISÃO: <escolha> — <data> — <justificativa em 1 linha>`. Só então o RFC de rollout é redigido e, depois, a migration.

## 9. Fora do escopo
- Rollout (NULL-first vs NOT NULL direto, backfill, seed de concepts)
- Nome do parâmetro TypeScript nos writers
- Política de imutabilidade pós-emissão fiscal (COMPLIANCE §B)
- Coexistência com `purpose` (enum `transfer_purpose`)

## 10. Decisão
**DECISÃO: concept_id** — 2026-04-24 — Precedência normativa (07_NOMENCLATURA §4.4 regra literal + AGENT_PROTOCOL §2.2.7 executável > prosa) e adesão uniforme do schema (100% das FKs para concepts seguem o padrão, zero usam `concept_ref` como coluna). O nome `concept_ref` permanece como termo de runtime (parâmetro TS, retorno do adapter, label em logs), mas não é nome de coluna.
