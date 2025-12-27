# Regras de Governança — Unificard

## 1. Aliases de Rota
- **NÃO remover aliases** sem antes:
  - Confirmar que o frontend não usa mais
  - Ter teste/curl validando a remoção

## 2. Queries SQL com Parâmetros Opcionais
- **sanitizeParams(undefined->null)** é seguro para PostgreSQL
- **NO ENTANTO**: novas queries com filtros opcionais precisam tratar NULL corretamente no SQL
- **Exemplo**: `WHERE x = $1` precisa ser `WHERE ($1 IS NULL OR x = $1)` se $1 pode ser NULL
- **Sempre revisar impacto semântico** em:
  - WHERE clauses
  - Intervalos de data
  - Filtros condicionais
- **Evitar "dado zerado" silenciosamente** (NULL pode alterar resultado da query)

## 3. Novos Endpoints
- Devem retornar payload de erro compatível com:
  - `{ message: string }` OU `{ error: string }`
- Frontend lê ambos os formatos

## 4. Autenticação e Autorização
- **401** = token inválido/expirado
- **403** = permissão/tenant
- **NÃO misturar novamente**

## 5. Ambiente
- **Produção NÃO deve logar SQL detalhado** (values podem conter dados sensíveis)
- **VITE_API_BASE_URL sempre obrigatório** (sem fallback hardcoded em produção)

## Princípio Orientador
```
Estabilidade > Velocidade > Refatoração estética
```
















