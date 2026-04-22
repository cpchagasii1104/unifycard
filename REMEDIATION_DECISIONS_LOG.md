# REMEDIATION DECISIONS LOG

**Documento append-only. Toda decisão arquitetural tomada durante a remediação é registrada aqui.**
**Uma decisão registrada nunca é editada. Se superada, adicionar nova entrada referenciando a anterior.**

| Metadado | Valor |
|---|---|
| Criado | 2026-04-21 |
| Última entrada | DECISION-0008 (2026-04-21) |
| Base normativa | `SYSTEM_REMEDIATION_PLAN.md` v1.0 |
| Arquivo relacionado | `SYSTEM_REMEDIATION_STATUS.md` (vivo) |

---

## Objetivo deste documento

Registrar permanentemente toda decisão que envolva:

1. Escolha arquitetural entre alternativas concorrentes (qual tabela de produto é SSOT, qual sistema de autorização sobrevive, etc.)
2. Ajuste no gate que impacte métricas anti-regressão (Seção 7 do PLAN)
3. Padrão de falso-positivo identificado + ajuste no script (Seção 6 do PLAN, limiar 3-5 FP)
4. Justificativa de desvio > 10% em baseline numérico do gate
5. Superação de uma versão do PLAN por outra (raríssimo, última instância)
6. Qualquer decisão que uma IA futura precise conhecer para não reabrir discussão

**Decisões fora deste log não existem.** Se não está aqui, não foi decidido.

---

## Formato obrigatório de cada entrada

```markdown
### DECISION-NNNN — <título curto e descritivo>

- **Data:** YYYY-MM-DD
- **Tipo:** <arquitetural | ajuste_gate | falso_positivo | desvio_baseline | superacao_plan | outro>
- **ID da violação (se aplicável):** Cxx
- **Contexto:** 
  (descrição do problema e por que exige decisão registrada)
- **Opções consideradas:**
  1. Opção A — descrição, prós, contras
  2. Opção B — descrição, prós, contras
  3. Opção C — descrição, prós, contras
- **Escolha:** Opção N
- **Justificativa:** 
  (por que essa opção vence; que invariante preserva; que risco aceita)
- **Consequências esperadas:**
  - Curto prazo: ...
  - Médio prazo: ...
- **Responsável:** <nome>
- **Validação prévia:** <quem revisou antes da decisão> (ChatGPT / Claude / Clayton / outro)
- **Supera:** DECISION-NNNN (se aplicável, senão "nenhuma")
- **Superada por:** (preencher apenas quando superada por entrada posterior)
- **Referências:** (links, linhas de código, migrations, arquivos SRC_FULL)
```

## Regras de integridade

- **Numeração sequencial** contínua. `DECISION-0001`, `DECISION-0002`, nunca pular.
- **Data no formato ISO** `YYYY-MM-DD`.
- **Nunca editar decisão registrada.** Se informação precisa mudar, nova entrada com `Supera: DECISION-NNNN` e a entrada antiga ganha `Superada por: DECISION-MMMM`.
- **Toda decisão que afeta Status.** Atualizar `SYSTEM_REMEDIATION_STATUS.md` no mesmo commit que registra a decisão.
- **Commit padronizado:** `"decisions: DECISION-NNNN <título>"`.

---

## Registros

---

### DECISION-0001 — Falsos negativos do gate v1.1: 42P01 e metadata->> em decisão

- **Data:** 2026-04-21
- **Tipo:** ajuste_gate
- **ID da violação:** C14 (42P01), C6 (metadata->>)
- **Contexto:**
  Validação manual (ETAPA 5 do gate v1.1) identificou 2 padrões que o gate não detecta:
  1. Catches de 42P01 quando o código extrai `const code = error.code` antes do `if` —
     o regex atual só cobre `error?.code === '42P01'` diretamente no bloco catch.
     9 ocorrências reais não detectadas em unified-availability.routes.ts e outros.
  2. metadata->> em decisão transacional quando a tabela transacional não aparece
     no mesmo snippet SQL capturado — critério de tabela transacional muito restrito.
     9 ocorrências reais não detectadas (city-readiness.service.ts, trust.service.ts, etc.)
- **Opções consideradas:**
  1. Expandir regex de 42P01 para cobrir extração de variável (`const code = error.code`)
  2. Relaxar critério de metadata->> (não exigir tabela transacional no snippet)
  3. Manter como está e registrar como dívida de gate v2
- **Escolha:** Opção 3
- **Justificativa:**
  Gate v1.1 sub-reporta, não super-reporta. Sub-reportar é aceitável nesta fase —
  significa que há violações reais que o gate não vê, mas não há ruído falso.
  Expandir agora quebraria o princípio P2 (correção incremental) e a ETAPA 5
  seria refeita. Registra como backlog do gate v2 (FASE 8 do PLAN).
- **Consequências esperadas:**
  - Curto prazo: 9+ catches de 42P01 e 9+ metadata->> continuam invisíveis ao gate
  - Médio prazo: gate v2 adiciona Regra 8 (catches) cobrindo esses padrões
- **Responsável:** Clayton
- **Validação prévia:** Claude + Visual Code (ETAPA 5 validação manual)
- **Supera:** nenhuma
- **Superada por:** (a preencher quando gate v2 implementar Regra 8)
- **Referências:**
  - unified-availability.routes.ts: linhas com `if (code === '42P01')`
  - trust.service.ts: metadata->>'actor_id' em CASE WHEN
  - SYSTEM_REMEDIATION_PLAN.md §6 (Loop de Validação do Gate)
  - SYSTEM_REMEDIATION_PLAN.md FASE 8 (Gates Evolutivos)

---

---

### DECISION-0002 — PENDENTE — C8[3/6]: tratamento de groups.status vs nomenclatura canônica

- **Data:** 2026-04-21
- **Tipo:** arquitetural (PENDENTE — aguarda decisão de Clayton)
- **ID da violação:** C8 (em andamento) + C36 (novo, a ser criado se necessário)
- **Contexto:**
  Durante execução de C8[3/6] (is_active → status), foi detectado que o schema Gênesis
  de `groups` usa a coluna `status TEXT NOT NULL DEFAULT 'active'`, que viola a
  nomenclatura canônica §3.4 (proibição de `status` isolado em banco) e §4.9
  (is_active é o boolean canônico para estado ativo/inativo).

  Ou seja: o schema Gênesis já nasce com violação de nomenclatura pré-existente,
  descoberta apenas agora durante a remediação.

- **Opções consideradas:**
  1. Manter `is_active` no código e criar migration adicionando `is_active BOOLEAN`
     à tabela — segue §4.9, corrige schema Gênesis.
  2. Renomear schema para `group_status TEXT` via migration — segue §3.4
     ("sempre específico no banco"), renomeia coluna existente.
  3. Manter `status` no código e schema por ora, registrar violação pendente
     (nova violação C36) para correção em FASE 7.
- **Escolha:** PENDENTE — aguarda decisão de Clayton
- **Consequências esperadas (pendente de escolha):**
  - Opção 1: exige migration cirúrgica (viola princípio "não criar migration agora")
  - Opção 2: exige migration de renomeação + update de consumidores
  - Opção 3: adia dívida de nomenclatura para FASE 7 (consolidação schema)
- **Responsável:** Clayton
- **Validação prévia:** Claude (detecção) + ChatGPT (análise de opções)
- **Supera:** nenhuma
- **Superada por:** DECISION-0003
- **Referências:**
  - docs/01_normative/07_NOMENCLATURA_CANONICA.md §3.4 (status proibido isolado)
  - docs/01_normative/07_NOMENCLATURA_CANONICA.md §4.9 (is_active canônico)
  - backend/migrations/20260530180000_groups.sql (schema atual com status TEXT)
  - backend/src/modules/groups/groups.repository.ts (código usa is_active)
- **Estado atual da execução C8:**
  - C8[1/6]: FIXED (commit fc97f893)
  - C8[2/6]: FIXED (commit 4572a1bb)
  - C8[3/6]: BLOQUEADO aguardando decisão
  - C8[4/6], [5/6], [6/6]: não iniciados

---

### DECISION-0003 — Resolução da DECISION-0002: C8[3/6] segue com `status` e dívida sistêmica vai para FASE 7

- **Data:** 2026-04-21
- **Tipo:** arquitetural
- **ID da violação:** C8 (em andamento) + C36 (criada)
- **Contexto:**
  Durante execução de C8[3/6] (is_active → status), detectado que o schema Gênesis
  de `groups` usa `status TEXT NOT NULL DEFAULT 'active'`, violando §3.4 (proibição
  de status isolado no banco) e §4.9 (is_active é o boolean canônico).
  Auditoria subsequente revelou que 67 tabelas têm status genérico — é padrão
  sistêmico, não acidente isolado.
- **Opções consideradas:**
  1. Corrigir schema com migration para is_active BOOLEAN (§4.9)
  2. Corrigir schema com migration para group_status TEXT (§3.4)
  3. Seguir com `status` no código, registrar C36 como dívida para FASE 7
- **Escolha:** Opção 3
- **Justificativa:**
  C8 é alinhamento código↔realidade, não refatoração de schema.
  Corrigir agora criaria migration fora de escopo e misturaria responsabilidades
  de fases. Violação é sistêmica (67 tabelas), não isolada — merece tratamento
  unificado em FASE 7, não remendo em uma tabela.
- **Consequências esperadas:**
  - Curto prazo: C8[3/6] prossegue com `status`. 8 novas violações registradas.
  - Médio prazo: FASE 7 consolida nomenclatura (C36, C38, C39, C40, C41, C42).
  - Longo prazo: Gate v2 (C37) impede novas violações.
- **Responsável:** Clayton
- **Validação prévia:** Claude (auditoria) + ChatGPT (análise de opções)
- **Supera:** DECISION-0002
- **Superada por:** (a preencher se decisão revertida)
- **Referências:**
  - 07_NOMENCLATURA_CANONICA.md §3.4, §4.9
  - SYSTEM_REMEDIATION_STATUS.md C36 (criada)
  - backend/src/modules/groups/groups.repository.ts

---

### DECISION-0004 — C45+C46: fix canônico para groups.service createGroup

- **Data:** 2026-04-21
- **Tipo:** arquitetural
- **ID da violação:** C45, C46
- **Contexto:**
  groups.service.ts usa dynamic import de actorRepository diretamente (§4.8.1).
  Fix tentado falhou no gate porque a violação era pré-existente na linha 225.
  Cursor confirmou contrato do writer canônico.
- **Fix mapeado para próxima sessão:**
  1. Remover dynamic import de actorRepository no bloco try do feed (linha 225)
  2. Antes do groupsRepository.create() (linha 187), adicionar:
       const ownerActor = await ensureUserActor(tenantId, ownerUserId);
     (ensureUserActor já importado no topo do service)
  3. Passar ownerActor.actor_id para create()
  4. No bloco try do feed: usar ownerActor.actor_id diretamente (já no escopo)
  5. Corrigir groups.types.ts: ownerUserId → ownerActorId
  6. Corrigir groups.service.ts: todas referências ownerUserId → ownerActorId
  7. Corrigir groups.routes.ts: group.ownerUserId → group.ownerActorId
- **Ordem dos commits:**
  Commit 1: ensureUserActor antes do create + remover dynamic import (C45)
  Commit 2: ownerUserId → ownerActorId em types + service + routes (C46)
- **Responsável:** Clayton
- **Validação prévia:** Cursor (actor-writer.service.ts contract audit)
- **Supera:** nenhuma

---

### DECISION-0005 — C4: eliminar realidade paralela no bank-balance-by-region

- **Data:** 2026-04-21
- **Tipo:** arquitetural
- **ID da violação:** C4
- **Contexto:**
  listRegionalFunds em bank-balance-by-region.service.ts lia colunas currency
  e metadata de bank_accounts que nao existem no schema Genesis. Tipos
  TypeScript genericos declaravam essas colunas. Runtime falharia ao executar.
- **Opcoes consideradas:**
  1. Criar migration adicionando currency TEXT e metadata JSONB a bank_accounts
  2. Remover currency e metadata do SELECT e tipos, usar hardcoded 'BRL'
  3. Remover currency e metadata do SELECT e tipos, sem inventar dado
- **Escolha:** Opcao 3
- **Justificativa:**
  Nao inventar dado que o schema nao modela (principio SSOT). currency deve
  vir de bank_transactions ou do argumento do metodo quando necessario.
  Opcao 2 violaria o invariante "Semantica so via CONCEPT" ao hardcodar
  valor sem fonte canonica. Opcao 1 mudaria schema fora do escopo da
  remediacao (que e alinhar codigo ao schema real, nao o contrario).
- **Consequencias:**
  - Curto prazo: 2 queries alinhadas ao schema real, regionId usa owner_id
  - Medio prazo: se currency for necessario no futuro, vira via bank_transactions
- **Responsavel:** Clayton
- **Validacao previa:** Cursor (auditoria schema) + ChatGPT (validacao arquitetural)
- **Supera:** nenhuma
- **Referencias:**
  - backend/src/modules/bank/bank-balance-by-region.service.ts
  - Commits 009f9eca, 736b25c2, 340981e7

### DECISION-0006 — C45 complemento: ultimo caminho fora do writer canonico

- **Data:** 2026-04-21
- **Tipo:** arquitetural
- **ID da violacao:** C45 (complemento)
- **Contexto:**
  Apos C45 ter sido fechado em groups.service.ts (commit a0e7fe0c), gate
  actor-writer-boundaries continuava falhando. Diagnostico revelou que
  core.service.ts:118 ainda usava actorRepository.findOrCreateUserActor
  diretamente fora do writer canonico.
- **Escolha:** substituir por ensureUserActor com import canonico
- **Justificativa:**
  Mesmo contrato de C45 aplicado uniformemente. findById (linha 116) e
  leitura pura, pode permanecer; findOrCreateUserActor (linha 118) e
  escrita e deve passar pelo writer.
- **Consequencias:**
  - Gate actor-writer-boundaries: PASS (primeira vez desde inicio da sessao)
  - Desbloqueia commits futuros
- **Responsavel:** Clayton
- **Referencias:**
  - backend/src/core/core.service.ts linhas 10 e 119
  - Commit 009f9eca

---

### DECISION-0007 — C1: amputação controlada da tabela ledger fantasma

- **Data:** 2026-04-21
- **Tipo:** arquitetural
- **ID da violação:** C1
- **Contexto:**
  Codigo em 5 arquivos dentro de backend/src referencia uma tabela "ledger"
  que nao existe no schema Genesis. O SSOT financeiro e bank_ledger, com
  colunas completamente diferentes (direction vs entry_type, sem metadata,
  sem JOIN com "transactions"). Nao e "renomear" — sao sistemas paralelos
  com semantica distinta.

  Mapeamento (confirmado via leitura):
  - backend/src/core/reputation/trust.service.ts:412 — getFinancialHistory
    alimenta TrustDashboard.financial (totalReceived, asOrganizer, asProvider,
    totalPaid, impactGenerated, pendingDebts) e badge DEBITO_PENDENTE
  - backend/src/modules/groups/groups.routes.ts:1175, 1188 — historico de
    ledger do grupo, resposta { entries, totalCents }
  - backend/src/core/unifybank/test-currency.service.ts:156, 173 —
    getTestCurrencyLedger (admin apenas)
  - backend/src/modules/work/tests/work.e2e.spec.ts:391 — teste E2E

- **Opcoes consideradas:**

  A. Amputacao com retorno vazio/zeros
     Manter contrato publico das funcoes. Retornar estruturas vazias/zeros.
     Remover queries FROM ledger. Marcar com TODO explicito para FASE 6.
     Pros: nao corrompe dados, gates PASS, dividas explicitas, reversivel.
     Contras: features afetadas ficam sem valor real ate FASE 6.

  B. Shim sobre bank_ledger com semantica reduzida
     Criar getFinancialHistoryFromBankLedger mapeando direction=credit→received,
     direction=debit→paid. Similar para outros arquivos.
     Pros: algum valor real desde ja.
     Contras: semantica inventada (impact_city/region/community nao existe
     em bank_ledger), risco de reputacao calculada em base errada, cria
     segunda fonte de verdade parcial.

  C. Reescrita completa via bank_ledger + definicao semantica nova
     Exige decisao de produto: o que e "recebido", "pago", "impacto
     gerado" para reputacao. Provavelmente precisa de novas colunas em
     bank_splits ou nova tabela de atribuicao.
     Pros: solucao correta definitiva.
     Contras: fora do escopo de remediacao, exige sessao arquitetural FASE 6.

- **Escolha:** Opcao A por arquivo, com TODO para FASE 6

- **Justificativa:**
  Opcao B viola invariante "Semantica so via CONCEPT" — inventa equivalencia
  entre entry_type/metadata (modelo fantasma) e direction/purpose
  (modelo canonico). Reputacao baseada em mapeamento inventado e pior
  que reputacao zerada.
  Opcao C e correta mas nao pertence a FASE 4 (bloqueadores criticos) —
  e decisao arquitetural FASE 6 que exige desenho de produto.
  Opcao A preserva contratos publicos, mantem gates PASS, documenta
  divida explicita e e totalmente reversivel quando a semantica real
  for decidida.

- **Plano de execucao (commits separados):**

  1. trust.service.ts — getFinancialHistory:
     - Remover query FROM ledger
     - Retornar estrutura TrustDashboard.financial com todos os campos zero
     - Manter subquery actor_debts para pendingDebts (essa tabela existe
       e e canonica — verificar antes de executar)
     - Adicionar TODO comentario remetendo DECISION-0007 e FASE 6

  2. test-currency.service.ts — getTestCurrencyLedger:
     - Remover ambas queries FROM ledger
     - Retornar { entries: [], total: 0 }
     - TODO DECISION-0007

  3. groups.routes.ts — rota de ledger do grupo:
     - Remover ambas queries FROM ledger
     - Retornar { ok: true, data: { entries: [], totalCents: 0 } }
     - TODO DECISION-0007

  4. work.e2e.spec.ts — teste E2E:
     - Marcar teste(s) com FROM ledger como .skip
     - Comentario TODO DECISION-0007

  5. Arquivos fora de backend/src (tests/integration, scripts) — FORA
     DE ESCOPO DE C1. Tratar em sessao futura de sanitizacao de testes.

- **Consequencias esperadas:**

  - Curto prazo:
    * TrustDashboard.financial retorna zeros em todos os campos exceto
      pendingDebts (mantido via actor_debts se tabela existir)
    * Badge DEBITO_PENDENTE so dispara se actor_debts tiver dados reais
    * Historico de ledger de grupos retorna lista vazia
    * getTestCurrencyLedger retorna lista vazia (emit continua funcionando)
    * Gates PASS
    * C1 FIXED

  - Medio prazo:
    * FASE 6 define semantica real de reputacao financeira
    * Reimplementacao sobre bank_ledger com contrato explicito

- **Responsavel:** Clayton
- **Validacao previa:** Cursor (mapeamento completo do codigo) + ChatGPT
  (identificacao de C1-A/C1-B e analise de opcoes)
- **Supera:** nenhuma
- **Referencias:**
  - backend/src/core/reputation/trust.service.ts linhas 40-52, 126, 385-389, 412, 613
  - backend/src/modules/groups/groups.routes.ts linhas 1175, 1188
  - backend/src/core/unifybank/test-currency.service.ts linhas 156, 173
  - backend/src/modules/work/tests/work.e2e.spec.ts linha 391
  - SYSTEM_REMEDIATION_STATUS.md C1 (violacao original)

---

### DECISION-0008 — C3: substituição direta por ensureUserActor nos helpers centrais

- **Data:** 2026-04-21
- **Tipo:** arquitetural
- **ID da violação:** C3
- **Contexto:**
  Auditoria transversal (Cursor Ask, 2026-04-21) revelou que C3 tem dois caminhos
  ativos de criação de actor fora do writer canónico:

  1. `backend/src/core/actors/actor.helpers.ts` — `getActiveActor` usa import
     dinâmico de `@modules/social/actor.repository` e chama `findOrCreateUserActor`
     diretamente. Consumidores em produto: `payout.routes`, `policy.routes`,
     `invoice.routes`, `reporting.routes`.

  2. `backend/src/modules/social/actor.utils.ts` — `resolveActiveActorFromRequest`
     com `allowUserFallback=true` e `userId` chama `findOrCreateUserActor`.
     Consumidores: `crm.routes`, `my-orders.routes`, `subscription.routes`,
     `venue.routes`, `profile-health.routes`.

  C45 e complemento (commits a0e7fe0c, 009f9eca) corrigiram outros pontos mas
  não estes. O STATUS dizia «3 caminhos»; o mapa real mostra 2 caminhos
  utilitários centrais impactando 9 rotas consumidoras.

  Observação arquitetural: estes helpers são usados em rotas de leitura
  (payout list, my-orders, reporting). Criar actor apenas para ler algo é
  conceptualmente estranho, mas é o comportamento actual do sistema.

- **Opções consideradas:**

  A. Substituição directa: `findOrCreateUserActor` → `ensureUserActor`  
     Prós: preserva comportamento exacto, fecha C3 rápido, 2 ficheiros, zero
     superfície nova de bug, não trava FASE 4.  
     Contras: mantém semântica de criação em rota de leitura (dívida conceptual
     adiada).

  B. Separação read/write: criar `resolveActorReadOnly` (sem create) para rotas
     de leitura, manter `ensureUserActor` para escrita.  
     Prós: arquitecturalmente correcto, elimina dívida conceptual.  
     Contras: altera 9+ rotas, introduz API nova, superfície maior de regressão,
     trava FASE 4 em trabalho que pertence a FASE 6.

  C. Não fechar C3 ainda, esperar FASE 6.  
     Prós: evita qualquer risco.  
     Contras: mantém violação activa que contraria §4.8.1 da LEI.

- **Escolha:** Opção A (substituição directa) + dívida explícita para C3-B

- **Justificativa:**
  Opção A fecha a violação formal (`findOrCreate` fora do writer) preservando
  comportamento actual. A dívida conceptual (criar em rota de leitura) existe
  hoje; mover para o writer canónico não introduz nada novo, apenas move
  responsabilidade. Opção B é correcta mas prematura — FASE 4 trata bloqueadores
  críticos, não refactor arquitectural de 9 rotas. Insight adicional: estabilizar
  `getActiveActor` e `resolveActiveActorFromRequest` como únicos pontos de
  criação de actor via HTTP reduz superfície de C12 (confusão actor/global/user)
  automaticamente, pois as rotas passarão a receber actor canónico garantidamente.

- **Plano de execução:**
  - Commit 1: `actor.helpers.ts` — `getActiveActor` usa `ensureUserActor`
  - Commit 2: `actor.utils.ts` — `resolveActiveActorFromRequest` usa `ensureUserActor`
  - Commit 3: status C3 FIXED + documentação

- **Consequências esperadas:**

  - Curto prazo:
    * 2 helpers centrais alinhados ao writer canónico
    * 9 rotas consumidoras não alteradas (transparente)
    * Gate actor-writer-boundaries continua PASS
    * C3 FIXED

  - Médio prazo:
    * C12 parcialmente mitigado (actorId garantidamente canónico na borda HTTP)
    * Base estável para FASE 6 decidir C3-B (separação read/write)

- **Dívida registrada (C3-B):**
  FASE 6 deve decidir: criar `resolveActorReadOnly` para rotas de leitura pura,
  ou aceitar criação transparente via `ensureUserActor` como contrato. Esta
  decisão exige análise de produto: rotas que listam payout de um actor que
  ainda não existe devem criar actor implícito ou retornar 404?

- **Responsável:** Clayton
- **Validação prévia:** Cursor (auditoria transversal de C3 + C12 + C44) +
  ChatGPT (análise arquitectural da opção A vs B)
- **Supera:** nenhuma
- **Superada por:** (a preencher quando aplicável)
- **Referências:**
  - `backend/src/core/actors/actor.helpers.ts` (`getActiveActor`)
  - `backend/src/modules/social/actor.utils.ts` (`resolveActiveActorFromRequest`)
  - `backend/src/modules/identity/actor-writer.service.ts` (writer canónico)
  - `LEI_DE_COERENCIA_SISTEMICA` §4.8.1
  - DECISION-0004 (C45 mapeamento original de C3)

---

**FIM DO DOCUMENTO** (continua crescendo por append a cada decisão)
