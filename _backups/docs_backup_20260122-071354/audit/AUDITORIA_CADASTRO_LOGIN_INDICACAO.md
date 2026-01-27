# 🔍 AUDITORIA: Cadastro, Login e Indicação — UnifiCard

**Data:** 02/01/2026  
**Status:** REQUER CORREÇÕES CRÍTICAS

---

## 📊 RESUMO EXECUTIVO

| Área | Status | Criticidade |
|------|--------|-------------|
| Cadastro (Signup) | ⚠️ Parcialmente correto | 🟡 MÉDIA |
| Login | ❌ Incorreto | 🔴 ALTA |
| Código de Indicação | ❌ Incorreto | 🔴 ALTA |
| Perfil | ✅ Correto | 🟢 OK |

---

## 1️⃣ CADASTRO (SIGNUP)

### Arquivo: `frontend/src/components/Register.tsx`

#### ✅ PONTOS OK

| Item | Status |
|------|--------|
| Não tem campo Tenant ID | ✅ Correto |
| Tem campo email | ✅ Correto |
| Tem campo senha | ✅ Correto |
| Tem campo confirmar senha | ✅ Correto |
| Valida senhas iguais | ✅ Correto |
| Valida tamanho mínimo (6 chars) | ✅ Correto |

#### ❌ PONTOS A CORRIGIR

| Item | Esperado | Atual | Severidade |
|------|----------|-------|------------|
| Campo CPF | Obrigatório | Ausente | 🟡 MÉDIA |
| Ícone mostrar/ocultar senha | Presente | Ausente | 🟢 BAIXA |
| Campo código de indicação | Opcional | Ausente | 🔴 ALTA |
| Confirmação de email | Desejável | Ausente | 🟡 MÉDIA |

#### 📍 CORREÇÕES NECESSÁRIAS

**1. Adicionar campo CPF (Register.tsx)**
```tsx
// Após linha 16 (confirmPassword state)
const [cpf, setCpf] = useState('');

// No formulário, adicionar antes do email:
<div className="form-group">
  <label htmlFor="cpf">CPF *</label>
  <input
    id="cpf"
    type="text"
    value={cpf}
    onChange={(e) => setCpf(formatCPF(e.target.value))}
    required
    placeholder="000.000.000-00"
    maxLength={14}
  />
</div>
```

**2. Adicionar campo código de indicação (Register.tsx)**
```tsx
// Após linha 17
const [referralCode, setReferralCode] = useState('');

// No formulário, adicionar no final (antes do botão):
<div className="form-group">
  <label htmlFor="referralCode">Código de Indicação (opcional)</label>
  <input
    id="referralCode"
    type="text"
    value={referralCode}
    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
    placeholder="Ex: ABC12345"
    maxLength={8}
  />
</div>
```

**3. Adicionar ícone olhinho na senha (Register.tsx)**
```tsx
// Substituir input de senha por:
<div className="password-input-wrapper">
  <input
    id="password"
    type={showPassword ? 'text' : 'password'}
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    required
    placeholder="Mínimo 6 caracteres"
    minLength={6}
  />
  <button
    type="button"
    className="password-toggle"
    onClick={() => setShowPassword(!showPassword)}
  >
    {showPassword ? '👁️' : '👁️‍🗨️'}
  </button>
</div>
```

---

## 2️⃣ LOGIN

### Arquivo: `frontend/src/components/Login.tsx`

#### 🔴 PROBLEMA CRÍTICO: TENANT ID EXPOSTO

**Linhas 100-123** — Campo de Tenant ID na UI:

```tsx
<div className="form-group">
  <label htmlFor="tenantId">
    Tenant ID
    {getTenantId() && (
      <span style={{ fontSize: '0.85em', color: '#666', marginLeft: '8px' }}>
        (atual: {getTenantId()?.substring(0, 8)}...)
      </span>
    )}
  </label>
  <input
    id="tenantId"
    type="text"
    value={tenantId}
    onChange={(e) => setTenantIdValue(e.target.value)}
    required
    placeholder="UUID do tenant"
    ...
  />
</div>
```

**ISSO VIOLA A ESPECIFICAÇÃO:**
> ❌ **NÃO exista campo de Tenant ID** no login

#### ✅ PONTOS OK

| Item | Status |
|------|--------|
| Tem campo email | ✅ Correto |
| Tem campo senha | ✅ Correto |

#### ❌ PONTOS A CORRIGIR

| Item | Esperado | Atual | Severidade |
|------|----------|-------|------------|
| Campo Tenant ID | Ausente | **PRESENTE** | 🔴 CRÍTICO |
| Login com CPF | Permitido | Não permite | 🟡 MÉDIA |
| Ícone mostrar/ocultar senha | Presente | Ausente | 🟢 BAIXA |

#### 📍 CORREÇÕES NECESSÁRIAS

**1. REMOVER campo Tenant ID (Login.tsx)**

Remover linhas 100-123 completamente.

Remover state `tenantId` (linha 19-22).

Modificar `handleSubmit` para resolver tenant automaticamente:

```tsx
// Remover linha 19-22 (estado tenantId)

// No handleSubmit, usar tenant fixo ou resolver via backend:
const resolvedTenantId = 'fbe13b78-4516-493d-905a-363796aea1d1'; // DEV
const result = await login(email, password, resolvedTenantId);
```

**Solução ideal (backend):** Resolver tenant pelo email do usuário, não exigir do frontend.

**2. Permitir login com CPF (futuro)**

Modificar backend para aceitar CPF ou email como identificador.

---

## 3️⃣ CÓDIGO DE INDICAÇÃO (REFERRAL)

### Arquivos Envolvidos:
- `frontend/src/api/referral.ts`
- `backend/src/core/referral/referral.routes.ts`
- `backend/src/core/referral/referral.service.ts`

#### 🔴 PROBLEMA CRÍTICO: PERMITE APLICAR CÓDIGO APÓS CADASTRO

**Arquivo:** `backend/src/core/referral/referral.routes.ts`  
**Linhas 30-61:**

```typescript
fastify.post('/apply', async (req, reply) => {
  // ... permite aplicar código a qualquer momento
});
```

**ISSO VIOLA A REGRA DE NEGÓCIO:**
> ❌ Após o cadastro concluído (CPF criado): não pode inserir, não pode editar, não pode alterar

#### ❌ PONTOS A CORRIGIR

| Item | Esperado | Atual | Severidade |
|------|----------|-------|------------|
| Código só no cadastro | Sim | Pode aplicar depois | 🔴 CRÍTICO |
| Verificar se já tem referrer | Sim | Não verifica | 🔴 CRÍTICO |
| Código no formulário de cadastro | Sim | Ausente | 🔴 ALTA |

#### 📍 CORREÇÕES NECESSÁRIAS

**1. Adicionar verificação no backend (referral.service.ts)**

```typescript
async applyReferralCode(
  tenantId: string,
  newUserId: string,
  referralCode: string
): Promise<{ referrerUserId: string }> {
  // 🔴 ADICIONAR: Verificar se já tem referrer
  const existingReferrer = await runQueryWithTenant<{ metadata: any }>(
    tenantId,
    `SELECT metadata FROM users WHERE user_id = $1 LIMIT 1`,
    [newUserId]
  );

  if (existingReferrer?.metadata?.referred_by) {
    throw new Error('Código de indicação já foi aplicado. Não é possível alterar.');
  }

  // ... resto do código
}
```

**2. Melhor solução: Aplicar código APENAS no registro**

Modificar `auth.service.ts` método `register()` para aceitar `referralCode` opcional:

```typescript
async register(
  tenantId: string,
  email: string,
  password: string,
  referralCode?: string  // Adicionar parâmetro opcional
): Promise<LoginResult> {
  // ... criar usuário ...

  // Se tem código de indicação, aplicar AQUI
  if (referralCode) {
    try {
      await referralService.applyReferralCode(tenantId, user.userId, referralCode);
    } catch (err) {
      // Log mas não falha o registro
      console.warn('Código de indicação inválido:', err);
    }
  }

  // ... resto ...
}
```

**3. Remover ou proteger endpoint /referral/apply**

Opção A: Remover endpoint (código só via registro)
Opção B: Adicionar flag `is_new_user` e validar janela de tempo (ex: só nas primeiras 24h)

---

## 4️⃣ PERFIL

### Arquivo: `frontend/src/components/Profile.tsx`

#### ✅ PONTOS OK

| Item | Status |
|------|--------|
| Código de indicação aparece | ✅ Linhas 1823-1850 |
| Código é copiável | ✅ Linha 1846-1847 |
| CPF pode ser preenchido | ✅ Linhas 51-53, 832-865 |

#### ⚠️ PONTO DE ATENÇÃO

O CPF está sendo coletado no Perfil, mas a especificação diz que deveria ser no Cadastro.

**Decisão necessária:**
- Mover CPF para cadastro? (recomendado)
- Manter no perfil como complemento? (atual)

---

## 📋 CHECKLIST DE CORREÇÕES

### 🔴 PRIORIDADE CRÍTICA

- [ ] **Remover campo Tenant ID do Login** (Login.tsx linhas 100-123)
- [ ] **Adicionar verificação de referrer existente** (referral.service.ts)
- [ ] **Adicionar campo código de indicação no cadastro** (Register.tsx)

### 🟡 PRIORIDADE MÉDIA

- [ ] Adicionar campo CPF no cadastro (Register.tsx)
- [ ] Resolver tenant automaticamente no login (backend)
- [ ] Implementar confirmação de email (futuro)

### 🟢 PRIORIDADE BAIXA

- [ ] Adicionar ícone olhinho nas senhas (Register.tsx, Login.tsx)
- [ ] Permitir login com CPF ou email

---

## 🎯 ORDEM DE EXECUÇÃO RECOMENDADA

```
1. Remover Tenant ID do Login (CRÍTICO - segurança/UX)
   └── Login.tsx: remover linhas 100-123 e estado relacionado

2. Proteger endpoint de referral (CRÍTICO - regra de negócio)
   └── referral.service.ts: adicionar verificação de referred_by

3. Adicionar código de indicação no cadastro (ALTA)
   └── Register.tsx: adicionar campo opcional
   └── auth.service.ts: aceitar parâmetro referralCode

4. Adicionar CPF no cadastro (MÉDIA)
   └── Register.tsx: adicionar campo obrigatório
   └── auth.routes.ts: atualizar schema de validação

5. Resolver tenant automaticamente (MÉDIA)
   └── Backend: criar endpoint /auth/resolve-tenant-by-email
   └── Ou: usar tenant fixo por domínio
```

---

## 🧾 VEREDITO

| Área | Veredito |
|------|----------|
| Cadastro | ⚠️ **PARCIALMENTE CORRETO** — falta CPF e código de indicação |
| Login | ❌ **INCORRETO** — Tenant ID exposto na UI |
| Código de Indicação | ❌ **INCORRETO** — permite aplicar após cadastro |
| Perfil | ✅ **CORRETO** — código aparece e é copiável |

**STATUS GERAL: REQUER CORREÇÕES ANTES DE PRODUÇÃO**

---

*Auditoria concluída em 02/01/2026*
