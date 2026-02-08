# ⚙️ Configurar Frontend

## Criar arquivo .env.local

1. Navegue até a pasta `frontend`:
   ```powershell
   cd C:\unificard\frontend
   ```

2. Crie um arquivo chamado `.env.local` (com ponto no início!)

3. Adicione esta linha no arquivo:
   ```
   VITE_API_BASE_URL=http://localhost:3000
   ```

4. Salve o arquivo

## Verificar se funcionou

1. Reinicie o servidor do frontend (se estiver rodando):
   - Pare com `Ctrl+C`
   - Inicie novamente: `npm run dev`

2. Recarregue a página no navegador: `Ctrl+Shift+R`

## Localização do arquivo

O arquivo deve estar em:
```
C:\unificard\frontend\.env.local
```

**Importante:** O nome do arquivo é `.env.local` (com ponto no início, sem extensão antes do `.local`)


















