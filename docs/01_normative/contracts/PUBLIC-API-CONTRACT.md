# Public API Contract — Contrato de API Pública

**Status:** `CORE`  
**Governing Contract:** `CORE_IMUTAVEL.md`  
**Version:** `v1.1.0`
**Data de Criação:** 2025-01-22
**Última Atualização:** 2026-06-13

---

## Declaração de Contrato

Este documento define o **contrato público** da API Unificard. 

**REGRA INQUEBRÁVEL:** Qualquer mudança que quebre este contrato **DEVE** ser marcada como **BREAKING CHANGE** e incrementar a versão da API.

**REGRA DE EVOLUÇÃO:** Novos endpoints públicos podem ser adicionados, mas endpoints existentes **NÃO podem ser alterados** sem breaking change explícito.

---

## Base URL

```
Production: https://api.unificard.com
Development: http://localhost:3000
```

---

## Rotas Públicas

### 1. Autenticação (`/auth/*`)

Todas as rotas de autenticação são **públicas** e **não requerem** autenticação prévia.

#### 1.1 POST `/auth/register`

**Descrição:** Registra um novo usuário no sistema (nascimento humano orgânico atômico).

**Headers:**
- `Content-Type: application/json` (obrigatório)
- `x-tenant-id: <uuid>` (IGNORADO como autoridade) — o cadastro orgânico resolve o
  tenant institucional `unificard-inicial` **server-side** (DECISION-0115 D1 + decisão
  TENANT FECHADA). **Não cria** tenant `user-*`; o header do cliente **não escolhe** tenant.

**Body:**
```json
{
  "email": "string (email válido)",
  "password": "string (min: 6, max: 100)",
  "cpf": "string (11 dígitos)",
  "fullName": "string (opcional)",
  "birthdate": "string (YYYY-MM-DD, opcional)",
  "gender": "string (enum: 'male' | 'female' | 'non_binary' | 'other' | 'prefer_not_to_say', opcional)",
  "referralCode": "string (opcional)"
}
```

> **Gender (vocabulário canônico — 5 valores):** `male`, `female`, `non_binary`,
> `other`, `prefer_not_to_say` (`@unificard/contracts` `GENDER_VALUES`). O contrato
> anterior listava apenas 3 valores e está corrigido aqui.

> **Referral (DECISION-0119):** quando `referralCode` é informado e **válido**, o
> vínculo de indicação A→B é materializado **dentro da transação de nascimento**
> (atômico). Código **inválido** → `400` (`INVALID_REFERRAL_CODE`) antes de qualquer
> escrita. Falha ao materializar o vínculo com código válido → **rollback total** do
> cadastro. O cadastro **não cria** estado Bank. `/auth/register` é a **validação
> soberana final** do referral (a checagem pública `/auth/check-referral` é só UX).

**Response 201 (Success):**
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "uuid",
      "tenantId": "uuid (= unificard-inicial, resolvido server-side)",
      "email": "string"
    },
    "tokens": {
      "accessToken": "string (JWT)",
      "refreshToken": "string (JWT)"
    },
    "requiresOnboarding": boolean
  }
}
```

**Response 400 (Bad Request):**
```json
{
  "error": "Invalid request body",
  "details": [
    {
      "path": ["email"],
      "message": "Invalid email"
    }
  ]
}
```

**Response 500 (Internal Server Error):**
```json
{
  "success": false,
  "error": "Schema do banco de dados está desatualizado. A coluna users.token_version não existe.",
  "details": "Execute as migrations do banco de dados para atualizar o schema."
}
```

**Erros Possíveis:**
- `400` - Dados inválidos (validação de schema)
- `500` - Schema do banco desatualizado (token_version ausente)
- `500` - Erro interno do servidor

---

#### 1.2 POST `/auth/login`

**Descrição:** Autentica um usuário existente.

**Headers:**
- `Content-Type: application/json` (obrigatório)
- `x-tenant-id: <uuid>` (opcional - se não fornecido, busca usuário apenas por email)

**Body:**
```json
{
  "email": "string (email válido)",
  "password": "string (min: 6, max: 100)"
}
```

**Response 200 (Success):**
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "uuid",
      "tenantId": "uuid",
      "email": "string"
    },
    "tokens": {
      "accessToken": "string (JWT)",
      "refreshToken": "string (JWT)"
    },
    "requiresOnboarding": boolean
  }
}
```

**Response 400 (Bad Request):**
```json
{
  "error": "Dados de login inválidos",
  "message": "Email e senha são obrigatórios. Email deve ser válido e senha deve ter no mínimo 6 caracteres.",
  "details": [
    {
      "path": ["email"],
      "message": "Invalid email"
    }
  ]
}
```

**Response 401 (Unauthorized):**
```json
{
  "success": false,
  "error": "Invalid email or password"
}
```

**Response 500 (Internal Server Error):**
```json
{
  "success": false,
  "error": "Schema do banco de dados está desatualizado. A coluna users.token_version não existe.",
  "details": "Execute as migrations do banco de dados para atualizar o schema."
}
```

**Erros Possíveis:**
- `400` - Dados inválidos (validação de schema)
- `401` - Email ou senha inválidos
- `500` - Schema do banco desatualizado (token_version ausente)
- `500` - Erro interno do servidor

---

#### 1.3 POST `/auth/refresh`

**Descrição:** Renova tokens de acesso usando refresh token.

**Headers:**
- `Content-Type: application/json` (obrigatório)
- `x-tenant-id: <uuid>` (obrigatório)

**Body:**
```json
{
  "refreshToken": "string (JWT refresh token, min: 10 caracteres)"
}
```

**Response 200 (Success):**
```json
{
  "success": true,
  "data": {
    "accessToken": "string (JWT)",
    "refreshToken": "string (JWT)"
  }
}
```

**Response 400 (Bad Request):**
```json
{
  "error": "Tenant ID is required"
}
```

**Response 400 (Bad Request - Invalid Body):**
```json
{
  "error": "Invalid request body",
  "details": [
    {
      "path": ["refreshToken"],
      "message": "String must contain at least 10 character(s)"
    }
  ]
}
```

**Response 401 (Unauthorized):**
```json
{
  "success": false,
  "error": "Invalid or expired refresh token"
}
```

**Response 404 (Not Found):**
```json
{
  "success": false,
  "error": "User not found"
}
```

**Response 500 (Internal Server Error):**
```json
{
  "success": false,
  "error": "Schema do banco de dados está desatualizado. A coluna users.token_version não existe.",
  "details": "Execute as migrations do banco de dados para atualizar o schema."
}
```

**Erros Possíveis:**
- `400` - Tenant ID ausente
- `400` - Dados inválidos (validação de schema)
- `401` - Refresh token inválido ou expirado
- `404` - Usuário não encontrado
- `500` - Schema do banco desatualizado (token_version ausente)
- `500` - Erro interno do servidor

---

#### 1.4 POST `/auth/logout`

**Descrição:** Invalida todos os tokens do usuário (logout).

**Headers:**
- `Content-Type: application/json` (obrigatório)
- `x-tenant-id: <uuid>` (obrigatório)

**Body:**
```json
{
  "refreshToken": "string (JWT refresh token, min: 10 caracteres)"
}
```

**Response 200 (Success):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Response 400 (Bad Request):**
```json
{
  "error": "Tenant ID is required"
}
```

**Response 400 (Bad Request - Invalid Body):**
```json
{
  "error": "Invalid request body",
  "details": [
    {
      "path": ["refreshToken"],
      "message": "String must contain at least 10 character(s)"
    }
  ]
}
```

**Response 401 (Unauthorized):**
```json
{
  "success": false,
  "error": "Invalid tenant for token"
}
```

**Response 500 (Internal Server Error):**
```json
{
  "success": false,
  "error": "Erro interno do servidor"
}
```

**Erros Possíveis:**
- `400` - Tenant ID ausente
- `400` - Dados inválidos (validação de schema)
- `401` - Token inválido ou tenant não corresponde
- `500` - Erro interno do servidor

---

#### 1.5 GET `/auth/check-cpf`

**Descrição:** Verifica se um CPF já está cadastrado no sistema.

**Headers:**
- Nenhum header obrigatório

**Query Parameters:**
- `cpf: string` (obrigatório) - CPF a ser verificado (11 dígitos, com ou sem formatação)

**Response 200 (Success):**
```json
{
  "exists": boolean
}
```

**Response 400 (Bad Request - CPF ausente):**
```json
{
  "error": "CPF é obrigatório",
  "message": "Forneça o CPF como query parameter: ?cpf=XXXXXXXXXXX"
}
```

**Response 400 (Bad Request - CPF inválido):**
```json
{
  "error": "CPF inválido",
  "message": "CPF deve ter 11 dígitos e dígitos verificadores válidos"
}
```

**Response 500 (Internal Server Error):**
```json
{
  "error": "Erro interno ao verificar CPF"
}
```

**Erros Possíveis:**
- `400` - CPF ausente ou inválido
- `500` - Erro interno do servidor

---

#### 1.6 GET `/auth/check-referral`

**Descrição:** Validação **pública / pré-sessão** de código de indicação para UX em
tempo real (debounce no cadastro). Não aplica o código; apenas verifica existência.
Adicionada na frente `F-REGISTER-PRELAUNCH-BLOCKERS-CLOSURE` (A1).

**Rota pública pré-sessão.** O frontend usa `apiFetchPublic` (sem JWT). O tenant
institucional `unificard-inicial` é resolvido **server-side**; `x-tenant-id` do cliente
**não é autoridade** e é ignorado na resolução do tenant.

**Headers:**
- Nenhum header obrigatório (pré-sessão; sem `Authorization`)

**Query Parameters:**
- `code: string` (obrigatório) - código de indicação (alfanumérico, 4–32 caracteres)

**Rate limit:** `auth.check-referral` (equivalente ao `auth.check-cpf` — 10/min por
IP, configurável via `RATE_LIMIT_AUTH_CHECK_REFERRAL`). Excedente → `429`.

**Response 200 (Success):**
```json
{
  "valid": boolean
}
```
- código existente no tenant institucional → `{ "valid": true }`
- código **formatado mas inexistente** → `{ "valid": false }` (resposta honesta, não erro)

**Response 400 (Bad Request):**
```json
{
  "error": "Código de indicação é obrigatório"
}
```
- código ausente/vazio **ou** formato inválido (fora de `^[A-Za-z0-9]{4,32}$`).

**Response 429 (Too Many Requests):**
```json
{
  "success": false,
  "error": "Limite de verificações de indicação excedido. Tente novamente após ...",
  "resetAt": "ISO-8601"
}
```

**Response 500 (Internal Server Error):**
```json
{
  "error": "Erro ao validar código de indicação"
}
```
- Erro técnico pré-sessão **não** é "código inválido" confirmado — o cliente trata
  como indeterminado e **não** bloqueia o cadastro. A validação soberana final do
  referral é o `POST /auth/register`.

**Erros Possíveis:**
- `400` - código ausente/vazio/formato inválido
- `429` - rate limit excedido
- `500` - erro técnico (indeterminado, não confirma inválido)

> **NOTA — `/referral/validate` (logada/legada):** a validação em tempo real do
> pré-cadastro usa **esta** rota pública (`/auth/check-referral`), **não**
> `GET /referral/validate`. Esta última vive sob o escopo **protegido** (exige
> sessão/tenant) e é mantida apenas para chamadas logadas (candidata a tombstone
> documental). Não é rota pública e não consta nesta seção.

---

### 2. Health Check (`/health`)

#### 2.1 GET `/health`

**Descrição:** Verifica o status de saúde do servidor e módulos.

**Headers:**
- Nenhum header obrigatório

**Response 200 (Success):**
```json
{
  "status": "ok",
  "timestamp": "2025-01-22T10:00:00.000Z",
  "uptime": 12345.67,
  "version": "1.0.0",
  "canonical_permissions_version": "v1.3",
  "modules": {
    "marketplace": "ok" | "error",
    "social": "ok" | "error",
    "bank": "ok" | "error"
  },
  "runtime": {
    "pid": 12345,
    "nodeVersion": "v20.10.0",
    "platform": "linux",
    "arch": "x64",
    "port": 3000,
    "env": "production" | "development"
  },
  "database": {
    "connected": true,
    "host": "localhost",
    "port": 5432,
    "database": "unificard",
    "schema": "public",
    "user": "postgres",
    "connectionCount": 5
  } | {
    "connected": false
  }
}
```

**Erros Possíveis:**
- `500` - Servidor indisponível (não deve acontecer, mas possível)

---

#### 2.2 GET `/health/ready`

**Descrição:** Verifica se o servidor está pronto para receber requisições (readiness probe).

**Headers:**
- Nenhum header obrigatório

**Response 200 (Success):**
```json
{
  "status": "ready",
  "database": "connected"
}
```

**Response 503 (Service Unavailable):**
```json
{
  "status": "not ready",
  "database": "disconnected"
}
```

**Erros Possíveis:**
- `503` - Servidor não está pronto (banco desconectado)

---

#### 2.3 GET `/health/live`

**Descrição:** Verifica se o servidor está vivo (liveness probe).

**Headers:**
- Nenhum header obrigatório

**Response 200 (Success):**
```json
{
  "status": "live"
}
```

**Erros Possíveis:**
- `500` - Servidor indisponível (não deve acontecer, mas possível)

---

### 3. Webhooks (`/webhooks/*`)

#### 3.1 POST `/webhooks/pix/:provider`

**Descrição:** Webhook público para receber notificações de pagamento PIX.

**Headers:**
- `Content-Type: application/json` (obrigatório)
- Headers específicos do provider (varia por provider)

**Body:**
- Varia por provider (estrutura específica de cada provedor PIX)

**Response 200 (Success):**
```json
{
  "success": true,
  "message": "Webhook processed"
}
```

**Response 400 (Bad Request):**
```json
{
  "error": "Invalid webhook payload"
}
```

**Response 500 (Internal Server Error):**
```json
{
  "error": "Erro ao processar webhook"
}
```

**Erros Possíveis:**
- `400` - Payload inválido
- `500` - Erro interno do servidor

**NOTA:** Esta rota é pública mas pode ter validação de assinatura específica do provider.

---

#### 3.2 POST `/webhooks/pix/:provider` (Outros Providers)

**Descrição:** Webhook público para receber notificações de pagamento PIX de diferentes providers.

**Parâmetros de Rota:**
- `provider: string` - Nome do provider (ex: "stripe", "mercadopago", etc.)

**Headers:**
- `Content-Type: application/json` (obrigatório)
- Headers específicos do provider (varia por provider)

**Body:**
- Varia por provider (estrutura específica de cada provedor PIX)

**Response 200 (Success):**
```json
{
  "success": true,
  "message": "Webhook processed"
}
```

**Response 400 (Bad Request):**
```json
{
  "error": "Invalid webhook payload"
}
```

**Response 500 (Internal Server Error):**
```json
{
  "error": "Erro ao processar webhook"
}
```

**Erros Possíveis:**
- `400` - Payload inválido
- `500` - Erro interno do servidor

---

### 4. Payment Links (`/pay/*`)

#### 4.1 GET `/pay/:slug`

**Descrição:** Acessa um link de pagamento público.

**Headers:**
- Nenhum header obrigatório

**Parâmetros de Rota:**
- `slug: string` - Slug único do link de pagamento

**Response 200 (Success):**
```json
{
  "success": true,
  "data": {
    "paymentLink": {
      "id": "uuid",
      "slug": "string",
      "amount": "number",
      "currency": "string",
      "description": "string",
      "status": "string"
    }
  }
}
```

**Response 404 (Not Found):**
```json
{
  "error": "Payment link not found"
}
```

**Erros Possíveis:**
- `404` - Link de pagamento não encontrado
- `500` - Erro interno do servidor

**NOTA:** Esta rota é pública mas pode ter validação adicional dependendo do status do link.

---

### 5. Venue Public Routes (`/venue/*`)

**NOTA:** Rotas públicas de venue podem existir, mas não estão totalmente documentadas neste contrato v1.0.0.

**Status:** ⚠️ **PENDENTE DOCUMENTAÇÃO COMPLETA**

---

## Headers Obrigatórios

### Headers para Rotas Públicas

#### Rotas que NÃO requerem headers:
- `GET /health`
- `GET /auth/check-cpf`
- `GET /auth/check-referral`
- `POST /auth/register` (x-tenant-id IGNORADO como autoridade — tenant `unificard-inicial` server-side)
- `POST /auth/login` (x-tenant-id opcional)

#### Rotas que requerem `x-tenant-id`:
- `POST /auth/refresh` (obrigatório)
- `POST /auth/logout` (obrigatório)

#### Headers comuns:
- `Content-Type: application/json` (obrigatório para POST/PUT/PATCH)

---

## Códigos de Status HTTP

### 2xx - Success
- `200` - OK (sucesso)
- `201` - Created (recurso criado)

### 4xx - Client Error
- `400` - Bad Request (dados inválidos)
- `401` - Unauthorized (não autenticado ou token inválido)
- `403` - Forbidden (não autorizado)
- `404` - Not Found (recurso não encontrado)

### 5xx - Server Error
- `500` - Internal Server Error (erro interno do servidor)

---

## Formato de Erro Padrão

Todas as respostas de erro seguem o formato:

```json
{
  "success": false,
  "error": "string (mensagem de erro)",
  "details": "string (opcional, detalhes adicionais)",
  "message": "string (opcional, mensagem amigável)"
}
```

**Exceções:**
- Algumas rotas retornam apenas `{ "error": "string" }` (compatibilidade)
- Health check retorna `{ "status": "ok" }` (sem campo `success`)

---

## JWTs (JSON Web Tokens)

### Access Token

**Estrutura:**
```json
{
  "sub": "uuid (user_id)",
  "userId": "uuid (user_id)",
  "tenantId": "uuid (obrigatório)",
  "email": "string (opcional)",
  "tokenVersion": "number (obrigatório)",
  "type": "access",
  "iat": "number (timestamp)",
  "exp": "number (timestamp)"
}
```

**Validade:** 15 minutos (configurável via `JWT_EXPIRES_IN`)

**Uso:** Enviado no header `Authorization: Bearer <token>`

---

### Refresh Token

**Estrutura:**
```json
{
  "sub": "uuid (user_id)",
  "userId": "uuid (user_id)",
  "tenantId": "uuid (obrigatório)",
  "tokenVersion": "number (obrigatório)",
  "type": "refresh",
  "iat": "number (timestamp)",
  "exp": "number (timestamp)"
}
```

**Validade:** 7 dias (configurável via `JWT_REFRESH_EXPIRES_IN`)

**Uso:** Enviado no body de `POST /auth/refresh` e `POST /auth/logout`

---

## Versionamento

### Versão Atual: `v1.0.0`

**Regras de Versionamento:**
- **BREAKING CHANGE:** Incrementa versão major (v1.0.0 → v2.0.0)
- **Nova funcionalidade (backward compatible):** Incrementa versão minor (v1.0.0 → v1.1.0)
- **Bug fix (backward compatible):** Incrementa versão patch (v1.0.0 → v1.0.1)

### O que é considerado BREAKING CHANGE:

1. **Remoção de endpoint:** Remover qualquer endpoint público
2. **Mudança de método HTTP:** Alterar GET para POST, etc.
3. **Mudança de estrutura de request:** Adicionar campo obrigatório, remover campo existente
4. **Mudança de estrutura de response:** Remover campo, alterar tipo de campo
5. **Mudança de código de status:** Alterar 200 para 201, etc.
6. **Mudança de headers obrigatórios:** Adicionar header obrigatório que não existia

### O que NÃO é considerado BREAKING CHANGE:

1. **Adicionar novo endpoint:** Novos endpoints são adicionados sem breaking change
2. **Adicionar campo opcional no request:** Campos opcionais podem ser adicionados
3. **Adicionar campo no response:** Novos campos podem ser adicionados (cliente ignora)
4. **Correção de bug:** Correções de comportamento não documentado não são breaking changes

---

## Changelog

### v1.1.0 (2026-06-13) — F-REGISTER-PUBLIC-CONTRACT-AND-REFERRAL-HARDENING
- ✅ Novo endpoint público documentado: `GET /auth/check-referral` (validação pré-sessão
  de referral; `{ valid: boolean }`; 400 formato; 429 rate-limit `auth.check-referral`;
  tenant `unificard-inicial` server-side; `apiFetchPublic`). Adição backward-compatible.
- ✅ `POST /auth/register` corrigido (contrato stale): `x-tenant-id` **não é autoridade**
  (tenant institucional resolvido server-side; **não cria** tenant `user-*`); `gender` com
  **5 valores** canônicos (`male`/`female`/`non_binary`/`other`/`prefer_not_to_say`);
  nota de referral transacional (DECISION-0119) e de validação soberana final no register.
- ✅ `/referral/validate` esclarecida como rota **logada/legada** (não pré-cadastro público).
- ℹ️ Sem breaking change (apenas adição + correção de documentação stale).

### v1.0.0 (2025-01-22)
- ✅ Contrato inicial congelado
- ✅ Rotas de autenticação documentadas (5 endpoints: register, login, refresh, logout, check-cpf)
- ✅ Health check documentado (3 endpoints: /health, /health/ready, /health/live)
- ✅ Webhooks documentados (1 endpoint: /webhooks/pix/:provider)
- ✅ Payment Links documentados (1 endpoint: /pay/:slug)
- ✅ Headers obrigatórios definidos
- ✅ Códigos de status HTTP padronizados
- ✅ Formato de erro padrão definido
- ✅ Estrutura de JWT documentada (access token e refresh token)
- ✅ Versionamento definido (semantic versioning)
- ✅ Regras de governança estabelecidas

---

## Regras de Governança

### Processo de Mudança

1. **Proposta:** Documentar mudança proposta em ADR (Architecture Decision Record)
2. **Análise de Impacto:** Identificar todos os clientes afetados
3. **Aprovação:** Revisão e aprovação formal
4. **Implementação:** Implementar mudança
5. **Atualização:** Atualizar este documento
6. **Versionamento:** Incrementar versão conforme regras acima

### Processo de Breaking Change

1. **Aviso Prévio:** Notificar clientes com 30 dias de antecedência
2. **Deprecation:** Marcar endpoint como deprecated
3. **Migração:** Fornecer período de migração (mínimo 90 dias)
4. **Remoção:** Remover endpoint após período de migração
5. **Versionamento:** Incrementar versão major

---

## Referências

- `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md` - Invariantes canônicos
- `backend/src/core/auth/auth.routes.ts` - Implementação das rotas de autenticação (inclui `/auth/check-referral`)
- `backend/src/core/rate-limiting/auth-rate-limit.service.ts` - Config do rate-limit `auth.check-referral`
- `backend/src/core/referral/referral.routes.ts` - `/referral/validate` (logada/legada)
- `backend/src/core/health/health.module.ts` - Implementação do health check
- `backend/src/modules/payments/pix.routes.ts` - Implementação dos webhooks PIX
- `docs/02_decisions/DECISION_0115_HUMAN_BIRTH_VERTICAL_ROOT_DECISIONS.md` - tenant server-side
- `docs/02_decisions/DECISION_0119_REFERRAL_LINK_PURE_VINCULO.md` - vínculo de indicação transacional

---

## Checklist de Validação

Antes de qualquer mudança em rotas públicas, validar:

- [ ] Mudança não quebra contrato existente
- [ ] Se breaking change, versão major incrementada
- [ ] Documentação atualizada
- [ ] Changelog atualizado
- [ ] Clientes notificados (se breaking change)
- [ ] Testes atualizados

---

## Declaração Final

**Este documento é o contrato público da API Unificard.**

Qualquer mudança que viole este contrato **DEVE** ser marcada como **BREAKING CHANGE** e incrementar a versão da API.

**Status:** ✅ CONGELADO COMO CONTRATO PÚBLICO

---

**Última Revisão:** 2026-06-13
**Próxima Revisão:** Conforme processo de governança

