# API_CONTRACT_GOVERNANCE — governança de contrato de API HTTP (backend/)

> **Status:** criado 2026-07-08 pela microfrente **F-API-CONTRACT-GOVERNANCE-RECOVERY**.
> **Origem:** o `docs/01_normative/00_AGENT_PROTOCOL.md` §2.2.8 EXIGE ler/aplicar este documento ao criar/alterar
> rotas HTTP, mas o arquivo **nunca existiu** (git history vazio — gap sistêmico pré-existente, não deleção).
> A Yala flagrou como `CONTRACT-GOVERNANCE-MISSING` ao auditar `F-SHARED-SUBJECT-CONCEPT-POOL`. Este doc é a
> correção mínima: fixa a cadeia de contrato + checklist + catálogo de contratos, coerente com o protocolo e
> com o **padrão vivo** do repositório. Seguindo o precedente de `DECISION_0117`: não finge conteúdo que não
> existe; reancora apenas o que é materialmente verdadeiro no repo vivo.

## 1. Precedência (não revoga a norma institucional)

`docs/01_normative/` (Constituição, Leis, SSOT, ontologia) é a **única** autoridade normativa institucional e
**não** é substituída por este documento de backend. Este doc governa **apenas** a cadeia de contrato de API
HTTP dentro de `backend/`, subordinado ao `00_AGENT_PROTOCOL.md` §2.2.8.

## 2. A cadeia canônica: **contrato → domínio → Fastify → documentação**

Qualquer mudança de comportamento de API HTTP **começa pelo contrato**, **depois** código. É **proibido**
inverter: Swagger/OpenAPI gerado ou código não substituem o contrato como fonte da verdade. O "contrato" aqui
é o **contrato mínimo** catalogado na §5 deste documento (método, caminho, autoridade, entrada, saída,
autoridade semântica/SSOT). Um contrato OpenAPI 3 YAML é aceitável quando o fluxo o exigir, mas o catálogo
mínimo abaixo é o piso obrigatório para toda rota nova.

## 3. Padrão VIVO do repositório (descrição honesta, não aspiracional)

Regras observadas no código vivo (a serem seguidas por rotas novas; divergência = dívida a registrar):

- **Autoridade/tenant:** rotas de domínio resolvem o actor por `req.actionContext.actorId` (NUNCA `req.user.id`
  como autoridade de negócio) e o tenant por `req.tenant.id`; representação verificada por `canRepresentActor`
  (DECISION-0113). Módulos C1 usam um `requireContext(req)` que exige `actionContext` + `tenant`.
- **Nomenclatura de payload:** corpo/query **camelCase** na borda; conversão para **snake_case** no interno.
- **Schema Fastify:** a maioria das rotas vivas **não** declara `schema:` Fastify (validação via `zod` no
  handler). Isso é **padrão legado**, não autorização para perpetuar dívida — rota nova DEVE ter contrato
  mínimo catalogado (§5), ainda que sem `schema:` Fastify.
- **Δbank=0 / SSOT:** rota nunca cria verdade semântica; projeta/coleta. Identidade = `concepts.concept_id`;
  valores monetários só anunciados em `_cents`; nada toca Bank fora dos trilhos financeiros governados.

## 4. Checklist obrigatório ao criar/alterar rota HTTP

1. [ ] Ler este documento e o `00_AGENT_PROTOCOL.md` §2.2.8 **antes** de escrever a rota.
2. [ ] Escrever/atualizar o **contrato mínimo** no catálogo (§5) **antes** do código.
3. [ ] Autoridade: `actionContext.actorId` + `tenant.id`; representação verificada; sem `req.user.id` como
   autoridade de negócio.
4. [ ] Entrada validada (zod) camelCase; saída com forma estável documentada.
5. [ ] SSOT respeitado (identidade em CONCEPT; sem vocabulário paralelo; sem lista local no frontend).
6. [ ] Δbank=0; nenhum toque em Bank fora do trilho governado.
7. [ ] Guard/mutação quando a rota carrega invariante de autoridade/separação de trilho.
8. [ ] Registrar no `REMEDIATION_DT_LOG.md` quando a rota fecha/abre dívida.

## 5. Catálogo de contratos mínimos (fonte da verdade de contrato)

### `GET /profile/interest/c1/search` — busca no pool de ASSUNTO (RFC-SHARED-SUBJECT-CONCEPT-POOL)

- **Método/caminho:** `GET /profile/interest/c1/search`
- **Autoridade:** autenticada, `requireContext(req)` (mesmo padrão de `GET /profile/interest/c1` e
  `POST /profile/interest/c1/concepts`): exige `actionContext.actorId` + `tenant.id`. Read-only.
- **Entrada:** query `q: string` (termo de busca; `< 2` chars → resultado vazio).
- **Saída:** `{ results: Array<{ key: string; conceptId: string; label: string }> }`.
- **Autoridade semântica (SSOT):** pertencimento vem de `shared_subject_concepts` (enabled); `canonical_services`
  entra só como LEFT JOIN de rótulo (COALESCE→slug), NUNCA decide pertencimento. Não é oferta/serviço/locação.
- **Efeitos:** nenhum (não declara interesse; a declaração é `POST /profile/interest/c1/concepts` por `conceptId`).
- **Δbank:** 0. **Guard:** `scripts/audit-shared-subject-pool.mjs`.

### `GET /events/:id/orchestration-suggestions` — necessidades operacionais sugeridas (Fase B v1)

- **Método/caminho:** `GET /events/:id/orchestration-suggestions`
- **Autoridade:** autenticada + **gate de DONO do evento** — `assertRepresentsEventOwner(tenantId,
  req.user.userId, id)` resolve o evento e exige que o usuário AUTENTICADO represente o `actor_id` organizador
  (canRepresentActor, DECISION-0113), fail-closed: 403 se não-dono, 404 se evento inexistente, 400 sem tenant.
  Tenant por `req.tenant.id`. Read-only. (O `actionContext.actorId` é hint, nunca a autoridade.)
- **Entrada:** param `id` (UUID do evento).
- **Saída:** `{ suggestions: Array<{ needConceptId: string; label: string; fulfillmentKind: 'service'; isRequired: boolean; sortOrder: number }> }`.
- **Autoridade semântica (SSOT):** derivadas do `event_format_concept_id` do evento via
  `event_orchestration_template_items` (autoridade por `format_concept_id`, NUNCA `orchestration_template_key`
  string nem `event_type` legado). `need_concept_id` = CONCEPT com `offer_kind='service'` (v1). Label vem do
  `canonical_services` auxiliar (COALESCE→slug). Nada de texto livre/category como identidade.
- **Efeitos:** NENHUM (não cria `event_operational_needs`, demanda, RFQ ou booking). A persistência da seleção
  do organizador é o `POST` abaixo.
- **Erros:** 400 sem contexto; 403 sem representação do evento; 404 evento inexistente ou sem formato.
- **Δbank:** 0. **Guard:** `scripts/audit-event-orchestration-templates.mjs`.

### `GET /events/:id/operational-needs` — necessidades ATIVAS declaradas do evento (Fase B write)

- **Método/caminho:** `GET /events/:id/operational-needs`
- **Autoridade:** gate de DONO (`assertRepresentsEventOwner`). Tenant por `req.tenant.id`. Read-only.
- **Saída:** `{ needs: Array<{ needConceptId, label, fulfillmentKind, status }> }` (status≠cancelled).
- **SSOT:** lê `event_operational_needs` por `need_concept_id`; label do `canonical_services` auxiliar.
- **Efeitos:** nenhum. **Δbank:** 0. **Guard:** `scripts/audit-event-orchestration-templates.mjs`.

### `POST /events/:id/operational-needs` — organizador declara uma necessidade sugerida (Fase B write)

- **Método/caminho:** `POST /events/:id/operational-needs`
- **Autoridade:** gate de DONO — `assertRepresentsEventOwner(tenantId, req.user.userId, id)` (canRepresentActor,
  403 não-dono, 404 evento inexistente, 400 sem tenant). Tenant por `req.tenant.id`.
- **Entrada:** body `{ needConceptId: string (UUID) }` (camelCase).
- **Saída:** `{ ok: true, need: { needConceptId, fulfillmentKind: 'service', status } }` (201).
- **Autoridade semântica (SSOT):** grava em `event_operational_needs` por `need_concept_id`. **VALIDAÇÃO
  OBRIGATÓRIA:** `needConceptId` DEVE existir como item do `event_orchestration_template_items` do
  `event_format_concept_id` do evento (seleção das SUGESTÕES governadas, NÃO catálogo livre). Fora do template
  → 422, não grava. A FK composta `(need_concept_id, fulfillment_kind)→concept_offer_kinds` também garante
  offer_kind='service'. Idempotente (UNIQUE event_id+need_concept_id; re-POST reativa status='open').
- **Efeitos:** grava declaração FACTUAL. NÃO dispara demanda/RFQ/booking/agenda/pagamento. NÃO escreve
  `metadata.needs`/`operational_roles`.
- **Erros:** 400 sem tenant/body; 403 não-dono; 404 evento; 422 need fora das sugestões do formato.
- **Δbank:** 0. **Guard:** `scripts/audit-event-orchestration-templates.mjs`.

### `DELETE /events/:id/operational-needs/:needConceptId` — organizador remove a seleção (Fase B write)

- **Método/caminho:** `DELETE /events/:id/operational-needs/:needConceptId`
- **Autoridade:** idêntica ao POST (`assertRepresentsEventOwner`).
- **Entrada:** params `id`, `needConceptId`.
- **Saída:** `{ ok: true }` (200).
- **Semântica:** lifecycle GOVERNADO já existente na tabela — seta `status='cancelled'` (não hard-delete;
  preserva histórico; re-POST reativa). NÃO inventa lifecycle novo.
- **Efeitos:** nenhum econômico. **Δbank:** 0. **Guard:** `scripts/audit-event-orchestration-templates.mjs`.

### Availability de LOCAÇÃO — `owner_type='actor_asset'` (F-ASSET-MULTI-OFFER-FOUNDATION 2b-4)

- **Mudança de contrato (endpoint genérico de availability):** para LOCAÇÃO, a disponibilidade agora pertence
  ao ITEM real. `POST /availability` e `GET /availability` (owner do recurso) usam `ownerType='actor_asset'`
  e `ownerId = asset_id` (= id público do recurso de locação, que passou a ser o `actor_assets.id`). O valor
  legado `'rentable_resource'` NÃO é mais gravado pelo fluxo vivo de locação. Autoridade resolvida por
  `actor_assets.owner_actor_id` (availability-owner-authority). Booking/conflito lê quantidade de
  `actor_asset_rental_terms`. Frontend (RentalResourceDetailPage) alinhado. Δbank=0.

### `GET /rentable-resources/vocabularies` — vocabulários governados p/ o cliente (F-ASSET-CONDITION-AND-RENTAL-MINIMUMS D6)

- **Autoridade/entrada:** público, read-only, sem parâmetros. **Saída:** `{ ok, data: { minRentalUnits: {value,label}[],
  assetConditions: {value,label}[] } }`. `value` = símbolo GOVERNADO (fonte única: `MIN_RENTAL_UNITS` em
  `rentable-resource.types.ts` e `ASSET_CONDITIONS` em `core/assets/asset.types.ts`); `label` = camada de
  exibição pt-BR. O frontend renderiza as opções DAQUI — não hardcoda a lista (D6). Read-only, Δbank=0.

### Condição do item + mínimo de locação — `POST/PATCH /rentable-resources` (F-ASSET-CONDITION-AND-RENTAL-MINIMUMS D1/D2)

- **`condition`** (opcional, `'new'|'used'|null`, `z.enum(ASSET_CONDITIONS)`): atributo do ITEM real →
  `actor_assets.condition` (CHECK `new/used`, NULL permitido). NÃO é status/modo/categoria.
- **`minRentalQty`/`minRentalUnit`** (opcional, par completo; `minRentalUnit` = `z.enum(MIN_RENTAL_UNITS)`):
  TERMO da oferta rental → `actor_asset_rental_terms.min_rental_quantity/min_rental_unit` (CHECK ≥1, unit no
  vocab, par completo). Re-homed de `actor_assets.metadata` (não mora mais lá). Independe de `pricingUnit`. Δbank=0.

### Venda asset-first — `/asset-sales` (F-ASSET-MULTI-OFFER-FOUNDATION Fatia 3)

- **Autoridade:** `owner_actor_id` = `actionContext.actorId`, provado por `canRepresentActor` (D-α: **PF e PJ**;
  NÃO herda `PRODUCT_PUBLISH_PJ_ONLY`, que é de produto/estoque). `owner` NUNCA vem do body.
- **`POST /asset-sales`** — cria venda de bem durável individual. Entrada: `conceptId` (durável,
  gate `concept_asset_eligibilities`), `label`, `condition?` (item), `priceCents?` (ANÚNCIO), `visibility?`,
  `audienceRelationshipTypes?`, `negotiable?`, `saleNotes?`. Atômico: `actor_assets` + `actor_asset_modes('sale')`
  + `actor_asset_sale_terms`. 400 `ASSET_SALE_CONCEPT_NOT_DURABLE` se concept não asset-elegível; 403
  `ASSET_SALE_NOT_REPRESENTABLE`. Δbank=0.
- **`GET /asset-sales?ownerActorId=`** — minhas vendas (owner-gated). **`GET /asset-sales/:id`** — detalhe.
- **`PATCH /asset-sales/:id`** — edita oferta (price/visibility/audience/negotiable/notes + condition do item);
  owner-only. **`PATCH /asset-sales/:id/status`** — `active`/`paused` (D-ε; sem `sold`).
- **`GET /asset-sales/vocabularies`** — vocab governado (value+label): `ASSET_SALE_STATUSES` + visibilidades
  (D6, sem hardcode no cliente). Read-only.
- **NÃO** toca `products`/`product_offers`/`inventory`/Bank/orders/checkout/payment_intents. Preço = anúncio.

## 6. Lacunas conhecidas (dívida registrada, não fingida)

- O `00_AGENT_PROTOCOL.md` §2.2.8 cita `backend/docs/openapi-stock-transfer-receipt.contract.yaml` como
  contrato de referência do fluxo stock-transfer/receipt — esse arquivo **também está ausente** (não recriado
  aqui; fora do escopo desta microfrente). Registrar/recuperar quando o fluxo for tocado.
- As rotas HTTP **pré-existentes** ainda não estão catalogadas na §5 (este doc nasce com a 1ª rota nova). O
  catálogo retroativo das rotas legadas é trabalho futuro, incremental, por frente que tocar cada rota.
