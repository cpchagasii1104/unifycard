# DESENHO PJ C0 — Mapa de SSOTs, bloqueios e decisões antes de implementação

**Status:** DESENHO READ-ONLY CONSOLIDADO — **não** é decisão de implementação, **não** escolhe A/B, **não** autoriza código. Serve como **mapa institucional versionado** para futuras frentes PJ (para o C0 não viver só na conversa).
**Frente:** `F-PJ-BIRTH-AND-COMMERCIAL-SSOT-READONLY` — fatia de consolidação docs-only.
**Sessão:** 2026-06-02. **Branch:** `rescue-structural`. **HEAD origem:** `c6325a47`.
**Natureza:** mapa de substrato vivo × casca × bloqueios × decisões pendentes. Insumo, não diretriz.
**Subordinado a:** `CONSTITUICAO_UNIFICARD.md`, `LEIS_OPERACIONAIS_UNIFICARD.md`, `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md`, `SSOT_REGISTRY_UNIFICARD.md`, `07_NOMENCLATURA_CANONICA.md`, `CORE_IMUTAVEL.md`, `AUTHORITY_LAW.md`, `EMPRESA_NASCIMENTO_CANONICO.md`.
**Vinculado a:** `DECISION-0075` (freeze do nascimento PJ) + `DT-COMPANY-BIRTH-PAGE-ACTOR-DRIFT` / `DT-COMPANY-BIRTH-NON-TRANSACTIONAL-CLEANUP` / `DT-COMMERCIAL-PRICE-FEDERATED-SSOT`; `DESENHO_FASE_3B_EMPRESA_DOIS_MOMENTOS.md`; `DECISION-0074`/`0076` (endereço PF/geo); `DECISION-0080` (gender); `DECISION-0062` (CPF, F5 pendente).

---

## 1. Status

- READ-ONLY consolidado. NÃO é decisão de implementação.
- NÃO escolhe A/B do nascimento PJ.
- NÃO autoriza código, migration, schema ou DML.
- Serve como mapa institucional para futuras frentes PJ.

## 2. Prova de rastreabilidade normativa

**Documentos lidos/revistos (mesma sessão, âncora §4.2 do protocolo):** `00_AGENT_PROTOCOL`, `CONSTITUICAO`, `LEIS_OPERACIONAIS` (bootstrap mínimo, integrais), `LEI_DE_COERENCIA §4.6–4.9`, `07_NOMENCLATURA §1–4`, `SSOT_REGISTRY`, `SSOT_EXCLUSIVE_BANK_RULE`, `EMPRESA_NASCIMENTO`, `02_ACTORS_SSOT`, `IDENTITY_SSOT_PRECEDENCE`, `AUTHORITY_LAW`, `18_DOMAIN_ONTOLOGY`, `DESENHO_FASE_3B`, `DECISION-0074/0075/0076`. + SELECT read-only no banco vivo `unificard_dev`.
**Precedência aplicada (00_AGENT_PROTOCOL §2.2.7):** CONSTITUIÇÃO > LEIS_OPERACIONAIS > SSOT_REGISTRY > 18_DOMAIN_ONTOLOGY > demais (CORE_IMUTAVEL, 07_NOMENCLATURA, AUTHORITY_LAW, EMPRESA_NASCIMENTO, DESENHO_FASE_3B).
**SSOT por pilar (nomes exatos):**
| Pilar | SSOT canônico |
|-------|---------------|
| Identidade/Actor | `actors` (actor_id, operacional) + `identities` (global_user_id, KYC/fiscal); writer único `actor-writer.service` (LEI §4.8.1) |
| Semântica | `concepts` (concept_id) — Lei 7; `category_id`/slug = navegação, nunca identidade |
| Autoridade | `AUTHORITY_LAW` (CPF=raiz; persona nunca soberana) + LEI §4.9 + `actor-delegation` |
| Location Core | `addresses` + `address_assignments` (DECISION-0020) |
| Tempo/Agenda | sistema "Unified Availability" = tabelas **`availability`** + **`bookings`** |
| Comercial | CONCEPT→`canonical_products`→`products`+`store_product_activations`; preço=`price_cents`; estoque=`inventory_movements` |
| Financeiro (fronteira) | `bank_ledger`/`bank_transactions`/`bank_splits`/`bank_accounts` (Lei 5; acesso SQL só dentro de `modules/bank`, §4.6–4.7) |

## 3. Estado PF que libera PJ para desenho

- Endereço civil PF saiu de `profiles.metadata.address` → **Location Core** (`addresses`+`address_assignments`, owner_type='profile', role='RESIDENCE'); modelo CEP-âncora (DECISION-0074; selo `SELO_PROFILE_RESIDENCE_ADDRESS_LOCATION_CORE.md`).
- `gender` saiu do blob → `global_users.gender` (DECISION-0080 + selo).
- Agenda saiu do `/profile/professional` morto; Learning/Interest/Lifestyle/Education em SSOTs próprios.
- CPF CORE lê `identities.tax_id` (DECISION-0062 F4, commit `c6325a47`).
- **CPF F5 PENDENTE:** caches `user_profiles.cpf` / `profiles.cpf` ainda existem. **FORA DE ESCOPO PJ — não tocar.**

## 4. Estado do nascimento PJ

- `backend/src/core/companies/companies.service.ts::createCompany` cria, no **Momento 1**: `companies` + `company_users` + `ensureUserActor` + **`ensurePageActor` (page-actor)**. Inalterado desde a âncora `335a5eaf` (zero commits nesses arquivos).
- **Sem transação DB única** (`pool.query` statement-a-statement; sem BEGIN/COMMIT).
- **Cleanup compensatório** por `DELETE`s manuais num `catch`; endereço criado não é desfeito → risco de órfão.
- `DECISION-0075` = **freeze/diagnóstico** (não escolhe arquitetura). **A/B pendente de Clayton.**
- Em DEV: **0 companies, 0 page-actors** — o drift é de código, sem dado vivo.

## 5. Identidade / actor / autoridade

- Runtime usa `actor_type='page'` para empresa (contrato preferido, LEI §4.8.1/§4.8.7).
- `actor_organizational` existe no CHECK mas **não nasce no fluxo vivo** (legado-compat genesis; não escolher em fluxo novo).
- `company_users` = associação/membership + projeção de permissão (`can_manage_*`, soft-block) — **não** é SSOT pleno de autoridade (autoridade vive em AUTHORITY_LAW/§4.9 + `actor-delegation`).
- Responsável humano **obrigatório**: `company_users → responsible_actor_id` do page → CPF (LEI §4.8.2/§4.8.3).
- **CNPJ/KYC é GAP** (ver §6).

## 6. CNPJ / fiscal / KYC

- CNPJ vive em **`companies.cnpj`** (text). `identities.tax_id` cobre **só CPF** (verificado vivo: tax_id_type só 'cpf', 0 'cnpj').
- CNPJ está **fora do trilho KYC** de `identities`. Lookup Receita Federal (BrasilAPI) no `createCompany` é enriquecimento opcional/não-bloqueante, não KYC.
- `AUTHORITY_LAW Art. 4`: sem **KYC mínimo** é PROIBIDO criar/controlar CNPJ. Hoje não há trilho KYC vivo para CNPJ → **vão fiscal/de autoridade**.
- **Recomendação:** abrir frente própria **`F-PJ-CNPJ-KYC-AUTHORITY-READONLY`** (antes de preço).

## 7. Endereço PJ / Location Core

- Location Core PF é **substrato útil**, mas PJ **não herda** o modelo PF automaticamente (DECISION-0075 §7, DECISION-0076 §5).
- `createCompany` passa `stateId/cityId/neighborhoodId = NULL` (CEP-âncora); `addresses` tem `neighborhood_display_text` (bairro textual) + FK `city_id/state_id/neighborhood_id`; city/state seguem **FK-only**.
- Role de endereço de empresa no código = `'HQ'` (único); `address_assignments` é N:N temporal por role → **multi-role schema-capaz, indefinido para PJ**.
- **Roles PJ pendentes de desenho:** HQ, fiscal, operacional, entrega, retirada.
- Cidade/UF/bairro **enriquecidos** dependem de estratégia geo (CEP/catálogo/geocoding). Catálogo insuficiente (states=27, cities=27 só capitais, neighborhoods=0; sem resolver/geocoding backend). É **frente F-GEO compartilhável PF/PJ** (DECISION-0076).

## 8. Ontologia / company_types / CONCEPT

- **CONCEPT define "o que a empresa é"** — `companies.primary_concept_id` (ramo) setado no Momento 2; `category_id` é breadcrumb, **nunca identidade** (Lei 7).
- `company_types` vivos = **7**: açougue, farmácia, hortifruti, padaria, restaurante, salão, supermercado.
- **NÃO existem:** distribuidora, clínica, oficina, autopeças (precisariam nascer como company_types + concepts).
- `company_types` é **classificação/template magro**, **não** SSOT semântico soberano. `company_type_allowed_concepts` restringe type→concepts permitidos (governado).
- `canonical_products` tem `concept_id` **NULLABLE** + `concept_resolution_status` → identidade semântica pode ficar não-resolvida (divergência leve vs Lei 7, mediada pelo status). **Vigiar** fluxos que usem `category_id` como identidade.

## 9. Templates de negócio

- `business_templates` **NÃO existe** (verificado vivo).
- Vivo = `company_types` + `company_type_allowed_concepts`.
- **Não materializa** catálogo/agenda/recursos/papéis automaticamente (template magro de classificação).
- **Risco:** template virar SSOT semântico indevido — CONCEPT é o SSOT, não company_types. Vigiar.

## 10. Catálogo / produto / foto única

- `canonical_products` **vivo** (35 linhas) com `images` (jsonb = foto/identidade industrial) + `gtin` + `concept_id` + `category_id`.
- `products` = 0; `store_product_activations` = 0 (tabela existe; **fluxo parcial**, sem rota completa).
- Modelo normativo: empresa **ATIVA** produto canônico (`products.canonical_product_id` + `store_product_activations`), **não clona**.
- Cascas: `catalog_products`/`tenant_products` **inexistentes** no runtime; `tenant_concept_offerings` existe **sem writer**.
- **Fluxo ainda precisa desenho** (ativação/oferta/variantes).

## 11. Preço

- **Sem `price` NUMERIC vivo** (refutado no schema vivo).
- Federação de `price_cents` (BIGINT) em: `product_prices` (NOT NULL), `product_offers` (NOT NULL), `products` (nullable, legado). **Precedência canônica AUSENTE.**
- Lei 7: identidade semântica em pricing/checkout segue `product → canonical_product → concept` (proibido derivar de `categories.concept_id`).
- **Recomendação:** abrir frente própria **`F-COMMERCIAL-PRICE-PRECEDENCE-READONLY`** (depois de CNPJ/KYC). `DT-COMMERCIAL-PRICE-FEDERATED-SSOT` OPEN.

## 12. Estoque

- `inventory_movements` **vivo, append-only** (trigger de imutabilidade), `quantity` numeric.
- `inventory_balances` = read-model derivado.
- **Sem `stock_quantity` editável competindo** (varredura viva: `quantity` só em tabelas de evento/movimento).
- Uso por PJ depende de `product_variants` (→ products → canonical) existirem. Substrato limpo e pronto; uso depende do front de catálogo/ativação.

## 13. Agenda / recursos / "para quê"

- `availability` (vivo, 32 linhas; `owner_type`/`owner_id` + `start_datetime`/`end_datetime` TIMESTAMPTZ) + `bookings` (vivo, 0 linhas; `requester_actor_id` + `availability_id` + `notes`).
- **`unified_availability`/`unified_bookings` NÃO existem** — o sistema "Unified Availability" é implementado pelas tabelas `availability`/`bookings` (divergência nome-norma × tabela-viva; alinhar SSOT_REGISTRY ao runtime é frente própria, não bloqueia C0).
- Empresa/page pode ser owner (owner_type/owner_id schema-capaz). Profissional participa via `availability_participants`.
- **Recurso físico NÃO materializado:** `service_resources`/`resources` ausentes; `ServiceResource.contract.ts` é contrato sem tabela.
- **Booking não tem "para quê" direto** (sem `concept_id`/`service_id` em availability/bookings); ligação indireta via `service_payment_requests`/`service_orders`.
- Clínica/oficina exigem: recurso físico + serviço/concept no booking + page-actor owner exercitado.

## 14. PDV / ERP / CRM

- **Horizonte futuro** — sem escopo de implementação agora.
- Dependerão dos SSOTs acima: actor/company; catálogo (canonical→product→activation); preço (precedência primeiro); estoque (`inventory_movements`); agenda (`availability`/`bookings`); cliente/CRM (**sem SSOT de CRM hoje** — seria novo); financeiro/Bank (`bank_ledger` via APIs do Bank, §4.6–4.7).

## 15. Decisões Clayton (pendentes)

- **A1** — Nascimento PJ A/B (inerte sem page-actor no Momento 1 × full-birth transacional).
- **A2** — Trilho fiscal/KYC de CNPJ (onde vive; KYC mínimo p/ controlar CNPJ — Art. 4).
- **A3** — Precedência canônica de preço (`product_prices` × `product_offers` × `products.price_cents`).
- **A4** — Modelo de endereço PJ (roles HQ/fiscal/operacional/entrega/retirada) + estratégia geo.
- **A5** — Recurso físico = entidade própria? (cadeira/sala/box/equipamento).
- **A6** — Booking precisa de "para quê" (service/concept)?
- **A7** — Catálogo/template como materializador (ou permanece classificação magra)?

## 16. Próximas frentes recomendadas (ordem)

Justificativa: **identidade vem antes de comércio** — primeiro quem é e quem responde, depois quanto custa.

1. **`F-PJ-CNPJ-KYC-AUTHORITY-READONLY`** — fechar o vão fiscal/autoridade de CNPJ.
2. **`F-COMMERCIAL-PRICE-PRECEDENCE-READONLY`** — mapear leitura/escrita de `price_cents` e precedência.
3. **Decisão A/B do nascimento PJ** (+ atomicidade se B).
4. **Desenho de endereço PJ** (roles) — aproveitando F-GEO compartilhável PF/PJ.
5. **Recurso físico + booking "para quê"** (agenda PJ real).
6. **Só depois:** fatias executoras.

## 17. Fora de escopo (vinculante)

```text
NÃO mexe em CPF F5 (user_profiles.cpf / profiles.cpf).
NÃO implementa PJ.
NÃO altera createCompany.
NÃO altera actor types.
NÃO cria business_templates.
NÃO cria recursos (service_resources/resources).
NÃO altera preço.
NÃO altera agenda.
NÃO altera Location Core.
NÃO escolhe A/B nem cria DECISION numerada (é desenho, não decisão).
```
