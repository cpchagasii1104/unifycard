# DECISION CORE CONTRACT — UNIFICARD

## Contrato Canônico — Core de Decisão e Autorização do UnifiCard

Este documento define o **CORE DE DECISÃO E AUTORIZAÇÃO** do UnifiCard.

**Autoridade:** NÍVEL 1 (CORE / LEI DO SISTEMA).  
Se qualquer proposta conflitar com este contrato → **RECUSAR**.

---

## 1) DEFINIÇÃO ABSOLUTA DE DECISÃO

### 1.1 O Que Constitui uma Decisão no UnifiCard

Uma **decisão** ocorre quando o sistema:

- altera comportamento,
- restringe ou libera ações,
- prioriza, filtra ou ordena resultados,
- escolhe caminhos,
- executa algo sem intervenção humana direta,
- autoriza ou nega uma operação,
- determina permissões ou capacidades.

**Regra absoluta:** Se algo **muda o que acontece**, é uma decisão — sem exceções.

**Documentos canônicos:**
- `Decision_Safety_and_Containment_Contract.md` (linhas 23-31): Definição canônica de decisão

### 1.2 Diferença Entre Decisão, Validação e Execução

**DECISÃO:**
- Determina **SE** algo pode acontecer
- Altera comportamento do sistema
- Requer autorização explícita
- Deve passar por `authorization.service.canActAs()`
- Gera evento imutável de auditoria

**VALIDAÇÃO:**
- Verifica **SE** dados estão corretos
- Não altera comportamento
- Não requer autorização
- Pode ser local (formato, tipo, estrutura)

**EXECUÇÃO:**
- **FAZ** algo após decisão autorizada
- Não decide, apenas executa
- Requer decisão prévia explícita

**Regra absoluta:** Validação e execução **NÃO são decisões**. Apenas decisão altera comportamento.

---

## 2) PRINCÍPIO FUNDAMENTAL

### 2.1 Decisão é Core

**Decisão** é **Core Imutável** do UnifiCard.

Isso significa:

- NÃO pode ser duplicado
- NÃO pode ser inferida
- NÃO pode ser distribuída
- NÃO pode ser substituída
- NÃO pode ser contornada
- NÃO pode ser flexibilizada por conveniência técnica, comercial ou operacional

Todo o restante do sistema **SE CONECTA** ao Core de Decisão.  
Nada o replica. Nada o substitui. Nada opera em paralelo.

**Documentos canônicos:**
- `CORE_IMUTAVEL.md` (linhas 14-24): Core não pode ser duplicado
- `Decision_Safety_and_Containment_Contract.md` (linhas 12-18): Princípio fundamental

### 2.2 Decisão Não é Implícita

**Regra absoluta:**

> **Nenhuma decisão pode ser implícita, assumida ou inferida.**

**O que isso significa:**

- Decisões devem ser explícitas e verificáveis
- Decisões devem passar por `authorization.service.canActAs()`
- Decisões devem ter permissão explícita no `MAPA_CANONICO_PERMISSIONS_v1.md`
- Decisões não podem ser "assumidas" ou "inferidas" do contexto

**Documentos canônicos:**
- `Decision_Safety_and_Containment_Contract.md` (linhas 16-17): "Nenhuma mudança de comportamento pode existir sem uma decisão explícita"

### 2.3 Decisão Não é Heurística

**Regra absoluta:**

> **Nenhuma decisão pode ser baseada em heurística, padrão ou inferência.**

**O que isso significa:**

- Decisões não podem usar "se X então Y" sem autorização explícita
- Decisões não podem assumir permissões baseadas em padrões
- Decisões não podem inferir autorização do contexto
- Decisões devem ser baseadas exclusivamente em `authorization.service.canActAs()`

**Documentos canônicos:**
- `Decision_Safety_and_Containment_Contract.md` (linha 67): "Decidir por heurística implícita" é proibido

### 2.4 Decisão Não é Distribuída

**Regra absoluta:**

> **Nenhuma decisão pode ser distribuída em múltiplos pontos do sistema.**

**O que isso significa:**

- Todas as decisões devem passar por `authorization.service.canActAs()`
- Não pode haver decisões locais em services
- Não pode haver múltiplas fontes de decisão
- Não pode haver bypass do `authorization.service`

**Documentos canônicos:**
- `CORE_IMUTAVEL.md` (linha 23): "NÃO pode ser duplicado"
- `CHECK_DUPLICIDADE_OBRIGATORIO.md`: Duplicação é violação institucional

---

## 3) ÚNICO DECISOR CANÔNICO

### 3.1 authorization.service.ts Como Único Ponto de Decisão

**Regra absoluta:**

> **`authorization.service.canActAs()` é o ÚNICO ponto de decisão de autorização no sistema.**

**O que isso significa:**

- Toda decisão de autorização DEVE passar por `authorization.service.canActAs()`
- Nenhum service pode decidir autorização localmente
- Nenhum middleware pode decidir autorização (exceto validação básica)
- Nenhum código pode bypassar `authorization.service`

**Arquivo canônico:**
- `backend/src/core/authorization/authorization.service.ts`

**Documentos canônicos:**
- `IDENTITY_CORE_CONTRACT.md` (linha 8.1): `authorization.service` como único decisor

### 3.2 MAPA_CANONICO_PERMISSIONS Como Matriz Soberana

**Regra absoluta:**

> **`MAPA_CANONICO_PERMISSIONS_v1.md` é a ÚNICA fonte de verdade para permissões no sistema.**

**O que isso significa:**

- Toda permissão DEVE estar definida em `MAPA_CANONICO_PERMISSIONS_v1.md`
- Nenhuma permissão pode ser criada sem atualizar o mapa canônico
- Nenhuma permissão pode ser decidida fora do mapa canônico
- Nenhuma heurística pode substituir o mapa canônico

**Documentos canônicos:**
- `MAPA_CANONICO_PERMISSIONS_v1.md`: Matriz soberana de permissões
- `Decision_Safety_and_Containment_Contract.md` (linhas 47-49): Regras nunca são implícitas

---

## 4) O QUE NÃO É DECISÃO

### 4.1 Score

**Score** é:

- **READ-MODEL:** métrica calculada
- **Função:** exibição, não decisão
- **Uso:** referência, não autorização

**NÃO é:**
- decisão
- autorização
- permissão

**Proibição absoluta:**
- Decidir baseado em score
- Usar score para autorizar ações
- Substituir `authorization.service` por verificação de score

**Documentos canônicos:**
- `Decision_Safety_and_Containment_Contract.md` (linha 65): "Decidir por score" é proibido

### 4.2 Reputação

**Reputação** é:

- **READ-MODEL:** nível calculado baseado em histórico
- **Função:** exibição, não decisão
- **Uso:** referência, não autorização

**NÃO é:**
- decisão
- autorização
- permissão

**Proibição absoluta:**
- Decidir baseado em reputação
- Usar reputação para autorizar ações
- Substituir `authorization.service` por verificação de reputação

**Documentos canônicos:**
- `Decision_Safety_and_Containment_Contract.md` (linha 65): "Decidir por score" é proibido (reputação é score)

### 4.3 Estado Mutável

**Estado mutável** é:

- **INPUT:** dados que podem mudar
- **Função:** armazenamento, não decisão
- **Uso:** referência, não autorização

**NÃO é:**
- decisão
- autorização
- permissão

**Proibição absoluta:**
- Decidir baseado em estado mutável
- Usar estado mutável para autorizar ações
- Substituir `authorization.service` por verificação de estado

**Documentos canônicos:**
- `Decision_Safety_and_Containment_Contract.md` (linha 64): "Decidir por estado mutável" é proibido

### 4.4 Ownership Implícito

**Ownership implícito** é:

- **INPUT:** relação de propriedade inferida
- **Função:** referência, não decisão
- **Uso:** auxiliar na resolução, não autorização direta

**NÃO é:**
- decisão
- autorização
- permissão

**Proibição absoluta:**
- Decidir baseado em ownership implícito
- Usar ownership como autorização direta
- Substituir `authorization.service` por verificação local de ownership

**Documentos canônicos:**
- `IDENTITY_CORE_CONTRACT.md` (linha 6.5): "Decisões locais de ownership" são proibidas

### 4.5 Contexto

**Contexto** é:

- **INPUT:** informação derivada da requisição
- **Função:** auxiliar na resolução, não decisão
- **Uso:** referência, não autorização

**NÃO é:**
- decisão
- autorização
- permissão

**Proibição absoluta:**
- Decidir baseado em contexto
- Inferir autorização do contexto
- Substituir `authorization.service` por verificação de contexto

**Documentos canônicos:**
- `Decision_Safety_and_Containment_Contract.md` (linha 69): "Inferir intenção humana" é proibido

### 4.6 Heurística

**Heurística** é:

- **PROIBIDO:** qualquer inferência de decisão
- **Função:** NENHUMA — heurísticas de decisão são violação institucional
- **Uso:** NENHUM — decisão não pode ser inferida

**Proibição absoluta:**
- Decidir por heurística
- Inferir autorização por padrão
- Assumir permissão por conveniência

**Documentos canônicos:**
- `Decision_Safety_and_Containment_Contract.md` (linha 67): "Decidir por heurística implícita" é proibido

### 4.7 if/else Local em Services

**if/else local em services** é:

- **PROIBIDO:** qualquer decisão de autorização em services
- **Função:** NENHUMA — decisões devem ser centralizadas
- **Uso:** NENHUM — services não decidem autorização

**Proibição absoluta:**
- Decidir autorização em services individuais
- Usar if/else para verificar permissões localmente
- Substituir `authorization.service` por lógica local

**Documentos canônicos:**
- `CORE_IMUTAVEL.md` (linha 23): "NÃO pode ser duplicado"
- `CHECK_DUPLICIDADE_OBRIGATORIO.md`: Duplicação é violação institucional

---

## 5) PROIBIÇÕES ABSOLUTAS (BLOQUEIO AUTOMÁTICO)

### 5.1 Decisões Baseadas em Score

**Proibição absoluta:**

> **Qualquer código que decida baseado em score é AUTOMATICAMENTE BLOQUEADO.**

**Exemplos de violação:**

- Decidir permissão baseado em `reputation_level`
- Autorizar ação baseado em `trust_score`
- Bloquear ação baseado em `risk_score`

**Ação institucional:**

- **BLOQUEAR** qualquer proposta que decida baseado em score
- **BLOQUEAR** qualquer código que use score para autorização
- **BLOQUEAR** qualquer service que substitua `authorization.service` por verificação de score

**Documentos canônicos:**
- `Decision_Safety_and_Containment_Contract.md` (linha 65): "Decidir por score" é proibido

### 5.2 Decisões Baseadas em Estado Mutável

**Proibição absoluta:**

> **Qualquer código que decida baseado em estado mutável é AUTOMATICAMENTE BLOQUEADO.**

**Exemplos de violação:**

- Decidir permissão baseado em dívidas pendentes
- Autorizar ação baseado em status de conta
- Bloquear ação baseado em flags mutáveis

**Ação institucional:**

- **BLOQUEAR** qualquer proposta que decida baseado em estado mutável
- **BLOQUEAR** qualquer código que use estado mutável para autorização
- **BLOQUEAR** qualquer service que substitua `authorization.service` por verificação de estado

**Documentos canônicos:**
- `Decision_Safety_and_Containment_Contract.md` (linha 64): "Decidir por estado mutável" é proibido

### 5.3 Permissões Implícitas

**Proibição absoluta:**

> **Qualquer código que assuma permissões implícitas é AUTOMATICAMENTE BLOQUEADO.**

**Exemplos de violação:**

- Assumir permissão se `requiresPermission()` retornar false
- Autorizar ação sem verificar permissão explícita
- Permitir ação baseado em contexto ou padrão

**Ação institucional:**

- **BLOQUEAR** qualquer proposta que assuma permissões implícitas
- **BLOQUEAR** qualquer código que não verifique permissão explicitamente
- **BLOQUEAR** qualquer service que permita ações sem `authorization.service.canActAs()`

**Documentos canônicos:**
- `Decision_Safety_and_Containment_Contract.md` (linhas 16-17): Decisões devem ser explícitas
- `MAPA_CANONICO_PERMISSIONS_v1.md`: Permissões devem estar no mapa canônico

### 5.4 Decisões Locais em Services

**Proibição absoluta:**

> **Qualquer código que decida autorização localmente em services é AUTOMATICAMENTE BLOQUEADO.**

**Exemplos de violação:**

- Verificar ownership localmente em services
- Decidir permissão baseado em heurística local
- Substituir `authorization.service` por lógica local

**Ação institucional:**

- **BLOQUEAR** qualquer proposta que decida autorização localmente
- **BLOQUEAR** qualquer código que duplique lógica de autorização
- **BLOQUEAR** qualquer service que não use `authorization.service.canActAs()`

**Documentos canônicos:**
- `CORE_IMUTAVEL.md` (linha 23): "NÃO pode ser duplicado"
- `CHECK_DUPLICIDADE_OBRIGATORIO.md`: Duplicação é violação institucional

### 5.5 Múltiplas Fontes de Decisão

**Proibição absoluta:**

> **Qualquer código que crie fonte paralela de decisão é AUTOMATICAMENTE BLOQUEADO.**

**Exemplos de violação:**

- Criar `business-authorization.service` paralelo
- Criar `reputation-authorization.service` paralelo
- Criar qualquer service que decida autorização fora de `authorization.service`

**Ação institucional:**

- **BLOQUEAR** qualquer proposta que crie fonte paralela de decisão
- **BLOQUEAR** qualquer código que duplique sistema de autorização
- **BLOQUEAR** qualquer estrutura que substitua `authorization.service`

**Documentos canônicos:**
- `CORE_IMUTAVEL.md` (linha 23): "NÃO pode ser duplicado"
- `CHECK_DUPLICIDADE_OBRIGATORIO.md`: Duplicação é violação institucional

### 5.6 Bypass do authorization.service

**Proibição absoluta:**

> **Qualquer código que bypass o `authorization.service` é AUTOMATICAMENTE BLOQUEADO.**

**Exemplos de violação:**

- Verificar permissão sem chamar `authorization.service.canActAs()`
- Assumir autorização sem verificação explícita
- Usar lógica alternativa para autorização

**Ação institucional:**

- **BLOQUEAR** qualquer proposta que bypass `authorization.service`
- **BLOQUEAR** qualquer código que não use `authorization.service.canActAs()`
- **BLOQUEAR** qualquer service que decida autorização sem `authorization.service`

**Documentos canônicos:**
- `IDENTITY_CORE_CONTRACT.md` (linha 8.1): `authorization.service` como único decisor

---

## 6) FLUXO CANÔNICO DE DECISÃO

### 6.1 Input

**Fluxo obrigatório:**

1. Request contém `actingActorId` explícito (via `action-context.middleware.ts`)
2. Request contém `permissionKey` explícito (via `require-permission.guard.ts` ou service)
3. Service recebe `actionContext.actingActorId` e `permissionKey`

**O que isso significa:**

- Actor deve ser explícito (sem fallback)
- Permissão deve ser explícita (sem inferência)
- Contexto deve ser claro (sem ambiguidade)

**Documentos canônicos:**
- `IDENTITY_CORE_CONTRACT.md` (linha 5.1): Nenhuma ação existe sem ACTOR explícito

### 6.2 Validação

**Fluxo obrigatório:**

1. Validar que actor existe (busca em `actors` table)
2. Validar que permissão existe no `MAPA_CANONICO_PERMISSIONS_v1.md`
3. Validar que `permissionKey` é válido (via `isValidPermissionKey()`)

**O que isso significa:**

- Validação é pré-condição, não decisão
- Validação não altera comportamento
- Validação apenas verifica dados

**Documentos canônicos:**
- `MAPA_CANONICO_PERMISSIONS_v1.md`: Permissões devem estar no mapa canônico

### 6.3 Chamada ao authorization.service

**Fluxo obrigatório:**

1. Service chama `authorization.service.canActAs(tenantId, userId, actorId, permissionKey)`
2. Authorization service verifica:
   - Ownership (user é o próprio actor ou owner da entidade)
   - Delegation (user tem delegação ativa com scope)
   - Capability (actor tem capability requerida)
3. Retorna `AuthorizationResult` com `allowed` e `authoritySource`

**O que isso significa:**

- Decisão ocorre exclusivamente em `authorization.service`
- Decisão é explícita e auditável
- Decisão retorna estrutura clara

**Documentos canônicos:**
- `MAPA_CANONICO_PERMISSIONS_v1.md`: Como determinar se user pode fazer ação
- `backend/src/core/authorization/authorization.service.ts`: implementação canônica

### 6.4 Resposta Explícita (allowed / denied)

**Fluxo obrigatório:**

1. Service recebe `AuthorizationResult` de `authorization.service`
2. Se `allowed === false` → **ERRO 403** (Forbidden)
3. Se `allowed === true` → continuar para execução

**O que isso significa:**

- Resposta é explícita (não implícita)
- Resposta é clara (allowed ou denied)
- Resposta não pode ser inferida

**Documentos canônicos:**
- `Decision_Safety_and_Containment_Contract.md` (linhas 16-17): Decisões devem ser explícitas

### 6.5 Execução

**Fluxo obrigatório:**

1. Apenas após decisão autorizada (`allowed === true`)
2. Executar ação em nome do actor
3. Registrar evento imutável de auditoria

**O que isso significa:**

- Execução requer decisão prévia explícita
- Execução não decide, apenas executa
- Execução gera trilha de auditoria

**Documentos canônicos:**
- `Decision_Safety_and_Containment_Contract.md` (linhas 43-45): Decisão deve gerar evento imutável

---

## 7) RELAÇÃO COM IDENTIDADE

### 7.1 Decisões Sempre Ocorrem Sobre ACTOR Explícito

**Regra absoluta:**

> **Toda decisão DEVE ocorrer sobre um ACTOR explícito.**

**O que isso significa:**

- Decisões não podem ocorrer sem `actorId`
- Decisões não podem inferir actor do contexto
- Decisões não podem usar fallback de actor

**Documentos canônicos:**
- `IDENTITY_CORE_CONTRACT.md` (linha 5.1): Nenhuma ação existe sem ACTOR explícito

### 7.2 Nenhuma Decisão Ocorre Sem Actor

**Regra absoluta:**

> **Se não há ACTOR explícito, não há decisão válida.**

**O que isso significa:**

- Se `actorId` não for fornecido → **ERRO 400** (não decidir)
- Se actor não existir → **ERRO 404** (não decidir)
- Se user não tiver autoridade → **ERRO 403** (não decidir)

**Documentos canônicos:**
- `IDENTITY_CORE_CONTRACT.md` (linha 5.1): Nenhuma ação existe sem ACTOR explícito

---

## 8) RELAÇÃO COM PERMISSÕES

### 8.1 Toda Decisão Referencia permission_key

**Regra absoluta:**

> **Toda decisão DEVE referenciar um `permissionKey` explícito.**

**O que isso significa:**

- Decisões não podem ser genéricas
- Decisões não podem inferir permissão
- Decisões devem ter `permissionKey` explícito

**Documentos canônicos:**
- `MAPA_CANONICO_PERMISSIONS_v1.md`: Permissões devem estar no mapa canônico

### 8.2 Toda permission_key Deve Existir no MAPA_CANONICO_PERMISSIONS

**Regra absoluta:**

> **Toda `permissionKey` DEVE existir em `MAPA_CANONICO_PERMISSIONS_v1.md`.**

**O que isso significa:**

- Permissões não podem ser criadas ad-hoc
- Permissões não podem ser inferidas
- Permissões devem estar no mapa canônico

**Documentos canônicos:**
- `MAPA_CANONICO_PERMISSIONS_v1.md`: Fonte única de verdade para permissões
- `backend/src/core/authorization/permission-keys.ts`: Enum derivado do mapa canônico

---

## 9) PADRÕES PROIBIDOS (COM EXEMPLOS)

### 9.1 Decisões por Reputação

**Padrão proibido:**

```typescript
// ❌ PROIBIDO
const reputation = await reputationService.getReputation(tenantId, actorId);
if (reputation.reputation_level >= 2) {
  // permitir ação
}
```

**Por que é proibido:**

- Decisão baseada em score/reputação
- Não passa por `authorization.service.canActAs()`
- Viola separação entre read-model e decisão

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

### 9.2 Decisões por Dívida

**Padrão proibido:**

```typescript
// ❌ PROIBIDO
const hasDebt = await penaltyService.hasPendingDebts(tenantId, actorId);
if (hasDebt.hasDebt) {
  // bloquear ação
}
```

**Por que é proibido:**

- Decisão baseada em estado mutável
- Não passa por `authorization.service.canActAs()`
- Viola separação entre estado e decisão

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
// Verificar dívida como condição adicional (não como decisão)
const hasDebt = await penaltyService.hasPendingDebts(tenantId, actorId);
if (hasDebt.hasDebt) {
  throw new BadRequestError('Pending debts must be resolved');
}
```

### 9.3 Decisões por Ownership Local

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

### 9.4 Decisões por Heurística

**Padrão proibido:**

```typescript
// ❌ PROIBIDO
if (actor.actor_type === 'user' && actor.user_id === userId) {
  // sempre permitir
} else if (companyStatus === 'VERIFIED') {
  // permitir se verificado
}
```

**Por que é proibido:**

- Heurística de permissão
- Decisão implícita
- Não passa por `authorization.service.canActAs()`

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

### 10.1 Uso Explícito de authorization.service.canActAs()

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

### 10.2 Decisão Retornando Estrutura Explícita

**Padrão permitido:**

```typescript
// ✅ PERMITIDO
const auth = await authorizationService.canActAs(
  tenantId,
  userId,
  actorId,
  'manage_events'
);

return {
  allowed: auth.allowed,
  authoritySource: auth.authoritySource,
  reason: auth.reason,
};
```

**Por que é permitido:**

- Estrutura explícita
- Decisão clara
- Auditável
- Não ambígua

---

## 11) GATE DE DECISÃO OBRIGATÓRIO

### 11.1 Perguntas Obrigatórias

Antes de implementar **QUALQUER COISA** que envolva decisão, autorização ou permissão, a IA (ou humano) **DEVE** responder explicitamente:

1. **"Onde a decisão acontece?"**
   - Se não for em `authorization.service.canActAs()` → **BLOQUEAR**

2. **"Qual é o permissionKey explícito?"**
   - Se não houver `permissionKey` explícito → **BLOQUEAR**

3. **"A permissão está no MAPA_CANONICO_PERMISSIONS_v1.md?"**
   - Se não estiver → **BLOQUEAR**

4. **"A decisão é baseada em score, reputação ou estado mutável?"**
   - Se for → **BLOQUEAR**

5. **"A decisão passa por authorization.service?"**
   - Se não passar → **BLOQUEAR**

6. **"Existe fonte paralela de decisão?"**
   - Se existir → **BLOQUEAR**

7. **"A decisão é explícita ou implícita?"**
   - Se for implícita → **BLOQUEAR**

### 11.2 Checklist Mínimo

Antes de implementar qualquer coisa decisória, a IA (ou humano) deve:

- [ ] Citar este contrato
- [ ] Provar que não cria fonte paralela de decisão
- [ ] Mapear o fluxo atual de decisão no código/banco/docs
- [ ] Garantir que qualquer decisão é compatível com `authorization.service`
- [ ] Garantir que permissões passam por `MAPA_CANONICO_PERMISSIONS_v1.md`
- [ ] Garantir que não há decisões baseadas em score/estado mutável
- [ ] Garantir que decisão é explícita e auditável

**Sem isso → proposta inválida.**

**Documentos canônicos:**
- `CHECK_DUPLICIDADE_OBRIGATORIO.md`: Checklist obrigatório antes de qualquer ação
- `RITUAL_DE_INICIALIZACAO_IA_GUARDIA.md`: Ritual antes de validação

---

## 12) AUTORIDADE DOCUMENTAL

### 12.1 Relação com CORE_IMUTAVEL.md

Este contrato é **subordinado** a `CORE_IMUTAVEL.md` e **implementa** a seção "SISTEMA DE IDENTIDADE E PERMISSÕES" (linha 44).

**Hierarquia:**

- `CORE_IMUTAVEL.md` define que Decisão é Core Imutável
- `DECISION_CORE_CONTRACT.md` define **COMO** Decisão funciona
- Este contrato **NÃO pode** contradizer `CORE_IMUTAVEL.md`

**Documentos canônicos:**
- `CORE_IMUTAVEL.md`: autoridade máxima sobre Core
- `HIERARQUIA_E_AUTORIDADE_DOS_DOCUMENTOS.md`: hierarquia documental

### 12.2 Relação com Decision_Safety_and_Containment_Contract.md

Este contrato é **complementar** a `Decision_Safety_and_Containment_Contract.md` e **especifica** o Core de Decisão e Autorização.

**Hierarquia:**

- `Decision_Safety_and_Containment_Contract.md` define regras gerais de decisão
- `DECISION_CORE_CONTRACT.md` define **COMO** decisões de autorização funcionam
- Este contrato **NÃO pode** contradizer `Decision_Safety_and_Containment_Contract.md`

**Documentos canônicos:**
- `Decision_Safety_and_Containment_Contract.md`: regras supremas de contenção decisória
- `HIERARQUIA_E_AUTORIDADE_DOS_DOCUMENTOS.md`: hierarquia documental

### 12.3 Hierarquia Documental

Este contrato está no **NÍVEL 1 — CORE E CONTRATOS (BINDING / LEI DO SISTEMA)**.

**Autoridade:**

- Autoridade máxima sobre decisão, autorização, permissões
- Nada pode violar, contornar ou reinterpretar este contrato
- Se uma solicitação conflitar com este contrato → **RECUSAR**

**Documentos canônicos:**
- `HIERARQUIA_E_AUTORIDADE_DOS_DOCUMENTOS.md`: Nível 1 — CORE E CONTRATOS

### 12.4 Efeito Vinculante

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

> **Decisão é Core.  
> Decisão não é implícita.  
> Decisão não é heurística.  
> Decisão não é distribuída.  
> Sem decisão explícita, nada acontece.**

---

## 14) DOCUMENTOS CANÔNICOS CITADOS

Este contrato é respaldado por:

- `CORE_IMUTAVEL.md` — Define Decisão como Core Imutável
- `Decision_Safety_and_Containment_Contract.md` — Define regras supremas de decisão
- `MAPA_CANONICO_PERMISSIONS_v1.md` — Matriz soberana de permissões
- `IDENTITY_CORE_CONTRACT.md` — Define Actor como identidade única
- `CHECK_DUPLICIDADE_OBRIGATORIO.md` — Proíbe duplicação de Core
- `HIERARQUIA_E_AUTORIDADE_DOS_DOCUMENTOS.md` — Hierarquia documental

---

**Status:** CANÔNICO • IMUTÁVEL • VINCULANTE  
**Autoridade:** NÍVEL 1 (CORE / LEI DO SISTEMA)  
**Última atualização:** 2024-12-19


