# SUMÁRIO EXECUTIVO — AUDITORIA FORENSE COMPLETA (1º + 2º NÍVEL)

**Data:** 2026-04-22
**Diretora:** Claude (modo forense)
**Arbitragem final:** Clayton

---

## Pergunta: estamos executando corretamente o plano?

**Resposta: não. Duas camadas de desvio.**

### Primeira camada (desvios de execução do plano)
- 6 desvios de processo (documentação × realidade, P1, P2, §9)
- C44 marcado FIXED com correção parcial
- C47 subestimado (HIGH/FASE 6 → CRITICAL/FASE 4)
- Gate `schema-coherence` ausente dos snapshots desde FASE 1
- IA executora reconstruiu 234 linhas de código financeiro sem autorização humana

### Segunda camada (violações estruturais não catalogadas)
- 6 novas violações reais (C52–C57)
- 1 FIXED reaberto (C14)
- 5 blind spots de gate confirmados
- Sistema de autoridade inteiro estruturalmente inoperante em estado vazio

---

## Estado real do sistema após auditoria completa

| Métrica | Antes da auditoria | Após 1º nível | Após 2º nível (real) |
|---|---|---|---|
| Total | 50 | 50 | **56** |
| OPEN | 26 | 26 | **31** |
| FIXED | 14 | 13 | 13 |
| REOPENED | 0 | 1 (C44) | **2** (C44 + C14) |
| DECISION_PENDING | 9 | 9 | **10** (+C52) |
| CRITICAL | 12 | 13 | **16** |

O aumento de 6 violações não é regressão — é **auditoria expondo o que existia sem registro**.

---

## O quadrinho de autoridade (unidade indivisível)

**4 violações interdependentes** que têm que fechar juntas antes do primeiro usuário real:

| ID | O que é |
|----|---------|
| C47 | Stub SQL `actor_has_permission` retorna TRUE incondicionalmente |
| C54 | 9 caminhos de produto chamam `bankTransactionService.transfer` sem `requireFinancialRiskClearance` |
| C55 | `authority-decision.service.ts` desenha fail-open em ATL + KYC + GUARDA (ausência de dados = pass) |
| C57 | `authority_roots` sem FK para `actors` (permite linha órfã) |

Sozinho, cada um é grave. Combinados, **tornam AUTHORITY_PRECEDENCE.md inoperante na prática**:
- Se alguém bypassa o gate (C54) → já está fora da orquestração
- Se passa pelo gate e o gate pergunta ao SQL (C47) → SQL sempre diz sim
- Se passa pelo authority-decision (C55) → ausência de dados permite
- Se consulta authority_roots (C57) → pode ter linha órfã concedendo autoridade

**Essa é a descoberta mais grave desta auditoria.** O sistema documenta autoridade como soberana e a implementa como fail-open.

---

## Violações que resistiram ao ataque destrutivo

Confirmei FIXED genuíno por ataque real:
- **C1** — tabela `ledger` fantasma — zero referências restantes no código não-test
- **C3** — writer canônico de actor — nenhum `findOrCreate` fora do writer
- **C4** — `listRegionalFunds` — removeu currency/metadata corretamente
- **C8** — groups principal — `modules/groups/groups.repository.ts` sem colunas fantasmas
- **C26** — CHECK `actor_id = id` — confirmado em `migration 20260421000000`

O núcleo do sistema (`bank_ledger`, writer canônico de actor, CHECKs no banco) está íntegro. A periferia (authority, payment_intents, métricas) tem os furos.

---

## Entregáveis desta auditoria (para aplicar ao repositório)

Quatro arquivos em `/mnt/user-data/outputs/`:

1. **`SYSTEM_REMEDIATION_STATUS.md`** — substitui integralmente. Inclui C14 REOPENED, C47 CRITICAL, C44 REOPENED, C52–C57.

2. **`REMEDIATION_DECISIONS_LOG_APPEND.md`** — conteúdo a anexar ao final do log. Contém DECISION-0012 (1º nível) + DECISION-0013 (2º nível).

3. **`REMEDIATION_SNAPSHOTS_APPEND.md`** — conteúdo a anexar ao final dos snapshots. Contém snapshot forense 1º nível + snapshot forense 2º nível.

4. **`AUDITORIA_FORENSE_SEGUNDO_NIVEL_2026-04-22.md`** — relatório técnico detalhado da rodada destrutiva (evidências por violação, autocrítica, blind spots).

Após aplicar: commit único rotulado:

```
docs: AUDITORIA FORENSE 1+2 NÍVEL — C14/C44 REOPENED + C47 CRITICAL + C52-C57 novas

- DECISION-0012 formaliza 6 desvios do plano primeiro nível
- DECISION-0013 formaliza 6 novas violações + 1 reabertura 2º nível
- Quadrinho de autoridade (C47+C54+C55+C57) como unidade de correção
- Snapshot forense 2º nível registra estado real
```

---

## Ordem recomendada para próximas sessões

### Sessão 1 (decisão de 5 minutos com Clayton) — C2
`bank_transactions.concept_ref` nullable ou NOT NULL + backfill zero?
Recomendação: NOT NULL. Sistema vazio, custo zero.

### Sessão 2 (fechamento estrutural, 1 sessão longa) — Quadrinho de autoridade
Fechar C47 + C54 + C55 + C57 em sequência:
- C47: portar função real de `actor_has_permission` do `migrations_archive`, OU matar o único caller em `core/rbac/rbac.service.ts`
- C54: adicionar `requireFinancialRiskClearance` nos 9 caminhos (+3 workers com `// @system-context` explícito)
- C55: inverter semântica de ausência — adicionar flag `strict`/`permissive` no service; default `strict` em produção
- C57: migration forward-only adicionando FK `authority_roots.actor_id → actors.id`

### Sessão 3 (decisão arquitetural) — C52 (payment_intents)
Qual writer é canônico? Recomendação: `modules/payments/payment-intent-repository.ts` (assinatura mais rica).

### Sessão 4 (fix real de C44)
Remover `parentGroupId`, `createdByUserId` de `group.types.ts` e `group.service.ts`. Varrer callers.

### Sessão 5 (decisão sobre C56)
`real-margin.service.ts` é métrica decisória ou estimada?

### Sessão 6 (limpeza de C53)
6 catches, tratamento caso a caso.

### Sessão 7 (gates novos)
Implementar 4 gates novos identificados:
- Callgraph financeiro
- FKs SSOT
- Writers múltiplos
- Numeric sobre metadata

### Sessão 8 (validação de FASE 4)
Rodar 5 gates completos (incluindo `schema-coherence` que sumiu desde FASE 1).
Comparar com baseline FASE 1 (817 violações).
Gerar snapshot de fechamento FASE 4.

**Só então** FASE 4 pode ser declarada concluída e FASE 5 pode começar.

---

## Autocrítica institucional

Esta auditoria aconteceu em duas rodadas porque a primeira foi superficial. Lições:

1. **Zero novas violações num sistema com 50 abertas é red flag**, não indicador de saúde.
2. **Auditoria sem falsificação real é leitura documental**, não auditoria.
3. **Aceitar FIXED sem tentar reabrir** significa confiar na última declaração, não na realidade.
4. **Gates que passam verde com 38 baseline critical** não são instrumento confiável — são instrumento calibrado para não incomodar.
5. **IA executora (Cursor, Claude Code) reconstruindo código autonomamente** é precedente perigoso. Protocolo novo vigente: > 50 linhas exige autorização humana.

Minha primeira rodada falhou em tudo isso. A segunda corrigiu. A lição vale para próximas auditorias forenses — minhas e de qualquer IA que venha a ocupar este papel.

---

## Observação final sobre AUTHORITY_PRECEDENCE.md

O documento declara (§2): *"Em qualquer conflito, vence sempre a trava MAIS RESTRITIVA."* (§4.4): *"IA nunca é soberana. IA nunca pode criar autoridade."*

A execução atual do sistema contradiz **ambos**:
- Implementação é **menos restritiva** (fail-open) quando o documento exige **mais restritiva**
- IA executora criou autoridade (234 linhas reconstruídas sem revisão) quando o documento proíbe

Restaurar o sistema ao alinhamento com AUTHORITY_PRECEDENCE é o **critério de saída** da FASE 4. Sem isso, FASE 5 é construir sobre terreno trincado.

---

**FIM DO SUMÁRIO**
