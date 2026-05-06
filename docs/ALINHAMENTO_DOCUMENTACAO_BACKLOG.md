# Alinhamento da documentação — resumo único (backlog)

Este ficheiro consolida **o que falta fazer** para as documentações ficarem **coerentes entre si**, com **caminhos válidos** e **trilho claro para IAs e humanos**. Foi produzido a partir de auditorias read-only; **corrigir** os itens abaixo implica editar outros ficheiros além deste.

---

## 1. Tabela de verdade (caminhos canónicos sugeridos)

| Conceito | Caminho canónico no repositório |
|----------|----------------------------------|
| Registo SSOT (domínios, bank, identity, etc.) | `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md` |
| Estruturas proibidas / Gate 2 | `docs/01_normative/PROHIBITED_STRUCTURES.md` |
| Lei de autoridade (texto normativo) | `docs/01_normative/AUTHORITY_LAW.md` |
| Precedência ATL/KYC/… (processo SSOT) | `docs/ssot/AUTHORITY_PRECEDENCE.md` |
| Lei de coerência sistémica | `docs/01_normative/LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` |
| Contratos (norma) | `docs/01_normative/CONTRACTS.md` |
| Glossário semântico vigente | `docs/01_normative/99_GLOSSARIO_CANONICO.md` |
| Protocolo de agentes | `docs/01_normative/00_AGENT_PROTOCOL.md` |
| Gates de auditoria (PR) | `docs/04_audit/GATES.md` |
| Gates de execução SSOT | `docs/ssot/GATES.md` |
| Log forense (histórico completo) | `docs/ssot/FALSIFICATION_LOG.md` |

**Regra:** usar apenas `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md` para o registry; `docs/01_normative/PROHIBITED_STRUCTURES.md` para estruturas proibidas. Não usar `docs/ssot/` para esses dois domínios.

---

## 2. Prioridade P0 — bloqueiam cumprimento literal do trilho

1. **`UNIFICARD_PLANO_DEFINITIVO_v7.md` (raiz)** — existe como **PLACEHOLDER** (avisos em corpo); **não** é plano executável. Aberto: rever se o protocolo deve continuar a listar «leitura» como passo obrigatório sem conteúdo normativo real além do placeholder.

2. **`EXECUTAR/stand_by_UNIFICARD_PLANO_DEFINITIVO_v2.md`** (topo: **OBSOLETO**) / **`STAND_BY_UNIFICARD_PLANO_MESTRE_v2_1.md`** (topo: **não executar**). **Raiz:** `UNIFICARD_PLANO_MESTRE_v2_1.md` = placeholder; trilho real em `EXECUTAR/`.

3. **Referências a ficheiros inexistentes (registry / prohibited)** — **parcialmente corrigido** em `docs/`, `backend/README.md` e migrações SQL citadas na sprint P0. **Pendente (fora do âmbito desta sprint):** agregados `*.txt`, `FACA-AGORA/*`, `node_modules`, comentários TS dispersos.

4. **`docs/01_normative/interfaces/construcao.md`** — referenciado em `18_DOMAIN_ONTOLOGY_UNIFICARD.md`; pasta **ausente**. **Decisão:** criar o documento ou remover/alterar a linha da matriz de ontologia.

---

## 3. Prioridade P1 — links e onboarding quebrados

1. **`docs/architecture/CONTRACTS.md`** — referido em `docs/03_technical/contributing.md`, `docs/06_technical/contributing.md`, `docs/04_guides/README_20260122-073046.md`, `docs/05_guides/README_20260122-073046.md`, `docs/03_technical/leia_primeiro.md`, `docs/06_technical/leia_primeiro.md`. O ficheiro **`CONTRACTS.md`** está em **`docs/01_normative/CONTRACTS.md`**; em `docs/architecture/` **não** existe `CONTRACTS.md`. Corrigir **destino** e **caminhos relativos** (`./docs/...` desde subpastas de `docs/` está errado).

2. **`PLANO_FASE_ATUAL.md`** — referências genéricas coexistem com `docs/99_archive/PLANO_FASE_ATUAL.md` e `EXECUTAR/PLANO_FASE_ATUAL.txt`. Unificar **um** caminho oficial ou documentar qual usar em cada contexto.

3. **Glossário duplo** — `00_INDEX.md` declara `99_GLOSSARIO_CANONICO.md` canónico e `GLOSSARIO_CANONICO.md` não normativo. Atualizar remissões em `CORE_IMUTAVEL.md`, `OBSERVABILIDADE_CONSTITUCIONAL.md`, `docs/04_guides/*`, `docs/05_guides/*`, `docs/03_technical/INDEX_INSTITUCIONAL.md`, `docs/06_technical/INDEX_INSTITUCIONAL.md` para apontar só ao **`99_`**.

4. **Arquivo com typo de lei** — `docs/99_archive/CURSOR_PROMPT_ACTOR_IDENTITY.md` menciona `LEI_COERENCIA_SISTEMICA_UNIFICARD.md` (ficheiro **inexistente**); o canónico é `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md`. Corrigir ou arquivar com aviso explícito.

---

## 4. Prioridade P2 — clareza do trilho para IAs (sem necessariamente “link quebrado”)

1. **`00_AGENT_PROTOCOL.md` e `docs/ssot/`** — o protocolo não lista explicitamente leitura de `docs/ssot/` no mapeamento modular; outros documentos (ex. `PROHIBITED_STRUCTURES.md`) remetem para `AUTHORITY_PRECEDENCE` em `ssot`. **Adicionar** uma subsecção: quando aplicável (gates, autoridade, log forense), carregar `docs/ssot/…` e não confundir com `docs/04_audit/` (homónimos).

2. **Duas ordens de leitura** — distinguir numa frase: **2.3.1** (sequência operacional) vs **2.2.6** (precedência em conflito normativo), para evitar que IAs misturem as listas.

3. **Comentários em código** — onde só aparece `LEI_DE_COERENCIA_….md` ou `CORE_IMUTAVEL.md` sem `docs/01_normative/`, alinhar ao padrão de caminho completo (ex.: `bank-p2p-transfer.service.ts`, `event.service.ts`).

4. **Agregados `.txt` na raiz** (`01_NORMATIVE_FULL.txt`, etc.) — regenerar a partir dos `.md` corrigidos ou marcar como **não-SSOT** / gerados para não contradizerem a norma versionada.

5. **`node_modules/.../unificard-backend/README.md`** — espelha `backend/README.md`; após corrigir a fonte, rever publicação do pacote para não propagar caminhos errados.

---

## 5. Verificação contínua (recomendado após correções)

- Script ou job CI que: (1) extraia `` `docs/...` `` e ligações `](...)` internas; (2) verifique existência do ficheiro; (3) falhe em PR se houver remissões ao registry fora de `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md`, prohibited fora de `docs/01_normative/PROHIBITED_STRUCTURES.md`, ou CONTRACTS fora de `docs/01_normative/CONTRACTS.md`.
- Manter **`docs/CORE_DOCUMENTS.md`** como âncora humana e alinhar o resto a ele.

---

## 6. Estado deste ficheiro

- **Criado na raiz** como registo único de trabalho de alinhamento.
- Não substitui norma em `docs/01_normative/`; é **backlog operacional** até as correções serem aplicadas.
