# IA-11 — Comércio/Contract

> RAIO X READ-FIRST do eixo Comércio/Contract. Auditoria macro+micro: contratos comerciais de
> serviço · produto · locação · assinatura; preço; estoque/escassez; visibilidade; seller; handoff
> p/ marketplace e dinheiro; cartório. **Nada corrigido, nada implementado, nada commitado.**

---

## 1. Carimbo

- **HEAD:** `aaeb50b5182120888a72418775a9d211e33bff4d` (`aaeb50b5`) · branch `rescue-structural` — verificado de 1ª mão via `git rev-parse HEAD`. **O HEAD do gatilho/contexto estava STALE** (auditorias anteriores carimbaram `dd270f41`/`9f5e9c5e`); disco venceu.
- **Data/hora:** 2026-06-21 ~21:48 (America/Sao_Paulo).
- **Git status (relevante ao eixo):** nenhuma alteração em código/migrations de comércio no working tree; só memórias (`docs/memorias/MINHA_MEMORIA_*`), `opus.md` e artefatos `??` não-rastreados. **Limpo para código.**
- **READ-ONLY confirmado:** SIM. Nenhum INSERT/UPDATE/DELETE, nenhuma migration, nenhum `SELECT *`, nenhum commit, nenhum toque em backend/frontend/migrations/cartório.
- **Arquivo criado/atualizado:** `docs/memorias/IA-11-COMERCIO-CONTRACT.md` (este; criado).
- **Frontend/backend/schema/docs consultados:** `backend/migrations/*.sql` (offerings, products, inventory, price-nomenclature, F-OFFER-2A/2B/3, unificação semântica v2), `backend/src/modules/{services,marketplace,subscriptions,pdv,events}/*`, `backend/src/core/{availability,catalog,companies,navigation}/*`, `docs/02_decisions/DECISION_010{8,9}_*`/`0110`/`0111`, `REMEDIATION_DECISIONS_LOG.md`, `REMEDIATION_DT_LOG.md`, `docs/01_normative/18_DOMAIN_ONTOLOGY_UNIFICARD.md`, `docs/orquestracao/.../ACHADOS.md`.
- **Comandos/probes usados:** orquestração multi-agente READ-ONLY (ultracode) — **9 auditores paralelos de dimensão** + síntese; cada um revalidou no disco com `Grep/Glob/Read` e citou `file:line`/migration/tabela. **2 agentes não concluíram por limite de sessão da plataforma** (`audit:visibility-contract` e o `synthesize` automático) → a dimensão VISIBILIDADE foi reconstruída transitivamente a partir de SELLER/PRODUCT/SERVICE/MARKETPLACE, e **esta síntese foi escrita à mão** pela IA-11 a partir das 9 saídas estruturadas. Prova-viva de banco (rowcounts, schema aplicado) **não** foi executada → marcada INCONCLUSIVE → **IA-BANCO**.

---

## 2. Escopo

**Auditado (eixo Comércio/Contract):** modelo comercial macro (tipos serviço/produto/locação/assinatura, enums, tabelas, rotas, SSOTs); serviço como contrato comercial (camada comercial, sem aprofundar F-OFFER); produto (tabelas, concept×category, preço, estoque, variantes/SKU, visibilidade); locação; assinatura; contrato de visibilidade; contrato de preço (varredura cents×NUMERIC); escassez/disponibilidade/reserva comparada; seller/provider/company na borda comercial; handoff marketplace; handoff checkout/dinheiro; cartório comercial (RFC-003, DECISION-0108/0109/0110/0111, DTs).

**Fora de escopo (registrado como handoff):** cadastro/auth, perfil/SSOT, actor model completo, autoridade global, empresa/PJ completa, semântica global, F-OFFER profundo, tempo/booking profundo, marketplace inteiro, ledger/split/payout/recovery, frontend inteiro, schema/banco geral. Achados nesses eixos viram handoff (§7).

---

## 3. Mapa macro comercial

Cadeia auditada: `CONCEPT → tipo comercial → provider/seller → item ofertável → visibilidade → seleção → escassez/disponibilidade → handoff dinheiro`.

### SERVIÇO — **FECHA_COM_RISCO**
`concept(FECHA) → canonical_service[concept_id NOT NULL RESTRICT](FECHA) → service[canonical_service_id NOT NULL, F-OFFER-2A](FECHA) → service_offering[service_id NOT NULL RESTRICT, price_cents BIGINT, provider_actor_id, draft-first](FECHA) → visibilidade[active-only/draft-hidden](FECHA) → seleção[by-canonical](FECHA) → disponibilidade[unified_availability owner='service_offering', sem calendário paralelo](FECHA_COM_RISCO: conflito é stub) → handoff dinheiro[camada offering Bank-free](FECHA_COM_RISCO)`. **Risco:** mundo LEGADO paralelo (`services`+`services-discovery`) é 2º SSOT de "oferta de serviço" e move dinheiro direto (fallback 1000 cents), contido só pelo firewall DECISION-0110 (default OFF). Handoff money do caminho canônico **indefinido** (`service_orders` ainda chaveiam em `service_id`).

### PRODUTO — **FECHA_COM_RISCO**
`concept(FECHA) → canonical_products[via unificação semântica v2, concept_id](FECHA) → products[category_id NOT NULL + canonical_product_id; INDUSTRIAL força canônico](FECHA) → product_variants[SKU, dono do estoque](FECHA) → store_product_activations(FECHA) → product_offers[merchant_id NOT NULL FK actor, price_cents BIGINT, RLS](FECHA) → visibilidade[is_active + status soberano](FECHA_COM_RISCO: dupla verdade) → escassez[inventory_movements SSOT append-only + reservations race-safe](FECHA) → handoff[order→payment_intent→executePayment](FECHA, contido)`. **Risco:** dupla verdade `status`(0117)×`is_active`; `order_items` B2C sem snapshot de preço; `_deprecated_tenant_products` ainda existe.

### LOCAÇÃO — **ENUM_ONLY**
`concept(—) → 'rental' [só valor de CHECK em services.service_type + enum TS + template in-memory 'property-rental' v0 + rota STUB /em-desenvolvimento]`. **SEM** tabela, **SEM** rota-handler, **SEM** recurso alocável, **SEM** conflito temporal de recurso, **SEM** preço-por-período real, **SEM** caução/depósito. Não governada por 0109/0110 (excluída explicitamente). Não é "bloqueada" — é **indefinida/diferida**.

### ASSINATURA — **NÃO_FECHA**
Três construtos não-convergidos, nenhum materialmente vivo: (1) engine genérico SPRINT-87 (`modules/subscriptions`) modela ciclo/auto-charge mas a **tabela só existe em `migrations_archive/0194`**, rotas **nunca registradas** (mortas) e **viola money-invariant** (`amount NUMERIC(14,2)` lido por `parseFloat`→`amountCents`); (2) `marketplace Subscription` **in-memory** (Map), rotas TODO, sem DB, sem dinheiro; (3) `organizer_subscriptions` com **dois schemas divergentes** (ativo×archive 0218), rotas contidas a **501** (schema-ghost, DECISION-0113). `access_pass_products` é o entitlement mais próximo (cents BIGINT) mas não é "assinatura recorrente".

---

## 4. Matriz do eixo

| item | fecha/não-fecha | evidência viva | blocker | risco | próxima frente | modo |
|---|---|---|---|---|---|---|
| contrato comercial geral | PARCIAL | tipos distintos por tabela/enum, mas só 2/4 realizados | 4-tipos não fecha | verdade paralela reemergir | DECISION_COMMERCE_CONTRACT | DECISION |
| serviço | FECHA_COM_RISCO | `20260611180000:66-90`; `service-offering.service.ts:120-160` | handoff money canônico indefinido | SSOT legado paralelo | retirar legado / bridge money | MODO C |
| service_offering | FECHA | `20260611180000:66-90`; F-OFFER-3 `20260621120000:20-37` | — | conflito availability stub | — | FAST-PATH |
| produto | FECHA_COM_RISCO | `unificacao_semantica_v2 20260429100000:253-275`; `0122_product_offers.sql` | — | dupla verdade status×is_active | — | MODO B |
| produto preço | FECHA | `product_offers` →`price_cents BIGINT` `20260331150000:16-24` | — | premissa "NUMERIC" do gatilho é STALE | — | FAST-PATH |
| produto estoque | FECHA | `0102:66-84` SSOT append-only; `inventory-reservation.service.ts:142-163` | — | rowcount vivo INCONCLUSIVE→IA-BANCO | — | FAST-PATH |
| produto variantes/SKU | FECHA | `product_variants`+`canonical_variant_id` `20260611180000:62` | — | — | — | FAST-PATH |
| locação | ENUM_ONLY | `services_table_core.sql:14-15`; `module-registry.ts:51` (stub) | bloqueia tipo locação | piggyback no shape de serviço | DECISION_RENTAL_MODEL | DECISION |
| locação recurso | NÃO_FECHA | grep `resource_id/rental_period/due_date` → 0 | sem recurso alocável | — | DECISION_RENTAL_MODEL | DECISION |
| locação disponibilidade | NÃO_FECHA | `availability_owner_type_check:32` exclui rental/resource | sem conflito temporal de recurso | — | DECISION_RENTAL_MODEL | DECISION |
| assinatura | NÃO_FECHA | tabela só em `migrations_archive/0194`; rotas não-registradas | bloqueia tipo assinatura | FANTASMA/CONGELADA | DECISION_SUBSCRIPTION_MODEL | DECISION |
| assinatura recorrência | PARCIAL | engine `subscription.service.ts:271-378` (morto/unwired) | não-wired | NUMERIC(14,2)→parseFloat | DECISION_SUBSCRIPTION_MODEL | DECISION |
| assinatura entitlement | PARCIAL | `access_pass_products` `20260530562000:25-62` (cents OK) | não é recorrência | — | DECISION_SUBSCRIPTION_MODEL | DECISION |
| seller/provider/company | FECHA_COM_RISCO | `product-offering.service.ts:71-75`; `service-offering.service.ts:97-100` | — | KYB não exigido na CRIAÇÃO da oferta | HANDOFF IA-AUTORIDADE | MODO B |
| visibilidade pública | PARCIAL | `offer-index.service.ts:83-91`; `product-visibility.service.ts:140-149` | Caminho A pendente | PF sem KYB visível (legacy) | MODO_B_VISIBILITY_CONTRACT | MODO B |
| active/draft/published | FECHA_COM_RISCO | `services.repository.ts:201`; `product-offering.service.ts:247` | — | dupla verdade status×is_active (sync no writer, não no DB) | — | MODO B |
| marketplace handoff | PARCIAL | `marketplace-checkout.routes.ts:4` (stub) | sem CTA→money vivo | — | HANDOFF IA-MARKETPLACE | MODO C |
| checkout handoff | PARCIAL | `executePaymentPlan` throws `marketplace-orders.service.ts:604-611` | sem checkout vivo | 410/stub | MODO_C_CHECKOUT_BRIDGE | MODO C |
| dinheiro fora/HOLD | HOLD_FINANCEIRO | firewall `service-financial-firewall.ts:18-20` default OFF; `unifycard.routes.ts:36-57` 403 | — | legado discovery 1 flag de mover dinheiro | HANDOFF IA-DINHEIRO | HOLD |
| RFC-003 (price NUMERIC→BIGINT) | FECHA (resolvido no disco) | `20260331150000:16-24`; `tenant_products_drop_price_numeric:50-51` | — | comentário `0122:47` ainda diz "pendente"; 2º RFC-003 (time-service) genuinamente PENDENTE | HANDOFF IA-DECISOES-DT | INCONCLUSIVE |
| DECISION-0108 (produto) | FECHA (governa) | `REMEDIATION_DECISIONS_LOG.md:6671-6685` | — | DT product-concept-guard/Op2 aberto | HANDOFF IA-DECISOES-DT | DECISION |
| DECISION-0109 (serviço track-B bank-free) | FECHA (governa) | `REMEDIATION_DECISIONS_LOG.md:6687-6699` | — | não menciona rental | — | DECISION |
| DECISION-0110/0111 (financeiro serviço) | FECHA (governa, runtime OFF) | `:6701-6728` | runtime DTs OPEN (0 rows) | firewall default OFF | HANDOFF IA-DINHEIRO | HOLD |
| testes existentes | INCONCLUSIVE | não varridos a fundo nesta rodada | — | cobertura comercial não medida | HANDOFF IA-FRONTEND-UX / QA | INCONCLUSIVE |

---

## 5. Achados críticos

**CONTRACT-01 — Contrato comercial 4-tipos só meio-realizado.** Serviço e Produto têm contrato material fechado-com-risco; Locação=ENUM_ONLY; Assinatura=NÃO_FECHA. Evidência: `services_table_core.sql:14-15` (rental/event/job só como `service_type`), `migrations_archive/0194` (subscriptions fora das migrations ativas). Impacto: o invariante "serviço/produto/locação/assinatura são contratos distintos" só vale para 2. **Bloqueia MTP?** Não para o par serviço/produto; **Bloqueia público?** parcial; **Bloqueia dinheiro?** HOLD; **Exige DECISION?** SIM; **YALA?** ao promulgar; **Modo:** DECISION; **Handoff:** IA-DECISOES-DT.

**SERVICE-COM-01 — SSOT paralelo de "oferta de serviço" (legado vs canônico).** Camada canônica (`service_offerings`, FK CONCEPT→SERVICE→OFFERING, draft-first, Bank-free) coexiste com o mundo legado `services`+`services-discovery` que **publica `services` a `active` imediatamente** (`ActorIntent.OFFER_SERVICE`) e **move dinheiro direto** (`services-discovery.service.ts:102,201-206,255-270`, fallback `SERVICE_DISCOVERY_DEFAULT_PAYMENT_CENTS=1000`). Contido por `service-financial-firewall.ts:18-19` (default OFF). Impacto: mesma verdade-negócio com 2 SSOTs + caminho de dinheiro sem split/escrow/KYB a 1 env-flag. **Bloqueia dinheiro?** sim se flag ligar; **Exige DECISION?** SIM (retirar/migrar legado); **Modo:** MODO C; **Handoff:** IA-OFERTA/IA-DINHEIRO.

**MONEY-HANDOFF-01 — Handoff money do serviço canônico indefinido.** `service_orders`/`service_payment_requests` ainda chaveiam em `service_id` (legado); `service_offering_id` é só coluna nullable SET NULL de auditoria (`20260613160000`). Impacto: não existe "minimum testable money path" a partir de um `service_offering` ativo. **Bloqueia MTP?** do caminho canônico de dinheiro: SIM; **Modo:** MODO C; **Handoff:** IA-DINHEIRO.

**PRODUCT-COM-01 — Dupla verdade de estado da oferta de produto.** `status` soberano (DECISION-0117) × `is_active` legado; discovery filtra por `is_active` e a sincronia é **garantida pelo writer, não pelo DB** (`offer-index.service.ts:90`, `product-offering.service.ts:247`). Impacto: divergência possível se um writer escapar. **Bloqueia público?** parcial; **Exige DECISION?** não (cleanup/guard); **Modo:** MODO B; **Handoff:** IA-PRODUTOS-ESTOQUE.

**PRICE-01 — Premissa "produto/locação em NUMERIC" do gatilho está STALE; resíduos reais menores.** No disco, todo preço comercial ativo é cents inteiro: `product_offers.price NUMERIC` foi **dropado** p/ `price_cents BIGINT` (`20260331150000:16-24`), `tenant_products.price` idem (`20260530530000`), `product_prices`/`promotions` idem. **Resíduos reais:** (a) `services.price_cents` é **INTEGER, não BIGINT** (`services_table_core.sql:19`; cap ~R$21,4M; compartilhado por rental/event/job); (b) `subscriptions.amount NUMERIC(14,2)` lavado por `parseFloat`→`amountCents` (código morto/unwired, mas existe); (c) `fiscal_documents.total_amount NUMERIC` (só archive, exceção fiscal consciente, fora do ledger). **Bloqueia dinheiro?** não no caminho vivo; **Modo:** MODO B/cleanup; **Handoff:** IA-DECISOES-DT/IA-DINHEIRO.

**RENTAL-COM-01 — Locação sem substrato material e sem decisão.** Só label de enum + template in-memory + rota stub. Sem recurso+tempo, sem conflito, sem caução. Nenhuma DECISION em todo o cartório menciona rental (grep em DECISIONS_LOG/DT_LOG/ontologia). Impacto: tipo comercial declarado mas inexistente. **Exige DECISION?** SIM (modelo de rental); **Modo:** DECISION; **Handoff:** IA-LOCACOES-RECURSOS/IA-DECISOES-DT.

**SUB-COM-01 — Assinatura fantasma com violação de money-invariant.** Engine completo porém não-wired; tabela em archive; `NUMERIC(14,2)`+`parseFloat`; `organizer_subscriptions` com schema-ghost contido a 501 (DT-MODULE-SUBSCRIPTIONS-FANTASMA / DECISION-0113). **Exige DECISION?** SIM; **Modo:** DECISION; **Handoff:** IA-ASSINATURAS-RECORRENCIA.

**INVENTORY-01 — Estoque correto; escassez de serviço NÃO-enforçada.** Produto: `inventory_movements` append-only SSOT (`0102:66-84`) + `inventory_balances` projeção (`0103:41-45`) + `inventory_reservations` race-safe `FOR UPDATE` fail-closed (`inventory-reservation.service.ts:142-163`); actor_id obrigatório (DECISION-0116). **MAS** serviço: `detect_availability_conflicts()` é **stub que sempre retorna vazio** (`20260530491000:61-78`), conflito só alerta **após** criar a booking e `capacity` nunca é checada (`unified-availability.service.ts:177-191`). Impacto: double-booking temporal não é prevenido no data-layer. **Bloqueia MTP?** risco de integridade; **Modo:** MODO B; **Handoff:** IA-TEMPO.

**SELLER-COM-01 — Borda comercial deriva seller server-side; KYB só na leitura.** Todo write prova autoridade via `canRepresentActor`/`canManageCompany` e trata `actorId`/`companyId`/`storeActorId` do body como HINT (`product-offering.service.ts:71-75`, `service-offering.service.ts:97-100`). **Risco:** KYB **não** é exigido na CRIAÇÃO da oferta — PJ sem KYB grava linha; KYB+publicação-ativa só barram na visibilidade (`product-visibility.service.ts:140-149`); PF (company_id NULL) visível sem KYB ("legacy contract"). **Bloqueia público?** parcial; **Modo:** MODO B; **Handoff:** IA-AUTORIDADE/IA-EMPRESA-PJ.

**VISIBILITY-01 (reconstruído — auditor dedicado não concluiu) — Visibilidade segura no discovery, gaps no write/Caminho A.** Discovery active-only/draft-hidden (serviço+produto); oferta exige `is_active`+seller autorizado. Gaps: KYB-no-write (SELLER-COM-01), dupla verdade status×is_active (PRODUCT-COM-01), Caminho A (ativação pública segura) pendente. **Bloqueia público?** parcial; **Modo:** MODO B; **Handoff:** confirmar com auditor VISIBILIDADE numa próxima rodada + IA-BANCO (prova-viva).

**MONEY-HANDOFF-02 — Dinheiro corretamente em HOLD.** `executePayment()` (escritor real do `bank_ledger`, amount SSOT em `*_cents`, fee via bps) está cabeado mas **inalcançável por CTA de marketplace** (`payment-execution.service.ts:413-436`; só PDV/venue/event/subscription-cycle/automation). Checkout marketplace = stubs/410; serviço execução = 403 firewall OFF; UnifyCard 403/501. **Nenhum tipo chama dinheiro cedo no default.** Classificação: **HOLD_FINANCEIRO**. **Handoff:** IA-DINHEIRO.

---

## 6. Gaps de conexão

- **Comércio ↔ Semântica:** produto converge a `concepts.concept_id` via unificação v2 (`20260429100000:253-275`) — alinhado a serviço (canonical_services.concept_id). **Tensão a confirmar no banco vivo:** rodadas anteriores (Rodada 7, HEAD `9f5e9c5e`) reportaram `canonical_products` como category+`product_concepts` paralelo; a unificação v2 (posterior) parece tê-lo colapsado em `concepts`. → **INCONCLUSIVE → IA-BANCO** (confirmar `concept_id` populado/mandatório e `_deprecated_*` realmente dropadas).
- **Comércio ↔ Marketplace:** itens descobríveis, mas sem ponte viva discovery→checkout→money (stubs/410). Gap de jornada → IA-MARKETPLACE-JORNADA.
- **Comércio ↔ Tempo:** serviço usa `unified_availability` mas o conflito é stub → escassez temporal não-enforçada. Locação não tem owner_type → IA-TEMPO.
- **Comércio ↔ Dinheiro:** handoff de produto existe (order→payment_intent→executePayment); handoff de serviço canônico **indefinido**; assinatura só por worker; locação inexistente → IA-DINHEIRO.
- **Comércio ↔ Autoridade/PJ:** KYB enforçado na leitura, não na criação da oferta → IA-AUTORIDADE/IA-EMPRESA-PJ.
- **Serviço canônico ↔ serviço legado:** dois SSOTs de oferta → risco #1 (verdade paralela) → IA-OFERTA.

---

## 7. Handoffs para outras IAs

- **IA-CADASTRO-ONBOARDING:** store-onboarding prova `canRepresentActor` (ok); confirmar fluxo pós-cadastro de loja.
- **IA-PERFIL-SSOT:** elegibilidade de venda PF lê `actor_professional_concepts`; confirmar SSOT do perfil profissional.
- **IA-ACTOR:** `actor_id` obrigatório em inventory (DECISION-0116); seller/provider/merchant = actor.
- **IA-AUTORIDADE:** KYB-no-write ausente; `canRepresentActor`/`canManageCompany` na borda comercial (mapear gate antes da oferta).
- **IA-EMPRESA-PJ:** PJ sem KYB grava oferta; PF visível sem KYB (legacy). Publicação-de-concept exige KYB no write.
- **IA-SEMANTICA:** confirmar convergência `canonical_products → concepts.concept_id` (unificação v2) e retirada de `product_concepts` paralelo.
- **IA-OFERTA:** SSOT paralelo legado de oferta de serviço; F-OFFER profundo.
- **IA-TEMPO:** conflito de availability é stub; locação sem owner_type/recurso+tempo.
- **IA-MARKETPLACE-JORNADA:** ponte discovery→checkout (stubs/410); cards/filtros por tipo.
- **IA-PRODUTOS-ESTOQUE:** dupla verdade status×is_active; `order_items` sem snapshot de preço; `_deprecated_tenant_products` morto com churn.
- **IA-LOCACOES-RECURSOS:** locação é ENUM_ONLY — precisa de modelo material (recurso+tempo+caução+período).
- **IA-ASSINATURAS-RECORRENCIA:** módulo FANTASMA; NUMERIC violation; 3 construtos não-convergidos; `access_pass_products` é o entitlement vivo.
- **IA-FRONTEND-UX-CONTRATOS:** DTOs de contrato comercial por tipo (CheckoutIntent/Subscription.contract); rota "Locações" é stub.
- **IA-BANCO (prova-viva):** confirmar no banco vivo — `canonical_products.concept_id` populado/mandatório; `_deprecated_*` dropadas; `services.price_cents` tipo (INTEGER×BIGINT); rowcount `inventory_movements` vs `inventory_balances`; trigger append-only habilitado; schema aplicado de `organizer_subscriptions` (ativo×archive).
- **IA-DINHEIRO:** dinheiro HOLD; firewall 0110 OFF; handoff de serviço canônico; legado discovery 1000-cents.
- **IA-DECISOES-DT:** RFC-003 (resolvido no disco mas comentário 0122 stale + 2º RFC-003 time-service pendente); DTs comércio (fee-unit bps, product-concept-guard, subscriptions-fantasma, settlement-regional-fee-bps); DECISION rental/subscription inexistentes.

---

## 8. Riscos para MTP

- **Bloqueia MTP (parcial):** handoff de dinheiro do **serviço canônico** indefinido (MONEY-HANDOFF-01); escassez temporal de serviço não-enforçada (INVENTORY-01) = risco de double-booking.
- **Não bloqueia mas deve ser corrigido:** dupla verdade status×is_active (PRODUCT-COM-01); SSOT paralelo de oferta de serviço (SERVICE-COM-01); KYB-no-write (SELLER-COM-01).
- **V2:** locação (modelo material completo); assinatura recorrente (engine wired + DB + cents).
- **Cleanup:** `_deprecated_tenant_products`; comentário "RFC-003 pendente" em `0122`; `services.price_cents` INTEGER→BIGINT.
- **Exige decisão de produto/arquitetura:** existência e forma de locação e assinatura; retirada do caminho legado de serviço.

---

## 9. Riscos para público e dinheiro

- **Blockers antes de PÚBLICO:** Caminho A (ativação pública segura) pendente; KYB exigido só na leitura (PJ sem KYB grava oferta; PF sem KYB visível); dupla verdade de estado da oferta. *(Auditor VISIBILIDADE dedicado não concluiu — confirmar numa rodada follow-up.)*
- **Blockers antes de DINHEIRO:** handoff money do serviço canônico indefinido; caminho legado de transferência direta (sem split/escrow/KYB, fallback 1000 cents) dormente atrás do firewall default-OFF; assinatura com NUMERIC violation se algum dia for ligada.
- **Blockers por tipo:** serviço (handoff money + SSOT legado); produto (dupla verdade, order_items sem snapshot); locação (substrato inexistente); assinatura (fantasma + NUMERIC).
- **Exige DECISION:** modelo de locação; modelo de assinatura; retirada do legado de serviço; (e o contrato comercial 4-tipos como guarda-chuva).
- **Exige MODO C:** ponte checkout→money do marketplace; bridge offering-serviço→order→money.
- **Permanece HOLD:** todo o motor financeiro (firewall 0110 OFF; UnifyCard 403/501; executePayment fora de CTA de marketplace) — **por desenho, correto**.

---

## 10. Perguntas obrigatórias (respostas)

1. Diferencia serviço/produto/locação/assinatura? **PARCIAL** — tipos distintos por tabela/enum, mas só serviço+produto realizados; rental=ENUM_ONLY, assinatura=NÃO_FECHA.
2. Serviço — contrato comercial material fechado? **PARCIAL** — camada offering FECHA (FK CONCEPT→SERVICE→OFFERING, cents, draft-first, availability bound, Bank-free), rebaixado por SSOT legado paralelo + handoff money canônico indefinido.
3. Produto — contrato comercial material fechado? **PARCIAL** — write path limpo (products→variants→activations→offers, cents BIGINT, autoridade server-side, inventory SSOT); resíduo: dupla verdade status×is_active, order_items sem snapshot.
4. Locação — contrato comercial material fechado? **ENUM_ONLY**.
5. Assinatura — contrato comercial material fechado? **NÃO**.
6. Produtos usam preço em cents/BIGINT? **SIM** — `product_offers.price_cents BIGINT` (`20260331150000:16-24`) e todo preço de produto ativo em cents.
7. Há uso de NUMERIC para dinheiro/preço material? **RISCO** — não no caminho VIVO/transacionável; resíduo: `subscriptions.amount NUMERIC(14,2)`+parseFloat (morto/unwired), `services.price_cents` INTEGER (sub-violação BIGINT), `fiscal_documents` NUMERIC (archive, exceção fiscal).
8. Produto — estoque/inventory confiável? **SIM** — append-only SSOT + projeção + reserva race-safe fail-closed + actor_id obrigatório *(rowcount vivo INCONCLUSIVE→IA-BANCO)*.
9. Locação — disponibilidade/conflito temporal próprio? **NÃO** — sem recurso+tempo, sem conflito; owner_type exclui rental.
10. Assinatura — ciclo/entitlement claro? **PARCIAL** — lógica de ciclo existe (engine) mas não-wired; `access_pass_products` é o entitlement vivo; recorrência não materializada.
11. Visibilidade comercial segura para público? **PARCIAL** — discovery active-only/draft-hidden ok, mas KYB-no-write ausente, PF sem KYB visível, Caminho A pendente.
12. Algum tipo chama dinheiro antes da hora? **NÃO** (contido) — money HOLD; firewall 0110 default OFF; checkout stubs/410; executePayment fora de CTA de marketplace *(risco dormente: legado discovery a 1 flag)*.
13. O eixo bloqueia MTP? **BLOQUEIA_PARCIAL** — par serviço/produto não bloqueia; handoff money do serviço canônico + escassez temporal stub bloqueiam parcialmente.
14. O eixo bloqueia público? **BLOQUEIA_PARCIAL** — visibilidade majoritariamente segura; KYB-no-write + PF-sem-KYB + Caminho A pendentes.
15. O eixo bloqueia dinheiro? **HOLD_FINANCEIRO** — retido por desenho (firewall/containments); caminho canônico de serviço indefinido.

---

## 11. Veredito final

**FECHA_COM_RISCO** — para o **escopo REALIZADO (serviço + produto)**.

A maquinaria do contrato comercial (`concept → tipo → provider/seller → item ofertável → visibilidade → escassez → handoff dinheiro`) está **materialmente presente e disciplinada** para serviço e produto: significado via CONCEPT (FK obrigatórias), seller/provider derivado server-side, preço em cents BIGINT, estoque com SSOT append-only, dinheiro corretamente em HOLD, nenhum item vendável sem semântica/autoridade onde o contrato existe. **Riscos contidos:** SSOT legado paralelo de oferta de serviço (firewalled), dupla verdade de estado de produto, KYB só na leitura, handoff money do serviço canônico indefinido, conflito temporal de serviço não-enforçado.

**Caveat explícito:** o contrato comercial de **4 tipos NÃO está fechado** — **locação = ENUM_ONLY** e **assinatura = NÃO_FECHA** são fronteiras NÃO realizadas e SEM decisão; elas não bloqueiam o MTP do par serviço/produto, mas exigem DECISION antes de existir (não devem ser codadas por impulso — risco #1, verdade paralela).

---

## 12. Próxima frente recomendada

**Primária: `DECISION_COMMERCE_CONTRACT`** (modo DECISION). Justificativa: pela disciplina do MÉTODO (norma antes de opinião; DECISION antes de substrato), os dois tipos ausentes (locação, assinatura) **não podem nascer em código sem decisão**, e um contrato comercial macro (quais tipos existem, que primitivas cada um exige, o que fica fora da MTP, e a retirada do caminho legado de serviço) é o que **impede a verdade paralela de reemergir** — exatamente o RISCO Nº 1 da Carta de Acoplamento. Decide de uma vez rental + subscription + ratifica os contratos realizados de serviço/produto. Pode desdobrar em `DECISION_RENTAL_MODEL` + `DECISION_SUBSCRIPTION_MODEL`.

**Sequência sugerida (insumo, não GO):** `DECISION_COMMERCE_CONTRACT` → `MODO_B_VISIBILITY_CONTRACT` (KYB-no-write + Caminho A, antes de público) → `MODO_C_CHECKOUT_BRIDGE` / bridge serviço-canônico→order→money (antes de dinheiro, sob firewall/GO/Yala). Dinheiro permanece **HOLD** até o ciclo gated.

---

## 13. Resumo executivo

- HEAD vivo `aaeb50b5` (o gatilho citava hash STALE). READ-ONLY, sem edição de código/runtime, sem commit.
- **Serviço e produto = contratos comerciais materiais FECHADOS_COM_RISCO**; concept→tipo→seller→oferta→visibilidade→escassez→handoff presentes e disciplinados.
- **Locação = ENUM_ONLY** (só label/template/stub; zero substrato; zero decisão). **Assinatura = NÃO_FECHA** (fantasma; tabela em archive; rotas não-registradas; viola money-invariant com NUMERIC+parseFloat).
- **Premissas do gatilho STALE:** `product_offers.price NUMERIC` e `tenant_products NUMERIC` **já migrados** para `price_cents BIGINT` no disco (RFC-003 resolvido para tabelas reais; comentário em `0122` ficou stale).
- **Preço:** todo dinheiro comercial vivo em cents/BIGINT; resíduos: `services.price_cents` INTEGER (não BIGINT), `subscriptions.amount` NUMERIC (morto), `fiscal_documents` NUMERIC (archive/exceção).
- **Estoque de produto confiável** (movements SSOT append-only + reserva race-safe fail-closed); **escassez de serviço NÃO-enforçada** (conflito é stub).
- **Seller/provider derivado server-side** (body = hint); **KYB exigido só na leitura**, não na criação da oferta (PJ sem KYB grava; PF sem KYB visível).
- **Dinheiro em HOLD_FINANCEIRO por desenho** — checkout stubs/410, firewall 0110 default OFF, UnifyCard 403/501, executePayment fora de CTA de marketplace; **nenhum tipo chama dinheiro cedo** (risco dormente: legado discovery a 1 flag).
- **Risco #1 (verdade paralela):** SSOT legado de oferta de serviço coexiste com o canônico; handoff money do serviço canônico indefinido.
- **Veredito: FECHA_COM_RISCO** (escopo serviço+produto); **4-tipos NÃO fecha** (rental/subscription exigem DECISION). **Próxima frente: `DECISION_COMMERCE_CONTRACT`.** Prova-viva de banco → **IA-BANCO**.

---

*Auditoria READ-ONLY (ultracode, 9 auditores paralelos + síntese manual da IA-11; 2 agentes não concluíram por limite de sessão — VISIBILIDADE reconstruída transitivamente, síntese escrita à mão). Nenhuma alteração de código/schema/migration/cartório. Insumo, nunca GO.*
