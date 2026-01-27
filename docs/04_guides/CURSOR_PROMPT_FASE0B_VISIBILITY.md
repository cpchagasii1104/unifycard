# CURSOR PROMPT — FASE 0B: Resolver p.visibility

## CONTEXTO
Erro atual em `/eventos`: "coluna p.visibility não existe"
Causa: A coluna `visibility` existe na migration 070, mas pode não ter sido aplicada no banco.
Solução: Programação defensiva (verificar se coluna existe antes de usar).

## OBJETIVO
Aplicar programação defensiva no FeedService.ts para `p.visibility`, igual foi feito para `event_id`.

---

## TAREFAS (EXECUTAR EM ORDEM)

### 1. FeedService.ts — Adicionar verificação de coluna visibility

**Arquivo:** `backend/src/services/feed/FeedService.ts`

**Localizar** (próximo à linha 70-90):
```typescript
// Verificar se coluna event_id existe na tabela posts
const hasEventIdColumn = await this.checkColumnExists('posts', 'event_id');
```

**Adicionar LOGO ABAIXO:**
```typescript
// Verificar se coluna visibility existe na tabela posts
const hasVisibilityColumn = await this.checkColumnExists('posts', 'visibility');
```

---

### 2. FeedService.ts — Modificar query de posts para usar programação defensiva

**Localizar** (linhas 120-134):
```typescript
    if (hasEventIdColumn) {
      postsQuery += `,
        e.id as event_id,
        ...
      FROM posts p
      LEFT JOIN events e ON e.id = p.event_id
      WHERE p.visibility = 'PUBLIC'
```

**Substituir por:**
```typescript
    if (hasEventIdColumn) {
      postsQuery += `,
        e.id as event_id,
        e.title as event_title,
        e.event_type,
        e.datetime_start as event_start_time,
        e.datetime_end as event_end_time,
        e.city_id as event_city_id,
        e.ticket_price_cents as event_ticket_price,
        e.status as event_status
      FROM posts p
      LEFT JOIN events e ON e.id = p.event_id
      `;
      
      // Filtro de visibility apenas se coluna existir
      if (hasVisibilityColumn) {
        postsQuery += `WHERE p.visibility = 'PUBLIC'`;
      } else {
        postsQuery += `WHERE 1=1`; // Sem filtro de visibility
      }
      
      postsQuery += `
        AND (
          p.event_id IS NULL
          OR (e.status = 'published' AND e.visibility IN ('public', 'unlisted'))
        )
      `;
```

---

### 3. FeedService.ts — Modificar query sem event_id

**Localizar** (linhas 128-134):
```typescript
    } else {
      // Sem coluna event_id: apenas posts, sem join com events
      postsQuery += `
      FROM posts p
      WHERE p.visibility = 'PUBLIC'
      `;
    }
```

**Substituir por:**
```typescript
    } else {
      // Sem coluna event_id: apenas posts, sem join com events
      postsQuery += `
      FROM posts p
      `;
      
      // Filtro de visibility apenas se coluna existir
      if (hasVisibilityColumn) {
        postsQuery += `WHERE p.visibility = 'PUBLIC'`;
      } else {
        postsQuery += `WHERE 1=1`; // Sem filtro de visibility
      }
    }
```

---

## PROIBIDO

- ❌ NÃO criar coluna visibility manualmente
- ❌ NÃO rodar migrations manualmente
- ❌ NÃO alterar nenhum outro arquivo
- ❌ NÃO "melhorar" código adjacente
- ❌ NÃO mexer no frontend

---

## VALIDAÇÃO

Após as alterações:

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
   - Feed funciona (pode estar vazio, mas sem erro)

---

## DEFINIÇÃO DE SUCESSO

✅ Página /eventos abre sem erro
✅ Feed social funciona sem erro
✅ Zero migrations novas
✅ Programação defensiva aplicada

---

*Prompt gerado em 29/12/2025*
*Fase: 0B - Programação Defensiva p.visibility*
