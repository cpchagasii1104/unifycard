# RFC — Resolução postal e governança de cidades no Location Core

**Status:** DECIDIDO · FASE B · PRÉ-MATERIAL
**Frente:** F-ADDRESS-CANONICAL-BINDING · FASE B (CEP/provider e resolução canônica territorial)
**Base:** rescue-structural @ `6c99d49f0` (GATE B0 concluído read-only) · Fase A/C e N3 seladas · Δbank=0
**Data:** 2026-07-13

## Contexto (GATE B0, read-only)
O GATE B0 mapeou o terreno CEP/provider e identificou:
- **Duas stacks CEP vivas:** canônica (`cep-provider.ts` + `geo-enrichment.service.ts`, cache-first, IBGE→city) e legada (`services/location/cep.service.ts` texto puro + `location-enrichment.service.ts` city-por-nome).
- A stack canônica ainda possui **`createCityFromExternal`** (cria city por IBGE como side-effect de enrich).
- A stack legada possui **`findOrCreateCity`/`findOrCreateState`** (INSERT em cities/states por `LOWER(TRIM(name))`).
- Rota **pública/unauth `POST /locations/enrich-from-cep`** que ESCREVE território.
- **Logging de resposta externa com PII** (`cep.service.ts` console.log de payload/endereço).
- `cities.external_code` (IBGE) preenchido nas 27 capitais, distinto, mas **sem unicidade governada** (só índice parcial).
- `neighborhood_aliases` = casa governada de aliases de bairro (vigência+source_kind; vazia).
- `cep_resolution_cache` já existe como cache/evidência derivada (city_external_code/neighborhood_name/source/hash).
- O catálogo de cidades cobre só as 27 capitais (não todos os municípios).
- Identificadores oficiais governados: `countries.iso_alpha2` UNIQUE; `states.abbreviation` UNIQUE(country,UF); `cities.external_code` NÃO-unique.

**Recomendação do GATE:** envelope **B** (fundação mínima + resolver read-only + aposentadoria dos bypasses), com esta decisão de fronteira registrada antes do material.

## Decisões (D-A … D-L)

**D-A · Natureza da Fase B.** A Fase B é serviço de RESOLUÇÃO e SUGESTÃO territorial, **não é writer de território**. Fluxo: country → normalizador postal → provider adapter → resposta validada → resolução contra o Location Core → sugestão → confirmação humana futura → writer SELADO da Fase C. A Fase B NÃO cria city/state/neighborhood/address/address_assignment; não escolhe Actor/tenant/role; não importa o repository privado da Fase C; não escreve Social/Bank.

**D-B · País é explícito.** Toda resolução postal exige país explícito (`countryId` ou ISO governado). CEP sem país não assume Brasil silenciosamente. Normalizador e providers são escolhidos pelo país. A regra brasileira de 8 dígitos NÃO é global; o mesmo código postal pode existir em países distintos. O nome "CEP" não prova que o país é Brasil.

**D-C · Código oficial de cidade.** Código externo isolado NÃO é identidade territorial global. A resolução oficial brasileira considera CONJUNTAMENTE país canônico + jurisdição estadual + código oficial da cidade + fonte/namespace. O material NÃO deve tratar `external_code` nu como universalmente único entre países/provedores; deve escolher a menor solução compatível com o schema vivo (unicidade escopada por país/jurisdição, código namespaced, ou estrutura oficial existente). Deve preservar: **BR + UF + código IBGE → no máximo uma city canônica**. Sem tabela territorial paralela; sem solução que impeça expansão internacional por colisão de códigos.

**D-D · Cidade ausente.** provider retorna cidade + código oficial válido + city inexistente no Location Core → **`canonical_city_missing`** (explícito, honesto, fail-closed). NUNCA: provider → INSERT automático em cities; nome+UF → findOrCreateCity; resposta de provider → autoridade para ampliar o catálogo.

**D-E · Ingestão de cidades.** A ingestão oficial de cidades NÃO pertence à Fase B — é frente futura própria (fonte oficial, manifest versionado, proveniência, idempotente, governada, autoridade explícita, guard+auditoria), doutrina semelhante à N3 ajustada ao catálogo de cidades. NUNCA sob demanda durante uma consulta de CEP. Não abrir agora.

**D-F · Estado.** state não é criado por provider nem resolvido só por nome livre; UF/código do provider = evidência/verificação; o state canônico deve ser coerente com a city canônica; incompatibilidade código×city×state → erro explícito; sem `findOrCreateState`. Sem mudança em `states.external_code` nesta decisão sem necessidade material provada.

**D-G · Bairro.** Bairro textual não é identidade; sempre escopado à cidade; provider não cria bairro; `neighborhoodId=null` é legítimo; match governado pode usar `neighborhood_aliases` DENTRO da mesma city; match textual nunca fora da city resolvida; sem match → pending; candidato exige confirmação; "Centro" em cidades diferentes nunca converge por nome. Estados: `resolved` / `candidate_requires_confirmation` / `pending` / `not_applicable`.

**D-H · Confirmação humana.** CEP sugere logradouro/city/bairro-exibível; número informado pelo usuário; complemento opcional; usuário visualiza e confirma; confirmação NÃO cria cityId/neighborhoodId inexistente; só a futura API/onboarding compõe Fase B + writer da Fase C. A Fase B isolada não grava o endereço.

**D-I · Cache e evidência.** `cep_resolution_cache` é cache/read-model derivado — não SSOT, não catálogo, não tabela de endereço; não decide cityId/neighborhoodId sozinho; guarda só evidência mínima/hash/metadados governados; sem payload bruto com PII desnecessária; divergência com o Location Core invalida o cache, não o Location Core. O material reusa o cache existente sem criar 2ª casa.

**D-J · Providers e fallback.** Provider é adapter externo, não autoridade; URL/base não vem do request; respostas validadas; fallback só por indisponibilidade governada; "not found" ≠ conflito automaticamente; providers discordantes → estado explícito; fallback não esconde conflito territorial; timeout/429/5xx/malformado com tratamento distinto. Estados: `provider_unavailable` / `provider_not_found` / `provider_conflict` / `malformed_provider_response` / `official_identifier_conflict`.

**D-K · Aposentadoria dos bypasses.** O futuro envelope material da Fase B deve eliminar/adaptar/bloquear NO MESMO ARCO: `findOrCreateCity`; `findOrCreateState`; `createCityFromExternal` como side-effect; `POST /locations/enrich-from-cep` como writer territorial; logging de payload com PII; chamadas diretas a providers fora dos adapters governados; duas stacks concorrentes. Não basta criar resolver novo mantendo os bypasses vivos.

**D-L · Rota e composição.** Nenhuma rota nova durante a fundação do resolver; rotas read-only existentes poderão delegar ao serviço canônico ou ser aposentadas; nenhuma rota cria city/state/address/assignment; a futura API/onboarding compõe `resolver B → confirmação → writer C`; a Fase B não importa o repository privado da Fase C; sem dependência circular.

## Envelope material futuro ratificado (um único arco, sob novo GO)
1. fundação mínima para resolução inequívoca por identificador oficial (unicidade conforme D-C, sem `external_code` nu global);
2. normalizador postal por país;
3. adapters governados ViaCEP/BrasilAPI;
4. `PostalAddressResolution` read-only;
5. resolução country/state/city contra Location Core;
6. bairro via alias/candidato/pending;
7. uso governado de `cep_resolution_cache`;
8. tratamento explícito de conflito e indisponibilidade;
9. aposentadoria das duas stacks concorrentes e seus writers;
10. remoção de logging de PII;
11. guard consolidado;
12. mutations e testes;
13. preservação byte-integral da Fase A e da Fase C;
14. Δbank=0.

## Escopo negativo
Esta decisão NÃO autoriza: código, migration, provider call, rota, frontend, onboarding, criação de city/state/neighborhood/address/assignment, ingestão oficial de cidades, seed, backfill, limpeza de fixtures, alteração da Fase A/C, Social, Bank, regional funds, split, ledger, Fase D.

**FASE B · DECISÃO DE FRONTEIRA REGISTRADA · MATERIAL NÃO INICIADO.**
