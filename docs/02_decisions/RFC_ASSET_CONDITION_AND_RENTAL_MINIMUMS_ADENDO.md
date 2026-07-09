# ADENDO DE DECISÃO — F-ASSET-CONDITION-AND-RENTAL-MINIMUMS

**Tipo:** Adendo docs-only (ratificação de decisão soberana antes de implementar).
**Status:** RATIFICADO por Clayton/Guardião. Implementação AGUARDA GO próprio.
**Base:** F-ASSET-MULTI-OFFER-FOUNDATION · Fatia 2b = SELADA E REGISTRADA (HEAD `66e437d30`).
**Vínculo:** adendo de [[RFC_ASSET_MULTI_OFFER_FOUNDATION]] (item asset-first: `actor_assets` = item real;
`actor_asset_modes` = ativação; `actor_asset_rental_terms` = termos de locação).
**Escopo desta frente:** (a) condição do item novo/usado; (b) mínimo de locação por item.
**Δbank=0. Sem venda, sem service_use, sem Bank, sem Fase C.**

---

## Contexto do READ-FIRST (o que a auditoria de 1ª mão provou)

1. **Condição novo/usado NÃO existe** em nenhum lugar do sistema (nem `actor_assets`, nem produtos, nem
   migration, nem vocabulário governado). É genuinamente novo.
2. **Mínimo de locação JÁ existe ponta a ponta**, mas MAL ALOJADO:
   - vocab `MIN_RENTAL_UNITS = ['hour','day','week','month','semester','year']` + `MIN_RENTAL_UNIT_HOURS`
     já existem em `rentable-resource.types.ts`;
   - `routes` validam `minRentalQty` (int ≥1) + `minRentalUnit` (`z.enum(MIN_RENTAL_UNITS)`) no create e updateOffer;
   - `service.normalizeMinRental` valida e **grava em `metadata`**, que o repository escreve em
     **`actor_assets.metadata`** (o ITEM) — não nos termos de locação;
   - `service.minRentalOf` lê de metadata; o estimador de disponibilidade retorna `BELOW_MINIMUM`;
   - frontend tem UI mas **hardcoda** a lista de unidades e só envia mínimo para `property`/`space`.
3. **Defeitos a corrigir na implementação:** (a) mínimo mora na identidade do item (`actor_assets.metadata`)
   quando é TERMO de locação; (b) não é coluna governada, sem CHECK físico, ausente no manifest; (c) frontend
   hardcoda unidades; (d) frontend restringe mínimo a property/space, contra "qualquer bem durável".

---

## Decisões ratificadas

### D1 — Condição do item (novo/usado)
- **Local:** `actor_assets` (o item real). Característica da UNIDADE, compartilhada por `sale`/`rental`/`service_use`.
- **Campo físico:** `condition`. **API/camelCase:** `condition`.
- **Vocabulário:** `ASSET_CONDITIONS = ['new', 'used']` (const em `asset.types.ts` = fonte única; CHECK físico
  e manifest compõem daqui).
- **Nulabilidade:** `condition` **PERMITE NULL** na v1. **Não** presumir condição; **não** usar default `'used'`.
- **NÃO pertence a:** `actor_asset_modes` (não é ativação) · `actor_asset_rental_terms` (não é só da locação) ·
  `category` · `status`/lifecycle · `availability` · rental status.
- **Fora da v1 (exigem decisão própria futura, NUNCA balde genérico):** `refurbished`, `reconditioned`,
  `damaged`, `open_box`, `other`.

### D2 — Mínimo de locação
- **Local:** `actor_asset_rental_terms` (os TERMOS). O mesmo asset existe sem locação; o mínimo só importa com
  o modo `rental` ativo.
- **Campos físicos:** `min_rental_quantity`, `min_rental_unit`.
- **API já existente (preservar):** `minRentalQty`, `minRentalUnit`.
- **RE-HOMING obrigatório:** remover a persistência do mínimo de `actor_assets.metadata`; passar a gravar/ler nas
  colunas de `actor_asset_rental_terms`.
- **NÃO pertence a:** `actor_assets` · `actor_assets.metadata` · `actor_asset_modes`. **Não** toca Bank; **não**
  abre booking/agenda/RFQ/service_demands. É termo da oferta rental.

### D3 — Vocabulário de unidade
- **REUSAR** `MIN_RENTAL_UNITS = ['hour','day','week','month','semester','year']`. Já cobre horas→ano.
- **Registrar no manifest** (`governed-vocabularies.manifest.ts`) — hoje ausente.
- **CHECK físico:**
  - `min_rental_quantity IS NULL OR min_rental_quantity >= 1`
  - `min_rental_unit IS NULL OR min_rental_unit IN (MIN_RENTAL_UNITS)`
- **Consistência quantidade↔unidade:** se `min_rental_quantity` existir, `min_rental_unit` deve existir, e
  vice-versa (par completo ou par vazio). Parcial (um sem o outro) é INVÁLIDO — validado no service (mantém o
  atual `RENTAL_MIN_UNIT_INVALID`) e, se viável, reforçado por CHECK de par no banco.

### D4 — Mínimo é independente do preço
- `min_rental_unit` **NÃO** se amarra obrigatoriamente ao `pricing_unit`. São eixos distintos.
- Casos válidos: preço `por_dia` + mínimo `3 day`; preço `por_hora` + mínimo `4 hour`; preço `por_mes` +
  mínimo `6 month`.

### D5 — "Evento" fora da v1
- **NÃO** criar unidade `event`. Evento não é unidade de tempo.
- MVP: piscina de bolinha / item de festa usa `day`, `hour` ou outro período temporal já governado.
- Aluguel "por evento" no futuro = decisão própria (RFC), nunca balde.

### D6 — Frontend sem hardcode
- Frontend **NÃO** pode manter lista local hardcoded de `MIN_RENTAL_UNITS` nem de `ASSET_CONDITIONS`.
- A implementação deve **expor ou reutilizar** endpoint de vocabulário governado do backend.
- **Estado atual:** não há endpoint que exponha `MIN_RENTAL_UNITS`/`ASSET_CONDITIONS` ao cliente → a
  implementação deve **propor um endpoint pequeno, contrato-primeiro** (`API_CONTRACT_GOVERNANCE.md`), ou
  reutilizar um endpoint de vocabulário governado existente se houver adequado (documentar qual).

### D7 — Drift menor de RENTAL_PRICING_UNITS (DT registrada, não corrigir aqui)
- O manifest lista `RENTAL_PRICING_UNITS` com **4** valores (`por_hora..por_mes`), mas o TS e o CHECK físico
  têm **6** (`+ por_semestre, por_ano`).
- **DT menor** registrada no `REMEDIATION_DT_LOG` (`DT-RENTAL-PRICING-UNITS-MANIFEST-DRIFT`). **Não** corrigir
  nesta implementação, salvo se indispensável; microcorreção/frente própria futura.

---

## Implementação futura (SÓ com GO próprio — não faz parte deste adendo)

1. Criar `ASSET_CONDITIONS` em `asset.types.ts` + registrar no manifest.
2. `ALTER actor_assets ADD COLUMN condition TEXT` + CHECK `new/used` + NULL permitido.
3. `ALTER actor_asset_rental_terms ADD min_rental_quantity INTEGER, min_rental_unit TEXT` + CHECKs (D3).
4. Remover persistência de mínimo em `actor_assets.metadata`.
5. `service`/`repository` gravam e leem o mínimo nas colunas de `actor_asset_rental_terms`.
6. Preservar o payload `minRentalQty`/`minRentalUnit`.
7. Permitir mínimo para TODO tipo durável locável (não só property/space).
8. Corrigir frontend para ler vocabulário governado (não hardcoded).
9. Adicionar `condition` a create/update/detail/list/discover se necessário, contrato-primeiro.
10. **Não** tocar venda, service_use, Bank ou Fase C. Forward-only, additivo, sistema virgem (0 linhas → sem backfill).

---

## Guards futuros (registrar na implementação; falhar se…)

- `condition` for texto livre sem vocab/CHECK;
- `condition` for colocada em `actor_asset_modes`;
- `condition` for colocada em `actor_asset_rental_terms`;
- `condition` usar `category_id` como autoridade;
- `min_rental_quantity`/`min_rental_unit` ficarem em `actor_assets`;
- `minRentalQty`/`minRentalUnit` voltarem para `actor_assets.metadata`;
- `min_rental_unit` for lista local hardcoded no frontend;
- mínimo aceitar 0 ou negativo;
- mínimo existir sem unidade ou unidade sem mínimo (salvo decisão documentada — ver D3);
- `event` entrar como unidade sem RFC;
- Bank/ledger/payment forem tocados;
- products/venda forem abertos;
- service_use completo for aberto;
- booking/agenda/RFQ/service_demands forem abertos;
- Fase C for aberta.

---

## STOP deste adendo
Docs-only. Nenhum código, migration, frontend, contrato ou banco tocados. A implementação começa apenas com GO
próprio, seguindo D1–D7 e os guards acima.
