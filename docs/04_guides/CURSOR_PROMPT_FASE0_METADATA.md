# CURSOR PROMPT — FASE 0: Remover e.metadata

## CONTEXTO
Erro atual em `/eventos`: "coluna e.metadata não existe"
Causa: Campo `metadata` foi referenciado mas NUNCA existiu na tabela `events`.

## OBJETIVO
Remover todas as referências a `e.metadata` e `metadata: any` relacionadas a eventos.

---

## TAREFAS (EXECUTAR EM ORDEM)

### 1. FeedService.ts — Remover e.metadata da query

**Arquivo:** `backend/src/services/feed/FeedService.ts`
**Linha:** 175

**ANTES:**
```sql
        e.created_at,
        e.metadata
      FROM events e
```

**DEPOIS:**
```sql
        e.created_at
      FROM events e
```

**Ação:** Remover a linha `,\n        e.metadata`

---

### 2. event-feed-adapter.ts — Remover metadata da interface adaptEventToFeedEvent

**Arquivo:** `backend/src/services/feed/event-feed-adapter.ts`
**Linha:** 71

**ANTES:**
```typescript
  created_at: Date;
  metadata: any;
}): FeedEvent {
```

**DEPOIS:**
```typescript
  created_at: Date;
}): FeedEvent {
```

**Ação:** Remover a linha `metadata: any;`

---

### 3. event-feed-adapter.ts — Remover metadata da interface adaptEventToFeedItem

**Arquivo:** `backend/src/services/feed/event-feed-adapter.ts`
**Linha:** 109

**ANTES:**
```typescript
  created_at: Date;
  metadata: any;
}): FeedItem {
```

**DEPOIS:**
```typescript
  created_at: Date;
}): FeedItem {
```

**Ação:** Remover a linha `metadata: any;`

---

## PROIBIDO

- ❌ NÃO criar coluna metadata na tabela events
- ❌ NÃO criar nova migration
- ❌ NÃO alterar nenhum outro arquivo
- ❌ NÃO "melhorar" código adjacente
- ❌ NÃO mexer no frontend

---

## VALIDAÇÃO

Após as 3 alterações:

1. Iniciar backend:
   ```bash
   cd backend && pnpm dev
   ```

2. Acessar no browser:
   ```
   http://localhost:5173/eventos
   ```

3. Resultado esperado:
   - Página carrega SEM erro
   - Nenhuma mensagem "coluna e.metadata não existe"
   - Feed de eventos funciona normalmente

---

## DEFINIÇÃO DE SUCESSO

✅ 3 linhas removidas (1 no FeedService.ts, 2 no event-feed-adapter.ts)
✅ Zero arquivos novos
✅ Zero migrations novas
✅ Página /eventos funciona sem erro

---

*Prompt gerado em 29/12/2025*
*Fase: 0 - Fechamento de Eventos*
