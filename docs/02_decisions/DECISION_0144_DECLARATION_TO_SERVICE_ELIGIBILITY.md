# DECISION-0144 — Régua de elegibilidade declaração→service na cadeia de oferta (F-OFFER-2)

**Status:** **PROMULGADA / DOCS-ONLY / DECISÃO ARQUITETURAL / RÉGUA DE ELEGIBILIDADE DECLARAÇÃO→SERVICE** (Clayton 2026-06-21; ChatGPT APPROVED_WITH_GUARDS).
**NÃO** altera `docs/01_normative`. **NÃO** toca runtime/migration/frontend/backend. Precede a execução material (F-OFFER-2A schema + F-OFFER-2B runtime), que só roda após promulgação.

**Data:** 2026-06-21 · **Branch:** `rescue-structural` · **HEAD (pré-commit):** `4431b8fc` · **dev:** 398/398
· **Tipo:** arquitetural / régua de autoridade+elegibilidade (docs-only) · **Frente:** F-OFFER (F-OFFER-2)
· **Responsável:** Clayton / IA-DIRETORA (executor: Claude Opus 4.8) · **Ratificação:** Clayton + ChatGPT
(APPROVED_WITH_GUARDS) + READ-FIRST curto F-OFFER-2 (IA-ACTOR FALTA_X · IA-AUTORIDADE FALTA_DECISAO · IA-BANCO PASS_PARA_GO_DE_DECISAO).

**Deriva de / subordinada a:** **DECISION-0143** (contrato de vocabulário da cadeia) · DECISION-0142 (folha-SSOT;
casar por `concept_id`, nunca `domain`) · DECISION-0117 (`canonical_services`) · DECISION-0113 (`actorId`=hint;
autoridade server-side) · DECISION-0100/0101 (publish PJ = `canManageCompany`+KYB+operacional+concept==primary) ·
DECISION-0118 (representação genérica ≠ dono de PJ) · DECISION-0136 (`actor_capability_grants`).

---

## §0 — Natureza
Régua de **elegibilidade** da ponte `declaração → service`: define **quem** e **sob qual prova de capacidade**
um actor cria um `service` (capacidade descobrível). Docs-only; **não** cria tabela/migração/código. A
materialização ocorre em F-OFFER-2A/2B, sob GO próprio. Fecha o **bypass KYB-transitivo** provado no READ-FIRST
(hoje `createService` exige só `canRepresentActor`/`canManageCompany`, sem declaração/KYB).

## §A — A RÉGUA (conteúdo normativo)
1. **`createService` é concept-keyed.**
2. **`service` exige `canonical_service_id`** (NOT NULL — sem `service` concept-less).
3. **`canonical_service` resolve `concept_id`** (a âncora semântica do service vem do canonical).
4. **PF:** criar `service` exige **`actor_professional_concepts` ACTIVE** para (tenant, actor, **mesmo `concept_id`**).
5. **PJ:** criar `service` exige **`company_concept_publications` ACTIVE** para (company, **mesmo `concept_id`**) —
   isso faz o **KYB do publish proteger transitivamente** o service (fecha o bypass).
6. **Declaração/publicação é INSUMO de elegibilidade, NÃO substitui autoridade.** O gate vivo
   (`canRepresentActor` / `canManageCompany`) **permanece obrigatório e é SOMADO** à elegibilidade — re-gateia na
   travessia, **nunca herda**.
7. **`actionContext.actorId` nunca é autoridade** (HINT; `userId` server-side; gate real é `canRepresentActor`).
8. **`category`/`domain`/`slug` não são identidade semântica** (Lei 7 / DECISION-0142).
9. **V1 = match EXATO de `concept_id`.** Proibido inferir por `domain`, `category`, `slug` ou relação de grafo
   (`related_to`/`requires`/`part_of`). Expansão por grafo = frente futura própria.
10. **Operador/funcionário** criando service pela company via **`actor_capability_grants`** = **FORA** desta régua
    (toca autoridade dormant → DECISION + fatia + reseal próprios).
11. **PF KYC-lite/trust** extra para ser descobrível = **FORA** (entra depois em contratação/pagamento/payout/
    ranking/visibilidade avançada ou política própria). V1: PF cria service com `canRepresentActor`/self + declaração active + concept match.
12. **Dinheiro, `availability`, `service_offerings`, discovery e presença** = **FORA** desta régua.

## §B — Decisões D3 (ratificadas)
- **D3-1 ENTRA** (§A.4/5/6) · **D3-2 ENTRA** (§A.2, após preflight de dados) · **D3-3 ENTRA V1** (§A.9, match exato).
- **D3-4 NÃO ENTRA** (operador via grants — §A.10) · **D3-5 NÃO ENTRA** (PF KYC-lite — §A.11).
- **D3-6 DIVIDIDO:** **Parte A ENTRA** (FK `concept_id→concepts` dos substratos de declaração/publicação
  NO ACTION→**RESTRICT**, se preflight provar 0 órfãos/incompatíveis) · **Parte B NÃO ENTRA** (conter ramo-4 legado
  `is_primary`/`role='admin'` = cleanup de autoridade separado; não misturar com a ponte de oferta).

## §B-bis — GUARDS DE EXECUÇÃO (ChatGPT, vinculantes; na dúvida, STOP)
- **G1 — "ACTIVE" respeita o schema VIVO.** Se `actor_professional_concepts`/`company_concept_publications` não
  tiverem campo `status`/`active` explícito, a executora **mapeia o equivalente material real OU para com
  `STOP_DECISION_REQUIRED`** — proibido inventar booleano.
- **G2 — Owner PF/PJ derivado SERVER-SIDE.** Body (`actorId`/`companyId`/`ownerId`) = input/hint, **nunca**
  autoridade nem owner operacional; autoridade e owner vêm do servidor.
- **G3 — Distinção PF×PJ segura ou STOP.** Se a execução não distinguir com segurança service-PF de service-PJ,
  **para** — proibido heurística por `display_name`/`actor_type` solto/`category`/`domain`/`slug`/presença casual de `companyId`.
- **G4 — `canonical_service` resolve `concept_id` materialmente.** Match = `declaração/publicação.concept_id ==
  canonical_services.concept_id`. Se `canonical_services` não tiver `concept_id` material/FK suficiente, **STOP antes do runtime**.
- **G5 — Zero expansão semântica em V1.** Proibido `domain`/`category`/`slug`/`related_to`/`requires`/`part_of`/
  `substitutes`/árvore vertical/inferência por nome. **Só `concept_id` exato.**
- **G6 — Declaração/publicação NÃO substitui autoridade.** A ponte SOMA: autoridade server-side + declaração/
  publicação active + `concept_id` exato. Nunca herdar autoridade da declaração.

## §C — Execução material (após promulgação; GO próprio por fatia)
- **F-OFFER-2A (schema):** `services.canonical_service_id` **NOT NULL** (após preflight: rowcount, NULL count,
  órfãos, FK atual — STOP se houver linha incompatível) + FK `concept_id→concepts` → **RESTRICT** nos 2 substratos
  (se seguro). Janela virgem (services=0, ccp=0, apc=1).
- **F-OFFER-2B (runtime):** `createService` exige declaração/publicação ACTIVE compatível (concept match exato);
  **PF sem declaração → 403 controlado**; **PJ sem publicação active → 403 controlado**; spoof de
  `actionContext.actorId` **não** bypassa; concept/category/domain divergente **não** bypassa.

## §D — Proibições (vinculantes na execução)
Não tocar: `service_offerings` · `availability` · discovery · marketplace ranking · material/estoque · dinheiro ·
payout · presença. Não ativar `actor_capability_grants`. Não criar operador delegado. Não inferir matching por
`domain`/`category`/`slug`/grafo. Não alterar `docs/01_normative`.

## §E — Gates/provas obrigatórios (na execução material)
Preflight de dados ANTES da migration · E2E PF com declaração **cria** service · E2E PF sem declaração **bloqueia**
(403) · E2E PJ com publicação active **cria** · E2E PJ sem publicação active **bloqueia** (403) · negative-proof de
bypass por category/domain · negative-proof de spoof de `actionContext` · guard contra `service` concept-less ·
guard contra `createService` sem eligibility check · `validate:actor-writer-boundaries` · `validate:bank-ledger-boundaries`
· `validate:regression-guards` · `validate-architectural-patterns --strict` · typecheck `no_new_errors`.

## §F — Fora de escopo (frentes próprias)
Operador via grants (D3-4) · PF trust/KYC-lite (D3-5) · ramo-4 legado (D3-6 Parte B) · F-OFFER-3..6
(service_offering, discovery re-key, availability owner, conflito cross-oferta) · material · dinheiro · presença.

**Supera:** — · **Superada por:** — · **Referências:** DECISION-0143/0142/0117/0113/0100/0101/0118/0136 ·
`docs/orquestracao/processo/cadeia-de-oferta/CONSOLIDADO.md` (READ-FIRST F-OFFER-2, 3 elos) ·
`respostas/IA-ACTOR.md`·`IA-AUTORIDADE.md`·`IA-BANCO.md` (§F-OFFER-2).
