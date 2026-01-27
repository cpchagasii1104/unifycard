# 🚀 PLANO DE PRs - UNIFICARD
## Consolidação das Auditorias Claude + ChatGPT
### Dezembro 2024

---

## 📋 VISÃO GERAL

| PR | Nome | Prioridade | Tempo Est. | Bloco |
|----|------|------------|------------|-------|
| PR-001 | Segurança Operacional | 🔴 CRÍTICO | 2-4h | A - UTI |
| PR-002 | TypeScript Fixes | 🔴 CRÍTICO | 4-6h | B - Compilar |
| PR-003 | Auth Hardening | 🟠 ALTO | 3-4h | B - Compilar |
| PR-004 | Logger + Lint Rules | 🟠 ALTO | 4-6h | B - Compilar |
| PR-005 | Split Rotas/Componentes | 🟡 MÉDIO | 8-12h | C - Escalar |
| PR-006 | Testes Base | 🟡 MÉDIO | 6-8h | C - Escalar |

**Tempo Total Estimado**: 27-40 horas

---

## 🚨 PR-001: Segurança Operacional
### "Tira o projeto da UTI"

**Branch**: `fix/security-operational-001`
**Revisor**: Necessário revisor sênior
**Tempo**: 2-4 horas

### Arquivos a Modificar/Criar

```
├── .gitignore                    # CRIAR
├── backend/.gitignore            # CRIAR
├── frontend/.gitignore           # CRIAR
├── backend/.env                  # DELETAR DO REPO
├── backend/.env.example          # CRIAR
├── backend/src/server.ts         # MODIFICAR (CORS)
├── backend/src/core/companies/companies.routes.ts  # MODIFICAR (path traversal + async)
```

### Checklist de Implementação

- [ ] **1.1 Remover `.env` do repositório**
  ```bash
  git rm --cached backend/.env
  # Se já commitado antes, considerar histórico comprometido
  ```

- [ ] **1.2 Criar `.gitignore` na raiz**
  ```gitignore
  # Secrets
  .env
  .env.*
  **/.env
  !.env.example
  
  # Build
  **/dist/
  **/build/
  
  # Uploads e Logs
  **/uploads/
  *.log
  
  # Dependencies
  node_modules/
  ```

- [ ] **1.3 Criar `backend/.env.example`**
  ```env
  DATABASE_URL=postgresql://user:pass@localhost:5432/unificard
  JWT_SECRET=generate-with-openssl-rand-base64-32
  JWT_EXPIRES_IN=15m
  JWT_REFRESH_EXPIRES_IN=7d
  PORT=3000
  CORS_ORIGIN=http://localhost:5173
  ```

- [ ] **1.4 Remover `dist/` e `uploads/` do versionamento**
  ```bash
  git rm -r --cached backend/dist/
  git rm -r --cached frontend/dist/
  git rm -r --cached backend/uploads/
  # Manter .gitkeep se necessário
  mkdir -p backend/uploads && touch backend/uploads/.gitkeep
  ```

- [ ] **1.5 Corrigir CORS em `server.ts`**
  ```typescript
  // ANTES
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  });
  
  // DEPOIS
  const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [];
  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
  });
  ```

- [ ] **1.6 Corrigir Path Traversal em `companies.routes.ts`**
  ```typescript
  // ADICIONAR no início do handler
  import { z } from 'zod';
  
  // Dentro do handler POST /:companyId/documents
  const uuidSchema = z.string().uuid();
  const parseResult = uuidSchema.safeParse(companyId);
  if (!parseResult.success) {
    return reply.status(400).send({ ok: false, message: 'ID de empresa inválido' });
  }
  const validCompanyId = parseResult.data;
  const companyDir = path.join(uploadsDir, validCompanyId);
  ```

- [ ] **1.7 Trocar `writeFileSync` por async**
  ```typescript
  // ANTES
  import fs from 'fs';
  fs.writeFileSync(finalFilepath, buffer);
  
  // DEPOIS
  import { writeFile, mkdir } from 'fs/promises';
  import { existsSync } from 'fs';
  
  if (!existsSync(companyDir)) {
    await mkdir(companyDir, { recursive: true });
  }
  await writeFile(finalFilepath, buffer);
  ```

### Checklist de Validação

- [ ] `git status` não mostra `.env`, `dist/`, `uploads/`
- [ ] `.gitignore` bloqueia arquivos sensíveis
- [ ] CORS rejeita origins não listadas
- [ ] Upload com `companyId` inválido retorna 400
- [ ] Upload não bloqueia event loop (testar com arquivo grande)
- [ ] Logs não contêm credenciais

### Teste de Validação
```bash
# Testar CORS
curl -H "Origin: https://malicious.com" http://localhost:3000/api/health
# Deve rejeitar

# Testar path traversal
curl -X POST "http://localhost:3000/api/companies/../../../etc/documents" \
  -H "Authorization: Bearer $TOKEN"
# Deve retornar 400, não 500

# Testar async write
time curl -X POST "http://localhost:3000/api/companies/$COMPANY_ID/documents" \
  -F "file=@large-file.pdf" \
  -H "Authorization: Bearer $TOKEN"
# Não deve bloquear outras requests
```

---

## 🔧 PR-002: TypeScript Fixes
### "Faz o projeto compilar sem mentir"

**Branch**: `fix/typescript-errors-002`
**Revisor**: Qualquer dev
**Tempo**: 4-6 horas

### Arquivos a Modificar

```
frontend/src/
├── api/social.ts                           # Adicionar exports
├── components/
│   ├── ServicePostCard.tsx                 # Corrigir imports
│   ├── SocialFeed.tsx                      # Corrigir imports
│   ├── ContextualSuggestion.tsx            # Declarar setDismissedIds
│   ├── CulturalProfilesManager.tsx         # Corrigir comparação de tipos
│   ├── layout/
│   │   ├── HeaderGlobal.tsx                # Declarar setIsLoading
│   │   ├── AdminLayout.tsx                 # Tipar isActive
│   │   ├── AppLayout.tsx                   # Tipar isActive
│   │   ├── BankLayout.tsx                  # Tipar isActive
│   │   └── SocialLayout.tsx                # Tipar isActive
│   └── social/
│       ├── IntentComposer.tsx              # Adicionar occupancyModel ao tipo
│       ├── CompanyPage.tsx                 # Corrigir bio undefined
│       └── ProfilePage.tsx                 # Corrigir bio undefined
```

### Checklist de Implementação

- [ ] **2.1 Adicionar exports em `api/social.ts`**
  ```typescript
  // Exportar do social-2.0.ts se existir lá
  export { getFeed, createPost } from './social-2.0';
  
  // Ou criar as funções
  export interface Post {
    id: string;
    content: string;
    actor_id: string;
    created_at: string;
    // ... outros campos
  }
  
  export interface CreatePostInput {
    content: string;
    actor_id?: string;
    media_ids?: string[];
  }
  
  export async function getFeed(params?: { cursor?: string; limit?: number }) {
    // implementar ou re-exportar
  }
  
  export async function createPost(input: CreatePostInput) {
    // implementar ou re-exportar
  }
  
  export async function scheduleServiceFromPost(postId: string): Promise<void> {
    // implementar
  }
  
  export async function payServiceFromPost(postId: string): Promise<void> {
    // implementar
  }
  ```

- [ ] **2.2 Declarar estados faltantes em `HeaderGlobal.tsx`**
  ```typescript
  // Adicionar no início do componente
  const [isLoading, setIsLoading] = useState(false);
  ```

- [ ] **2.3 Declarar estados faltantes em `ContextualSuggestion.tsx`**
  ```typescript
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  ```

- [ ] **2.4 Tipar `isActive` nos Layouts**
  ```typescript
  // Criar interface
  interface NavLinkRenderProps {
    isActive: boolean;
    isPending: boolean;
  }
  
  // Usar nos NavLinks
  <NavLink to="/dashboard">
    {({ isActive }: NavLinkRenderProps) => (
      <span className={isActive ? 'active' : ''}>Dashboard</span>
    )}
  </NavLink>
  ```

- [ ] **2.5 Corrigir tipo em `CulturalProfilesManager.tsx`**
  ```typescript
  // ANTES (erro)
  if (actorType === 'PERSON') { }
  
  // DEPOIS (correto)
  if (actorType === 'user') { }
  // Ou adicionar 'PERSON' ao tipo se necessário
  ```

- [ ] **2.6 Adicionar `occupancyModel` ao tipo `ClassifiedIntent`**
  ```typescript
  // Em types ou no próprio arquivo
  interface ClassifiedIntent {
    // campos existentes...
    occupancyModel?: 'FREE' | 'PAID' | 'CONSUMPTION';
  }
  ```

- [ ] **2.7 Corrigir `bio` undefined em `CompanyPage.tsx` e `ProfilePage.tsx`**
  ```typescript
  // ANTES
  setActorData({
    ...data,
    bio: data.bio,
  });
  
  // DEPOIS
  setActorData({
    ...data,
    bio: data.bio ?? null,
  });
  ```

### Checklist de Validação

- [ ] `cd frontend && npx tsc --noEmit` retorna 0 erros
- [ ] `npm run build` completa sem erros
- [ ] Nenhum erro no console do navegador
- [ ] Todas as páginas carregam corretamente

### Teste de Validação
```bash
cd frontend
npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
# Deve retornar 0
```

---

## 🔐 PR-003: Auth Hardening
### "JWT e Auth profissionais"

**Branch**: `fix/auth-hardening-003`
**Revisor**: Necessário revisor sênior
**Tempo**: 3-4 horas

### Arquivos a Modificar

```
backend/src/core/auth/
├── auth.service.ts       # JWT com iss/aud
├── auth.controller.ts    # DELETAR ou unificar
├── auth.routes.ts        # Unificar lógica
├── auth.types.ts         # Atualizar tipos
```

### Checklist de Implementação

- [ ] **3.1 Adicionar `iss/aud` ao JWT**
  ```typescript
  // auth.service.ts
  const JWT_ISSUER = 'unificard';
  const JWT_AUDIENCE = 'unificard-api';
  
  private generateTokens(user: AuthUser): AuthTokens {
    const accessToken = jwt.sign(
      { ...basePayload, type: 'access' },
      jwtSecret,
      { 
        expiresIn: JWT_EXPIRES_IN,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      }
    );
    // ... mesmo para refreshToken
  }
  
  async verifyAccessToken(token: string): Promise<JwtPayload> {
    const decoded = jwt.verify(token, jwtSecret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as JwtPayload;
    // ...
  }
  ```

- [ ] **3.2 Adicionar `jti` para revogação futura**
  ```typescript
  import { randomUUID } from 'crypto';
  
  const accessToken = jwt.sign(
    { 
      ...basePayload, 
      type: 'access',
      jti: randomUUID(), // ID único do token
    },
    jwtSecret,
    { /* options */ }
  );
  ```

- [ ] **3.3 Unificar auth (remover duplicidade)**
  ```bash
  # Opção 1: Manter routes, deletar controller
  git rm backend/src/core/auth/auth.controller.ts
  
  # Garantir que auth.routes.ts tem toda a lógica
  # com validação Zod e tipos corretos
  ```

- [ ] **3.4 Remover `as any` do auth**
  ```typescript
  // ANTES
  const { email, password } = req.body as any;
  
  // DEPOIS
  const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
  });
  const { email, password } = loginSchema.parse(req.body);
  ```

- [ ] **3.5 Criar tabela para revogação (opcional mas recomendado)**
  ```sql
  -- Nova migration: 089_token_revocation.sql
  CREATE TABLE IF NOT EXISTS revoked_tokens (
    jti UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    revoked_at TIMESTAMPTZ DEFAULT NOW(),
    reason VARCHAR(100)
  );
  
  CREATE INDEX idx_revoked_tokens_user ON revoked_tokens(user_id);
  ```

### Checklist de Validação

- [ ] Token antigo (sem iss/aud) é rejeitado
- [ ] Token com iss/aud incorreto é rejeitado
- [ ] Não existe mais `auth.controller.ts` (ou está deprecated)
- [ ] Zero `as any` em arquivos de auth
- [ ] Testes de integração de auth passam

### Teste de Validação
```bash
# Testar token sem issuer
curl -H "Authorization: Bearer $OLD_TOKEN" http://localhost:3000/api/profile
# Deve retornar 401

# Testar login e verificar claims
TOKEN=$(curl -X POST http://localhost:3000/auth/login \
  -d '{"email":"test@test.com","password":"123456"}' \
  -H "Content-Type: application/json" | jq -r '.data.tokens.accessToken')

# Decodificar e verificar
echo $TOKEN | cut -d'.' -f2 | base64 -d | jq
# Deve ter iss, aud, jti
```

---

## 📝 PR-004: Logger + Lint Rules
### "Observabilidade e qualidade contínua"

**Branch**: `feat/logger-lint-004`
**Revisor**: Qualquer dev
**Tempo**: 4-6 horas

### Arquivos a Criar/Modificar

```
├── .eslintrc.js                    # MODIFICAR
├── scripts/verify-project.sh       # CRIAR
├── .github/workflows/ci.yml        # CRIAR ou MODIFICAR
├── backend/src/core/logging/
│   └── logger.ts                   # JÁ EXISTE, revisar
```

### Checklist de Implementação

- [ ] **4.1 Adicionar regras ESLint contra `console.log`**
  ```javascript
  // .eslintrc.js
  module.exports = {
    rules: {
      'no-console': ['error', { 
        allow: ['warn', 'error'] 
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
    overrides: [
      {
        files: ['**/scripts/**', '**/tests/**'],
        rules: {
          'no-console': 'off',
        },
      },
    ],
  };
  ```

- [ ] **4.2 Criar script de verificação**
  ```bash
  #!/bin/bash
  # scripts/verify-project.sh
  
  set -e
  
  echo "=== VERIFICAÇÃO UNIFICARD ==="
  
  # TypeScript
  echo -n "Erros TS Backend: "
  cd backend && npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0"
  cd ..
  
  echo -n "Erros TS Frontend: "
  cd frontend && npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0"
  cd ..
  
  # Console.log (exceto scripts e tests)
  echo -n "Console.log proibidos Backend: "
  grep -rn "console.log" backend/src --include="*.ts" \
    --exclude-dir=scripts --exclude-dir=tests | wc -l
  
  # Any
  echo -n "Usos de any: "
  grep -rn ": any" backend/src --include="*.ts" | wc -l
  
  # .env no repo
  if [ -f "backend/.env" ]; then
    echo "⚠️ ALERTA: backend/.env existe no repo!"
    exit 1
  fi
  
  echo "=== FIM ==="
  ```

- [ ] **4.3 Criar/atualizar CI workflow**
  ```yaml
  # .github/workflows/ci.yml
  name: CI
  on: [push, pull_request]
  
  jobs:
    verify:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: '20'
        
        - name: Install Backend
          run: cd backend && npm ci
        
        - name: Install Frontend
          run: cd frontend && npm ci
        
        - name: TypeScript Backend
          run: cd backend && npx tsc --noEmit
        
        - name: TypeScript Frontend
          run: cd frontend && npx tsc --noEmit
        
        - name: Lint
          run: cd backend && npm run lint
        
        - name: Check for secrets
          run: |
            if [ -f "backend/.env" ]; then
              echo "::error::.env file found in repository!"
              exit 1
            fi
        
        - name: Check console.log count
          run: |
            COUNT=$(grep -rn "console.log" backend/src --include="*.ts" \
              --exclude-dir=scripts | wc -l)
            echo "Console.log count: $COUNT"
            if [ $COUNT -gt 500 ]; then
              echo "::warning::Too many console.log statements"
            fi
  ```

- [ ] **4.4 Migrar 20% dos console.log (primeira leva)**
  ```typescript
  // ANTES
  console.log('Processing order:', orderId);
  console.error('Error:', error);
  
  // DEPOIS
  fastify.log.info({ orderId }, 'Processing order');
  fastify.log.error({ error }, 'Order processing failed');
  ```
  
  **Prioridade de migração:**
  1. `auth.service.ts`
  2. `auth.plugin.ts`
  3. `checkout.service.ts`
  4. `split.service.ts`

### Checklist de Validação

- [ ] ESLint roda sem erros fatais
- [ ] CI passa em todas as etapas
- [ ] `console.log` em services críticos foi migrado
- [ ] Script de verificação funciona localmente

---

## 🔀 PR-005: Split Rotas/Componentes
### "Preparar para avalanche de módulos"

**Branch**: `refactor/split-large-files-005`
**Revisor**: Qualquer dev
**Tempo**: 8-12 horas

### Estrutura Alvo

```
# Backend - Dividir rotas grandes
backend/src/modules/social/
├── social.module.ts
├── routes/
│   ├── feed.routes.ts        # ~200 linhas
│   ├── posts.routes.ts       # ~200 linhas
│   ├── actors.routes.ts      # ~200 linhas
│   ├── reactions.routes.ts   # ~150 linhas
│   └── ledger.routes.ts      # ~200 linhas

backend/src/core/categories/
├── categories.module.ts
├── routes/
│   ├── categories.routes.ts  # ~250 linhas
│   ├── search.routes.ts      # ~200 linhas
│   └── admin.routes.ts       # ~200 linhas

# Frontend - Dividir componentes grandes
frontend/src/components/profile/
├── index.tsx                 # Export principal
├── ProfileContainer.tsx      # Estado e lógica
├── ProfileHeader.tsx         # Avatar, nome, etc
├── ProfileTabs.tsx           # Navegação entre seções
├── sections/
│   ├── EducationSection.tsx
│   ├── WorkSection.tsx
│   ├── SkillsSection.tsx
│   └── SettingsSection.tsx
├── hooks/
│   └── useProfile.ts
└── Profile.css
```

### Checklist de Implementação

- [ ] **5.1 Dividir `social-2.0.routes.ts` (1.070 linhas)**
  - Extrair rotas de feed → `feed.routes.ts`
  - Extrair rotas de posts → `posts.routes.ts`
  - Extrair rotas de actors → `actors.routes.ts`
  - Manter arquivo principal como aggregator

- [ ] **5.2 Dividir `categories.routes.ts` (865 linhas)**
  - Rotas CRUD básico → `categories.routes.ts`
  - Rotas de busca/autocomplete → `search.routes.ts`
  - Rotas de admin/moderação → `admin.routes.ts`

- [ ] **5.3 Dividir `Profile.tsx` (1.831 linhas)**
  - Extrair `ProfileHeader.tsx`
  - Extrair `ProfileTabs.tsx`
  - Extrair seções individuais
  - Criar hook `useProfile.ts`

- [ ] **5.4 Dividir `CompaniesManager.tsx` (1.234 linhas)**
  - Extrair `CompanyList.tsx`
  - Extrair `CompanyForm.tsx`
  - Extrair `CompanyDetails.tsx`

### Regra de Ouro
```
Nenhum arquivo de rota > 300 linhas
Nenhum componente > 400 linhas
```

### Checklist de Validação

- [ ] Todos os arquivos resultantes < limite
- [ ] Imports funcionando corretamente
- [ ] Nenhuma funcionalidade quebrada
- [ ] Testes existentes continuam passando

---

## 🧪 PR-006: Testes Base
### "Cobertura mínima para não sofrer"

**Branch**: `feat/tests-base-006`
**Revisor**: Necessário revisor sênior
**Tempo**: 6-8 horas

### Estrutura de Testes

```
backend/tests/
├── unit/
│   ├── auth/
│   │   └── auth.service.test.ts
│   ├── economy/
│   │   ├── split.service.test.ts
│   │   └── checkout.service.test.ts
│   └── categories/
│       └── categories.service.test.ts
├── integration/
│   ├── auth.test.ts           # JÁ EXISTE? Verificar
│   ├── tenant-isolation.test.ts  # CRIAR
│   └── ... (9 existentes)
└── e2e/
    └── critical-flows.test.ts    # CRIAR
```

### Checklist de Implementação

- [ ] **6.1 Teste unitário `auth.service.test.ts`**
  ```typescript
  describe('AuthService', () => {
    describe('generateTokens', () => {
      it('should include iss and aud claims', () => {});
      it('should set correct expiration', () => {});
    });
    
    describe('verifyAccessToken', () => {
      it('should reject expired tokens', () => {});
      it('should reject tokens with wrong issuer', () => {});
      it('should reject refresh tokens', () => {});
    });
    
    describe('login', () => {
      it('should reject invalid credentials', () => {});
      it('should return tokens on success', () => {});
    });
  });
  ```

- [ ] **6.2 Teste de isolamento de tenant**
  ```typescript
  // tests/integration/tenant-isolation.test.ts
  describe('Tenant Isolation', () => {
    it('should not allow access to other tenant data', async () => {
      // Criar dados no tenant A
      // Tentar acessar com token do tenant B
      // Deve retornar 403 ou array vazio
    });
    
    it('should reject mismatched tenant header and token', async () => {
      // Token do tenant A + header tenant B
      // Deve retornar 403 TENANT_MISMATCH
    });
  });
  ```

- [ ] **6.3 Teste de fluxo crítico E2E**
  ```typescript
  // tests/e2e/critical-flows.test.ts
  describe('Critical User Flows', () => {
    it('should complete registration → login → profile update', async () => {});
    it('should complete checkout flow', async () => {});
    it('should handle payment split correctly', async () => {});
  });
  ```

- [ ] **6.4 Adicionar script de cobertura**
  ```json
  // package.json
  {
    "scripts": {
      "test": "jest",
      "test:coverage": "jest --coverage",
      "test:unit": "jest tests/unit",
      "test:integration": "jest tests/integration"
    }
  }
  ```

### Meta de Cobertura

| Área | Meta Mínima |
|------|-------------|
| Auth | 80% |
| Economy/Checkout | 70% |
| Categories | 60% |
| Geral | 40% |

### Checklist de Validação

- [ ] `npm test` passa todos os testes
- [ ] Cobertura de auth > 80%
- [ ] Teste de tenant isolation passa
- [ ] CI inclui execução de testes

---

## 📅 CRONOGRAMA SUGERIDO

| Semana | PRs | Foco |
|--------|-----|------|
| 1 (dias 1-2) | PR-001 | Segurança crítica |
| 1 (dias 3-5) | PR-002 | TypeScript fixes |
| 2 (dias 1-2) | PR-003 | Auth hardening |
| 2 (dias 3-5) | PR-004 | Logger + CI |
| 3 | PR-005 | Refatoração |
| 4 | PR-006 | Testes |

---

## ✅ DEFINIÇÃO DE "DONE" POR PR

Cada PR só pode ser mergeado quando:

1. [ ] Todos os itens do checklist implementados
2. [ ] Todos os itens de validação passando
3. [ ] Code review aprovado
4. [ ] CI passando (quando existir)
5. [ ] Zero regressões nos testes existentes
6. [ ] Documentação atualizada (se aplicável)

---

*Plano consolidado das auditorias Claude + ChatGPT*
*Gerado em 24/12/2024*
