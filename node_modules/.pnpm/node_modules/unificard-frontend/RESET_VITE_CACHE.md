# Como resolver erro "Outdated Optimize Dep" do Vite

Se você está vendo o erro 504 "Outdated Optimize Dep" após instalar uma nova dependência:

## Solução rápida (Windows PowerShell)

1. **Pare o servidor de desenvolvimento** (Ctrl+C no terminal onde está rodando)

2. **Limpe o cache do Vite:**
```powershell
cd frontend
Remove-Item -Recurse -Force node_modules\.vite -ErrorAction SilentlyContinue
```

3. **Reinicie o servidor:**
```powershell
npm run dev
```

## Alternativa: Forçar reotimização

Você também pode simplesmente reiniciar o servidor e o Vite vai reotimizar automaticamente. Se o erro persistir, limpe o cache como acima.

## Nota

Este erro é comum quando você instala novas dependências npm. O Vite otimiza as dependências em cache e às vezes precisa ser forçado a reotimizar.













