# APPEND AO REMEDIATION_SNAPSHOTS.md

Conteúdo consolidado para anexar ao final de `REMEDIATION_SNAPSHOTS.md` no repositório.
Dois snapshots extraordinários: primeiro nível (reconciliação) e segundo nível (auditoria destrutiva).

---

## SNAPSHOT FORENSE 1º NÍVEL — reconciliação documental — 2026-04-22

**Commit de referência:** N/A (snapshot documental, sem commit de código)
**Responsável:** Clayton (arbitragem) · Claude (diretora, auditoria forense primeiro nível)
**Tipo:** SNAPSHOT EXTRAORDINÁRIO — reconciliação forçada

### Motivo

Auditoria forense primeiro nível identificou 6 desvios entre plano e execução:
- D1: C44 FIXED com correção parcial (REOPENED)
- D2: C47 subestimado (HIGH → CRITICAL)
- D3: `schema-coherence` ausente dos snapshots desde FASE 1
- D4: Commit 5b3f2096 violou P2 (234 linhas reconstruídas autonomamente)
- D5: Snapshot C12 quebrou monotonicidade sem declaração formal
- D6: STATUS × snapshot divergiam em contagens

Ver DECISION-0012 para formalização.

### Gates

- schema-coherence: **NÃO EXECUTADO** nesta sessão. Último valor: FASE 1 FAIL (817 violações).
- actor-writer-boundaries: PASS (último documentado)
- bank-ledger-boundaries: PASS
- regression-guards: PASS
- architectural-patterns: PASS (critical_new=0, critical_total=38)

### Status das violações (após reconciliação 1º nível)

| Categoria | Valor |
|---|---|
| Total | 50 |
| OPEN | 26 |
| FIXED | 13 |
| REOPENED | 1 (C44) |
| DECISION_PENDING | 9 |

Severidades:
- CRITICAL: 13 (+1 via elevação de C47)
- HIGH: 22 (−1 via saída de C47)
- MEDIUM: 12

### Decisões arquiteturais

- DECISION-0012 (auditoria forense 1º nível)

### Comparação com snapshot anterior (C46)

- Total: 50 → 50
- OPEN: 28 → 26 (reconciliação de contagem)
- FIXED: 12 → 13 (+1)
- REOPENED: 0 → 1 (C44)
- CRITICAL: 12 → 13 (+C47)

**Análise:** O avanço aparente (+1 FIXED) é cancelado pela reabertura de C44. Sistema não avançou tecnicamente; foi reclassificado para refletir a realidade.

---

## SNAPSHOT FORENSE 2º NÍVEL — auditoria destrutiva — 2026-04-22

**Commit de referência:** N/A (snapshot documental)
**Responsável:** Clayton (arbitragem) · Claude (diretora, auditoria forense segundo nível)
**Tipo:** SNAPSHOT EXTRAORDINÁRIO — estado real pós-descoberta destrutiva

### Motivo

Primeira rodada foi **reprovada** por Clayton como superficial (zero novas violações num sistema com 50 abertas = auditoria rasa). Segunda rodada com mandato destrutivo descobriu:
- 6 novas violações reais (C52-C57)
- 1 FIXED reaberto (C14)
- 5 blind spots de gate confirmados

Ver DECISION-0013 para formalização.

### Gates

- schema-coherence: **NÃO EXECUTADO** nesta sessão (desvio D3 persiste até próxima sessão de código)
- actor-writer-boundaries: PASS (não re-executado, valor último documentado)
- bank-ledger-boundaries: PASS
- regression-guards: PASS
- architectural-patterns: PASS (critical_new=0, mas **descobertos 4 blind spots** — gate não detecta as novas violações C52, C54, C55, C56)

### Blind spots de gate confirmados na auditoria 2º nível

| Gate | O que devia detectar e não detecta |
|------|------------------------------------|
| `architectural-patterns` | Derivação de dinheiro via `metadata->>` + `::numeric` (C56) |
| `architectural-patterns` | Callgraph `bankTransactionService.transfer()` sem `requireFinancialRiskClearance` (C54) |
| `schema-coherence` | FKs ausentes entre tabelas SSOT (C57) |
| `schema-coherence` | Múltiplos writers com contratos divergentes na mesma tabela (C52) |
| Todos | `skip` por dados ausentes vs skip por regra legítima (C55) |

### Compilação

- tsc --noEmit: não re-executado nesta sessão.

### Schema (estado conhecido)

- Tabelas vivas: 206
- Tabelas fantasmas rastreadas: 5 (C31-C35)
- Novas tabelas com FK ausente detectadas: 1 (C57 — `authority_roots`)

### Seed + E2E

- Não executado nesta sessão (auditoria estática destrutiva, sem toque em código).
- Sistema continua vazio: 0 usuários, 0 empresas, 0 fornecedores.
- **Observação crítica:** o estado vazio é EXATAMENTE o vetor de ataque que revelou C55 — `authority-decision.service` fail-open em 3 camadas. Em sistema com dados parciais, alguns `skip` são "legítimos"; em sistema completamente vazio, **todos** os skips disparam. Primeiro usuário real entra num sistema onde autoridade é inoperante até que ATL, KYC e GUARDA sejam populados.

### Status das violações (após auditoria 2º nível)

| Categoria | Valor |
|---|---|
| Total | **56** (+6) |
| OPEN | 31 (+5 — C53, C54, C55, C56, C57) |
| FIXED | 13 |
| REOPENED | 2 (C44, C14) |
| DECISION_PENDING | 10 (+1 — C52) |
| ALLOWLISTED | 0 |
| DEFERRED | 0 |

Severidades:
- CRITICAL: 16 (+3 — C54, C55, C56)
- HIGH: 24 (+2 — C52, C53)
- MEDIUM: 13 (+1 — C57)

### Decisões arquiteturais registradas desde último snapshot

- DECISION-0012 (1º nível)
- DECISION-0013 (2º nível — esta sessão)

### Comparação com snapshot 1º nível

- Total: 50 → **56** (+6, aparente regressão = convergência real, reclassificação honesta)
- OPEN: 26 → 31 (+5)
- FIXED: 13 → 13 (estável)
- REOPENED: 1 → 2 (+C14)
- DECISION_PENDING: 9 → 10 (+C52)
- CRITICAL: 13 → 16 (+3 novas blockers)

### Análise de convergência

**Aparente regressão monotônica** (+6 OPEN, +3 CRITICAL, +1 REOPENED em uma sessão) é **convergência real** conforme DECISION-0012 decisão 6 (reclassificação honesta permitida).

Soma de novas OPEN nesta sessão: 5 (C53, C54, C55, C56, C57). Excede o limite de 2 por sessão estipulado em DECISION-0012 decisão 6.

**Justificativa do excesso:** auditoria destrutiva descobre violações latentes de uma só vez; não há como espaçar. Alternativa seria ocultar metade das descobertas e alongar o ciclo de auditoria — o que violaria P1 (tratar sintoma, não causa) e o princípio de transparência do plano. Esta é uma **exceção declarada**; próximas sessões voltam ao limite de 2.

Operacionalmente o sistema **não piorou** — as violações já existiam. A auditoria documental aproximou do real.

### Observações executivas (diretora)

1. **O sistema não está coerente.** Auditoria destrutiva expôs que 3 violações CRITICAL novas (C54, C55, C56) estavam ativas sem detecção. Gates passavam verde. Documentação declarava FASE 4 avançando.

2. **AUTHORITY_PRECEDENCE.md não é soberano na implementação atual.** C47 (stub TRUE) + C54 (9 bypass) + C55 (fail-open 3 camadas) + C57 (FK ausente) formam **o quadrinho de autoridade** — violação estrutural que invalida o documento soberano.

3. **`bank_ledger` está íntegro.** C1, C3, C4, C8, C26 resistiram ao ataque destrutivo. O núcleo financeiro resistiu, mas a periferia (payment_intents, real-margin, authority gates) tem furos.

4. **Primeira rodada de auditoria foi insuficiente.** Sem falsificação real, zero novas violações foi consequência de método raso. Segunda rodada destrutiva é o que devia ter sido feito desde o início.

5. **Gates atuais são cegos** para os vetores mais críticos (callgraph financeiro, FKs SSOT, múltiplos writers, derivação metadata monetária, skip semântico em autoridade). Sem novos gates, próximas auditorias forenses vão continuar descobrindo violações que os gates deveriam ter pegado.

### Próximas ações obrigatórias (fila)

1. **Decidir C2** (concept_ref nullable/NOT NULL) — 5 minutos com Clayton. Sistema vazio = janela ideal.

2. **Fechar o quadrinho de autoridade em uma sessão única**: C47 + C54 + C55 + C57. Não podem ser fechados separadamente — são faces da mesma violação estrutural.

3. **Decidir C52** — qual writer de `payment_intents` é canônico? Depende de decisão arquitetural (qual módulo é dono do ciclo de pagamento).

4. **Fechar C53** — tratar 6 catches caso a caso (2 remover em compliance, 4 investigar/encapsular em event-handler-failure, 1 formalizar allowlist em observability).

5. **Fechar C44 de verdade** — remover campos mortos de `group.types.ts` e `group.service.ts` + varrer callers.

6. **Decidir C56** — real-margin é decisório (mover para bank_ledger) ou estimado (documentar)?

7. **Implementar 4 novos gates:**
   - Callgraph `transfer()` sem gate
   - FKs entre SSOT
   - Writers múltiplos por tabela
   - Numeric sobre metadata em colunas monetárias

8. **Rodar `schema-coherence` completo** e comparar com baseline FASE 1 (817 violações). Desde FASE 1 esse gate sumiu — precisa voltar.

9. **Só então** gerar snapshot de fechamento de FASE 4 com 5 gates + dados E2E.

### Recomendação da diretora

**Não autorizo abertura da FASE 5, 6 ou 7 até o quadrinho de autoridade fechar.** Plano §10 (prioridade por impacto real) é claro: violação que quebra fluxo crítico vem antes de outras. Autoridade inoperante quebra **todo e qualquer fluxo financeiro** no primeiro cadastro real.

Ordem hierárquica:
1. C2 (decisão)
2. C47 + C54 + C55 + C57 (quadrinho de autoridade)
3. C52 (decisão) e C44 (fix real)
4. C53 (6 catches)
5. C56 (decisão)
6. Implementar 4 novos gates
7. Rodar 5 gates completos
8. Gerar snapshot de fechamento FASE 4
9. Iniciar FASE 5

---

**FIM DO APPEND**
