# 🤝 ACORDO FINAL: CLAUDE + CHATGPT — BLINDAGEM CPF

> **Objetivo:** Reconciliar as duas análises e entregar a solução correta para o UnifiCard

---

## 📊 CONVERGÊNCIA DAS ANÁLISES

| Ponto | Claude | ChatGPT | Acordo |
|-------|--------|---------|--------|
| ON DELETE CASCADE | 🔴 Crítico | 🔴 Crítico | ✅ Remover imediatamente |
| Erro 500 no registro | 🔴 Crítico | 🔴 Crítico | ✅ Tratar 23505 |
| Validação CPF backend | 🔴 Ausente | 🔴 Ausente | ✅ Adicionar validador |
| Soft Delete em users | 🔴 Ausente | 🔴 Ausente | ✅ Implementar |
| Logs com console.log | 🟡 Problema | 🟡 Problema | ✅ Substituir por devLog |
| Recovery por CPF | 🟡 Ausente | 🟡 Ausente | ⏳ Fase 2 |

---

## ⚠️ ONDE O CHATGPT CORRIGIU A CLAUDE

O ChatGPT identificou corretamente que o requisito do Clayton é:

> "mesmo excluindo a conta, ao tentar criar outra com o mesmo CPF o sistema puxa o histórico"

Isso significa:
- **NÃO** bloquear reuso do CPF (como um trigger "prevent_cpf_reuse" faria)
- **SIM** reconectar ao histórico existente

### Fluxo Correto:
1. Usuário tenta cadastrar com CPF que já existe
2. Sistema detecta: "Este CPF já foi cadastrado"
3. **Em vez de erro**, oferece: "Deseja recuperar sua conta anterior?"
4. Usuário confirma → reconecta ao global_user_id existente
5. Histórico preservado

### Fluxo Errado (que a Claude quase sugeriu):
1. Usuário tenta cadastrar com CPF que já existe
2. Sistema bloqueia: "CPF já em uso, contate suporte"
3. Usuário frustrado → suporte vira gargalo

---

## ✅ SOLUÇÃO FINAL ACORDADA

### FASE 0: Correções Urgentes (1h20) — EXECUTAR AGORA

1. **Remover CASCADE** — Migration 115
2. **Adicionar soft delete em users** — Migration 115
3. **Trigger de imutabilidade do CPF** — Migration 115
4. **Criar cpf.validator.ts** — Backend
5. **Tratar erro 23505 no registro** — auth.service.ts
6. **Substituir console.log por devLog** — auth + profile services

**Documento:** `PROMPT_CURSOR_CPF_BLINDAGEM.md`

---

### FASE 1: Recovery Flow (2h) — APÓS FASE 0

Criar fluxo de reconexão de identidade por CPF.

**Endpoint:** `POST /api/auth/check-cpf`
```typescript
// Verifica se CPF já existe e retorna status
{
  "exists": true,
  "status": "ORPHAN",  // ACTIVE, ORPHAN, RECOVERED
  "can_recover": true,
  "recovery_method": "email_verification"
}
```

**Endpoint:** `POST /api/auth/recover-by-cpf`
```typescript
// Inicia processo de recuperação
{
  "cpf": "03132549908",
  "email": "novo@email.com",
  "verification_code": "123456"
}
```

**Fluxo no frontend:**
1. Usuário preenche CPF no registro
2. Sistema chama `/check-cpf` em background
3. Se CPF existe: mostrar modal de recuperação
4. Usuário verifica identidade (email, SMS, ou dados)
5. Sistema reconecta ao global_user_id existente

---

### FASE 2: CPF Registry Global (4h) — OPCIONAL/FUTURO

Migrar CPF para tabela global ligada a `global_users`.

```sql
CREATE TABLE cpf_registry (
  cpf VARCHAR(11) PRIMARY KEY,
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_user_id UUID,
  last_tenant_id UUID
);
```

**Benefícios:**
- CPF vira entidade permanente
- Múltiplas contas (tenants) vinculadas ao mesmo CPF
- Histórico completo preservado
- Verificação KYC centralizada

---

## 📋 CHECKLIST DE PRIORIDADE

### Hoje (CRÍTICO):
- [ ] Executar Migration 115
- [ ] Criar cpf.validator.ts
- [ ] Corrigir auth.service.ts
- [ ] Corrigir profile.service.ts
- [ ] Testar cenários de erro

### Esta Semana (IMPORTANTE):
- [ ] Implementar /check-cpf
- [ ] Implementar /recover-by-cpf
- [ ] Ajustar frontend para recovery

### Próximo Mês (DESEJÁVEL):
- [ ] Migrar para cpf_registry global
- [ ] Integrar verificação KYC

---

## 🎯 RESULTADO FINAL

Após FASE 0 + FASE 1:

| Cenário | Comportamento |
|---------|---------------|
| Novo CPF válido | ✅ Cadastro normal |
| CPF inválido (algoritmo) | ❌ 400 "CPF inválido" |
| CPF já existe (conta ativa) | ⚠️ Modal: "Já tem conta, fazer login?" |
| CPF já existe (conta excluída) | 🔄 Modal: "Recuperar conta anterior?" |
| Tentar editar CPF | ❌ Bloqueado (imutável) |
| Deletar usuário | ❌ Bloqueado (RESTRICT) |
| Soft delete conta | ✅ deleted_at preenchido, CPF preservado |

---

## 📝 DOCUMENTO FINAL PARA CURSOR

Use o arquivo `PROMPT_CURSOR_CPF_BLINDAGEM.md` que contém:
- Migration SQL completa
- Validador CPF para backend
- Correções em auth.service.ts
- Correções em profile.service.ts
- Substituição de console.log
- Testes de validação

**Tempo total:** 1h20 para FASE 0

---

*Acordo fechado entre análises Claude + ChatGPT*
*Foco: Segurança + Usabilidade (não apenas bloqueio)*
