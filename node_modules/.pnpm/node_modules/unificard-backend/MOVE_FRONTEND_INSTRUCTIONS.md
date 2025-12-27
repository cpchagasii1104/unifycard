# Instruções para Completar a Movimentação do Frontend

## ✅ O que já foi feito

1. ✅ Frontend copiado para `C:\unificard\frontend`
2. ✅ `package.json` do backend atualizado (`dev:frontend` agora aponta para `../frontend`)
3. ✅ `frontend/README.md` atualizado com novos caminhos
4. ✅ Estrutura de pastas documentada

## ⚠️ O que precisa ser feito manualmente

Alguns arquivos em `node_modules` não puderam ser movidos porque estavam em uso. Siga estes passos:

### 1. Fechar processos que podem estar usando os arquivos

- Feche o VS Code se estiver com arquivos do frontend abertos
- Feche qualquer terminal que esteja rodando `npm run dev` no frontend
- Feche qualquer processo Node.js relacionado ao frontend

### 2. Remover a pasta antiga

```powershell
# Na raiz do projeto (C:\unificard)
Remove-Item -Path backend\frontend -Recurse -Force
```

**OU** delete manualmente a pasta `backend\frontend` pelo Windows Explorer.

### 3. Reinstalar dependências (se necessário)

Se houver problemas com `node_modules`:

```powershell
# Na pasta do frontend (C:\unificard\frontend)
cd frontend
Remove-Item -Path node_modules -Recurse -Force
npm install
```

### 4. Verificar se tudo está funcionando

```powershell
# Testar se o frontend inicia
cd frontend
npm run dev
```

## 📁 Nova estrutura de pastas

```
unificard/
├── backend/           ← Backend (porta 3000)
│   ├── src/
│   ├── migrations/
│   ├── package.json   ← Atualizado: dev:frontend aponta para ../frontend
│   └── ...
└── frontend/          ← Frontend (porta 5173) - NOVA LOCALIZAÇÃO
    ├── src/
    ├── package.json
    ├── vite.config.ts
    └── .env
```

## 🔄 Comandos atualizados

### Rodar frontend (do backend)

```powershell
# Na pasta backend
npm run dev:frontend
```

### Rodar frontend (direto)

```powershell
# Na pasta frontend
cd frontend
npm run dev
```

## ✅ Checklist final

- [ ] Pasta `backend\frontend` removida
- [ ] Frontend funciona em `C:\unificard\frontend`
- [ ] `npm run dev` funciona no frontend
- [ ] `npm run dev:frontend` funciona do backend
- [ ] Login no frontend funciona
- [ ] Todas as rotas do frontend funcionam

## 📝 Notas

- O frontend agora está na raiz do projeto, ao lado do backend
- Todos os caminhos relativos foram atualizados
- O `package.json` do backend foi atualizado para apontar para `../frontend`
- O README do frontend foi atualizado com a nova estrutura



