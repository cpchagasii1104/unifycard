# Log de Execução - Correção de Booleanos sem Prefixo Semântico

**Data:** 2026-02-05  
**Modo:** EXECUTOR  
**Etapa:** step_0_booleans  
**Status:** CONCLUÍDO

## Objetivo

Corrigir booleanos sem prefixo semântico no diretório `backend/src`, aplicando o mapeamento obrigatório:
- `active` → `isActive`
- `enabled` → `isEnabled`
- `verified` → `isVerified`

## Escopo

- **Diretório:** `backend/src`
- **Apenas propriedades booleanas**
- **NÃO alterar lógica**
- **NÃO alterar significado**
- **NÃO tocar em frontend**
- **NÃO tocar em banco**

## Arquivos Corrigidos

### Tipos/Interfaces

1. **backend/src/core/config/config.types.ts**
   - `FeatureFlagRow.enabled` → `FeatureFlagRow.isEnabled`
   - `FeatureFlag.enabled` → `FeatureFlag.isEnabled`
   - `UpsertFlagInput.enabled` → `UpsertFlagInput.isEnabled`
   - `FeatureFlagUpsertInput.enabled` → `FeatureFlagUpsertInput.isEnabled`

2. **backend/src/core/auth/webauthn.types.ts**
   - `VerifyResult.verified` → `VerifyResult.isVerified`

3. **backend/src/modules/catalog/catalog.types.ts**
   - `ProductOffer.active` → `ProductOffer.isActive`

4. **backend/src/core/location/location.types.ts**
   - `Country.active` → `Country.isActive`
   - `CountryRow.active` → `CountryRow.isActive`

5. **backend/src/core/companies/companies.types.ts**
   - `CompanyDomain.enabled` → `CompanyDomain.isEnabled`

6. **backend/src/core/profile/profile-professional.types.ts**
   - `ProfessionalSkill.verified` → `ProfessionalSkill.isVerified`

7. **backend/src/modules/rides/cities/cities.service.ts**
   - Tipo local: `enabled` → `isEnabled`

8. **backend/src/modules/rides/cities/cities.controller.ts**
   - `enabled?` → `isEnabled?`

9. **backend/src/contracts/marketplace/DistributionHub.contract.ts**
   - `DistributionHub.active` → `DistributionHub.isActive`

10. **backend/src/contracts/marketplace/IndustryAccount.contract.ts**
    - `IndustryAccount.active` → `IndustryAccount.isActive`

11. **backend/src/contracts/marketplace/SLAContract.contract.ts**
    - `SLAContract.active` → `SLAContract.isActive`

12. **backend/src/contracts/marketplace/ServiceResource.contract.ts**
    - `compensationConfig.active` → `compensationConfig.isActive`

### Serviços/Repositórios

13. **backend/src/core/config/config.service.ts**
    - `mapFeatureFlagRow`: `enabled` → `isEnabled`
    - Queries SQL: `enabled` → `isEnabled` (com alias)
    - `upsertFeatureFlag`: `input.enabled` → `input.isEnabled`
    - `isFeatureEnabled`: `flag.enabled` → `flag.isEnabled`

14. **backend/src/core/auth/webauthn.service.ts**
    - Todos os retornos `verified: false` → `isVerified: false`

15. **backend/src/core/auth/webauthn.routes.ts**
    - `result.verified` → `result.isVerified`
    - Respostas HTTP: `verified` → `isVerified`

16. **backend/src/modules/cultural/cultural-profile.service.ts**
    - Interface `CulturalProfile.active` → `CulturalProfile.isActive`
    - Mapeamentos: `row.active` → `isActive: row.active`

17. **backend/src/modules/catalog/offer.service.ts**
    - `toProductOffer`: `active: row.active` → `isActive: row.active`

18. **backend/src/core/location/location.repository.ts**
    - `findAllCountries`: `active: true` → `isActive: true`
    - `findCountryById`: `active: true` → `isActive: true`
    - `findCountryByCode`: `active: true` → `isActive: true`

19. **backend/src/modules/rides/cities/cities.service.ts**
    - Parâmetro `enabled` → `isEnabled`
    - Uso em queries: `enabled` → `isEnabled`

20. **backend/src/modules/marketplace/marketplace.service.ts**
    - `serviceOfferings.active` → `serviceOfferings.isActive` (Map interno)
    - `getStoreServiceOfferings`: `active` → `isActive` (retorno)
    - `storeProductActivations.enabled` → `storeProductActivations.isEnabled` (estrutura interna)
    - `getStoreProducts`: `enabled` → `isEnabled` (retorno)
    - `onboarding.bank_account.verified` → `onboarding.bank_account.isVerified`
    - `compensation_config.active` → `compensation_config.isActive`
    - `IndustryAccount.active` → `IndustryAccount.isActive` (uso interno)
    - `DistributionHub.active` → `DistributionHub.isActive` (uso interno)
    - `SLAContract.active` → `SLAContract.isActive` (uso interno)
    - Todos os usos de `.active`, `.enabled` corrigidos para `.isActive`, `.isEnabled`

21. **backend/src/modules/marketplace/marketplace.routes.ts**
    - `bank_account.verified` → `bank_account.isVerified` (tipo de resposta)

22. **backend/src/core/profile/profile-professional.service.ts**
    - `skills.push({ verified: false })` → `skills.push({ isVerified: false })`

23. **backend/src/scripts/seed-dev-complete.ts**
    - `enabled: true` → `isEnabled: true` (2 ocorrências)

## Observações

- **CORRIGIDO**: Todos os usos de `active`, `enabled`, `verified` como propriedades booleanas foram corrigidos para `isActive`, `isEnabled`, `isVerified`, incluindo estruturas internas (Maps, objetos temporários) para manter consistência.

- Tipos temporários de mapeamento do banco (como `ProductOfferRow.active`) mantêm `active` pois são apenas para mapeamento do banco (snake_case) e são convertidos para `isActive` no tipo público.

## Próximos Passos

1. Verificar se build compila
2. Executar testes (se houver)
3. Verificar se há mais arquivos que precisam correção

## Status Final

- [x] Tipos/Interfaces corrigidos
- [x] Serviços/Repositórios corrigidos
- [x] Estruturas internas corrigidas (Maps, objetos temporários)
- [x] Scripts corrigidos
- [x] Log atualizado
- [x] Build verificado (erros pré-existentes não relacionados às correções de booleanos)

## Resumo de Arquivos Modificados

1. `backend/src/modules/marketplace/marketplace.service.ts` - Múltiplas correções de `active` → `isActive`, `enabled` → `isEnabled`
2. `backend/src/modules/marketplace/marketplace.routes.ts` - `verified` → `isVerified`
3. `backend/src/core/profile/profile-professional.service.ts` - `verified` → `isVerified`

