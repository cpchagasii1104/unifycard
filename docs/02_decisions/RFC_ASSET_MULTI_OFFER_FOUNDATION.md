# RFC_ASSET_MULTI_OFFER_FOUNDATION — item real do actor com camadas de modo ativáveis

**Status:** PROPOSTA (docs-only) — aguarda ratificação de Clayton. NENHUM código/migration/tabela/frontend.
**Data:** 2026-07-08 · **Decisor:** Clayton · **Precede:** implementação forward-only em fatias (só com GO).
**Origem:** auditoria F-ASSET-MULTI-OFFER-FOUNDATION (READ-ONLY, 4 varreduras + query) confirmou duplicação
estrutural iminente. **Deve preceder a Fase C** (que liga necessidade→serviço/recurso→proposta→execução).

---

## 0. Prova normativa (00_AGENT_PROTOCOL §2.2/§2.3 · Lei de Coerência · SSOT)

- **Domínio:** ontologia/CONCEPT + recursos/ativos + locação + produtos/venda + serviços/mobilidade.
- **SSOT:** `concepts.concept_id` = identidade semântica ("o que é"). O item físico NÃO vira CONCEPT.
- **Lei de Coerência:** nenhuma camada cria realidade paralela. Hoje o MESMO carro pode virar 3 cadastros
  (locação/venda/rides) sem ponte — violação a corrigir com o sistema virgem.
- **Suficiência:** compõe de padrões vivos (concept_offer_kinds como aplicabilidade; availability polimórfica
  por owner_type). Não inventa mecânica nova.

## 1. Diagnóstico resumido (da auditoria, provado por query)

- **NÃO existe** entidade de item físico compartilhada (`actor_assets`/`assets`/`inventory` comum = ausente).
- **4 silos sem cross-reference:** LOCAÇÃO `rentable_resources` (item+oferta misturados; concept_id, sem
  placa/serial; ~24/34 cols de termos de locação) · VENDA `products`+`product_offers`+`product_variants`+
  `inventory_*` (catálogo tenant-scoped; concept indireto) · MOBILIDADE `rides_vehicles` (placa/renavam/crlv
  — a ÚNICA identidade física forte — mas siloada a driver, brand/model texto-livre, sem FK ao catálogo) ·
  SERVIÇO `services`/`service_offerings` (só actor+concept+capability, ZERO vínculo a item).
- **Aplicabilidade só no CONCEPT:** `concept_offer_kinds`/`concept_rentable_types` dizem o que o TIPO suporta,
  nunca o que uma UNIDADE real oferta. **Falta a camada de modo no nível do ITEM.**
- **Catálogo ≠ unidade:** `vehicle_makes/models/years/specs` = referência global, não o carro do actor.
- **Espinha reutilizável:** `availability` já é polimórfica por owner_type (aceitaria `actor_asset`).
- **Δbank=0** preservável: preços são anúncio; Bank real só em rides_rides (execução, fora daqui).

## 2. Modelo recomendado (4 camadas)

```
A. CONCEPT (concepts)                    "o que é"            — INALTERADO, SSOT semântico
B. ITEM/ATIVO (actor_assets)             "qual unidade real"  — NOVO, uma linha por item físico
C. MODOS ATIVADOS (actor_asset_modes)    "o que o dono faz"   — NOVO, ativação governada (oferta OU estado)
   └ termos por modo (ricos)             locação: pricing/handoff/mileage… → camada própria por asset_id
D. ACORDO/EXECUÇÃO                        compra/reserva/corrida/contrato/Bank — FORA desta fundação
```

- **`actor_assets`** = a UNIDADE real: `asset_id`, `owner_actor_id` (FK actors), `concept_id` (FK concepts —
  identidade semântica, item NÃO é concept), `label`, identidade física via **atributos GOVERNADOS**
  (placa/serial/ano/cor — nunca texto-livre como verdade; p/ veículo, referência ao catálogo
  vehicle_models/year, não string solta), `status`. availability futura por owner_type='actor_asset'.
- **`actor_asset_modes`** (NEUTRO — a distinção que Clayton levantou): `(asset_id, mode)` onde
  `mode ∈ ASSET_ACTIVATION_MODES` (vocab governado). **Nem todo modo é oferta pública:** venda/locação são
  OFERTA; uso interno/manutenção/reservado são ESTADO/capacidade. Por isso a tabela é "modos ativados",
  NÃO "asset_offers". Termos ricos de cada modo (ex.: locação) vivem em camada dedicada por asset_id.

## 3. Nomes físicos candidatos (07_NOMENCLATURA — snake_case, plural, FK `<entidade>_id`)

- **`actor_assets`** (ratificado) — o item real.
- Camada de ativação: **`actor_asset_modes`** [RECOMENDADO — neutro, cobre oferta E estado] · alternativas:
  `asset_offers` (rejeitado: nem todo modo é oferta) · `asset_activation_modes`.
- Vocab governado: **`ASSET_ACTIVATION_MODES`** (const + manifest + CHECK que compõe do vocab).
- Camadas de termos ricos (fatias futuras): `actor_asset_rental_offer` (convergência de rentable_resources) ·
  `actor_asset_sale_offer` · etc. Nome final fixado na fatia de cada modo.

## 4. Modos — v1 e futuros

- **Núcleo v1 (ASSET_ACTIVATION_MODES inicial):** `sale` (oferta) · `rental` (oferta) · `service_use` (uso
  operacional em serviço — capacidade, não oferta pública) · `internal` (uso interno não publicado — estado).
- **Futuros (modelo não pode IMPEDIR, mas NÃO implementar agora):** `ride_use` · `consignment` · `trade` ·
  `donation` · `dismantle_parts` · `maintenance` (indisponível) · `reserved` (bloqueado). Ampliar o vocab
  por decisão própria; a estrutura `(asset_id, mode)` já os acomoda sem tabela nova por modo simples.

## 5. Pontos obrigatórios (respostas de desenho)

1. **Item ≠ oferta:** `rentable_resources` divide-se — identidade (concept/owner/ano/placa/label) → `actor_assets`;
   termos (pricing/handoff/mileage/cleaning) → camada `rental` por asset_id.
2. **Catálogo ≠ unidade:** `vehicle_models` segue catálogo global; `actor_assets` REFERENCIA o modelo/ano
   (governado), não duplica specs nem usa texto-livre.
3. **rides_vehicles:** converge — a identidade física (placa/renavam/crlv) migra para `actor_assets`
   (concept=veículo) + modo `ride_use`/`service_use`; rides passa a apontar asset_id (fatia própria).
4. **Venda:** vender uma UNIDADE usada do actor = `actor_assets` + modo `sale` (não recadastrar). O catálogo
   de produtos novos (GTIN/canonical_products) segue para comércio de novos — fronteira: unidade-do-actor vs
   catálogo-de-mercadoria; RFC de fatia esclarece.
5. **Locação:** vira CAMADA (`rental`) de um asset, não a identidade do item.
6. **Uso operacional:** `service_offerings` poderá apontar o asset usado (modo `service_use`) SEM virar
   produto/locação — vínculo governado, não fusão.
7. **CONCEPT preservado:** `actor_assets.concept_id` FK; item físico não vira CONCEPT.
8. **Categoria preservada:** `category_id` = navegação; NÃO decide vendável/locável/operacional (isso = CONCEPT+asset+mode).
9. **Bank preservado:** preço de venda/locação = atributo de oferta (anúncio); movimento financeiro FORA.

## 6. Opções de migração — comparação + recomendação

| Opção | O que é | Impacto migrations/API/front | Risco | Virgem? | Veredito |
|---|---|---|---|---|---|
| A | rentable_resources VIRA a base de asset | menor migração, mas item herda schema de locação | carrega sujeira histórica de locação para dentro do item; mistura item+oferta continua | ok | ❌ não |
| B | NOVO `actor_assets`; rentable_resources vira camada `rental` apontando asset_id | migração maior mas LIMPA; front/API por fatia | forward-only; separa item de oferta de vez | **ideal p/ virgem** | ✅ **RECOMENDADO** |
| C | manter silos, só guard anti-duplicação | zero migração agora | dívida CRESCE quando Fase C ligar recurso→proposta | ok curto prazo | ❌ adia o erro |

**Recomendação: Opção B** — item real primeiro, modos como camadas; aproveitar o sistema virgem para
separar item de oferta agora, forward-only, em fatias.

## 7. Plano de migração em fatias (cada uma com GO próprio; rota nova começa pelo contrato)

1. **Fundação:** `actor_assets` + `actor_asset_modes` + vocab `ASSET_ACTIVATION_MODES` + guards. (sem migrar silos)
2. **Locação → camada:** rentable_resources converge (identidade→asset; termos→rental layer por asset_id).
3. **Rides → asset:** rides_vehicles converge (placa/docs→asset; ride_use mode; rides aponta asset_id).
4. **Venda de unidade usada:** modo `sale` sobre asset (fronteira com catálogo de novos).
5. **Uso operacional:** vínculo governado service_offering→asset (service_use), sem fusão.
Cada fatia: contrato-primeiro p/ rotas, guard+mutação, Δbank=0, prova, Yala.

## 8. Guards previstos

Falhar se: venda e locação criarem item físico PARALELO (ambos devem referenciar asset_id) ·
rentable_resource/product_offer/rides_vehicle virar identidade PRIMÁRIA do item · vehicle_catalog virar
unidade física · category decidir modo de oferta · frontend criar lista local de modos · asset mode tocar
Bank · serviço usar item sem vínculo governado (quando a fatia exigir). Cada um por mutação.

## 9. Escopo PROIBIDO (STOP desta RFC e das fatias até GO)

Sem código/migration/DB/frontend nesta RFC. Não tocar locação/produtos/rides/service_demands/RFQ/booking/
agenda/Bank/pagamentos. Não implementar todos os modos. Não abrir Fase C.

## 10. Decisões pendentes de Clayton (ratificar antes de código)

- [ ] Nome da camada de ativação: `actor_asset_modes` (recomendado) vs `asset_activation_modes`.
- [ ] Modos v1: sale/rental/service_use/internal — confirmar conjunto inicial.
- [ ] Opção de migração: **B** (recomendada) vs A vs C.
- [ ] Identidade física em `actor_assets`: atributos governados dedicados (placa/serial/ano) vs facets jsonb
  governado — decidir a forma canônica (07_NOMENCLATURA).
- [ ] GO para a **Fatia 1 (fundação)** forward-only — e ordem das fatias seguintes.
- [ ] Confirmar: RFC ANTES da Fase C (recomendado).
