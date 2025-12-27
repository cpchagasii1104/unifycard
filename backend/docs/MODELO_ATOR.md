# 🎭 Modelo de Ator (Actor) - Unificard

## 📋 Visão Geral

O **Ator (Actor)** é o conceito central que resolve a distinção entre **Conta**, **Identidade** e **Papel Ativo** no Unificard.

---

## 🧠 Modelo Mental

### 1️⃣ Conta ≠ Identidade ≠ Ator

**Conta (Account)**
- CPF do usuário
- Login e autenticação
- Segurança e tokens
- Carteira base (wallet)

**Identidade (Identity)**
- Pessoa física (PF)
- Empresas vinculadas (CNPJ)
- Grupos e comunidades
- Perfis completos

**Ator (Actor) - O CONCEITO CHAVE**
- **Quem está falando agora**
- **Quem responde legalmente**
- **Quem recebe / paga**
- **Contexto ativo da ação**

👉 **O erro comum**: Misturar tudo isso numa tela só.
👉 **O acerto**: **Forçar a escolha do ATOR antes da ação**.

---

## 🎯 Por Que Isso É Importante?

### Problema Real

- O usuário **é sempre uma pessoa física (CPF)**
- Mas ele pode **agir em nome de**:
  - Si mesmo (PF)
  - Uma ou mais empresas (CNPJ)
- E essas empresas podem ter:
  - Donos
  - Funcionários
  - Níveis de permissão

### Impacto

Isso muda **completamente**:
- ✅ O tipo de post
- ✅ O CTA (Call to Action)
- ✅ O impacto
- ✅ O dinheiro
- ✅ O ledger
- ✅ A responsabilidade legal

**Logo**: `Postar ≠ Perfil`  
**Correto**: `Postar = assumir um papel (actor)`

---

## 🏗️ Arquitetura Técnica

### Backend

#### Tabela `actors`

```sql
CREATE TABLE actors (
  actor_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  actor_type VARCHAR(20) NOT NULL, -- 'user' | 'page' | 'group' | 'channel'
  user_id UUID REFERENCES users(user_id),
  company_id UUID REFERENCES companies(company_id),
  group_id UUID REFERENCES groups(group_id),
  display_name VARCHAR(255) NOT NULL,
  slug VARCHAR(255),
  avatar_url TEXT,
  cover_url TEXT,
  bio TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Tipos de Ator

1. **`user`** - Pessoa física
   - Vinculado a `user_id`
   - Criado automaticamente ao criar conta
   - Sempre disponível para o próprio usuário

2. **`page`** - Empresa (CNPJ)
   - Vinculado a `company_id`
   - Criado quando empresa é cadastrada
   - Disponível apenas para usuários com permissão

3. **`group`** - Grupo/Comunidade
   - Vinculado a `group_id`
   - Criado quando grupo é criado
   - Disponível para membros do grupo

4. **`channel`** - Canal (futuro)
   - Para canais de comunicação
   - Ainda não implementado

#### Permissões

O backend verifica permissões através de:

```typescript
// backend/src/modules/social/actor.repository.ts
async findAvailableActors(
  tenantId: string,
  globalUserId: string
): Promise<Array<ActorRow & { user_role?: string; can_post?: boolean }>>
```

**Regras**:
- Actor `user`: Sempre `can_post: true`
- Actor `page`: `can_post` baseado em `company_users.can_manage_company` ou outras permissões
- Actor `group`: Baseado em membros e permissões do grupo

---

### Frontend

#### Fluxo de Seleção de Ator

**Passo 0 - Escolha de Ator (Obrigatória)**

```
┌─────────────────────────────────────┐
│  Você está atuando como:            │
├─────────────────────────────────────┤
│  👤 Você (Pessoa Física)            │
│  🏢 Restaurante X                   │
│  🏢 Empresa de Shows Y              │
└─────────────────────────────────────┘
```

**Persistência**:
- Contexto salvo em `localStorage` (`unificard_active_actor`)
- Restaurado automaticamente ao recarregar página
- Mantido durante toda a sessão

**Componentes**:

1. **`ActorSelector`** (`frontend/src/components/social/ActorSelector.tsx`)
   - Exibe opções disponíveis
   - Mostra role (proprietário, funcionário, etc.)
   - Valida permissões (`can_post`)
   - Modo compacto e expandido

2. **`PostComposer`** (`frontend/src/components/social/PostComposer.tsx`)
   - Integra com `ActorSelector`
   - Filtra opções de experiência baseado no tipo de ator
   - Valida antes de criar post

3. **`useActorContext`** (hook - futuro)
   - Gerencia contexto globalmente
   - Persistência automática
   - Sincronização entre componentes

---

## 🔄 Fluxo Completo de Criação de Post

### Passo 0: Escolha de Ator ✅

**Obrigatório antes de qualquer ação**

- Usuário vê opções:
  - 👤 Pessoa Física (sempre disponível)
  - 🏢 Empresas onde tem permissão
- Seleção persiste durante a sessão
- Mudança de ator reseta opções de experiência

### Passo 1: Público (Audience)

**Agora faz sentido perguntar "Para quem é isso?"**

- **PF** → Pode ser amigos, público, grupo
- **Empresa** → Pode ser público geral, seguidores da empresa
- **Grupo** → Precisa permissão

### Passo 2: Tipo de Experiência

**Filtrado pelo ator**

#### Se ATOR = Pessoa Física
- ✅ Atualização pessoal
- ✅ Encontro
- ✅ Evento social
- ✅ Votação
- ✅ Projeto de grupo

#### Se ATOR = Empresa (ex: restaurante)
- ✅ Evento
- ✅ Oferta de serviço
- ✅ Venda de produto
- ✅ Promoção
- ✅ Agendamento
- ❌ Votação pessoal (não disponível)

### Passo 3: Subtipo

**Exemplo: Evento**

```
Que tipo de evento é esse?
- 🍽️ Restaurante / Jantar
- 🍺 Bar / Happy Hour
- 🎶 Show
- 🎉 Festa
- 📚 Workshop
- ⚽ Esportivo
```

### Passo 4: CTA (Call to Action)

**Contexto claro = CTA correto**

- Restaurante → "Reservar mesa"
- Show → "Comprar ingresso"
- Serviço → "Contratar"
- Evento social → "Confirmar presença"

---

## 🔐 Funcionários e Permissões

### Modelo de Segurança

**Funcionário não escolhe empresa aleatória**

Ele só vê empresas onde:
- ✅ Tem permissão (`company_users.is_active = true`)
- ✅ Tem role (admin, editor, financeiro)
- ✅ `can_post = true` (baseado em permissões)

### Estrutura de Dados

```typescript
interface AvailableActor {
  actor_id: string;
  actor_type: 'user' | 'page' | 'group' | 'channel';
  display_name: string;
  avatar_url: string | null;
  user_role?: string; // 'owner' | 'director' | 'manager' | 'employee'
  can_post?: boolean; // Baseado em permissões
}
```

### Post Criado

```json
{
  "actor_type": "page",
  "actor_id": "cnpj_x",
  "global_user_id": "cpf_y", // Quem criou
  "content": "...",
  "intent": "event",
  "intent_metadata": {
    "event_subtype": "RESTAURANTE"
  }
}
```

**Isso permite**:
- ✅ Proteção jurídica
- ✅ Evitar fraude
- ✅ Auditoria completa
- ✅ Bloquear usuários específicos

---

## 📊 Estrutura de Dados no Post

### Post com Ator

```typescript
interface PostWithActor {
  post_id: string;
  actor_id: string;
  actor: {
    actor_id: string;
    actor_type: 'user' | 'page' | 'group' | 'channel';
    display_name: string;
    avatar_url: string | null;
  };
  global_user_id: string; // Quem criou (sempre CPF)
  content: string;
  intent: 'personal' | 'friends' | 'booking' | 'service_offer' | 'product_offer' | 'project' | 'vote' | 'event';
  intent_metadata?: Record<string, any>;
  targeting?: Record<string, any>;
  cta?: {
    cta_type: 'booking' | 'service' | 'payment';
    target_actor_id?: string;
    price?: number;
  };
  created_at: string;
}
```

---

## 🎨 UI/UX

### Indicadores Visuais

**Pessoa Física**:
```
👤 João Silva
```

**Empresa (Proprietário)**:
```
🏢 Restaurante X
👑 Proprietário
Postando como funcionário autorizado
```

**Empresa (Funcionário)**:
```
🏢 Empresa Y
👔 Funcionário
Postando como funcionário autorizado
```

### Contexto Ativo

Quando empresa está selecionada, mostrar banner informativo:

```
ℹ️ Você está postando em nome desta empresa. 
O post será associado ao perfil da empresa e você será 
identificado como funcionário.
```

---

## 🔄 Persistência e Contexto

### localStorage

```typescript
// Chave: 'unificard_active_actor'
{
  "actorId": "uuid-do-actor",
  "actorType": "page"
}
```

**Vantagens**:
- ✅ Contexto mantido ao recarregar página
- ✅ Não precisa escolher toda vez
- ✅ UX mais fluida

**Limitações**:
- ⚠️ Contexto pode ficar inválido se empresa for removida
- ⚠️ Validação necessária ao restaurar

---

## 🚀 Próximos Passos

### Melhorias Futuras

1. **Hook Global `useActorContext`**
   - Contexto React compartilhado
   - Sincronização entre componentes
   - Refresh automático quando empresas mudam

2. **Validação de Permissões em Tempo Real**
   - Verificar se `can_post` ainda é válido
   - Atualizar lista quando permissões mudam

3. **Indicador de Contexto Global**
   - Mostrar ator ativo no header
   - Permitir mudança rápida

4. **Auditoria e Logs**
   - Registrar todas as ações por ator
   - Histórico de mudanças de contexto

---

## 📚 Referências

- Backend: `backend/src/modules/social/actor.repository.ts`
- Backend: `backend/src/modules/social/social-2.0.service.ts`
- Frontend: `frontend/src/components/social/ActorSelector.tsx`
- Frontend: `frontend/src/components/social/PostComposer.tsx`
- API: `GET /social/actors/available`

---

## ✅ Checklist de Implementação

- [x] Backend: Tabela `actors` criada
- [x] Backend: `findAvailableActors` implementado
- [x] Backend: Validação de permissões
- [x] Frontend: `ActorSelector` criado
- [x] Frontend: Persistência em localStorage
- [x] Frontend: Integração com `PostComposer`
- [x] Frontend: Filtro de opções por tipo de ator
- [ ] Frontend: Hook `useActorContext` global
- [ ] Frontend: Indicador de contexto no header
- [ ] Backend: Auditoria de mudanças de contexto
- [ ] Documentação: Exemplos de uso

---

**Última atualização**: 2024-12-19













