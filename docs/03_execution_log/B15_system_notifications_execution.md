# B.15 — system-notifications (execução)

**Data:** 2026-03-01  
**Escopo:** `src/modules/system-notifications/**`  
**Baseline:** 1347 (condição ≤ 1347).

---

## Snapshot inicial (ASK)

| Código  | Qtde |
|---------|------|
| TS18048 | 1    |
| TS2339  | 1    |
| TS7006  | 1    |
| TS2353  | 1    |
| TS2367  | 1    |
| **Total** | **5** |

Arquivos: `system-notification.repository.ts` (4), `system-notification.routes.ts` (1).

---

## Relatório por sub-bloco

| Sub-bloco | Arquivos | Erros corrigidos | TS antes | TS depois | Rollback? |
|-----------|----------|------------------|----------|-----------|-----------|
| A | system-notification.repository.ts | 3 (TS18048, TS2339, TS7006) | 1347 | 1343 | Não |
| B | system-notification.repository.ts | 1 (TS2353) | 1343 | 1343 | Não |
| C | system-notification.routes.ts | 1 (TS2367) | 1343 | 1342 | Não |

*(A e B aplicados no mesmo arquivo; TSC rodado após A+B e após C.)*

---

## Alterações realizadas

- **A:** Uso de `runQueriesWithTenant<SystemNotificationRow>` na listagem (array); `rows.map((row: SystemNotificationRow) => ...)`; sem cast, sem any.
- **B:** Retorno com `totalCents: total` em vez de `total`, conforme tipo do contrato.
- **C:** `unreadOnly` com narrowing: `req.query.unreadOnly === true || (typeof req.query.unreadOnly === 'string' && req.query.unreadOnly === 'true')`.

---

## Commits

1. `system-notifications: fix rows typing and totalCents (TS18048/2339/7006/2353)`
2. `system-notifications: fix unreadOnly comparison (TS2367)`

---

## Validação final

- **TSC projeto:** 1342  
- **Condição:** 1342 ≤ 1347 ✅  
- **Erros em `system-notifications/**`:** 0 ✅  

**B.15 — FECHADO.**
