# 🔧 Solução Rápida - Backend Não Conecta

## Status Atual
- ✅ Arquivo `.env.local` criado no frontend
- ❌ Backend não está respondendo na porta 3000

## Solução Passo a Passo

### 1. Verificar se há processo Node.js na porta 3000

Execute no PowerShell:
```powershell
netstat -ano | findstr ":3000"
```

Se houver algum processo, anote o PID e mate-o:
```powershell
taskkill /PID <numero_do_pid> /F
```

### 2. Verificar configuração do backend

Certifique-se de que o arquivo `backend/.env` existe e tem:
```env
DATABASE_URL=postgresql://usuario:senha@localhost:5432/unificard
PORT=3000
```

### 3. Iniciar o backend manualmente

Abra um **novo terminal PowerShell** e execute:

```powershell
cd C:\unificard\backend
npm run dev
```

**Aguarde** até ver estas mensagens:
```
✅ SERVIDOR INICIADO COM SUCESSO
🌐 Servidor rodando em http://localhost:3000
💚 Health check disponível em http://localhost:3000/health
```

### 4. Verificar se o backend está funcionando

Em **outro terminal** ou no navegador, acesse:
```
http://localhost:3000/health
```

Deve retornar: `{"status":"ok"}`

### 5. Reiniciar o frontend

Se o frontend já estava rodando:
1. Pare com `Ctrl+C`
2. Inicie novamente: `npm run dev`
3. Recarregue a página: `Ctrl+Shift+R`

---

## Problemas Comuns

### Erro: "Porta 3000 já está em uso"
```powershell
# Encontrar processo
netstat -ano | findstr ":3000"

# Matar processo (substitua <PID> pelo número)
taskkill /PID <PID> /F
```

### Erro: "DATABASE_URL não configurada"
- Verifique se `backend/.env` existe
- Verifique se tem a linha `DATABASE_URL=...`
- Verifique se o PostgreSQL está rodando

### Erro: "Cannot connect to database"
- Verifique se o PostgreSQL está rodando
- Verifique se a `DATABASE_URL` está correta
- Teste a conexão: `psql -U usuario -d unificard`

---

## Checklist Final

- [ ] Nenhum processo na porta 3000 (ou matou processos antigos)
- [ ] Arquivo `backend/.env` existe e tem `DATABASE_URL`
- [ ] Backend iniciado e mostrando "✅ SERVIDOR INICIADO"
- [ ] `http://localhost:3000/health` retorna `{"status":"ok"}`
- [ ] Frontend reiniciado após criar `.env.local`
- [ ] Página recarregada no navegador













