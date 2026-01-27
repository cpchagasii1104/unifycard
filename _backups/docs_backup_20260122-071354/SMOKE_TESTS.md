# Smoke Tests - MVP

**Objetivo**: Testes mínimos para validar fluxos críticos do MVP e prevenir regressões

---

## 1. FLUXOS TESTADOS

### 1.1. Feed Plugin Batch
- **Endpoint**: `POST /feed/plugin/render-batch`
- **Teste**: Renderiza posts em batch (1..N postIds)
- **Validação**: Retorna DTOs e actions corretamente

### 1.2. Agenda Actor-Scoped
- **Endpoint**: `GET /availability`
- **Teste**: Filtra disponibilidades por `owner_type`/`owner_id`
- **Validação**: Retorna apenas disponibilidades do actor especificado

### 1.3. Conflict → Inbox
- **Endpoint**: `POST /availability/:id/participants` + `GET /inbox/actors/:id`
- **Teste**: Cria participante com conflito e verifica se item foi criado no inbox
- **Validação**: Alerta de conflito é projetado para inbox

### 1.4. Company Members List
- **Endpoint**: `GET /companies/:companyId/members`
- **Teste**: Lista membros de uma empresa
- **Validação**: Retorna lista de membros corretamente

---

## 2. COMO RODAR

### 2.1. Pré-requisitos
- Banco de dados configurado (pode usar DB de teste)
- Variável `DATABASE_URL` no `.env`
- Variável `JWT_SECRET` no `.env` (ou usa default de teste)

### 2.2. Rodar Todos os Smoke Tests

```bash
# Backend
cd backend
pnpm test:smoke
```

### 2.3. Rodar Todos os Testes

```bash
# Backend
cd backend
pnpm test
```

### 2.4. Rodar em Modo Watch

```bash
# Backend
cd backend
pnpm test:watch
```

---

## 3. ESTRUTURA

```
backend/
  tests/
    smoke/
      mvp-smoke.test.ts    # Smoke tests do MVP
    integration/           # Testes de integração existentes
    setup.ts               # Setup global
  jest.config.js           # Configuração do Jest
```

---

## 4. CARACTERÍSTICAS

### 4.1. Isolamento
- Cada teste cria seus próprios dados
- Usa tenant de teste isolado
- Não depende de serviços externos

### 4.2. Simplicidade
- Testes mínimos (não suite completa)
- Foca em fluxos críticos
- Valida apenas "passa/falha"

### 4.3. Performance
- Timeout de 30 segundos por teste
- Usa transações quando possível
- Limpa dados após testes (opcional)

---

## 5. LIMITAÇÕES

### 5.1. Não Cobre
- ❌ Todos os endpoints
- ❌ Todos os casos de erro
- ❌ Performance/load
- ❌ Integrações externas

### 5.2. Foca em
- ✅ Fluxos críticos do MVP
- ✅ Prevenção de regressões
- ✅ Validação rápida (smoke)

---

## 6. ADICIONAR NOVOS TESTES

Para adicionar um novo smoke test:

1. Adicionar novo `describe()` em `mvp-smoke.test.ts`
2. Seguir padrão existente:
   - Criar dados de teste no `beforeAll()`
   - Fazer requisição HTTP
   - Validar resposta
3. Rodar `pnpm test:smoke` para validar

---

## 7. CI/CD

Para rodar em CI:

```yaml
# Exemplo GitHub Actions
- name: Run Smoke Tests
  run: |
    cd backend
    pnpm test:smoke
```

---

**Status**: ✅ Smoke tests implementados e documentados

