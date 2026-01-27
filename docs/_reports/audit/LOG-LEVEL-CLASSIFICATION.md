# Log Level & Signal Classification

**Data:** 2024-12-19  
**Status:** ✅ COMPLETO

## Objetivo

Garantir que cada tipo de evento use o **nível de log semanticamente correto**, permitindo classificação automática de sinais e ações apropriadas em sistemas de monitoramento e alertas.

## Classificação Obrigatória

### 1. `info` - Fluxo Normal

**Quando usar:** Operações que ocorrem normalmente no fluxo de negócio.

**Exemplos:**
- Tenant criado automaticamente
- Tenant fornecido
- Refresh token válido, gerando novos tokens
- Evento publicado
- Logs antigos limpos
- Permissão concedida (via `authzAllow`)

**Ação esperada:** Nenhuma ação necessária. Apenas rastreabilidade.

---

### 2. `warn` - Tentativa Inválida / Suspeita

**Quando usar:** Tentativas que falharam por dados inválidos ou suspeitos, mas não são necessariamente maliciosas.

**Exemplos:**
- Access token invalidado: tokenVersion não corresponde
- Refresh token inválido: tokenVersion ausente
- Refresh token inválido: User não encontrado
- Payload mudou para evento já processado
- Erro ao registrar tentativa (não bloqueante)

**Ação esperada:** Monitorar padrões. Se frequente, pode indicar problema ou ataque.

---

### 3. `error` - Falha Sistêmica

**Quando usar:** Erros que indicam falha no sistema, não apenas dados inválidos.

**Exemplos:**
- Erro ao processar refresh token
- Handler error for event
- Evento rejeitado: tenantId ausente ou inválido
- Erro ao verificar rate limit (fail-open)
- Erro ao limpar logs antigos

**Ação esperada:** Investigar imediatamente. Pode indicar bug ou degradação do sistema.

---

### 4. `abuse` - Comportamento Malicioso

**Quando usar:** Tentativas claramente maliciosas ou abusivas.

**Exemplos:**
- Rate limit excedido por IP
- Rate limit excedido por tenant
- Rate limit excedido por usuário
- Rate limit excedido por email
- REPLAY DETECTADO: Evento já processado

**Ação esperada:** Bloquear ou alertar segurança. Pode indicar ataque em andamento.

---

### 5. `invalidation` - Sessão / Token

**Quando usar:** Invalidações de sessão ou token.

**Exemplos:**
- Iniciando invalidação de sessão (logout)
- Sessão invalidada com sucesso (logout)

**Ação esperada:** Rastreabilidade. Confirmar que invalidação ocorreu corretamente.

---

### 6. `authzDeny` - Negação Esperada

**Quando usar:** Negações de autorização que são esperadas (não são erros).

**Exemplos:**
- Permissão negada: Actor não encontrado
- Delegação existe mas não cobre permissão
- Permissão negada: Capability sem acesso
- Permissão negada: Nenhuma autorização válida

**Ação esperada:** Nenhuma ação necessária. É comportamento esperado quando usuário não tem permissão.

---

### 7. `authzAllow` - Autorização Concedida

**Quando usar:** Autorizações concedidas com sucesso.

**Exemplos:**
- Permissão concedida: Ownership direto
- Permissão concedida: Ownership de entidade
- Permissão concedida: Delegação

**Ação esperada:** Nenhuma ação necessária. Apenas rastreabilidade para auditoria.

---

### 8. `debug` - Apenas Desenvolvimento

**Quando usar:** Informações de debug que não devem aparecer em produção.

**Exemplos:**
- Iniciando resolução de permissão

**Ação esperada:** Apenas em desenvolvimento. Não deve aparecer em produção.

---

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

---

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

---

## Integração com Sistemas de Monitoramento

### Alertas Baseados em Severity

| Log Method | Severity | Alerta | Threshold |
|------------|----------|--------|-----------|
| `info` | Low | Nenhum | - |
| `warn` | Medium | Se frequente | > 10/min |
| `error` | High | Sempre | > 0 |
| `abuse` | Critical | Sempre | > 0 |
| `invalidation` | Low | Nenhum | - |
| `authzDeny` | Low | Nenhum | - |
| `authzAllow` | Low | Nenhum | - |
| `debug` | None | Nenhum | - |

### Dashboards Recomendados

1. **Security Dashboard:**
   - `abuse` events (rate limit, replay)
   - `authzDeny` patterns (tentativas de acesso não autorizado)

2. **System Health Dashboard:**
   - `error` events (falhas sistêmicas)
   - `warn` patterns (tentativas inválidas frequentes)

3. **Audit Dashboard:**
   - `authzAllow` events (autorizações concedidas)
   - `invalidation` events (sessões invalidadas)

---

## Referências

- **Logger Canônico:** `backend/src/core/logging/canonical-logger.ts`
- **Forensics Guide:** `docs/audit/INCIDENT-FORENSICS-GUIDE.md`
- **Enforcement Pass:** `docs/audit/CANONICAL-LOGGER-ENFORCEMENT-PASS.md`

