# DECISION-0145 — Régua de vínculo service→service_offering (F-OFFER-3)

**Status:** **PROMULGADA / DOCS-ONLY / DECISÃO ARQUITETURAL / RÉGUA SERVICE→SERVICE_OFFERING** (Clayton 2026-06-21; ChatGPT APPROVED_WITH_GUARDS).
**NÃO** altera `docs/01_normative`. **NÃO** toca runtime/migration/frontend/backend. Precede a execução material (F-OFFER-3A schema + F-OFFER-3B runtime), que só roda após promulgação.

**Data:** 2026-06-21 · **Branch:** `rescue-structural` · **HEAD (pré-commit):** `74a04819` · **dev:** 399/399
· **Tipo:** arquitetural / régua de vínculo+proveniência (docs-only) · **Frente:** F-OFFER (F-OFFER-3)
· **Responsável:** Clayton / IA-DIRETORA (executor: Claude Opus 4.8) · **Ratificação:** Clayton + ChatGPT
(APPROVED_WITH_GUARDS) + READ-FIRST curto F-OFFER-3 (IA-OFERTA FALTA_DECISAO · IA-AUTORIDADE FALTA_DECISAO · IA-BANCO PASS_PARA_GO_DE_DECISAO).

**Deriva de / subordinada a:** **DECISION-0144** (régua declaração→service, já em runtime — a elegibilidade vive no
`service`) · DECISION-0143 (cadeia CONCEPT→SERVICE→SERVICE_OFFERING→AVAILABILITY) · DECISION-0122 (service_offering =
recurso canônico de contratação) · DECISION-0117 (canonical_services) · DECISION-0113 (actorId=hint; autoridade
server-side) · DECISION-0118/0100/0101 (canManageCompany+KYB para PJ).

---

## §0 — Natureza
Régua de **vínculo** entre `service` (descoberta, já 2B-gated) e `service_offering` (oferta contratável). Fecha o
GAP provado no READ-FIRST: hoje `createOffering` liga direto ao `canonical_service` e **nunca popula `service_id`**,
então a elegibilidade da DECISION-0144 (declaração PF / publicação PJ) **não alcança a oferta**. Docs-only; a
materialização ocorre em F-OFFER-3A/3B sob GO próprio.

## §A — A RÉGUA (conteúdo normativo)
1. **`service_offering` PERTENCE a um `service`.**
2. **`service_id` é o vínculo canônico da oferta** (a oferta nasce amarrada ao service).
3. **A oferta NÃO nasce direto do `canonical_service` ignorando o `service`.**
4. **`service_offerings.service_id` é OBRIGATÓRIO** (NOT NULL após preflight).
5. **`service` e `offering` precisam bater `provider` E `concept`** (mesmo `provider_actor_id`; mesmo `concept_id`).
6. **`concept` vem da cadeia material** (`service`→`canonical_service.concept_id`), **NUNCA** de `category`/`domain`/`slug`.
7. **A elegibilidade da 0144 é HERDADA pelo `service`, NÃO duplicada** em `createOffering` (single-chain).
8. **Autoridade continua server-side** (`canRepresentActor`; PJ = `canManageCompany`) — permanece obrigatória, SOMADA ao vínculo.
9. **`company_id`/`provider`/`owner` NÃO vêm do body** — derivados server-side do provider/service.
10. **`professional_actor_id` não pode carimbar company sem gate** — removido da autoridade OU re-gateado materialmente.
11. **A oferta nasce `draft` por padrão.**
12. **`active`/activation é FORA desta fatia** (salvo regra viva segura, expressamente revalidada) — criação ≠ ativação pública.
13. **Preço é campo da oferta, NÃO movimento financeiro.**
14. **Nenhum ledger/split/payout/dinheiro real entra nesta frente.**

## §B — Decisões D3 da oferta (ratificadas)
- **D-F3-1 = Opção A** (§A.1–7): oferta exige `service_id` válido do mesmo provider+concept; herda elegibilidade 2B; não re-implementa apc/ccp.
- **D-F3-2 = ENTRA JUNTO** (§A.9/10): `company_id` derivado server-side; `professional_actor_id` removido/re-gateado (fecha o buraco de proveniência).
- **D-F3-3 = DRAFT por padrão** (§A.11/12): `createOffering` cria `status='draft'`; ativação pública = fatia/regra própria.

## §B-bis — GUARDS DE EXECUÇÃO (ChatGPT, vinculantes; na dúvida, STOP)
- **G1 — `canonical_service_id` na oferta NÃO é autoridade.** Se `service_offerings` ainda tiver `canonical_service_id`, ele deve ser **derivado do `service`** OU **validado contra o `service`** (mesmo concept) — nunca fonte independente de identidade/autoridade.
- **G2 — `status='draft'` respeita o schema VIVO.** Se o CHECK/enum vivo não aceitar `draft`, **STOP_DECISION_REQUIRED** — proibido inventar status novo no runtime sem schema. (Schema vivo já tem CHECK in `draft,active,suspended` — confirmar de 1ª mão.)
- **G3 — `price_cents` é campo contratual, NÃO ledger** — mas é dinheiro representado: **cents/BIGINT, nunca NUMERIC**.
- **G4 — body NÃO autoriza nada.** `professional_actor_id`/`company_id`/`owner`/`provider` vindos do body são input/hint; **só o servidor deriva ou valida** (autoridade = `canRepresentActor` server-side).
- **G5 — `service_id` incerto → STOP.** Se `service_id` inexistir, for ambíguo, nullable com dados incompatíveis, ou a FK não estiver clara → **STOP antes de migration/runtime** (não improvisar).

## §C — Execução material (após promulgação; GO próprio por fatia; MODO B se o READ-FIRST confirmar mesmo elo)
- **F-OFFER-3A (schema):** preflight fail-closed (rowcounts; `service_offerings` vazio/compatível; `service_id` NULL/órfão count; FK `service_id→services`). Se sujo → STOP. Se seguro: `service_offerings.service_id` **NOT NULL** (+ FK RESTRICT se aplicável). **Sem corrigir dado na migration; sem DROP CASCADE.**
- **F-OFFER-3B (runtime):** `createOffering` exige `service_id` válido; o `service` pertence ao provider (server-side); o concept do offering/canonical **bate** com o concept do service; `company_id` derivado server-side; `professional_actor_id` removido/re-gateado; `status` default **draft**; **403/400 controlado** para sem-autoridade / provider-mismatch / concept-mismatch / company-spoof. Guard estrutural + negative-proofs.

## §D — Proibições (vinculantes na execução)
FORA: operador via `actor_capability_grants` · cascata KYB-revoga→retira-oferta · `availability` · discovery/marketplace
· dinheiro/payout · presença · `service_order` · ranking · promoções · estoque/material · activation pública automática
· `docs/01_normative`. Não corrigir dado dentro da migration; não inferir concept por category/domain/slug.

## §E — Gates/provas obrigatórios (na execução material)
3A: preflight + pós-apply (`service_id` NOT NULL; FK) + negative-proof (offering sem service_id → rejeitado) + guard estrutural.
3B: E2E — criar offering COM service válido (mesmo provider+concept) → cria `draft`; SEM service_id → bloqueia; provider-mismatch → 403; concept-mismatch → 403; company-spoof (body) → derivado/ignorado. + negative-proofs (guard morde) + `validate:actor-writer-boundaries`/`bank-ledger-boundaries`/`regression-guards`/`architectural-patterns --strict` + typecheck no_new_errors.

## §F — Fora de escopo / STOP
Se a execução exigir tocar `availability`/discovery/dinheiro/activation pública/grants ou schema inesperado → **STOP** e volta a Clayton/ChatGPT. `service_offerings` vazio (0 linhas) = janela virgem; mudanças baratas agora.

**Supera:** — · **Superada por:** — · **Referências:** DECISION-0144/0143/0122/0117/0113/0118 ·
`docs/orquestracao/processo/cadeia-de-oferta/CONSOLIDADO.md` (READ-FIRST F-OFFER-3, 3 elos) ·
`respostas/IA-OFERTA.md`·`IA-AUTORIDADE.md`·`IA-BANCO.md` (§F-OFFER-3).
