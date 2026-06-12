# DECISION-0117 — Modelo canônico de catálogo, templates empresariais e oferta

**Data:** 2026-06-11
**Tipo:** Produto / Arquitetura (catálogo canônico · variante · serviço · mídia · templates · menu · oferta) — promulgada ANTES do runtime; a implementação ocorre na mesma macrofrente, em commits posteriores a esta norma.
**Status:** PROMULGADA — registra as decisões de produto A–H ratificadas por Clayton no GO integrado `F-CANONICAL-CATALOG-BUSINESS-TEMPLATES-AND-OFFERING-CLOSURE`. Autoriza a execução SOMENTE dentro dos limites do GO (zero Bank writer; zero payment/checkout/booking transacional; provider de mídia de produção FORA; conversão automática de unidades FORA).
**Frente:** `F-CANONICAL-CATALOG-BUSINESS-TEMPLATES-AND-OFFERING-CLOSURE`
**HEAD de origem:** `d865a04d`
**Decisor:** Clayton (decisões de produto A–H ratificadas no GO) / IA Diretora (autorização de execução)
**Deriva de / subordinada a:** `CONSTITUICAO_UNIFICARD`; `LEIS_OPERACIONAIS_UNIFICARD` (Lei 5 — Bank SSOT; Lei 7 — CONCEPT é a única identidade semântica); `07_NOMENCLATURA_CANONICA` (§5.2–5.3 borda camelCase↔snake_case; `*_cents BIGINT`; `is_/has_/can_`; TIMESTAMPTZ); `04_CATEGORIES_SSOT` (categoria classifica, nunca decide); `18_DOMAIN_ONTOLOGY` (N0/N1/N2 = navegação, não identidade); `DEFINICAO_DE_PRODUTO.MD` (INDUSTRIAL × LOCAL; variante = execução); `SERVICE_CANONICO.md`; DECISIONs `0097`–`0109` (dois momentos PJ; par primary_*; publicação soberana KYB-gated 0099/0100/0101; CNAE evidência 0103/0104; domain multi-camada 0105; MarketplaceDomain→N0 0106; concept_labels 0107; elegibilidade por ramo 0108; serviços Bank-free actor-level 0109); `DECISION-0113` (actorId = hint; sujeito = `req.user`); `DECISION-0116` (+A1/A2 — inventory `ACTOR_PRIVATE`, consolidado `COMPANY_INTERNAL`); RFC_SEMANTIC_SIGNALS_ONBOARDING_BRIDGE (gatilho v1 manual-assistido: proposta `pending` + «Aplicar» explícito).
**Vinculada a:** `DT-INVENTORY-PRODUCT-VISIBILITY-TENANT-WIDE-STOCK-PROJECTION` (OPEN — resolução autorizada nesta frente); `DT-COMMERCIAL-PRICE-FEDERATED-SSOT` (OPEN — fora do corte); `DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN` / `DT-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK` (OPEN — fora do corte, 0102 §13); DT de ponte company/page-actor na criação de serviço (resolvida materialmente nesta frente via offerings).

---

## 0. Reancoragem do contrato histórico C.1–C.34 (honestidade documental)

O eixo normativo "catálogo universal" foi historicamente redigido em `PRODUTO_PLANO_MESTRE_COMPLETO.md` (v1.9, contrato C.1–C.34, EIXO 9). **Esse arquivo não existe no repositório nem no histórico git** (em nenhum dos nomes conhecidos, incluindo `EXECUTAR/STAND_BY_*`). Esta DECISION **não finge tê-lo encontrado e não copia conteúdo não comprovado**. Ela reancora APENAS os contratos comprovados materialmente no repositório vivo:

- **C.1 (comprovado em código):** cadeia semântica única `product → canonical_product → CONCEPT`, estado READY, resolução via adapter (`concept-offer-refs.adapter.ts`, `canonical-product-readiness.ts`). Nenhum atalho por categoria/sinal substitui essa cadeia.
- **Fase 2B (comprovada e reconciliada em 2026-04-11):** visibilidade canônica `global ∪ scoped` — `(scope='scoped' AND tenant_id=ctx) OR (scope='global' AND tenant_id IS NULL)`, helper único `sqlCanonicalIdMatchesTenantContext`, desempate scoped-first.
- **C.22 (comprovado como gate vivo):** `check:canonical-gates` — proibição de `cp.tenant_id = $` como filtro único de visibilidade.
- **C.25 (comprovado como pendência honesta):** sem lista fechada aprovada em `C.25_SPEC.md`, CI **não** opina sobre inferência. Esta frente NÃO fecha C.25.
- **EIXO 9 § Media (comprovado como caixa de decisão humana):** a política de mídia global aguardava decisão humana explícita — **suprida agora pela Decisão C abaixo**.

Tudo o mais que o plano órfão continha permanece **não-reancorado** até recuperação ou re-promulgação específica.

## 1. Decisões de produto promulgadas (A–H, ratificadas por Clayton)

### A — CONCEPT, produto, variante e oferta
- **CONCEPT** é a única identidade de SIGNIFICADO (refrigerante; arroz; corte de cabelo masculino). Lei 7 intocada.
- **`canonical_products`** (substrato vivo, PRESERVADO) é a identidade MATERIAL compartilhada de uma família de produto. Não pertence a empresa; **não guarda preço; não guarda estoque empresarial**.
- **`canonical_variants`** (nova camada material) é a configuração exata que distingue o item vendável (ex.: Coca-Cola Original · 1 L · garrafa · retornável). Eixos discriminadores dependem da categoria e podem incluir: marca, linha, sabor, volume, peso, unidade, embalagem, retornabilidade, tamanho, cor, modelo, versão, composição, GTIN/EAN. **Eixos discriminadores são tipados, validados e participam do fingerprint da variante — não podem viver apenas em JSON livre irrelevante à identidade.** GTIN distinto ⇒ variante distinta.
- A empresa **não cria produto semântico para vender**: referencia o canônico/variante, **ativa** sua relação e **cria sua oferta**. A oferta empresarial contém: page actor/empresa, variante canônica, SKU interno, preço (`price_cents BIGINT`), estoque (actor-scoped), disponibilidade, condições, localização, entrega/retirada, status, publicação. **Preço pertence à oferta. Estoque pertence ao actor/empresa.**

### B — Criação e moderação canônica
- INDUSTRIAL/global: empresa **sugere**; pipeline procura duplicatas (GTIN/fingerprint); duplicata existente é oferecida como vínculo; caso novo entra **`pending`**; **curador humano** (papel explícito; sem system actor improvisado) aprova / rejeita / vincula a item existente / solicita correção / mescla duplicata. **Empresa não cria diretamente canônico global READY.**
- LOCAL/artesanal: nasce tenant/company-scoped, sem GTIN obrigatório, com dedup local, usável apenas no escopo autorizado; **promoção a global exige curadoria humana**.
- **Nenhum writer comercial cria ou cura actor humano** (regime PJ-B3 estendido à família de catálogo).

### C — Mídia canônica e empresarial
- Mídia canônica pertence ao produto/variante/serviço CANÔNICO; é reutilizável e **content-addressed**: hash, MIME, magic bytes, scanner, origem, autoria, licença, versão, estado de moderação, trilha auditável. **Reenvio do mesmo conteúdo NÃO cria novo blob.**
- Mídia empresarial é complemento específico (oferta/empresa/estabelecimento/execução), **não substitui silenciosamente a canônica** e fica isolada por empresa/actor.
- Arquitetura por **port** (molde `document-storage` PJ: MIME→magic→scan→storage opaco→persist, com compensação). **Provider de produção fica FORA desta macrofrente**; provider local/dev deve ser funcional e testável. `canonical_products.images JSONB` deixa de ser SSOT (pode permanecer como projeção transitória marcada).

### D — Serviço canônico
- CONCEPT segue sendo o significado. **`canonical_services`** (nova) é a identidade material compartilhada: aponta obrigatoriamente para CONCEPT, guarda apenas atributos-base governados (ex.: duração-base quando semanticamente aplicável), relaciona mídia canônica; **não guarda preço empresarial nem agenda empresarial**.
- **`service_offerings`** (oferta de serviço): empresa/actor prestador + serviço canônico + preço (`price_cents`) + duração efetiva + profissional executor quando aplicável + modalidade + local + área atendida + condições + **Unified Availability** (referência; nunca calendário paralelo) + status + publicação.
- Booking transacional completo e pagamento permanecem FORA (DECISION-0109 intocada). Taxonomia/ramo de serviços já fechados são preservados.

### E — Templates empresariais
- Template empresarial é **canônico, versionado, governado, auditável e composto por REFERÊNCIAS** (recortes de categorias/concepts/módulos existentes). **Nunca copia centenas de produtos automaticamente; nunca vira SSOT dos dados empresariais.**
- Aplicação é **manual-assistida** (RFC vigente): usuário vê a recomendação, escolhe e confirma «Aplicar»; o sistema registra template, versão, empresa, actor aplicador, timestamp e módulos/recortes aplicados. Aplicar habilita módulos/recortes, disponibiliza catálogo recomendado e projeta menu — **não cria ofertas, não cria estoque, não cria preço, não move dinheiro, não concede autoridade**.
- Empresa personaliza a composição depois. Alteração futura do template **não reescreve silenciosamente** empresas existentes (gera, no máximo, sugestão explícita de atualização).

### F — Menu transversal
- Existem **duas navegações distintas**: (1) navegação de CATÁLOGO — segue derivada da ontologia N0/N1/N2 (`/navigation/n2`, contexts, category relations); (2) menu de MÓDULOS — deriva de **registry backend governado** considerando actor, vínculo, capability, lifecycle, KYB, template/módulos aplicados e rota realmente viva.
- **Menu não concede autoridade**; o backend revalida toda ação. Frontend não inventa permissão, categoria, módulo, lifecycle, autoridade nem rota. Rotas mortas não aparecem como operacionais; rotas vivas autorizadas não ficam escondidas por arrays divergentes.

### G — Merge e duplicatas
- Merge canônico é **ato humano/curatorial, auditado, append-only**: preserva autoria e referências históricas, **não destrói ofertas**. Modelo `duplicate_of`/redirect: referências ao item antigo continuam resolvendo para o canônico vencedor. **Proibido rewrite destrutivo de história.**

### H — Unidades e conversões
- Unidades são **canônicas** (registry mínimo: un, kg, g, l, ml, pacote, caixa, lote, garrafa-comercial; com dimensão, símbolo, precisão, compatibilidade).
- **Valores de unidades incompatíveis não são somados; preços com bases incompatíveis não são comparados como equivalentes; retornável ≠ descartável; kg ≠ un; litro ≠ garrafa sem contrato explícito.** Sem conversão canônica: separar, informar ou **falhar fechado**. **Conversão automática fica FORA desta macrofrente.**

## 2. Declarações estruturais (síntese vinculante)

1. **Empresa cria OFERTA, não significado.**
2. **Produto e serviço canônicos são COMPARTILHADOS** (identidade única; N ofertas).
3. **Templates são REFERÊNCIAS VERSIONADAS**, nunca cópia nem SSOT empresarial.
4. **Menu é PROJEÇÃO, não autoridade.**
5. **ZERO financeiro**: nenhum writer Bank, payment intent, split, payout, recovery, settlement ou refund nesta frente. `bank_ledger` segue a única verdade de saldo.

## 3. Limites (o que esta DECISION NÃO faz)

Não abre carrinho/pedido/checkout/booking transacional/pagamento; não cria provider de produção de mídia; não implementa conversão automática de unidades; não reabre DECISIONs 0097–0109/0113/0116; não fecha C.25; não reconcilia MarketplaceDomain↔N0 (frente própria, 0102 §13); não declara marketplace econômico completo; não libera R2/FASE 6.

## ADENDO A1 — Implementação integral da macrofrente (2026-06-11, factual)

**Não reabre as decisões A–H** — registra a implementação na MESMA macrofrente, em commits seriais sobre `a664eeb0` (commit 0 desta DECISION):

- **CP1 (`9ab5233c`)** — migration `20260611150000`: `canonical_units` (registry H, 11 unidades), `canonical_variants` (eixos discriminadores tipados no fingerprint; GTIN ⇒ identidade; nome = rótulo com fallback só sem eixo material), `canonical_services` (concept obrigatório domain `servicos`; seed global `corte-de-cabelo-masculino`), `canonical_catalog_events` (append-only por trigger), `duplicate_of_*` (merge G), `services.canonical_service_id`; concepts seed governado (`refrigerante-de-cola`, `corte-de-cabelo-masculino`). Sugestão empresarial (`/catalog/governance/products/suggestions|local|services/suggestions`) nasce scoped+unresolved+fila; curadoria humana admin (`/catalog/governance/curation/*`: approve/reject/merge/promote); writer de `services` exige canônico ATIVO. Dedup: GTIN → fingerprint → marca NORMALIZADA (acento/caixa). E2E efêmero **35/35**.
- **CP2 (`e551e581`)** — migration `20260611160000`: `media_assets` (sha-256 UNIQUE; reenvio NUNCA duplica blob), relações canônicas produto/variante/serviço (attach curatorial pós-moderação) e `business_media` (complemento isolado por actor via canRepresentActor); pipeline MIME→magic→scan→storage opaco→INSERT com COMPENSAÇÃO (molde document-storage PJ). `images` JSONB deixa de ser SSOT. E2E efêmero **20/20**.
- **CP3 (`d44ceade`)** — migration `20260611170000`: `business_templates`/`business_template_versions` (imutáveis; composição por REFERÊNCIA a slugs governados)/`company_template_applications` (template+versão+empresa+actor+timestamp+módulos; idempotente; personalização sem tocar o template; v2 não reescreve aplicações); seeds: company_type `distribuidora-de-bebidas` (+concept `comercio-distribuicao-bebidas`+par allowed_concepts) e 3 templates (supermercado amplo · distribuidora recorte bebidas · salão serviços+agenda). E2E efêmero **15/15**.
- **CP4 (`70d3df6b`)** — migration `20260611180000`: ofertas variant-aware (`product_offers.canonical_variant_id`/`internal_sku`/`sale_unit`/`min_quantity`/`conditions`/`fulfillment`/`status`; UNIQUE legada → parciais por presença de variante, tabela vazia), ativação com variante+SKU+unidade, PONTE `product_variants.canonical_variant_id` (estoque continua SSOT em `inventory_movements` por actor), `service_offerings` (prestador×canônico; preço/duração/profissional/modalidade; disponibilidade na Unified Availability com owner `service_offering` — zero agenda paralela). **`products/visible` corrigido**: estoque do MERCHANT da oferta + unidade consistente + defesa direta KYB/publicação no reader — **`DT-INVENTORY-PRODUCT-VISIBILITY-TENANT-WIDE-STOCK-PROJECTION` FECHADA** (regressão vigiada no gate de inventory, check 3c). E2E efêmero **16/16**.
- **CP5 (`2bc06e73`)** — `module-registry` governado (LIVE/STUB/TOMBSTONE; contexts; requisitos de template/KYB) + projeção `GET /navigation/modules` (membership ativa; módulos por template aplicado; STUB/TOMBSTONE nunca operacionais; menu NÃO concede autoridade); `GlobalSidebar` consome a projeção (NAV_GROUPS/PILOT_HIDDEN_ROUTES hardcoded absorvidos; fallback honesto); busca agrupada por IDENTIDADE (`/marketplace/catalog/items/search` + `/items/:id/offers` — 1 item → N ofertas; menor preço POR unidade); navegação de catálogo (`/navigation/n2`) intocada. Legados em memória com caller vivo = KNOWN_OPEN auditado. E2E efêmero **13/13**.
- **CP6 (commit F desta entrega)** — E2E INTEGRADO `validate-pipeline-e2e-canonical-catalog-templates-offering.ts` **21/21** (3 empresas por nascimento real + KYB controlado; Coca-Cola Original 1L retornável = 1 concept/1 canônico/1 variante/1 mídia; reuso de blob; 2 ofertas com SKUs/preços/estoques próprios; busca 1-item→2-ofertas; isolamento 403+imutável; serviço 2 prestadores/agendas na Unified Availability; menus por contexto; revogação KYB de A retira SÓ A — canônico/mídia/oferta de B permanecem; suspensão de oferta de serviço retira só ela; kg+un fail-closed; bank_* snapshots idênticos; storage sem resíduo). Gate `audit-canonical-catalog-closure.mjs` no `validate:regression-guards` (61 CLOSED_CANONICAL / 5 KNOWN_OPEN / 0 / 0 / 0) + **8 provas negativas** com restauração byte-idêntica sha-verificada.

Resíduos OPEN honestos: provider de mídia de produção · conversão automática de unidades · booking transacional/pagamento · system actor institucional definitivo · MarketplaceDomain↔N0 (0102 §13) · legados marketplace em memória (caller vivo; substituto canônico vivo em `/marketplace/catalog/items/*`) · `product_prices` ghost · price federation global (DT-COMMERCIAL-PRICE-FEDERATED-SSOT).

## ADENDO A2 — Separação blob físico × asset lógico de mídia (2026-06-12, factual; correção do reseal Yala)

**Não contraria a Decisão C — MATERIALIZA-A.** O reseal adversarial da Yala reprovou um único
bloqueador: a implementação inicial de CP2 acoplou a dedup física global (`content_hash` UNIQUE em
`media_assets`) ao registro lógico de autoria/tenant/origem/licença/moderação — tenant B que
enviasse os mesmos bytes HERDAVA o asset (e a metadata) do tenant A, e o file reader servia blob
sem prova de visibilidade (DT-CANONICAL-MEDIA-CROSS-TENANT-METADATA-AND-FILE-LEAK).

Correção (frente `F-CANONICAL-MEDIA-BLOB-ASSET-TENANT-ISOLATION-CLOSURE`, migration
`20260612090000_media_blob_asset_separation.sql`, aditiva forward-only):

- **`media_blobs` (camada FÍSICA)** — `content_hash` **UNIQUE GLOBAL** (a invariante "reenvio do
  mesmo conteúdo NÃO cria novo blob" da Decisão C vive AQUI), MIME/tamanho/referência opaca.
  SEM tenant, actor, moderação, licença ou source — blob/hash/storage_reference NÃO são recursos
  autorizáveis.
- **`media_assets` (camada LÓGICA)** — referencia o blob (`media_blob_id` FK RESTRICT) e carrega
  origem/autoria/licença/moderação POR TENANT/ACTOR ("origem, autoria, licença, versão, estado de
  moderação" da Decisão C vivem AQUI). Tenants distintos com os mesmos bytes = assets lógicos
  DISTINTOS sobre o MESMO blob; reenvio idempotente SÓ no mesmo contexto (UNIQUE parcial
  blob+tenant+actor criador).
- **Leitura/attach autorizados** — arquivo/metadata visíveis SÓ para: canônica pública (approved
  + vinculada a entidade canônica — o attach curatorial é o ato explícito de publicação), contexto
  do criador (canRepresentActor), ou curador admin; cross-tenant privado = 404 sem oráculo.
  `attach/business` exige asset do próprio contexto OU canônico público. Projeção pública sem
  autoria/origem/storage/hash.
- **Compensação ref-count-safe** — blob compartilhado JAMAIS é apagado em falha de INSERT
  (`deleteBlobIfUnreferenced`: DELETE guardado por NOT EXISTS + FK RESTRICT).

Provas: e2e adversarial permanente `validate-pipeline-e2e-media-tenant-isolation.ts` **25/25**
(2 tenants por HTTP real) · CP2 ampliado **26/26** · integrado **21/21** · gate com checks 6a–6i
(o check antigo que EXIGIA o anti-padrão foi substituído) · provas negativas 6/6 novas + 8/8
originais. `business_media` pública via lifecycle de oferta permanece superfície futura (hoje:
owner/representável).

## 4. Referências

GO integrado `F-CANONICAL-CATALOG-BUSINESS-TEMPLATES-AND-OFFERING-CLOSURE` (Clayton/IA Diretora, 2026-06-11); READ-FIRST consolidado da mesma frente (3 trilhos, HEAD `d865a04d`); `docs/02_decisions/SEMANTIC_CATALOG_GOVERNANCE.md`; `docs/02_decisions/C.25_SPEC.md`; `docs/02_decisions/RFC_SEMANTIC_SIGNALS_ONBOARDING_BRIDGE.md`; `docs/03_execution_log/2026-04-09_produto_plano_mestre_completo_v1.9_eixo9.md`; `docs/03_execution_log/2B_reconciliation.md`; schema vivo (`canonical_products`, `product_offers.price_cents BIGINT`, `inventory_movements.actor_id`, `availability`); DECISIONs e DTs listadas no cabeçalho.
