# MEMÓRIA CODEX — UnifiCard / UnifyBank

**Versão:** v1.2 (2026-05-17)
**Origem:** consolidação pós-sessão de triagem working tree (commit `c0ac7a89`)
**Compatível com:** branch `rescue-structural`

---

## Changelog

- **v1.2 (2026-05-17):** formaliza Codex como responsável por frontend/projeção contextual, com fronteiras materiais recebidas da Claude Code para actor, mode, capabilities, endpoints e DT-PRESSURE.
- **v1.1 (2026-05-17):** registra divisão operacional Codex/Claude Code: backend como verdade causal e frontend como projeção contextual, com responsabilidade separada sem soberania paralela.

---

## 0. PROPÓSITO E LIMITES DESTE ARQUIVO

Este arquivo é a **memória persistente do Codex** entre sessões no projeto UnifiCard/UnifyBank.

Serve para:
- Acumular aprendizado operacional durável sobre o sistema
- Permitir que próxima sessão de Codex (ou outra IA) entre com contexto técnico real
- Registrar padrões de execução validados
- Preservar achados arquiteturais que valem lembrar

**Este arquivo NÃO é:**
- Documento normativo (não tem autoridade institucional)
- Substituto da Constituição, Leis, SSOT Registry ou outros canônicos
- Memória do estado atual do sistema (isso é o `STATUS_EXECUCAO_GLOBAL.md`)
- Protocolo de operação (isso é o `UNIFICARD_SESSION_BOOT_PROTOCOL.md`)
- Plano de execução

**Regra de prevalência (em caso de conflito):**

```
1. Constituição, Leis, SSOT, Migrations, código real
2. STATUS_EXECUCAO_GLOBAL.md (estado vivo)
3. BOOT/EXIT PROTOCOL (como operar)
4. REMEDIATION_DECISIONS_LOG.md (decisões formais)
5. ESTA MEMÓRIA (apenas mapa operacional, não autoridade)
```

Se esta memória conflitar com qualquer item de 1-4, esta memória perde.

---

## 1. ESTADO DE REFERÊNCIA

⚠️ **ATENÇÃO:** este bloco fica obsoleto a cada sessão fechada.
**Sempre confirme contra o repositório antes de prosseguir.**

| Campo | Valor de referência (snapshot 2026-05-06) |
|---|---|
| HEAD | `c0ac7a89 docs(status): registra fechamento da sessao 2026-05-05` |
| Branch | `rescue-structural` |
| Working tree esperado | ~1124 itens não-`node_modules` (com resíduos classificados) |
| `CORE_PURITY_SUMMARY` | `total=1278 modules_import=68 fastify_http=319 sql_direct=891` |
| Última sessão fechada | 2026-05-05 — Triagem completa do working tree |
| Próxima sessão sugerida | DT-build-alias |

**Como confirmar estado real:**
```powershell
git log -1 --oneline
git status --short | Where-Object { $_ -notmatch 'node_modules' } | Measure-Object -Line
git branch --show-current
node C:/unificard/scripts/validate-core-purity.mjs 2>&1 | Select-String "CORE_PURITY_SUMMARY"
```

Se qualquer valor divergir de forma inesperada → **PARAR**, reportar a Clayton.

**Working tree NÃO está vazio é INTENCIONAL.** Os itens restantes estão classificados em DTs ou bloqueios documentados. Não tratar como "sujeira a limpar".

---

## 2. CONHECIMENTO DURÁVEL — O QUE É O SISTEMA

### 2.1 Identidade do projeto

- **Plataforma financeira multi-tenant** em Node.js/TypeScript/PostgreSQL
- Não é app, não é marketplace comum — é **infraestrutura econômica programável**
- Repositório: `C:\unificard\` (Windows/PowerShell)
- Arquitetura: NestJS com hierarquia normativa explícita
- Tese central: dinheiro flui por caminhos auditáveis; identidade é inviolável; semântica é explícita; história é imutável

### 2.2 Princípio supremo

> "O sistema é único. Nenhuma camada pode criar uma realidade paralela."

Implicações práticas:
- Um fato → uma fonte de verdade (SSOT)
- Um conceito → um nome
- Uma pessoa/entidade → um actor
- Uma transação financeira → passa pelo Bank

### 2.3 Hierarquia normativa (precedência)

```
Constituição (12 Artigos, imutáveis)
  ↓
Leis Operacionais (7 Leis)
  ↓
CORE_IMUTÁVEL
  ↓
Lei de Coerência Sistêmica
  ↓
Contratos de domínio (CORE_*_CONTRACT.md)
  ↓
SSOT Registry
  ↓
Ontologia de Domínios (12 N0)
  ↓
Demais documentos normativos
  ↓
Código
```

Em conflito, nível superior prevalece. Sempre.

### 2.4 Pilares canônicos

```
SEMÂNTICA → IDENTIDADE → AUTORIDADE → TEMPO → ESTADO → FINANCEIRO → EVENTO
```

Os 6 pilares operacionais citados na Lei de Coerência:
- **money** (financeiro)
- **time** (temporal)
- **identity** (identidade)
- **state** (estado)
- **event** (evento)
- **authority** (autoridade)

**Regra de composição:** não trocar causa por efeito. Quando aplicável, respeitar Mutation → Estado → Dinheiro → Evento.

### 2.5 Tabela de SSOTs (referência operacional)

| Domínio | SSOT | Writer autorizado | Observação |
|---|---|---|---|
| Dinheiro | `bank_ledger`, `bank_transactions` | `modules/bank/*` exclusivo | Única fonte de saldo |
| Identidade | `actors` | `actor-writer.service.ts` (`ensureUserActor`) | Nunca bypass |
| Semântica | `concepts` | `concept-governance.service.ts` | Governa significado |
| Quantidade | `inventory_movements` | append-only | Sem mutação direta |
| Tempo | `unified_availability`, `unified_bookings` | services dedicados | `schedules`/`schedule_slots` é READ-ONLY |
| Autoridade | LEI §4.9 | `authority-decision.service.ts` | Gate obrigatório |

**Regra absoluta:** nunca inferir estado fora do SSOT correspondente.

### 2.6 Distinções críticas (não confundir)

| Conceito | É | NÃO é |
|---|---|---|
| Identity | Quem é (CPF, autenticação) | Papel, permissão, conta |
| Actor | Quem age (entidade operacional) | Identity, perfil |
| Permission | O que pode fazer | Herdada de identity |
| Authority | Quem autorizou (cadeia rastreável) | Apenas permissão |
| `actor_id` | Operacional | ≠ `user_id` ≠ `global_user_id` |
| CONCEPT | SSOT semântico (UUID `canonical_id`) | `slug`, `metadata`, `category_id`, `canonical_product` |
| `app.builder` | Prova de vida operacional | Soberania/SSOT |

---

## 3. NOMENCLATURA CANÔNICA RESUMIDA

### Banco de dados

| Conceito | Padrão |
|---|---|
| Tabelas | `snake_case`, plural |
| Chave primária | `id` |
| Chave estrangeira | `<entidade>_id` |
| Timestamps | sufixo `_at`, tipo `TIMESTAMPTZ` |
| Dinheiro | sufixo `_cents`, tipo BIGINT (inteiro em centavos) |
| Taxas percentuais | sufixo `_bps` (basis points; 100 = 1%) |
| Booleanos | prefixos `is_`/`has_`/`can_`/`should_`/`was_`/`requires_`, default explícito |
| Moeda | ISO 4217 (`BRL`, `USD`, etc.) |
| Status/lifecycle | lowercase, snake_case |
| Soft delete | `deleted_at IS NULL = ativo` (não `is_deleted`) |

### Código

| Conceito | Padrão |
|---|---|
| Services | `*.service.ts` |
| Repositories | `*.repository.ts` |
| Routes | `*.routes.ts` |
| Types | `*.types.ts` |
| Schemas (zod) | `*.schemas.ts` |

### Proibições

- Float para dinheiro → SEMPRE centavos em BIGINT
- `parseFloat` em valores monetários
- `lat/lng` → usar `latitude/longitude`
- `qty` → usar `quantity`
- `duration_min` → usar `duration_minutes`
- `entry_type` em `bank_ledger` → usar `direction` (`'credit'|'debit'`)
- `owner_id` em `bank_accounts` para busca por actor → usar `actor_id`

---

## 4. RISCOS CONHECIDOS E ZONAS PROIBIDAS

### Zonas que exigem cautela máxima

- `backend/src/*` — código de produção, **NÃO** é área de limpeza casual (regra B4)
- `frontend/src/*` — UI, **bloqueado** sem autorização (regra B4 estendida)
- `backend/migrations/*` — forward-only, IF NOT EXISTS obrigatório, numeração sequencial
- `docs/01_normative/*` — texto propositivo dentro de canônico é risco mesmo se arquivo já modificado
- `scripts/*-baseline.json` — congelados, afetam gates ativos

### Proibições financeiras

- Código fora de `modules/bank/` acessar `bank_ledger`, `bank_transactions`, `bank_accounts` ou `bank_splits` — proibido
- Calcular saldo próprio fora do Bank — proibido
- Criar ledger paralelo — proibido
- Inferir posição financeira — proibido
- Definir locking (`FOR UPDATE`) sobre SSOT financeiro fora do Bank — proibido
- UPDATE em `bank_ledger` — proibido (append-only)
- Estorno via UPDATE — usar nova transação compensatória

### Proibições de identidade

- `INSERT INTO actors` direto fora do writer canônico — proibido
- Inferir Actor a partir de Identity — proibido
- Assumir Actor default — proibido
- Herdar permissão implicitamente — proibido

### Proibições operacionais

- `git gc`, `git prune`, `git reflog expire` — NUNCA rodar (avisos de loose objects são esperados, ignorar)
- Limpeza destrutiva sem ordem explícita — proibido
- `git add .` em working tree massivo — proibido (stage explícito por arquivo ou diretório classificado)
- Tratar `node_modules` como alteração de código — não é, reportar como ruído

### Authority (atenção especial)

- Authority NÃO é só middleware
- Deve convergir para serviço/fachada testável + mapa canônico de permissões
- Ser `responsible_actor_id` é **responsabilidade civil** (CPF ancorado), NÃO permissão operacional automática

### Profile

- `profiles`/read model NÃO define semântica de domínio
- `Profile` é projeção, não fonte de verdade

---

## 5. COMO OPERAR (padrões validados)

### Modo padrão

- **GUARDIÃO** (read-only) até Clayton declarar escopo
- Uma sessão = um único problema (Lei §1)
- Nunca misturar: limpeza de raiz + código de produção + migrations + gates + documentação normativa

### Antes de qualquer mudança substantiva

Declarar:
1. Qual domínio/pilar tocado
2. Quais documentos lidos
3. Por que são suficientes
4. Qual SSOT governa
5. Qual pilar afetado

Se domínio for ambíguo → declarar a ambiguidade e parar para decisão humana.

### Atomicidade obrigatória

```
1 alteração → build → 4 gates → commit → próxima
```

- Cada commit revalida 4 gates (actor-writer, bank-ledger, regression-guards, architectural-patterns)
- `CORE_PURITY_SUMMARY` deve permanecer inalterado
- Drift detectado → STOP, **nunca** corrigir silenciosamente

### Anti-fast-track de cabeça

Antes de commit em massa:
- Rodar scripts de contagem
- Abortar se contagem divergir do esperado
- Stage **sempre explícito** por arquivo ou diretório já classificado
- Conferir `git diff --cached --name-only` para garantir escopo

Se aparecer surpresa → parar fast track, voltar para leitura/auditoria.

### Cherry-pick

- Um commit por vez
- Build/gate após cada passo
- Em caso de conflito: **NÃO** resolver por intuição → reportar erro/diff

### Cadeia de auditoria (Hipótese #019)

Para classificar arquivos core/modules:

```
Norma → SSOT Registry → Builder → Imports → Execução
```

Auditoria NÃO é por pasta (`core/` vs `modules/`). É por **soberania**.

### Ordem operacional fixa

```
SEMÂNTICA → IDENTIDADE → QUARENTENA → AUTORIDADE → TEMPO → ESTADO → FINANCEIRO → EVENTO
```

---

## 6. FONTES PARA PRIORIZAR (em ordem de uso)

### Estado vivo
- `STATUS_EXECUCAO_GLOBAL.md` — memória operacional das sessões (LER PRIMEIRO)
- `SYSTEM_REMEDIATION_STATUS.md` — estado das violações C1–C66+
- `REMEDIATION_DECISIONS_LOG.md` — log append-only de decisões formais

### Protocolo
- `UNIFICARD_SESSION_BOOT_PROTOCOL.md` — como entrar em sessão (kit ops do Clayton)
- `UNIFICARD_SESSION_EXIT_PROTOCOL.md` — como fechar sessão (kit ops do Clayton)

### Normativos canônicos
- `docs/01_normative/00_AGENT_PROTOCOL.md` — protocolo de operação de agentes
- `docs/01_normative/CONSTITUICAO_UNIFICARD.md` — limites institucionais superiores
- `docs/01_normative/LEIS_OPERACIONAIS_UNIFICARD.md` — 7 leis de execução
- `docs/01_normative/LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` — coerência macro
- `docs/01_normative/CORE_IMUTAVEL.md` — núcleo intocável
- `docs/01_normative/07_NOMENCLATURA_CANONICA.md` — padrões canônicos
- `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md` — registry de SSOTs
- `docs/01_normative/18_DOMAIN_ONTOLOGY_UNIFICARD.md` — ontologia 12 N0

### Snapshots de pesquisa (podem estar desatualizados — confirmar no código real antes de editar)
- `SRC_FULL.txt` — snapshot consolidado do `backend/src/`
- `MIGRATIONS_FULL.txt` — snapshot consolidado das migrations
- `01_NORMATIVE_FULL.txt` — normativos consolidados
- `SSOT_FULL.txt` — SSOT registry consolidado

### Planejamento macro
- `SYSTEM_REMEDIATION_PLAN.md` — plano macro fases 4-8
- `PLANO_MESTRE_remediacao_core_modules.md` — roteiro 22 sessões core↔modules
- `PLANO_CORRECAO_NOMENCLATURA.md` — plano 18 sessões EIXO 1-8
- `PLANO_BASE_MODULO.md` — base normativa de §GLOBAL BLOCK

### Auxiliares
- `ESTOU_APRENDENDO.md` — transferência de conhecimento (NÃO normativo, NÃO substitui leitura da fonte)
- `00_INDEX.md` / `00_SUMARIO.md` — ajudam a navegar normativos, NÃO substituem leitura do documento real

---

## 7. GLOSSÁRIO OPERACIONAL

| Termo | Significado |
|---|---|
| **CXX** (C1, C2, C66...) | Violações rastreadas do sistema (em `SYSTEM_REMEDIATION_STATUS.md`) |
| **DECISION-XXXX** | Decisão formal registrada (append-only, em `REMEDIATION_DECISIONS_LOG.md`) |
| **DT-XXX** | Débito técnico aberto (descrição + severidade + plano) |
| **G1, G2** | Gaps estruturais numerados (CI / E2E transversal) |
| **Cluster A/B/C** | Agrupamentos de remediação core↔modules |
| **D1–D6** | Decisões bloqueantes do PLANO_MESTRE (apenas Clayton decide) |
| **SSOT** | Single Source of Truth |
| **Fail-closed** | Erro explícito (503), nunca fallback silencioso |
| **CORE_PURITY** | Métrica estrutural de pureza arquitetural (baseline 68/319/891) |
| **RFC** | Documento propositivo (pode estar em rascunho) |
| **N0/N1/N2** | Níveis da ontologia de domínios (12 N0 core) |
| **ATL/KYC/GUARDA** | Sequência de validação financeira (em `bank-transaction.service.ts`) |
| **Outbox pattern** | Eventos na mesma transação que writes; eventos como consequência, nunca causa |
| **Hipótese #019** | Repurificação da fronteira core/modules (origem do gate `validate-core-purity`) |
| **regra B4** | Bloqueio de `backend/src/*` durante sessões de triagem |
| **TURBO v5** | Protocolo de classificação rigorosa antes de edição (str_replace exato + diff < 10 linhas) |
| **§GLOBAL BLOCK** | Regra normativa em `PLANO_BASE_MODULO.md` |

---

## 8. ACHADOS ARQUITETURAIS DURÁVEIS

Aprendizados que valem lembrar entre sessões. **Apenas** descobertas que afetam decisões futuras.

### 8.1 `.gitignore` raiz quebrado em UTF-16 LE (resolvido)

**Sintoma histórico:** desde commit `70579227 [REBASE-03]` (2026-02-11), `.gitignore` raiz estava em UTF-16 LE com 236 NULs em 502 bytes. Nenhuma regra do `.gitignore` raiz foi aplicada por 3 meses.

**Resolvido em:** `5b410c17` (UTF-8 + dumps de sessão) e `4f066536` (mojibake `*.bak` corrigido).

**Lição operacional:** ao editar `.gitignore`, validar:
- Zero NULs no arquivo
- Sem mojibake em regras
- `git check-ignore` confirmando que regra funciona

### 8.2 DT-build-alias (aberta, prioritária)

**Estado:** `tsc-alias` foi removido do script `build` em commit `70579227 [REBASE-03]`.

**Sintomas:**
- `pnpm build` passa
- `dist/` emite imports literais `@core/` e `@modules/` (1464 não resolvidos)
- `pnpm start` (`node dist/...`) quebraria em runtime

**Decisão:** próxima sessão sugerida (gatilho de retomada). Sessão dedicada para restaurar o `tsc-alias` no script `build`.

### 8.3 DT-packages-artifacts-tracked (aberta)

**Estado:** 157 arquivos rastreados indevidamente em:
- `packages/contracts/dist/`
- `packages/contracts/node_modules/`
- `packages/contracts/tsconfig.tsbuildinfo`

**Origem:** desde commit `2a849424`.

**Plano:** `git rm --cached` + atualizar `.gitignore` + auditoria de consumers.

### 8.4 DT-nomenclatura-canonica-v3-revisao (CRÍTICA, aberta)

**Estado:** `docs/01_normative/07_NOMENCLATURA_CANONICA.md` modificado v2.0→v3.3.6 (+4884/-1120 linhas) contém trecho propositivo "Sugiro adicionar Parte VI...".

**Risco:** texto propositivo em documento normativo canônico = mistura de proposta com norma vigente.

**Bloqueio:** não commitar sem revisão redacional dedicada.

### 8.5 DTs adicionais ativas

- **DT-migrations-resetadas-decisao** (Média): `backend/migrations-resetadas/` (10 arquivos) untracked, decidir destino
- **DT-seed-035-tenant-id-rename** (Alta): `backend/seeds/035_seed_demo_city_nova_beauty.sql` troca `tenant_id` por `id`, validar contra schema vivo
- **DT-stashes-revisao** (Baixa): 4 stashes preservados sem inspeção profunda
- **DT-archive-ps1-quarentena** (Baixa): 10 `.ps1` em `docs/99_archive/`
- **DT-baseline-architectural-patterns-congelado** (Média): `scripts/architectural-patterns-baseline.json` modificado, congelado

### 8.6 C66 — slug vs UUID em `concept_id`

**Achado:** os 4 callers do wrapper LEGACY (`distribution.service`, `split.service`, `social-work-payment.service`, `test-currency.service`) **já possuem** linhas `concept_id`. A descrição antiga "4 callers sem concept_id" está obsoleta.

**Problema atual:** callers passam slug semântico (string) como `concept_id`, mas o banco espera UUID/FK para `concepts.canonical_id`.

**Implicação:** mover o acesso para Bank sem resolver isso apenas desloca o bug. Resolver mapeamento slug → UUID antes de remediar callers.

### 8.7 Wrappers LEGACY em `core/economy/`

- `core/economy/account.service.ts` — wrapper LEGACY que importa `modules/bank` direto
- `core/economy/transaction.service.ts` — wrapper LEGACY que importa `modules/bank` direto

Não remediar `transaction.service.ts` sozinho. Antes:
1. Classificar os 4 callers como subcluster dependente
2. Decidir a fronteira financeira correta (Decisão D1 do PLANO_MESTRE)

### 8.8 Onda de governança normativa consolidada

**Marco institucional 2026-05-05:** 117 arquivos da onda editorial foram registrados como baseline canônico vigente em 6 commits temáticos (`116fa226` a `c55d7c04`).

**Importante:** essa consolidação NÃO constitui revisão/aprovação formal individual. Registra como vigente o que já era praticado operacionalmente. Revisões redacionais específicas seguem como sessões dedicadas (ex: DT-nomenclatura-canonica-v3-revisao).

### 8.9 Reorganização de banco/migrations

Houve reorganização forte com "genesis" e arquivamento de legado. Distinguir sempre:
- Migrations vivas (`backend/migrations/`)
- Migrations arquivadas (`backend/migrations-resetadas/` ou similares)
- Schema atual no banco

**Não confundir esses três planos.** Schema atual é fonte de verdade para o que existe agora.

### 8.10 Divisão operacional Codex/Claude sem soberania paralela

**Aprendizado 2026-05-17:** a divisão saudável no estágio atual do UnifiCard é responsabilidade separada, não dois sistemas paralelos.

**Claude Code tende a ser mais adequada para backend, causalidade e integridade material:**
- schema, migrations, services, writers, runtime e smoke E2E;
- ledger, authority, actor chain, inventory, supply, invariantes e SSOT;
- pergunta-guia: "isso é semanticamente verdadeiro no runtime?"

**Codex tende a ser mais adequada para frontend, gramática operacional e projeção contextual:**
- UX contextual, vocabulário, navegação, dashboards, intent maps e business profiles;
- actor projection, operating mode, cards, readiness e experiência por vertical;
- pergunta-guia: "isso faz sentido para quem está usando agora?"

**Invariante:** backend é verdade causal; frontend é projeção. O frontend reorganiza, renomeia, prioriza e revela contexto, mas não cria capability, authority, estado paralelo ou fluxo causal inexistente.

**Risco a evitar:** backend virar "API de suporte do frontend" ou frontend virar "simulador de sistema futuro". Gaps encontrados no front devem virar pressão material/DT, não workaround silencioso.

**Business profile:** pode expressar `semanticVocabulary`, `contextualPriorities`, `operationalShortcuts` e `dashboardProjection`, mas não deve virar mini ERP hardcoded, schema próprio, engine própria ou soberania própria.

### 8.11 Codex como frente de frontend/projeção contextual

**Papel assumido 2026-05-17:** Codex passa a ser a frente principal de frontend do UnifiCard, cuidando de UX, vocabulário, contexto, actor projection, operating mode, intent maps e business profiles, sem tocar backend por iniciativa própria.

**Regra central:** frontend pode preparar visão e experiência, mas não cria verdade. Backend/DB/Claude Code seguem como fonte causal para dados, writers, permissões, authority, saldos, estoque, ledger, agenda soberana e runtime.

**Fontes materiais recebidas da Claude Code:**
- Actor ativo no frontend: `useSession().activeActor`. `localStorage['unificard_active_actor_id']` é cache de escolha, não SSOT.
- Actor ativo no backend: `req.actionContext.actorId`.
- Actor types materializados: `user`, `page`, `group`, `channel`. Não tratar `resource`, driver, seller, organizer etc. como actor types.
- `mode` (`consumir`/`operar`) é projeção frontend pura hoje. Não é persistido no backend e não participa de authority.
- `businessProfile` é vocabulário/projeção temporária hoje. Material relacionado existente: `companies.activity` e `company_types`, mas sem campo SSOT chamado `businessProfile`.
- Endpoint agregado `/me/capabilities` não existe até onde auditado. Não depender dele.

**O que Codex pode fazer sem autorização backend:**
- layout, cards, abas, textos, badges, empty states honestos, skeletons, tooltips, navegação e organização contextual;
- intent maps por `actorType` + `mode` + projeção de `businessProfile`;
- placeholders explícitos quando não houver dado real;
- leitura de endpoints já expostos e auditados.

**O que Codex não pode fazer no frontend:**
- persistir capabilities, saldos, listas operacionais ou authority em `localStorage`;
- simular autorização, delegation, estoque, fornecedor, saldo, pedido ou número financeiro;
- esconder algo como se fosse segurança;
- inventar endpoint, envelope, shape ou dado operacional quando o backend não expõe;
- criar workaround para gap material.

**Regra para esconder/mostrar:** esconder, agrupar ou renomear é UX. Permitir, negar, validar ou persistir é causalidade backend. Quando a fronteira não estiver clara, registrar DT-PRESSURE ou perguntar à Claude Code/Clayton.

**Endpoints seguros catalogados para home/dashboard, sujeitos a revalidação antes de uso profundo:**
- `GET /social/actors/available`
- `GET /profile`
- `GET /companies/:id`
- `GET /companies/:id/members`
- `GET /bank/balance`
- `GET /bank/statement`
- `GET /marketplace/inventory/balance?variantId=X`
- `GET /marketplace/inventory/balance/by-actor?actorId=Y&variantId=X`
- `GET /marketplace/inventory/movements?variantId=X`
- `GET /purchase-orders` e variantes já expostas

**Endpoints/zones com cuidado explícito:**
- Não usar `GET /marketplace/inventory/available`: backend não existe até onde auditado.
- Não assumir `POST /marketplace/inventory/movements`: pendente.
- Não tocar fornecedor/supplier até resolução do drift `ACTIVE` vs `active`.
- Consultar Claude Code antes de acoplar CRM, PDV, orders, lots, agenda/unified availability, bank/ledger, inventory SSOT, actors, actor_delegations ou qualquer fluxo causal.

**DT-PRESSURE:** se uma fricção de UX revelar necessidade real de backend, registrar como pressão material auditável em vez de resolver no frontend.

---

## 9. CONDUTA POR CENÁRIO

### Cenário: Clayton diz "leia a Memória Codex"

1. Ler este arquivo como **pré-boot de contexto**
2. **Confirmar** o estado de referência (§1) contra o repositório real
3. Se HEAD ou working tree divergir, reportar e atualizar §1 sob orientação de Clayton
4. **Ainda assim** ler `STATUS_EXECUCAO_GLOBAL.md` (estado vivo prevalece)
5. **Ainda assim** seguir `BOOT_PROTOCOL.md` (protocolo de entrada vigente)

### Cenário: outra IA pede informação

Responder com fatos auditados e comandos seguros, sem editar.

Distinguir explicitamente:
- "Confirmado pelo Codex nesta sessão"
- "Confirmado pela Claude Code"
- "Registrado em memória, mas não revalidado nesta sessão"

### Cenário: coordenação Codex/Claude Code

Divisão operacional válida enquanto não conflitar com documentos normativos, código real ou decisão explícita de Clayton:

1. Codex pode evoluir frontend, UX, vocabulário, projeção contextual e intent maps quando não inventar estado paralelo.
2. Claude Code deve proteger backend, causalidade, migrations, writers, authority, ledger e SSOT.
3. Codex pergunta: "qual experiência operacional faz sentido?"
4. Claude Code pergunta: "isso existe causalmente, qual é o writer e qual é o SSOT?"
5. Clayton arbitra semântica econômica real quando houver tensão entre contexto desejado e materialidade do backend.

Essa divisão é pragmática, não hierárquica. Ela deve preservar o princípio: o sistema é único; a identidade é contínua; o contexto muda sem fragmentar actor, ledger, authority ou backend.

### Cenário: Codex evoluindo frontend

1. Confirmar o actor via `useSession().activeActor`; nunca inferir actor fora desse canal.
2. Tratar `mode` como lente UX, não permissão.
3. Separar claramente projeção visual de ação causal.
4. Usar endpoints já expostos e shapes reais. Se o endpoint não existir, usar placeholder honesto ou DT-PRESSURE.
5. Não persistir estado operacional paralelo.
6. Se o card depender de capability real, não inventar. Mostrar como indisponível/placeholder ou perguntar.
7. Se a decisão for apenas relevância contextual, pode agrupar/renomear/priorizar no frontend.
8. Para empresa/bar/clínica/oficina/loja/distribuidora/etc., business profile muda vocabulário e prioridade, não cria vertical soberana.
9. Para qualquer dúvida em agenda, bank/ledger, inventory SSOT, fornecedor, CRM profundo, PDV, orders, actors ou delegation: parar e consultar Claude Code/Clayton.
10. Depois de mudança frontend, rodar typecheck quando viável e reportar resultado.

### Cenário: usuário pediu para "passar informações para a Claude"

Responder com:
- HEAD atual confirmado
- Working tree contado
- Gates revalidados
- DTs abertas relevantes
- **Sem** editar arquivos
- **Sem** assumir autorização para qualquer ação

### Cenário: outra IA presa no pager do git (`less`)

Instruir nesta ordem:
```
q                                    # sair do less
$env:GIT_PAGER = "cat"               # desabilitar pager
git --no-pager log -1 --oneline      # confirmar saída
```

### Cenário: working tree massivo no `git status`

Mesmo excluindo `node_modules`, pode retornar centenas/milhares de itens. Isso **NÃO**:
- Autoriza limpeza
- Justifica `git restore`
- Justifica `git add .`
- Justifica commits amplos

Para abrir sessão de execução:
- Pedir/registrar output filtrado
- Reconhecer explicitamente se protocolo exige árvore limpa
- Aguardar autorização explícita do Clayton com escopo declarado

### Cenário: `pnpm` indisponível no PATH

- **NÃO** assumir gates `pnpm` como validados
- Usar `npm run build -w unificard-backend` como sinal de saúde local
- Ao reportar gates, declarar: "não revalidado por mim — confirmar com Claude Code"

### Cenário: anomalia detectada

Anomalia = qualquer um destes:
- Contagem inesperada
- Arquivo fora do padrão
- Diff com remoção relevante
- Path fora do escopo previsto
- Script aborta
- "Hmm, isso aqui está estranho"

Conduta:
1. **STOP imediato**
2. **NÃO** corrigir silenciosamente
3. Voltar para validação detalhada
4. Reportar a Clayton
5. Aguardar decisão

### Cenário: surpresa em arquivo congelado/em DT

Arquivos em DT formal **NÃO** podem ser tocados como efeito colateral, mesmo que pareçam "fáceis de ajustar".

Lista de arquivos sensíveis:
- `docs/01_normative/07_NOMENCLATURA_CANONICA.md` (DT-nomenclatura)
- `backend/package.json` (DT-build-alias)
- `backend/{BOOT.ts, tsconfigs, jest.config.mjs}` (configs build/test)
- `scripts/architectural-patterns-baseline.json` (gate ativo)
- `packages/contracts/{dist,node_modules,tsbuildinfo}` (DT-packages-artifacts)

Em qualquer dessas zonas: **modo cirúrgico obrigatório**.

---

## 10. SESSÕES HISTÓRICAS REGISTRADAS

Append-only. Adicionar bloco no FIM, com data e HEAD da época.

---

### Sessão 2026-05-05/06 — Triagem completa do working tree

**HEAD inicial:** `8e9a4c93 docs(#019.FR): registra gates finais e proximas acoes no STATUS`
**HEAD final:** `c0ac7a89 docs(status): registra fechamento da sessao 2026-05-05`
**Branch:** `rescue-structural`
**Duração:** ~6 horas, sessão única

**Resultado:**
- Working tree fora de `node_modules`: 1549 → 1124 (~27% limpo)
- 25 commits cirúrgicos + 1 restore + 1 delete físico
- `CORE_PURITY_SUMMARY` permaneceu inalterado: `68/319/891`
- 4 gates PASS em todos os commits
- 8 DTs formais abertas

**Conduta validada:**
- Atomicidade: 1 alteração → build → 4 gates → commit
- Sanity checks no script de execução: abortar antes de stagear se contagem/escopo divergir
- Modo cirúrgico em anomalias (aplicado 3x: 07_NOMENCLATURA, packages tracking, 90 não-mecânicos)
- DT formal sobre commit cego
- Cross-validation Codex/Claude paralela ~1.4x throughput

**Achados duráveis registrados:** ver §8 deste documento.

---

### Sessão 2026-05-06 — Handoff e baseline operacional

**Foco:** consolidação de memória e protocolo entre IAs.

**Confirmado nesta sessão pelo Codex:**
- HEAD do repo na época da auditoria
- `validate-core-purity.mjs` executou e confirmou `CORE_PURITY_SUMMARY total=1278 modules_import=68 fastify_http=319 sql_direct=891`
- `validate-architectural-patterns.mjs --strict` executou com `critical_new=0 warning_new=0 info_new=0`

**Não confirmado pelo Codex** (faltava `pnpm` no PATH):
- Gates `pnpm` (devem ser revalidados pela Claude Code)

**Lições:**
- Distinguir "confirmado pelo Codex" vs "confirmado pela Claude" é regra, não cortesia
- Não tratar working tree massivo como autorização
- `app.builder` prova vida, não soberania

---

### Sessão 2026-05-06 — Rescue marketplace e baseline real

**Confirmado:**
- Branch após merge: `rescue-structural`
- HEAD de baseline: `e96323cc merge: baseline limpa pos-rescue (01/05 restaurado)`
- Commits incorporados: `14111f7c refactor: fatiamento marketplace estabilizado`, `5bafe88e fix: corrige narrowing em CheckResult (reason access)`
- `marketplace.service.ts` com 886 linhas; `marketplace.routes.ts` com 144 linhas
- Fix de narrowing em `validate-pipeline-e2e-transversal.ts` usa `if (r.ok === false)` antes de acessar `r.reason` (corrige TS2339 sem trocar semântica)
- `npm run build -w unificard-backend` passou exit code 0

**Caminho do arquivado:** `C:\unificard\unificard_03_05_arquivado` (não `C:\unificard_03_05_arquivado`)

**Conduta validada:**
- Cherry-pick um commit por vez com build/gate após cada
- Em conflito: reportar, não resolver por intuição
- Coleta read-only contou 1544 entradas modificadas/untracked excluindo `node_modules`
- Não autoriza limpeza, restore, `git add .`, commits amplos

**⚠️ Conflito temporal:** este bloco é de sessão **anterior** à triagem 2026-05-05/06. O HEAD `e96323cc` foi superado por `c0ac7a89` (ver §1 e bloco da triagem). Bloco mantido como histórico.

---

## 11. MANUTENÇÃO DESTA MEMÓRIA

### Quando atualizar

Atualizar **apenas** quando houver aprendizado operacional durável. Exemplos válidos:
- Achado arquitetural que afeta decisões futuras
- Padrão de execução que evitou erro real
- DT crítica nova aberta
- DT crítica fechada
- Mudança de HEAD após sessão fechada
- Novo termo no glossário

### Quando NÃO atualizar

**Não registrar aqui:**
- Detalhes temporários que pertencem ao `STATUS_EXECUCAO_GLOBAL.md`
- Estado momentâneo de uma sessão em andamento
- Plano de execução (vai em planos próprios)
- Achados não confirmados por evidência
- Opinião sem grounding em arquivo-fonte
- Detalhes que envelhecem em < 1 semana

### Como atualizar

1. **Versionamento:** bumpar versão no topo (v1.0 → v1.1)
2. **Changelog:** adicionar bloco no topo do §0 com data e mudanças
3. **Estado de referência (§1):** atualizar HEAD, working tree, CORE_PURITY após cada sessão
4. **Sessões históricas (§10):** apenas append, nunca editar entradas antigas (mas pode marcar como obsoleto)
5. **Achados duráveis (§8):** adicionar como nova subsec. Marcar resolvidos sem deletar (manter histórico).

### Limites do Codex

Esta memória é editável pelo Codex sob orientação do Clayton. Mas:

- **NÃO** alterar §0 (propósito/limites) sem autorização explícita
- **NÃO** mudar regras de prevalência
- **NÃO** registrar opinião pessoal
- **NÃO** transformar em plano de execução
- **NÃO** sobrescrever entradas históricas (apenas marcar)

### Detecção de drift

Sinais de que esta memória ficou obsoleta:
- HEAD em §1 não bate com `git log -1`
- Working tree em §1 difere significativamente do real
- DT em §8 já foi fechada (verificar STATUS)
- Conduta em §9 contradiz protocolo BOOT vigente

Quando detectar: reportar a Clayton antes de prosseguir.

---

## 12. PRINCÍPIO FINAL

Este arquivo serve para **acelerar entendimento**, nunca para **substituir leitura da fonte original**.

Em qualquer dúvida:
1. Confirmar contra o repositório real (`git log`, `git status`)
2. Ler `STATUS_EXECUCAO_GLOBAL.md` (estado vivo)
3. Ler normativo correspondente em `docs/01_normative/`
4. Reportar conflito a Clayton

A memória é mapa, não território.

---

**FIM DA MEMÓRIA CODEX v1.2**
