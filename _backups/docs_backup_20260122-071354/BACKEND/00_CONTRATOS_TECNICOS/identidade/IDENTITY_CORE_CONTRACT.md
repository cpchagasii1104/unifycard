# IDENTITY CORE CONTRACT — UNIFICARD

## Contrato Canônico — Core de Identidade do UnifiCard

Este documento define o **CORE DE IDENTIDADE** do UnifiCard.

**Autoridade:** NÍVEL 1 (CORE / LEI DO SISTEMA).  
Se qualquer proposta conflitar com este contrato → **RECUSAR**.

---

## 1) DEFINIÇÃO ABSOLUTA

**Actor** é o **ÚNICO mecanismo canônico** do sistema para:

- identidade operacional
- quem executa ações
- quem responde legalmente
- quem recebe / paga
- contexto ativo de qualquer operação
- autorização e permissões
- ownership e delegação

**Regra:** identidade no UnifiCard tem **UMA fonte conceitual**: **Actor**.

Não há exceções.  
Não há representações alternativas.  
Não há "atalhos técnicos".

---

## 2) REGRA DE OURO (INQUEBRÁVEL)

> **Se algo toca identidade, actor, permissões, ownership ou delegação, assume-se Actor como fonte única de verdade até prova canônica em contrário.**

Sem prova canônica explícita → **BLOQUEAR**.

---

## 3) O QUE É ACTOR

### 3.1 Definição Conceitual

**Actor** é:

- **Identidade operacional** que executa ações no sistema
- **"Quem está falando agora"** — o contexto ativo da operação
- **"Quem responde legalmente"** — a entidade responsável pela ação
- **"Quem recebe / paga"** — a identidade econômica da transação
- **Papel ativo** assumido pelo usuário em uma operação específica

Actor **NÃO é**:
- conta de autenticação (`user_id`)
- identidade cross-tenant (`global_user_id`)
- perfil de visualização
- relação de propriedade
- contexto inferido

### 3.2 Tipos Canônicos

Os seguintes tipos de Actor existem **UMA ÚNICA VEZ** no sistema:

1. **`user`** — Pessoa Física
   - Vinculado a `user_id`
   - Criado automaticamente ao criar conta
   - Sempre disponível para o próprio usuário

2. **`page`** — Empresa (CNPJ)
   - Vinculado a `company_id`
   - Criado quando empresa é cadastrada
   - Disponível apenas para usuários com permissão

3. **`group`** — Grupo/Comunidade
   - Vinculado a `group_id`
   - Criado quando grupo é criado
   - Disponível para membros do grupo

4. **`channel`** — Canal (futuro)
   - Para canais de comunicação
   - Ainda não implementado

**Documentos canônicos:**
- `CORE_IMUTAVEL.md` (linhas 36-40): "SISTEMA DE ACTORS" listado como Core Imutável
- `backend/docs/MODELO_ATOR.md`: definição arquitetural completa

### 3.3 Responsabilidade Institucional

Actor é **Core Imutável**. Isso significa:

- NÃO pode ser duplicado
- NÃO pode ser inferido
- NÃO pode ter fallback automático
- NÃO pode ser substituído
- NÃO pode ser contornado
- NÃO pode ser flexibilizado por conveniência técnica, comercial ou operacional

Todo o restante do sistema **SE CONECTA** ao Actor.  
Nada o replica. Nada o substitui. Nada opera em paralelo.

---

## 4) O QUE NÃO É IDENTIDADE

### 4.1 user_id

**`user_id`** é:

- **INPUT:** conta de autenticação
- **Função:** resolver Actor do usuário
- **Uso:** referência para buscar `actor_id`, não identidade operacional

**NÃO é:**
- identidade operacional
- quem executa ações
- fonte de verdade identitária

**Proibição absoluta:**
- Usar `user_id` como identidade operacional
- Decidir ações baseado em `user_id`
- Substituir `actor_id` por `user_id`

### 4.2 global_user_id

**`global_user_id`** é:

- **READ-MODEL:** identidade cross-tenant
- **Função:** reputação, histórico, wallet base
- **Uso:** referência cross-tenant, não identidade operacional

**NÃO é:**
- identidade operacional
- quem executa ações
- fonte de verdade identitária

**Proibição absoluta:**
- Usar `global_user_id` como identidade operacional
- Decidir ações baseado em `global_user_id`
- Substituir `actor_id` por `global_user_id`

### 4.3 created_by_user_id

**`created_by_user_id`** é:

- **INPUT:** registro de quem criou (auditoria)
- **Função:** trilha de auditoria, não identidade operacional
- **Uso:** histórico, não decisão

**NÃO é:**
- identidade operacional
- quem executa ações
- fonte de verdade identitária

**Proibição absoluta:**
- Usar `created_by_user_id` como identidade operacional
- Decidir ações baseado em `created_by_user_id`
- Substituir `created_by_actor_id` por `created_by_user_id` onde usado como identidade

### 4.4 Ownership

**Ownership** é:

- **INPUT:** relação de propriedade/membresia
- **Função:** resolver autoridade, não identidade operacional
- **Uso:** verificar se user pode atuar como actor, não identidade em si

**NÃO é:**
- identidade operacional
- quem executa ações
- fonte de verdade identitária

**Proibição absoluta:**
- Usar ownership como identidade operacional
- Decidir identidade baseado em ownership
- Substituir `actor_id` por verificação de ownership

### 4.5 Contexto

**Contexto** é:

- **INPUT:** informação derivada da requisição
- **Função:** auxiliar na resolução, não identidade operacional
- **Uso:** referência, não decisão

**NÃO é:**
- identidade operacional
- quem executa ações
- fonte de verdade identitária

**Proibição absoluta:**
- Inferir actor do contexto
- Decidir identidade baseado em contexto
- Usar contexto como fallback de identidade

### 4.6 Heurística

**Heurística** é:

- **PROIBIDO:** qualquer inferência de identidade
- **Função:** NENHUMA — heurísticas de identidade são violação institucional
- **Uso:** NENHUM — identidade não pode ser inferida

**Proibição absoluta:**
- Decidir identidade por heurística
- Inferir actor por padrão
- Assumir identidade por conveniência

**Documentos canônicos:**
- `Decision_Safety_and_Containment_Contract.md`: "Decidir por heurística implícita" é proibido
- `USER_PROFILE_CONTRACT.md`: Perfil é READ-MODEL, não identidade

---

## 5) REGRA ABSOLUTA DE IDENTIDADE

### 5.1 Nenhuma Ação Existe sem ACTOR Explícito

**Regra inquebrável:**

> **Toda ação no sistema DEVE ter um `actor_id` explícito.**

Não há exceções.  
Não há fallback.  
Não há inferência.

**O que isso significa:**

- Toda requisição mutável (POST, PUT, PATCH, DELETE) DEVE conter `actingActorId` explícito
- Toda tabela operacional DEVE ter `actor_id` ou `created_by_actor_id`
- Todo service DEVE receber `actorId` como parâmetro explícito
- Toda decisão DEVE ser baseada em `actor_id`, nunca em `user_id` ou contexto

**O que acontece se não houver actor explícito:**

- **Erro 400:** "Missing active actor. Provide x-acting-actor-id header or actingActorId in body."
- Sem fallback
- Sem criação automática
- Sem inferência

**Documentos canônicos:**
- `backend/docs/MODELO_ATOR.md`: "Forçar a escolha do ATOR antes da ação"
- `Decision_Safety_and_Containment_Contract.md`: "Nenhuma mudança de comportamento pode existir sem uma decisão explícita"

### 5.2 Actor Nunca Pode Ser Inferido

**Regra inquebrável:**

> **Actor NUNCA pode ser inferido, assumido ou derivado.**

**Proibições absolutas:**

- Inferir actor a partir de `user_id`
- Assumir actor do contexto da requisição
- Derivar actor de ownership
- Criar actor automaticamente se não existir
- Usar fallback de actor

**O que isso significa:**

- Se `actingActorId` não for fornecido → **ERRO 400**
- Se actor não existir → **ERRO 404** (não criar)
- Se user não tiver autoridade → **ERRO 403** (não inferir)

**Documentos canônicos:**
- `CORE_IMUTAVEL.md`: Core não pode ser inferido
- `Decision_Safety_and_Containment_Contract.md`: "Inferir intenção humana" é proibido

### 5.3 Actor Nunca Pode Ter Fallback Automático

**Regra inquebrável:**

> **Actor NUNCA pode ter fallback automático, criação silenciosa ou resolução implícita.**

**Proibições absolutas:**

- Fallback para actor do próprio user se não fornecido
- Criação automática de actor se não existir
- Resolução implícita de actor do contexto
- Assumir actor padrão

**O que isso significa:**

- Se `actingActorId` não for fornecido → **ERRO 400** (não fallback)
- Se actor não existir → **ERRO 404** (não criar)
- Se user não tiver autoridade → **ERRO 403** (não assumir)

**Código proibido (exemplo de violação):**

```typescript
// ❌ PROIBIDO: Fallback automático
if (!actingActorId) {
  actingActorId = await findOrCreateUserActor(userId);
}
```

**Código correto:**

```typescript
// ✅ CORRETO: Erro explícito
if (!actingActorId) {
  throw new BadRequestError('Missing active actor');
}
```

**Documentos canônicos:**
- `backend/docs/MODELO_ATOR.md`: "Forçar a escolha do ATOR antes da ação"
- `Decision_Safety_and_Containment_Contract.md`: "Silêncio ou inferência são violações graves"

---

## 6) PROIBIÇÕES ABSOLUTAS (BLOQUEIO AUTOMÁTICO)

### 6.1 Fallback de Actor

**Proibição absoluta:**

> **Qualquer código que implemente fallback automático de actor é AUTOMATICAMENTE BLOQUEADO.**

**Exemplos de violação:**

- Fallback para actor do próprio user se não fornecido
- Criação automática de actor se não existir
- Resolução implícita de actor do contexto
- Assumir actor padrão

**Ação institucional:**

- **BLOQUEAR** qualquer proposta que contenha fallback de actor
- **BLOQUEAR** qualquer código que crie actor automaticamente
- **BLOQUEAR** qualquer middleware que resolva actor implicitamente

**Documentos canônicos:**
- `CORE_IMUTAVEL.md`: Core não pode ser inferido
- `Decision_Safety_and_Containment_Contract.md`: Decisões não podem ser implícitas

### 6.2 Criação Automática de Actor

**Proibição absoluta:**

> **Qualquer código que crie actor automaticamente é AUTOMATICAMENTE BLOQUEADO.**

**Exemplos de violação:**

- Criar actor do user automaticamente se não existir
- Criar actor da empresa automaticamente ao criar empresa
- Criar actor do grupo automaticamente ao criar grupo

**Ação institucional:**

- **BLOQUEAR** qualquer proposta que crie actor automaticamente
- **BLOQUEAR** qualquer código que implemente criação silenciosa de actor
- **BLOQUEAR** qualquer middleware que crie actor como fallback

**Nota:** Criação de actor deve ser **explícita e auditável**, nunca automática ou silenciosa.

**Documentos canônicos:**
- `CORE_IMUTAVEL.md`: Core não pode ser criado automaticamente
- `Decision_Safety_and_Containment_Contract.md`: Decisões devem ser explícitas

### 6.3 Uso de user_id Como Identidade

**Proibição absoluta:**

> **Qualquer código que use `user_id` como identidade operacional é AUTOMATICAMENTE BLOQUEADO.**

**Exemplos de violação:**

- Usar `user_id` para decidir ações
- Usar `user_id` como identidade em tabelas operacionais
- Substituir `actor_id` por `user_id`
- Decidir permissões baseado em `user_id`

**Ação institucional:**

- **BLOQUEAR** qualquer proposta que use `user_id` como identidade
- **BLOQUEAR** qualquer código que substitua `actor_id` por `user_id`
- **BLOQUEAR** qualquer tabela que use `user_id` como identidade operacional

**Documentos canônicos:**
- `CORE_VS_MODULOS_CONTRACT.md`: "Ações, permissões e visibilidade sempre passam por actor"
- `MAPA_CANONICO_PERMISSIONS_v1.md`: Permissões são baseadas em actor

### 6.4 Heurísticas de Permissão

**Proibição absoluta:**

> **Qualquer código que use heurísticas para decidir permissões é AUTOMATICAMENTE BLOQUEADO.**

**Exemplos de violação:**

- `if (user.id === owner.id) { allow }`
- `if (isOwner) { allow }`
- `if (user.canDoThis) { allow }`
- Decidir permissão por padrão ou contexto

**Ação institucional:**

- **BLOQUEAR** qualquer proposta que use heurísticas de permissão
- **BLOQUEAR** qualquer código que decida permissões localmente
- **BLOQUEAR** qualquer service que não use `authorization.service.canActAs()`

**Documentos canônicos:**
- `Decision_Safety_and_Containment_Contract.md`: "Decidir por heurística implícita" é proibido
- `MAPA_CANONICO_PERMISSIONS_v1.md`: Permissões são centralizadas

### 6.5 Decisões Locais de Ownership

**Proibição absoluta:**

> **Qualquer código que verifique ownership localmente é AUTOMATICAMENTE BLOQUEADO.**

**Exemplos de violação:**

- Verificar ownership em services individuais
- Decidir ownership por padrão ou contexto
- Implementar lógica de ownership duplicada

**Ação institucional:**

- **BLOQUEAR** qualquer proposta que verifique ownership localmente
- **BLOQUEAR** qualquer código que duplique lógica de ownership
- **BLOQUEAR** qualquer service que não use `authorization.service.canActAs()`

**Documentos canônicos:**
- `MAPA_CANONICO_PERMISSIONS_v1.md`: Permissões são centralizadas
- `Decision_Safety_and_Containment_Contract.md`: Decisões devem ser auditáveis

### 6.6 Múltiplas Fontes de Identidade

**Proibição absoluta:**

> **Qualquer código que crie múltiplas fontes de identidade é AUTOMATICAMENTE BLOQUEADO.**

**Exemplos de violação:**

- Criar sistema paralelo de identidade
- Duplicar lógica de actor
- Implementar identidade alternativa

**Ação institucional:**

- **BLOQUEAR** qualquer proposta que crie fonte de identidade paralela
- **BLOQUEAR** qualquer código que duplique sistema de actor
- **BLOQUEAR** qualquer estrutura que substitua actor

**Documentos canônicos:**
- `CORE_IMUTAVEL.md`: Core não pode ser duplicado
- `CHECK_DUPLICIDADE_OBRIGATORIO.md`: Duplicação é violação institucional

---

## 7) FLUXO CANÔNICO DE IDENTIDADE

### 7.1 Resolução do Actor

**Fluxo obrigatório:**

1. Cliente envia `x-acting-actor-id` header ou `actingActorId` no body
2. Middleware valida que actor existe (busca em `actors` table)
3. Se actor não existir → **ERRO 404**
4. Se actor não for fornecido → **ERRO 400** (sem fallback)
5. Middleware injeta `actionContext.actingActorId` no request

**Documentos canônicos:**
- `backend/src/core/action-context/action-context.middleware.ts`: implementação canônica
- `backend/docs/MODELO_ATOR.md`: definição arquitetural

### 7.2 Validação de Autoridade

**Fluxo obrigatório:**

1. Middleware valida que user tem autoridade para atuar como actor
2. Verifica ownership (user é o próprio actor ou owner da entidade)
3. Verifica delegação (user tem delegação ativa)
4. Se não tiver autoridade → **ERRO 403**
5. Middleware injeta `actionContext.authoritySource` no request

**Documentos canônicos:**
- `backend/src/core/action-context/action-context.middleware.ts`: implementação canônica
- `authorization.service.ts`: único ponto de verificação

### 7.3 Autorização

**Fluxo obrigatório:**

1. Service recebe `actionContext.actingActorId`
2. Service chama `authorization.service.canActAs(tenantId, userId, actorId, permissionKey)`
3. Authorization service verifica:
   - Ownership (user é o próprio actor ou owner da entidade)
   - Delegation (user tem delegação ativa com scope)
   - Capability (actor tem capability requerida)
4. Retorna `AuthorizationResult` com `allowed` e `authoritySource`
5. Service decide baseado no resultado

**Documentos canônicos:**
- `MAPA_CANONICO_PERMISSIONS_v1.md`: Como determinar se user pode fazer ação
- `backend/src/core/authorization/authorization.service.ts`: implementação canônica

### 7.4 Delegação

**Fluxo obrigatório:**

1. Delegação é criada via `actor-delegation.repository`
2. Delegação contém `scopes` (lista de permissions)
3. Authorization service verifica delegação ativa
4. Verifica se scope contém permission requerida
5. Retorna `authoritySource: 'delegation'`

**Documentos canônicos:**
- `backend/src/core/authorization/authorization.service.ts`: verificação de delegação
- `actor-delegation.repository`: gerenciamento de delegações

### 7.5 Ownership

**Fluxo obrigatório:**

1. Ownership é verificado via `authorization.service.checkOwnership()`
2. Não pode ser verificado localmente
3. Usa `actor_registry` para mapear actor → entidade
4. Verifica via `company_members`, `groups.owner_actor_id`, etc.

**Documentos canônicos:**
- `backend/src/core/authorization/authorization.service.ts`: único ponto de verificação de ownership

---

## 8) RELAÇÃO COM PERMISSÕES

### 8.1 authorization.service Como Único Decisor

**Regra absoluta:**

> **`authorization.service.canActAs()` é o ÚNICO ponto de verificação de permissões no sistema.**

**O que isso significa:**

- Toda verificação de permissão DEVE passar por `authorization.service.canActAs()`
- Nenhum service pode verificar permissões localmente
- Nenhum código pode decidir permissões por heurística
- Nenhum middleware pode verificar permissões (exceto validação básica de autoridade)

**Código proibido (exemplo de violação):**

```typescript
// ❌ PROIBIDO: Verificação local de permissão
if (user.id === owner.id) {
  // permitir
}
```

**Código correto:**

```typescript
// ✅ CORRETO: Usar authorization service
const auth = await authorizationService.canActAs(
  tenantId,
  userId,
  actorId,
  'publish_feed'
);
if (!auth.allowed) {
  throw new ForbiddenError();
}
```

**Documentos canônicos:**
- `MAPA_CANONICO_PERMISSIONS_v1.md`: Permissões são centralizadas
- `backend/src/core/authorization/authorization.service.ts`: implementação canônica

### 8.2 MAPA_CANONICO_PERMISSIONS_v1.md Como Matriz Soberana

**Regra absoluta:**

> **`MAPA_CANONICO_PERMISSIONS_v1.md` é a ÚNICA fonte de verdade para permissões no sistema.**

**O que isso significa:**

- Toda permissão DEVE estar definida em `MAPA_CANONICO_PERMISSIONS_v1.md`
- Nenhuma permissão pode ser criada sem atualizar o mapa canônico
- Nenhuma permissão pode ser decidida fora do mapa canônico
- Nenhuma heurística pode substituir o mapa canônico

**Documentos canônicos:**
- `MAPA_CANONICO_PERMISSIONS_v1.md`: matriz soberana de permissões
- `Decision_Safety_and_Containment_Contract.md`: Decisões devem ser explícitas e versionadas

---

## 9) PADRÕES PROIBIDOS (COM EXEMPLOS)

### 9.1 if user_id == owner_id

**Padrão proibido:**

```typescript
// ❌ PROIBIDO
if (user.id === owner.id) {
  // permitir ação
}
```

**Por que é proibido:**

- Usa `user_id` como identidade operacional
- Decisão local de ownership
- Não passa por `authorization.service.canActAs()`
- Viola separação entre identidade e ownership

**Padrão correto:**

```typescript
// ✅ CORRETO
const auth = await authorizationService.canActAs(
  tenantId,
  userId,
  actorId,
  'required_permission'
);
if (!auth.allowed) {
  throw new ForbiddenError();
}
```

### 9.2 Fallback Automático

**Padrão proibido:**

```typescript
// ❌ PROIBIDO
if (!actingActorId) {
  actingActorId = await findOrCreateUserActor(userId);
}
```

**Por que é proibido:**

- Fallback automático de actor
- Criação silenciosa de actor
- Inferência de identidade
- Viola regra de actor explícito

**Padrão correto:**

```typescript
// ✅ CORRETO
if (!actingActorId) {
  throw new BadRequestError('Missing active actor');
}
```

### 9.3 Inferência por Contexto

**Padrão proibido:**

```typescript
// ❌ PROIBIDO
const actorId = req.body.companyId 
  ? await findCompanyActor(req.body.companyId)
  : await findUserActor(userId);
```

**Por que é proibido:**

- Inferência de actor do contexto
- Decisão implícita de identidade
- Viola regra de actor explícito

**Padrão correto:**

```typescript
// ✅ CORRETO
const actorId = req.body.actingActorId;
if (!actorId) {
  throw new BadRequestError('Missing active actor');
}
```

### 9.4 Heurística de Permissão

**Padrão proibido:**

```typescript
// ❌ PROIBIDO
if (user.isOwner || user.isAdmin) {
  // permitir ação
}
```

**Por que é proibido:**

- Heurística de permissão
- Decisão local de autorização
- Não passa por `authorization.service.canActAs()`
- Viola centralização de permissões

**Padrão correto:**

```typescript
// ✅ CORRETO
const auth = await authorizationService.canActAs(
  tenantId,
  userId,
  actorId,
  'required_permission'
);
if (!auth.allowed) {
  throw new ForbiddenError();
}
```

### 9.5 Verificação Local de Ownership

**Padrão proibido:**

```typescript
// ❌ PROIBIDO
const isOwner = await checkLocalOwnership(userId, entityId);
if (isOwner) {
  // permitir ação
}
```

**Por que é proibido:**

- Decisão local de ownership
- Duplicação de lógica
- Não passa por `authorization.service.canActAs()`
- Viola centralização de autorização

**Padrão correto:**

```typescript
// ✅ CORRETO
const auth = await authorizationService.canActAs(
  tenantId,
  userId,
  actorId,
  'required_permission'
);
if (!auth.allowed) {
  throw new ForbiddenError();
}
```

---

## 10) PADRÕES PERMITIDOS (COM EXEMPLOS)

### 10.1 Uso Explícito de actor_id

**Padrão permitido:**

```typescript
// ✅ PERMITIDO
const actorId = req.body.actingActorId;
if (!actorId) {
  throw new BadRequestError('Missing active actor');
}

const actor = await actorRepository.findById(tenantId, actorId);
if (!actor) {
  throw new NotFoundError('Actor not found');
}
```

**Por que é permitido:**

- Actor é explícito
- Validação clara
- Sem inferência
- Sem fallback

### 10.2 Chamada a authorization.service.canActAs()

**Padrão permitido:**

```typescript
// ✅ PERMITIDO
const auth = await authorizationService.canActAs(
  tenantId,
  userId,
  actorId,
  'publish_feed'
);

if (!auth.allowed) {
  throw new ForbiddenError('Not authorized');
}

// Executar ação em nome do actor
await createPost(tenantId, actorId, content);
```

**Por que é permitido:**

- Usa serviço centralizado
- Verificação explícita
- Decisão auditável
- Respeita mapa canônico de permissões

### 10.3 Validação de Actor no Middleware

**Padrão permitido:**

```typescript
// ✅ PERMITIDO
export async function actionContextMiddleware(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const actingActorId = req.headers['x-acting-actor-id'];
  
  if (!actingActorId) {
    return reply.status(400).send({ 
      error: 'Missing active actor' 
    });
  }

  const actor = await actorRepository.findById(tenantId, actingActorId);
  if (!actor) {
    return reply.status(404).send({ 
      error: 'Actor not found' 
    });
  }

  // Validar autoridade básica (ownership ou delegação)
  // ...
}
```

**Por que é permitido:**

- Validação explícita
- Erro claro se não fornecido
- Sem fallback
- Sem inferência

---

## 11) GATE IDENTITÁRIO OBRIGATÓRIO

### 11.1 Perguntas Obrigatórias

Antes de implementar **QUALQUER COISA** que envolva identidade, actor, permissões, ownership ou delegação, a IA (ou humano) **DEVE** responder explicitamente:

1. **"Qual é o ACTOR explícito desta ação?"**
   - Se não houver resposta clara → **BLOQUEAR**

2. **"Como a permissão é verificada?"**
   - Se não usar `authorization.service.canActAs()` → **BLOQUEAR**

3. **"Onde a identidade é decidida?"**
   - Se não for no `action-context.middleware.ts` → **BLOQUEAR**

4. **"Existe fallback de identidade?"**
   - Se houver fallback → **BLOQUEAR**

5. **"A identidade é inferida ou explícita?"**
   - Se for inferida → **BLOQUEAR**

6. **"A permissão está no MAPA_CANONICO_PERMISSIONS_v1.md?"**
   - Se não estiver → **BLOQUEAR**

7. **"A verificação de ownership é local ou centralizada?"**
   - Se for local → **BLOQUEAR**

### 11.2 Checklist Mínimo

Antes de implementar qualquer coisa identitária, a IA (ou humano) deve:

- [ ] Citar este contrato
- [ ] Provar que não cria fonte de identidade paralela
- [ ] Mapear o fluxo atual de identidade no código/banco/docs
- [ ] Garantir que qualquer identidade é compatível com Actor
- [ ] Garantir que permissões passam por `authorization.service.canActAs()`
- [ ] Garantir que não há fallback de actor
- [ ] Garantir que não há inferência de identidade

**Sem isso → proposta inválida.**

**Documentos canônicos:**
- `CHECK_DUPLICIDADE_OBRIGATORIO.md`: Checklist obrigatório antes de qualquer ação
- `RITUAL_DE_INICIALIZACAO_IA_GUARDIA.md`: Ritual antes de validação

---

## 12) AUTORIDADE DOCUMENTAL

### 12.1 Relação com CORE_IMUTAVEL.md

Este contrato é **subordinado** a `CORE_IMUTAVEL.md` e **implementa** a seção "SISTEMA DE ACTORS" (linhas 36-40).

**Hierarquia:**

- `CORE_IMUTAVEL.md` define que Actor é Core Imutável
- `IDENTITY_CORE_CONTRACT.md` define **COMO** Actor funciona
- Este contrato **NÃO pode** contradizer `CORE_IMUTAVEL.md`

**Documentos canônicos:**
- `CORE_IMUTAVEL.md`: autoridade máxima sobre Core
- `HIERARQUIA_E_AUTORIDADE_DOS_DOCUMENTOS.md`: hierarquia documental

### 12.2 Hierarquia Documental

Este contrato está no **NÍVEL 1 — CORE E CONTRATOS (BINDING / LEI DO SISTEMA)**.

**Autoridade:**

- Autoridade máxima sobre identidade, actor, permissões, ownership e delegação
- Nada pode violar, contornar ou reinterpretar este contrato
- Se uma solicitação conflitar com este contrato → **RECUSAR**

**Documentos canônicos:**
- `HIERARQUIA_E_AUTORIDADE_DOS_DOCUMENTOS.md`: Nível 1 — CORE E CONTRATOS

### 12.3 Efeito Vinculante

Este contrato é:

- **CANÔNICO:** fonte de verdade institucional
- **IMUTÁVEL:** não pode ser alterado sem processo formal
- **OBRIGATÓRIO:** aplica-se a código, banco, serviços, IAs e decisões humanas
- **VINCULANTE:** qualquer violação invalida a implementação

**Aplicação:**

- Código que viola este contrato → **BLOQUEAR BUILD**
- Proposta que viola este contrato → **RECUSAR**
- Decisão que viola este contrato → **INVÁLIDA**

**Documentos canônicos:**
- `CORE_IMUTAVEL.md`: Status IMUTÁVEL, Autoridade MÁXIMA
- `GOVERNANCA_E_VISAO_CANONICA_UNIFICARD.md`: Nada é permitido sem autorização documental explícita

---

## 13) FRASE CANÔNICA FINAL

No UnifiCard:

> **Identidade é Core.  
> Nenhuma ação existe sem ACTOR explícito.  
> Identidade não é inferida.  
> Identidade não tem fallback.  
> Identidade não é decidida localmente.**

---

## 14) DOCUMENTOS CANÔNICOS CITADOS

Este contrato é respaldado por:

- `CORE_IMUTAVEL.md` — Define Actor como Core Imutável
- `CORE_VS_MODULOS_CONTRACT.md` — Define regras bloqueantes do sistema de Actors
- `MAPA_CANONICO_PERMISSIONS_v1.md` — Matriz soberana de permissões
- `Decision_Safety_and_Containment_Contract.md` — Proíbe decisões implícitas e heurísticas
- `CHECK_DUPLICIDADE_OBRIGATORIO.md` — Proíbe duplicação de Core
- `USER_PROFILE_CONTRACT.md` — Define que perfil não é identidade
- `backend/docs/MODELO_ATOR.md` — Definição arquitetural do Actor
- `HIERARQUIA_E_AUTORIDADE_DOS_DOCUMENTOS.md` — Hierarquia documental

---

**Status:** CANÔNICO • IMUTÁVEL • VINCULANTE  
**Autoridade:** NÍVEL 1 (CORE / LEI DO SISTEMA)  
**Última atualização:** 2024-12-19


