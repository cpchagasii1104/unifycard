# DECISION-0143 — Contrato de vocabulário da cadeia de oferta (CONCEPT → SERVICE → SERVICE_OFFERING → AVAILABILITY)

**Status:** **PROMULGADA / DOCS-ONLY / DECISÃO ARQUITETURAL / CONTRATO DE VOCABULÁRIO DA F-OFFER** (Clayton 2026-06-21; ChatGPT APPROVED_WITH_GUARDS).
**NÃO** altera `docs/01_normative` (norma canônica intocada). **NÃO** toca runtime/migration/frontend/backend. Vincula a frente F-OFFER (fatias F-OFFER-1..6); é o contrato que evita que as fatias virem "correção local sem contrato".

**Data:** 2026-06-21 · **Branch:** `rescue-structural` · **HEAD (pré-commit):** `9f5e9c5e` · **dev:** 398/398
· **Tipo:** arquitetural / contrato de vocabulário (docs-only) · **Frente:** F-OFFER (F-OFFER-0)
· **Responsável:** Clayton / IA-DIRETORA (executor: Claude Opus 4.8) · **Ratificação:** Clayton + ChatGPT
(APPROVED_WITH_GUARDS) + Rodada 7 `F-PROFILE-PJ-OFFER-CONFIGURATION-READINESS` (6 instâncias) + IA-BANCO (prova-viva).

**Deriva de / subordinada a:** `docs/01_normative/18_DOMAIN_ONTOLOGY_UNIFICARD.md` · `SSOT_REGISTRY_UNIFICARD.md`
(Lei 7 — concept = identidade semântica SSOT) · **DECISION-0142** (folha-SSOT-global; casar por `concept_id`, nunca
por `domain`) · DECISION-0117 (modelo canônico catálogo/oferta) · DECISION-0122 (`service_offering` = recurso
canônico de contratação) · DECISION-0121 (authority binding booking→decision→service_order) · DECISION-0113
(`actorId` declarado = hint; autoridade server-side) · DECISION-0132 (`purpose_concept_id` na agenda).

---

## §0 — Natureza
Contrato de **vocabulário** da cadeia de oferta. Fixa o significado e o SSOT de cada camada **antes** de qualquer
execução, para que F-OFFER-1..6 enforcem um vocabulário único. **Docs-only**: não cria tabela, não migra, não toca
código nem norma canônica. É decisão **arquitetural de frente**, não emenda de `01_normative`.

## §A — As 4 camadas e a cadeia
**Cadeia soberana:** `CONCEPT → SERVICE → SERVICE_OFFERING → AVAILABILITY`.

1. **Declaração de capacidade (declara/qualifica "eu faço isso"):**
   - PF → `actor_professional_concepts` (concept-keyed; gated por `canRepresentActor`; sem preço).
   - PJ → `company_concept_publications` (concept-keyed; gated por `canManageCompany` + KYB approved).
2. **Descoberta / capacidade operacional descobrível:** `services` (concept-keyed; `canonical_service` → `concept`).
3. **Oferta contratável (vende):** `service_offerings` (exige service canônico; `price_cents` **BIGINT**; duração; status).
4. **Disponibilidade real (prova tempo):** `availability` com `owner_type='service_offering'`.

**Papéis:** declaração/publicação **qualificam** · `services` **operacionaliza a descoberta** · `service_offerings`
**vende** · `availability` **prova o tempo**. "Eu faço isso" **não** é um SSOT único — são camadas distintas.

## §B — Invariantes (vinculantes para F-OFFER-1..6)
- `concept_id` é a **identidade semântica**; `concept.domain` **NÃO** filtra matching (DECISION-0142).
- `category`/`category_id` **NÃO** é identidade semântica.
- `actionContext.actorId` **nunca** é autoridade; **autoridade server-side é obrigatória** (DECISION-0113).
- Preço monetário **só** em `price_cents` **BIGINT**.
- Tempo **só** no SSOT temporal (`availability`); proibido inferir disponibilidade fora dele.
- **Sem verdade paralela** — uma resposta por fato.

## §C — Relação com o estado vivo (Rodada 7 · IA-BANCO, HEAD `9f5e9c5e`)
A espinha **existe e está VAZIA** (services/service_offerings/publications = 0; canonical_services=1;
actor_professional_concepts=1) → janela virgem de baixo custo para convergir. Hoje, porém: `services` é
**concept-OPCIONAL** e `service_offerings` **não exige** `services` (DECISION-0122 = dois caminhos). Esta 0143
**declara o ALVO** (services = camada de descoberta canônica concept-keyed; offering exige service canônico);
a **materialização** ocorre nas fatias **F-OFFER-2/3**, não aqui.

## §D — Fatiamento ratificado (D4) e fora de escopo
- **F-OFFER-0** (esta) contrato de vocabulário · **F-OFFER-1** conter ghosts (501 explícito, sem 42P01/tabela
  fantasma) · **F-OFFER-2** ponte declaração→service · **F-OFFER-3** service_offering (exige service + preço/duração/
  status) · **F-OFFER-4** discovery re-key por `concept_id` · **F-OFFER-5** availability owner=`service_offering` ·
  **F-OFFER-6** conflito cross-oferta do provider.
- **FORA da macro F-OFFER:** slot material concept-keyed · produto/estoque/óleo/peça (→ **F-MATERIAL-CONVERGENCE**,
  frente própria) · presença · dinheiro/payout · RFQ complexo · engine universal · obra multi-etapa.

## §E — NÃO decidido aqui
Desenho material da ponte (F-OFFER-2), implementação de discovery/availability/conflito, qualquer toque em
dinheiro/presença/material. Esta DECISION é **vocabulário**, não execução.

**Supera:** — · **Superada por:** — · **Referências:** DECISION-0142/0117/0122/0121/0113/0132 ·
`docs/orquestracao/processo/cadeia-de-oferta/CONSOLIDADO.md` (Rodada 7) · `docs/orquestracao/sistema/<etapa>/ACHADOS.md`.
