Status: SUBORDINATED
Domain: UNKNOWN
Governing Contract: CORE_IMUTAVEL.md
# Contrato Técnico: Capacidades por Actor

**Data**: 2024-12-19  
**Escopo**: Primeira camada real de capacidades permitidas por tipo de Actor

---

## 1. CONCEITO DE CAPACIDADE

### Definição

**Capacidade ≠ Permissão**

- **Capacidade**: Ação possível no sistema, associada ao tipo de Actor
- **Permissão**: Validação pontual baseada em estado (reputação, verificação, etc)

### Relação

- **Permissão valida capacidade** - se não tem capacidade, permissão é irrelevante
- **Capacidade é baseada no tipo de Actor** (user, page, group, channel)
- **Permissão é baseada em estado** (reputação, companyStatus, etc)

### Blindagens

- 🔴 **UI NÃO decide capacidades** - são definidas no backend
- 🔴 **Nada implícito, nada herdado silenciosamente** - tudo explícito em código
- 🔴 **Isso protege o sistema no longo prazo** contra decisões implícitas

---

## 2. ENUM DE CAPACIDADES

### Localização
`src/modules/social/actor-capabilities.types.ts`

### Enum `ActorCapability`

```typescript
export enum ActorCapability {
  // Conteúdo Social
  POST_CONTENT = 'POST_CONTENT', // Criar posts no feed
  COMMENT = 'COMMENT', // Comentar em posts
  VOTE = 'VOTE', // Votar em votações
  
  // Projetos e Oportunidades
  CREATE_PROJECT = 'CREATE_PROJECT', // Criar projetos
  CREATE_JOB = 'CREATE_JOB', // Criar vagas de trabalho
  APPLY_JOB = 'APPLY_JOB', // Candidatar-se a vagas
  
  // Economia
  RECEIVE_FUNDS = 'RECEIVE_FUNDS', // Receber pagamentos/doações
  SEND_FUNDS = 'SEND_FUNDS', // Enviar pagamentos/doações
  
  // Gestão
  MANAGE_MEMBERS = 'MANAGE_MEMBERS', // Gerenciar membros (grupos/empresas)
  MANAGE_CONTENT = 'MANAGE_CONTENT', // Gerenciar conteúdo próprio
  
  // Eventos
  CREATE_EVENT = 'CREATE_EVENT', // Criar eventos
  HOST_EVENT = 'HOST_EVENT', // Hospedar eventos de outros
  
  // Outros
  CREATE_CTA = 'CREATE_CTA', // Criar Call-to-Action (botões de ação)
}
```

---

## 3. MAPA DE CAPACIDADES POR TIPO DE ACTOR

### Localização
`src/modules/social/actor-capabilities.service.ts` - `ACTOR_CAPABILITIES_MAP`

### Mapa Completo

| Tipo | Capacidades |
|------|-------------|
| **user** (PF) | `POST_CONTENT`, `COMMENT`, `VOTE`, `APPLY_JOB`, `SEND_FUNDS`, `CREATE_EVENT`, `CREATE_PROJECT`, `CREATE_CTA` |
| **page** (PJ) | `POST_CONTENT` (condicional), `COMMENT`, `VOTE` (condicional), `CREATE_JOB`, `CREATE_PROJECT`, `RECEIVE_FUNDS`, `SEND_FUNDS`, `CREATE_EVENT`, `HOST_EVENT`, `CREATE_CTA`, `MANAGE_MEMBERS` |
| **group** | `POST_CONTENT`, `COMMENT`, `VOTE`, `CREATE_PROJECT`, `RECEIVE_FUNDS`, `SEND_FUNDS`, `MANAGE_MEMBERS`, `CREATE_EVENT` |
| **channel** | (nenhuma - não habilitado ainda) |

### Detalhamento

#### user (Pessoa Física)
- ✅ `POST_CONTENT` - Sempre pode postar
- ✅ `COMMENT` - Sempre pode comentar
- ✅ `VOTE` - Sempre pode votar
- ✅ `APPLY_JOB` - Pode candidatar-se a vagas
- ✅ `SEND_FUNDS` - Pode enviar pagamentos/doações
- ✅ `CREATE_EVENT` - Pode criar eventos
- ✅ `CREATE_PROJECT` - Pode criar projetos pessoais
- ✅ `CREATE_CTA` - Pode criar Call-to-Action

#### page (Pessoa Jurídica)
- ✅ `POST_CONTENT` - Condicional: apenas se VERIFIED/APPROVED
- ✅ `COMMENT` - Sempre pode comentar
- ✅ `VOTE` - Condicional: apenas se VERIFIED/APPROVED
- ✅ `CREATE_JOB` - Pode criar vagas de trabalho
- ✅ `CREATE_PROJECT` - Pode criar projetos
- ✅ `RECEIVE_FUNDS` - Pode receber pagamentos/doações
- ✅ `SEND_FUNDS` - Pode enviar pagamentos/doações
- ✅ `CREATE_EVENT` - Pode criar eventos
- ✅ `HOST_EVENT` - Pode hospedar eventos de outros
- ✅ `CREATE_CTA` - Pode criar Call-to-Action
- ✅ `MANAGE_MEMBERS` - Pode gerenciar funcionários

#### group (Grupo/Comunidade)
- ✅ `POST_CONTENT` - Pode postar no grupo
- ✅ `COMMENT` - Pode comentar
- ✅ `VOTE` - Pode votar
- ✅ `CREATE_PROJECT` - Pode criar projetos
- ✅ `RECEIVE_FUNDS` - Pode receber pagamentos/doações
- ✅ `SEND_FUNDS` - Pode enviar pagamentos/doações
- ✅ `MANAGE_MEMBERS` - Pode gerenciar membros do grupo
- ✅ `CREATE_EVENT` - Pode criar eventos

#### channel (Canal)
- ❌ Nenhuma capacidade (não habilitado ainda)

---

## 4. RESOLVER DE CAPACIDADES

### Localização
`src/modules/social/actor-capabilities.service.ts`

### Métodos

1. **`getActorCapabilities(tenantId, actorId)`**:
   - Resolve capacidades de um Actor específico
   - Retorna array de `ActorCapability[]`
   - Baseado no tipo de Actor

2. **`hasCapability(tenantId, actorId, capability)`**:
   - Verifica se Actor tem capacidade específica
   - Retorna `CapabilityCheck` com `hasCapability` e `reason` opcional

3. **`getCapabilitiesByType(actorType)`**:
   - Obtém capacidades por tipo sem precisar buscar actor
   - Útil para validação rápida

4. **`getCapabilitiesMap()`**:
   - Retorna mapa completo de capacidades
   - Útil para documentação e validação

---

## 5. INTEGRAÇÃO COM PERMISSÕES EXISTENTES

### Localização
`src/modules/social/reputation.service.ts` - `getPermissions()`

### Relação

**Permissão = Capacidade + Estado**

1. **Verifica capacidade primeiro**:
   ```typescript
   const capabilities = actorCapabilitiesService.getCapabilitiesByType(actorType);
   const hasPostCapability = capabilities.includes(ActorCapability.POST_CONTENT);
   ```

2. **Calcula permissão baseado em capacidade + estado**:
   ```typescript
   const canPost = hasPostCapability && (actorType === 'user' ? true : (companyStatus === 'VERIFIED' || companyStatus === 'APPROVED'));
   ```

3. **Se não tem capacidade, permissão é false**:
   - Independente de estado (reputação, verificação, etc)
   - Protege contra uso acidental de capacidades não disponíveis

### Localização
`src/modules/social/social-2.0.service.ts` - `createPost()`

**Fluxo de Validação**:
1. Verifica capacidade (linha 666-677)
2. Se não tem capacidade → erro 403 explícito
3. Verifica permissão (linha 682-687)
4. Se não tem permissão → erro 403 explícito

---

## 6. ONDE CAPACIDADES SÃO VERIFICADAS

### Backend

1. **`social-2.0.service.ts` - `createPost()`**:
   - Linha 666-677: Verifica `POST_CONTENT` antes de criar post
   - Linha 695-720: Verifica `VOTE`, `CREATE_PROJECT`, `CREATE_CTA` baseado em `intent`

2. **`reputation.service.ts` - `getPermissions()`**:
   - Linha 256-263: Verifica capacidades antes de calcular permissões
   - Linha 268-271: Calcula permissões baseado em capacidade + estado

---

## 7. EXEMPLOS DE ERRO QUANDO CAPACIDADE NÃO EXISTE

### Exemplo 1: Channel tentando postar

**Cenário**: Actor do tipo `channel` tenta criar post

**Erro**:
- Status: `403 Forbidden`
- Mensagem: `"Actor does not have capability to post. Actor type 'channel' does not have capability 'POST_CONTENT'"`

**Localização**: `social-2.0.service.ts` linha 672-677

---

### Exemplo 2: User tentando criar job

**Cenário**: Actor do tipo `user` tenta criar vaga de trabalho

**Capacidade**: `user` não tem `CREATE_JOB` no mapa

**Erro esperado** (se implementado):
- Status: `403 Forbidden`
- Mensagem: `"Actor does not have capability to create jobs. Actor type 'user' does not have capability 'CREATE_JOB'"`

---

### Exemplo 3: Group tentando gerenciar membros sem capacidade

**Cenário**: Actor do tipo `group` sem `MANAGE_MEMBERS` (se removido do mapa)

**Erro esperado** (se implementado):
- Status: `403 Forbidden`
- Mensagem: `"Actor does not have capability to manage members. Actor type 'group' does not have capability 'MANAGE_MEMBERS'"`

---

## 8. BLINDAGENS IMPLEMENTADAS

### Comentários 🔴 BLINDAGEM

1. **`actor-capabilities.types.ts`**:
   - Explica diferença entre capacidade e permissão
   - Explica por que UI não decide isso
   - Explica por que protege o sistema no longo prazo

2. **`actor-capabilities.service.ts`**:
   - Comentários em cada método explicando propósito
   - Mapa explícito com comentários sobre condicionais

3. **`reputation.service.ts`**:
   - Explica relação entre capacidade e permissão
   - Comentários sobre validação de capacidade antes de permissão

4. **`social-2.0.service.ts`**:
   - Verifica capacidade ANTES de verificar permissão
   - Erros explícitos com mensagens claras

---

## ARQUIVOS ALTERADOS/CRIADOS

### Backend
1. `src/modules/social/actor-capabilities.types.ts` (NOVO)
   - Enum `ActorCapability`
   - Interface `CapabilityCheck`
   - Tipo `ActorCapabilitiesMap`

2. `src/modules/social/actor-capabilities.service.ts` (NOVO)
   - Mapa `ACTOR_CAPABILITIES_MAP`
   - Métodos `getActorCapabilities()`, `hasCapability()`, etc.

3. `src/modules/social/reputation.service.ts`
   - Integração com capacidades em `getPermissions()`
   - Validação de capacidade antes de calcular permissão

4. `src/modules/social/social-2.0.service.ts`
   - Verificação de capacidade antes de criar post
   - Verificação de capacidade para `VOTE`, `CREATE_PROJECT`, `CREATE_CTA`

---

## VALIDAÇÕES

- ✅ Backend: `pnpm run build:check` → PASS
- ✅ Backend: `pnpm run build` → PASS
- ✅ Frontend: `pnpm run build` → PASS

---

## MAPA FINAL POR TIPO DE ACTOR

### user (Pessoa Física)
```typescript
[
  POST_CONTENT,
  COMMENT,
  VOTE,
  APPLY_JOB,
  SEND_FUNDS,
  CREATE_EVENT,
  CREATE_PROJECT,
  CREATE_CTA,
]
```

### page (Pessoa Jurídica)
```typescript
[
  POST_CONTENT, // Condicional: VERIFIED/APPROVED
  COMMENT,
  VOTE, // Condicional: VERIFIED/APPROVED
  CREATE_JOB,
  CREATE_PROJECT,
  RECEIVE_FUNDS,
  SEND_FUNDS,
  CREATE_EVENT,
  HOST_EVENT,
  CREATE_CTA,
  MANAGE_MEMBERS,
]
```

### group (Grupo/Comunidade)
```typescript
[
  POST_CONTENT,
  COMMENT,
  VOTE,
  CREATE_PROJECT,
  RECEIVE_FUNDS,
  SEND_FUNDS,
  MANAGE_MEMBERS,
  CREATE_EVENT,
]
```

### channel (Canal)
```typescript
[] // Nenhuma - não habilitado ainda
```

---

## RELAÇÃO ENTRE CAPACIDADE E PERMISSÃO

### Fluxo de Validação

1. **Verificar Capacidade**:
   - Baseado em `actor_type`
   - Se não tem capacidade → erro 403 imediato

2. **Verificar Permissão**:
   - Baseado em capacidade + estado (reputação, verificação)
   - Se não tem permissão → erro 403 com mensagem de estado

### Exemplo Prático

**Cenário**: PJ PROVISIONAL tenta postar

1. **Capacidade**: ✅ `page` tem `POST_CONTENT` no mapa
2. **Permissão**: ❌ `canPost = false` (porque `companyStatus === 'PROVISIONAL'`)
3. **Resultado**: Erro 403 - `"Actor does not have permission to post. Complete company verification to enable posting."`

**Cenário**: Channel tenta postar

1. **Capacidade**: ❌ `channel` NÃO tem `POST_CONTENT` no mapa
2. **Permissão**: (não verifica - já falhou na capacidade)
3. **Resultado**: Erro 403 - `"Actor does not have capability to post. Actor type 'channel' does not have capability 'POST_CONTENT'"`

---

**Status Final**: ✅ **CONTRATO TÉCNICO DE CAPACIDADES IMPLEMENTADO E VALIDADO**


