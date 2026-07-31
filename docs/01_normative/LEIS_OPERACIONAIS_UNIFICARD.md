# ═══════════════════════════════════════════════════════════════════════════
# SEÇÃO II — LEIS OPERACIONAIS
# ═══════════════════════════════════════════════════════════════════════════

> Leis entram em vigor conforme indicado. Lei 2 é especial.

## Lei 1: Sequência Obrigatória

```
Genesis → Backend → Frontend → Declaração
```

**Não inverter. Não pular. Não paralelizar.**

---

## Lei 2: Forward-Only

**⚠️ ATIVAÇÃO ESPECIAL: Somente após tag `GENESIS_CONSTITUCIONAL_v1`**

Antes da tag:
- Migrations do Genesis podem ser ajustadas
- Correções permitidas durante fases 0-3

Após a tag:
- Nenhuma migration do Genesis pode ser alterada
- Correções apenas via novas migrations (0006+)
- Qualquer edição em 0001-0005 = VIOLAÇÃO CONSTITUCIONAL

---

## Lei 3: Falha Deve Falhar

**PROIBIDO em migrations constitucionais:**
- CREATE TABLE IF NOT EXISTS
- ADD COLUMN IF NOT EXISTS (para colunas estruturais)
- ON CONFLICT DO NOTHING (sem justificativa)
- DO $$ EXCEPTION WHEN duplicate_object

**EXCEÇÕES CONTROLADAS:**

| Artefato | Permitido | Motivo |
|----------|-----------|--------|
| CREATE INDEX IF NOT EXISTS | ✅ | Índices são idempotentes |
| DROP TRIGGER IF EXISTS + CREATE TRIGGER | ✅ | Triggers são substituíveis |
| CREATE OR REPLACE FUNCTION | ✅ | Functions são substituíveis |
| CREATE OR REPLACE VIEW | ✅ | Views são substituíveis |

---

## Lei 4: Estrutura Prevalece

- NOT NULL permanece NOT NULL (só remove FK)
- ENUM não pode ser reduzido
- Trigger não pode chamar função inexistente

---

## Lei 5: SSOT Absoluto

- UnifyBank é única fonte de verdade financeira
- **Nenhum ledger paralelo**
- **Nenhum split fora do bank_splits**
- **Nenhum saldo fora do bank_ledger**

**Remissão — quantidade física (estoque):** a autoridade de **eventos de quantidade** em estoque é `inventory_movements` (ledger físico operacional; append-only). Isto **não** cria excepção à Lei 5: não é segundo ledger **monetário**. Ver `SSOT_REGISTRY_UNIFICARD.md` (secção 5.9) e `INVARIANTES_OPERACIONAIS_LEDGER.md`.

---

## Lei 6: Rastreabilidade Total

- Cada fase gera commit isolado
- Cada fase gera tag
- **Nenhum arquivo pode ser editado em múltiplas fases**
- Hash antes/depois de cada edição

---

## Lei 7: Governança Semântica

### Definição

O sistema possui uma camada de identidade semântica definida por **CONCEPT**.

**CONCEPT** é a fonte única de verdade sobre “o que algo é”.

O SSOT semântico (CONCEPT) é **independente e complementar** ao SSOT financeiro definido na Lei 5; nada nesta lei altera a soberania financeira do UnifyBank e do ledger.

### Regras obrigatórias

1. **CONCEPT** é o SSOT semântico do sistema.

2. Nenhum serviço de domínio pode definir identidade semântica fora de **CONCEPT**.

3. É proibido usar como fonte de identidade semântica:
   - `slug`
   - `metadata`
   - enums
   - strings

4. **categories** (árvore) não define identidade. É apenas estrutura de navegação / projeção.

5. **GRAPH** não define identidade. Apenas relaciona **CONCEPTs** já identificados.

### Regra de transição

Durante migração:

- `slug` e `domain` podem ser usados **apenas** como bootstrap
- não possuem validade normativa
- não devem ser utilizados como base de decisão futura

### Regra de código

Todo código novo deve:

- usar `concept_id` como identidade semântica
- nunca depender de `slug` como identificador de domínio

### Regra operacional — resolução de identidade em fluxos de pedido

Em qualquer fluxo que envolva **pedido, intent, offer ou checkout**, a identidade semântica do item (**`concept_ref`**) **não pode ser derivada de `categories.concept_id`**.

A resolução correta deve seguir obrigatoriamente o encadeamento:

```text
product → canonical_product → concept
```

com aplicação dos critérios de governança (**READY**) definidos na nomenclatura canónica (`docs/01_normative/07_NOMENCLATURA_CANONICA.md`, §18.14).

### Proibição explícita

É proibido utilizar **`categories.concept_id`** como fonte de identidade semântica em:

- intent execution
- offer resolution
- pricing
- checkout
- qualquer fluxo transacional

### Observação

`categories` é estrutura de **navegação e organização**, não de identidade. Qualquer uso fora desse escopo constitui violação da governança semântica.

### Regra de integridade

É considerado **violação estrutural**:

- criar lógica de decisão baseada em `slug`
- duplicar identidade fora de **CONCEPT**
- inferir significado sem passar pela camada semântica

### Política operacional por tenant

Quando existir linha em `tenant_semantic_policy` para um tenant, ela **substitui** os defaults de ambiente (`NODE_ENV` / `SEMANTIC_*`) quanto a fallback por slug e severidade de log de fallback. Sem linha, mantém-se só a política de ambiente. `enforce_graph = true` força `allow_slug_fallback` efetivo a falso para esse tenant.

**Objetivo desta lei:** garantir unicidade semântica e eliminar ambiguidade estrutural no sistema.

### Remissão — operação por agentes de IA

**Ordem de leitura obrigatória** (incluindo esta lei e a Constituição), **gate antes de alteração**, **proibições estruturais adicionais para agentes**, definição operacional de **PROFILE como read model**, critérios de **derivação category → concept** e **protocolo mínimo de operação de IA** estão em `docs/01_normative/00_AGENT_PROTOCOL.md` (secções 2.3.1 a 2.3.7). Nada nessas subsecções **altera** as Leis 1–7.

---

## Category Write Governance

**Norma:** o **Category Write Pipeline** é o caminho **canónico e obrigatório** para escrita governada de linhas em `public.categories` quando a categoria é **projeção derivada de CONCEPT** no âmbito profissional (N2 a partir de `public.concepts`), conforme o documento operacional:

`docs/03_execution_log/CATEGORY_WRITE_PIPELINE_IMPLEMENTATION.md`

**Função única de criação nesse pipeline (após migration correspondente):**

`core_invariant.create_category_from_concept(...)`

### Declarações obrigatórias

- **CONCEPT** (`public.concepts`) permanece o **único SSOT semântico**; este pipeline **não** cria segundo SSOT semântico nem tabela concorrente a `concepts`.
- **categories** é **projeção / árvore de navegação**; não define identidade semântica (alinha com o ponto 4 da Lei 7).
- **Não é permitido** persistir categorias desse fluxo com **INSERT/UPDATE/DELETE ad hoc** na tabela **fora** do pipeline oficial e **fora** dos mecanismos já consolidados no core (serviços/API) até convergência; **novo código** que crie N2 profissional a partir de CONCEPT deve usar **exclusivamente** a função acima.
- Com **trigger de bloqueio** ativo (fase descrita no documento de execução), **insert direto** em `categories` sem contexto do pipeline deve **falhar explicitamente**.

### Encadeamento canónico

```
CONCEPT (public.concepts)
  → core_invariant.create_category_from_concept
  → categories (projeção)
  → leitura (perfil, autocomplete, navegação)
```

Nada nesta secção altera a **Lei 5** (financeiro), nem a soberania de **CONCEPT** na **Lei 7**, nem cria SSOT paralelo.

---

## REGRA DE AMBIENTE (CRÍTICA)

> **OBRIGATÓRIO:** validação de migrations somente em ambiente **EFÊMERO**, recriado do zero
> e destruído ao fim.

### ⛔ NUNCA contra `unificard_dev`

`unificard_dev` é o **BANCO OFICIAL** (`DT-OFFICIAL-DATABASE-LOCK-FAIL-CLOSED`, 2026-07-29) e
contém dado curado **insubstituível**: os **75 bairros oficiais de Curitiba** (frente N3 selada,
*"produto intocável, NUNCA recarregar"*), as policies econômicas, os grants de capability e a
conta do fundo regional. **Apagá-lo é perda irreversível.**

### O mecanismo governado

É o mesmo dos **216 harnesses** `run-*-ephemeral.ps1` que já exercem esta regra continuamente:

```powershell
$db = "unificard_<frente>_e2e_$stamp"
& $psql $maintUrl -c "CREATE DATABASE $db;"
$env:DATABASE_URL          = "$prefix$db"
$env:EXPECTED_DATABASE_NAME = $db          # trava fail-closed EXIGE esta declaração
npx tsx src/core/db/migrate.ts
# ... e2e ...
& $psql $maintUrl -c "DROP DATABASE IF EXISTS $db WITH (FORCE);"
```

**Rodar migration contra banco NÃO-efêmero sem declarar `EXPECTED_DATABASE_NAME` = VIOLAÇÃO.**
**Criar banco efêmero sem declarar `EXPECTED_DATABASE_NAME` = VIOLAÇÃO** — a trava recai sobre
`OFFICIAL_DATABASE_NAME` e aborta com `exit 2`.

> ### 🔧 HISTÓRICO DESTA CORREÇÃO — 2026-07-30, autorizada por Clayton
> Até esta data a regra mandava, em bloco literal, `dropdb unificard_dev` **SEMPRE antes de rodar
> migrations**, e chamava de VIOLAÇÃO não fazer. **Nomeava o banco oficial.** Um agente cumprindo
> a norma destruiria os 75 bairros, 48 policies, 3 grants e a conta do fundo regional.
>
> A contradição foi achada pela instância GUARDIÃO e confirmada de 1ª mão pela direção. **Não
> houve regressão ao corrigir**, e a prova é o próprio banco: `unificard_dev` tem **548 migrations
> acumuladas e os 75 bairros vivos** — se a regra estivesse sendo cumprida ao pé da letra, estaria
> vazio. **A existência do dado provava que o texto já não era seguido.** O que mudou foi o texto
> passar a descrever o que os 216 harnesses já fazem — e que já é seguro.
>
> A **garantia** protegida pela regra (migration produz schema determinístico do zero) **não foi
> afrouxada**: ela é exercida pelos 216 harnesses e vigiada por `audit-migration-runner-isolation.mjs`,
> dentro do runner.

---

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- INVARIANTES_OPERACIONAIS_LEDGER.md
- SSOT_REGISTRY_UNIFICARD.md

### Referenciado por
- 00_AGENT_PROTOCOL.md
- 00_INDEX.md
- 00_SUMARIO.md
- EVENT_OUTBOX_E_ENTREGA_CANONICO.md
- HANDLER_EXECUTION_AND_RELIABILITY.md
- INVARIANTES_OPERACIONAIS_LEDGER.md
- LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md
- VOCABULARIO_CANONICO_UNIFICARD.md
<!-- AUTO-GENERATED-END -->