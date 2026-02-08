# 🚀 INICIAR BACKEND AGORA - Passo a Passo

## ⚠️ IMPORTANTE: O backend PRECISA estar rodando para o frontend funcionar!

---

## 📋 INSTRUÇÕES (2 minutos)

### 1️⃣ Abra um NOVO terminal PowerShell

- Pressione `Windows + X`
- Escolha "Terminal" ou "PowerShell"
- **OU** clique com botão direito no menu Iniciar → "Terminal"

### 2️⃣ Execute estes comandos (copie e cole):

```powershell
cd C:\unificard\backend
npm run dev
```

### 3️⃣ AGUARDE estas mensagens aparecerem:

```
✅ SERVIDOR INICIADO COM SUCESSO
🌐 Servidor rodando em http://localhost:3000
💚 Health check disponível em http://localhost:3000/health
```

⏱️ **Isso pode levar 10-30 segundos**

### 4️⃣ NÃO FECHE esta janela do terminal!

O backend precisa continuar rodando enquanto você usa o frontend.

### 5️⃣ Verifique se funcionou

Abra no navegador: **http://localhost:3000/health**

Deve aparecer: `{"status":"ok"}`

### 6️⃣ Recarregue a página do frontend

No navegador, pressione: **`Ctrl + Shift + R`**

O erro deve desaparecer! ✅

---

## ❌ Se aparecer algum ERRO

### Erro: "Port already in use"
```powershell
# Encontrar processo
netstat -ano | findstr ":3000"

# Matar processo (substitua <PID> pelo número)
taskkill /PID <PID> /F
```

### Erro: "Cannot connect to database"
- Verifique se PostgreSQL está rodando
- Verifique se `DATABASE_URL` no `backend/.env` está correta

### Erro: "Cannot find module"
```powershell
cd C:\unificard\backend
npm install
```

### Outro erro?
**Copie a mensagem de erro completa** e me envie!

---

## ✅ Checklist Rápido

- [ ] Terminal PowerShell aberto
- [ ] Executou `cd C:\unificard\backend`
- [ ] Executou `npm run dev`
- [ ] Viu mensagem "✅ SERVIDOR INICIADO COM SUCESSO"
- [ ] http://localhost:3000/health retorna `{"status":"ok"}`
- [ ] Recarregou página do frontend (Ctrl+Shift+R)

---

## 💡 Dica

Mantenha **2 terminais abertos**:
1. **Terminal 1:** Backend (`npm run dev` no diretório `backend`)
2. **Terminal 2:** Frontend (`npm run dev` no diretório `frontend`)

Assim você vê os logs de ambos!


















