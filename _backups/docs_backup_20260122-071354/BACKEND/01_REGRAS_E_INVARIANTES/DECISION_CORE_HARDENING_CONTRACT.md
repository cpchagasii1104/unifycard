# DECISION_CORE_HARDENING_CONTRACT

## STATUS
CANONICAL · BINDING · CORE

Este documento define o **HARDENING INSTITUCIONAL DO CORE DE DECISÃO E AUTORIZAÇÃO** do UnifiCard.
Seu conteúdo é **obrigatório**, **não-opcional** e **bloqueante**.

Ele complementa e operacionaliza:
- CORE_IMUTAVEL.md
- DECISION_CORE_CONTRACT.md
- Decision_Safety_and_Containment_Contract.md
- MAPA_CANONICO_PERMISSIONS_v1.md
- IDENTITY_CORE_CONTRACT.md
- CHECK_DUPLICIDADE_OBRIGATORIO.md

---

## PRINCÍPIO FUNDAMENTAL

No UnifiCard, **a decisão é um Core**.

Core:
- não se improvisa
- não se adapta
- não aceita exceções
- não se flexibiliza por conveniência técnica, comercial ou operacional

Qualquer violação ao Core de Decisão é uma **violação institucional**.

---

## DEFINIÇÃO FORMAL

O **authorization.service** é o **ÚNICO ponto de decisão de autorização** do sistema.

Decisão, autorização, permissão e verificação de acesso:
- **SÓ EXISTEM** através do `authorization.service.canActAs()`
- **NÃO PODEM** ser duplicados
- **NÃO PODEM** ser inferidos
- **NÃO PODEM** ser decididos localmente
- **NÃO PODEM** ser baseados em score, reputação ou estado mutável

---

## CHECKLIST CANÔNICO DE HARDENING DE DECISÃO

### Quando aplicar

Este checklist é **obrigatório** sempre que:
- um novo módulo for criado
- um módulo tocar decisão, autorização, permissão ou verificação de acesso
- um service propor lógica de autorização
- uma API expor endpoints que requerem autorização
- uma migration criar campos relacionados a permissões
- uma IA ou humano propor alteração relacionada a decisão

---

### CHECKLIST OBRIGATÓRIO

#### 1. CONEXÃO COM O authorization.service

Pergunta obrigatória:

> "Como isso se conecta ao authorization.service.canActAs()?"

Exigências:
- Chamada explícita a `authorization.service.canActAs()` identificada
- Fluxo documentado
- `permissionKey` explícito referenciado
- `actorId` explícito referenciado

Sem resposta → **BLOQUEADO**

---

#### 2. VERIFICAÇÃO DE DUPLICAÇÃO

Obrigatório verificar:
- services de autorização existentes
- guards de permissão existentes
- lógica de decisão existente
- documentos canônicos existentes

Se algo similar existir → **BLOQUEADO**

---

#### 3. VERIFICAÇÃO DE CORE PARALELO

É proibido criar:
- business-authorization.service
- reputation-authorization.service
- penalty-authorization.service
- qualquer service que decida autorização fora do authorization.service
- qualquer lógica local de decisão em services
- qualquer heurística de permissão

Se criar qualquer um → **BLOQUEADO**

---

#### 4. VERDADE DE DECISÃO

É proibido:
- decidir baseado em score ou reputação
- decidir baseado em estado mutável
- decidir baseado em heurística
- decidir localmente em services
- assumir permissões implícitas
- bypassar authorization.service

Se ocorrer qualquer item → **BLOQUEADO**

---

#### 5. PERMISSION_KEY EXPLÍCITO

Toda decisão deve ter:
- `permissionKey` explícito
- `permissionKey` existente no `MAPA_CANONICO_PERMISSIONS_v1.md`
- Referência documentada ao mapa canônico

Sem `permissionKey` explícito → **BLOQUEADO**  
Sem `permissionKey` no mapa canônico → **BLOQUEADO**

---

#### 6. ACTOR EXPLÍCITO

Toda decisão deve ter:
- `actorId` explícito
- Actor existente na tabela `actors`
- Validação de autoridade (ownership ou delegação)

Sem `actorId` explícito → **BLOQUEADO**  
Sem validação de autoridade → **BLOQUEADO**

---

#### 7. CLASSIFICAÇÃO OBRIGATÓRIA

Toda estrutura decisória deve ser classificada como:
- DECISÃO (exclusivo do authorization.service)
- VALIDAÇÃO (não altera comportamento)
- EXECUÇÃO (requer decisão prévia)

Sem classificação → **BLOQUEADO**

---

#### 8. DOCUMENTAÇÃO CANÔNICA

Obrigatório citar:
- CORE_IMUTAVEL.md
- DECISION_CORE_CONTRACT.md
- Decision_Safety_and_Containment_Contract.md
- MAPA_CANONICO_PERMISSIONS_v1.md
- IDENTITY_CORE_CONTRACT.md

Sem citação explícita → **BLOQUEADO**

---

## PADRÕES PROIBIDOS

É terminantemente proibido:

### 1. Decisões Baseadas em Score

- decidir permissão baseado em `reputation_level`
- autorizar ação baseado em `trust_score`
- bloquear ação baseado em `risk_score`

Qualquer um desses → **BLOQUEADO AUTOMATICAMENTE**

**Documentos canônicos:**
- `Decision_Safety_and_Containment_Contract.md` (linha 65): "Decidir por score" é proibido

### 2. Decisões Baseadas em Estado Mutável

- decidir permissão baseado em dívidas pendentes
- autorizar ação baseado em status de conta
- bloquear ação baseado em flags mutáveis

Qualquer um desses → **BLOQUEADO AUTOMATICAMENTE**

**Documentos canônicos:**
- `Decision_Safety_and_Containment_Contract.md` (linha 64): "Decidir por estado mutável" é proibido

### 3. Decisões Locais em Services

- verificar ownership localmente em services
- decidir permissão baseado em heurística local
- substituir authorization.service por lógica local

Qualquer um desses → **BLOQUEADO AUTOMATICAMENTE**

**Documentos canônicos:**
- `CORE_IMUTAVEL.md` (linha 23): "NÃO pode ser duplicado"
- `CHECK_DUPLICIDADE_OBRIGATORIO.md`: Duplicação é violação institucional

### 4. Múltiplos Decisores

- criar business-authorization.service paralelo
- criar reputation-authorization.service paralelo
- criar qualquer service que decida autorização fora do authorization.service

Qualquer um desses → **BLOQUEADO AUTOMATICAMENTE**

**Documentos canônicos:**
- `CORE_IMUTAVEL.md` (linha 23): "NÃO pode ser duplicado"
- `CHECK_DUPLICIDADE_OBRIGATORIO.md`: Duplicação é violação institucional

### 5. Bypass do authorization.service

- verificar permissão sem chamar `authorization.service.canActAs()`
- assumir autorização sem verificação explícita
- usar lógica alternativa para autorização

Qualquer um desses → **BLOQUEADO AUTOMATICAMENTE**

**Documentos canônicos:**
- `DECISION_CORE_CONTRACT.md` (linha 3.1): `authorization.service` como único decisor

### 6. Permissões Implícitas

- assumir permissão se `requiresPermission()` retornar false
- autorizar ação sem verificar permissão explícita
- permitir ação baseado em contexto ou padrão

Qualquer um desses → **BLOQUEADO AUTOMATICAMENTE**

**Documentos canônicos:**
- `Decision_Safety_and_Containment_Contract.md` (linhas 16-17): Decisões devem ser explícitas
- `MAPA_CANONICO_PERMISSIONS_v1.md`: Permissões devem estar no mapa canônico

### 7. Heurísticas de Permissão

- decidir permissão por padrão "se X então Y"
- inferir autorização do contexto
- assumir permissão por conveniência

Qualquer um desses → **BLOQUEADO AUTOMATICAMENTE**

**Documentos canônicos:**
- `Decision_Safety_and_Containment_Contract.md` (linha 67): "Decidir por heurística implícita" é proibido

---

## PADRÕES PERMITIDOS

É permitido apenas:

### 1. Chamada Explícita a authorization.service.canActAs()

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
```

**Por que é permitido:**

- Usa serviço centralizado
- Verificação explícita
- Decisão auditável
- Respeita mapa canônico de permissões

**Documentos canônicos:**
- `DECISION_CORE_CONTRACT.md` (linha 10.1): Padrão permitido)

### 2. Decisão Retornando Estrutura Explícita

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

**Documentos canônicos:**
- `DECISION_CORE_CONTRACT.md` (linha 10.2): Padrão permitido)

### 3. Validação (Não Decisão)

**Padrão permitido:**

```typescript
// ✅ PERMITIDO (validação, não decisão)
if (!actorId) {
  throw new BadRequestError('Missing actor');
}

if (!permissionKey) {
  throw new BadRequestError('Missing permission');
}
```

**Por que é permitido:**

- Validação não altera comportamento
- Validação não decide autorização
- Validação apenas verifica dados

**Documentos canônicos:**
- `DECISION_CORE_CONTRACT.md` (linha 1.2): Validação não é decisão

### 4. Execução (Após Decisão)

**Padrão permitido:**

```typescript
// ✅ PERMITIDO (execução após decisão)
const auth = await authorizationService.canActAs(
  tenantId,
  userId,
  actorId,
  'publish_feed'
);

if (!auth.allowed) {
  throw new ForbiddenError();
}

// Executar ação em nome do actor
await createPost(tenantId, actorId, content);
```

**Por que é permitido:**

- Execução requer decisão prévia explícita
- Execução não decide, apenas executa
- Execução gera trilha de auditoria

**Documentos canônicos:**
- `DECISION_CORE_CONTRACT.md` (linha 6.5): Execução após decisão)

---

## GATE DE DECISÃO INSTITUCIONAL

Antes de qualquer execução envolvendo decisão, autorização ou permissão, **TODAS** as perguntas abaixo devem ser respondidas:

1. **Onde a decisão acontece?**
   - Se não for em `authorization.service.canActAs()` → **BLOQUEADO**

2. **Qual é o permissionKey explícito?**
   - Se não houver `permissionKey` explícito → **BLOQUEADO**

3. **A permissão está no MAPA_CANONICO_PERMISSIONS_v1.md?**
   - Se não estiver → **BLOQUEADO**

4. **A decisão é baseada em score, reputação ou estado mutável?**
   - Se for → **BLOQUEADO**

5. **A decisão passa por authorization.service?**
   - Se não passar → **BLOQUEADO**

6. **Existe fonte paralela de decisão?**
   - Se existir → **BLOQUEADO**

7. **A decisão é explícita ou implícita?**
   - Se for implícita → **BLOQUEADO**

8. **Qual é o actorId explícito?**
   - Se não houver `actorId` explícito → **BLOQUEADO**

9. **A decisão está classificada como DECISÃO, VALIDAÇÃO ou EXECUÇÃO?**
   - Se não estiver classificada → **BLOQUEADO**

10. **Qual documento canônico autoriza isso?**
    - Se não houver documento canônico → **BLOQUEADO**

Qualquer resposta ausente → **BLOQUEADO**

---

## CONDIÇÕES DE BLOQUEIO AUTOMÁTICO

A IA Guardiã deve responder **BLOQUEADO**, sem exceção, quando:

### 1. Decisão Fora do authorization.service

- houver decisão local em services
- houver verificação de ownership local
- houver lógica de autorização duplicada

**Ambiente local não é exceção.**

### 2. Decisão Baseada em Score/Reputação

- houver decisão baseada em `reputation_level`
- houver decisão baseada em `trust_score`
- houver decisão baseada em qualquer score

**Ambiente local não é exceção.**

### 3. Decisão Baseada em Estado Mutável

- houver decisão baseada em dívidas pendentes
- houver decisão baseada em status de conta
- houver decisão baseada em flags mutáveis

**Ambiente local não é exceção.**

### 4. Múltiplos Decisores

- houver business-authorization.service paralelo
- houver reputation-authorization.service paralelo
- houver qualquer service que decida autorização fora do authorization.service

**Ambiente local não é exceção.**

### 5. Bypass do authorization.service

- houver verificação de permissão sem chamar `authorization.service.canActAs()`
- houver autorização assumida sem verificação explícita
- houver lógica alternativa para autorização

**Ambiente local não é exceção.**

### 6. Permissões Implícitas

- houver permissão assumida sem verificação explícita
- houver autorização baseada em contexto ou padrão
- houver permissão não definida no `MAPA_CANONICO_PERMISSIONS_v1.md`

**Ambiente local não é exceção.**

### 7. Heurísticas de Permissão

- houver decisão por padrão "se X então Y"
- houver inferência de autorização do contexto
- houver permissão assumida por conveniência

**Ambiente local não é exceção.**

### 8. Ausência de Resposta ao Gate de Decisão

- houver pergunta do Gate de Decisão não respondida
- houver resposta vaga ou ambígua
- houver ausência de documento canônico citado

**Ambiente local não é exceção.**

---

## RELAÇÃO COM OUTROS CORES

### 1. Identidade (Actor Explícito)

**Regra absoluta:**

> **Toda decisão DEVE ocorrer sobre um ACTOR explícito.**

**O que isso significa:**

- Decisões não podem ocorrer sem `actorId`
- Decisões não podem inferir actor do contexto
- Decisões não podem usar fallback de actor

**Documentos canônicos:**
- `IDENTITY_CORE_CONTRACT.md` (linha 5.1): Nenhuma ação existe sem ACTOR explícito
- `DECISION_CORE_CONTRACT.md` (linha 7.1): Decisões sempre ocorrem sobre ACTOR explícito

### 2. Permissões (permission_key)

**Regra absoluta:**

> **Toda decisão DEVE referenciar um `permissionKey` explícito.**

**O que isso significa:**

- Decisões não podem ser genéricas
- Decisões não podem inferir permissão
- Decisões devem ter `permissionKey` explícito
- `permissionKey` deve existir no `MAPA_CANONICO_PERMISSIONS_v1.md`

**Documentos canônicos:**
- `MAPA_CANONICO_PERMISSIONS_v1.md`: Fonte única de verdade para permissões
- `DECISION_CORE_CONTRACT.md` (linha 8.1): Toda decisão referencia permission_key

### 3. Tempo (Agenda Universal)

**Regra absoluta:**

> **Decisão não pode bloquear agenda diretamente.**

**O que isso significa:**

- Decisões não podem criar bookings diretamente
- Decisões não podem bloquear slots diretamente
- Decisões não podem resolver conflitos temporais diretamente
- Decisões apenas autorizam ações que podem interagir com Agenda Universal

**Documentos canônicos:**
- `AGENDA_UNIVERSAL_CONTRACT.md`: Agenda Universal é única fonte de verdade temporal
- `DECISION_CORE_CONTRACT.md`: Decisão é sobre autorização, não sobre tempo

---

## AUTORIDADE DOCUMENTAL

### 1. Relação com CORE_IMUTAVEL.md

Este contrato é **subordinado** a `CORE_IMUTAVEL.md` e **implementa** a seção "SISTEMA DE IDENTIDADE E PERMISSÕES" (linha 44).

**Hierarquia:**

- `CORE_IMUTAVEL.md` define que Decisão é Core Imutável
- `DECISION_CORE_HARDENING_CONTRACT.md` define **COMO** endurecer o Core de Decisão
- Este contrato **NÃO pode** contradizer `CORE_IMUTAVEL.md`

**Documentos canônicos:**
- `CORE_IMUTAVEL.md`: autoridade máxima sobre Core
- `HIERARQUIA_E_AUTORIDADE_DOS_DOCUMENTOS.md`: hierarquia documental

### 2. Relação com DECISION_CORE_CONTRACT.md

Este contrato é **complementar** a `DECISION_CORE_CONTRACT.md` e **operacionaliza** o hardening do Core de Decisão.

**Hierarquia:**

- `DECISION_CORE_CONTRACT.md` define o Core de Decisão
- `DECISION_CORE_HARDENING_CONTRACT.md` define **COMO** endurecer o Core de Decisão
- Este contrato **NÃO pode** contradizer `DECISION_CORE_CONTRACT.md`

**Documentos canônicos:**
- `DECISION_CORE_CONTRACT.md`: contrato canônico do Core de Decisão
- `HIERARQUIA_E_AUTORIDADE_DOS_DOCUMENTOS.md`: hierarquia documental

### 3. Efeito Vinculante

Este contrato é:

- **CANÔNICO:** fonte de verdade institucional
- **BLOQUEANTE:** qualquer violação bloqueia a proposta
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

## ENCERRAMENTO

O Core de Decisão do UnifiCard está **HARDENED**.

Qualquer mudança futura:
- exige alteração explícita deste contrato
- exige decisão institucional
- exige auditoria formal

Sem isso, a resposta é sempre a mesma:

**BLOQUEADO.**

---

## FRASE CANÔNICA FINAL

No UnifiCard:

> **Decisão é Core.  
> Toda decisão passa por autorização explícita.  
> Sem autorização explícita, nada acontece.**

---

**Status:** CANÔNICO • BLOQUEANTE • VINCULANTE  
**Autoridade:** NÍVEL 1 (CORE / LEI DO SISTEMA)  
**Última atualização:** 2024-12-19


