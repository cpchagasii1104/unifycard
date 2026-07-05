# UNIFYCARD — SYSTEM REMEDIATION PLAN

**Documento normativo fixo — congelado após 2026-04-21.**
**Não editar ao longo da execução. Ajustes futuros registrados em `REMEDIATION_DECISIONS_LOG.md`.**

| Metadado | Valor |
|---|---|
| Versão | 1.0 (congelada) |
| Criado | 2026-04-21 |
| Base | Auditoria sistêmica 2026-04-21 (30 violações confirmadas) |
| Precedência normativa | Constituição > Leis Operacionais > SSOT Registry > este documento |
| Local | Raiz do projeto (`C:\unificard\SYSTEM_REMEDIATION_PLAN.md`) |
| Docs relacionados | `SYSTEM_REMEDIATION_STATUS.md` (vivo) · `REMEDIATION_DECISIONS_LOG.md` (append-only) · `REMEDIATION_SNAPSHOTS.md` (append-only) |

> Conflito aparente com norma superior → prevalece a norma superior.
> Em caso de ambiguidade, consultar `docs/01_normative/00_AGENT_PROTOCOL.md`.

---

## 1. STATUS DE ENTRADA

- Auditoria sistêmica realizada em 2026-04-21 (9 rodadas, ~8h de análise estática).
- **30 violações confirmadas:** 10 CRITICAL · 11 HIGH · 9 MEDIUM.
- Sistema em estado de **deriva sistêmica**: código aponta para schema fantasma em múltiplos pontos; renomeações incompletas acumuladas; SSOTs paralelos em domínios críticos (produto, navegação, autorização, ledger, groups, identidade); try/catch mascarando erros de schema.
- Ambiente: desenvolvedor único, máquina local, banco `unificard_dev` sem dados reais.
- 4 gates CI atuais passam verde com 30 violações presentes — **meta-violação confirmada**: gates validam o que foi medido, não o que a norma exige.
- Nenhum grupo cadastrado (`groups=0`) por consequência direta de C8 (2 repositórios com schemas fantasmas impedem criação).

## 2. OBJETIVO

Restaurar coerência total entre código e schema real. Eliminar mascaramentos. Consolidar SSOTs paralelos. Adicionar gates que detectam deriva futura automaticamente. **Sem regressão. Sem feature nova durante a remediação.**

O critério não é atingir número mínimo de violações — é atingir **sistema coerente e verificável**.

---

## 3. PRINCÍPIOS NÃO-VIOLÁVEIS (P1–P9)

### P1. Sintoma ou causa?

Antes de propor qualquer correção, responder em texto explícito:

- Isso corrige sintoma ou causa raiz?
- Se sintoma: pausar e escalar para decisão arquitetural.
- Se causa: (a) identificar invariante restaurado, (b) identificar risco de regressão, (c) verificar se cria SSOT paralela, (d) verificar ordem §7 (Semântica → Identidade → Autoridade → Tempo → Estado → Financeiro → Evento).

### P2. Correções nunca em lote

Um commit = uma unidade lógica reversível verificável. Proibido agrupar correções de violações distintas. Proibido "aproveitar embalo".

### P3. Gate nasce estrito

Allowlist só aceita entradas com `id + type + reason + owner + deadline + issue_id`. Sem qualquer campo, gate falha. Deadline no passado, gate falha com `ALLOWLIST_EXPIRED`.

### P4. Detecção é mecânica, correção é análise

Gate reporta; humano decide. Classificar violação em CRÍTICA/ANALÍTICA/OPERACIONAL é análise, não mecânica. Nunca confiar na classificação do gate sem validação manual de amostra.

### P5. Toda correção roda contra seed realista

Seed que apenas popula dados é insuficiente. Seed tem que **executar fluxos**: criar evento, criar RFQ, aceitar quote, gerar booking, executar payment, validar ledger consistente. Sem execução, seed não valida sistema.

### P6. Ciclo de execução atômico

Cada ciclo altera no máximo **1 unidade lógica reversível** (tipicamente 1 arquivo; admite múltiplos quando a atomicidade lógica é indivisível, ex: corrigir 2 repositórios de mesma tabela + migration em 1 commit). Após cada ciclo, executar controle (Seção 11). Erro em qualquer verificação: parar imediatamente, não avançar.

### P7. Gate é instrumento, não verdade

Toda violação CRITICAL reportada por gate é **validada manualmente** contra banco + código + norma antes de correção. Se gate indica incoerência com comportamento observado, investigar o gate antes do código.

### P8. Loop de validação do gate

Gate só é considerado confiável após passar no procedimento da Seção 6. Proibido usar gate para orientar correções enquanto não passou na validação.

### P9. Anti-regressão do próprio gate

Cada versão estável do gate grava baseline numérico. Nova versão compara. Desvio sem justificativa registrada é bloqueante.

---

## 4. CLASSIFICAÇÃO DE VIOLAÇÕES

| Classe | Definição | Ação |
|---|---|---|
| **BLOCKER** | Quebra execução imediata (INSERT/UPDATE/DELETE em schema fantasma; escrita em SSOT fora de writer canônico) | Prioridade máxima, correção antes de qualquer outra |
| **CORRUPTOR** | Gera estado inconsistente silenciosamente (WHERE sobre coluna fantasma; catch de schema; metadata em decisão sobre transacional; leitura indevida de bank_*) | Correção após BLOCKERs, antes de features |
| **DEBT** | Violação normativa sem impacto de runtime imediato (SELECT puramente analítico; nomenclatura legada isolada) | Correção em sprints dedicados; não bloqueia fase |

---

## 5. FASES DE EXECUÇÃO

### FASE 0 — BASE NORMATIVA
0.1 Criar este documento na raiz do projeto.
0.2 Criar `SYSTEM_REMEDIATION_STATUS.md` (vivo) com os 30 achados populados.
0.3 Criar `REMEDIATION_DECISIONS_LOG.md` (append-only, vazio).
0.4 Criar `REMEDIATION_SNAPSHOTS.md` (append-only, vazio).
0.5 Atualizar `docs/01_normative/00_AGENT_PROTOCOL.md` apontando os 4 arquivos acima como leitura obrigatória durante remediação.

### FASE 1 — VISIBILIDADE
1.1 Implementar gate `validate-schema-code-coherence.mjs` em `scripts/`.
1.2 Rodar gate na versão atual.
1.3 Aplicar Loop de Validação do Gate (Seção 6).
1.4 Popular allowlist inicial **apenas** para violações conhecidas já mapeadas, com `reason + owner + deadline + issue_id` obrigatórios.

### FASE 2 — DESMASCARAR
2.1 C14 incremental: identificar 23 catches de schema.
2.2 Remover 1 catch por commit. Após cada remoção: gates + seed + E2E + observar logs.
2.3 Se remoção gerar crash em rota produtiva, reverter e registrar motivo antes de nova tentativa.

### FASE 3 — EXPOR REALIDADE
3.1 `db:reset` + rerun das 250 migrations (estado limpo).
3.2 Implementar seed realista conforme `SEED_REALISTIC_SPEC` (dados + fluxos + validação pós-execução).
3.3 Executar seed. BLOCKERs reais crasham aqui.

### FASE 4 — CORRIGIR BLOCKERS
Ordem dentro do grupo por **impacto real no E2E** (Seção 10), não por facilidade técnica. Sequência referencial: C8 → C4 → C26 (ADD CHECK) → C22 (ADD CHECK) → C1 → C3 → C12. Após cada fix: seed roda até o próximo crash.

### FASE 5 — CONTER DERIVA
5.1 C14 restante (se houver após Fase 2).
5.2 Correções executáveis: C17 (set_config), C18 (RLS FORCE), C19 (reference_id tipo), C25 (FK canonical_product).
5.3 Classificação de C13 em CRÍTICAS/ANALÍTICAS/OPERACIONAIS (P4). Apenas CRÍTICAS movidas no curto prazo; ANALÍTICAS/OPERACIONAIS viram RFC separado com benchmark.

### FASE 6 — DECISÕES ARQUITETURAIS
Requer sessão dedicada (Clayton + Claude + ChatGPT). IDs: C2, C5, C9, C10, C21, C22, C24, C27. Cada decisão registrada em `REMEDIATION_DECISIONS_LOG.md`.

### FASE 7 — CONSOLIDAÇÃO DE NOMENCLATURA
C11, C23, C28, C30. Migration única por grupo (ex: "DROP `createdAt` em N tabelas restantes"). Rollback planejado antes da execução.

### FASE 8 — GATES EVOLUTIVOS
- **Gate v2**: Regra 8 (catches de schema) — após C14 fechado.
- **Gate v3**: Regra 9 (metadata em decisão) — após lista transacional estabilizada.
- **Gate v4**: Regra 10 (leitura bank_* fora dos módulos autorizados) — após Fase 5 concluída.

---

## 6. LOOP DE VALIDAÇÃO DO GATE

Procedimento obrigatório antes de qualquer uso do gate para orientar correções:

1. Rodar gate contra estado atual.
2. Selecionar 10 violações aleatórias do relatório.
3. Para cada uma, validar manualmente:
   - (a) A tabela existe no banco? (`SELECT ... FROM information_schema.tables`)
   - (b) A coluna existe na tabela? (`SELECT ... FROM information_schema.columns`)
   - (c) O acesso é realmente proibido pelo contexto normativo?
4. Classificar resultado:

| Falso-positivos | Decisão |
|---|---|
| 0–2 | Gate **confiável**, seguir para uso operacional |
| 3–5 | Gate **precisa ajuste**. Registrar no `REMEDIATION_DECISIONS_LOG.md`: qual padrão de FP identificado + qual ajuste no script. Revalidar com novas 10 amostras após ajuste. |
| 6+ | Gate **inválido**. Investigação completa antes de qualquer uso. Não populate allowlist. |

**Proibido usar gate para orientar correções sem passar neste loop.**

---

## 7. ANTI-REGRESSÃO DO GATE

Após qualquer alteração no script do gate:

1. Cada versão estável grava baseline em `scripts/gate-baseline-v<n>.json`:
   - Queries SQL candidatas/válidas
   - Tabelas e colunas referenciadas
   - Violações por classe (BLOCKER/CORRUPTOR/DEBT)
   - Exit code
2. Nova versão roda contra mesmo estado e compara com baseline anterior.
3. Desvio > 10% em qualquer métrica exige entrada em `REMEDIATION_DECISIONS_LOG.md` justificando.
4. Sem justificativa registrada, alteração no gate é revertida.

**Proibido aceitar mudança no gate sem entender o impacto numérico.**

---

## 8. CAUSA RAIZ — DIRETRIZ OPERACIONAL

Antes de corrigir qualquer violação, responder: **sintoma ou causa?**

Exemplos (não exaustivos):

| Observação | Classificação | Ação |
|---|---|---|
| Coluna inexistente no schema referenciada em query | **Causa** | Migration que cria coluna ou remove referência |
| `try/catch (error.code === '42P01')` retornando `[]` | **Sintoma** | Remover catch, investigar por que a tabela não existe |
| `SELECT *` em código de produção | **Sintoma** | Causa: ausência de contrato explícito de colunas |
| `actors.id` + `actors.actor_id` sem CHECK igualando | **Causa** | ADD CONSTRAINT CHECK ou eliminar duplicação |
| INSERT direto em tabela SSOT fora do writer | **Sintoma** | Causa: falta de trava arquitetural no gate |
| `metadata->>'status'` em decisão | **Sintoma** | Causa: estado transacional mal modelado |

**Regra:** se é sintoma, investigar e corrigir causa primeiro. Se é causa, validar que correção não gera sintoma novo upstream.

---

## 9. VALIDAÇÃO DE ESTADO GLOBAL

Ao final de **cada fase completa** (não cada commit), executar:

1. `pnpm --dir backend run validate:schema-coherence`
2. `pnpm --dir backend run validate:actor-writer-boundaries`
3. `pnpm --dir backend run validate:bank-ledger-boundaries`
4. `pnpm --dir backend run validate:regression-guards`
5. `node scripts/validate-architectural-patterns.mjs --strict`
6. `pnpm --dir backend run tsc --noEmit`
7. Seed realista + E2E completo

Registrar snapshot em `REMEDIATION_SNAPSHOTS.md`:

```
## SNAPSHOT após FASE <N> — YYYY-MM-DD

Gates:
- schema-coherence: <PASS/FAIL, N violações>
- actor-writer-boundaries: <PASS/FAIL>
- bank-ledger-boundaries: <PASS/FAIL>
- regression-guards: <PASS/FAIL>
- architectural-patterns: <PASS/FAIL>
- tsc: <N erros>

Violações no gate schema-coherence:
- BLOCKER: N
- CORRUPTOR: M
- DEBT: K
Queries SQL extraídas: X
Allowlist: Y entradas ativas / Z expiradas

E2E:
- Seed executou completo: sim/não
- Fluxos validados: <lista>
- Ledger consistente: sim/não

Comparação com snapshot anterior:
- ...
```

**Piora em qualquer dimensão (aumento de violação, gate caindo, tsc regredindo, seed quebrando cenário que passava)** → parar, investigar, não avançar para próxima fase.

**Objetivo:** garantir convergência monotônica do sistema ao longo do tempo.

---

## 10. PRIORIDADE POR IMPACTO REAL

Antes de corrigir qualquer violação, responder: **isso quebra o fluxo E2E atual?**

- **SIM** → prioridade máxima independente de classificação. Um DEBT que quebra E2E vem antes de um CRITICAL dormente.
- **NÃO** → seguir ordem padrão: BLOCKER → CORRUPTOR → DEBT.

**Verificação é mecânica:** antes de cada correção, rodar seed + E2E, listar erros. Violação que aparece nos erros = prioridade máxima, automaticamente.

**Proibido priorizar por facilidade técnica.** Se a correção fácil não destrava E2E e a difícil destrava, faz a difícil.

---

## 11. CONTROLE APÓS CADA COMMIT

Sequência mínima obrigatória após qualquer alteração de código:

```bash
pnpm --dir backend run validate:actor-writer-boundaries
pnpm --dir backend run validate:bank-ledger-boundaries
pnpm --dir backend run validate:regression-guards
node scripts/validate-architectural-patterns.mjs --strict
pnpm --dir backend run validate:schema-coherence
pnpm --dir backend run tsc --noEmit
pnpm --dir backend run seed:realistic   # se correção toca schema ou fluxo
```

Qualquer vermelho: **revert imediato**, diagnosticar, só então nova tentativa.

---

## 12. PROIBIÇÕES

- Aplicar múltiplas correções lógicas em um mesmo commit
- Ignorar ou suprimir gate sem allowlist justificada
- Adicionar try/catch para silenciar erro de schema ou negar realidade
- Criar nova fonte de verdade paralela ao corrigir
- Pular para FASE 4 (correções) sem FASES 0-3 completas
- Fazer decisão arquitetural sem registrar em `REMEDIATION_DECISIONS_LOG`
- Editar `SYSTEM_REMEDIATION_STATUS` retroativamente (append/update, não rewrite)
- Editar este `SYSTEM_REMEDIATION_PLAN` após congelamento (2026-04-21)
- Aplicar correção sem validar que o gate que a apontou é confiável (P8)
- Corrigir código quando gate reporta incoerência com comportamento observado (P7 — investigar gate primeiro)
- Executar próximo ciclo com gate/tsc/E2E vermelho do ciclo anterior
- Aceitar alteração no próprio gate sem verificar anti-regressão (P9)
- Priorizar correções por facilidade técnica em vez de impacto real no E2E
- **Se algo der estranho: não corrige código — corrige o processo.**

---

## 13. CONTINUIDADE ENTRE IAs

Toda IA que retomar o contexto desta remediação deve, **antes de qualquer proposta de correção**, ler nesta ordem:

1. `docs/01_normative/00_AGENT_PROTOCOL.md`
2. `docs/01_normative/LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md`
3. `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md`
4. Este documento (`SYSTEM_REMEDIATION_PLAN.md`)
5. `SYSTEM_REMEDIATION_STATUS.md` (estado atual)
6. `REMEDIATION_DECISIONS_LOG.md` (decisões tomadas)
7. `REMEDIATION_SNAPSHOTS.md` (evolução histórica)

Após leitura, aplicar P1 explicitamente em texto antes de qualquer proposta: "isto corrige sintoma ou causa?". Sem essa declaração, proposta é inválida.

---

## 14. META FINAL

Sistema onde:

- Código reflete o schema real do banco em 100% das referências
- Schema reflete a intenção normativa
- Nenhuma camada mascara erro
- Invariantes são verificáveis via gate automático
- Decisões arquiteturais estão registradas com justificativa
- Novo desenvolvimento não pode acumular dívida sem tripwire

---

## 15. CRITÉRIO DE CONCLUSÃO

Remediação é considerada concluída quando **todos** os critérios abaixo são verdadeiros:

- [ ] 0 BLOCKERs no gate `schema-coherence`
- [ ] 0 CORRUPTORs sem allowlist justificada e com deadline válido
- [ ] 5 gates (4 originais + `schema-coherence`) verdes simultaneamente
- [ ] `tsc --noEmit` com 0 erros no backend
- [ ] Seed realista executa completo, sem falhas, com ledger consistente
- [ ] 8 decisões arquiteturais registradas em `REMEDIATION_DECISIONS_LOG` (C2, C5, C9, C10, C21, C22, C24, C27)
- [ ] `SYSTEM_REMEDIATION_STATUS`: todos 30 achados com status `FIXED` ou `ALLOWLISTED` (permanente com justificativa) ou `DEFERRED` (com issue separada e deadline)
- [ ] Nenhum snapshot em `REMEDIATION_SNAPSHOTS` mostrou piora não-justificada durante a remediação
- [ ] Gates v2, v3, v4 implementados e passando

Enquanto **qualquer** critério falhar, remediação está aberta. Feature nova permanece bloqueada.

---

**FIM DO DOCUMENTO**

Versão congelada em 2026-04-21.
Editar este arquivo é violação explícita das proibições. Qualquer ajuste futuro segue via `REMEDIATION_DECISIONS_LOG.md` apontando esta versão como "superada" e criando v2.
