# 🚀 GUIA DE EXECUÇÃO LOCAL — MÓDULO EVENTOS

> **Status**: PRONTO PARA EXECUÇÃO  
> **Data**: 2025-01-07

---

## ✅ VALIDAÇÃO PRÉ-EXECUÇÃO

### Código Validado

- ✅ Backend: Programação defensiva implementada
- ✅ Frontend: Arquivos prontos e no lugar correto
- ✅ Rotas: Todas registradas
- ✅ Motor único: Feed e /eventos unificados
- ✅ Nenhum erro de lint

---

## 📋 TAREFA 1: BANCO DE DADOS (OBRIGATÓRIA)

### Executar Migration 070

```bash
cd backend
psql $DATABASE_URL < migrations/070_posts_event_link.sql
```

**Ou se DATABASE_URL não estiver definido:**

```bash
psql -U seu_usuario -d seu_banco -f migrations/070_posts_event_link.sql
```

### Validar Migration

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'posts'
AND column_name IN ('event_id', 'type', 'visibility');
```

**Resultado esperado**: 3 colunas retornadas

---

## 📋 TAREFA 2: BACKEND — CONFIGURAÇÃO

### 2.1 Variáveis de Ambiente

Criar/verificar arquivo `backend/.env`:

```env
# Banco de Dados (OBRIGATÓRIO)
DATABASE_URL=postgresql://usuario:senha@localhost:5432/unificard

# JWT (OBRIGATÓRIO)
JWT_SECRET=sua_chave_secreta_aqui

# Porta (opcional, padrão: 3000)
PORT=3000

# CORS (opcional)
CORS_ORIGIN=http://localhost:5173

# Ambiente
NODE_ENV=development
```

### 2.2 Instalar Dependências

```bash
cd backend
npm install
```

### 2.3 Executar Backend

```bash
npm run dev
```

**Resultado esperado**:
- Servidor inicia em `http://localhost:3000`
- Health check: `http://localhost:3000/health`
- Nenhum erro de conexão com banco

---

## 📋 TAREFA 3: FRONTEND — CONFIGURAÇÃO

### 3.1 Variáveis de Ambiente

Criar/verificar arquivo `frontend/.env.local`:

```env
# URL do Backend (OBRIGATÓRIO)
VITE_API_BASE_URL=http://localhost:3000
```

### 3.2 Instalar Dependências

```bash
cd frontend
npm install
```

### 3.3 Executar Frontend

```bash
npm run dev
```

**Resultado esperado**:
- Frontend inicia em `http://localhost:5173`
- Conecta no backend sem `ERR_CONNECTION_REFUSED`

---

## 📋 TAREFA 4: VALIDAÇÃO FUNCIONAL

### Checklist de Testes

1. **Backend rodando**
   - [ ] `http://localhost:3000/health` retorna OK
   - [ ] Nenhum erro no console do backend

2. **Frontend conectado**
   - [ ] `http://localhost:5173` carrega
   - [ ] Nenhum erro `ERR_CONNECTION_REFUSED` no console

3. **Login funciona**
   - [ ] `/login` carrega
   - [ ] Login conecta no backend
   - [ ] Token é recebido

4. **Feed Social**
   - [ ] `/social` carrega sem erro
   - [ ] Feed exibe posts
   - [ ] Nenhum erro "coluna p.event_id não existe"

5. **Página de Eventos**
   - [ ] `/eventos` carrega sem erro
   - [ ] Lista de eventos exibida (mesmo se vazia)
   - [ ] Botão "+ Criar evento" visível

6. **Criação de Evento**
   - [ ] Botão "Criar evento" redireciona para `/events/new`
   - [ ] Wizard abre (Step 1)
   - [ ] Step 2 mostra: "O que você quer que aconteça?"
   - [ ] Cards de intenção aparecem (8 para user, 6 para page)
   - [ ] Seleção de intenção funciona
   - [ ] Evento criado com sucesso

7. **Evento no Feed**
   - [ ] Evento criado aparece no feed (`/social`)
   - [ ] Evento aparece na página `/eventos`
   - [ ] Dados consistentes em ambos

---

## 🔴 PROBLEMAS COMUNS E SOLUÇÕES

### Erro: "coluna p.event_id não existe"

**Causa**: Migration 070 não foi aplicada.

**Solução**:
```bash
cd backend
psql $DATABASE_URL < migrations/070_posts_event_link.sql
```

**Nota**: Com programação defensiva, o sistema funciona mesmo sem a migration, mas eventos vinculados não aparecerão.

---

### Erro: ERR_CONNECTION_REFUSED :3000

**Causa**: Backend não está rodando.

**Solução**:
1. Verificar se backend está rodando: `cd backend && npm run dev`
2. Verificar se porta 3000 está livre
3. Verificar variável `VITE_API_BASE_URL` no frontend

---

### Erro: "DATABASE_URL is not defined"

**Causa**: Arquivo `.env` não existe ou não está sendo lido.

**Solução**:
1. Criar `backend/.env` com `DATABASE_URL`
2. Verificar que `dotenv/config` está importado (já está em `server.ts`)

---

### Erro: "JWT_SECRET is not defined"

**Causa**: `JWT_SECRET` não está no `.env`.

**Solução**: Adicionar `JWT_SECRET=sua_chave_secreta` em `backend/.env`

---

## ✅ CONDIÇÃO DE SUCESSO

O sistema está funcionando quando:

- ✅ Backend sobe sem erro
- ✅ Frontend conecta no backend
- ✅ Login funciona
- ✅ `/social` carrega sem erro
- ✅ `/eventos` carrega sem erro
- ✅ Criar evento funciona
- ✅ Evento aparece no feed e em `/eventos`
- ✅ Nenhum erro no console

---

## 📊 RESUMO DE COMANDOS

```bash
# 1. Migration
cd backend
psql $DATABASE_URL < migrations/070_posts_event_link.sql

# 2. Backend
cd backend
npm install
npm run dev

# 3. Frontend (em outro terminal)
cd frontend
npm install
npm run dev

# 4. Validar
# - Backend: http://localhost:3000/health
# - Frontend: http://localhost:5173
```

---

*Guia criado em 2025-01-07*  
*Baseado em ESTADO_ATUAL_MODULO_EVENTOS.md*






