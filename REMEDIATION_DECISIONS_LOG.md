# REMEDIATION DECISIONS LOG

**Documento append-only. Toda decisão arquitetural tomada durante a remediação é registrada aqui.**
**Uma decisão registrada nunca é editada. Se superada, adicionar nova entrada referenciando a anterior.**

| Metadado | Valor |
|---|---|
| Criado | 2026-04-21 |
| Última entrada | DECISION-C2-008 (2026-04-26) |
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

### DECISION-0009 — C12: escopo reduzido a identity.routes + reclassificação

- **Data:** 2026-04-21
- **Tipo:** arquitetural (reclassificação de violação)
- **ID da violação:** C12 (escopo original) → C12 (escopo reduzido) + C50 + C51 (novas)

- **Contexto:**
  O STATUS original descrevia C12 como «3 rotas retornam actorId como globalUserId».
  A auditoria transversal (Cursor, 2026-04-21) revelou uma realidade mais nuancada:

  1. `backend/src/core/identity/identity.routes.ts` (wallet L797–804 + ledger L879–883):
     o campo `globalUserId` recebe `req.actionContext.actorId`, mas a variável correcta
     (`globalUserId` para wallet, `globalUserId2` para ledger) está resolvida por
     query ao banco via `resolveGlobalUserId(actor.user_id, tenantId)` e **não** está
     a ser usada. Fix trivial: atribuir a variável correcta.
     Adicional: `getTransactionsByGlobalUserId(actorId)` em wallet também recebe
     argumento errado (stub retorna `[]` hoje, mas o contrato está violado).

  2. `backend/src/modules/cultural/cultural.routes.ts` (L494–515): usa `globalUserId`
     como `actor_id` para check-in. Não há função canónica `resolveActorIdFromGlobalUserId`
     no codebase. `ensureUserActor` resolve a partir de `user_id` **local**, não de
     `globalUserId`. O bloco tem TODO explícito «Suportar ator ativo (PF/PJ/PAC)
     quando implementado» — é dívida de produto conhecida, não bug de atribuição.

  3. `backend/src/modules/marketplace/store-onboarding.routes.ts` (L173–186):
     `StoreOnboardingInput.actorId` tipado como «ID da empresa/loja» (actor page).
     Quando ausente, o fallback usa JWT user id. Corrigir via `ensureUserActor`
     resolveria actor **USER**, não actor **PAGE** — quebra a semântica do serviço que usa
     `actorId` em `importCategories`, `merchantId`, `storeId`. O fix exige decisão de
     produto: como criar loja sem `companyId` previamente criada?

  4. `backend/src/core/reporting/reporting.routes.ts`: persiste `actor_id` em
     `report_events`, mas `report_events.actor_id` historicamente recebe
     `reporter_user_id` (ver `reporting.service.ts` L55–67 em `createReport`).
     É convenção do módulo, não response HTTP exposto. Fora do escopo de C12.

- **Opções consideradas:**

  A. Corrigir tudo o que foi listado como «C12» no STATUS original  
     Prós: fecha um item completo.  
     Contras: mistura bug de atribuição com dívida de produto. Cultural e
     store-onboarding exigem decisões de produto que a FASE 4 não deve tomar.
     Pode introduzir breaking changes funcionais (check-in de terceiro) ou
     semânticos (loja = user, não page).

  B. Corrigir apenas `identity.routes` + tentar cultural com `ensureUserActor`  
     Prós: fecha dois dos três.  
     Contras: breaking change em cultural (perde check-in de terceiro).
     Store-onboarding continua não resolvido.

  C. Deixar C12 OPEN até a FASE 6 resolver tudo junto  
     Prós: abordagem unificada.  
     Contras: limbo. `identity.routes` tem fix trivial disponível **hoje**.
     Manter OPEN por semanas sem progresso prejudica a rastreabilidade.

  D. Reclassificação: C12 = `identity.routes` apenas (escopo reduzido).
     Criar **C50** (cultural) e **C51** (store-onboarding) como novas violações
     com escopo preciso. Reporting permanece como observação documentada.

- **Escolha:** Opção D

- **Justificativa:**
  Honestidade arquitectural: o que foi listado como «C12 genérico» não era
  homogéneo. Dois itens são bug de atribuição (identity) e dois são dívida de
  produto (cultural, store-onboarding). Separar torna cada violação
  accionável e específica.
  Já existe precedente: C1 foi reclassificado via DECISION-0007 (amputação
  controlada por caminho), C3 via DECISION-0008 (dois helpers centrais, não
  três INSERTs). Reclassificação honesta é padrão saudável desta remediação.

- **Plano de execução:**

  1. **Fix único:** `identity.routes.ts`
     - Wallet (L797–804): `globalUserId:` usar o valor já resolvido (L754–755).
     - Ledger (L879–883): `globalUserId:` usar **`globalUserId2`** já resolvido (L838–839).
     - Wallet (L773–776): `getTransactionsByGlobalUserId(<globalUserId resolvido>, …)`.
     **Atenção:** em wallet a variável correcta é `globalUserId`; em ledger é `globalUserId2`.
     Não copiar o nome da variável entre rotas.

  2. Registar **C50** em `SYSTEM_REMEDIATION_STATUS.md`:  
     Severidade: MEDIUM. Descrição: cultural check-in usa `globalUserId` como `actor_id`;
     falta função canónica global→actor; TODO no código remete a «ator ativo PF/PJ/PAC»;
     requer decisão de produto na FASE 6. Ficheiro: `cultural.routes.ts`. Status: OPEN.
     Deadline: FASE 6.

  3. Registar **C51** em `SYSTEM_REMEDIATION_STATUS.md`:  
     Severidade: MEDIUM. Descrição: store-onboarding usa JWT user id como fallback de `actorId`;
     contrato espera actor PAGE (loja/empresa), mas fallback implícito seria USER;
     requer decisão de produto: como criar loja sem `companyId` prévia? FASE 6.
     Ficheiro: `store-onboarding.routes.ts`. Status: OPEN. Deadline: FASE 6.

  4. **Observação** (não nova violação): `reporting.report_events.actor_id` recebe
     `reporter_user_id` por convenção histórica do módulo. Padronização eventual
     pertence à FASE 6/7 se houver RFC de «`actor_id` = `actors.id` uniforme em todas as tabelas».

- **Consequências esperadas:**

  - Curto prazo:
    * `GET /identity/wallet` e `GET /identity/ledger` devolvem `globalUserId` canónico.
    * Contrato interno `getTransactionsByGlobalUserId` alinhado (stub hoje,
      correcto para quando for implementado).
    * C12 FIXED; C50 + C51 OPEN.
    * Contagem: OPEN 28 → 27 (−C12) + 2 (C50+C51) = **29 OPEN** final.
    * FIXED: 9 → 10.
    * Nota de contagem: o aumento temporário de OPEN reflecte uma realidade mais
      fina, não regressão. Violações mais específicas são accionáveis.

  - Médio prazo:
    * FASE 6 trata C50 (resolução global→actor canónica) e C51 (fluxo de criação
      de loja sem company prévia) com decisões de produto.

- **Responsável:** Clayton
- **Validação prévia:** Cursor (auditoria transversal C12 + confirmação técnica
  de quatro contratos) + Claude (análise de escopo) + ChatGPT (confirmação da opção D)
- **Supera:** nenhuma
- **Superada por:** (a preencher quando aplicável)
- **Referências:**
  - `backend/src/core/identity/identity.routes.ts` (L754–755, L797–804, L773–776, L838–839, L879–883)
  - `backend/src/core/identity/identity.utils.ts` (`resolveGlobalUserId` L30–56)
  - `backend/src/modules/cultural/cultural.routes.ts` (L494–515)
  - `backend/src/modules/marketplace/store-onboarding.routes.ts` (L173–186)
  - `backend/src/modules/marketplace/store-onboarding.types.ts` (L14–17, L33–35)
  - DECISION-0007 (precedente de reclassificação — C1)
  - DECISION-0008 (precedente de reclassificação — C3)

---

**FIM DO DOCUMENTO** (continua crescendo por append a cada decisão)

### DECISION-0010 — C44: alinhar marketplace/group.repository ao schema Genesis

- **Data:** 2026-04-22
- **Tipo:** arquitetural (schema drift)
- **ID da violação:** C44

- **Contexto:**
  backend/src/modules/marketplace/group.repository.ts usa 3 colunas que nao
  existem no schema Genesis da tabela groups:
  - parent_group_id
  - created_by_actor_id
  - created_by_user_id

  Schema Genesis real de groups: id, tenant_id, name, description, slug,
  actor_id, owner_actor_id, status, metadata, created_at, updated_at.

  O repository faz INSERT, SELECT e WHERE sobre essas colunas inexistentes —
  qualquer chamada falha em runtime.

- **Opcoes consideradas:**

  A. Alinhar codigo ao Genesis (remover colunas fantasmas, usar actor_id).
     Pros: zero drift, zero migration, consistente com §4.8 LEI
     (ensureUserActor), estabiliza o repository.
     Contras: perde funcionalidade de groups aninhados (parent_group_id)
     que ainda nao existia na pratica.

  B. Estender schema com migration nova (adicionar as 3 colunas).
     Pros: preserva ambicao de groups aninhados.
     Contras: introduz produto (hierarquia) sem RFC, duplica identidade
     (user + actor), abre superficie de inconsistencia, FASE 4 nao deve
     tomar decisao de produto.

- **Escolha:** Opcao A

- **Justificativa:**
  FASE 4 e estabilizacao, nao extensao de produto. Colunas fantasmas nunca
  funcionaram em runtime — nao ha funcionalidade real para preservar.
  Alinhamento ao Genesis elimina drift sem decisao de produto pendente.
  Groups aninhados, se algum dia forem necessarios, devem entrar via RFC
  em FASE 6+, nao por inercia de codigo legado.

- **Plano de execucao:**
  1. Remover parent_group_id de todas as queries (INSERT, SELECT, WHERE)
  2. Remover created_by_user_id de todas as queries
  3. Substituir created_by_actor_id por actor_id (coluna real do Genesis)
  4. Gates 4/4 PASS + tsc sem erros novos
  5. Commit unico do repository
  6. Documentacao (STATUS FIXED + snapshot + execution log)

- **Consequencias esperadas:**
  - Repository marketplace/group alinhado ao Genesis
  - Zero migration nova
  - Contagem: OPEN 29 → 28, FIXED 10 → 11
  - Funcionalidade de groups aninhados adiada para FASE 6+ se necessaria

- **Divida registrada:**
  Se produto decidir implementar groups aninhados no futuro, requer RFC
  proprio e migration forward-only.

- **Responsavel:** Clayton
- **Validacao previa:** Claude + ChatGPT (analise de trade-offs Opcao A vs B)
- **Supera:** nenhuma
- **Referencias:**
  - backend/src/modules/marketplace/group.repository.ts (arquivo afetado)
  - backend/migrations/20260530180000_groups.sql (schema Genesis)
  - LEI §4.8.1 (ensureUserActor)

---

## FASE 5 — Decisões C2 (2026-04-24 a 2026-04-25)

### DECISION-C2-001: Estratégia de rollout concept_id
- **Data:** 2026-04-24
- **Decisão:** Opção B (NULL-first) — ADD COLUMN NULL → seed → writers → call sites → NOT NULL
- **Justificativa:** evita quebrar call sites existentes antes de propagação completa
- **RFC:** docs/02_decisions/RFC_C2_rollout.md

### DECISION-C2-002: Nome da coluna concept_id (não concept_ref)
- **Data:** 2026-04-24
- **Decisão:** `concept_id` conforme 07_NOMENCLATURA §4.4 (FK = <entidade>_id)
- **RFC:** docs/02_decisions/RFC_C2_bank_transactions_concept_link.md

### DECISION-C2-003: 24 concepts financeiros aprovados
- **Data:** 2026-04-24
- **Decisão:** 24 slugs em 7 domínios (payment, escrow, payout, treasury, reversal, fund, gateway)
- **Regras:** concept = intenção econômica atômica; mesma mutação = mesmo concept
- **RFC:** docs/02_decisions/RFC_C2_seed_concepts_financeiros.md

### DECISION-C2-004: payment-execution.service.ts em PENDÊNCIA RFC
- **Data:** 2026-04-25
- **Decisão:** 6 paths do payment-execution.service.ts fora do escopo 3-B
- **Justificativa:** concepts necessários (marketplace-payment-escrow, etc.) não existem nos 24 aprovados
- **Ação:** RFC dedicado antes de incluir no 3-B

### DECISION-C2-005: Gate architectural — regra formal por commit
- **Data:** 2026-04-25
- **Decisão:** gate architectural passa se interseção entre arquivos modificados e arquivos com violações for vazia
- **Justificativa:** violações pré-existentes em outros módulos não devem bloquear C2 rollout

### DECISION-C2-006: distribution.service.ts excluído do 3-B
- **Data:** 2026-04-25
- **Decisão:** distribution.service.ts chama transaction.service.ts (wrapper), não o writer diretamente
- **Justificativa:** wrapper já cobre esses paths via PROPAGATED

### DECISION-C2-007: commit 50fdd78f aceito com mudanças extras
- **Data:** 2026-04-26
- **Decisão:** Commit do path#20 incluiu refatorações pré-existentes em bank-integration.service.ts além do concept_id. Aceito porque:
  (a) 4 gates PASS
  (b) mudanças são correções canônicas T1/T5 (ensureUserActor, amountCents, requestAndExecuteReversalSync)
  (c) commits #21-23 estão limpos (1 insertion cada confirmado via git show --stat)
- **Justificativa:** Arquivo tinha alterações não commitadas no working tree antes da sessão. Mudanças são alinhamentos canônicos válidos (actor-writer §4.8.1, tipagem monetária §4.7).

### DECISION-C2-008: Passo 3-C bloqueado por RFC
- **Data:** 2026-04-26
- **Decisão:** concept_id não pode ser tornado obrigatório (3-C) até que os seguintes call sites tenham concepts aprovados via RFC:
  - payment-execution.service.ts: linhas 434, 951, 967, 1046, 1144, 1212 (6 paths)
  - transaction.service.ts: linha 36 (1 path wrapper)
  - financial-simulator.controller.ts: linhas 113, 127 (dev/observability — pode ser excluído)
- **Ação:** RFC dedicado para novos concepts antes da próxima sessão de 3-C.
- **Justificativa:** Tornar concept_id obrigatório no DTO sem concepts para esses call sites causaria erro de compilação TypeScript.

---

