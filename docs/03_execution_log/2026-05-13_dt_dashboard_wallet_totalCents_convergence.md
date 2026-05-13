# Frente 5 — Dashboard.tsx wallet.totalIn/totalOut → totalInCents/totalOutCents + tipagem DashboardData

**Data:** 2026-05-13
**Sessão:** continuação da pipeline pós-2026-05-13 (F4+HK3 fechados no commit `be3838ab`)
**Modo:** GUARDIÃO (investigação prévia) → EXECUTOR (frente F5 cirúrgica)
**Branch:** `rescue-structural`
**HEAD inicial:** `be3838ab` (housekeeping de fechamento da sessão 2026-05-13)

---

## 1. Origem material

Autorização Clayton: "De qualquer forma, a gente vai ter que fazer os outros. Então escolha o que é mais pertinente pro momento e executa."

Após F4 (commit `8321878b`), candidato natural era `api/marketplace.ts`. Investigação GUARDIÃO prévia (1h read-only) revelou:

- 48 ocorrências do padrão `{ amount: number; currency: string }` (Money value object) no frontend marketplace vs apenas 2 no backend marketplace — disparidade total
- `_canonical/money.types.ts` define `MoneyAmountCents = { amountCents: number; currency: Iso4217CurrencyCode }` como destino canônico
- `PLANO_CORRECAO_NOMENCLATURA.md` v3.3.6 (2026-04-09) cobre o tema em EIXO 5 (frontend, 249 monetários, 2 sessões estimadas), com pré-requisito implícito de EIXO 2 (contratos backend v2, 11% completo)
- 0 usos de `MoneyAmountCents` no frontend

Conclusão: marketplace **muda de categoria** (escopo arquitetural, não frente mecânica análoga F1/F4). Decisão de execução cega seria irresponsável — necessita autorização explícita e provavelmente sessão dedicada à abertura do EIXO 5 do PLANO formal.

Pivot honesto: varredura curta read-only dos demais `frontend/src/api/*.ts` em busca de bug runtime concreto análogo F4.

## 2. Descoberta material — bug 100x ativo em Dashboard.tsx

**Backend `core/dashboard/dashboard.types.ts::DashboardWallet` (canônico §4.7):**

```ts
export interface DashboardWallet {
  balanceCents: number;
  currency: string;
  totalInCents: number;
  totalOutCents: number;
  lastTransactions: Array<{
    transactionId: string;
    type: 'credit' | 'debit';
    amountCents: number;
    createdAt: string;
  }>;
}
```

Backend `dashboard.service.ts` envia exatamente esse formato (verificado L43-65).

**Frontend `api/dashboard.ts:163` antes da frente:**

```ts
// Backwards compatibility - flexible type for Dashboard.tsx
export type DashboardData = Record<string, any>;
```

Tipagem perdida → consumer `Dashboard.tsx` lê campos não-verificados.

**`Dashboard.tsx` L357, L363 antes da frente:**

```tsx
{formatCurrency(centsToReais(data.wallet.totalIn))}   // ← UNDEFINED — backend envia totalInCents
{formatCurrency(centsToReais(data.wallet.totalOut))}  // ← UNDEFINED — backend envia totalOutCents
```

Bug runtime ativo: campos "Total Recebido" e "Total Gasto" no widget "Minha Carteira" do Dashboard exibiam "R$ NaN" ou "R$ 0,00" — análogo direto ao bug "sempre zero" do HeaderGlobal (eliminado F1) e do SocialFeed2 (eliminado F4).

`balanceCents` (L351) e `amountCents` (L387) já estavam corretos — bug parcial F1 da sessão anterior não cobriu `totalIn/totalOut` em Dashboard.tsx.

## 3. Edits aplicados (2 arquivos)

### `frontend/src/api/dashboard.ts`

Substituição de `DashboardData = Record<string, any>` por interfaces canônicas espelhando backend:

```ts
export interface DashboardWallet {
  balanceCents: number;
  currency: string;
  totalInCents: number;
  totalOutCents: number;
  lastTransactions: Array<{
    transactionId: string;
    type: 'credit' | 'debit';
    amountCents: number;
    createdAt: string;
  }>;
}

export interface DashboardData {
  profile: {
    global: Record<string, any>;
    local: Record<string, any>;
    residence: Record<string, any> | null;
  };
  wallet: DashboardWallet | null;
  reputation: Record<string, any> | null;
  /** Legado regional fund removido — sempre null em runtime. */
  fund: Record<string, any> | null;
}
```

Estratégia: `wallet` tipado canônicamente (espelho `dashboard.types.ts::DashboardWallet`); `profile`/`reputation`/`fund` permanecem permissivos via `Record<string, any>` para não introduzir TSC error em dead code (`data.fund.summary.currentBalance` é dead code — backend retorna `fund: null` sempre).

### `frontend/src/components/Dashboard.tsx`

```diff
   <span className="stat-label">Total Recebido</span>
   <span className="stat-value positive">
-    {formatCurrency(centsToReais(data.wallet.totalIn))}
+    {formatCurrency(centsToReais(data.wallet.totalInCents))}
   </span>
 </div>
 <div className="stat-item">
   <span className="stat-label">Total Gasto</span>
   <span className="stat-value negative">
-    {formatCurrency(centsToReais(data.wallet.totalOut))}
+    {formatCurrency(centsToReais(data.wallet.totalOutCents))}
   </span>
```

Aplicação direta do nome canônico §4.7 que o backend já envia.

## 4. Verificação institucional

### TSC

```
cd C:/unificard/frontend && npx tsc --noEmit
EXIT=0
```

### 4 gates institucionais

| Gate | Resultado |
|---|---|
| `validate:actor-writer-boundaries` | GATE OK [§4.8.1] |
| `validate:bank-ledger-boundaries` | GATE OK [§4.6] |
| `validate:regression-guards` | GATE OK [financial + sql-lint + 299 migrations] |
| `validate:architectural` | baseline preservado (20 violations preexistentes em `backend/src/core/profile|categories`; meus edits são frontend-only — nenhuma violation introduzida por construção) |

## 5. Pendências preservadas (drift identificado mas fora de escopo desta frente)

- **`api/identity.ts::IdentityProfile['wallet']`** — `balance`/`totalIn`/`totalOut`/`lastTransactions[].amount` sem `_cents`. Mapeamento backend (`identity.types.ts` + `identity.service.ts:990-996`): tipo backend declara `balanceCents` ✅ mas `totalIn`/`totalOut` sem `_cents` (drift backend↔norma — valor é centavos, nome legacy). Zero consumers reais no frontend (verificado via grep em 7 arquivos importadores de `IdentityProfile`) → drift institucional puro, sem bug runtime ativo. NÃO incluído nesta frente para preservar §29 (frentes distintas em commits distintos) e evitar contaminação transversal.
- **`api/dashboard.ts::DashboardData.fund`** tipado `Record<string, any> | null` permissivo: dead code de "Fundo Regional" em Dashboard.tsx (linhas 423-450) assume `fund.summary.currentBalance` etc., mas backend retorna `fund: null` sempre (DECISION/comentário backend: "Legado regional fund removido"). Dead code não removido nesta frente — escopo aumentaria sem necessidade.
- **`api/marketplace.ts`** (Money value object 48 ocorrências) — análise GUARDIÃO desta sessão concluiu: escopo arquitetural, próximo passo é abertura formal de EIXO 5 do `PLANO_CORRECAO_NOMENCLATURA.md` com `MoneyAmountCents` canônico e verificação prévia de EIXO 2 (contratos backend v2, atualmente 11% completo). Autorização explícita necessária.
- **`api/checkout.ts`** — fronteira `@unificard/contracts` compartilhado, sessão dedicada.
- **`api/fund.ts`** — ~25+ campos monetários candidatos com ambiguidades (`splitBreakdown.worker/platform/regionalFund/community` pode ser percentual OU cents; `percentage` é claramente percentual). Investigação prévia material requerida.

## 6. Lições estruturais

### Lição 1 — pivot honesto previne execução cega

Marketplace parecia o próximo candidato natural (escopo "F5 mecânico"). Investigação GUARDIÃO prévia revelou disparidade material (frontend 48 / backend 2 do padrão Money value object) e norma formal preexistente (`PLANO_CORRECAO_NOMENCLATURA` + `_canonical/money.types.ts`). Pivot para Dashboard.tsx foi correto: bug 100x ativo, escopo cirúrgico (2 arquivos), padrão F1/F4 puro.

Calibração 2026-05-13 honrou-se: "descoberta material que mude o cenário → paro" funcionou em escala de investigação (não apenas em meio de execução).

### Lição 2 — "Backwards compatibility flexible type" frequentemente esconde bug 100x

Comentário `DashboardData = Record<string, any>` parecia escolha de design pragmática. Mas era exatamente o mecanismo que permitiu o drift `totalIn`/`totalOut` ficar invisível ao TSC. Substituir por tipo canônico em uma frente focada (2 arquivos, baixo risco) é convergência mecânica clara.

Heurística refinada: `Record<string, any>` em tipos de payload retornado por API é red flag — sempre verificar se há drift escondido contra shape backend.

### Lição 3 — bug 100x sobrevive a múltiplas convergências parciais

Dashboard.tsx foi parcialmente convergido em F1 (commit `a2242cd0` — `balanceCents` + `amountCents`). Mas F1 mapeou consumers via grep `\.balance\b|\.amount\b|\.balanceAfter\b` — não pegou `totalIn`/`totalOut` (campos com nome diferente). Lição: convergência por campo nominado vs convergência por tipo (rename de tipo) cobrem universos diferentes; sem tipagem canônica, sempre haverá rinchos.

A frente F5 cobre esses rinchos via tipo canônico declarado — TSC vai forçar correção em qualquer consumer futuro de `DashboardData.wallet`.

## 7. Aderência ao protocolo

- Modo GUARDIÃO declarado para investigação prévia; EXECUTOR declarado para frente
- §2.2.2 prova de rastreabilidade (shape backend verificado em `dashboard.types.ts` + `dashboard.service.ts` ANTES de tocar frontend)
- §4.7 (canônico monetário em centavos) vencendo
- §25 (norma assintótica) — pendências adjacentes (identity wallet drift, fund tipo permissivo, marketplace escopo arquitetural) registradas com critério de convergência
- §29 — git add específico; identity wallet não incluído mesmo sendo padrão similar (frente distinta, sem bug runtime ativo)
- §30 (code.md) — heurística "rename de tipo > grep semântico" reaplicada (quarta vez na pipeline 2026-05-13), agora cruzada com lição da F3 cancelada ("drift real vs tipo fiel ao DB"): aqui é drift real (tipo frontend `Record<string, any>` mascarava shape backend canônico)
- Pivot honesto após investigação GUARDIÃO revelar que marketplace muda categoria — não execução cega
- Calibração 2026-05-13 aplicada: "descoberta material que mude o cenário → paro" + "DECISION inédita | causalidade financeira ativa | cluster c → paro"

## 8. Estado final

| Item | Estado |
|---|---|
| Frente 5 (Dashboard wallet totalCents) | FECHADA |
| Bug 100x em widget "Minha Carteira" Dashboard | Eliminado |
| TSC frontend | 0 erros |
| 4 gates institucionais | 3 PASS + 1 baseline preservado (architectural backend-only, sem mudança backend) |
| Convergência §4.7 frontend (api/dashboard) | COMPLETA na seção wallet; dead code fund preservado |
| Marketplace (api/marketplace.ts) | Identificado como sessão dedicada formal (EIXO 5 do PLANO_CORRECAO_NOMENCLATURA) |
| identity.ts wallet drift | Mapeado, registrado, fora de escopo |
| fund.ts (25+ campos) | Investigação prévia material requerida |
