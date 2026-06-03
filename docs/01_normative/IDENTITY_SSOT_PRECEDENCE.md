# Precedência de identidade (actors ↔ identities ↔ economic_identities)

**Estado:** contrato operacional — alinha implementação ao Gate 2 e ao `PLANO_BASE_MODULO.md` sem substituir `SSOT_REGISTRY_UNIFICARD.md` (actualizar esse registo quando o domínio estiver fechado).

## Verdade canónica (KYC / documento)

- **`identities`** é a autoridade de **dados fiscais e KYC** por `global_user_id` (`tax_id`, `tax_id_type`, `kyc_status`, `kyc_level`).
- **`global_user_id`** é a chave estável de pessoa no ecossistema (quando aplicável ao fluxo).

## Projeção operacional

- **`actors`** é **projeção operacional** (papel no tenant, tipo, relações de negócio). Deve referenciar `identities` via `global_user_id` quando o actor for humano sujeito a identidade global.
- Não duplicar decisão de KYC “na raça” em `actors` — campos fiscais/KYC vivem em **`identities`**.

## Camada económica derivada

- **`economic_identities`** (e eventos associados) é **derivada**: escopo por `tenant_id` + `actor_id`, limites, guardas — não substitui `identities` nem o Bank.

## Identidade fiscal de Pessoa Jurídica (PJ)

> **Fonte da regra:** `DECISION-0084` / D2 (princípio promulgado por Clayton), derivada de `DECISION-0081` (M0) e `DECISION-0082` (D1); contexto de vínculos em `DECISION-0083` (D3-princípio). **DECISION-0084 promulga a precedência da identidade fiscal PJ; este documento incorpora essa precedência à hierarquia operacional de identidades.** Esta seção **não** cria decisão nova e **não** substitui a DECISION-0084 — apenas a reflete na precedência operacional.

- **Escopo PF inalterado:** `identities` **permanece** a autoridade fiscal/KYC da **pessoa física** por `global_user_id`. A precedência PF acima **não** é reaberta nem alterada por esta seção. PF e PJ são **naturezas distintas em casas distintas** — não competem.
- **Casa própria, canónica e global (PJ):** a Pessoa Jurídica tem **identidade fiscal própria**, separada da pessoa física. Essa identidade é **canónica** (fonte da verdade do CNPJ) e **global**. O **CNPJ é a verdade** dessa identidade.
- **Autoridade fiscal/KYC/documental da empresa:** a futura camada fiscal PJ será a autoridade de KYC, documentos, validações, histórico, reputação e continuidade da **empresa/CNPJ** — não `companies` (projeção) nem o actor humano (responsável mutável).
- **`companies.cnpj` é projeção subordinada:** `companies.cnpj` é **reflexo operacional protegido e subordinado** à identidade fiscal PJ, **nunca** a fonte da verdade.
- **Precedência (PJ):** em conflito entre a identidade fiscal PJ canónica e `companies.cnpj` ou qualquer reflexo operacional, **vence a identidade fiscal PJ**.
- **Continuidade na transferência:** transferência/venda da empresa **não** cria nova identidade fiscal e **não** apaga histórico. O que muda são os **vínculos humanos** (quem responde, opera, representa); a identidade fiscal PJ permanece a **âncora estável** do CNPJ, histórico, documentos, validações e reputação.
- **Não soberania:** a identidade fiscal própria **não** torna a empresa autoridade soberana. Toda ação, decisão, operação ou consequência continua fechando em **CPF/actor humano responsável**, com vínculo formal, rastreável e auditável (coerente com M0 e D3).
- **Fronteira de desenho:** **nome de tabela, colunas, constraints, FK, writer e migration NÃO estão definidos por esta norma** — ficam para o desenho técnico posterior (D2-técnica), respeitando o schema vivo e a nomenclatura canónica.

## Ordem de leitura (conflito)

1. **`identities`** — documento / nível KYC.
2. **`actors`** — existência e papel na operação.
3. **`economic_identities`** — regras económicas no tenant.

## Regra de ouro

> Decisão de **dinheiro realizado** = sempre **`bank_ledger` / `bank_transactions`** (Bank).  
> Tabelas de log ou pré-financeiro (`unifycard_transactions`, `payment_intents`, …) **não** são SSOT de saldo.

## Violação crítica (fail conditions)

Tratar como **falha estrutural** (equivalente a violação de Gate 2 para o domínio de identidade) se:

- **Leitura de identidade fiscal/KYC** a partir de `actors` ou caches quando **`identities`** está disponível para o mesmo `global_user_id` sem reconciliação explícita.
- **`INSERT`/`UPDATE` directo em `actors`** que alterem semântica de pessoa/KYC **sem** sincronização com o writer canónico de `identities` (`identity.service.ts` e fluxos normados).
- **SQL ou relatórios** que usem em `WHERE` sobre `actors` campos que **só existem no CSV** do export CP-5 (ex.: **`batch2_hint`**) — não constam no DDL; o caminho normado é o `CASE` + CTE do `EXECUTAR/IDENTITY_RECONCILIATION_RUNBOOK.md`, espelhando `identity-cp5-export-a2-candidates.ts` (FASE S antes de predicado).
- Uso de **`economic_identities` como fonte primária** de “quem é a pessoa” ou de documento fiscal — é camada **derivada** por tenant, não substituto de `identities`.

**Resultado esperado:** parar implementação; PROPOSTA; registo em `FALSIFICATION_LOG.md` se houver risco de segunda verdade.

---

*Auditoria completa de DDL e writers: plano dedicado + FASE S.*

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- FALSIFICATION_LOG.md
- SSOT_REGISTRY_UNIFICARD.md

### Referenciado por
- 00_INDEX.md
- 00_SUMARIO.md
- ACTOR_TRACEABILITY_CONTRACT.md
- SSOT_REGISTRY_UNIFICARD.md
<!-- AUTO-GENERATED-END -->