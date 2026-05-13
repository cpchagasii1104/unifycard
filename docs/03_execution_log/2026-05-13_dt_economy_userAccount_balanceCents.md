# Frente 4 — Convergência §4.7 em api/economy.ts (UserAccount.balance → balanceCents)

**Data:** 2026-05-13
**Modo:** EXECUTOR autônomo (série mecânica autorizada por Clayton — "piloto automático")
**Branch:** `rescue-structural`
**Commit anterior:** `9d602d8c` (housekeeping pós-F2)
**Frente 3 (regional-fund-governance) cancelada** após investigação material — ver seção "Pivot honesto" abaixo

---

## Pivot honesto — Frente 3 (regional-fund-governance.service.ts) cancelada

Proposta inicial: renomear 12 `amount: string` em interfaces inline → `amountCents: string`. Investigação material revelou que **NÃO é drift §4.7 real**:

- Os 12 shapes inline são **fiéis ao schema do DB** (coluna se chama literalmente `amount`)
- O método `toProposal(row)` na linha 1090 **JÁ converte corretamente** via `integerCentsFromDbWire(row.amount, 'proposal.amount')` → `amountCents` no domain object exposto
- Domain layer (Proposal interface) é canônico: `amountCents: number`
- Renomear inline sem migration seria **mentir no tipo** (pg retorna coluna `amount`, não `amountCents`)

Para convergência §4.7 real exigiria migration `RENAME COLUMN amount → amount_cents` — categoria DDL produção (fronteira "paro e consulto" — precedente C38 sempre autorizado explicitamente).

**Decisão:** cancelar Frente 3 mecânica + registrar pendência em log para varredura sistemática futura de schemas com `amount` literal.

## Frente 4 — escopo material confirmado

### Diagnóstico

| Camada | Estado |
|---|---|
| **Backend** `account.types.ts` `Account.balanceCents: number` | ✅ Conforme §4.7 |
| **Backend** `/economy/accounts/me` retorna `{ accountId, balanceCents, currency, status }` | ✅ Conforme §4.7 |
| **Frontend** `api/economy.ts` `UserAccount.balance: number` | ❌ Drift |
| **Consumer** `SocialFeed2.tsx:707` `safeNumber(myAccount.balance, 0) / 100` | ❌ Bug "sempre zero" — backend manda `balanceCents` mas frontend lê `.balance` (undefined) |

### Bug runtime confirmado

`SocialFeed2` exibia "R$ 0,00" no widget de saldo lateral porque `myAccount.balance` era `undefined` (campo não existe no payload backend). `safeNumber(undefined, 0)` → 0 → "R$ 0,00" sempre. Análogo direto ao bug "sempre zero" do `HeaderGlobal` antes da F1.

## Edits aplicados (2 arquivos)

### `frontend/src/api/economy.ts`

```typescript
export interface UserAccount {
  accountId: string;
- balance: number;
+ balanceCents: number;
  currency: string;
  status: 'active' | 'inactive' | 'suspended';
}
```

+ Comentário institucional referenciando §4.7 + alinhamento com backend.

### `frontend/src/components/social/SocialFeed2.tsx`

```typescript
// import adicionado
+ import { centsToReais } from '../../utils/money';

// linha 707
- }).format(safeNumber(myAccount.balance, 0) / 100)}
+ }).format(centsToReais(safeNumber(myAccount.balanceCents, 0)))}
```

Mantém defesa contra undefined (`safeNumber`) + usa helper canônico `centsToReais` em vez de divisão manual `/100` (consistência com F1).

## Verificação

- TSC frontend: 0 erros
- 4 gates institucionais: 4/4 PASS (backend não tocado, baseline preservado)

## Padrão F1 reaplicado (terceira vez na sessão)

| Aplicação | Caso | Bug eliminado |
|---|---|---|
| F1 | api/transparency.ts (`amount`/`balanceAfter`/`currentBalance`) → `*Cents` | Bug 100x em 10 telas |
| F4 (esta) | api/economy.ts (`balance`) → `balanceCents` | Bug "sempre zero" em SocialFeed2 widget |

Heurística "rename de tipo + TSC enumera consumers" confirmada novamente — TSC localizou exatamente 1 consumer (`SocialFeed2.tsx:707`).

## Anti-padrões fechados

- §4.7 violation no frontend `api/economy.ts`
- Bug "sempre zero" em SocialFeed2 widget de saldo lateral

## Anti-padrões evitados

- Tocar Frente 3 (regional-fund-governance) sem trabalho mecânico real — cancelada honestamente
- Tocar `api/checkout.ts` (próximo candidato listado) — importa de `@unificard/contracts` (CheckoutResult); mexer em contracts compartilhado é fronteira

## Pendências preservadas

- **Schema rename `regional_fund_proposals.amount → amount_cents`** (e possivelmente outras tabelas com mesmo padrão): varredura sistemática + migrations análogas a C38 — sessão dedicada futura, autorização explícita necessária
- **`api/checkout.ts`** (`price`, `unitPrice`, `totalAmount` sem `_cents`): mexer em `@unificard/contracts` (CheckoutResult); fronteira contracts compartilhado
- **`api/marketplace.ts`, `api/ledger.ts`**: próximos candidatos a investigar (Frente 5 potencial)

## Aderência ao protocolo

- ✅ Modo EXECUTOR declarado (autorização explícita "piloto automático")
- ✅ §2.2.2 prova de rastreabilidade
- ✅ Verificação prévia do shape backend antes de tocar frontend
- ✅ Pivot honesto na Frente 3 (descoberta material muda cenário → reportei + cancelei)
- ✅ TSC validado pós-edits
- ✅ 4 gates institucionais PASS
- ✅ §4.7 (norma) vencendo
- ✅ §29 (git add específico)
- ✅ §7 — log institucional criado (este arquivo)
- ✅ §10 — não tocou norma
- ✅ §30 (code.md) — heurística "rename de tipo + TSC enumera consumers" reaplicada (terceira vez)
- ✅ Calibração 2026-05-13 — autonomia operacional dentro de fronteiras claras

---

**FIM DO LOG. Bug "sempre zero" em SocialFeed2 widget eliminado. Frente 3 cancelada honestamente. Próximo passo da série: avaliar Frente 5 (api/marketplace, api/ledger).**
