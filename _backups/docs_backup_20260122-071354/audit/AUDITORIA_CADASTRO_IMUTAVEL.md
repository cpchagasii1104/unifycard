# Auditoria: Cadastro com Dados Civis Imutáveis

**Data:** 2025-01-02  
**Sistema:** Fintech/Gov.br - Nível Enterprise  
**Objetivo:** Garantir imutabilidade de dados civis após cadastro inicial

---

## 📋 REGRAS DE NEGÓCIO (IMUTÁVEIS)

### Dados Civis Imutáveis
Os seguintes dados **NUNCA** podem ser alterados após o cadastro inicial:

1. **Nome Completo** (`fullName`)
   - Fonte: `profiles.full_name`
   - Coletado: Apenas no cadastro inicial
   - Imutável: Após primeira gravação

2. **CPF**
   - Fonte: `user_profiles.cpf` (fonte única de verdade)
   - Coletado: Apenas no cadastro inicial
   - Imutável: Após primeira gravação
   - Unicidade: Constraint UNIQUE no banco
   - **NUNCA** deve estar em `profiles.metadata`

3. **Data de Nascimento** (`birthdate`)
   - Fonte: `global_users.birthdate`
   - Coletado: Apenas no cadastro inicial
   - Imutável: Após primeira gravação

4. **Sexo** (`gender`)
   - Fonte: `profiles.metadata.gender`
   - Coletado: Apenas no cadastro inicial
   - Imutável: Após primeira gravação
   - Valores: `'male'` | `'female'`

### Princípios Fundamentais

1. **Backend é a fonte única de verdade**
   - Frontend apenas reflete o contrato
   - Nenhuma lógica de negócio no frontend
   - Validações no backend são definitivas

2. **Tentativas de alteração são ignoradas**
   - Backend ignora silenciosamente tentativas de alteração
   - Não retorna erro (evita confusão)
   - Loga a tentativa para auditoria

3. **Correções exigem fluxo administrativo**
   - Qualquer correção futura será via processo administrativo
   - Fora do escopo do sistema atual
   - Usuário deve contatar administrador

---

## 🔄 FLUXO DE CADASTRO INICIAL

### Frontend (`Register.tsx`)

**Campos Obrigatórios:**
- ✅ Nome Completo
- ✅ CPF (com máscara 000.000.000-00)
- ✅ Data de Nascimento (date picker)
- ✅ Sexo (select: Masculino/Feminino)

**UX Profissional:**
- ✅ Tooltip em todos os campos: "Este dado não poderá ser alterado após o cadastro."
- ✅ Mensagem fixa abaixo de cada campo
- ✅ Validação em tempo real
- ✅ Máscara automática de CPF
- ✅ Validação de idade mínima (16 anos)

**Payload Enviado:**
```typescript
POST /auth/register
{
  email: string;
  password: string;
  cpf: string; // Apenas números
  fullName: string;
  birthdate: string; // YYYY-MM-DD
  gender: 'male' | 'female';
  referralCode?: string;
}
```

### Backend (`/auth/register`)

**Processamento:**
1. Valida CPF (formato e dígitos verificadores)
2. Salva CPF em `user_profiles` (com constraint UNIQUE)
3. Salva `fullName` em `profiles.full_name`
4. Salva `birthdate` em `global_users.birthdate`
5. Salva `gender` em `profiles.metadata.gender`

**Garantias:**
- CPF único (constraint UNIQUE)
- Trigger remove CPF de `metadata` se tentar inserir
- Migration remove CPF legado de `metadata`

---

## 🔒 FLUXO DE PERFIL (APÓS CADASTRO)

### Frontend (`Profile.tsx`)

**Comportamento:**
- Se dado já existe → Renderiza `LockedField` (read-only)
- Se dado não existe → Permite edição (primeira vez)

**LockedField:**
- ✅ Ícone de cadeado visível
- ✅ Tooltip: "Este dado é protegido. Para corrigir, entre em contato com o administrador."
- ✅ Link para solicitar alteração
- ✅ Estilo enterprise (padrão bancário)

**Payload de Update:**
```typescript
PUT /core/profile
{
  phone?: string;
  metadata?: Record<string, any>; // SEM cpf, SEM gender
}
// NUNCA envia: fullName, cpf, birthdate, gender
```

### Backend (`PUT /core/profile`)

**Comportamento:**
1. Ignora `fullName` se já existe em `profiles.full_name`
2. Ignora `cpf` se já existe em `user_profiles.cpf`
3. Ignora `birthdate` se já existe em `global_users.birthdate`
4. Ignora `gender` se já existe em `profiles.metadata.gender`

**Implementação:**
- `profile.service.ts`: Ignora `fullName` e `gender` se já existem
- `identity.service.ts`: Ignora `birthdate` e `fullName` se já existem
- CPF: Validação de imutabilidade já implementada

**Logs:**
- Todas as tentativas de alteração são logadas
- Formato: `🔒 Ignorando tentativa de alteração de [campo] (dado imutável)`

---

## 🚪 GATE DE IDENTIDADE PARA GRUPOS

### Frontend (`GrupoNovoPage.tsx`)

**Verificação:**
1. No mount: Busca `GET /core/profile`
2. Verifica `identity_status`
3. Se `INCOMPLETE`:
   - ❌ Bloqueia formulário
   - ✅ Mostra mensagem: "Para criar um grupo, você precisa concluir seu cadastro básico."
   - ✅ Botão "Ir para Meu Perfil"
4. Se `COMPLETE`:
   - ✅ Renderiza formulário
   - ✅ Valida `activeActor`
   - ✅ Envia `owner_actor_id` no payload

### Backend (`POST /groups`)

**Validações:**
1. ✅ `identity_status === 'COMPLETE'` (403 se incompleto)
2. ✅ `owner_actor_id` presente e válido
3. ✅ Actor pertence ao usuário autenticado
4. ✅ Permissão `groups:create`

**Respostas:**
- `403`: "Cadastro incompleto. Para criar um grupo, você precisa concluir seu cadastro básico..."
- `400`: "owner_actor_id é obrigatório"
- `403`: "Actor inválido ou não autorizado"

---

## 📊 IDENTITY STATUS

### Cálculo (`core.service.ts`)

**Lógica:**
```typescript
identity_status = (
  hasFullName && 
  hasCpf && 
  hasBirthdate && 
  hasGender
) ? 'COMPLETE' : 'INCOMPLETE';
```

**Fontes:**
- `hasFullName`: `profiles.full_name` (não null e não vazio)
- `hasCpf`: `user_profiles.cpf` (não null e não vazio)
- `hasBirthdate`: `global_users.birthdate` (via `identityService`)
- `hasGender`: `profiles.metadata.gender` (deve ser 'male' ou 'female')

**Retorno:**
- Campo `identity_status` incluído em `GET /core/profile`

---

## 🗄️ ESTRUTURA DE DADOS

### Tabelas Envolvidas

1. **`profiles`**
   - `full_name`: Nome completo (imutável após preenchido)
   - `metadata.gender`: Sexo (imutável após preenchido)
   - **NUNCA** contém CPF em `metadata`

2. **`user_profiles`**
   - `cpf`: CPF único e imutável
   - Constraint UNIQUE em `cpf`
   - Constraint UNIQUE em `user_id`

3. **`global_users`**
   - `birthdate`: Data de nascimento (imutável após preenchido)
   - `full_name`: Nome completo (imutável após preenchido)

### Migrations

1. **Migration 111**: Remove CPF de `metadata` e cria trigger
   - Remove CPF existente de `profiles.metadata`
   - Cria trigger `prevent_cpf_in_metadata()`
   - Previne inserção futura de CPF em `metadata`

---

## 🔐 SEGURANÇA E COMPLIANCE

### LGPD
- ✅ CPF em tabela dedicada (`user_profiles`)
- ✅ CPF nunca em `metadata` (JSONB)
- ✅ Dados imutáveis após cadastro
- ✅ Logs de tentativas de alteração

### Validações
- ✅ CPF: Formato e dígitos verificadores
- ✅ Nome: Mínimo 3 caracteres, nome e sobrenome
- ✅ Data: Idade mínima 16 anos
- ✅ Sexo: Apenas 'male' ou 'female'

### Auditoria
- ✅ Logs de tentativas de alteração
- ✅ Logs de criação de grupos
- ✅ Logs de validação de identity_status

---

## 📝 CONTRATO FRONTEND/BACKEND

### GET /core/profile

**Resposta:**
```typescript
{
  ok: true,
  data: {
    personal_profile: {
      fullName: string | null;
      phone: string | null;
      cpf: string | null; // ← De user_profiles
      metadata: Record<string, any>; // ← SEM cpf, SEM gender se já existe
      referralCode: string | null;
    };
    identity_status: 'COMPLETE' | 'INCOMPLETE';
    // ... outros campos
  }
}
```

### PUT /core/profile

**Request (Frontend):**
```typescript
{
  phone?: string;
  metadata?: Record<string, any>; // SEM dados imutáveis
}
```

**Comportamento (Backend):**
- Ignora `fullName` se já existe
- Ignora `cpf` se já existe (não deve vir no payload)
- Ignora `gender` se já existe em metadata
- `birthdate` não é atualizado via este endpoint

### POST /groups

**Request (Frontend):**
```typescript
{
  name: string;
  description?: string;
  owner_actor_id: string; // OBRIGATÓRIO
}
```

**Validações (Backend):**
- `identity_status === 'COMPLETE'` (403 se não)
- `owner_actor_id` válido e pertencente ao usuário
- Permissão `groups:create`

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Frontend
- [x] Register.tsx: Todos os campos imutáveis coletados
- [x] Register.tsx: Tooltips em todos os campos
- [x] Register.tsx: Mensagens de imutabilidade
- [x] Register.tsx: Validações em tempo real
- [x] Profile.tsx: LockedField para dados existentes
- [x] Profile.tsx: Não envia dados imutáveis em updates
- [x] GrupoNovoPage.tsx: Gate de identity_status
- [x] GrupoNovoPage.tsx: Envio de owner_actor_id

### Backend
- [x] core.service.ts: Cálculo de identity_status
- [x] core.service.ts: Retorno de identity_status em GET /core/profile
- [x] profile.service.ts: Ignora fullName se já existe
- [x] profile.service.ts: Ignora gender se já existe
- [x] profile.service.ts: Validação de imutabilidade de CPF
- [x] identity.service.ts: Ignora birthdate se já existe
- [x] identity.service.ts: Ignora fullName se já existe
- [x] groups.routes.ts: Validação de identity_status COMPLETE
- [x] groups.routes.ts: Validação de owner_actor_id

### Database
- [x] Migration 111: Remove CPF de metadata
- [x] Migration 111: Trigger prevent_cpf_in_metadata
- [x] Constraint UNIQUE em user_profiles.cpf
- [x] Constraint UNIQUE em user_profiles.user_id

---

## 🎯 RESULTADO FINAL

### Cadastro Inicial
✅ Coleta todos os dados civis imutáveis  
✅ UX profissional com tooltips e validações  
✅ Dados salvos corretamente no backend

### Perfil
✅ Dados imutáveis bloqueados permanentemente  
✅ UI enterprise com cadeado e tooltip  
✅ Tentativas de alteração ignoradas no backend

### Grupos
✅ Gate de identidade completa implementado  
✅ Validação em frontend (UX) e backend (segurança)  
✅ Mensagens claras para usuário

### Compliance
✅ LGPD respeitada (CPF em tabela dedicada)  
✅ Dados imutáveis após cadastro  
✅ Auditoria de tentativas de alteração

---

## 📚 ARQUIVOS ENVOLVIDOS

### Frontend
- `src/components/Register.tsx` - Cadastro inicial
- `src/components/Profile.tsx` - Perfil do usuário
- `src/pages/GrupoNovoPage.tsx` - Criação de grupos
- `src/components/ui/LockedField.tsx` - Componente de campo bloqueado
- `src/components/ui/InfoTooltip.tsx` - Componente de tooltip
- `src/api/core.ts` - Interface CompleteProfile
- `src/api/groups.ts` - Interface CreateGroupInput
- `src/types/identity.ts` - Tipos de dados imutáveis

### Backend
- `src/core/core.service.ts` - Cálculo de identity_status
- `src/core/core.routes.ts` - Rota GET /core/profile
- `src/core/profile/profile.service.ts` - Ignora alterações de dados imutáveis
- `src/core/identity/identity.service.ts` - Ignora alterações de birthdate
- `src/modules/groups/groups.routes.ts` - Validação de identity_status
- `migrations/111_remove_cpf_from_metadata_and_prevent_future.sql` - Limpeza e trigger

---

## 🚀 PRÓXIMOS PASSOS

1. **Fluxo Administrativo** (futuro)
   - Processo para correção de dados imutáveis
   - Aprovação de administrador
   - Auditoria completa

2. **Melhorias de UX**
   - Indicador visual de cadastro completo/incompleto
   - Checklist de dados faltantes
   - Onboarding guiado

3. **Testes**
   - Testes unitários de imutabilidade
   - Testes de integração do fluxo completo
   - Testes E2E de cadastro e criação de grupo

---

**Status:** ✅ **IMPLEMENTAÇÃO COMPLETA E PRONTA PARA PRODUÇÃO**

Sistema implementado seguindo padrões enterprise de fintechs, sistemas governamentais e compliance LGPD.

