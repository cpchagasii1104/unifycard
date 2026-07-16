# ADENDO DE DECISÃO — F-ASSET-MULTI-OFFER-FOUNDATION · FATIA 4 · SERVICE_USE / USO OPERACIONAL

**Tipo:** Adendo docs-only (ratificação de decisão soberana antes de implementar).
**Status:** RATIFICADO por Clayton/Guardião. Implementação AGUARDA GO próprio (começar por Fatia 4B).
**Base:** HEAD `fb2a9a25d` · Fatia 1 SELADA · Fatia 2b (locação) SELADA · Condição+mínimo SELADA · Fatia 3
(venda) SELADA · READ-FIRST da 3ª camada entregue. `service_use` já reservado em `ASSET_ACTIVATION_MODES` +
CHECK `chk_actor_asset_mode_value`. **Não existe ainda tabela/fluxo vivo de service_use.**
**Vínculo:** executa o §5-BIS de [[RFC_ASSET_MULTI_OFFER_FOUNDATION]]. Irmão de
[[RFC_ASSET_CONDITION_AND_RENTAL_MINIMUMS_ADENDO]] e [[RFC_ASSET_SALE_TERMS_ADENDO]].
**Δbank=0. Sem execução/booking/pagamento/split/contrato financeiro/telemetria falsa.**

---

## Definição canônica

`service_use` = **uso operacional do bem real**: o `actor_asset` ACOPLADO a `operador + capacidade/serviço +
arranjo econômico`. O bem NÃO vira serviço — o serviço nasce da COMBINAÇÃO (asset + actor operador + concept de
serviço + regra operacional). Manter o símbolo `service_use` (selado); definir precisamente = uso operacional
(NÃO renomear para `operational_use` — custo ratchet).

**Diferença material vs rental:** rental = "entrego o bem; o locatário usa". service_use = "o bem entra numa
OPERAÇÃO econômica com alguém HABILITADO para operá-lo" (posse + trabalho geram renda, possivelmente partilhada).

## Três blocos que NÃO se misturam

1. **Ontologia base** — asset + capacidade + operador + arranjo (D-A..D-G).
2. **Viabilidade econômica** — advisory: "é recomendado agora?" (D-H..D-M).
3. **Localidade/logística** — onde o bem está, onde opera, custo de ida/volta (D-N..D-P).

---

## Decisões ratificadas — BLOCO 1 (ontologia)

### D-A — Nome físico da junção
`actor_asset_service_usages`. É JUNÇÃO **N** (asset × service_concept × operator × arranjo), **NÃO 1:1** como
`actor_asset_sale_terms`/`actor_asset_rental_terms`. Rejeitados na v1: `service_offering_assets`
(offering-cêntrico), `actor_asset_service_links` (vago).

### D-B — O que a junção referencia
`concept + operador`, **não** `service_offering` obrigatório. Shape conceitual: `asset_id` + `service_concept_id`
+ `operator_actor_id` + `arrangement_type` + termos operacionais (anúncio). `service_offerings` continua a
verdade da oferta VIVA de serviço; service_use NÃO transforma asset em serviço nem força criar offering na v1.

### D-C — Dono-operador e terceiro-operador (UMA tabela)
Uma única tabela com `operator_actor_id`. Subcasos DERIVÁVEIS por comparação:
- **Dono-operador:** `operator_actor_id = actor_assets.owner_actor_id`.
- **Terceiro-operador:** `operator_actor_id ≠ actor_assets.owner_actor_id`.
NÃO criar duas tabelas.

### D-D — Release/permissão do terceiro-operador (dupla prova)
Terceiro-operador exige: (1) o DONO libera o asset; (2) o OPERADOR é habilitado para a capacidade/serviço.
**Reusar `actor_capability_grants`** como substrato de release/permissão (escopado ao asset/dono, revogável,
status active/revoked/expired/suspended), com novo `capability_key` governado candidato **`asset:operate`**.
NÃO inventar mecanismo paralelo de vetting.

### D-E — v1 declarativa
**Inclui:** vínculo asset+service_concept+operator · ativação `actor_asset_modes('service_use')` · status do
vínculo · arranjo operacional como anúncio · release/permissão (terceiro-operador) · habilitação do operador.
**FORA da v1:** aceite bilateral rico · contrato financeiro · booking operacional · pagamento · split ·
execução de corrida/serviço · reputação viva · cálculo financeiro real.

### D-F — Vocabulário v1 de arranjo operacional
`OPERATIONAL_ARRANGEMENTS = ['daily_fee','shift_fee','fixed_fee','commission','revenue_share']`. Registrar que
mobilidade/equipamentos exigirão suporte FUTURO a: mínimo garantido · uso incluído · excedente por km/hora ·
política de combustível · política de responsabilidade. Arranjo = anúncio/termo — NÃO cobrança/ledger/Bank.

### D-G — Read-model/pilar dedicado
`countActiveServiceUses` (nome canônico escolhido). NÃO contar service_use em `service_offerings` (não é SSOT do
uso operacional do asset). Lê `actor_assets` + `actor_asset_modes('service_use')` + `actor_asset_service_usages`.

## Decisões ratificadas — BLOCO 2 (viabilidade advisory)

### D-H — Viability states
Camada ADVISORY governada. `VIABILITY_STATES v1 = ['available_to_model','experimental','manual_review',
'not_recommended','viable','mature']`. Viabilidade NÃO é status do asset, NÃO é activation_mode, NÃO é lifecycle.

### D-I — Onde mora a viabilidade
Política/advisory, preferencialmente ligada ao `economic-policy-engine` (ou política governada por região/
categoria/operação). A usage pode referenciar/cachear o veredito, mas NÃO é a única fonte da política. NÃO
hardcodar viabilidade no frontend/service.

### D-J — Default de viabilidade
Conservador: `experimental` ou `manual_review`. NÃO presumir `viable`/`mature` em rede imatura.

### D-K — Viabilidade NÃO bloqueia ontologia (invariante-chave)
**Possibilidade ontológica ≠ recomendação operacional.** Um service_use pode existir como vínculo modelável e ao
mesmo tempo estar `experimental`/`manual_review`/`not_recommended`. Viabilidade INFORMA/RECOMENDA; NUNCA é CHECK
que impede a ativação ontológica.

### D-L — Mobilidade: km-only proibido
Para mobilidade (carro para motorista/app), arranjo SÓ por quilometragem é INVÁLIDO como regra recomendada.
Modelo correto: mínimo por tempo bloqueado + faixa de uso incluída + excedente por km/hora +
combustível/responsabilidade. Motivo: km-only permite mau uso (bloqueia o bem muito tempo com pouco retorno ao dono).

### D-M — Indicadores v1 vs deferidos
v1 modela variáveis e políticas, mas NÃO inventa telemetria inexistente (anti verde-mentira).
**Modelável agora:** retorno mínimo do dono · lucro mínimo esperado do operador · parâmetros de piso · parâmetros
de excedente · tipo de arranjo · viabilidade declarada/advisory.
**Deferido (sem substrato vivo):** demanda real · receita média real · reputação viva · risco por histórico ·
benchmark automático tipo Uber · telemetria regional madura.

## Decisões ratificadas — BLOCO 3 (localidade/logística)

### D-N — Localidade/raio/reposicionamento = variável futura
São variáveis futuras de viabilidade/logística, NÃO bloqueio da v1. service_use deve nascer sem IMPEDIR: raio
operacional · custo de deslocamento vazio · local de retirada · local de devolução · quem paga reposicionamento
· viabilidade por bairro/cidade/região.

### D-O — Origem do asset
A origem/localidade do bem é DERIVADA de `address_assignments` com `owner_type='actor_asset'`. NÃO criar origem
paralela na usage. `asset_id` carrega a origem — NÃO duplicar endereço/bairro/cidade/coordenada em
`actor_asset_service_usages`.

### D-P — Reposicionamento = dimensão futura de arranjo
Quem paga deslocamento, taxa de retirada/devolução e custo de reposicionamento são dimensões FUTURAS de arranjo,
compondo do precedente da locação: `delivery_radius_km` · `delivery_fee_cents` · `collection_fee_cents` ·
handoff methods. Tudo como anúncio/política. Δbank=0.

---

## Invariantes gerais (registrar)

1. `actor_assets` continua identidade única do bem real.
2. service_use ativa `actor_asset_modes('service_use')` no MESMO asset_id.
3. service_use NUNCA cria novo `actor_asset` para asset existente.
4. service_use NÃO toca `actor_asset_sale_terms`.
5. service_use NÃO toca `actor_asset_rental_terms`.
6. service_use NÃO usa `products`/`product_offers`/`inventory`.
7. service_use NÃO transforma asset em serviço.
8. `service_concept_id` deve ter `offer_kind='service'` (concept_offer_kinds).
9. `service_concept_id` nunca vem de category ou texto livre.
10. `operator_actor_id` deve estar habilitado para o `service_concept_id`.
11. PF usa `actor_professional_concepts` (is_active + KYC-lite).
12. PJ usa `company_concept_publications` (status='active' + KYB).
13. terceiro-operador exige release/permissão do dono (`actor_capability_grants`).
14. viabilidade é advisory (não bloqueia ontologia).
15. localidade compõe de `address_assignments` do asset.
16. Bank/split/checkout/orders/payment_intents/ledger ficam FORA.
17. availability/conflito temporal fica fora da primeira fatia (só registro conceitual).
18. frontend rico fica fora sem GO explícito.

## Guards futuros (a implementação deve falhar se…)

- service_use criar novo `actor_asset` para asset existente;
- service_use for modelado como 1:1 terms (em vez de junção N);
- asset virar serviço;
- service_concept vier de `category_id` ou texto livre;
- service_concept não tiver `offer_kind='service'`;
- operador não for validado/habilitado;
- terceiro-operador não tiver release do dono;
- `actor_capability_grants` for bypassado no terceiro-operador;
- service_use tocar Bank/ledger/payment/split/checkout/orders;
- service_use tocar sale_terms/rental_terms indevidamente;
- service_use usar products/product_offers/inventory;
- service_use duplicar `condition`;
- service_use duplicar endereço/origem do asset;
- service_use hardcodar arranjos/status/viabilidade no frontend;
- read-model contar service_use em `service_offerings`;
- viabilidade virar CHECK que bloqueia ontologia;
- mobilidade permitir km-only sem piso de tempo;
- default presumir `mature`/`viable` sem política.

## Slicing recomendado (implementação NÃO em bloco único)

- **Fatia 4B — substrato mínimo:** `actor_asset_service_usages` + ativação modo service_use + validação de
  asset/service_concept(offer_kind='service')/operador(habilitado) + RLS FORCE + guards. Δbank=0.
- **Fatia 4C — terceiro-operador/release:** `actor_capability_grants` + `capability_key asset:operate` +
  revogação/status + dupla prova.
- **Fatia 4D — arranjos operacionais:** `OPERATIONAL_ARRANGEMENTS` + minimum/overage policy + no km-only para
  mobilidade + sem Bank.
- **Fatia 4E — viabilidade advisory:** `VIABILITY_STATES` + economic-policy-engine + default conservador + sem
  telemetria falsa.
- **Fatia 4F — localidade/reposicionamento:** compor de `address_assignments` + sem origem duplicada +
  política local-first + sem Bank.

**Primeira codificação = SÓ Fatia 4B (substrato mínimo do link N).** Viabilidade/localidade/Bank ficam
registrados para não bloquear o futuro, mas NÃO entram na primeira implementação.

---

## STOP deste adendo
Docs-only. Nenhum código, migration, frontend, contrato ou banco tocados. A implementação começa apenas com GO
próprio, começando pela Fatia 4B, seguindo D-A..D-P, os invariantes e os guards acima.

## Ratificação Clayton (2026-07-10) — GO da Fatia 4B (substrato mínimo, item-a-item)

- [x] **GO explícito dado**, escopo cravado item-a-item ANTES de codificar (10 itens permitidos + lista de
  escopo proibido — ver REMEDIATION_DT_LOG.md, entrada "FATIA 4B SERVICE_USE / USO OPERACIONAL").
- [x] **Fatia 4B — EXECUTADA E PROVADA (docs+migration+módulo próprio+guard+prova runtime real, 2026-07-10):**
  `actor_asset_service_usages` (junção N, D-A) + FK composta offer_kind='service' (D-B) + v1 SOMENTE
  dono-operador (D-C/D-D — terceiro-operador/`asset:operate` NÃO implementado, fica fora do endpoint vivo até
  a Fatia 4C) + `OPERATIONAL_ARRANGEMENTS`/`ASSET_SERVICE_USE_STATUSES` governados (D-E/D-F) +
  `countActiveServiceUses` (D-G, sem wiring de frontend/actor-page-block) + habilitação do operador reusando
  `evaluateOfferingActivationEligibility` (sem trilho paralelo, invariantes 10-12) + RLS ENABLE+FORCE + guard
  `audit-asset-service-use-convergence.mjs` (152º da suíte) + prova runtime real (9 asserções, fixture+teardown,
  `src/scripts/e2e-asset-service-use-fatia-4b.ts`). Δbank=0. Zero frontend.
- [x] **SELADA · OFICIALMENTE ENCERRADA (2026-07-16):** Yala material aprovou o material `05649a35b` (SELO COM
  RESSALVA — ressalvas só de processo/docs) → remediação docs-only `348204be7` (entrada própria no cartório +
  errata sobre `e1d26afae` + API catalogada na §5 do API_CONTRACT_GOVERNANCE) → Yala limitada confirmou
  ressalvas sanadas (`1c9910215`) → registro final de encerramento com GO explícito de Clayton (docs-only, sem
  nova Yala). Ver entrada da 4B em REMEDIATION_DT_LOG.md. Próxima com GO próprio: Fatia 4C
  (terceiro-operador/release).
