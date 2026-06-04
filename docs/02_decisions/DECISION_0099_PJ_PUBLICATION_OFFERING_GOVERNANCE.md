# DECISION-0099 — Governança de Publicação/Oferta da Empresa PJ

**Data:** 2026-06-04
**Tipo:** Arquitetural / Institucional
**Status:** PROMULGADA (docs-only — não autoriza código/schema/migration)
**Frente:** `F-PJ-PUBLICATION-OFFERING-DECISION`
**HEAD de origem:** `c72fdd72`

---

## 1. Título
Publicação/Oferta da empresa é ato soberano distinto da ativação operacional; deve ser
company/page-actor-level, gateada por KYB e autoridade contextual, reversível e auditável.
O shape atual `tenant_concept_offerings(tenant_id, concept_id, is_active)` é reader-model de
discovery, **não** o shape soberano de publicação.

## 2. Data
2026-06-04.

## 3. Tipo
Arquitetural / Institucional. Docs-only.

## 4. Status
PROMULGADA. Não autoriza código, schema, migration ou writer (ver §11/§D12).

## 5. Contexto
A cadeia PJ chegou ao fim da ativação operacional:
- **DECISION-0097**: empresa nasce em dois momentos (nascimento fiscal inerte → ativação
  operacional separada); page-actor é o eixo operacional; KYB gateia broadcast/dinheiro.
- **DECISION-0098**: SSOT da ativação operacional = par `(primary_company_type_id,
  primary_concept_id)`, validado por `company_type_allowed_concepts`; businessType/
  businessCategory/hybrid/metadata não são SSOT.
- Runtime entregue e provado ponta-a-ponta: catálogo governado (`F-PJ-ACTIVATION-READ-ENDPOINTS`),
  rota write-pair com guard contextual (`F-PJ-ACTIVATION-ROUTE-WRITE-PAIR`), onboarding frontend
  consumindo o catálogo (`F-PJ-ONBOARDING-FRONTEND-ACTIVATION-PAIR`) e E2E encadeado permanente
  (`F-PJ-ONBOARDING-ACTIVATION-FLOW-E2E`, 22/22).

Resta a pergunta: ativar operacionalmente (gravar o par) **publica** a empresa? A frente
`F-PJ-TENANT-CONCEPT-OFFERINGS` (guardião read-only) auditou `tenant_concept_offerings` e a
resposta é **não** — publicar é outro ato soberano. Esta DECISION fixa essa separação.

## 6. Problema
DECISION-0098 D9 deixou `tenant_concept_offerings` como "candidato a oferta, writer deriva do
par" — sem decidir **se** o writer existe, **quem** publica, **em que granularidade** e **com
quais gates**. Sem norma, a tentação seria escrever a oferta automaticamente na ativação. A
auditoria provou que isso é perigoso e que o shape atual não comporta o ato correto.

## 7. Evidência material (auditoria read-only F-PJ-TENANT-CONCEPT-OFFERINGS)
1. **Shape atual** `tenant_concept_offerings(id, tenant_id, concept_id, is_active, created_at,
   updated_at)` · UNIQUE `(tenant_id, concept_id)` · FK → `tenants`/`concepts` (CASCADE) ·
   índice parcial em `concept_id WHERE is_active`. **0 linhas.**
2. **Ausente:** `company_id`, `actor_id`/`page_actor_id`, `created_by`, `source`, `published_at`,
   `retired_at`, `visibility`/`status` (só `is_active` booleano), audit/histórico, tabela irmã.
3. **Granularidade atual = tenant×concept.** Correta para empresa = **company/page-actor×concept**.
   Pela UNIQUE, várias empresas do mesmo tenant no mesmo concept colapsam numa única linha.
4. **Reader único:** `listTenantsOfferingConcept(conceptId)` → consumido por
   `marketplace-contextual.service.ts` (`getContextualBundle`) → **rota viva** `GET
   /marketplace/contextual?intent=…` (protectedScope), que devolve TODOS os tenants ofertantes
   (`viewerTenantId` não filtra) ⇒ **descoberta cross-tenant pública** para o concept e seus
   relacionados por GRAPH.
5. **Sem gate KYB/capability/page-actor** no reader contextual.
6. **Sem writer** em nenhum lugar do runtime.
7. **A ativação operacional NÃO escreve offering** (provado por 3 E2E: route T10, read T7, flow §10).
8. **Automático na ativação seria perigoso:** publica o tenant inteiro; não sabe qual empresa
   publicou; não é reversível por empresa; não audita; não checa KYB/capability; colapsa
   múltiplas empresas do mesmo tenant.

## 8. Decisão
Publicação/oferta da empresa PJ é um **ato soberano distinto** da ativação operacional. A
ativação grava o que a empresa **é** (o par); a publicação decide se o mundo pode **encontrar/
consumir** essa empresa por um conceito. Publicação é **company/page-actor-level**, gateada por
KYB e autoridade contextual, **reversível** e **auditável**. Writer automático em
`tenant_concept_offerings` durante a ativação é **proibido**. O shape atual é reader-model de
discovery (tenant×concept), insuficiente como fonte soberana de publicação de empresa específica;
não recebe writer novo até existirem norma + schema corretos.

## 9. Decisões D1–D12

**D1 — Publicação/oferta é ato soberano distinto.** Ativação operacional define o que a empresa
é (par `primary_*`). Publicação/oferta define se a empresa pode ser encontrada/consumida
publicamente por um conceito. Uma não implica automaticamente a outra. (Constituição Art. III/IV:
"visibilidade não vira poder"; EMPRESA_NASCIMENTO §8: empresa nasce inerte; SERVICE_CANONICO:
indexação/visibilidade é ato soberano próprio.)

**D2 — Proibição de publicação automática na ativação.** `activateCompanyOperationally` e a rota
de onboarding NÃO escrevem offering. Gravar o par `primary_*` NÃO cria descoberta pública. Writer
automático em `tenant_concept_offerings` durante a ativação é **proibido**.

**D3 — Granularidade correta.** A oferta/publicação de empresa é **company-level e
page-actor-level** — a unidade é empresa/page-actor×concept (eixo operacional, DECISION-0097 D7).
Tenant-level pode existir como agregação/read-model, **nunca** como fonte soberana de publicação
de uma empresa específica.

**D4 — Shape atual de `tenant_concept_offerings`.** É **reader-model/compat de discovery**
(tenant×concept), NÃO o shape final soberano de publicação. NÃO recebe writer novo até norma +
schema corretos existirem. O nome pode permanecer temporariamente, mas sua autoridade fica
limitada a read-model de descoberta (e mesmo essa leitura deve, no futuro, derivar de publicações
governadas — D9).

**D5 — Gate de KYB/fiscal.** Publicação/oferta com alcance público deve respeitar
`fiscal_identities.kyb_status='approved'` (KYB gateia alcance público, coerente com DECISION-0097
D3), salvo decisão posterior explicitamente mais restritiva ou de sandbox. A ativação operacional
pode existir com `kyb_status='pending'`; a publicação pública, **não**.

**D6 — Autoridade contextual.** Publicar/despublicar exige autoridade contextual sobre a empresa:
`company_users` owner/`can_manage_company`, agindo pelo **page-actor** operacional, com âncora no
actor humano responsável. Produto/frontend **não** cria autoridade (projeta verdade resolvida).

**D7 — Reversibilidade.** Publicação é reversível: publish / unpublish-retire / status-visibility.
Despublicar uma empresa **não** pode apagar a publicação de outra empresa do mesmo tenant/concept
(consequência direta de D3 — granularidade por empresa).

**D8 — Auditoria.** Publicação registra: quem publicou, quando publicou, quem despublicou, quando
despublicou, source/intent e motivo quando aplicável. Audit/append ou histórico é obrigatório no
schema futuro.

**D9 — Relação com discovery/matching.** Discovery/matching deve consumir somente publicações
governadas. O reader atual (`listTenantsOfferingConcept`, tenant×concept) é compat/read-model; o
reader futuro deve ser derivado de publicações company/page-actor-level, ou filtrado por elas.

**D10 — Relação com marketplace/hybrid.** Esta DECISION NÃO resolve `hybrid` (frente própria,
`DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN`). Publicação por concept NÃO depende de `hybrid`
atômico. Marketplace orchestration NÃO é SSOT de publicação.

**D11 — Schema-alvo futuro (autorizado a DESENHAR em frente própria, não a implementar agora).**
Um shape soberano de publicação deve conter, no mínimo: `tenant_id`; `company_id`; `page_actor_id`
(ou `actor_id`); `concept_id`; `status`/`visibility`; `published_at`; `retired_at`;
`created_by_actor_id`; `retired_by_actor_id`; `source`/`intent`; timestamps; constraint contra
duplicidade ATIVA (ex.: única publicação ativa por empresa×concept); FKs; reversibilidade. O nome
exato da tabela fica para o desenho técnico, mas a granularidade **company/page-actor×concept é
obrigatória**.

**D12 — Bloqueios.** Esta DECISION NÃO autoriza ainda: código; migration; writer; alteração de
`tenant_concept_offerings`; alteração em marketplace contextual; alteração em `hybrid`; publicação
automática; alteração de Bank; alteração de KYB writer; alteração de onboarding.

## 10. O que esta DECISION supera/ratifica
- **Ratifica e estende DECISION-0097** (dois momentos; page-actor; KYB gate) e **DECISION-0098**
  (par = SSOT da ativação): a publicação é o terceiro ato, posterior e distinto.
- **Resolve a ambiguidade de DECISION-0098 D9** ("tenant_concept_offerings candidato a oferta"):
  candidato apenas como read-model; o shape soberano é outro, a definir, company-level.
- **Ratifica** Constituição Art. III/IV, EMPRESA_NASCIMENTO §8 e SERVICE_CANONICO (visibilidade =
  ato soberano próprio).

## 11. O que NÃO está autorizado
Ver D12. Em particular: nenhum writer de oferta/publicação; nenhuma migration; nenhuma alteração
de `tenant_concept_offerings`, marketplace contextual, hybrid, Bank, KYB writer ou onboarding;
nenhuma publicação automática na ativação.

## 12. Impacto em DTs
- **Criada:** `DT-PJ-PUBLICATION-OFFERING-SOVEREIGN-SHAPE-MISSING` (OPEN) — falta schema/writer
  soberano de publicação company/page-actor-level; `tenant_concept_offerings` atual é
  tenant×concept insuficiente.
- `DT-PJ-ONBOARDING-DOMAIN-SELECTION-MISSING` → permanece PARTIALLY MITIGATED/GOVERNED (offering
  automático agora explicitamente BLOQUEADO por esta DECISION).
- `DT-PJ-OPERATIONAL-ACTIVATION-VOCABULARY-DRIFT` → permanece PARTIALLY MITIGATED/GOVERNED
  (registra a separação ativação vs publicação).
- `DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN` → permanece OPEN (publicação não resolve hybrid).
- `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` → permanece CLOSED (não reaberta).

## 13. Próximas frentes autorizáveis (sem execução nesta DECISION)
1. **Desenho técnico** (read-only → DESENHO) do schema/writer de publicação company/page-actor×
   concept (D11), com gates KYB/autoridade (D5/D6), reversibilidade (D7) e audit (D8) — depois,
   migration e writer manual gated em fatias próprias.
2. **Read-only marketplace `hybrid`→trilhos** (ortogonal; pode correr em paralelo).
3. Migração futura do reader de discovery para derivar de publicações governadas (D9).
Ordem recomendada: esta DECISION → desenho schema/writer de publicação → execução gated; o
read-only de hybrid é independente.

## 14. Referências normativas
Constituição (Art. I/III/IV/V/VII) · LEIS_OPERACIONAIS (Lei 5 financeiro, Lei 7 semântica) ·
SSOT_REGISTRY · LEI_DE_COERENCIA_SISTEMICA (§4.8 page-actor, §4.9 autoridade) · 07_NOMENCLATURA ·
18_DOMAIN_ONTOLOGY (CONCEPT/GRAPH) · REGRA_CANONICA_CRIACAO_DE_CONTEXT · EMPRESA_NASCIMENTO_CANONICO
(§8 inerte) · SERVICE_CANONICO (visibilidade = ato soberano) · DECISION-0097 · DECISION-0098.

## 15. Referências de estado/commits
HEAD origem `c72fdd72` ("test(pj): add onboarding activation flow e2e"). Cadeia runtime:
`F-PJ-ACTIVATION-ROUTE-WRITE-PAIR` (`4af65168`) · `F-PJ-ACTIVATION-READ-ENDPOINTS` (`e9fc1b00`) ·
`F-PJ-ONBOARDING-FRONTEND-ACTIVATION-PAIR` (`e0cc89c0`) · `F-PJ-ONBOARDING-ACTIVATION-FLOW-E2E`
(`c72fdd72`). Auditoria-base: relatório read-only `F-PJ-TENANT-CONCEPT-OFFERINGS` (esta sessão).
