# Execution Log — DT-CONCEPTS-DOMAIN-LAYER-OVERLOAD (docs-only)

**Data:** 2026-06-04
**Modo:** EXECUTOR DOCS-ONLY CONTROLADO
**Branch:** `rescue-structural`
**HEAD origem:** `d3acb4f3`
**Frente:** registro do achado de `F-PJ-CANONICAL-DOMAINS-LIVE-RECONCILIATION`

---

## Objetivo
Registrar documentalmente a rachadura: `concepts.domain` está materialmente sobrecarregado (N0 de atuação + camada financeira + camada comercial `item-comercial`), bloqueando o mapeamento seguro `MarketplaceDomain → domínio canônico`. **NÃO decidir a solução. NÃO criar DECISION. Zero schema/runtime/frontend/DML.**

## Evidência material (SELECT live, `unificard_dev`, HEAD `d3acb4f3`)
- `domains` = **21** linhas = 12 N0 (`18_DOMAIN_ONTOLOGY §7`) + 1 condicional (`construcao-e-infraestrutura`, §8.1) + 7 `financeiro-*` + 1 `item-comercial`.
- `concepts` = 137; `concepts.domain` distinto = **13 domínios com concept**; **8 N0 são shells vazios** (0 concepts).
- Sobrecarga em 3 camadas num único campo `concepts.domain`: N0 de atuação / financeira (`financeiro-*`) / comercial (`item-comercial`).
- Split crítico: `produtos-e-comercio` (N0) = **5** concepts vs `item-comercial` = **35**.
- `concepts.domain ⊆ domains.domain_key` — **zero órfãos** (problema é semântico, não referencial).
- 7 company_types usam só `produtos-e-comercio` + `servicos`.
- N1/N2 vivos: `n1_nodes`=35, `n2_nodes`=12, `context_nodes`=25, `categories`=147.
- Origem dos extras (seed governado): `0073_domains_n0.sql`, `20260503200000_seed_concepts_item_comercial.sql`, `20260530507000_seed_concepts_financeiros.sql`, `20260530508000_seed_concepts_commerce.sql`.

## Ações realizadas (docs-only)
1. `REMEDIATION_DT_LOG.md` — criada `DT-CONCEPTS-DOMAIN-LAYER-OVERLOAD` (OPEN).
2. `STATUS_EXECUCAO_GLOBAL.md` — entrada de status (achado + bloqueio do marketplace-domain mapping).
3. `opus.md` — memória curta (cont.64).
4. Este execution log.

## O que ficou BLOQUEADO
- `F-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK-DECISION`
- camada `concept/company_type → allowed domains` (DECISION-0102 D5)
- qualquer mapeamento seguro `MarketplaceDomain → N0`
- uso direto de `concepts.domain` como se fosse apenas N0 de atuação

## O que NÃO ficou bloqueado
- CNAE evidence (concluída, DECISION-0104)
- CNAE seed (quando houver fonte oficial)
- ativação operacional pelo par (`primary_company_type_id`+`primary_concept_id`)
- publicação por concept (`company_concept_publications`)
- Bank/KYB

## Não-toque (confirmado)
- Zero schema/migration/backend/frontend/DML/marketplace/CNAE-seed.
- 3 autorais intocados (`CRIACAO_DE_EMPRESAS.md`, `criacao-de-empresa.png`, `fluxo-empresa.png`).

## Próximo passo recomendado
`F-CONCEPTS-DOMAIN-LAYER-SEMANTICS-DECISION-READONLY` — decisão de Clayton sobre: (1) `concepts.domain` multi-camada vs separar; (2) legitimidade de `item-comercial`; (3) `financeiro-*` como domínio de concept ou camada Bank; (4) agregação `item-comercial` → `produtos-e-comercio`; (5) separar `n0_domain`/`semantic_domain`/`layer` ou documentar a semântica vigente.

## Regra final
Registrar a rachadura. Não consertar a parede nesta fatia.
