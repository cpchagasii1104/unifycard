# Diagnóstico: Singletons Criados no Import

## Problema Identificado

Há **90+ singletons** sendo criados no nível do módulo (no import).

O mais crítico é o **`pool` do banco de dados** que é criado em `backend/src/core/database/pool.ts`:

```ts
export const pool = new Pool({...});
```

Isso executa código **síncrono** no import, o que pode travar se:
- A conexão com o banco não estiver disponível
- As variáveis de ambiente estiverem faltando
- O Pool do PostgreSQL estiver tentando conectar imediatamente

## Solução Recomendada

O `pool` deveria ser criado **lazy** (só quando necessário), não no import.

## Próximo Passo

Comentar temporariamente a criação do pool no import e criar ele lazy.


























