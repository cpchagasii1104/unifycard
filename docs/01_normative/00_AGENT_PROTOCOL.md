# 00 — AGENT PROTOCOL

## BOOTSTRAP OBRIGATÓRIO · TRILHO ÚNICO · CONTROLE DE EXECUÇÃO · MEMÓRIA INSTITUCIONAL

STATUS:
CANÔNICO · VIGENTE · NÃO INTERPRETÁVEL · NÃO FLEXÍVEL

> **LEITURA MÍNIMA (camada A):** para onboarding, ler primeiro [00_AGENT.md](00_AGENT.md), depois este protocolo, e em seguida [docs/04_audit/PAINEL_DIVIDA_VIVA.md](../04_audit/PAINEL_DIVIDA_VIVA.md) para o estado vivo do repositório.
> **AUTORIDADE OPERACIONAL:** este protocolo é o único entrypoint normativo; [REMEDIATION_DT_LOG.md](../../REMEDIATION_DT_LOG.md) é o cartório vivo, [docs/04_audit/INDICE_ONDE_ESTA_O_QUE_2026-07-29.md](../04_audit/INDICE_ONDE_ESTA_O_QUE_2026-07-29.md) é o mapa assunto→fonte, e [docs/CORE_DOCUMENTS.md](../CORE_DOCUMENTS.md) é a âncora humana para o núcleo.
>
> **ESTADO OPERACIONAL DO §GLOBAL BLOCK:** ver `REMEDIATION_DT_LOG.md` (raiz do repositório)  
> **REGRA NORMATIVA:** o cartório de execução vigente é `REMEDIATION_DT_LOG.md` — toda dívida técnica (DT-*) e fatia (F-*) é registrada lá, com status explícito no cabeçalho da entrada.  
> ⚠️ **Estado operacional pode variar por data.** Ver sempre `REMEDIATION_DT_LOG.md` antes de decisões de execução.
>
> **NOTA DE MIGRAÇÃO (2026-07-05):** `STATUS_EXECUCAO_GLOBAL.md` e `PLANO_BASE_MODULO.md` (citados originalmente aqui) foram arquivados em `docs/_arquivo/` na consolidação de raiz de 2026-07-03 (commit `0b4579007`) e NÃO são mais atualizados — não seguir mais nenhuma referência a eles neste documento como apontando pro cartório vivo. `REMEDIATION_DT_LOG.md` os sucede como fonte operacional de execução.

---

## 1. FINALIDADE

Este documento define exclusivamente como agentes automatizados
(IA, Cursor, copilots, agentes assistidos) DEVEM operar dentro do sistema UnifiCard.

Ele estabelece, sem exceções:

- como o agente inicia
- qual autoridade reconhece
- como executa tarefas
- como registra ações
- onde a memória institucional é preservada
- como o progresso é consolidado sem perda de histórico

Nenhum agente possui autonomia fora do que está literalmente definido aqui.

Qualquer comportamento não previsto neste documento  
→ INVALIDADO POR DEFINIÇÃO.

### Actor Traceability

Este sistema segue o contrato: `docs/01_normative/ACTOR_TRACEABILITY_CONTRACT.md`

Regras (resumo; detalhe na LEI e no contrato):

- Toda ação em produto deve ser atribuível no modelo de **actors** e **authority** onde aplicável.
- Toda permissão mantém **cadeia de responsabilidade** resolvível (LEI §4.8 / §4.9).
- **Histórico** e trilhos auditáveis seguem o contrato e o SSOT por domínio — sem apagar civil nem segundo ledger.

Este contrato complementa:

- `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` §4.8 / §4.9
- `SSOT_REGISTRY_UNIFICARD.md` §5.1 (Identity / Actor)

---

## 2. BOOTSTRAP OBRIGATÓRIO (ENTRYPOINT ÚNICO)

Antes de QUALQUER ação, o agente DEVE executar o bootstrap abaixo.

### 2.1 ENTRYPOINT ABSOLUTO

O agente DEVE iniciar lendo, obrigatoriamente:

docs/01_normative/00_AGENT_PROTOCOL.md

Este arquivo é o único ponto de entrada válido.

Se este arquivo:
- não existir
- não puder ser lido
- estiver incompleto
- estiver corrompido

→ ABORTAR OPERAÇÃO IMEDIATAMENTE  
→ NÃO EXISTE EXECUÇÃO SEM ENTRYPOINT

---

### 2.2 LEITURA NORMATIVA OBRIGATÓRIA

Após ler este arquivo, o agente DEVE:

1. **Universo normativo:** Reconhecer que **todo** o conjunto de ficheiros em `docs/01_normative/` é **canónico** e **deve permanecer acessível** para leitura sob demanda (inventário lexical 00 → 99). A obrigação **não** se cumpre por carregar de uma só vez todo o diretório no arranque, mas por **ler em profundidade** o que for **necessário** ao domínio da tarefa, conforme **2.2.1** e **2.2.2**, **sem omitir** ficheiro cuja relevância para o domínio declarado ou para o GATE (2.3.2) seja necessária.
2. Quando executar **varredura lexical completa** (auditoria transversal, dúvida de domínio não resolvível, ou tarefa explicitamente global), seguir estritamente a ordem lexical (00 → 99).

Regras duras:
- Nenhum outro diretório possui autoridade normativa
- Nenhuma memória prévia, contexto externo ou conversa substitui o conteúdo normativo **carregado e aplicável** à tarefa
- Norma ausente ou ilegível **quando relevante para o domínio declarado** → ABORTAR OPERAÇÃO

### 2.2.1 LEITURA CONTEXTUAL OBRIGATÓRIA

A IA **NÃO** deve trazer para o contexto de trabalho **toda** a normativa no arranque apenas por precaução.

Em vez disso:

1. **Bootstrap mínimo obrigatório** — ler integralmente, antes de qualquer ação substantiva:
   * `docs/01_normative/00_AGENT_PROTOCOL.md` (este ficheiro)
   * `docs/01_normative/CONSTITUICAO_UNIFICARD.md`
   * `docs/01_normative/LEIS_OPERACIONAIS_UNIFICARD.md`

2. **Identificação explícita do domínio da tarefa** — declarar qual(is) eixo(s) a tarefa toca (sem inferência tácita), exemplos não exaustivos:
   * ontologia (CONCEPT / camadas semânticas)
   * perfil / read models
   * financeiro / ledger
   * navegação (N1 / N2 / árvore)
   * contexto (CONTEXT / policy)
   * graph (relações entre conceitos)

3. **Carregamento modular** — com base no domínio declarado, ler **apenas** os ficheiros listados em **2.2.3** para esse eixo (em **conjunto completo** por linha, ver anti half-read no mesmo 2.2.3), **mais** qualquer ficheiro adicional cuja relevância seja inevitável após o bootstrap (ex.: cruzamento de pilares); dúvida entre **domínios** → **2.2.6** (não escolher sozinho); dúvida de escopo dentro do domínio → alargar a leitura ou **ABORTAR** (não adivinhar).

### 2.2.2 PROVA DE RASTREABILIDADE NORMATIVA (OBRIGATÓRIA)

Antes de executar qualquer ação (código, schema, documentação operacional), o agente **DEVE** declarar explicitamente:

* **quais documentos** de `docs/01_normative/` foram lidos (ou revistos) para esta execução;
* **por que** esse conjunto é **suficiente** face ao domínio declarado;
* **qual SSOT** está a governar o pilar em causa;
* **qual pilar** (identidade, semântica, financeiro, temporal, etc.) está a ser afetado.

Se **não** conseguir cumprir as quatro linhas acima com precisão → **ABORTAR** → solicitar decisão humana ou alargar a leitura conforme 2.2.1 / 2.2.3.

Ambiguidade de domínio **não** tratada conforme **2.2.6** (ou **união cautelosa** ali prevista) **invalida** a afirmação de que o conjunto lido é **suficiente**. Conflito aparente entre documentos lidos → aplicar **2.2.7** e declarar qual norma prevaleceu na prova.

### Requisitos de precisão da prova (obrigatório)

A prova de rastreabilidade **NÃO** pode ser genérica.

**Deve** obrigatoriamente incluir:

1. **Nome EXATO** dos SSOTs aplicáveis **por pilar**, quando mencionados:
   * **semântico** → **CONCEPT** (e, quando relevante, referência à camada / tabela normativa que o implementa, conforme documentos lidos)
   * **financeiro** → **bank_ledger** / **UnifyBank** (conforme Lei 5 e `SSOT_REGISTRY_UNIFICARD.md`)
   * **temporal** → **Agenda** / **Unified Availability** (conforme Constituição e `CORE_IMUTAVEL.md`)

2. **Referência explícita** à precedência normativa aplicada à decisão:
   * **Constituição > Leis > SSOT Registry > Ontologia** (alinhado ao detalhe de **2.2.7** quando houver conflito entre ficheiros)

3. Quando aplicável, **explicitar** qual estrutura **NÃO** é SSOT (exemplos indicativos: **N2** como camada de navegação/governo, **`category` / `category_id`** como árvore de navegação e não identidade semântica, **slug** sem validade normativa de domínio, **GRAPH** como relação entre CONCEPTs já identificados e não fonte de “o que é”).

4. **É PROIBIDO:**
   * respostas genéricas como “SSOT semântico e financeiro definidos” **sem** nomear as estruturas concretas acima;
   * **omitir** nomes concretos de estruturas quando a prova invocar pilares ou SSOT;
   * **omitir** justificativa de **suficiência documental** (por que o conjunto de ficheiros lidos cobre o domínio declarado).

Se **qualquer** um destes itens **não** for atendido:

→ **PROVA INVÁLIDA**  
→ **EXECUÇÃO DEVE SER ABORTADA**

### 2.2.3 MAPEAMENTO CONTEXTUAL (DOMÍNIOS → DOCUMENTOS)

Referência **indicativa** (não exaustiva da totalidade da norma): se a tarefa tocar o domínio, o conjunto **mínimo** por linha é o da tabela. **Cruzamentos** exigem **união** dos conjuntos das linhas tocadas. Caminhos relativos a `docs/01_normative/`.

| Domínio declarado | Documentos a carregar (mínimo indicativo) |
|-------------------|-------------------------------------------|
| **ONTOLOGIA** | `18_DOMAIN_ONTOLOGY_UNIFICARD.md`, `SSOT_REGISTRY_UNIFICARD.md` |
| **NAVEGAÇÃO** | `19_N1_NAVIGATION_STRUCTURE_UNIFICARD.md`, `20_N2_NAVIGATION_STRUCTURE_UNIFICARD.md`, `21_PLANO_DE_EXPANSÃO_GOVERNADA_DO_N2.md` |
| **NAVEGAÇÃO (IDENTIDADE HUMANA)** | `22_RFC_N1_PESSOAS_E_IDENTIDADES.md` (quando o escopo incluir `pessoas-e-identidades` em N1), além do conjunto de **NAVEGAÇÃO** |
| **PERFIL** | `CORE_IMUTAVEL.md`, `18_DOMAIN_ONTOLOGY_UNIFICARD.md` (camadas aplicáveis a read model / CONCEPT); secções **2.3.4** e **2.3.5** deste protocolo |
| **FINANCEIRO** | `LEIS_OPERACIONAIS_UNIFICARD.md` (Lei 5), `SSOT_REGISTRY_UNIFICARD.md` |
| **ESTOQUE / LEDGER FÍSICO** | `INVARIANTES_OPERACIONAIS_LEDGER.md`, `SSOT_REGISTRY_UNIFICARD.md`, `LEIS_OPERACIONAIS_UNIFICARD.md` (Lei 5 — remissão quantidade física) |
| **CONTEXTO** | `18_DOMAIN_ONTOLOGY_UNIFICARD.md`, `SSOT_REGISTRY_UNIFICARD.md` |
| **GRAPH** | `18_DOMAIN_ONTOLOGY_UNIFICARD.md`, `PROHIBITED_STRUCTURES.md` |

**Leitura completa no conjunto do domínio (anti half-read):** Ao declarar um ou mais domínios em **2.2.1** e aplicar esta tabela, o agente **DEVE** ler **integralmente** **todos** os ficheiros listados na **linha** (ou na **união** das linhas) que escolheu para a tarefa — **é proibido** cumprir o domínio lendo **apenas** parte da lista. Para **PERFIL**, inclui leitura integral das secções **2.3.4** e **2.3.5** deste protocolo. Incumprir invalida a **prova (2.2.2)** para esse âmbito → **ABORTAR** (ou completar a leitura em falta antes de prosseguir).

Documentos já cobertos pelo **bootstrap (2.2.1)** contam como lidos; a **prova (2.2.2)** deve mencioná-los quando aplicável.

### 2.2.4 NAVEGAÇÃO NORMATIVA (ÍNDICE E SUMÁRIO OBRIGATÓRIOS)

Os ficheiros abaixo são **estruturas indexais obrigatórias de navegação** para aceleração de descoberta documental e prova de suficiência (2.2.2):

- `docs/01_normative/00_INDEX.md` — índice estrutural lexical de todos os documentos normativos
- `docs/01_normative/00_SUMARIO.md` — visão consolidada hierárquica com questões operacionais frequentes

**Função:**

- Reduzir redundância de leitura
- Acelerar identificação de domínio aplicável
- Melhorar precisão da prova de rastreabilidade (2.2.2)
- Facilitar navegação em tarefa de auditoria transversal

**Regras críticas:**

1. **Estes ficheiros NÃO são fonte de verdade normativa.** São indexais. Qualquer conteúdo não resolvido em `docs/01_normative/` (bootstrap + contextual + tabela 2.2.3) **invalidará** a prova se baseada apenas em INDEX ou SUMÁRIO.

2. **NÃO podem ser usados como substituto de leitura completa** do ficheiro normativo aplicável. Mapeiam para leitura, não eliminam a obrigação de ler integralmente (anti half-read, conforme anti half-read em 2.2.3).

3. **Ambiguidade ou conflito entre INDEX/SUMÁRIO e documentos canónicos** → prevalece conteúdo canónico **sempre** (aplicar precedência 2.2.7).

4. **Quando usar:**
   - Tarefa de **descoberta** (ex.: "com que domínio estou lidando?") → consultar 00_SUMÁRIO.md
   - Tarefa de **auditoria estrutural** (ex.: "todos os ficheiros foram lidos?") → consultar 00_INDEX.md para confirmar integridade
   - Tarefa de **prova de suficiência** (ex.: "cobrimos tudo para este domínio?") → 00_INDEX.md + 00_SUMÁRIO.md confirma cobertura

5. **OBRIGATÓRIO:** se a prova de rastreabilidade (2.2.2) invocar 00_INDEX.md ou 00_SUMÁRIO.md para justificar suficiência, **mencioná-los explicitamente na prova** e declarar **qual ficheiro actualmente lido** foi localizado / confirmado via índice.

6. **Divergência com ficheiros reais:** se houver divergência entre INDEX/SUMÁRIO e o conteúdo real dos documentos normativos, **prevalece sempre o conteúdo real**; INDEX/SUMÁRIO devem ser tratados como **desatualizados** até sincronização.

### 2.2.5 PROIBIÇÕES (LEITURA E RASTREABILIDADE)

- **PROIBIDO** carregar **toda** a normativa de `docs/01_normative/` sem **necessidade** demonstrada pelo domínio ou pela prova (2.2.2).
- **PROIBIDO** responder ou executar alteração **sem** rastreabilidade documental explícita (2.2.2).
- **PROIBIDO** **inferir** o domínio da tarefa **sem declará-lo** por escrito antes de agir.

### 2.2.6 AMBIGUIDADE DE DOMÍNIO (ERRO DE ENQUADRAMENTO)

Se a tarefa puder razoavelmente enquadrar-se em **mais de um** domínio da tabela **2.2.3**, ou se houver **dúvida** entre domínios (ex.: parece **PERFIL** mas a alteração estrutural é sobretudo **ONTOLOGIA**):

1. **PROIBIDO** fixar **um** único domínio **por suposição** sem declarar a ambiguidade.
2. **OBRIGATÓRIO** listar por escrito os domínios **plausíveis** e, em uma linha cada, **por que** se aplicam.
3. **OBRIGATÓRIO** **ABORTAR** a execução substantiva até **decisão explícita** do operador humano **ou** instrução que desfaça a ambiguidade.

**Alternativa segura sem decisão humana imediata (única excepção):** carregar a **união** dos documentos das **linhas** de **todos** os domínios plausíveis (leitura completa por linha, conforme o parágrafo anti half-read acima) e declarar na **prova (2.2.2)** que se optou por **cautela por união** e quais domínios foram unidos. **Não** vale escolher “o domínio principal” sem uma das duas vias (decisão humana ou união cautelosa).

### 2.2.7 PRECEDÊNCIA ENTRE DOCUMENTOS (CONFLITO NORMATIVO)

> **Emenda 2026-08-02 (ratificada por Clayton):** nove remissões internas deste protocolo citavam
> **2.2.5**/**2.2.6** querendo dizer **2.2.6 (Ambiguidade)**/**2.2.7 (Precedência)** — off-by-one
> de renumeração antiga, verificado título a título e citação a citação antes da correção. O
> contágio em `LEI_DE_COERENCIA §7.1/§14` foi corrigido na mesma emenda. **Regra que fica:** ao
> renumerar secção, varra TODAS as remissões no mesmo commit — remissão deslocada manda o leitor
> obedecer à secção errada com cara de certa.


Quando dois ou mais documentos de `docs/01_normative/` **parecerem** divergir sobre o **mesmo** ponto, a ordem de **precedência** é (vence o de **menor** número; os seguintes cedem):

1. **CONSTITUICAO_UNIFICARD.md**
2. **LEIS_OPERACIONAIS_UNIFICARD.md**
3. **SSOT_REGISTRY_UNIFICARD.md**
4. **18_DOMAIN_ONTOLOGY_UNIFICARD.md**
5. **Demais documentos** de `docs/01_normative/` (ex.: `CORE_IMUTAVEL.md`, `19_…` / `20_…` navegação, `21_PLANO_DE_EXPANSÃO_GOVERNADA_DO_N2.md`, `PROHIBITED_STRUCTURES.md`, `07_NOMENCLATURA_CANONICA.md`, etc.)

**Excepção:** quando um documento **explícita e textualmente** se declara **subordinado** a outro, prevalece essa relação **dentro** do limite da precedência (1)–(2) — **nada** abaixo da Constituição ou das Leis pode “vencer” (1) ou (2).

**Este protocolo (`00_AGENT_PROTOCOL.md`)** define **como** o agente opera; **não** revoga (1) nem (2). Conflito aparente entre este ficheiro e **Constituição / Leis** → aplicam-se (1) e (2).

### 2.2.8 CONTRATOS DE API HTTP (BACKEND — LEITURA OBRIGATÓRIA QUANDO O ESCOPO FOR EXPOSIÇÃO REST / OPENAPI / SWAGGER)

O diretório `docs/01_normative/` permanece a **única** autoridade **normativa institucional** (Constituição, Leis, SSOT, ontologia). **Não** se substitui por documentação de backend.

Quando a tarefa envolver **criar ou alterar rotas HTTP**, **alinhamento OpenAPI/Swagger**, ou **evolução de contrato público** no repositório `backend/`, o agente **DEVE** ler e aplicar:

| Documento | Caminho |
|-----------|---------|
| Governança da cadeia contrato → domínio → Fastify → documentação | `backend/docs/API_CONTRACT_GOVERNANCE.md` |

Se o escopo incluir **stock transfer / receipt** (endpoints, payloads ou enums desse fluxo), o agente **DEVE** tratar como referência de comportamento o ficheiro:

| Contrato de referência (OpenAPI 3) | ⚠️ **AUSENTE DO REPOSITÓRIO** (emenda 2026-08-02, ratificada): `backend/docs/openapi-stock-transfer-receipt.contract.yaml` é citado desde antes do gênesis e **nunca foi materializado** (`find -iname "openapi*"` → zero ficheiros). Até materialização em frente própria, a fonte é `backend/docs/API_CONTRACT_GOVERNANCE.md` (existe) + o contrato vivo do código — e **obrigação sobre ficheiro inexistente não obriga ninguém**, só ensina o leitor a ignorar a norma |

**Regra:** qualquer mudança de comportamento de API **começa** pelo contrato (YAML ou documento de contrato equivalente), **depois** código; **proibido** inverter (Swagger ou código gerado **não** substituem o contrato como fonte da verdade). Detalhes e checklist em `backend/docs/API_CONTRACT_GOVERNANCE.md`.

---

### 2.3 Leitura Normativa Obrigatória

Leitura normativa obrigatória:

* docs/01_normative/CONSTITUICAO_UNIFICARD.md
* docs/01_normative/LEIS_OPERACIONAIS_UNIFICARD.md
* docs/01_normative/SSOT_REGISTRY_UNIFICARD.md

### 2.3.1 ORDEM OBRIGATÓRIA PARA QUALQUER IA (SEQUÊNCIA DECISÓRIA)

Além do **universo normativo** e da **leitura contextual** (Secções 2.2, 2.2.1, 2.2.3 e, quando aplicável, **2.2.6** / **2.2.7**), qualquer agente **DEVE** internalizar a ordem abaixo **antes** de propor ou executar alteração estrutural. **Ordem ≠ obrigação de bufferizar todo o diretório**; **ordem = precedência decisória** após carregar o aplicável. Conflitos entre documentos já carregados → **2.2.7** antes de decidir.

1. **CONSTITUICAO_UNIFICARD.md** — limites institucionais imutáveis deste documento
2. **LEIS_OPERACIONAIS_UNIFICARD.md** — leis de execução (inclui Lei 7 — governança semântica)
3. **CORE_IMUTAVEL.md** — o que não pode ser duplicado nem paralelizado
4. **00_AGENT_PROTOCOL.md** (este arquivo) — trilho de operação
5. **Mapa de conexões (substituto normativo enquanto arquivos dedicados não existirem):** `SSOT_REGISTRY_UNIFICARD.md` + `18_DOMAIN_ONTOLOGY_UNIFICARD.md` (camadas CONCEPT / TREE / CONTEXT / GRAPH)
6. **Plano definitivo (contexto operacional, não norma):** `UNIFICARD_PLANO_DEFINITIVO_v7.md` (raiz do repositório), após a normativa

**Sem concluir a leitura aplicável ao escopo da tarefa** (norma + plano quando a tarefa for de execução) → **PROIBIDO** executar alteração em código, schema ou contrato.

---

### 2.3.2 GATE OBRIGATÓRIO ANTES DE QUALQUER ALTERAÇÃO

Antes de criar/editar migrations, tabelas, SSOT, serviços de domínio semântico ou persistência de perfil, o agente **DEVE** validar explicitamente:

| Verificação | Exigência |
|-------------|-----------|
| Pilar afetado | Identificar (ex.: identidade, semântica, financeiro, temporal) |
| Jurisdição / autoridade (DECISION-0021) | Responder: **quem tem autoridade legítima sobre esta verdade?** Pasta, import, rota, tabela ou `app.builder` não bastam para provar soberania |
| SSOT | Confirmar qual SSOT governa o pilar (financeiro vs semântico são distintos) |
| Estrutura existente | Verificar se já há tabela/contrato normativo; **não** duplicar |
| Risco de duplicação de verdade | Proibir segunda fonte primária para o mesmo fato |
| Precedência causal | Respeitar cadeia operacional **Mutation → Estado → Dinheiro → Evento** quando o escopo tocar execução de domínio/financeiro/temporal; **proibido** tratar evento como causa primária, alterar estado canónico sem mutation explícita ou movimentar dinheiro fora da ordem normativa; em semântica, manter **CONCEPT antes de inferência de mercado** / GRAPH |
| Fronteira financeira (código) | Se o diff **fora** de `backend/src/modules/bank/` acede em SQL a `bank_ledger`, `bank_transactions`, `bank_accounts` ou `bank_splits` (emenda 2026-08-02: o split é a 2ª invariante da Lei 5 e o enforcement já o cobria — norma mais estreita que o próprio gate perde a discussão errada), ou define locking / ordem de `FOR UPDATE` sobre essas tabelas → **ABORTAR** (encapsular no Bank; ver `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` §**4.6**–§**4.7**) |
| Fronteira financeira (derivação) | **ABORTAR** se o código (fora do domínio Bank) **inferir** saldo/posição canónica, **reconstruir** estado financeiro fora do SSOT, ou **derivar** decisão de dinheiro real principalmente a partir de eventos / logs / *snapshots* comerciais não canónicos — ver `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` §**4.6** |

Se **qualquer** resposta for **incerta** → **ABORTAR** execução → **solicitar decisão formal** (RFC / owner humano). **Proibido** “implementar e depois alinhar”.

---

### 2.3.3 PROIBIDO PARA QUALQUER IA (ESTRUTURAL)

As proibições abaixo **reforçam** `PROHIBITED_STRUCTURES.md`, `LEIS_OPERACIONAIS_UNIFICARD.md` (Lei 5 e Lei 7) e `18_DOMAIN_ONTOLOGY_UNIFICARD.md`. Em caso de conflito, prevalece o documento normativo mais específico já existente.

- Criar **novas tabelas** sem contrato ou RFC normativo explícito
- Criar **SSOT paralelo** (ledger, CONCEPT, agenda, identidade)
- Criar **mini-core clandestino** em módulo para verdade já soberana (DECISION-0021)
- Persistir **dado derivado como fonte primária** quando já existir SSOT canónico
- **Misturar** em um mesmo artefato sem fronteira: identidade do ator, semântica (CONCEPT), contexto de uso (CONTEXT), inferência (GRAPH) — cada camada tem papel definido na ontologia
- **Inferir significado** fora do pipeline **CONCEPT** / governança de conceito
- Usar **`category` / `category_id` como identidade semântica** — categoria é **TREE / navegação**, não SSOT de “o que é”
- Criar estrutura baseada em **suposição** ou leitura parcial da norma
- **Aceder** em código (fora de `backend/src/modules/bank/`) às tabelas SSOT financeiras de runtime **`bank_ledger`**, **`bank_transactions`**, **`bank_accounts`** — **PROIBIDO**; **ABORTAR** e usar serviços/repositórios do Bank (`LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` §**4.6**)
- **Definir** bloqueio pessimista (`FOR UPDATE`) ou ordem de bloqueio de contas sobre o SSOT financeiro **fora** do domínio Bank — **PROIBIDO**; **ABORTAR** (§**4.7**)

---

### 2.3.4 PROFILE — DEFINIÇÃO ESTRUTURAL (READ MODEL)

- **PROFILE** (no sentido produto: agregado exposto ao utilizador) é **READ MODEL**, **não** SSOT.
- **PROFILE não define semântica.** Quem define “o que algo é” no domínio é **CONCEPT**; relações são **GRAPH**; navegação é **TREE** (`categories`).
- Persistência de estado do utilizador que representa **ligação ao domínio** deve **referenciar** `actor_id` / identidade canónica acordada e **`concept_id`** (ou derivação **permitida** conforme Seção 2.3.5), **não** inventar nós semânticos em JSON ou texto.

**Regra operacional:** *Se não referencia CONCEPT (direta ou por derivação explícita permitida), não é semântica de domínio — é atributo, declaração regulada ou UI.*

Detalhe de implementação em código permanece subordinado a RFC; esta seção fixa **papel constitucional** do perfil.

---

### 2.3.5 DERIVAÇÃO CATEGORY → CONCEPT

Quando o sistema usar `category_id` como **ponte** para obter `concept_id`:

A derivação **só é permitida** se **todas** as condições forem verdadeiras no âmbito de uso:

- Mapeamento **1:1** (`category_id` → exatamente um `concept_id`; **não** várias categorias com o mesmo `concept_id` para o mesmo efeito semântico, salvo norma explícita que defina exceção)
- Mapeamento **determinístico** (mesma entrada → mesma saída, sem heurística condicional de desempate)
- Mapeamento **estável** (mudanças exigem migração governada, não edição ad hoc)

Se **qualquer** condição falhar → **DERIVAÇÃO PROIBIDA** → usar **`concept_id` diretamente** na persistência canónica.

**Qualquer ambiguidade** na derivação → **ERRO ESTRUTURAL** → abortar e corrigir dados ou norma antes de prosseguir.

**Gate operacional recomendado (read-only):** `backend/scripts/gate-category-concept-derivation.mjs` — executar antes de refactors que dependam da ponte category→concept.

---

### 2.3.6 PROTOCOLO DE OPERAÇÃO DE IA (FLUXO MÍNIMO)

Fluxo obrigatório antes de agir:

1. Cumprir leitura contextual (2.2.1–2.2.3, com leitura completa por domínio), **ambiguidade (2.2.6)** e **precedência (2.2.7)** quando aplicável, e **prova de rastreabilidade** (2.2.2); internalizar ordem decisória 2.3.1 quando relevante
2. Identificar **pilar** e **SSOT** afetados
3. Validar existência de **estrutura** e **contrato**
4. Verificar **impacto cruzado** (financeiro vs semântico vs temporal) e **precedência causal** conforme a linha homónima do GATE (2.3.2), em especial **Mutation → Estado → Dinheiro → Evento** quando aplicável
5. Aplicar **GATE** da Seção 2.3.2 (incluindo precedência causal)
6. **Só então** propor ou executar ação (conforme modo GUARDIÃO / EXECUTOR)

**Proibido:** agir por interpretação solta, suposição ou validação estrutural incompleta.

---

### 2.3.7 TEXTOS COPIÁVEIS — BOOTSTRAP DE CHAT E AUDITORIA RÁPIDA

Uso opcional no **início** de uma conversa com agente ou no corpo de PR/review. **Não** substituem o bootstrap (2.2.1), a prova (2.2.2), o mapeamento e anti half-read (2.2.3), as regras de ambiguidade e precedência (2.2.6–2.2.7) nem a Secção 2.3.

**Bootstrap (inicialização)**

```text
Antes de qualquer alteração de código, schema ou contrato:
1) Abrir e seguir docs/01_normative/00_AGENT_PROTOCOL.md — secções 2.2, 2.2.1–2.2.7 e 2.3.1 a 2.3.7 (2.3.7 = textos copiáveis; o trilho normativo principal após bootstrap é 2.3.1–2.3.6).
2) Declarar em 3–5 linhas: (a) pilar afetado, (b) SSOT envolvido, (c) se há estrutura existente, (d) risco de duplicação de verdade, (e) validação da precedência causal (incl. Mutation → Estado → Dinheiro → Evento quando aplicável).
3) Se qualquer item for incerto → parar e pedir decisão humana formal.
Só depois propor ou executar mudanças.
```

**Auditoria rápida (diff / PR)**

```text
Auditar este diff apenas contra o trilho normativo:
- 00_AGENT_PROTOCOL.md 2.3.2 (gate e precedência causal), 2.3.3 (proibições), 2.3.4 (PROFILE read model), 2.3.5 (category→concept).
Listar: violações explícitas, ambiguidades, remissões a RFC ausentes.
Não sugerir refatoração fora do escopo do diff.
```

---

### 2.4 Arquivos excluídos da leitura obrigatória (inexistentes no repositório)

Os caminhos abaixo **não existem** em `docs/01_normative/` neste repositório.  
**Não** exigem leitura, **não** geram ABORT por ausência e **não** substituem o universo normativo (2.2), a leitura contextual (2.2.1–2.2.6) nem a Seção 2.3.

| Caminho | Status |
|---------|--------|
| `docs/01_normative/00_SYSTEMIC_AUDIT_ENTRYPOINT.md` | **ausente** — documento não versionado |
| `docs/01_normative/00_MAPA_DE_CONEXOES.md` | **ausente** — documento não versionado |

Qualquer checklist ou prompt externo que os cite como obrigatórios fica **desatualizado** em relação a este protocolo até os arquivos serem criados e aqui referenciados.

---

## 2.5 CONTEXTO DE REMEDIAÇÃO (ABRIL 2026)

Durante a vigência da remediação sistêmica iniciada em 2026-04-21, toda IA que operar
no projeto DEVE, antes de qualquer proposta de alteração, ler adicionalmente:

1. `C:/unificard/SYSTEM_REMEDIATION_PLAN.md` (normativo fixo, congelado)
2. `C:/unificard/SYSTEM_REMEDIATION_STATUS.md` (estado atual das 30 violações)
3. `C:/unificard/REMEDIATION_DECISIONS_LOG.md` (decisões arquiteturais registradas)
4. `C:/unificard/REMEDIATION_SNAPSHOTS.md` (evolução histórica do sistema)

### 2.5.1 Regras de aplicação

- Se a tarefa tocar qualquer ID de violação (C1-C30) registrado em STATUS:
   - aplicar explicitamente P1 ("sintoma ou causa?") antes de propor alteração
   - propor alteração só se alinhada com o PLAN ou justificada em DECISIONS_LOG

- Se a tarefa envolver gate schema-coherence:
   - aplicar Seção 6 (Loop de Validação) do PLAN antes de usar gate para orientar correção
   - aplicar Seção 7 (Anti-Regressão) ao alterar o gate

- Se a tarefa for decisão arquitetural sobre violações em DECISION_PENDING:
   - registrar entrada formatada em DECISIONS_LOG conforme template da seção "Formato obrigatório"
   - atualizar STATUS no mesmo commit

- Enquanto remediação estiver aberta (critério em Seção 15 do PLAN):
   - feature nova permanece bloqueada
   - correções seguem ordem de Seção 5 (Fases) + Seção 10 (Prioridade por Impacto Real)

### 2.5.2 Conclusão da remediação

Conclusão é declarada apenas quando todos os critérios da Seção 15 do PLAN
forem satisfeitos. Esta seção 2.5 pode ser arquivada (movida para nota histórica)
após conclusão formal registrada em REMEDIATION_DECISIONS_LOG como "conclusao_remediacao".

---

## 3. LEITURA DO PLANO MESTRE (CONTEXTO OPERACIONAL)

> ⚠️ **EXECUÇÃO DE PLANOS DESABILITADA (POLÍTICA DE PROTECÇÃO)**  
> Planos com nome `UNIFICARD_PLANO_*` (histórico, não existe mais na raiz — ver nota de migração acima) podem ser **placeholders** ou **histórico**. **Não** executar pipelines, scripts ou migrações **porque** um plano os menciona. Toda decisão de alteração estrutural segue `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md`, `docs/01_normative/CONTRACTS.md` (quando aplicável) e `REMEDIATION_DT_LOG.md`. Leitura do ficheiro **v7** abaixo (se ainda existir) é **contexto**, não ordem de execução.

Após cumprir o **bootstrap (2.2.1)**, a **prova (2.2.2)**, o **carregamento modular** exigido pelo domínio (2.2.3, **incluindo leitura completa** de cada linha aplicável), e **2.2.6–2.2.7** quando aplicável — e, quando a tarefa for de **execução** ou cruzar o plano — o agente **DEVE** ler (somente como documento de contexto, sem executar os passos nele descritos salvo ordem humana explícita):

UNIFICARD_PLANO_DEFINITIVO_v7.md

### 3.1 Natureza do Plano Mestre

O Plano Mestre:
- NÃO é norma
- NÃO cria regras
- NÃO autoriza exceções
- NÃO substitui docs/01_normative/

Ele define exclusivamente:
- sequência de etapas
- gates existentes
- critérios de PASS / FAIL
- estado esperado do sistema

O agente NÃO PODE reinterpretar, resumir ou “otimizar” o plano.

---

## 4. MODOS DE OPERAÇÃO (DECLARAÇÃO OBRIGATÓRIA)

O agente SÓ PODE operar em UM ÚNICO modo por execução.  
O modo DEVE ser declarado explicitamente antes de qualquer ação.

### (A) MODO: GUARDIÃO

Permissões:
- auditar conformidade
- detectar violações
- gerar relatórios
- apontar riscos
- validar aderência ao Plano Mestre

Proibições:
- alterar código
- refatorar
- criar regras
- sugerir exceções
- executar tarefas
- atualizar status de execução

---

### (B) MODO: EXECUTOR

Permissões:
- executar tarefas explicitamente autorizadas
- refatorar código somente conforme norma
- gerar artefatos de execução
- corrigir violações detectadas
- registrar progresso executado

Proibições:
- interpretar normas
- criar regras
- criar exceções
- alterar documentos normativos
- alterar o Plano Mestre
- decidir arquitetura ou produto

Modo não declarado → execução inválida  
Troca de modo sem reinício → execução inválida

---

### 4.1 OBRIGAÇÃO DE CRIAÇÃO DE ARTEFATOS (EXECUTOR)

Sempre que o agente estiver operando em MODO: EXECUTOR e uma instrução solicitar explicitamente:

- gerar
- criar
- registrar
- produzir artefato
- salvar log
- registrar execução
- gerar relatório de execução

o agente DEVE:

1. Criar fisicamente o arquivo no path exato especificado
2. Escrever o conteúdo integral no arquivo
3. Confirmar explicitamente o caminho e o nome do arquivo criado

Regras duras:
- O agente NUNCA deve apenas descrever o conteúdo
- O agente NUNCA deve assumir que um humano salvará depois
- O agente NUNCA pode alterar o conteúdo após escrita
- O agente NUNCA pode criar arquivos fora dos diretórios permitidos (Seção 6)

Se o agente:
- não tiver permissão de escrita
- não conseguir criar o arquivo
- detectar conflito de path

→ DEVE ABORTAR A EXECUÇÃO  
→ DEVE REPORTAR A FALHA EXPLICITAMENTE

Execução sem criação do artefato exigido  
→ EXECUÇÃO INVÁLIDA POR DEFINIÇÃO

---

## 4.2 EXECUÇÕES E AUDITORIAS INCREMENTAIS (OTIMIZAÇÃO CONTROLADA)

Para reduzir repetição desnecessária e consumo de tokens, o protocolo AUTORIZA
execuções e auditorias incrementais, desde que TODAS as condições abaixo sejam atendidas.

### Condições obrigatórias

Uma execução ou auditoria incremental é VÁLIDA somente se o prompt declarar explicitamente:

1. O MODO (GUARDIÃO ou EXECUTOR)
2. O ESCOPO EXATO (inalterado em relação à etapa anterior)
3. O ARTEFATO DE ÂNCORA obrigatório, sendo um dos seguintes:
   - último relatório de auditoria válido (`docs/04_audit/...`)
   - último log de execução válido (`docs/03_execution_log/...`)

### Regras duras

- O agente NÃO pode assumir memória implícita
- O agente NÃO pode “continuar de onde parou” sem referência explícita
- O artefato de âncora passa a ser a fonte operacional imediata
- A leitura completa da normativa NÃO é dispensada, apenas REFERENCIADA

Ausência de âncora explícita  
→ execução inválida

---

## 4.3 GESTÃO DE ARTEFATOS ABERTOS

Antes de criar novo relatório, hipótese, plano, auditoria, decisão, registry
ou arquivo de transição, o agente deve verificar em `REMEDIATION_DT_LOG.md`
se já existe artefato aberto para o mesmo assunto.

Todo artefato aberto deve ter exatamente um dos estados:

- ABERTO
- EM EXECUÇÃO
- BLOQUEADO
- CONCLUÍDO
- ARQUIVADO
- SUPERADO

É proibido criar novo artefato para o mesmo tema sem:

1. Referenciar explicitamente o artefato anterior
2. Declarar por que ele não serve
3. Definir o destino do artefato anterior:
   - continuar
   - substituir
   - encerrar
   - arquivar

Ao concluir um artefato:

- se virou memória útil, deve ser referenciado por um documento de entrada ou movido para local histórico apropriado;
- se foi transitório, deve ser marcado como CONCLUÍDO ou ARQUIVADO;
- se foi superado, deve apontar qual documento o substitui;
- se não tem valor institucional, só pode ser removido com autorização explícita do operador humano.

Nenhuma sessão deve terminar aumentando a quantidade de artefatos abertos sem
justificar em `REMEDIATION_DT_LOG.md`.

### 4.3.1 CHECAGEM INICIAL DE ARTEFATOS ABERTOS

Ao iniciar qualquer sessão, o agente deve:

1. Ler `REMEDIATION_DT_LOG.md`
2. Identificar artefatos em estado:
   - EM EXECUÇÃO
   - BLOQUEADO
3. Priorizar continuidade antes de iniciar nova frente de trabalho

É proibido iniciar nova frente de trabalho sem avaliar as já abertas.

Se uma nova frente for inevitável, o agente deve registrar em
`REMEDIATION_DT_LOG.md` por que ela tem prioridade sobre os artefatos já abertos.

---

## 5. AUTORIDADE E PRECEDÊNCIA

1. docs/01_normative/ é a ÚNICA fonte de verdade decisória
2. O Plano Mestre define ordem e estado, nunca decisão
3. Documentos fora da normativa:
   - NÃO criam regras
   - NÃO autorizam ações
   - NÃO resolvem conflitos

Ambiguidade → FALHA  
→ ABORTAR OU ESCALAR

---

## 6. CONTROLE DE DIRETÓRIOS (ANTI-DERIVA)

### 6.1 DIRETÓRIOS CANÔNICOS PERMITIDOS

O agente SÓ PODE criar ou escrever nos seguintes diretórios dentro de `docs/`:

docs/
├── 01_normative/ (somente leitura)
├── 02_decisions/
├── 03_execution_log/
├── 04_audit/
├── _scratch/
└── 99_archive/

Qualquer escrita fora dessa lista  
→ FALHA DE PROTOCOLO

---

### 6.2 REGRA DE ATUALIZAÇÃO DE PROGRESSO

Quando uma etapa do Plano Mestre for executada, o agente EM MODO EXECUTOR:

1. DEVE gerar um artefato em `docs/03_execution_log/`
2. DEVE registrar:
   - etapa do plano
   - objetivo executado
   - ações realizadas
   - arquivos afetados
   - status (SUCESSO / FALHA / ABORTO)

O agente NUNCA:
- edita o Plano Mestre
- sobrescreve histórico
- marca gates como PASS

---

## 7. REGISTRO DE EXECUÇÃO (MEMÓRIA OBRIGATÓRIA)

Toda execução DEVE gerar um arquivo em:

docs/03_execution_log/

Execução sem registro  
→ NÃO EXISTIU

---

## 7.1 ORIENTAÇÃO CANÔNICA NO PONTO DE USO (DECISION-0193 — ⚠️ PROVISÓRIA)

> **⚠️ STATUS REAL, declarado por honestidade de rito:** esta seção materializa a `DECISION-0193`, que está **NÃO-SELADA** e recebeu **veredito B (5 correções nomeadas)** na auditoria independente de 2026-07-27. Pior: ela foi escrita **2 minutos após** o próprio rascunho da 0193 declarar que só se materializaria *"quando houver GO material próprio"* — ou seja, **o rito foi executado ao contrário** (a norma entrou em vigor e a auditoria veio depois). Registrado como falha de processo da direção, não como praxe. **Vale como orientação, não como lei**, até a 0193 ser corrigida e selada. Correções pendentes conhecidas: o guard prova **existência do alvo, não veracidade da afirmação**; a gramática do campo `NORMA` não está fixada; e o vocabulário de `STATUS` **colide com `docs/decisions/CODIGO_LATENTE_REGISTRY.md`**, que já classifica estado institucional de arquivo (`CÓDIGO LATENTE` etc.) — crosswalk obrigatório antes do selo.


O registro em `docs/` protege quem **lê a doc**. Esta seção protege quem **abre o arquivo** — o caso normal de uma IA sem memória.

**Regra:** arquivo que carrega decisão institucional (domínio governado: financeiro, autoridade, identidade/ontologia, territorial, governança) **ou** que está em estado não-óbvio (`LEGADO-CERCADO`, `DORMENTE`, `CONTIDO`, `REVOGADO`) declara no início:

```
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO | LEGADO-CERCADO | DORMENTE | CONTIDO | REVOGADO
// ║ NORMA:   <caminho real do documento que governa, com seção>
// ║ NÃO:     <o que não fazer aqui>
// ║ EM VEZ:  <o caminho correto, NOMEADO>
// ╚════════════════════════════════════════════════════════════════
```

**`EM VEZ` é obrigatório.** Cabeçalho que só diz "não faça" é **pior que nenhum**: o agente descobre que o caminho está fechado, não descobre qual é o aberto, e **inventa um terceiro** — é assim que verdade paralela nasce.

**TETO DE 5 LINHAS.** O bloco é ponteiro, não documento. Cabeçalho que vira ensaio custa tokens em toda leitura e deixa de ser lido — que é exatamente a falha que ele existe para evitar. Narrativa longa vive na norma apontada, não aqui.

**Economia (por que isto BARATEIA, não encarece):** o custo é pago **uma vez, ao abrir o arquivo relevante** — em vez de uma investigação inteira redescobrindo a mesma coisa a cada sessão. Camadas: `CLAUDE.md` (custa **sempre** → mínimo) → este protocolo (custa quando o domínio é tocado) → cabeçalho (custa só ao abrir aquele arquivo).

**O cabeçalho é PONTEIRO, nunca fonte.** Contradisse a norma? **A norma vence e o cabeçalho é bug.** Lê-lo **não dispensa** §2.2.

**🔴 A REGRA DO ACESSO (DECISION-0193 D5.2) — não existe frente de anotação.** Não se abre campanha nem se varre o repositório. **Tocou um arquivo em trabalho real e descobriu, no caminho, qual norma o governa? Deixa a migalha antes de sair.** Custo dedicado zero (viaja de carona em trabalho que já ia acontecer), e a cobertura cresce pelos caminhos vivos — os arquivos mais tocados são os mais perigosos e ficam protegidos primeiro.

**Trava:** anota-se **só o que se verificou**. Abriu por motivo alheio e não apurou o estado institucional? **Não escreve.** `STATUS` por dedução ou `NORMA` por palpite gera **cabeçalho falso — pior que ausente**, porque a próxima IA confia. Na dúvida, não anota e registra a dúvida no cartório.

**Exceção que OBRIGA:** achou cabeçalho/comentário que **mente**? Corrigir não é opcional — comentário errado causa dano ativo, e deixá-lo é escolher que a próxima instância erre.

Prioridade quando houver escolha: (1) comentário que **mente**; (2) `REVOGADO`/`CONTIDO`/`DORMENTE` sem aviso; (3) `LEGADO-CERCADO`; (4) `CANÔNICO` de domínio governado. **Vedada obrigação de massa.**

> **Prova de que precisa de guard:** `CONTINUOUS PRODUCTION` era rótulo verdadeiro na época de sprint e hoje **mente** em pelo menos dois arquivos — um deles o motor legado cercado por tripwire. Comentário sem fiscalização apodrece. O guard exige que o caminho em `NORMA` **exista fisicamente**: sinapse rompida vira erro vermelho, não mentira silenciosa.

---

## 8. LEITURA OBRIGATÓRIA ANTES DE QUALQUER CÓDIGO FINANCEIRO

Antes de criar, editar ou executar QUALQUER código relacionado a:

- transações
- saldos
- splits
- pagamentos
- ledgers
- liquidação
- créditos

o agente DEVE, obrigatoriamente, reler e obedecer:

1. docs/01_normative/SSOT_EXCLUSIVE_BANK_RULE.md
2. docs/01_normative/SSOT_CONTRACT.md
3. docs/01_normative/SSOT_REGISTRY_UNIFICARD.md
4. docs/01_normative/PROHIBITED_STRUCTURES.md

Violação destas regras  
→ INVALIDAÇÃO AUTOMÁTICA DA EXECUÇÃO

---

## 9. REGRA DE INVALIDAÇÃO

Qualquer violação deste protocolo  
→ INVALIDA A EXECUÇÃO INTEIRA

Não existem:
- resultados parciais
- exceções tácitas
- correções informais

---

## 10. REGRA FINAL (ANTI-REGRESSÃO)

O agente NÃO:
- pensa arquitetura
- decide produto
- improvisa
- assume progresso

O agente APENAS:
- LÊ
- OBEDECE
- EXECUTA
- REGISTRA
- ARQUIVA

Nada mais.

---

## N0 — Domínios (domains)

N0 (domains) define a organização macro do sistema.

- Representa os grandes domínios do mundo real:
  (ex: comércio, serviços, saúde, governança, educação, etc.)

- É armazenado na tabela:
  `domains`

- É uma lista controlada (não cresce livremente)

### Papel no sistema

N0 orienta:

- navegação (N1 / N2)
- organização de alto nível
- contexto semântico amplo

### O que N0 NÃO faz

N0 NÃO participa diretamente de fluxos operacionais.

Isso inclui:

- produtos
- estoque
- pedidos
- financeiro (bank)

### Regra crítica

N0 NÃO é usado como:

- fonte de verdade semântica (isso é CONCEPT)
- árvore operacional (isso é categories)
- identidade industrial (isso é canonical_products)

### Relações corretas

- N1 → depende de N0
- N2 → pode depender de N0
- CONCEPT → pode referenciar N0 (opcional)
- categories → NÃO dependem de N0 diretamente (não é dependência obrigatória)
- produtos → NÃO dependem de N0

### Invariante

N0 define o espaço macro do sistema,
mas não interfere na execução transacional.

---

## NAVEGAÇÃO E CAMADAS — MAPA ESTRUTURAL

O sistema UnifiCard é composto por camadas distintas, com papéis **NÃO** sobrepostos.
Este bloco é o **mapa mental oficial** para agentes: amarra N0, N1, N2, `categories` e CONCEPT **no mesmo quadro** (detalhe adicional na secção **N0 — Domínios (domains)** acima e nas secções **11–16** abaixo).

### N0 — Domínios (domains)

- Organização macro do sistema
- NÃO participa de execução transacional
- NÃO define semântica

### N1 — Navegação global

- Define pontos de entrada do sistema (navegação de alto nível)
- Estrutura de navegação governada sob N0
- Depende de N0
- Persistência normativa: `n1_nodes` (com `domain_key` → `domains`)

### N2 — Navegação contextual

- Define contextos e agrupamentos dentro de N1
- Pode depender de N0
- NÃO define, por si só, a árvore operacional de produto/serviço
- Persistência normativa: `n2_nodes` e ativação por CONTEXT (`context_*`); no ramo profissional, folhas derivadas de CONCEPT podem materializar-se em `categories` com `level` e `scope` conforme pipeline normativo — **sem** confundir com SSOT semântico

### CATEGORIES — Árvore operacional

- Define a estrutura navegável operacional (produtos, serviços, perfis, scopes)
- É a **única** árvore operacional do sistema (`categories`)
- Pode mapear para CONCEPT (ex.: `categories.concept_id` quando previsto)
- NÃO depende obrigatoriamente de N0 (sem FK direta a `domains` na árvore)
- **N1 e N2 (nós governados) NÃO substituem `categories`**; ligam-se via mapeamentos e fluxos normativos (ex.: `category_n1_mapping`), não por identidade intercambiável

### CONCEPT — Identidade semântica

- Define “o que algo é”
- É o SSOT semântico
- **Não** é derivado de navegação (N1/N2/`categories` não substituem CONCEPT)
- **Não depende** de N0, N1 ou N2 para existir como identidade (classificação opcional em `concepts.n0_domain` **não** define identidade)

### Regra crítica de separação

As camadas **NÃO** são intercambiáveis:

- N1 / N2 **NÃO** substituem `categories`
- `categories` **NÃO** substituem CONCEPT
- N0 **NÃO** substitui nenhuma das camadas acima
- CONCEPT **NÃO depende** de N0 (nem de N1/N2) para ser SSOT de identidade semântica

### Invariante

Qualquer tentativa de usar uma camada no lugar de outra  
→ **erro estrutural**  
→ **invalidação da execução** (alinhado à **Secção 9** deste protocolo)

---

## 11. SEPARAÇÃO DE CAMADAS

- **CONCEPT**: camada semântica (SSOT de identidade).
- **CATEGORY (`categories`)**: camada TREE de navegação operacional.
- **N1_NODES (`n1_nodes`)**: navegação global governada (não substitui `categories`).
- **PROFILE**: read model de consumo (não define verdade semântica).

## 12. REGRA DE IDENTIDADE SEMÂNTICA

- Identidade semântica é definida **somente por CONCEPT**.
- É proibido inferir identidade via `slug`, `category_id`, nome de categoria ou nome de exibição.
- `category_id` só pode ser usado como ponte explícita para `concept_id` quando a derivação estiver normativamente prevista.

## 13. USO DE CATEGORIES

- Existe **uma única árvore operacional** em `categories`.
- Módulos diferentes (perfil, marketplace, eventos, serviços) usam subconjuntos por `scope` e contexto.
- É proibido criar árvore paralela por módulo.

## 14. PERFIL PROFISSIONAL — ESTADO ATUAL

- Perfil profissional usa `categories` com `scope = 'professional'`.
- Skills válidas operam com `level <= 2`.
- `concept_id` é obrigatório nas categorias usadas no fluxo profissional.
- Validação deve ser estrita (sem fallback silencioso, sem retorno parcial).

## 15. ANTI-PATTERNS (PROIBIDO)

- Criar nova árvore para perfil.
- Misturar papel de `n1_nodes` com `categories`.
- Usar `slug` como identidade semântica.
- Duplicar semântica fora de CONCEPT.
- Criar SSOT paralelo.

---

## 16. EXTENSÃO N1 DE `pessoas-e-identidades` (RFC EM CURSO)

- A extensão normativa para N1 de `pessoas-e-identidades` está em: `22_RFC_N1_PESSOAS_E_IDENTIDADES.md`.
- Enquanto o RFC não for aprovado e consolidado, esse artefato é **referência obrigatória** para tarefas que toquem N1 de identidade humana.
- É proibido tratar o RFC como catálogo já congelado no mesmo nível do documento `19_N1_NAVIGATION_STRUCTURE_UNIFICARD.md`.
- Regras já vigentes e inegociáveis permanecem:
  - `n1_nodes` = navegação;
  - `categories` = árvore operacional única (inclui `scope='professional'`);
  - `CONCEPT` = identidade semântica;
  - sem árvore paralela e sem migração de semântica para N1.

---

## 17. BASELINE DE SCHEMA — `canonical_products` E ALINHAMENTO REPO ↔ BANCO

**Contexto (memória institucional operacional):** durante a reconstrução do sistema (novo banco / gênesis), o backend e o código passaram a depender de objetos que, em alguns ambientes, foram criados por migrations **aplicadas** mas **não** refletidas no tree (nomes do tipo `20260401140000_*` registados em `schema_migrations` sem ficheiro correspondente em `backend/migrations/`). O diretório `migrations_archive/` **não** é aplicado pelo runner oficial (`migrate.ts` só lê `backend/migrations/`) e contém histórico legado **não equivalente** linha-a-linha ao schema atual (ex.: variantes antigas de `canonical_products`).

**Decisão travada:** não “recuperar o passado” nem tratar o arquivo como SSOT de schema; **consolidar o presente** no repositório com uma migration **baseline** explícita:

- Ficheiro: `backend/migrations/20260412000000_canonical_products_baseline.sql`
- Conteúdo: `CREATE TABLE IF NOT EXISTS` + índices alinhados ao estado real (colunas, `jsonb`, `gtin` nullable, `UNIQUE (tenant_id, gtin)` como índice único parcial/nomeado `uidx_canonical_products_tenant_gtin`, FKs a `tenants` e `categories`), **sem** apagar dados nem reescrever histórico no banco.

**Implicações para agentes:**

1. Novos clones / BD fresco: passam a **criar** `canonical_products` por esta baseline quando a migration corre na ordem lexicográfica.
2. Ambientes já migrados: a mesma migration é **no-op** seguro (`IF NOT EXISTS`) se a tabela e índices já existirem.
3. Divergências futuras: corrigir com **migrations forward-only** novas, não editando a baseline salvo decisão humana explícita.
4. **Proibido** assumir que ficheiros em `migrations_archive/` reproduzem o schema atual ou que substituem esta baseline.

---

FIM DO DOCUMENTO  
TRILHO ÚNICO · EXECUÇÃO DETERMINÍSTICA · MEMÓRIA PRESERVADA

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- 00_AGENT_PROTOCOL.md
- 07_NOMENCLATURA_CANONICA.md
- 18_DOMAIN_ONTOLOGY_UNIFICARD.md
- 19_N1_NAVIGATION_STRUCTURE_UNIFICARD.md
- 20_N2_NAVIGATION_STRUCTURE_UNIFICARD.md
- 21_PLANO_DE_EXPANSÃO_GOVERNADA_DO_N2.md
- 22_RFC_N1_PESSOAS_E_IDENTIDADES.md
- CONSTITUICAO_UNIFICARD.md
- CORE_IMUTAVEL.md
- INVARIANTES_OPERACIONAIS_LEDGER.md
- LEIS_OPERACIONAIS_UNIFICARD.md
- LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md
- PROHIBITED_STRUCTURES.md
- SSOT_CONTRACT.md
- SSOT_EXCLUSIVE_BANK_RULE.md
- SSOT_REGISTRY_UNIFICARD.md

### Referenciado por
- 00_AGENT_PROTOCOL.md
- 00_INDEX.md
- 00_SUMARIO.md
- EVENT_OUTBOX_E_ENTREGA_CANONICO.md
- HANDLER_EXECUTION_AND_RELIABILITY.md
- INVARIANTES_OPERACIONAIS_LEDGER.md
- LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md
<!-- AUTO-GENERATED-END -->

---

## SEGURANÇA DE WORKTREE E REPARSE POINTS (ratificada 2026-07-12)

É proibido remover worktree que contenha symlink, junction, mount point ou reparse point cujo alvo resolvido esteja fora do próprio worktree.

Antes da remoção, deve ser executado o preflight versionado (`backend/scripts/worktree-safety.mjs audit <worktree>`), que falha se qualquer link resolver para fora da raiz auditada.

O link deve ser desmontado sem atravessar ou apagar o alvo.

`git worktree remove`, mesmo sem `--force`, NÃO substitui o preflight: a remoção recursiva pode seguir a junction/symlink e apagar o alvo real (ex.: node_modules do main tree via symlinks de workspace pnpm).
