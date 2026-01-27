# SPRINT 80: FISCAL REAL POR REGIME TRIBUTÁRIO (READ + ADAPTER)

**Data:** 2025-01-XX  
**Objetivo:** Preparar o sistema para operar corretamente com diferentes regimes tributários brasileiros (MEI, Simples, Presumido, Real), SEM calcular imposto automaticamente e SEM integrar SEFAZ real ainda  
**Status:** ✅ CONCLUÍDO

---

## 1. RESUMO

Sistema completo de perfis fiscais com:
- ✅ Perfis fiscais detalhados por regime tributário
- ✅ Validação de tipos de documento fiscal permitidos
- ✅ Integração com FiscalDocument
- ✅ Nenhum cálculo de imposto
- ✅ Apenas validação estrutural

---

## 2. GUARDRAILS RESPEITADOS

### 2.1. Não calcular imposto
- ✅ Regime tributário ≠ cálculo automático
- ✅ Nenhum imposto é calculado
- ✅ Nenhuma alíquota aplicada

### 2.2. Não emitir fiscal automaticamente
- ✅ Não integra SEFAZ real
- ✅ Não emite documento automaticamente
- ✅ Apenas validação estrutural

### 2.3. Regime tributário ≠ pagamento
- ✅ Regime não influencia pagamento
- ✅ Regime não bloqueia transações
- ✅ Apenas validação de tipos permitidos

### 2.4. Tudo auditável
- ✅ Todas as ações registradas
- ✅ Mudanças de perfil fiscal auditadas
- ✅ Validações registradas

---

## 3. MIGRATION

### 3.1. `217_create_tax_profiles.sql`
Tabela `tax_profiles`:
- `id`, `tenant_id`
- `company_profile_tenant_id` (FK → company_profiles)
- `tax_regime` (MEI | SIMPLES | PRESUMIDO | REAL)
- `state` (UF), `city`
- `is_icms_contributor` (boolean)
- `is_service_provider` (boolean)
- `metadata` (JSONB)
- `created_at`, `updated_at`
- Constraint UNIQUE: `(tenant_id)` - 1 perfil por tenant
- RLS habilitado
- Índices por tenant_id, company_profile_tenant_id, tax_regime, state

---

## 4. SERVICES

### 4.1. TaxProfileService
**Arquivo:** `backend/src/modules/marketplace/tax-profile.service.ts`

**Métodos:**
- `setTaxProfile()` - Define perfil fiscal (cria ou atualiza)
- `getTaxProfile()` - Busca perfil fiscal
- `updateTaxProfile()` - Atualiza perfil fiscal
- `validateDocumentType()` - Valida se tipo de documento é permitido
- `resolveTaxProfile()` - Resolve tax profile para uso em validações

**Validações:**
- ✅ Company profile deve existir antes de criar tax profile
- ✅ Apenas 1 perfil fiscal por tenant
- ✅ Tipos de documento validados por regime

---

## 5. INTEGRAÇÕES

### 5.1. FiscalDocument

**Integração:**
- `FiscalDocumentService.createFromOrder()` agora valida tipo de documento
- Validação verifica se tipo é permitido pelo regime tributário
- Erro lançado se tipo não permitido

**Tipos permitidos por regime:**
- `MEI`: NFC-e, NFS-e
- `SIMPLES`: NFC-e, NF-e, NFS-e
- `PRESUMIDO`: NF-e, NFS-e
- `REAL`: NF-e, NFS-e

**Código:**
```typescript
// SPRINT 80: Validar se tipo de documento é permitido pelo regime tributário
if (documentType !== 'NONE') {
  const { taxProfileService } = await import('./tax-profile.service');
  const validation = await taxProfileService.validateDocumentType(tenantId, documentType);
  if (!validation.allowed) {
    throw new Error(validation.reason || 'Tipo de documento não permitido para o regime tributário');
  }
}
```

### 5.2. Company Profile

**Relação:**
- `tax_profiles` referencia `company_profiles(tenant_id)`
- Tax profile requer company profile existente
- 1:1 entre tenant e tax profile

### 5.3. Audit

**Eventos registrados:**
- `TAX_PROFILE_SET` - Quando perfil fiscal é criado/definido
- `TAX_PROFILE_UPDATED` - Quando perfil fiscal é atualizado

---

## 6. REGRAS DE NEGÓCIO

### 6.1. Criação de Tax Profile

**Fluxo:**
1. Validar que company profile existe
2. Criar tax profile com regime, estado, cidade, flags
3. Registrar auditoria

**Validações:**
- ✅ Company profile obrigatório
- ✅ Tax regime obrigatório
- ✅ Apenas 1 perfil por tenant

### 6.2. Validação de Tipos de Documento

**Regras:**
- MEI → NFC-e, NFS-e
- SIMPLES → NFC-e, NF-e, NFS-e
- PRESUMIDO → NF-e, NFS-e
- REAL → NF-e, NFS-e

**Validação:**
- Executada em `FiscalDocumentService.createFromOrder()`
- Erro lançado se tipo não permitido
- Não bloqueia se tax profile não existir (compatibilidade)

### 6.3. Flags Tributárias

**is_icms_contributor:**
- Indica se empresa é contribuinte de ICMS
- Importante para validações futuras
- Não calcula ICMS

**is_service_provider:**
- Indica se empresa presta serviços
- Importante para NFS-e
- Não calcula ISS

### 6.4. Localização

**state (UF):**
- Importante para ICMS (varia por estado)
- Validações futuras podem usar este campo
- Não calcula imposto

**city:**
- Importante para ISS (varia por cidade)
- Validações futuras podem usar este campo
- Não calcula imposto

---

## 7. ROTAS REST

### 7.1. Criação e Atualização

- `POST /marketplace/tax-profile` - Define perfil fiscal
- `PATCH /marketplace/tax-profile` - Atualiza perfil fiscal

### 7.2. Consulta

- `GET /marketplace/tax-profile` - Busca perfil fiscal

**Nota:** Rotas registradas em `marketplace.routes.ts` com prefix `/marketplace`

---

## 8. ARQUIVOS CRIADOS

### 8.1. Migration
- ✅ `backend/migrations/217_create_tax_profiles.sql`

### 8.2. Types
- ✅ `backend/src/modules/marketplace/tax-profile.types.ts`

### 8.3. Repository
- ✅ `backend/src/modules/marketplace/tax-profile.repository.ts`

### 8.4. Service
- ✅ `backend/src/modules/marketplace/tax-profile.service.ts`

### 8.5. Routes
- ✅ `backend/src/modules/marketplace/tax-profile.routes.ts`

### 8.6. Integração
- ✅ `backend/src/modules/marketplace/fiscal-document.service.ts` (atualizado)

### 8.7. Documentation
- ✅ `SPRINT_80_FISCAL_REGIME_TRIBUTARIO.md`

---

## 9. EXEMPLOS DE USO

### 9.1. Criar Tax Profile

```typescript
// Criar perfil fiscal para MEI
const taxProfile = await taxProfileService.setTaxProfile(
  tenantId,
  {
    taxRegime: 'MEI',
    state: 'SP',
    city: 'São Paulo',
    isIcmsContributor: false,
    isServiceProvider: true,
  },
  userId
);
```

### 9.2. Validar Tipo de Documento

```typescript
// Validar se NFC-e é permitido para MEI
const validation = await taxProfileService.validateDocumentType(
  tenantId,
  'NFCE'
);
// Retorna: { allowed: true } ou { allowed: false, reason: '...' }
```

### 9.3. Atualizar Tax Profile

```typescript
// Atualizar apenas estado
const updated = await taxProfileService.updateTaxProfile(
  tenantId,
  {
    state: 'RJ',
  },
  userId
);
```

---

## 10. OBSERVAÇÕES

### 10.1. Relação com Company Profile
- `tax_profiles` referencia `company_profiles(tenant_id)`
- Tax profile requer company profile existente
- 1:1 entre tenant e tax profile

### 10.2. Regimes Tributários
- `MEI`: Microempreendedor Individual
- `SIMPLES`: Simples Nacional
- `PRESUMIDO`: Lucro Presumido
- `REAL`: Lucro Real

**Nota:** `company_profiles` usa `MEI`, `LUCRO_PRESUMIDO`, `LUCRO_REAL`. `tax_profiles` adiciona `SIMPLES` e usa nomes mais descritivos.

### 10.3. Validação de Documentos
- Validação executada em `FiscalDocumentService.createFromOrder()`
- Não bloqueia se tax profile não existir (compatibilidade)
- Erro lançado apenas se tipo não permitido

### 10.4. Futuras Integrações
- Cálculo de impostos (futuro)
- Integração com SEFAZ (futuro)
- Validações de campos obrigatórios (futuro)
- Apenas estrutura preparada nesta sprint

---

## 11. TESTES

**Pendente:**
- Testes unitários para services
- Testes de integração para rotas
- Testes de validação de tipos de documento
- Testes de integração com FiscalDocument

---

## 12. CONCLUSÃO

Sistema completo de perfis fiscais implementado conforme especificação da Sprint 80. Todos os guardrails respeitados, integração com FiscalDocument funcional e código auditável.

**Status:** ✅ CONCLUÍDO



