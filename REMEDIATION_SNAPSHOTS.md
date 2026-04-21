# REMEDIATION SNAPSHOTS

**Documento append-only. Registro histórico da saúde global do sistema ao longo da remediação.**
**Um snapshot registrado nunca é editado.**

| Metadado | Valor |
|---|---|
| Criado | 2026-04-21 |
| Último snapshot | (nenhum) |
| Base normativa | `SYSTEM_REMEDIATION_PLAN.md` v1.0, Seção 9 (Validação de Estado Global) |

---

## Objetivo deste documento

Garantir **convergência monotônica** do sistema ao longo da remediação.

A cada fase completa, snapshot numérico é registrado. Comparação com snapshot anterior expõe se o sistema está melhorando, estagnando ou regredindo em qualquer dimensão medida.

**Piora em qualquer dimensão sem justificativa registrada em `REMEDIATION_DECISIONS_LOG.md` bloqueia avanço para próxima fase.**

---

## Quando registrar um snapshot

- **Obrigatório:** ao final de cada FASE completa (FASE 0, 1, 2, 3, 4, 5, 6, 7, 8)
- **Obrigatório:** antes de iniciar sessão arquitetural (FASE 6)
- **Recomendado:** após qualquer commit que altere gate, migrations ou >5 arquivos de código
- **Proibido:** registrar snapshot de conveniência ("parece estar bom agora") — apenas quando fase está realmente concluída segundo seu critério de aceitação

---

## Formato obrigatório de cada snapshot

```markdown
## SNAPSHOT após <FASE N / EVENTO> — YYYY-MM-DD

**Commit de referência:** <hash curto>
**Responsável:** <nome>

### Gates
- schema-coherence: <PASS | FAIL>, <N violações>
  - BLOCKER: N
  - CORRUPTOR: M
  - DEBT: K
- actor-writer-boundaries: <PASS | FAIL>
- bank-ledger-boundaries: <PASS | FAIL>
- regression-guards: <PASS | FAIL>
- architectural-patterns: <PASS | FAIL>

### Compilação
- tsc --noEmit: <N erros>

### Gate interno (extração)
- Arquivos .ts varridos: N
- Strings SQL candidatas: X
- Strings SQL válidas: Y
- Rejeitadas: X - Y

### Schema
- Tabelas no banco: N
- Tabelas em migrations: M
- DIFF: <lista>

### Allowlist
- Entradas ativas válidas: N
- Entradas expiradas: M
- Entradas adicionadas desde último snapshot: K
- Entradas removidas desde último snapshot: L

### Seed + E2E
- Seed realista executou completo: <sim | não | n/a>
- Fluxos validados: <lista ou "nenhum">
- Ledger consistente: <sim | não | n/a>
- Erros em E2E: <lista ou "nenhum">

### Status das violações
- Total: 30
- OPEN: N
- IN_PROGRESS: M
- FIXED: K
- ALLOWLISTED: L
- DEFERRED: P
- DECISION_PENDING: Q

### Decisões arquiteturais registradas desde último snapshot
- DECISION-NNNN, DECISION-MMMM, ... (ou "nenhuma")

### Comparação com snapshot anterior
- <métrica X>: <valor anterior> → <valor atual> (<melhor/pior/igual>)
- <métrica Y>: ...

### Análise de convergência
<texto curto: está convergindo? alguma dimensão piorou? se sim, justificativa em DECISION-NNNN>
```

---

## Regras de integridade

- **Ordem cronológica** estrita. Snapshot registrado nunca é reordenado.
- **Commit padronizado:** `"snapshot: FASE <N> concluída"`.
- **Nunca editar snapshot registrado.** Erros de registro: nova entrada com `Corrige SNAPSHOT de YYYY-MM-DD` e justificativa.
- **Piora detectada:** entrada obrigatória em `REMEDIATION_DECISIONS_LOG.md` antes do próximo snapshot.

---

## Registros

*(Nenhum snapshot registrado até 2026-04-21.)*

**Próximo snapshot esperado:** após conclusão da FASE 0 (criação dos 4 arquivos normativos + atualização do `00_AGENT_PROTOCOL.md`).

---

**FIM DO DOCUMENTO** (continua crescendo por append a cada fase)
