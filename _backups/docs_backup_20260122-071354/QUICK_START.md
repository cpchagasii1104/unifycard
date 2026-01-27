# 🚀 Quick Start - Unificard

## Problema: Frontend não conecta ao backend

Se você está vendo o erro "Não foi possível conectar ao servidor em http://localhost:3000", siga estes passos:

### 1. Criar arquivo `.env.local` no frontend

Na pasta `frontend`, crie um arquivo chamado `.env.local` com o seguinte conteúdo:

```env
VITE_API_BASE_URL=http://localhost:3000
```

### 2. Iniciar o backend

Abra um terminal e execute:

```powershell
cd C:\unificard\backend
npm run dev
```

Aguarde até ver a mensagem:
```
✅ SERVIDOR INICIADO COM SUCESSO
🌐 Servidor rodando em http://localhost:3000
```

### 3. Verificar se o backend está rodando

Abra o navegador e acesse:
```
http://localhost:3000/health
```

Deve retornar `{"status":"ok"}`.

### 4. Reiniciar o frontend

Se o frontend já estava rodando, pare (Ctrl+C) e inicie novamente:

```powershell
cd C:\unificard\frontend
npm run dev
```

### 5. Recarregar a página

No navegador, pressione `Ctrl+Shift+R` para fazer um hard refresh.

---

## Checklist Rápido

- [ ] Arquivo `frontend/.env.local` criado com `VITE_API_BASE_URL=http://localhost:3000`
- [ ] Backend rodando na porta 3000 (`npm run dev` no diretório `backend`)
- [ ] Health check responde: `http://localhost:3000/health`
- [ ] Frontend reiniciado após criar `.env.local`
- [ ] Página recarregada no navegador

---

## Troubleshooting

### Backend não inicia

- Verifique se a porta 3000 está livre
- Verifique se o arquivo `backend/.env` existe e tem `DATABASE_URL` configurada
- Verifique os logs do backend para erros

### Frontend ainda não conecta

- Verifique se o arquivo `.env.local` está na pasta `frontend` (não `frontend/src`)
- Verifique se o nome do arquivo é exatamente `.env.local` (com ponto no início)
- Limpe o cache do Vite: `Remove-Item -Recurse -Force node_modules/.vite`
- Reinicie o servidor de desenvolvimento

### CORS Error

- Verifique se o backend tem CORS configurado para aceitar `http://localhost:5173`
- Verifique a variável `CORS_ORIGIN` no `backend/.env`

---

**Última atualização:** FASE 11A + 11C


























