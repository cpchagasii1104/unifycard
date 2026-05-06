# Runbook — Semântica única de inventário (PROD-7)

**Versão:** 1.2 · **Data:** 2026-04-06  
**Plano:** `EXECUTAR/stand_by_UNIFICARD_PLANO_DEFINITIVO_v2.md` (v2.7) — **PROD-7**, **INFRA-3**, **INFRA-4**  
**Norma ledger (contexto):** `docs/01_normative/INVARIANTES_OPERACIONAIS_LEDGER.md`

Este ficheiro é a **fonte operacional** para semântica de estoque. Runbook apenas em chat **não** cumpre PROD-7.

---

## 1. Fontes de verdade (não redesenhar)

| Artefacto | Papel |
|-----------|--------|
| `inventory_movements` | **SSOT** append-only da posição física (ledger de quantidade). Único writer normado no código. |
| `inventory_reservations` | **Restrição operacional** (soft hold). Estados: `ACTIVE`, `RELEASED`, `CONSUMED`. **Não** substitui movements; comentário de schema: não altera saldo físico diretamente. |
| `inventory_balances` | **Read model** derivado de movements. **Nunca** SSOT. Em conflito: **rebuild**, não “editar saldo como negócio”. |

---

## 2. Definição formal (escolha única — travada)

### 2.1 `inventory_balances.current_quantity` representa **exactamente**:

**Opção única (alinhada ao rebuild actual):** a **quantidade líquida** resultante **somente** de `inventory_movements` no par `(tenant_id, product_variant_id)`, com a fórmula canónica:

```text
on_hand = COALESCE(SUM(
  CASE movement_type
    WHEN 'IN'       THEN quantity
    WHEN 'OUT'      THEN -quantity
    ELSE              quantity   -- ADJUSTMENT
  END
), 0)
```

**Não inclui** nesta coluna a subtracção explícita de reservas `ACTIVE`. As reservas são uma **camada lógica** por cima do on-hand.

### 2.2 `reserved` (por variante, tenant)

```text
reserved_active = COALESCE(SUM(quantity), 0)
  FROM inventory_reservations
  WHERE tenant_id = … AND product_variant_id = … AND status = 'ACTIVE'
```

### 2.3 `available` (para **nova** venda / compromisso)

```text
available = on_hand - reserved_active
```

- **Obrigatório:** qualquer fluxo que reserve ou venda **deve** respeitar `available >= 0` após a operação (ou política explícita de backorder documentada à parte — fora deste runbook se não existir produto).
- `available` **não** é persistido em `inventory_balances` nesta versão do runbook (cálculo derivado em serviço ou SQL de leitura).

---

## 3. Duas camadas de verificação (PROD-7)

### 3.1 Drift-1 — integridade do read model (INFRA-3)

**Pergunta:** o que está gravado em `inventory_balances` bate certo com o SSOT?

```text
Drift-1 ⇔ inventory_balances.current_quantity ≠ on_hand
```

- **Artefactos versionados:**  
  - `backend/scripts/sql/inventory_balances_drift_vs_movements.sql`  
  - `backend/src/scripts/rebuild-inventory-balances.ts` (e wrapper `backend/scripts/rebuild-inventory-balances.ts`)
- **Acção:** divergência ⇒ **erro sistémico** ⇒ **rebuild** obrigatório (`npx tsx scripts/rebuild-inventory-balances.ts` com `--tenant_id=` se aplicável).

### 3.2 Drift-2 — invariante semântica movements × reservas (PROD-7)

**Pergunta:** há mais stock “comprometido” em reservas ACTIVE do que existe em on-hand?

```text
Violação ⇔ reserved_active > on_hand
```

Isto **não** é “balance ≠ SUM(movements)”. É **função explícita** de movements **e** reservas ACTIVE.

- **Artefacto versionado:** `backend/scripts/sql/inventory_reserved_exceeds_onhand.sql`
- **Acção:** qualquer linha devolvida ⇒ **erro de negócio / consistência** ⇒ investigar fluxos (checkout, saga, timeout, liberação de reserva) **antes** de confiar em relatórios ou em novas vendas.

**Regra:** enquanto PROD-7 estiver em fecho, **não** considerar inventário “saudável” sem **Drift-1 e Drift-2** limpos (ou excepções registadas com owner e prazo).

### 3.3 Enforcement em runtime — impedir `reserved_active > on_hand`

**Drift-2 detecta** violações já persistidas. **Obrigação de produto:** novos compromissos **não** devem ser aceites se `available < quantidade_pedida`.

**Ordem obrigatória dentro da transação** (mesmo `PoolClient`; **não** reordenar sem RFC + actualização deste runbook — caso contrário **race** e Drift-2 voltam a ser possíveis):

1. **Lock da variante** — `SELECT … FROM product_variants … FOR UPDATE` (serialização por `(tenant_id, product_variant_id)`).
2. **Calcular `on_hand`** — soma canónica sobre `inventory_movements` na **mesma** conexão (`balanceOnClient`); **nunca** `inventory_balances` para decisão.
3. **Calcular `reserved_active`** — soma sobre `inventory_reservations` com `ACTIVE` (e regras de expiração do produto) na **mesma** conexão (`reservedQuantityOnClient`).
4. **Validar disponibilidade** — `available = on_hand - reserved_active`; se `available < quantidade_pedida` ⇒ erro explícito (**não** avançar para o passo 5).
5. **Inserir reserva** — `INSERT` em `inventory_reservations` com `ACTIVE` só após o passo 4 passar.

**Referência de implementação:** `backend/src/modules/marketplace/inventory-reservation.service.ts` — `reserveStockWithinTransaction` (passos 1–5 acima).

**Regras normativas:**

- **Proibido** introduzir novo caminho que faça `INSERT` de reserva `ACTIVE` **sem** equivalente aos passos **1–5** na mesma transação ou política documentada (ex.: fila serializada única).
- Qualquer fluxo alternativo (PDV, B2B, saga) **deve** reutilizar este serviço ou **duplicar a mesma semântica** e referenciar este runbook num comentário ou RFC.
- **Não** usar `UPDATE inventory_balances` para “subtrair disponível”: saldo derivado continua a ser reconstruído a partir de movements; a reserva é **linha em `inventory_reservations`**, não ajuste de coluna de balance.

Se Drift-2 acusar linhas **apesar** disto: investigar reservas criadas por **caminho legado**, corrida fora de `FOR UPDATE`, **ordem dos passos 1–5 violada**, ou `on_hand` alterado **após** reserva sem libertação (bug de ordem de operações).

---

## 4. Fórmula canónica única (resumo)

| Grandeza | Fórmula |
|----------|---------|
| `on_hand` | Soma canónica de `inventory_movements` (§2.1) |
| `reserved_active` | Soma `inventory_reservations.quantity` com `status = 'ACTIVE'` |
| `available` | `on_hand - reserved_active` |
| `inventory_balances.current_quantity` | **Deve** igualar `on_hand` após rebuild |

**Proibido:** duplicar estas fórmulas com semântica diferente em serviços paralelos sem atualizar **este** runbook e o plano.

---

## 5. SQL / comandos versionados (checklist)

| O quê | Onde |
|-------|------|
| Drift balance vs movements | `backend/scripts/sql/inventory_balances_drift_vs_movements.sql` |
| Invariante reserva > on-hand | `backend/scripts/sql/inventory_reserved_exceeds_onhand.sql` |
| Rebuild completo balances | `cd backend && npx tsx scripts/rebuild-inventory-balances.ts` |
| Só drift (JSON) | `… --drift-only` (opcional `--tenant_id=<uuid>`) |

---

## 6. Coerência INFRA-4 (saga / timeout / pagamento)

O runbook **não** implementa saga; exige **alinhamento** quando INFRA-4 existir:

- **Falha de pagamento / timeout:** transição de reservas `ACTIVE` → `RELEASED` (ou `CONSUMED` quando houver movimento OUT correspondente) **deve** ser **idempotente** e auditável.
- **Impacto no saldo:** libertar reserva **não** remove automaticamente `on_hand`; apenas reduz `reserved_active`. Movimentos OUT (ou consumo explícito) alteram `on_hand` conforme regras de fulfillment.
- **Anti-loop:** handlers que reagem a eventos devem ler estado actual da saga/outbox antes de re-reservar (ver plano v2.7 — outbox + saga).

---

## 7. Provas obrigatórias (aceite de PROD-7)

Antes de liberar execução além deste runbook, deve existir **suíte reproduzível** (testes integração ou scripts documentados) que cubra:

1. **Feliz:** reserva → pagamento → consumo coerente com `on_hand` e reservas.  
2. **Concorrência:** duas reservas competindo pelo último stock — uma falha ou serializa conforme política.  
3. **Falha de pagamento:** reserva libertada; `available` recupera; sem Drift-2 residual.  
4. **Timeout de saga:** idem, sem dupla libertação que corrompa estado.  
5. **Rebuild:** após rebuild, Drift-1 = 0 para o tenant de teste.

**Execução (suíte §7):** com `DATABASE_URL` e migrations aplicadas (e ≥1 linha em `categories`):

```bash
cd backend && pnpm test:integration:prod7-inventory
```

Ficheiro: `backend/tests/integration/inventory-semantics-prod7.integration.test.ts` — cobre os 5 cenários com **PASS/FAIL**; Drift-1 via `compareBalancesVsMovements`; Drift-2 via SQL alinhado a `backend/scripts/sql/inventory_reserved_exceeds_onhand.sql`. O cenário **timeout de saga** simula compensação com `releaseReservation` até INFRA-4 fechar saga completa. Concorrência usa **variante dedicada** com um único movimento `IN` (movements são append-only no produto; o teardown de teste desliga triggers só para limpar o tenant de teste).

**Critério:** os **mesmos** números (`on_hand`, `reserved_active`, `available`) alinhados às definições §2 em todos os cenários.

---

## 8. Bloqueio de execução (regra do plano)

Enquanto **PROD-7** não estiver **validado** com:

- este runbook **commitado**,
- SQL de Drift-1 **e** Drift-2 **referenciados**,
- provas §7 **a verde** (ou lista explícita de gaps com owner),

**é proibido** avançar G1–G4, checkout, saga ou nova lógica de estoque sem RFC que actualize **este** documento e o `EXECUTAR/stand_by_UNIFICARD_PLANO_DEFINITIVO_v2.md`.

---

## Frase final

**Sem semântica única de inventário (movements + reservas ACTIVE + balances derivado), não existe sistema operacional de stock — só estruturas que divergem em silêncio.**
