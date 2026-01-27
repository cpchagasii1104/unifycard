# SPRINT 75: PERFIS ERP + REGIME TRIBUTÁRIO

**Data:** 2024-12-19  
**Objetivo:** Permitir que cada empresa defina perfil ERP e regime tributário, com adaptação declarativa do sistema.

**Status:** ✅ CONCLUÍDO

---

## 1. RESUMO DAS MUDANÇAS

### 1.1. Migration Criada

**Arquivo:**
- `backend/migrations/206_create_company_profiles.sql` - Tabela `company_profiles`

**Estrutura:**

**company_profiles:**
- Perfis: `COMMERCE`, `SERVICE`, `EVENTS`, `FOOD`, `CLINIC`
- Regimes: `MEI`, `LUCRO_PRESUMIDO`, `LUCRO_REAL`
- Campos: tenant_id (unique), erp_profile, tax_regime, metadata
- RLS habilitado
- Apenas 1 perfil por tenant

### 1.2. Service Criado

**CompanyProfileService:**
- `setProfile()` - Define perfil (cria ou atualiza)
- `getProfile()` - Busca perfil

**Validações:**
- Apenas 1 perfil por tenant
- Mudança gera audit event

### 1.3. Integrações

**FiscalDocumentService:**
- Tipo sugerido pode depender do regime (futuro)
- Por enquanto, apenas estrutura preparada

**Preparação para:**
- Reports (Lucro Real → margem real habilitada)
- Automation (alertas fiscais futuros, read-only)

---

## 2. ESTRUTURA DE DADOS

### 2.1. company_profiles

```sql
CREATE TABLE company_profiles (
    tenant_id UUID PRIMARY KEY, -- 1 por tenant
    erp_profile erp_profile NOT NULL, -- COMMERCE | SERVICE | EVENTS | FOOD | CLINIC
    tax_regime tax_regime NOT NULL, -- MEI | LUCRO_PRESUMIDO | LUCRO_REAL
    created_by_actor_id UUID NOT NULL,
    created_by_user_id UUID,
    updated_by_actor_id UUID,
    updated_by_user_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

---

## 3. PERFIS ERP

### 3.1. Tipos de Perfil

**COMMERCE:**
- Comércio (lojas, e-commerce)
- Foco em produtos físicos
- Inventory management essencial

**SERVICE:**
- Serviços (consultoria, manutenção)
- Foco em Service Orders
- Agenda essencial

**EVENTS:**
- Eventos (shows, festas)
- Foco em Event Tickets
- Check-in essencial

**FOOD:**
- Bar/Restaurante
- Foco em PDV
- Mesa/comanda essencial

**CLINIC:**
- Clínica (saúde, estética)
- Foco em Service Orders + Agenda
- Paciente essencial

---

## 4. REGIMES TRIBUTÁRIOS

### 4.1. Tipos de Regime

**MEI:**
- Microempreendedor Individual
- Simplificado
- NFC-e geralmente suficiente

**LUCRO_PRESUMIDO:**
- Lucro Presumido
- Intermediário
- NF-e geralmente necessária

**LUCRO_REAL:**
- Lucro Real
- Complexo
- NF-e obrigatória
- Relatórios detalhados necessários

---

## 5. INTEGRAÇÕES (PREPARAÇÃO)

### 5.1. FiscalDocument

**Futuro:**
- MEI → sugerir NFC-e
- Lucro Presumido/Real → sugerir NF-e
- Por enquanto, apenas estrutura preparada

### 5.2. Reports

**Futuro:**
- Lucro Real → margem real habilitada
- MEI → relatórios simplificados
- Por enquanto, apenas estrutura preparada

### 5.3. Automation

**Futuro:**
- Criar alertas fiscais futuros (read-only)
- Obrigações fiscais baseadas em regime
- Por enquanto, apenas estrutura preparada

---

## 6. GUARDRAILS RESPEITADOS

### 6.1. Perfil ≠ Configuração Financeira

- ✅ Perfil é informativo
- ✅ Não altera configuração financeira
- ✅ Apenas modelagem

### 6.2. Regime ≠ Cálculo Automático

- ✅ Regime é informativo
- ✅ Não executa cálculo tributário
- ✅ Apenas flags

### 6.3. Tudo Informativo e Auditável

- ✅ Todas as mudanças geram audit event
- ✅ Contexto completo registrado
- ✅ Nada bloqueia operação

---

## 7. ARQUIVOS CRIADOS

### 7.1. Migration

1. `backend/migrations/206_create_company_profiles.sql`

### 7.2. Types

2. `backend/src/modules/marketplace/company-profile.types.ts`

### 7.3. Repository

3. `backend/src/modules/marketplace/company-profile.repository.ts`

### 7.4. Service

4. `backend/src/modules/marketplace/company-profile.service.ts`

### 7.5. Integrações

5. `backend/src/modules/marketplace/payment-execution.service.ts` (atualizado - estrutura preparada)

---

## 8. EXEMPLOS DE USO

### 8.1. Definir Perfil

```typescript
// Definir perfil de comércio com MEI
const profile = await companyProfileService.setProfile(tenantId, {
  erpProfile: 'COMMERCE',
  taxRegime: 'MEI',
  metadata: {
    cnae: '47.81-0-00',
  },
}, 'actor-123', 'user-123');
```

### 8.2. Buscar Perfil

```typescript
// Buscar perfil
const profile = await companyProfileService.getProfile(tenantId);
if (profile) {
  console.log(`Perfil: ${profile.erpProfile}, Regime: ${profile.taxRegime}`);
}
```

### 8.3. Usar Perfil em Lógica

```typescript
// Exemplo futuro: ajustar tipo de documento fiscal
const profile = await companyProfileService.getProfile(tenantId);
if (profile?.taxRegime === 'MEI') {
  // Sugerir NFC-e (simplificado)
  documentType = 'NFCE';
} else {
  // Sugerir NF-e (completo)
  documentType = 'NFE';
}
```

---

## 9. CRITÉRIO DE PRONTO

### ✅ Todos os Critérios Atendidos

1. **Perfil definível:**
   - ✅ `setProfile()` define perfil
   - ✅ Apenas 1 perfil por tenant

2. **Regime definível:**
   - ✅ `setProfile()` define regime
   - ✅ Valores: MEI, LUCRO_PRESUMIDO, LUCRO_REAL

3. **Estrutura preparada:**
   - ✅ FiscalDocument preparado (futuro)
   - ✅ Reports preparados (futuro)
   - ✅ Automation preparado (futuro)

4. **Nenhuma execução:**
   - ✅ Nenhum cálculo tributário executado
   - ✅ Nenhuma integração SEFAZ
   - ✅ Apenas modelagem e flags

5. **Tudo auditável:**
   - ✅ Todas as mudanças geram audit event
   - ✅ Contexto completo registrado

---

## 10. PRÓXIMOS PASSOS (FUTURO)

### 10.1. Integração com FiscalDocument (Futuro)

**Quando:** Criar documento fiscal

**O que fazer:**
- Ler perfil da empresa
- Sugerir tipo de documento baseado em regime
- MEI → NFC-e (simplificado)
- Lucro Presumido/Real → NF-e (completo)

### 10.2. Integração com Reports (Futuro)

**Quando:** Gerar relatórios

**O que fazer:**
- Lucro Real → habilitar margem real obrigatória
- MEI → relatórios simplificados
- Outros → relatórios padrão

### 10.3. Alertas Fiscais (Futuro)

**Quando:** Automation detecta obrigações

**O que fazer:**
- Criar alertas baseados em regime
- MEI → alertas simplificados
- Lucro Real → alertas detalhados
- Read-only (não executa nada)

---

**Fim do Relatório**




