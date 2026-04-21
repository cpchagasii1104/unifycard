# REMEDIATION DECISIONS LOG

**Documento append-only. Toda decisão arquitetural tomada durante a remediação é registrada aqui.**
**Uma decisão registrada nunca é editada. Se superada, adicionar nova entrada referenciando a anterior.**

| Metadado | Valor |
|---|---|
| Criado | 2026-04-21 |
| Última entrada | DECISION-0004 (2026-04-21) |
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

*(Próxima entrada: DECISION-0004)*

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

**FIM DO DOCUMENTO** (continua crescendo por append a cada decisão)
