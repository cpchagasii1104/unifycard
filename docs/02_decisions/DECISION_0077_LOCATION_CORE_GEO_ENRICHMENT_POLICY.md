# DECISION-0077 — Política de enriquecimento geográfico do Location Core (estratégia B+D+C; lat/lng coarse)

**Status:** RATIFICADA — DECISÃO DE ESTRATÉGIA/MODELAGEM (D-GEO). **DOCS-ONLY**; implementação não autorizada aqui (2026-06-02).
**Sessão:** 2026-06-02 (pós F-GEO READ-ONLY).
**Decisor:** Clayton (estratégia B+D+C sob demanda; lat/lng centroide coarse).
**Commit âncora:** HEAD origem `ff0a8c43`.
**Documento canônico:** este arquivo.
**Subordinada a:** `DECISION-0020`/`0021` (Location Core soberano), `DECISION-0074` (endereço civil PF → Location
Core), `DECISION-0076` (enriquecimento transitório do blob), `SSOT_REGISTRY_UNIFICARD.md`, LGPD (limite material).
**Vinculada a:** `DT-PERSONAL-ADDRESS-BLOB-TO-LOCATION-CORE` (OPEN), `DECISION-0075` §7 (fronteira endereço PJ).
**Escopo:** define a **estratégia compartilhável**; **NÃO** implementa e **NÃO** toca PJ/Companies (frente de outra instância).

---

## 1. Problema

- **Location Core é o SSOT** de endereço/localização (DECISION-0020/0074).
- **`addresses` não guarda city/state/neighborhood textual** — só FK `state_id`/`city_id`/`neighborhood_id`
  (**nullable**) + `postal_code`/`street`/`number`/`complement` + `lat`/`lng` + `is_geocoded`/`geocoded_at` +
  `source`. `cities` guarda **centroide lat/lng** + `external_code` (IBGE); `states` tem `abbreviation` (UF) +
  `external_code`.
- **Catálogo insuficiente (DEV):** `countries`=1, `states`=27 (todas UF), `cities`=**27 (só capitais; todas com
  centroide)**, `neighborhoods`=**0**. Sem tabela de faixa de CEP.
- **Sem resolver backend** CEP→UF/cidade/bairro e **sem geocoding** (o CEP-autofill `useProfileCep` é frontend e
  não persiste FK; BrasilAPI no backend só é usada p/ CNPJ). Único resolver vivo: `findStateByCode(country, UF)`.
- Por isso `profiles.metadata.address` ainda é usado **só como fallback transitório de exibição** de city/state/
  neighborhood no reader PF (DECISION-0076). `addresses` atuais: 3 rows, todas com state_id/city_id/lat/lng NULL.

## 2. Escolha — estratégia oficial **B + D + C sob demanda**

```text
B — resolver state_id por UF quando a UF estiver disponível (CEP-autofill / input). Ganho canônico imediato e barato.
D — usar resolver CEP → UF/cidade/código IBGE (ViaCEP/BrasilAPI ou equivalente) em FRENTE FUTURA (borda),
    populando FK + source='CEP_RESOLVED'/'EXTERNAL_API'. Bairro retorna como texto (sem catálogo de bairros).
C — criar/importar `cities` por external_code (IBGE) SOB DEMANDA quando o CEP retornar município ausente do
    catálogo (em vez de importar 5.570 de uma vez). Catálogo cresce dirigido por uso real.
lat/lng — default = CENTROIDE COARSE da cidade (de `cities.lat/lng`), NÃO coordenada precisa da residência.
```

Princípio (já no schema): *"CEP é UX, não fonte de verdade"* + *"external_code, não congelar BR"*. O SSOT é a
hierarquia FK por `external_code` (IBGE); CEP é **insumo de resolução**.

## 3. Privacidade / LGPD

- **Coordenada precisa de residência é dado pessoal sensível de localização** (localiza fisicamente a pessoa).
- Para **`RESIDENCE`**, o **padrão é centroide coarse da cidade** (não localiza a pessoa).
- **Geocoding preciso de residência** só pode nascer com **decisão própria de privacidade** (consentimento +
  visibility + e/ou RLS), à la DECISION-0071. `addresses` hoje **não tem RLS** (tabela compartilhada do Location
  Core) → coordenada precisa de residência ali, sem proteção, é vetado sem essa decisão.
- **`actor_active_location` ≠ residência civil** — é contexto espacial corrente (RLS-private/LGPD; feed/raio).

## 4. Fronteiras (vinculantes)

```text
RESIDENCE        ≠ actor_active_location   (contexto espacial corrente, não residência declarada)
RESIDENCE        ≠ OPERATIONAL             (ponto de operação de negócio / service_provider, PE-5)
RESIDENCE        ≠ HQ                       (sede de empresa/tenant)
Location Core    ≠ texto solto em metadata
CEP              = insumo de resolução, NÃO SSOT sozinho
```

## 5. PJ/Companies (insumo compartilhável — sem tocar PJ)

- **PJ/Companies NÃO devem criar resolver geo paralelo** nem assumir **cidade/UF textual canônica** em
  `addresses` (já em DECISION-0075 §7).
- Fiscalidade/região/geo/display de PJ devem usar o **mesmo F-GEO futuro** (catálogo IBGE + resolver CEP +
  centroide/geocoding) — um trilho único.
- Esta decisão é **insumo compartilhável**, **não** implementação PJ. A execução/decisão de PJ é frente própria
  (outra instância).

## 6. Cleanup do endereço PF

- **F3/F4/F5 do endereço PF continuam BLOQUEADOS** até o F-GEO implementar **ao menos `state_id`/`city_id`
  canônicos** (ou decisão explícita das pré-condições da DECISION-0076 §2.8).
- `profiles.metadata.address` **permanece como fallback transitório de exibição** de city/state/neighborhood.
- **Não remover o blob antes disso.**

## 7. Sequência futura recomendada (não autorizada aqui)

```text
D-GEO    — esta decisão (docs-only)
F-GEO-1  — resolver CEP→UF/cidade + catálogo IBGE/external_code (state_id por UF + cidade por IBGE sob demanda)
F-GEO-2  — enrich dos addresses existentes (backfill: state_id/city_id + lat/lng centroide; source CEP_RESOLVED)
F-GEO-3  — core.service deixa de depender do blob para city/state/neighborhood
F-GEO-4  — cleanup de profiles.metadata.address do PF (= F4 do endereço PF)
F-GEO-5  — selo / CLOSE da frente geo + endereço PF, se aplicável
```

## 8. Vetos permanentes

```text
❌ criar coluna city/state/neighborhood TEXTUAL em addresses sem decisão nova
❌ match frágil por nome livre (resolução de cidade sem catálogo/IBGE)
❌ usar actor_active_location como residência
❌ geocodificar residência com coordenada precisa sem política de privacidade (consent/visibility/RLS)
❌ chamar API externa sem frente própria (F-GEO-1)
❌ tocar PJ/Companies/company address nesta instância
❌ limpar o blob (metadata.address) nesta decisão
❌ implementar (código/migration/runtime) nesta fatia
```

## 9. Superada por

(em aberto — decisão vigente)
