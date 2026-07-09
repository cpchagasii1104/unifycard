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
- **`actor_asset_modes`** = SÓ ATIVAÇÃO econômica/operacional: `(asset_id, mode)` onde
  `mode ∈ ASSET_ACTIVATION_MODES` (vocab governado). É "modos ativados", NÃO "asset_offers" (nem todo modo é
  oferta pública: venda/locação são oferta, `service_use` é capacidade operacional). **🔴 MODO ≠ ESTADO
  (ajuste Clayton):** `internal`/`maintenance`/`reserved` NÃO entram aqui — são estado/disponibilidade/execução.
  **Ausência de modo ativo = item INTERNO/não publicado** (não precisa de modo `internal`). Lifecycle básico
  do item = `actor_assets.status` (active/inactive/archived, vocab SEPARADO se necessário). Manutenção/reserva
  = camada de disponibilidade/agenda/execução (fora desta fundação). Termos ricos de cada modo (ex.: locação)
  vivem em camada dedicada por asset_id.
- **`actor_assets` (shape mínimo Fatia 1):** `asset_id`, `tenant_id`, `owner_actor_id` (FK actors),
  `concept_id` (FK concepts), `label`, `status`, `metadata`/facets GOVERNADO p/ identidade física, timestamps.
  **Explícito:** placa/RENAVAM/VIN/serial/ano/cor/km NÃO viram texto-livre decisório genérico; para veículos,
  os campos próprios (placa/RENAVAM têm peso de identidade física forte) são decididos na FATIA rides/veículo,
  via campos dedicados ou facets governados — nunca string solta como verdade.

## 3. Nomes físicos candidatos (07_NOMENCLATURA — snake_case, plural, FK `<entidade>_id`)

- **`actor_assets`** (ratificado) — o item real.
- Camada de ativação: **`actor_asset_modes`** [RECOMENDADO — neutro, cobre oferta E estado] · alternativas:
  `asset_offers` (rejeitado: nem todo modo é oferta) · `asset_activation_modes`.
- Vocab governado de MODOS: **`ASSET_ACTIVATION_MODES`** = `['sale','rental','service_use']` na v1 (const +
  manifest + CHECK que compõe do vocab). NÃO inclui internal/maintenance/reserved.
- Vocab de STATUS (SEPARADO, só se necessário): **`ASSET_STATUSES`** (ex.: active/inactive/archived) — NÃO
  misturar com os modos. Estado do item ≠ ativação de modo.
- Camadas de termos ricos (fatias futuras): `actor_asset_rental_offer` (convergência de rentable_resources) ·
  `actor_asset_sale_offer` · etc. Nome final fixado na fatia de cada modo.

## 4. Modos — v1 e futuros

- **Núcleo v1 (ASSET_ACTIVATION_MODES) = SÓ MODOS de ativação:** `sale` (oferta) · `rental` (oferta) ·
  `service_use` (item ACOPLADO a serviço/capacidade/prestador — vínculo governado, NÃO oferta solta do item;
  ver §5-BIS). **`internal` REMOVIDO da v1** — ausência de modo ativo JÁ significa item interno/não publicado;
  não há modo `internal`.
- **Futuros MODOS (não implementar agora, modelo não impede):** `ride_use` (fica para a FATIA rides, NÃO v1) ·
  `consignment` · `trade` · `donation` · `dismantle_parts`. Ampliar o vocab por decisão própria; `(asset_id,
  mode)` acomoda sem tabela nova por modo simples.
- **NÃO são modos (são ESTADO/disponibilidade — fora de actor_asset_modes):** `internal` (= sem modo) ·
  `maintenance` (indisponibilidade operacional) · `reserved` (efeito de agenda/reserva/execução). Tratados por
  `actor_assets.status` (lifecycle) + camada de disponibilidade/agenda/execução — nunca como "modo".

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

## 5-BIS. Service use: asset + prestador + capability (adendo obrigatório — Clayton 2026-07-08)

**Regra estrutural:** `service_use` NÃO é "item disponível para uso" nem oferta autônoma do item. É o item
**ACOPLADO a um serviço/capacidade/prestador**. A diferença canônica:
- item entregue SOZINHO → `rental` (ex.: alugar carro sem motorista; alugar equipamento de pintura).
- item VENDIDO → `sale` (ex.: comprar o carro).
- item USADO por alguém para EXECUTAR um serviço → `service_use` (ex.: pedir motorista COM carro; equipamento
  de pintura + pintor executando; piscina de bolinha + equipe que monta e opera a festa).

**O que `service_use` NÃO faz (invariantes):**
- NÃO cria serviço novo · NÃO transforma asset em serviço · NÃO substitui `service_offerings` nem
  `actor_professional_concepts` · NÃO vira texto livre · NÃO usa `category` como serviço · NÃO toca Bank ·
  NÃO cria booking/agenda/RFQ/service_demands nesta fundação.

**O que `service_use` É:** um VÍNCULO GOVERNADO (camada futura) entre:
- `asset_id` (o item);
- o serviço/capacidade governado — `concepts` + `concept_offer_kinds.offer_kind='service'` (a capacidade
  prestável), compondo com `actor_professional_concepts` (PF) / `company_concept_publications` (PJ) e/ou
  `service_offerings` (o trilho vivo de oferta de serviço, se for o caminho);
- o PRESTADOR/OPERADOR — actor com autoridade (canRepresentActor), NUNCA inferido de user/session solto;
- regras futuras de disponibilidade/execução (fora desta fundação).

**Nomes físicos candidatos (avaliar na fatia futura, NÃO decidir agora):** `service_offering_assets` ·
`actor_asset_service_links` · `actor_asset_service_usages`. Critério: o nome deve deixar claro que o asset é
RECURSO usado por um serviço/prestador, NÃO a identidade do serviço.

**Invariante que a Fatia 1 NÃO pode bloquear (registrar já):** *"`service_use` público/executável exige
vínculo governado com serviço/prestador"*. A Fatia 1 pode listar `service_use` no vocabulário de modos, mas o
VÍNCULO completo (asset↔serviço↔prestador) é fatia própria — a fundação só precisa não impedir esse desenho.

## 5-TER. Fronteira de elegibilidade: só bem durável (asset ≠ produto) (adendo obrigatório — Clayton 2026-07-08)

**Regra:** `actor_assets` é SÓ para **bem durável, identificável e reutilizável** — NÃO para qualquer produto
do marketplace. Asset NÃO é sinônimo de produto.
- **ENTRAM (durável):** carro, bicicleta, sofá, imóvel/apartamento, videogame, ferramenta, equipamento,
  máquina, caixa de som, piscina de bolinha, furadeira. Podem ativar `sale`/`rental`/`service_use`.
- **NÃO ENTRAM (consumível/perecível):** alimento, perecível, bebida de consumo, ingrediente, remédio
  consumível, descartável, produto de giro comum, estoque vendável por SKU/lote sem unidade durável
  individual. Seguem no trilho `products`/`product_variants`/`inventory_*`/lote — NÃO recebem rental/service_use.

**Critério de elegibilidade (pelo menos):** (1) DURABILIDADE — não é consumido imediatamente no uso;
(2) IDENTIFICABILIDADE — reconhecível como unidade, mesmo sem placa/serial; (3) REUTILIZAÇÃO — pode ser
usado/alugado/vendido-usado/empregado em serviço; (4) CONTROLE DE DISPONIBILIDADE — pode ficar disponível/
indisponível/reservado/em manutenção. Não passou → não é `actor_asset`.

**Governança da elegibilidade = CONCEPT, nunca category.** A elegibilidade é uma APLICABILIDADE do CONCEPT
(candidato a nome: `concept_asset_eligibilities` — a decidir no RFC/fatia, espelho de concept_offer_kinds/
concept_rentable_types). CONCEPT governa se o tipo é asset-elegível; `category_id` só organiza navegação e
NÃO decide durabilidade/elegibilidade. Fronteira: durável → pode ser asset multi-modo; consumível → fica
product/inventory/lot/SKU.

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

## 7-BIS. FATIA 2 — Adendo de decisão: convergência de locação (Clayton 2026-07-08)

READ-FIRST provou (query): rentable_resources=0 · rental_resource_pricing=0 · actor_assets=0 ·
availability(rentable_resource)=0 → **convergência FORWARD-ONLY pura, zero backfill de linhas, sem dado real**.
`rentable_resources` hoje MISTURA item (~10 cols) + oferta de locação (~20 cols). Decisões fixadas ANTES do código:

**D1 — Availability → `owner_type='actor_asset'`.** A disponibilidade pertence ao ITEM físico, não à oferta.
Se o carro está alugado seg-sex, não pode simultaneamente estar em service_use/test-drive/venda. rental USA a
disponibilidade do asset; sale/service_use/futuros respeitam a MESMA unidade. Sem agendas paralelas por modo
sem decisão futura. NÃO abre booking/agenda-avançada/RFQ/execução — é só autoridade da disponibilidade.

**D2 — Split canônico item ↔ termos.**
- FICA em `actor_assets` (identidade da unidade): tenant_id · owner_actor_id · concept_id · label · status ·
  descrição física da unidade · dados físicos governados · resource_year (quando é característica do item) ·
  localização-base do item (se houver) · facets/metadata físicos SÓ como transição governada.
- FICA na camada rental (termos): pricing_unit · price_cents · tiers · quantity ofertada · booking_approval_mode ·
  start/end_handoff_method · delivery_radius_km · delivery_fee · collection_fee · handoff_time_start/end ·
  mileage_policy · included_km · extra_km_fee · rental_modality · cleaning_fee_policy/cents · visibility · audience ·
  regras comerciais · pickup/delivery (termo de oferta, não identidade).
- NUNCA identidade: category_id · preço · audiência · visibility · regra de entrega/limpeza/aprovação · booking · Bank.
  (category_id só navegação — nunca identidade/elegibilidade/modo.)

**D3 — Granularidade (equipamento fungível).** Padrão: **1 actor_asset = 1 unidade física individual** quando
identificável (carro/apartamento/videogame/bicicleta/furadeira específicos). Bens duráveis homogêneos repetidos
(50 cadeiras, 20 mesas iguais) = **1 actor_asset representando o CONJUNTO/POOL, com `quantity` nos TERMOS de
locação** — `quantity` NÃO vira identidade semântica. Se cada unidade precisa de manutenção/serial/histórico/
rastreio individual → N actor_assets. Isso NÃO autoriza perecível/consumível/SKU comum a virar asset.

**D4 — Nome da camada rental.** RECOMENDADO (base virgem): **`actor_asset_rental_terms`** — deixa claro que
contém TERMOS de locação, aponta `asset_id`, e para de tratar `rentable_resources` como se fosse o item real.
Alternativa (só se alto custo técnico): manter `rentable_resources` como nome TRANSITÓRIO, mas documentado como
NÃO-identidade e com `asset_id` NOT NULL obrigatório. **Recomendação: nome canônico agora** (virgem).

**D5 — Reconciliação das 3 camadas de concept.** Regra a promulgar: **todo concept `rentable` é asset-elegível**
(só bem durável se aluga). Query (2026-07-08) dos **42 rentables ainda sem asset-eligibility**: 21 bens-imoveis
(imóveis/espaços: galpao/loja/kitnet/quadra-esportiva/terreno/vaga-de-garagem/estúdio…) + 21 produtos-e-comercio
(equipamentos: andaime/compressor/martelete/serra/projetor/tenda/torre-de-iluminacao…). **Classificação: TODOS
duráveis por natureza; ZERO perecível/ambíguo.** → backfill dos 54 rentables em `concept_asset_eligibilities`
JUSTIFICADO. Se no futuro algum concept rentable NÃO for durável, corrigir no `offer_kind`, não forçar para asset.
`concept_rentable_types` (natureza física) segue governado por concept; `category_id` nunca decide.

**D6 — Contrato/API.** A implementação da Fatia 2 COMEÇA PELO CONTRATO se alterar rota/payload. A criação futura
de locação cria, em TRANSAÇÃO: (1) actor_asset; (2) actor_asset_modes activation_mode='rental'; (3) camada de
termos (`actor_asset_rental_terms`); (4) vínculos de endereço/availability conforme D1. Frontend = cadastro
ÚNICO do item + ativação de locação. **Ainda NÃO implementar.**

## 8. Guards previstos

Falhar se: venda e locação criarem item físico PARALELO (ambos devem referenciar asset_id) ·
rentable_resource/product_offer/rides_vehicle virar identidade PRIMÁRIA do item · vehicle_catalog virar
unidade física · category decidir modo de oferta · frontend criar lista local de modos · asset mode tocar
Bank · item duplicado em rides/products/rentable em vez de referenciar asset_id.
**Guard de `service_use` (adendo §5-BIS):** falhar se `service_use` for ativado/publicado SEM serviço/
capability concept · aceitar texto livre como serviço · usar `category_id` como serviço · asset virar service
ou service virar asset · prestador/motorista inferido de user/session sem actor/authority. Cada um por mutação.
**Guard de ELEGIBILIDADE (adendo §5-TER):** falhar se alimento/perecível/consumível entrar em `actor_assets` ·
product SKU comum virar asset sem elegibilidade governada · `rental`/`service_use` for habilitado para concept
não-durável (não asset-elegível) · `category_id` for usado para decidir durabilidade/elegibilidade · frontend
criar lista local de tipos elegíveis. Elegibilidade vem de CONCEPT (applicability), nunca de category.
**Guards da FATIA 2 (§7-BIS — locação):** falhar se camada rental existir SEM `asset_id` · locação criar item
paralelo fora de `actor_assets` · rental ativado p/ concept não asset-elegível OU sem `offer_kind='rentable'` ·
`concept_rentable_types` divergir do concept locável · `category_id` decidir locável/elegibilidade · preço
entrar em `actor_asset_modes` · Bank entrar em actor_assets/actor_asset_modes/rental terms · availability
continuar em `owner_type='rentable_resource'` após a decisão D1 (salvo transição documentada) · frontend criar
lista local de modos · products/rides/service_use tocados nesta fatia · Fase C aberta. Cada um por mutação.

## 9. Escopo PROIBIDO (STOP desta RFC e das fatias até GO)

Sem código/migration/DB/frontend nesta RFC. Não tocar locação/produtos/rides/service_demands/RFQ/booking/
agenda/Bank/pagamentos. Não implementar todos os modos. Não abrir Fase C.

## 10. Ratificação Clayton (2026-07-08) — direção aprovada + ajuste MODO≠ESTADO registrado

- [x] Modelo asset-first aprovado (CONCEPT / actor_assets / actor_asset_modes = ativações econômicas/
  operacionais / acordo-execução-Bank fora).
- [x] Nome `actor_assets` aprovado.
- [x] Nome `actor_asset_modes` aprovado (melhor que asset_offers — nem todo modo é oferta pública).
- [x] Opção B aprovada como direção (novo actor_assets; locação/venda/rides convergem por asset_id; NÃO
  transformar rentable_resources no próprio asset).
- [x] RFC ANTES da Fase C confirmado.
- [x] **AJUSTE OBRIGATÓRIO registrado:** MODO ≠ ESTADO. ASSET_ACTIVATION_MODES v1 = `sale`/`rental`/
  `service_use` (sem `internal`). `internal`/`maintenance`/`reserved` saem dos modos (estado/disponibilidade;
  ausência de modo = interno/não publicado). `ride_use` = futuro/fatia rides, não v1. Status separado
  (ASSET_STATUSES) se necessário.
- [x] **ADENDO OBRIGATÓRIO registrado (§5-BIS):** `service_use` = item ACOPLADO a serviço/capacidade/
  prestador (vínculo governado com concepts+offer_kind='service'+actor_professional_concepts/company_pub/
  service_offerings + actor/authority), NÃO oferta solta do item; não cria serviço, não vira texto-livre/
  category, não toca Bank/booking/RFQ. Invariante: "service_use público/executável exige vínculo governado
  com serviço/prestador" — a Fatia 1 não bloqueia esse desenho. Nomes de vínculo a avaliar na fatia futura.
- [x] **ADENDO ELEGIBILIDADE registrado (§5-TER):** `actor_assets` só p/ bem DURÁVEL/identificável/reutilizável
  (carro/ferramenta/imóvel/equipamento…), NÃO consumível/perecível (alimento/bebida/SKU-de-giro seguem
  products/inventory). Elegibilidade governada por CONCEPT (applicability, candidato `concept_asset_
  eligibilities`), NUNCA por category. Asset ≠ produto.
- [x] **Fatia 1 (fundação) — IMPLEMENTADA E SELADA (Yala)** em HEAD 2ac6c94a (registro c9d4e21c). MODO≠ESTADO +
  §5-BIS + §5-TER cravados; enforcement material por FK de elegibilidade.
- [x] **Fatia 2 — ADENDO DE DECISÃO registrado (§7-BIS):** D1 availability→owner_type='actor_asset' · D2 split
  item↔termos · D3 granularidade (1 asset=1 unidade; conjunto=1 asset+quantity nos termos) · D4 nome
  `actor_asset_rental_terms` (recomendado) · D5 rentable⊆asset-elegível (42 rentables classificados = todos
  duráveis; backfill dos 54 justificado) · D6 contrato-primeiro. Sistema virgem (0 linhas) = forward-only puro.
- [ ] **PENDENTE:** GO para IMPLEMENTAR a **Fatia 2** (convergência de locação), forward-only, contrato-primeiro,
  com as decisões §7-BIS. Fatias seguintes (rides/venda/service_use) por GO próprio.
- [x] **Fatia 2b (convergência de locação) — IMPLEMENTADA E SELADA (Yala)** em HEAD `58d20fcc2` (registro
  docs-only `66e437d30`). `rentable_resources` deixou de ser fonte viva de identidade da locação.
- [x] **ADENDO F-ASSET-CONDITION-AND-RENTAL-MINIMUMS registrado (docs-only) e IMPLEMENTADO+SELADO (Yala, HEAD
  `07f6536c3`):** condição do item novo/usado (`actor_assets.condition`, vocab `ASSET_CONDITIONS=['new','used']`,
  NULL na v1) + re-homing do mínimo de locação de `actor_assets.metadata` → colunas governadas de
  `actor_asset_rental_terms` (`min_rental_quantity`/`min_rental_unit`, reusa `MIN_RENTAL_UNITS`). Ver
  [[RFC_ASSET_CONDITION_AND_RENTAL_MINIMUMS_ADENDO]].
- [x] **Fatia 3 — VENDA ASSET-FIRST IMPLEMENTADA E SELADA (Yala, impl `a63eb8bcb` + 3R `cd1990390`; registro
  docs-only `fb2a9a25d`):** camada `actor_asset_sale_terms` + modo `sale`; PF **e** PJ via
  `canRepresentActor(owner_actor_id)` (DECISION-0155/PJ-only fica em produto/estoque); `ASSET_SALE_STATUSES=
  ['active','paused']`; módulo próprio `src/modules/asset-sale`; 3R = `assetId` existente ATIVA sale no MESMO
  actor_asset (rental+sale coexistem, sem duplicar). Ver [[RFC_ASSET_SALE_TERMS_ADENDO]].
- [x] **Fatia 4 — ADENDO SERVICE_USE / USO OPERACIONAL registrado (docs-only):** 3ª camada = uso operacional do
  bem (asset + operador + capacidade/serviço + arranjo). Junção **N** `actor_asset_service_usages` (D-A; não
  1:1); referencia concept(offer_kind='service')+operador, não offering obrigatório (D-B); UMA tabela dono/
  terceiro-operador (D-C); release via `actor_capability_grants` + `asset:operate` (D-D); v1 declarativa (D-E);
  `OPERATIONAL_ARRANGEMENTS` (D-F); `countActiveServiceUses` (D-G); viabilidade ADVISORY `VIABILITY_STATES` que
  NÃO bloqueia ontologia (D-H..D-M, km-only proibido p/ mobilidade); localidade/reposicionamento deferidos,
  origem derivada de `address_assignments` (D-N..D-P). Δbank=0. Slicing 4B..4F; 1ª codificação = SÓ 4B. Ver
  [[RFC_ASSET_SERVICE_USE_OPERATIONAL_ADENDO]]. Implementação AGUARDA GO próprio.
