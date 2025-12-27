# Frontend Mínimo de Validação — Unificard

Frontend READ-ONLY para validação real do Fundo Regional.

## Objetivo

Permitir que pessoas reais vejam:
- Quanto dinheiro entrou no fundo
- Quanto tem no fundo
- Para onde cada parte vai (70% / 15% / 10% / 5%)

## Como rodar (Windows)

### 1. Abrir terminal na pasta do frontend

```powershell
# Se estiver na raiz do projeto (C:\unificard)
cd frontend
```

### 2. Instalar dependências (se ainda não instalou)

```powershell
npm install
```

### 3. Criar arquivo .env (se não existir)

Copie o arquivo de exemplo:

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

Ou crie manualmente o arquivo `.env` na pasta `frontend/` com:

```
VITE_API_BASE_URL=http://localhost:3000
```

**Nota**: Se o backend estiver em outra porta, ajuste o valor.

### 4. Rodar o frontend

```powershell
npm run dev
```

### 5. Acessar no navegador

Abra: http://localhost:5173

## Estrutura de pastas

```
unificard/
├── frontend/          ← Você está aqui
│   ├── src/
│   ├── package.json
│   ├── vite.config.ts
│   └── .env          ← Criar este arquivo
└── backend/           ← Backend (porta 3000)
    └── src/
```

## Pré-requisitos

- Backend rodando na porta 3000
- Node.js instalado
- npm instalado

## Login

Na tela de login, preencha:

1. **Tenant ID**: UUID do tenant (obrigatório)
   - Exemplo: `123e4567-e89b-12d3-a456-426614174000`
   - Você precisa ter este ID do seu tenant

2. **Email**: Email do usuário cadastrado

3. **Senha**: Senha do usuário

Após login bem-sucedido, você verá o Dashboard do Fundo Regional.

## Endpoints consumidos

O frontend consome estes endpoints do backend:

- `POST /auth/login` — Autenticação
- `GET /economy/fund` — Visão completa do fundo (usado no dashboard)
- `GET /economy/fund/summary` — Resumo (disponível)
- `GET /economy/fund/history` — Histórico (disponível)
- `GET /economy/fund/projection` — Projeção (disponível)

## Variáveis de ambiente

Crie o arquivo `.env` na pasta `frontend/` com:

```
VITE_API_BASE_URL=http://localhost:3000
```

**Importante**: O backend deve estar rodando na porta 3000.

## Solução de problemas

### Erro: "Cannot find module"
```powershell
# Reinstalar dependências
cd frontend
npm install
```

### Erro: "Failed to fetch" ou "Network error"
- Verifique se o backend está rodando: http://localhost:3000/health
- Verifique se `VITE_API_BASE_URL` no `.env` está correto

### Erro: "401 Unauthorized"
- Verifique se fez login corretamente
- Verifique se o token está sendo salvo (localStorage)

### Porta 5173 já em uso
- Feche outros processos usando a porta 5173
- Ou altere a porta em `vite.config.ts`

## Notas

- Frontend mínimo, sem design system
- Apenas leitura (READ-ONLY)
- Linguagem humana, não técnica
- Sem automação, sem decisão, sem execução
- Sem gráficos complexos — apenas tabela de histórico

