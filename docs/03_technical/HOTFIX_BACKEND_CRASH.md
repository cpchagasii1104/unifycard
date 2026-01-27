# 🔴 HOTFIX — BACKEND NÃO SOBE

## PROBLEMA
```
SyntaxError: Identifier 'eventId' has already been declared
```

A variável `eventId` estava declarada DUAS VEZES no mesmo escopo em `social-2.0.service.ts`.

---

## SOLUÇÃO

### OPÇÃO 1: Substituir o arquivo (RECOMENDADO)

1. Baixe o arquivo `social-2.0.service.ts` (já corrigido)
2. Substitua em:
   ```
   C:\unificard\backend\src\modules\social\social-2.0.service.ts
   ```
3. Reinicie o backend:
   ```powershell
   cd C:\unificard\backend
   pnpm dev
   ```

---

### OPÇÃO 2: Corrigir manualmente

1. Abra `C:\unificard\backend\src\modules\social\social-2.0.service.ts`

2. Procure (por volta da linha 316-318):
   ```typescript
         // Posts relacionados a eventos (compartilhamentos) = 120
         // DEFENSIVE: row.event_id pode não existir se coluna não foi criada
         const eventId = (row as any).event_id;
         if (metadata.event_id || eventId || intent === 'event') {
   ```

3. Mude para:
   ```typescript
         // Posts relacionados a eventos (compartilhamentos) = 120
         // eventId já foi declarado acima (reutilizando)
         if (metadata.event_id || eventId || intent === 'event') {
   ```

4. Salve e reinicie o backend.

---

## VERIFICAÇÃO

Após aplicar, rode:
```powershell
cd C:\unificard\backend
pnpm dev
```

Deve aparecer:
```
🚀 Server listening on 0.0.0.0:3000
```

Se aparecer, o backend está rodando. Teste:
- http://localhost:3000/health
- http://localhost:5173/login

---

## RESUMO DA CORREÇÃO

| Linha | Antes | Depois |
|-------|-------|--------|
| ~317-318 | `const eventId = (row as any).event_id;` | (linha removida) |

A variável `eventId` já foi declarada na linha 284 e pode ser reutilizada.
