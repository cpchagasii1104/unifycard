# DECISION-0102 — Governança de elegibilidade de domínios de atuação no onboarding PJ

**Data:** 2026-06-04
**Tipo:** Arquitetura / Governança de produto / Semântica PJ
**Status:** PROMULGADA (docs-only — não autoriza código/schema/migration/frontend)
**Frente:** `F-PJ-ONBOARDING-DOMAIN-ELIGIBILITY`
**HEAD de origem:** `454d74d3`

---

## 1. Título
Domínio de atuação da empresa PJ **não é livre escolha de frontend**: é **derivado** de evidência
fiscal/semântica e **governado pelo backend** a partir de CONCEPT. A empresa pode **solicitar**, mas só
**publica** no que for **elegível/aprovado**. Decide quem pode pedir qual palco — não abre o palco.

## 2. Data
2026-06-04.

## 3. Tipo
Arquitetura / Governança de produto / Semântica PJ. Docs-only.

## 4. Status
PROMULGADA. Não autoriza código, schema, migration ou frontend (ver §11/§Bloqueios).

## 5. Contexto
A tela viva "Em quais áreas sua empresa atua?" (`frontend/src/components/company/DomainSelector.tsx`, usada no
fluxo de criação via `CompaniesManager`) oferece **livre escolha por checkbox** de 6 domínios de marketplace
(Mercado & Shop / Serviços / Eventos / Imóveis / Veículos / Empregos). Isso dá poder ontológico ao usuário
cedo demais — "Uber de ontologia sem volante". É um fluxo **distinto** do `CompanyOnboardingWizard` (que já
grava o par soberano de ativação `(primary_company_type_id, primary_concept_id)`). A frente read-only
`F-PJ-ONBOARDING-DOMAIN-ELIGIBILITY` auditou o runtime e a regra precisa ser cravada **antes** de schema/código.

## 6. Problema
O usuário pode declarar atuação em qualquer domínio sem comprovar o ramo real. Não há gate de compatibilidade
com CNAE/atividade fiscal nem com CONCEPT. Pior: o passo é **obrigatório** mas o destino é um **ghost** (ver
§7). Se religado sem governança, vira uma **terceira verdade** de "o que a empresa faz", concorrendo com o par
soberano, com `company_concept_publications` e com `concepts.domain` — segunda-verdade ontológica (viola Lei 7
/ DECISION-0098). Domínios regulados (Imóveis/Veículos) e capability de contratação (Empregos) ficam abertos por
checkbox.

## 7. Evidência material (auditoria read-only F-PJ-ONBOARDING-DOMAIN-ELIGIBILITY)
1. Tela = `DomainSelector.tsx`, no fluxo de criação via `CompaniesManager` — **distinto** do `CompanyOnboardingWizard`.
2. O wizard já grava o par soberano de ativação; o DomainSelector NÃO.
3. `DomainSelector` oferece livremente: `market`, `services`, `events`, `real_estate`, `vehicles`, `jobs`.
4. Esses valores são `MarketplaceDomain`, **hardcoded no frontend**.
5. `createCompany` envia `domains`.
6. `companies.service.createCompany` tenta, **pós-commit**, `INSERT INTO company_domains (...)` (default `['market']`).
7. `company_domains` **NÃO existe** (ausente em migrations e em dev).
8. O erro 42P01 é **engolido** como "pós-commit não-crítico".
9. Resultado: campo obrigatório de domínio é **fantasma** — o usuário crê que declarou atuação; nada soberano persiste.
10. Se `company_domains` for criada/religada sem governança → terceira verdade de atuação concorrente ao par
    `(primary_company_type_id, primary_concept_id)`, a `company_concept_publications` e a `concepts.domain`.
11. CNAE é retornado por `fetchCNPJFromRevenue`, mas **não é persistido**.
12. Não há matriz CNAE → concept.
13. Não há matriz concept/company_type → domínios elegíveis (mas é **DERIVÁVEL** hoje:
    `company_type_allowed_concepts ⋈ concepts.domain` → 1 domínio N0 por type).
14. **Fork de vocabulário:** `MarketplaceDomain` (6: market/services/events/real_estate/vehicles/jobs) ≠
    `concepts.domain` N0 (13 canônicos). Sem mapeamento entre eles.
15. "Empregos" não deve ser domínio de atuação — é capability transversal de contratação.
16. Imóveis/Veículos = domínios regulados/sensíveis; não podem ser checkbox livre.
17. Consultoria não pode se declarar Mercado/Imóveis/Veículos/Eventos sem concept/evidência/revisão compatível.
18. Restaurante: Serviços base; Mercado/cardápio/delivery exige concept relacionado; Eventos só com concept de venue.

## 8. Decisão
Domínio de atuação é **derivado de CONCEPT** e **governado pelo backend**, nunca escolhido livremente pelo
frontend. A empresa atravessa seis camadas (fiscal → identidade → elegível → solicitado → aprovado → em-revisão).
Evidência fiscal (CNPJ/CNAE/Receita) **sugere/reforça**, não aprova/publica sozinha. O `DomainSelector` livre e o
`company_domains` ghost são drift a corrigir. O fork `MarketplaceDomain ↔ concepts.domain` deve ser reconciliado
antes de religar marketplace. Empregos = capability; Imóveis/Veículos = regulados. **Nada de código/schema/frontend
nesta DECISION** — só a norma de quem pode pedir qual palco.

## 9. Decisões D1–D14

**D1 — Domínio de atuação NÃO é livre escolha.** A empresa não escolhe livremente onde aparece. Domínios de
atuação são derivados de evidências fiscais/semânticas e governados pelo backend (frontend não cria taxonomia
nem autoridade — `project_frontend_nunca_cria_verdade`).

**D2 — CONCEPT é a fonte semântica.** A identidade semântica é o `primary_concept_id`, dentro do par
`(primary_company_type_id, primary_concept_id)`. CNAE, Receita, razão social e natureza jurídica são
**evidências**, não identidade operacional final.

**D3 — Modelo em seis camadas.** Normatizar: (1) evidência fiscal; (2) identidade operacional; (3) domínios
elegíveis; (4) domínios solicitados; (5) domínios aprovados; (6) domínios em revisão.

**D4 — Evidência fiscal.** CNPJ/Receita/CNAE devem **sugerir/reforçar** company_type/concept/domínios, mas **não
publicar nem aprovar** domínio sozinhos. CNAE deve ser **persistido em frente futura** como evidência auditável,
não como SSOT semântico.

**D5 — Domínios elegíveis.** Derivados de: `primary_concept_id`; `company_type_allowed_concepts`;
`concepts.domain`; e, futuramente, relação **GRAPH/concepts relacionados** quando governado.

**D6 — Domínios solicitados.** O usuário pode **solicitar** domínios adicionais, mas solicitação **não é
aprovação**. Pedido incompatível vira **revisão**, não publicação.

**D7 — Domínios aprovados.** Domínio aprovado = subconjunto elegível/autorizado que pode participar de
publicação/oferta. Publicação continua dependendo de **KYB + ato soberano** (DECISION-0099/0101).

**D8 — Domínios em revisão.** Domínio fora da elegibilidade automática vai para **revisão/comprovação
adicional**. Ex.: consultoria pedindo Mercado & Shop; restaurante pedindo Eventos; qualquer empresa pedindo
Imóveis/Veículos sem concept específico.

**D9 — `DomainSelector` atual é DRIFT.** O `DomainSelector.tsx` com checkboxes livres é drift; **não pode** ser
fonte de verdade. Deve ser **removido, desabilitado ou convertido em "solicitação de domínios" governada** em
frente futura.

**D10 — `company_domains` atual é GHOST.** É ghost material: backend tenta gravar; tabela não existe; erro
engolido pós-commit; UX parece salvar algo que não existe. Vira DT específica (`DT-PJ-COMPANY-DOMAINS-GHOST-WRITER`).

**D11 — Fork de vocabulário.** `MarketplaceDomain` e `concepts.domain` são vocabulários paralelos. Antes de
religar marketplace/domínios, é **obrigatório reconciliar** market/services/events/real_estate/vehicles/jobs com
N0/concepts/domains canônicos (`DT-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK`; liga a hybrid).

**D12 — Empregos.** Empregos **não é** domínio de atuação principal da empresa; é **capability transversal de
contratação/recrutamento**. Não deve aparecer como opção livre de "área de atuação" sem decisão própria.

**D13 — Imóveis e Veículos.** São domínios **regulados/específicos**. Exigem concept/ramo/evidência compatível e
possivelmente KYB/revisão específica. **Não podem ser checkbox livre.**

**D14 — Exemplos normativos (consultoria / restaurante).**
- **Consultoria:** Serviços permitido; Mercado/Eventos só com concept/evidência/revisão; Imóveis/Veículos bloqueados.
- **Restaurante:** Serviços base; Mercado/Cardápio/Delivery só com concept relacionado; Eventos só com concept de
  venue/evento; Empregos como capability (não domínio).

## 10. O que esta DECISION ratifica
- **Ratifica e aprofunda** DECISION-0098 (par = SSOT; businessType/businessCategory/hybrid = legado; eixo A N0 ×
  eixo B vertical) e DECISION-0099/0100/0101 (publicação só após KYB + ato soberano).
- **Ratifica** Lei 7 (CONCEPT = identidade), `project_frontend_nunca_cria_verdade`, EMPRESA_NASCIMENTO §8
  (empresa nasce inerte), 18_DOMAIN_ONTOLOGY (N0 canônico).

## 11. O que NÃO está autorizado
Esta DECISION NÃO autoriza: código; migration; criação de `company_domains`; frontend fix; alteração em
marketplace; alteração em publication; alteração em KYB; alteração em Bank; auto-mapeamento de CNAE; escolha
livre de domains; religar `DomainSelector` como fonte soberana.

## 12. Impacto em DTs
- `DT-PJ-ONBOARDING-DOMAIN-SELECTION-MISSING` → permanece PARTIALLY MITIGATED / GOVERNED (regra de elegibilidade
  definida; execução futura).
- **Criada** `DT-PJ-COMPANY-DOMAINS-GHOST-WRITER` (OPEN) — INSERT pós-commit em `company_domains` inexistente
  (42P01 engolido); campo obrigatório da UI não persiste.
- **Criada** `DT-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK` (OPEN) — `MarketplaceDomain` hardcoded ≠ `concepts.domain`/N0.
- **Criada** `DT-PJ-CNAE-EVIDENCE-NOT-PERSISTED` (OPEN) — Receita retorna CNAE/atividade mas não é persistida para
  governar elegibilidade.
- `DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN` → permanece OPEN; reforçada (marketplace domain/hybrid ≠ SSOT).
- **Não reabrir:** `DT-PJ-PUBLICATION-OFFERING-SOVEREIGN-SHAPE-MISSING` · `DT-PJ-TENANT-CONCEPT-OFFERINGS-LEGACY-REBUILD`
  · `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` (todas CLOSED).

## 13. Próximas frentes autorizáveis (sem execução nesta DECISION)
1. **`F-PJ-DOMAIN-SELECTOR-NEUTRALIZE` (read-only/desenho → frontend):** neutralizar a livre-escolha (remover/
   desabilitar ou converter em "solicitação" governada) e tratar o ghost `company_domains` (parar o write
   morto). Resolve a UX mentirosa imediata sem inventar verdade.
2. **`F-PJ-CNAE-EVIDENCE-PERSIST` (read-only/desenho):** persistir CNAE/atividade da Receita como evidência
   auditável que sugere company_type/concept (não SSOT).
3. **`F-PJ-DOMAIN-ELIGIBILITY-DERIVATION` (read-only/desenho → schema):** materializar/derivar a matriz de
   domínios elegíveis (concept/company_type → domínios, com GRAPH governado) e reconciliar o fork de vocabulário.
Ordem recomendada: neutralizar drift (1) → persistir evidência (2) → derivar elegibilidade (3). Marketplace-hybrid
é ortogonal e ligado a D11.

## 14. Referências normativas
Constituição (Art. I/III/IV) · LEIS (Lei 7 semântica) · SSOT_REGISTRY · LEI_DE_COERENCIA · 07_NOMENCLATURA ·
18_DOMAIN_ONTOLOGY (N0 canônico) · REGRA_CANONICA_CRIACAO_DE_CONTEXT · EMPRESA_NASCIMENTO_CANONICO (§8) ·
SERVICE_CANONICO · DEFINICAO_DE_PRODUTO.MD (catálogo herdado por tipo) · DECISION-0097/0098/0099/0100/0101 ·
`project_frontend_nunca_cria_verdade`.

## 15. Referências de estado/commits
HEAD origem `454d74d3` ("decisions: define PJ KYB revocation publication cascade"). Evidência material:
`frontend/src/components/company/DomainSelector.tsx`, `frontend/src/components/CompaniesManager.tsx`,
`frontend/src/api/companies.ts` (`MarketplaceDomain`, `domains`), `backend/src/core/companies/companies.service.ts`
(`createCompany` → ghost `company_domains` pós-commit, `fetchCNPJFromRevenue` descarta CNAE),
`company_type_allowed_concepts ⋈ concepts.domain` (derivação viva). Auditoria read-only `F-PJ-ONBOARDING-DOMAIN-ELIGIBILITY`.

---

## 16. Nota-forward (2026-06-05) — correção descritiva pela DECISION-0105

A DECISION-0105 (`concepts.domain` é dimensão semântica multi-camada) **supera a caracterização descritiva** "13 canônicos" usada em §7 (evidência: "`concepts.domain` N0 (13 canônicos)"). O **NÚMERO 13** está correto como contagem de valores distintos de `concepts.domain`, mas o **RÓTULO "N0 canônicos" é impreciso**: por 0105, desses 13 valores, 7 são `financeiro-*` (autorizados pela RFC C2) e 1 é `item-comercial` — só ~5 são N0 de atuação. A **DECISÃO** desta 0102 (domínio de atuação deriva de CONCEPT + evidência fiscal; modelo de 6 camadas; fork `MarketplaceDomain ↔ concepts.domain` a reconciliar) **permanece integralmente vigente** — só a frase descritiva da contagem foi superada. **NB:** a frase "1 domínio N0 por type" (§7) permanece **CORRETA** — os domínios dos 7 company_types (`produtos-e-comercio`/`servicos`) são N0 de atuação legítimos. Ver DECISION-0105 §3/§4.
