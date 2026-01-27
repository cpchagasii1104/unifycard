# SPRINT 81: ERP POR SEGMENTO (PERFIS OPERACIONAIS)

**Data:** 2025-01-XX  
**Objetivo:** Permitir que o sistema se adapte ao tipo de negócio (COMÉRCIO, CLÍNICA, SALÃO, BAR/RESTAURANTE, SERVIÇOS), sem duplicar lógica e sem criar módulos paralelos  
**Status:** ✅ CONCLUÍDO

---

## 1. RESUMO

Sistema completo de segmentos de negócio com:
- ✅ Segmentos: COMMERCE, CLINIC, SALON, BAR_RESTAURANT, SERVICES
- ✅ Módulos habilitados por segmento
- ✅ Integração preparada para Dashboard
- ✅ Nenhuma lógica automática
- ✅ Apenas configuração estrutural

---

## 2. GUARDRAILS RESPEITADOS

### 2.1. Segmento ≠ permissão
- ✅ Segmento não concede permissões
- ✅ Segmento não altera autorização
- ✅ Apenas orientação de módulos

### 2.2. Segmento ≠ papel
- ✅ Segmento não define papéis
- ✅ Segmento não altera governança
- ✅ Apenas configuração operacional

### 2.3. Nenhuma lógica automática
- ✅ Não cria módulos novos
- ✅ Não bloqueia funcionalidade
- ✅ Apenas orienta e configura

### 2.4. Tudo auditável
- ✅ Todas as ações registradas
- ✅ Mudanças de segmento auditadas

---

## 3. MIGRATION

### 3.1. `218_create_business_segments.sql`
Tabela `business_segments`:
- `id`, `tenant_id`
- `company_profile_tenant_id` (FK → company_profiles)
- `segment_type` (COMMERCE | CLINIC | SALON | BAR_RESTAURANT | SERVICES)
- `enabled_modules` (JSONB array de strings)
- `metadata` (JSONB)
- `created_at`, `updated_at`
- Constraint UNIQUE: `(tenant_id)` - 1 segmento por tenant
- RLS habilitado
- Índices por tenant_id, company_profile_tenant_id, segment_type

---

## 4. SERVICES

### 4.1. BusinessSegmentService
**Arquivo:** `backend/src/modules/marketplace/business-segment.service.ts`

**Métodos:**
- `setSegment()` - Define segmento (cria ou atualiza)
- `getSegment()` - Busca segmento
- `updateSegment()` - Atualiza segmento
- `isModuleEnabled()` - Verifica se módulo está habilitado

**Validações:**
- ✅ Company profile obrigatório
- ✅ Apenas 1 segmento por tenant
- ✅ Módulos sugeridos por segmento (se não fornecido)

---

## 5. INTEGRAÇÕES

### 5.1. Dashboard (Preparado)
**Status:** Estrutura preparada

**Uso futuro:**
- Dashboard pode filtrar cards conforme segmento
- UI pode ocultar módulos não habilitados
- Backend continua validando tudo

**Nota:** Integração não implementada nesta sprint (apenas estrutura criada)

### 5.2. Company Profile
**Relação:**
- `business_segments` referencia `company_profiles(tenant_id)`
- Segmento requer company profile existente
- 1:1 entre tenant e segmento

### 5.3. Audit
**Eventos registrados:**
- `BUSINESS_SEGMENT_SET` - Quando segmento é criado/definido
- `BUSINESS_SEGMENT_UPDATED` - Quando segmento é atualizado

---

## 6. REGRAS DE NEGÓCIO

### 6.1. Segmentos e Módulos

**COMMERCE:**
- Módulos sugeridos: `pdv`, `inventory`, `marketplace`, `reports`
- Foco: PDV + estoque

**CLINIC:**
- Módulos sugeridos: `service_orders`, `calendar`, `reports`
- Foco: Agendamentos + serviços

**SALON:**
- Módulos sugeridos: `service_orders`, `calendar`, `reports`
- Foco: Agendamentos + serviços

**BAR_RESTAURANT:**
- Módulos sugeridos: `pdv`, `events`, `tickets`, `reports`
- Foco: PDV + eventos + bilheteria

**SERVICES:**
- Módulos sugeridos: `service_orders`, `calendar`, `marketplace`, `reports`
- Foco: Serviços + agendamentos

### 6.2. Módulos Disponíveis

**Chaves de módulos:**
- `pdv` - Ponto de Venda
- `inventory` - Estoque
- `service_orders` - Ordens de Serviço
- `events` - Eventos
- `tickets` - Bilheteria
- `marketplace` - Marketplace
- `calendar` - Agenda
- `reports` - Relatórios

### 6.3. Verificação de Módulo

**Método:**
```typescript
const isEnabled = await businessSegmentService.isModuleEnabled(tenantId, 'pdv');
```

**Comportamento:**
- Se segmento não existe: retorna `true` (compatibilidade)
- Se segmento existe: verifica se módulo está em `enabled_modules`

---

## 7. ROTAS REST

### 7.1. Criação e Atualização

- `POST /marketplace/business-segment` - Define segmento
- `PATCH /marketplace/business-segment` - Atualiza segmento

### 7.2. Consulta

- `GET /marketplace/business-segment` - Busca segmento

**Nota:** Rotas registradas em `marketplace.routes.ts` com prefix `/marketplace`

---

## 8. ARQUIVOS CRIADOS

### 8.1. Migration
- ✅ `backend/migrations/218_create_business_segments.sql`

### 8.2. Types
- ✅ `backend/src/modules/marketplace/business-segment.types.ts`

### 8.3. Repository
- ✅ `backend/src/modules/marketplace/business-segment.repository.ts`

### 8.4. Service
- ✅ `backend/src/modules/marketplace/business-segment.service.ts`

### 8.5. Routes
- ✅ `backend/src/modules/marketplace/business-segment.routes.ts`

### 8.6. Documentation
- ✅ `SPRINT_81_ERP_POR_SEGMENTO.md`

---

## 9. EXEMPLOS DE USO

### 9.1. Criar Segmento

```typescript
// Criar segmento para clínica
const segment = await businessSegmentService.setSegment(
  tenantId,
  {
    segmentType: 'CLINIC',
    enabledModules: ['service_orders', 'calendar', 'reports'],
  },
  userId
);
```

### 9.2. Verificar Módulo

```typescript
// Verificar se PDV está habilitado
const isPdvEnabled = await businessSegmentService.isModuleEnabled(tenantId, 'pdv');
if (isPdvEnabled) {
  // Mostrar módulo PDV
}
```

### 9.3. Atualizar Segmento

```typescript
// Adicionar módulo ao segmento
const segment = await businessSegmentService.getSegment(tenantId);
const updated = await businessSegmentService.updateSegment(
  tenantId,
  {
    enabledModules: [...segment.enabledModules, 'inventory'],
  },
  userId
);
```

---

## 10. OBSERVAÇÕES

### 10.1. Relação com Company Profile
- `business_segments` referencia `company_profiles(tenant_id)`
- Segmento requer company profile existente
- 1:1 entre tenant e segmento

### 10.2. Módulos Sugeridos
- Cada segmento tem módulos sugeridos
- Se `enabledModules` não fornecido, usa sugestões
- Usuário pode customizar módulos

### 10.3. Compatibilidade
- Se segmento não existe, todos os módulos estão disponíveis
- Não bloqueia funcionalidade existente
- Apenas orienta e configura

### 10.4. Futuras Integrações
- Dashboard: filtrar cards conforme segmento
- UI: ocultar módulos não habilitados
- Backend: continuar validando tudo

---

## 11. TESTES

**Pendente:**
- Testes unitários para services
- Testes de integração para rotas
- Testes de verificação de módulos

---

## 12. CONCLUSÃO

Sistema completo de segmentos de negócio implementado conforme especificação da Sprint 81. Todos os guardrails respeitados, estrutura preparada para integrações futuras e código auditável.

**Status:** ✅ CONCLUÍDO



