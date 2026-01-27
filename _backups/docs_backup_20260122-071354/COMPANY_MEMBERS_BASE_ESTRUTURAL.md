# Company Members: Base Estrutural para Equipes e Delegação

**Data**: 2024-12-19  
**Escopo**: Base estrutural para equipes, funcionários e delegação (SEM CRM/ERP completo)

---

## 1. OBJETIVO

Criar a **BASE ESTRUTURAL** para permitir que:
- Uma empresa tenha funcionários
- Funcionários sejam actors CPF independentes
- Empresa possa atribuir compromissos (availability) a funcionários
- Conflitos de agenda sejam detectados (alerta, não bloqueio)

---

## 2. MODELO DE DADOS

### 2.1. Tabela `company_members`

**Arquivo**: `migrations/147_company_members.sql`

**Campos**:
- `member_id`: UUID (PK)
- `tenant_id`: UUID (FK → tenants)
- `company_id`: UUID (FK → companies)
- `actor_id`: UUID (FK → actors, onde `actor_type = 'user'`)
- `role`: ENUM ('admin', 'staff', 'contractor')
- `status`: ENUM ('active', 'invited', 'suspended')
- `metadata`: JSONB
- `created_at`, `updated_at`: TIMESTAMPTZ

**Constraints**:
- UNIQUE (`company_id`, `actor_id`) - Apenas um membro por empresa para o mesmo actor

### 2.2. Relacionamentos

```
companies (1) ──< (N) company_members (N) >── (1) actors
                                              (actor_type = 'user')
```

**🔴 BLINDAGEM**: 
- Funcionários são **actors CPF independentes**
- Empresa **NÃO duplica** users
- Empresa **NÃO edita** agenda pessoal do funcionário

---

## 3. INTEGRAÇÃO COM AVAILABILITY

### 3.1. Atribuição de Compromissos

**Fluxo**:
1. Empresa cria `availability` (owner_type = 'group' ou 'service')
2. Empresa adiciona funcionário como `participant` (role = 'executor')
3. Sistema detecta conflitos automaticamente (alerta, não bloqueio)

**Exemplo**:
```typescript
// 1. Criar availability da empresa
const availability = await unifiedAvailabilityService.createAvailability(tenantId, userId, {
  ownerType: AvailabilityOwnerType.GROUP, // ou SERVICE
  ownerId: companyActorId,
  startDatetime: new Date('2024-12-20T09:00:00'),
  endDatetime: new Date('2024-12-20T18:00:00'),
  // ...
});

// 2. Adicionar funcionário como participante
const member = await companyMembersService.getMember(tenantId, memberId);
const participant = await unifiedAvailabilityService.createParticipant(tenantId, userId, {
  availabilityId: availability.availabilityId,
  actorId: member.actorId, // Actor CPF do funcionário
  role: ParticipantRole.EXECUTOR,
});

// 3. Conflitos são detectados automaticamente (alerta, não bloqueio)
// Effect AVAILABILITY_CONFLICT_DETECTED é emitido se houver conflitos
```

### 3.2. Detecção de Conflitos

**Já implementado**:
- `detectConflicts()` detecta conflitos entre availability do owner e availability do participante
- Conflitos geram effect `AVAILABILITY_CONFLICT_DETECTED`
- Effect é projetado para inbox social (alerta, não bloqueio)

**🔴 BLINDAGEM**: 
- Detecção é **ALERTA**, não bloqueio
- Funcionário decide na própria agenda
- Empresa apenas **associa**, **agenda** e **alerta**

---

## 4. BLINDAGENS IMPLEMENTADAS

### 4.1. Empresa NÃO Edita Agenda Pessoal

- ✅ Empresa pode criar `availability` própria
- ✅ Empresa pode adicionar funcionário como `participant`
- ❌ Empresa **NÃO pode** editar `availability` do funcionário (owner_type = 'user')
- ❌ Empresa **NÃO pode** criar `booking` em nome do funcionário

### 4.2. Funcionário Decide

- ✅ Funcionário gerencia própria agenda (via `owner_type = 'user'`)
- ✅ Funcionário recebe alertas de conflito no inbox
- ✅ Funcionário decide se aceita ou não compromisso

### 4.3. Base Estrutural, NÃO CRM/ERP

- ✅ Apenas associação empresa ↔ funcionário
- ✅ Apenas atribuição de compromissos
- ✅ Apenas detecção de conflitos (alerta)
- ❌ **NÃO** cria CRM completo
- ❌ **NÃO** cria ERP completo
- ❌ **NÃO** cria lógica de bloqueio automático

---

## 5. API ENDPOINTS

### 5.1. Backend

**POST** `/companies/:companyId/members`
- Criar membro
- Input: `{ actorId, role?, status?, metadata? }`

**GET** `/companies/:companyId/members`
- Listar membros
- Query params: `role?`, `status?`

**GET** `/companies/:companyId/members/:memberId`
- Buscar membro por ID

**PUT** `/companies/:companyId/members/:memberId`
- Atualizar membro
- Input: `{ role?, status?, metadata? }`

**DELETE** `/companies/:companyId/members/:memberId`
- Remover membro

### 5.2. Frontend

**Arquivo**: `frontend/src/api/companyMembers.ts`

**Funções**:
- `listCompanyMembers(companyId, filters?)`
- `getCompanyMember(companyId, memberId)`
- `createCompanyMember(companyId, input)`
- `updateCompanyMember(companyId, memberId, input)`
- `deleteCompanyMember(companyId, memberId)`

---

## 6. FRONTEND MÍNIMO

### 6.1. Componente `CompanyMembersList`

**Arquivo**: `frontend/src/components/CompanyMembersList.tsx`

**Funcionalidades**:
- Lista membros da empresa
- Mostra status (ativo/convidado/suspenso)
- Mostra role (admin/staff/contractor)

**Integração**:
- Integrado em `CompaniesManager.tsx`
- Exibido no perfil da empresa

**🔴 BLINDAGEM**: 
- Frontend mínimo, **NÃO** UI de gestão completa
- Apenas visualização, não edição completa

---

## 7. ARQUIVOS CRIADOS/ALTERADOS

### 7.1. Backend (Novos)

1. **`migrations/147_company_members.sql`**
   - Tabela `company_members`
   - Enums `company_member_role` e `company_member_status`
   - RLS e triggers

2. **`src/core/companies/company-members.types.ts`**
   - Types: `CompanyMember`, `CompanyMemberRole`, `CompanyMemberStatus`
   - Inputs: `CreateCompanyMemberInput`, `UpdateCompanyMemberInput`
   - Filters: `CompanyMemberFilters`

3. **`src/core/companies/company-members.repository.ts`**
   - Repository com métodos CRUD

4. **`src/core/companies/company-members.service.ts`**
   - Service com validações e blindagens

5. **`src/core/companies/company-members.routes.ts`**
   - Rotas REST para gerenciar membros

### 7.2. Backend (Alterados)

6. **`src/core/companies/companies.module.ts`**
   - Registro das rotas de membros

### 7.3. Frontend (Novos)

7. **`frontend/src/api/companyMembers.ts`**
   - Client API para membros

8. **`frontend/src/components/CompanyMembersList.tsx`**
   - Componente para listar membros

9. **`frontend/src/components/CompanyMembersList.css`**
   - Estilos do componente

### 7.4. Frontend (Alterados)

10. **`frontend/src/components/CompaniesManager.tsx`**
    - Integração do `CompanyMembersList`

---

## 8. FLUXO COMPLETO

### 8.1. Adicionar Funcionário

```
1. Empresa adiciona funcionário (POST /companies/:companyId/members)
   ↓
2. companyMembersService.createMember()
   ↓
3. Valida que actor é do tipo 'user' (CPF)
   ↓
4. companyMembersRepository.create()
   ↓
5. Membro criado com status 'invited'
```

### 8.2. Atribuir Compromisso a Funcionário

```
1. Empresa cria availability (POST /availability)
   ↓
2. Empresa adiciona funcionário como participant (POST /availability/:id/participants)
   ↓
3. unifiedAvailabilityService.createParticipant()
   ↓
4. Sistema detecta conflitos (detectConflicts())
   ↓
5. Se houver conflitos, emite effect AVAILABILITY_CONFLICT_DETECTED
   ↓
6. Effect é projetado para inbox do funcionário (alerta, não bloqueio)
```

### 8.3. Funcionário Recebe Alerta

```
1. Effect AVAILABILITY_CONFLICT_DETECTED é emitido
   ↓
2. socialInboxProjector.projectInboxItem()
   ↓
3. Item criado no inbox do funcionário
   ↓
4. Funcionário vê alerta no inbox
   ↓
5. Funcionário decide na própria agenda
```

---

## 9. VALIDAÇÕES

- ✅ Backend: `pnpm run build:check` → PASS
- ✅ Backend: `pnpm run build` → PASS
- ✅ Frontend: `npm run build` → PASS

---

## 10. OBSERVAÇÕES

### 10.1. Limitações (Por Design)

- ✅ Base estrutural, **NÃO** CRM/ERP completo
- ✅ Frontend mínimo, **NÃO** UI de gestão completa
- ✅ Apenas associação e atribuição, **NÃO** lógica complexa

### 10.2. Próximos Passos (Futuro)

- [ ] UI para adicionar/remover membros
- [ ] UI para atribuir compromissos a funcionários
- [ ] Visualização de conflitos na agenda da empresa
- [ ] Notificações para funcionários sobre novos compromissos

---

**Status**: ✅ Implementação completa e validada

