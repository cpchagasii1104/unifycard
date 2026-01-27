# Log Level & Signal Classification Pass

**Data:** 2024-12-19  
**Status:** ✅ COMPLETO

## Objetivo

Garantir que cada tipo de evento use o **nível de log semanticamente correto**, permitindo classificação automática de sinais e ações apropriadas em sistemas de monitoramento e alertas.

## Classificação Obrigatória Definida

### 1. `info` - Fluxo Normal
- **Quando usar:** Operações que ocorrem normalmente no fluxo de negócio
- **Exemplos:** Tenant criado, evento publicado, refresh token válido
- **Ação esperada:** Nenhuma ação necessária. Apenas rastreabilidade.

### 2. `warn` - Tentativa Inválida / Suspeita
- **Quando usar:** Tentativas que falharam por dados inválidos ou suspeitos
- **Exemplos:** Token invalidado, user não encontrado, payload mudou
- **Ação esperada:** Monitorar padrões. Se frequente, pode indicar problema ou ataque.

### 3. `error` - Falha Sistêmica
- **Quando usar:** Erros que indicam falha no sistema
- **Exemplos:** Erro ao processar, handler error, evento rejeitado
- **Ação esperada:** Investigar imediatamente. Pode indicar bug ou degradação.

### 4. `abuse` - Comportamento Malicioso
- **Quando usar:** Tentativas claramente maliciosas ou abusivas
- **Exemplos:** Rate limit excedido, replay detectado
- **Ação esperada:** Bloquear ou alertar segurança. Pode indicar ataque.

### 5. `invalidation` - Sessão / Token
- **Quando usar:** Invalidações de sessão ou token
- **Exemplos:** Logout, sessão invalidada
- **Ação esperada:** Rastreabilidade. Confirmar que invalidação ocorreu.

### 6. `authzDeny` - Negação Esperada
- **Quando usar:** Negações de autorização que são esperadas
- **Exemplos:** Permissão negada: Actor não encontrado
- **Ação esperada:** Nenhuma ação necessária. É comportamento esperado.

### 7. `authzAllow` - Autorização Concedida
- **Quando usar:** Autorizações concedidas com sucesso
- **Exemplos:** Permissão concedida: Ownership direto
- **Ação esperada:** Nenhuma ação necessária. Apenas rastreabilidade para auditoria.

### 8. `debug` - Apenas Desenvolvimento
- **Quando usar:** Informações de debug que não devem aparecer em produção
- **Exemplos:** Iniciando resolução de permissão
- **Ação esperada:** Apenas em desenvolvimento. Não deve aparecer em produção.

## Auditoria e Correções

### Arquivos Auditados

#### ✅ `backend/src/core/auth/auth.service.ts`

**Logs verificados:**
- ✅ `warn` para "Access token invalidado: tokenVersion não corresponde" - CORRETO
- ✅ `warn` para "Refresh token inválido: tokenVersion ausente" - CORRETO
- ✅ `warn` para "Refresh token inválido: User não encontrado" - CORRETO
- ✅ `warn` para "Refresh token invalidado: tokenVersion não corresponde" - CORRETO
- ✅ `info` para "Tenant criado automaticamente" - CORRETO
- ✅ `info` para "Tenant fornecido" - CORRETO
- ✅ `info` para "Refresh token válido, gerando novos tokens" - CORRETO
- ✅ `error` para "Erro ao processar refresh token" - CORRETO
- ✅ `invalidation` para logout - CORRETO

**Status:** ✅ Todos os logs estão com níveis corretos.

#### ✅ `backend/src/core/authorization/authorization.service.ts`

**Logs verificados:**
- ✅ `debug` para "Iniciando resolução de permissão" - CORRETO
- ✅ `authzDeny` para "Permissão negada: Actor não encontrado" - CORRETO
- ✅ `authzAllow` para "Permissão concedida: Ownership direto" - CORRETO
- ✅ `authzAllow` para "Permissão concedida: Ownership de entidade" - CORRETO
- ✅ `authzAllow` para "Permissão concedida: Delegação" - CORRETO
- ✅ `authzDeny` para "Delegação existe mas não cobre permissão" - CORRETO
- ✅ `authzDeny` para "Permissão negada: Capability sem acesso" - CORRETO
- ✅ `authzDeny` para "Permissão negada: Nenhuma autorização válida" - CORRETO (corrigido de `console.warn`)

**Status:** ✅ Todos os logs estão com níveis corretos.

#### ✅ `backend/src/core/events/event-bus.ts`

**Logs verificados:**
- ✅ `error` para "Evento rejeitado: tenantId ausente ou inválido" - CORRETO
- ✅ `info` para "Publicando evento" - CORRETO
- ✅ `error` para "Handler error" - CORRETO

**Status:** ✅ Todos os logs estão com níveis corretos.

#### ✅ `backend/src/core/rate-limiting/auth-rate-limit.service.ts`

**Logs verificados:**
- ✅ `abuse` para "Limite excedido por IP" - CORRETO
- ✅ `abuse` para "Limite excedido por tenant" - CORRETO
- ✅ `abuse` para "Limite excedido por usuário" - CORRETO
- ✅ `abuse` para "Limite excedido por email" - CORRETO
- ✅ `error` para "Erro ao verificar rate limit (fail-open)" - CORRETO
- ✅ `warn` para "Erro ao registrar tentativa (não bloqueante)" - CORRETO
- ✅ `info` para "Logs antigos limpos" - CORRETO
- ✅ `error` para "Erro ao limpar logs antigos" - CORRETO

**Status:** ✅ Todos os logs estão com níveis corretos.

#### ✅ `backend/src/core/events/idempotency-tracker.ts`

**Logs verificados:**
- ✅ `warn` para "Payload mudou para evento já processado" - CORRETO
- ✅ `abuse` para "REPLAY DETECTADO: Evento já processado" - CORRETO

**Status:** ✅ Todos os logs estão com níveis corretos.

#### ✅ `backend/src/core/reputation/reputation.events.ts`

**Logs verificados:**
- ✅ `error` para "Evento rejeitado: tenantId ausente ou inválido" - CORRETO

**Status:** ✅ Todos os logs estão com níveis corretos.

#### ✅ `backend/src/core/orchestrator/executors/groups-activity.executors.ts`

**Logs verificados:**
- ✅ `error` para "Evento rejeitado: tenantId ausente ou inválido" - CORRETO

**Status:** ✅ Todos os logs estão com níveis corretos.

## Tabela de Classificação: EVENT TYPE → LOG METHOD → EXPECTED ACTION

| Event Type | Log Method | Severity | Expected Action | Example |
|------------|------------|----------|-----------------|---------|
| **Fluxo Normal** |
| Tenant criado | `info` | Low | Rastreabilidade | Tenant criado automaticamente |
| Evento publicado | `info` | Low | Rastreabilidade | Publicando evento |
| Refresh token válido | `info` | Low | Rastreabilidade | Refresh token válido, gerando novos tokens |
| Permissão concedida | `authzAllow` | Low | Auditoria | Permissão concedida: Ownership direto |
| **Tentativa Inválida** |
| Token invalidado | `warn` | Medium | Monitorar padrões | Access token invalidado: tokenVersion não corresponde |
| User não encontrado | `warn` | Medium | Monitorar padrões | Refresh token inválido: User não encontrado |
| Payload mudou | `warn` | Medium | Monitorar padrões | Payload mudou para evento já processado |
| **Falha Sistêmica** |
| Erro ao processar | `error` | High | Investigar imediatamente | Erro ao processar refresh token |
| Handler error | `error` | High | Investigar imediatamente | Handler error for event |
| Evento rejeitado | `error` | High | Investigar imediatamente | Evento rejeitado: tenantId ausente |
| **Comportamento Malicioso** |
| Rate limit excedido | `abuse` | Critical | Bloquear/Alertar | Limite excedido por IP |
| Replay detectado | `abuse` | Critical | Bloquear/Alertar | REPLAY DETECTADO: Evento já processado |
| **Invalidação** |
| Logout iniciado | `invalidation` | Low | Rastreabilidade | Iniciando invalidação de sessão |
| Sessão invalidada | `invalidation` | Low | Rastreabilidade | Sessão invalidada com sucesso |
| **Negação Esperada** |
| Permissão negada | `authzDeny` | Low | Nenhuma ação | Permissão negada: Actor não encontrado |
| **Debug** |
| Início de resolução | `debug` | None | Apenas dev | Iniciando resolução de permissão |

## Regras de Classificação

### ❌ Erros Comuns a Evitar

1. **NÃO logar erro como `info`:**
   ```typescript
   // ❌ ERRADO
   canonicalLogger.info(null, 'Erro ao processar token', { error });
   
   // ✅ CORRETO
   canonicalLogger.error(null, 'Erro ao processar token', { error });
   ```

2. **NÃO logar violação como `debug`:**
   ```typescript
   // ❌ ERRADO
   canonicalLogger.debug(null, 'Rate limit excedido', { ip });
   
   // ✅ CORRETO
   canonicalLogger.abuse(req, 'Rate limit excedido', { ip });
   ```

3. **NÃO logar negação esperada como `error`:**
   ```typescript
   // ❌ ERRADO
   canonicalLogger.error(null, 'Permissão negada', { permission });
   
   // ✅ CORRETO
   canonicalLogger.authzDeny(null, 'Permissão negada', { permission });
   ```

4. **NÃO logar abuso como `warn`:**
   ```typescript
   // ❌ ERRADO
   canonicalLogger.warn(req, 'Rate limit excedido', { ip });
   
   // ✅ CORRETO
   canonicalLogger.abuse(req, 'Rate limit excedido', { ip });
   ```

## Critérios de Sucesso

### ✅ Nenhum Erro Logado como Info

- ✅ Todos os erros usam `error` ou `abuse`
- ✅ Nenhum erro usa `info`

### ✅ Nenhuma Violação Logada como Debug

- ✅ Todas as violações usam `abuse` ou `warn`
- ✅ Nenhuma violação usa `debug`

### ✅ Classificação Semântica Correta

- ✅ Fluxo normal → `info` ou `authzAllow`
- ✅ Tentativa inválida → `warn`
- ✅ Falha sistêmica → `error`
- ✅ Comportamento malicioso → `abuse`
- ✅ Invalidação → `invalidation`
- ✅ Negação esperada → `authzDeny`
- ✅ Debug → `debug` (apenas dev)

## Documentação Criada

1. **`docs/audit/LOG-LEVEL-CLASSIFICATION.md`**
   - Classificação completa de níveis
   - Tabela de referência
   - Regras de classificação
   - Integração com sistemas de monitoramento

2. **`docs/audit/INCIDENT-FORENSICS-GUIDE.md` (atualizado)**
   - Tabela de classificação adicionada
   - Referência à classificação completa

## Próximos Passos

1. **Integrar com sistemas de monitoramento:**
   - Configurar alertas baseados em severity
   - Criar dashboards por tipo de evento

2. **Validação automática:**
   - Criar script para validar níveis de log
   - Integrar no CI como gate obrigatório

## Referências

- **Classificação Completa:** `docs/audit/LOG-LEVEL-CLASSIFICATION.md`
- **Forensics Guide:** `docs/audit/INCIDENT-FORENSICS-GUIDE.md`
- **Logger Canônico:** `backend/src/core/logging/canonical-logger.ts`

