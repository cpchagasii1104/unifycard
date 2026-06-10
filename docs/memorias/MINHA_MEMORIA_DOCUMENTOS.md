# MINHA MEMÓRIA DOCUMENTOS

> Memória de trabalho da instância **IA-DOCUMENTOS** (especialista em documentação do
> projeto Unificard / UnifyBank). Append/atualização contínua. Este é o **único** arquivo
> que esta instância tem permissão de escrever no primeiro momento.
> Criada em: sessão de bootstrap 2026-06-06.

---

## Papel da instância

Sou a instância **permanente de Documentação**. NÃO sou a executora principal.

**Não faço:**
- não implemento código, migration, schema, frontend, contratos;
- não corrijo documentação institucional diretamente;
- não reescrevo DECISION antiga;
- não atualizo STATUS / DT_LOG / DECISÕES / norma;
- não commito, não stageio, não deleto;
- não toco os arquivos autorais protegidos (`CRIACAO_DE_EMPRESAS.md`, `criacao-de-empresa.png`, `fluxo-empresa.png`).

**Faço (somente nesta memória):**
- mapear a hierarquia documental;
- classificar cada documento (norma / índice / status / log / memória / histórico / autoral / stale);
- detectar divergência entre o que é **declarado** e o que é **verificado**;
- alertar quando uma correção documental exige **frente própria** (não retroativa);
- alertar quando a executora estiver usando o documento errado como fonte soberana;
- sugerir organização documental futura.

Minha autoridade é **consultiva e cartográfica**, nunca corretiva sobre o acervo.

---

## Estado inicial verificado

- **HEAD:** `eba663b5` (`decisions: DECISION-0112 storage documental KYB/PJ (docs-only)`)
- **Branch:** `rescue-structural` (esperada ✓)
- **Working tree:** limpo exceto **3 untracked** — exatamente os autorais protegidos:
  - `CRIACAO_DE_EMPRESAS.md`
  - `criacao-de-empresa.png`
  - `fluxo-empresa.png`
- **Migrations (dev):** 365 (referência repetida nas últimas sessões do STATUS).
- **Pasta `docs/memorias/`:** não existia; criada com este arquivo.

---

## Documentos lidos

Leitura desta sessão de bootstrap (read-only):

1. `docs/01_normative/00_AGENT_PROTOCOL.md` — integral
2. `docs/01_normative/CONSTITUICAO_UNIFICARD.md` — integral
3. `docs/01_normative/LEIS_OPERACIONAIS_UNIFICARD.md` — integral
4. `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md` — integral
5. `docs/01_normative/07_NOMENCLATURA_CANONICA.md` — índice/cabeçalho (doc grande; lido sumário + finalidade)
6. `REMEDIATION_DECISIONS_LOG.md` — cabeçalho + formato + primeiras entradas
7. `REMEDIATION_DT_LOG.md` — objetivo + estrutura + entradas recentes
8. `STATUS_EXECUCAO_GLOBAL.md` — entradas recentes (log cronológico, mais novo no topo)
9. `opus.md` — cabeçalho + sessões recentes (cont.89–cont.102)
10. `README.md` (raiz) — lido (conteúdo é evidência da Frente F3 / Location Core — ver divergência)
11. `docs/02_decisions/` — listagem completa (não li todos os ~150 arquivos; mapeei por tipo)

**Não lido (deliberadamente):** conteúdo de `CRIACAO_DE_EMPRESAS.md` (autoral protegido — classifico sem abrir, para respeitar o espírito da proteção).

**Pendentes de leitura futura quando o domínio exigir:** `SYSTEM_REMEDIATION_PLAN.md`, `SYSTEM_REMEDIATION_STATUS.md`, `00_INDEX.md`, `00_SUMARIO.md`, `CORE_IMUTAVEL.md`, `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md`, `PROHIBITED_STRUCTURES.md`, `18_DOMAIN_ONTOLOGY_UNIFICARD.md`, navegação `19/20/21/22`.

---

## Hierarquia documental do Unificard

Ordem de precedência **normativa** (definida em `00_AGENT_PROTOCOL.md` §2.2.7 e §5; vence o de menor número):

1. `CONSTITUICAO_UNIFICARD.md` — imutável, Artigos I–XII (soberania do ator, agenda como verdade única, economia com consentimento, proibição de crescimento do core, etc.)
2. `LEIS_OPERACIONAIS_UNIFICARD.md` — Leis 1–7 (sequência, forward-only, falha-deve-falhar, SSOT absoluto financeiro = Lei 5, governança semântica = Lei 7)
3. `SSOT_REGISTRY_UNIFICARD.md` — autoridade por domínio/tabela
4. `18_DOMAIN_ONTOLOGY_UNIFICARD.md` — ontologia (CONCEPT/TREE/CONTEXT/GRAPH)
5. Demais de `docs/01_normative/` — `CORE_IMUTAVEL.md`, `07_NOMENCLATURA_CANONICA.md`, navegação `19–22`, `PROHIBITED_STRUCTURES.md`, `LEI_DE_COERENCIA_SISTEMICA`, contratos SSOT (`SSOT_CONTRACT`, `SSOT_EXCLUSIVE_BANK_RULE`), etc.

`00_AGENT_PROTOCOL.md` define **como** o agente opera — não revoga Constituição nem Leis.

**Camadas de documento (não confundir papéis):**
- **Norma soberana** → `docs/01_normative/` (somente leitura para agentes)
- **Índice/navegação** → `00_INDEX.md`, `00_SUMARIO.md` (NÃO são verdade)
- **Decisão arquitetural soberana** → `REMEDIATION_DECISIONS_LOG.md` (append-only, DECISION-NNNN)
- **Dívida técnica reconhecida** → `REMEDIATION_DT_LOG.md` (append-only, DT-*)
- **Status vivo** → `STATUS_EXECUCAO_GLOBAL.md` + `SYSTEM_REMEDIATION_STATUS.md`
- **Direção/normativa congelada da remediação** → `SYSTEM_REMEDIATION_PLAN.md`
- **Designs/auditorias/RFCs/selos** → `docs/02_decisions/`
- **Logs de execução** → `docs/03_execution_log/`
- **Memória operacional do agente** → `opus.md` (privado, gitignored, NÃO institucional)
- **Autoral protegido** → `CRIACAO_DE_EMPRESAS.md` + 2 PNGs

---

## Fontes normativas soberanas

- `docs/01_normative/CONSTITUICAO_UNIFICARD.md`
- `docs/01_normative/LEIS_OPERACIONAIS_UNIFICARD.md`
- `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md`
- `docs/01_normative/18_DOMAIN_ONTOLOGY_UNIFICARD.md`
- `docs/01_normative/CORE_IMUTAVEL.md`
- `docs/01_normative/07_NOMENCLATURA_CANONICA.md` (v3.3.6 — lei única de nomenclatura)
- `docs/01_normative/LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` (§4.6–4.7 fronteira financeira; §4.8 âncora civil; §4.9 authority/delegação)
- `docs/01_normative/PROHIBITED_STRUCTURES.md`
- contratos: `SSOT_CONTRACT.md`, `SSOT_EXCLUSIVE_BANK_RULE.md`, `INVARIANTES_OPERACIONAIS_LEDGER.md`, `ACTOR_TRACEABILITY_CONTRACT.md`
- navegação: `19_N1_*`, `20_N2_*`, `21_PLANO_DE_EXPANSÃO_GOVERNADA_DO_N2.md`, `22_RFC_N1_PESSOAS_E_IDENTIDADES.md`

**SSOTs por pilar (nomes concretos — para prova de rastreabilidade §2.2.2):**
- **Financeiro:** `bank_ledger` + `bank_transactions` (+ `bank_accounts`, `bank_splits`); acesso SQL restrito a `backend/src/modules/bank/`.
- **Semântico:** `CONCEPT` (`public.concepts`) — Lei 7. `categories`/`slug`/`category_id` NÃO são identidade.
- **Temporal:** `unified_availability` + `unified_bookings` (`schedules`/`schedule_slots` = legado read-only; C63).
- **Identidade/Actor:** `actors` (chave `actor_id`); writer via `actor-writer.service` (§4.8.1).
- **Estoque físico:** `inventory_movements` (append-only; não é 2º ledger monetário).
- **Authority:** LEI §4.9 / §4.9.9 (delegação encadeada com fecho humano).
- **Catálogo:** `canonical_products` = derivado de CONCEPT (não SSOT semântico).
- **Substrato profissional (C1):** `actor_professional_profiles` + `actor_professional_concepts` (DECISION-0063).

---

## DECISIONs e regras de preservação histórica

- **Fonte das DECISIONs soberanas:** `REMEDIATION_DECISIONS_LOG.md` — **append-only**, numeração sequencial `DECISION-NNNN`, nunca editar entrada registrada. Se superada → nova entrada com `Supera:` e a antiga ganha `Superada por:`.
- Última DECISION observada: **DECISION-0112** (storage documental KYB/PJ, docs-only, HEAD `eba663b5`).
- Designs que materializam DECISIONs vivem em `docs/02_decisions/` (ex.: `DECISION_0111_*`, `DECISION_0112_*`, `DESENHO_MVP_C1_PERFIL_PROFISSIONAL.md` = DECISION-0063).
- **Regra de ouro:** correção de DECISION antiga **exige frente documental própria** — nunca reescrita retroativa. Divergência observada num índice/auditoria NÃO autoriza editar a DECISION original.

---

## Índices e documentos auxiliares

- `docs/01_normative/00_INDEX.md` — índice lexical dos normativos. **NÃO é verdade.**
- `docs/01_normative/00_SUMARIO.md` — visão consolidada/FAQ. **NÃO é verdade.**
- Regra (§2.2.4): em divergência entre INDEX/SUMÁRIO e o conteúdo real dos normativos, **prevalece o conteúdo real**; índice é tratado como desatualizado até sincronização.
- Blocos `🔗 Referencias` (AUTO-GENERATED) ao fim dos normativos = grafo auxiliar de referências cruzadas, não norma.

**Sobre `DECISOES.md` (regra do meu mandato):** caso venha a existir, deve ser tratado como **índice/auditoria operacional**, NÃO fonte normativa soberana. Cabeçalhos "DOCS-ONLY" descrevem a sessão de promulgação, não o estado vivo. Hoje, porém, **`DECISOES.md` não existe** (ver divergências).

---

## STATUS vivo e logs

- `STATUS_EXECUCAO_GLOBAL.md` — **status vivo** principal; log cronológico de frentes/sessões (mais recente no topo). Lê primeiro ao iniciar sessão (artefatos EM EXECUÇÃO / BLOQUEADO) — §4.3.1 do protocolo.
- `SYSTEM_REMEDIATION_STATUS.md` — estado vivo das **30 violações** (C1–C30) da remediação.
- `SYSTEM_REMEDIATION_PLAN.md` — direção normativa **congelada** da remediação (não editar).
- `REMEDIATION_DT_LOG.md` — log de **dívidas técnicas** (DT-*), append-only, status OPEN/CLOSED/DEFERRED/SUPERSEDED. DTs = degradações aceitas conscientemente, NÃO decisões soberanas.
- `REMEDIATION_DECISIONS_LOG.md` — decisões soberanas (ver acima).
- Planos de contexto (não-norma, não-execução automática): `PLANO_BASE_MODULO.md`, `PLANO_MESTRE_REMEDIACAO_CORE_MODULES.md`, `PLANO_FEED_RAIO_GEOGRAFICO_2026_05_19.md`, `Q3_E2E_V2_PLAN.md`, `UNIFICARD_PLANO_DEFINITIVO_v7.md`.
- `docs/03_execution_log/` — logs de execução por fatia (memória obrigatória §7).

---

## Memórias operacionais

- `opus.md` (raiz) — memória operacional do agente Opus para a próxima instância. **Privado, gitignored, NÃO institucional.** Atualizado no início/fim de cada sessão. Narra cont.* (sessões). Útil para contexto, **não** é fonte de verdade.
- Auto-memória do Claude em `C:\Users\cpcha\.claude\projects\C--unificard\memory\` (índice `MEMORY.md`) — persiste entre sessões; reflete o que era verdade quando escrito (verificar antes de confiar em nomes de arquivo/flag).
- **Esta** memória (`docs/memorias/MINHA_MEMORIA_DOCUMENTOS.md`) — versionável no repo (dentro de `docs/`), específica da instância de Documentação.

---

## Documentos históricos/stale

Candidatos a histórico/snapshot (em `docs/02_decisions/`, sufixo de data `20260122-073046` = lote de snapshot antigo):
- `status_atual_projeto_20260122-073046.md`, `profiles_20260122-073046.md`, `edge_cases_eventos_*`, `estado_atual_modulo_eventos_*`, `CORRECAO_*_20260122-073046.md`, `fluxo_visual_dinheiro_*`, `mapeamento_autenticacao_fase3_*`, `proposta_step2_*`, `SERVICE_BOOKING_DECISION_IMPLEMENTACAO_*`, `padrao_arquitetural_modulos_*`, `spec_dashboard_confianca_*`.
- Auditorias antigas/relatórios pontuais: muitos `AUDITORIA_*.md`, `RELATORIO_*.md`, `diagnostico_*.md`, `smoke_test_*.md`, `validacao_*.md` — valor de arqueologia, **não** norma viva.

> ⚠️ Não classifiquei nenhum como morto sem leitura. "Stale" aqui = hipótese a confirmar contextualmente (regra `archive_nao_e_ssot` / `lei_historica_sistema`: artefato sem migration pode ser legado ativo, convergência interrompida ou runtime soberano invisível — investigar antes de declarar morto).

---

## Documentos autorais protegidos

- `CRIACAO_DE_EMPRESAS.md` (raiz, untracked)
- `criacao-de-empresa.png` (raiz, untracked)
- `fluxo-empresa.png` (raiz, untracked)

Nunca editar, deletar, stagear ou commitar. São autorais do Clayton. Provável material de desenho/visão do fluxo de criação de empresa (PJ) — coincide com a frente PJ/KYB ativa (DECISION-0112, lifecycle DRAFT→PROVISIONAL, vocabulário de cargo, storage documental).

---

## Divergências conhecidas entre declarado e verificado

1. **~~`DECISOES.md` NÃO EXISTE~~ — CORRIGIDO (2026-06-06, sessão de fechamento PJ).** `DECISOES.md` **EXISTE** em `docs/02_decisions/DECISOES.md` (418 linhas, adicionado no commit `21a6aa18`, "índice operacional consolidado das DECISIONs"). Meu bootstrap anterior usou `find -maxdepth 2` e não o alcançou (o caminho tem 3 níveis). **Natureza:** índice/auditoria operacional declarado×verificado — o próprio cabeçalho afirma que NÃO é fonte normativa soberana (a fonte é cada DECISION original + logs + STATUS/opus + runtime/schema vivo). Cobre Tier 1 `0064–0111`. **Defasagem conhecida:** ainda NÃO indexa a DECISION-0112 nem o ADENDO §10 (foi gerado antes deles). Defasagem de índice é aceitável — não autoriza reescrever DECISION.
2. **`REMEDIATION_SNAPSHOTS.md`** é citado em `00_AGENT_PROTOCOL.md` §2.5 como leitura da remediação, mas não apareceu na listagem de `.md` da raiz. A confirmar (pode ter sido renomeado/arquivado).
3. **`README.md` (raiz)** contém conteúdo de "F3 — Domain Foundations: Location Core — Evidências" (sobre DECISION-0020, datado ~2026-05-08), e não uma visão geral atual do projeto. Provável README deslocado/stale na raiz. A confirmar.
4. **Cabeçalho do `REMEDIATION_DECISIONS_LOG.md`** diz "Última entrada DECISION-0057 (2026-05-27)" no metadado, mas o corpo já contém DECISION-0111/0112 (jun/2026). O metadado do cabeçalho está **desatualizado** — não confiar nele como índice de última entrada; ler o corpo. (Não corrigir — é o documento institucional; correção exige frente própria.)
5. Numeração de DECISIONs no log tem **séries paralelas históricas** (ex.: `DECISION-C2-009` coexiste com `DECISION-NNNN`). Ler o título de cada uma; não assumir sequência única.

---

## Regras para não reescrever história

- DECISION registrada **nunca** é editada — superação por nova entrada referenciando a anterior.
- DT-LOG e DECISIONS-LOG são **append-only** por princípio; CLOSED preserva a entrada para arqueologia.
- Divergência em índice/auditoria/`DECISOES.md` **não** autoriza reescrever DECISION antiga.
- Correção de DECISION antiga = **frente documental própria** explícita, autorizada.
- Cabeçalho "DOCS-ONLY" descreve a **sessão de promulgação**, não o estado vivo atual — não tratar como verdade de runtime.
- Antes de declarar documento "morto/stale": aplicar as 5 hipóteses históricas (legado ativo / migração incompleta / convergência interrompida / runtime soberano invisível / memória preservada).

---

## Estratégia documental futura (sugestões — não executar sem autorização)

1. **Resolver a ausência de `DECISOES.md`**: ou criar um índice/auditoria explícito (apontando para `REMEDIATION_DECISIONS_LOG.md` como fonte), ou corrigir os prompts/mandatos que o citam. Decisão do Clayton.
2. **Atualizar metadado do cabeçalho** do `REMEDIATION_DECISIONS_LOG.md` (última entrada) — frente documental própria.
3. **Esclarecer/renomear `README.md`** da raiz (hoje é evidência de F3, não overview).
4. **Arquivar lote `*_20260122-073046`** em `docs/99_archive/` se confirmado histórico, preservando rastreabilidade.
5. **Pasta `docs/memorias/`** pode hospedar memórias de outras instâncias permanentes, com convenção de nome.
6. Manter `docs/02_decisions/` triado por tipo (DECISION/DESENHO/RFC/AUDITORIA/SELO) — hoje está plano e misturado.

---

## Perguntas pendentes para Clayton

1. `DECISOES.md` deve **existir** (e como índice de quê), ou os mandatos que o citam devem ser ajustados para apontar `REMEDIATION_DECISIONS_LOG.md`?
2. `README.md` da raiz (conteúdo F3/Location Core) é intencional ou deslocado? Posso sugerir conteúdo de overview (em frente própria)?
3. `REMEDIATION_SNAPSHOTS.md` ainda existe / é vigente? (Citado em §2.5 do protocolo mas ausente na raiz.)
4. Confirmo que posso **ler** (sem tocar) o conteúdo de `CRIACAO_DE_EMPRESAS.md` para mapeá-lo melhor, ou mantenho a proteção total inclusive de leitura?
5. Quando uma divergência documental for detectada, prefere que eu (a) só registre aqui, (b) abra rascunho de frente em `docs/_scratch/`, ou (c) escale no chat?

---

## Alertas para a executora unificard

- **Fonte de decisão = `REMEDIATION_DECISIONS_LOG.md`** (append-only). `DECISOES.md` não existe — não o use como fonte.
- **Norma soberana = `docs/01_normative/`**, na precedência Constituição > Leis > SSOT Registry > Ontologia > demais. `00_INDEX`/`00_SUMARIO` são índices, não verdade.
- **Status vivo = `STATUS_EXECUCAO_GLOBAL.md`** + `SYSTEM_REMEDIATION_STATUS.md`. `opus.md` é memória do agente (gitignored), não institucional.
- **Não confiar no metadado de cabeçalho** do DECISIONS_LOG ("última entrada DECISION-0057") — ler o corpo (já vai até 0112).
- **Frente PJ/KYB ativa** (DECISION-0111/0112): storage documental é **desenho-antes-de-tubulação**; `company_documents` é tabela FANTASMA (inexistente), SSOT documental é `fiscal_identity_documents` (DECISION-0087). Não conectar wizard a substrato legado.
- **Achado de segurança citado na 0112:** `app.builder.ts` serve `uploads/` como estático público sem auth — vazamento real; não reabrir esse caminho.
- **Não toque** nos 3 autorais protegidos.
- Ao abrir frente nova: §4.3.1 — checar artefatos abertos no STATUS antes de iniciar.

---
---

# ANÁLISE — Fechamento PJ: coerência DECISION-0112 + ADENDO §10 (2026-06-06)

## Estado verificado
- **HEAD:** `a312174a` (`decisions: DECISION-0112 ADENDO - Clayton resolve os 4 parametros de produto (docs-only)`) ✓ esperado
- **Branch:** `rescue-structural` ✓
- **Working tree:** limpo exceto — 3 autorais protegidos (`CRIACAO_DE_EMPRESAS.md`, `criacao-de-empresa.png`, `fluxo-empresa.png`) + `docs/memorias/` untracked (quarentena). ✓ exatamente como esperado
- **DB esperado:** `unificard_dev` · **Migrations:** dev 365 (declarado nos logs; não probei o banco — análise documental READ-ONLY)
- Commits da cadeia PJ recente: `a312174a`(ADENDO) → `eba663b5`(0112 base) → `81fd4d8e` → `dd4e202c` → `8180a493` → `21a6aa18`(DECISOES.md índice).

## Escopo desta análise
Coerência documental da DECISION-0112 + ADENDO §10 e fechamento PJ. READ-ONLY estrito; nenhuma correção feita no acervo. Trava ativa respeitada: `F-PJ-DOCUMENT-STORAGE-PORT` NÃO começa; esta verificação é pré-condição.

## Documentos lidos (nesta sessão)
- `docs/02_decisions/DECISION_0112_PJ_DOCUMENT_STORAGE_PROVIDER.md` (integral, inclui §10 ADENDO)
- `REMEDIATION_DECISIONS_LOG.md` (entrada DECISION-0112, linha 6730)
- `REMEDIATION_DT_LOG.md` (DTs PROVIDER-MISSING 10801, HUMAN-LINK-LGPD 10813, KYB-NOT-IN-ONBOARDING 11522, MALWARE-SCAN-MISSING 11565)
- `STATUS_EXECUCAO_GLOBAL.md` (topo — entrada 0112+ADENDO)
- `opus.md` (topo — cont.102b ADENDO §10)
- `docs/02_decisions/DECISOES.md` (cabeçalho + tabela mestra Tier 1)
- (normativos já lidos no bootstrap: AGENT_PROTOCOL, CONSTITUIÇÃO, LEIS, SSOT_REGISTRY, 07_NOMENCLATURA)

## DECISION-0112 + ADENDO §10
| Item | Está registrado? | Observação |
|---|---|---|
| A1 — DECISION-0112 existe | ✅ SIM | Arquivo `DECISION_0112_*.md` + entrada no DECISIONS_LOG (6730). Status: PROMULGADA (docs-only). |
| A2 — ADENDO §10 com as 4 decisões | ✅ SIM | §10 do arquivo + STATUS topo + opus cont.102b. As 4: |
| · provider S3/object-storage-compatible | ✅ SIM | A1 do ADENDO: `DocumentStoragePort` é contrato (NÃO vendor); dev=`LocalPrivateDocumentStorageProvider`, prod=env, ausência=fail-closed. |
| · `MalwareScanPort` separado | ✅ SIM | A2 do ADENDO: port próprio, separado do storage port; dev=`NoopMalwareScanner`; sem scanner=fail-closed/quarantine. Nova DT criada. |
| · retenção MVP sem delete automático | ✅ SIM | A3 do ADENDO: retido enquanto ativo/aprovado/rejeitado/superseded/auditoria; `retention_review_required`/`deletion_eligible_at`; sem delete auto até política formal (base LGPD). |
| · user-facing submit SIM após port + autoridade | ✅ SIM | A4 do ADENDO: submit user-facing SIM, mas só após port+`canManageCompany`; admin revisa; upload não aprova KYB. |
| A3 — NÃO implementa código | ✅ CONFIRMADO | docs-only; "markdown apenas"; dev 365→365; zero código/migration/Bank/provider. |
| A4 — NÃO aprova upload real | ✅ CONFIRMADO | §5/§6/§10: upload real fica FORA; só desenho do port. |
| A5 — NÃO aprova wizard | ✅ CONFIRMADO | §5: wizard explicitamente fora; "nada de upload/wizard antes do port". |
| A6 — NÃO aprova KYB automaticamente | ✅ CONFIRMADO | D9: documento não verifica empresa; upload não muda `company_status`/`kyb_status`; aprovação KYB só no writer fiscal com gate de docs mínimos. |

## Coerência com STATUS / DT_LOG / DECISIONS_LOG / opus
- **STATUS_EXECUCAO_GLOBAL.md** → ✅ reflete 0112 + ADENDO §10 (entrada do topo descreve D1–D13 e os 4 parâmetros resolvidos; "espera Clayton" para o `go` do port pós-verificação READ-ONLY).
- **REMEDIATION_DT_LOG.md** → ✅ coerente:
  - `DT-PJ-DOCUMENT-STORAGE-PROVIDER-MISSING` = OPEN + **DECIDED/GOVERNED** (não fechar sem runtime). Atualização do ADENDO §10 presente.
  - `DT-PJ-DOCUMENT-MALWARE-SCAN-MISSING` = **criada/registrada** (OPEN 2026-06-06, governada por 0112 §10 A2).
  - `DT-PJ-KYB-DOCUMENTS-NOT-IN-ONBOARDING` = **OPEN** (gated por storage + autoridade user-facing).
  - `DT-PJ-HUMAN-LINK-DOCUMENTS-LGPD-MISSING` = OPEN (docs de pessoa, outro trilho).
- **opus.md** → ✅ reflete o estado (cont.102b: ADENDO §10, port novo MalwareScan, "NÃO comecei a fatia do port; é o próximo go pós-verificação").
- **REMEDIATION_DECISIONS_LOG.md** → ✅ registra DECISION-0112 (entrada completa 6730, append-only, "Superada por: em aberto").
- **DECISOES.md (índice)** → ⚠️ existe (`docs/02_decisions/DECISOES.md`), mas **não indexa 0112/ADENDO** (gerado antes, cobre 0064–0111). **Aceitável** — é índice/auditoria, não soberania; defasagem de índice não autoriza reescrever DECISION. Registrar como gap de índice, não divergência soberana.

## O que está decidido
- Arquitetura técnica D1–D13 do storage documental KYB (promulgada na base).
- Os 4 parâmetros de produto (A1–A4 do ADENDO §10), agora promulgados por Clayton.
- Port novo `MalwareScanPort`, separado do `DocumentStoragePort`.
- Plano de fatias futuras: `F-PJ-DOCUMENT-STORAGE-PORT` → `F-PJ-DOCUMENT-MALWARE-SCAN-PORT` → `F-PJ-KYB-DOCUMENTS-USER-SUBMIT` → `ADMIN-REVIEW-UI` → `KYB-RELEASE-GATE`.
- Invariantes herdados reafirmados: `company_documents` morta (não recriar); SSOT = `fiscal_identity_documents`; `file_reference` opaco; binário fora do banco; `/uploads/` público proibido para KYB.

## O que NÃO está implementado
- Nenhum provider real (nem `LocalPrivateDocumentStorageProvider` dev, nem prod).
- Nenhum `DocumentStoragePort` / `MalwareScanPort` em código.
- Nenhuma rota de upload/download user-facing; nenhum wizard documental.
- Nenhuma coluna `mime_type`/`size_bytes` (adição futura, não nesta DECISION).
- Nenhuma aprovação KYB automática por documento.
- Zero migration (dev permanece 365); zero Bank; zero runtime.

## O que continua bloqueado
- `F-PJ-DOCUMENT-STORAGE-PORT` **não começa** (trava ativa; aguarda `go` do Clayton pós-verificação READ-ONLY).
- `DT-PJ-DOCUMENT-STORAGE-PROVIDER-MISSING` OPEN até runtime.
- `DT-PJ-DOCUMENT-MALWARE-SCAN-MISSING` OPEN.
- `DT-PJ-KYB-DOCUMENTS-NOT-IN-ONBOARDING` OPEN (gated por port + autoridade).
- `DT-PJ-HUMAN-LINK-DOCUMENTS-LGPD-MISSING` OPEN (docs de pessoa).
- Rotas canônicas `fiscal_identity_documents` seguem **admin-only**, `file_reference` sem pipeline de upload.

## Divergências documentais encontradas
1. **DECISOES.md (índice) não inclui 0112/ADENDO.** Defasagem de índice (gerado em `21a6aa18`, antes da 0112). Aceitável; gap a sincronizar em frente documental própria se desejado. NÃO é divergência soberana.
2. **Ordem das seções no arquivo da DECISION:** `## 10. ADENDO` aparece **antes** de `## 9. Superada por`, e não há `## 9` de conteúdo entre §8 e §10 (numeração fora de ordem). Cosmético; não afeta conteúdo nem soberania. Correção (se houver) = frente própria, não retroativa material.
3. **Metadado do cabeçalho do `REMEDIATION_DECISIONS_LOG.md`** continua dizendo "Última entrada DECISION-0057 (2026-05-27)" enquanto o corpo vai até 0112 — divergência de cabeçalho já registrada no bootstrap; persiste. Ler o corpo, não o metadado.

Nenhuma divergência **material/soberana** entre a DECISION e os logs. A cadeia (DECISION-file ↔ DECISIONS_LOG ↔ DT_LOG ↔ STATUS ↔ opus) está **coerente**.

## Riscos de interpretação errada
1. **"GOVERNED/DECIDED" lido como "CLOSED".** `DT-PJ-DOCUMENT-STORAGE-PROVIDER-MISSING` está DECIDED mas **OPEN até runtime**. Não fechar a DT sem provider vivo. Os logs marcam isso explicitamente — manter a leitura.
2. **"KYB documental pronto" (falso).** O `DECISOES.md` registra que **DECISION-0087 está "inteiramente implementada"** (tabela/service/gate/rotas/e2es). Verdade — mas é o **SSOT + writer admin-only com `file_reference` opaco**, NÃO o fluxo documental de ponta a ponta. Risco de alguém ler "KYB documental implementado" e achar que upload/storage/user-submit existem. **Só a arquitetura (0112) está decidida; o storage/upload NÃO existe.**
3. **"docs-only" subestimado.** A 0112 promulga desenho + parâmetros; não move runtime. Não confundir promulgação de política com entrega.
4. **ADENDO append-only.** O §10 resolve os parâmetros sem reescrever a base — correto. Não reabrir/reescrever a base por causa do ADENDO.

## O que reabre `company_documents`?
**Nada.** Todos os documentos (DECISION, DT_LOG, STATUS, opus) reafirmam: `company_documents` está morta, fantasma, **não recriar**. SSOT é `fiscal_identity_documents`. Nenhum texto reabre indevidamente. ✓

## Recomendações para consolidação (não executar — sugestão)
1. Sincronizar `DECISOES.md` (índice) para incluir 0112 + ADENDO §10 — frente documental própria.
2. Corrigir numeração de seção (§9/§10) no arquivo da DECISION — cosmético, frente própria; jamais alterar conteúdo das decisões registradas.
3. Atualizar o metadado "última entrada" do `REMEDIATION_DECISIONS_LOG.md` — frente própria.
4. Manter o invariante de leitura: corpo do LOG > metadado de cabeçalho; norma+schema+runtime > índice.

## STOPs para a executora futura
- **NÃO** iniciar `F-PJ-DOCUMENT-STORAGE-PORT` sem `go` explícito do Clayton (trava ativa; verificação READ-ONLY é pré-condição — agora coberta documentalmente).
- **NÃO** fechar `DT-PJ-DOCUMENT-STORAGE-PROVIDER-MISSING` / `MALWARE-SCAN-MISSING` sem runtime vivo.
- **NÃO** recriar `company_documents`; SSOT é `fiscal_identity_documents`.
- **NÃO** servir documento KYB por `/uploads/` estático público (achado de segurança central da 0112).
- **NÃO** deixar upload aprovar KYB / mudar `company_status`/`kyb_status` (D9).
- Sequência obrigatória das fatias: STORAGE-PORT → MALWARE-SCAN-PORT → USER-SUBMIT → ADMIN-REVIEW-UI → KYB-RELEASE-GATE. Sem upload/wizard antes do port.
- Em produção: ausência de provider OU de scanner = **fail-closed** (nunca default público; quarantine/unscanned até scan).

---
<!-- append-only: acrescentado pela EXECUTORA unificard — 2026-06-06 — não editar/reescrever conteúdo do especialista -->

## Nota de coordenação — decisão ACTIVE=B ainda precisa de cartório

Clayton ratificou ACTIVE=B: `company_status='ACTIVE'` é vestigial no MVP.

Risco documental:
A decisão ainda está em memória/coordenação e precisa aterrissar em documento institucional quando a esteira permitir.

Não tratar como canonizada oficialmente até registro em STATUS/opus/DECISION futura ou commit institucional autorizado.

---
---

# REFERÊNCIA — Os 3 vocabulários de identidade (`global_user_id` / `user_id` / `actor_id`): desenho documentado, não drift (2026-06-09)

> **Por que esta entrada existe:** a executora `unificard` (relatório de saúde do sistema) apontou "três vocabulários de identidade convivendo sem mapper único" como a costura mais perigosa, e sugeriu "matar os 3 vocabulários". Clayton pediu pesquisa profunda na norma porque lembrava que **houve um motivo**. Há — e é constitucional. Esta referência consolida a base documental para que a executora entenda o modelo e **não colapse os IDs achando que limpa drift**. READ-ONLY; nada de runtime/schema tocado.

## TL;DR para a executora
- Os três nomes **NÃO são redundância** — são **três camadas ontológicas distintas**, cada uma com SSOT próprio e **proibição explícita de fusão**.
- O **"mapper único" EXISTE na norma**: `(global_user_id, tenant_id) → user_id` + writer único `actor-writer.service`. O que falta é **enforcement no runtime**, não o desenho.
- **Colapsar para um ID = regressão constitucional** (viola `03 §3/§4`, `02 §5/§10`, `CORE_IDENTITY_AND_ACTORS_CONTRACT §2`, Constituição Art. I, e a tese actor-first).
- O drift **real** é outro: (a) readers com lookup direto fora do resolver; (b) ~94 actors legados `global_user_id IS NULL`; (c) fragmentação de **`actor_type`** (`user`/`page` vs `person`/`company` vs `system`) — eixo diferente dos três IDs.

## As três camadas (modelo canônico)

| Camada | Tabela | Pergunta material | Papel | NUNCA |
|---|---|---|---|---|
| **`global_user_id`** | `identities` | "Quem a pessoa **É**" (CPF, ontológico, KYC/fiscal) | Âncora ontológica/jurídica; global, único, tenant-independente, permanente, indivisível, nunca descartado | nunca define poder / autoriza / decide permissão / decide perfil sozinho |
| **`user_id`** | `users` | "Qual a **conta técnica** dela neste tenant" + dono da wallet no contrato do Bank | Representação técnica e contextual (tenant-scoped); pode mudar/ser descartada | nunca é sinônimo de Actor; não cria autoridade |
| **`actor_id`** | `actors` | "Sob qual **papel ela AGE / paga / recebe** agora" | Unidade ontológica de ação; operacional; temporário por definição; carrega permissões, contas, agenda | nunca existe sem CPF âncora; nunca soberano; nunca herda autoridade; nunca anônimo |

## A cadeia de resolução documentada (o "mapper" que a executora diz faltar)
1. `(global_user_id, tenant_id) → user_id` — **`03_IDENTITY_CANONICA.md §8`** (resolução técnica canônica; "resolver pelo primeiro resultado" é PROIBIDO; inferir tenant é PROIBIDO).
2. `users → ensureUserActor(tenantId, userId) → actor_id` — **writer único** `actor-writer.service` (`LEI_COERENCIA §4.8.1`). `INSERT INTO actors` direto é proibido fora das exceções normadas (Gate 0 identity.service; actor.repository social; testes).
3. `actors.global_user_id → identities` — projeção operacional ancorada na verdade KYC (**`IDENTITY_SSOT_PRECEDENCE.md`**: `actors` é projeção; campos fiscais/KYC vivem em `identities`).
4. PJ: `company_users (can_manage_company, owner) → global_user_id → users → actor humano → responsible_actor_id do actor 'page'` (`§4.8.3`).
5. Bank: wallet `owner_id = users.user_id`; `bank_accounts.actor_id` resolvido **a partir** do actor `user` (`§4.8.1`). Saldos por Actor; **consolidação por CPF/CNPJ é read-only/compliance** (`CORE_IDENTITY_AND_ACTORS_CONTRACT §6`).
6. **`user_identity_links` está DESCONTINUADA** (`08 §10.2`): "não é fonte de autoridade, não participa de decisão, uso em produção = violação estrutural grave". → o mapper NÃO é uma link-table; é a cadeia acima + writer.

## O porquê (cruzamento normativo)
- **Separar QUEM-É de O-QUE-PODE** — `03 §1`: identidade "NUNCA define poder". `CORE_IDENTITY_AND_ACTORS_CONTRACT §2`: "Identidade identifica. Ator age." `08 §10.1`: os três IDs "apenas rastreiam atuação, NÃO criam autoridade". Autoridade resolve em Lei + delegação + `req.user` binding (DECISION-0113), nunca em ID solto.
- **Actor-first / capability-additive** — `CORE_IDENTITY_AND_ACTORS_CONTRACT §3`: "**uma pessoa (CPF) → múltiplos Atores (PF, PJ, loja, banda, equipe)**". Isto **exige** `actor_id ≠ user_id ≠ global_user_id`. Colapsar = voltar a "uma conta por papel" = o pântano super-app que a arquitetura recusa. Os três nomes **são** o mecanismo de acoplamento correto.
- **Âncora civil** — `02 §9` / `08 §3.1/§4`: todo Actor fecha responsabilidade num CPF; entidade não-humana (`page`) tem `responsible_actor_id` humano (`§4.8.2`). Essa cadeia só existe porque `actor_id` é camada própria; um `user_id` plano não a carregaria.
- **LGPD / soberania (Constituição Art. I, V, X)** — identidade civil não pode ser a chave operacional; opacidade pessoal e soberania do ator exigem a separação.

## Drift REAL (o que a executora corretamente fareja — mas é enforcement/dados, não ontologia)
1. **Readers com lookup direto** `user/global_user → actor` fora do resolver/writer → cluster DECISION-0113 (`DT-DIRECT-QUERY-ACTOR-READERS`, `DT-OPERATIONAL-READ-ACTORID-UNVALIDATED`). [verificação de runtime = IA-DT/IA-BANCO]
2. **~94 actors legados `global_user_id IS NULL`** — projeção quebrada (actor sem âncora); frente DECISION-0062, backfill pendente. Modelo certo, **dados** violam.
3. **`DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION`** — três **vocabulários de `actor_type`** (`user`/`page` preferido vs `person`/`company` legado genesis vs `system`), `§4.8.7`. **Este sim** converge para `user`/`page`. **NÃO confundir com os três IDs.**

## ⚠️ Risco de interpretação (sinalizar com força)
A frase "matar os 3 vocabulários de identidade" é **ambígua e perigosa**. São DOIS eixos diferentes:
- **3 camadas de identidade** (`global_user_id`/`user_id`/`actor_id`) → **NÃO matar.** Colapsar viola a Constituição + 4 docs soberanos + actor-first. Ação certa = **enforce do resolver + writer em todo reader** e **backfill de âncoras**.
- **3 vocabulários de `actor_type`** (`user`/`page` vs `person`/`company` vs `system`) → **converge** (DT própria).

Se essa distinção não for explicitada antes da próxima frente de identidade, há risco de alguém "simplificar" e derrubar a separação constitucional achando que limpa drift.

## Documentos lidos (esta pesquisa)
- `docs/01_normative/03_IDENTITY_CANONICA.md` (integral) — §1 (identidade não autoriza), §2 (global_user_id), §3 (≠Actor), §4 (≠Usuário≠Perfil), §8 (resolução `(global_user_id,tenant_id)→user_id`)
- `docs/01_normative/02_ACTORS_SSOT.md` (integral) — §2/§5 (Actor=ação, operacional, temporário), §9 (vínculo CPF obrigatório), §10 (proibições)
- `docs/01_normative/IDENTITY_SSOT_PRECEDENCE.md` (integral) — identities=KYC; actors=projeção; economic_identities=derivada; precedência PJ (DECISION-0084)
- `docs/01_normative/08_AUTORIDADE_CANONICA.md` (integral) — §3 (entidades), §10.1 (3 IDs rastreiam, não criam autoridade), §10.2 (user_identity_links morta), §11 (ActionContext/RBAC)
- `docs/01_normative/CORE_IDENTITY_AND_ACTORS_CONTRACT.md` (integral) — §2 (regra de ouro), §3 (1 pessoa→N atores), §6 (financeiro por actor), §10 (separação obrigatória)
- `docs/01_normative/LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` §4.8 (writer único, âncora civil, CNPJ, quarentena) + §4.9 (authority/delegação)

## Veredito documental
Os três nomes têm **motivo normatizado em ≥5 documentos soberanos**, reforçado pela Constituição e pela tese central. **Não são drift** — são camadas com papéis distintos (LGPD + soberania + actor-first). O mapper existe na norma; o gap é de runtime obedecendo a norma (campanha 0113). A correção certa é **enforce + backfill + convergência de `actor_type`** (3 frentes distintas), **nunca colapsar os IDs**.

## STOPs para a executora (eixo identidade)
- **NÃO** unificar/colapsar `global_user_id`/`user_id`/`actor_id` num só ID — regressão constitucional.
- **NÃO** ressuscitar `user_identity_links` como mapper (morto, `08 §10.2`).
- **NÃO** inferir actor de identidade, nem resolver "pelo primeiro resultado", nem inferir tenant (`03 §8`, `CORE_IDENTITY_AND_ACTORS_CONTRACT §4`).
- **NÃO** confundir convergência de `actor_type` (legítima) com "matar 3 IDs" (proibida).
- Decisão de *sequência* das 3 frentes (enforce/backfill/actor_type) e qualquer toque em schema/runtime = **IA-DT / IA-BANCO**, não IA-DOCUMENTOS.

---
---

# DOUTRINA DE MANUTENÇÃO — Como o sistema deve continuar se mantendo (2026-06-09)

> **Por que esta entrada existe:** Clayton pediu, após a pesquisa de identidade, um relatório de como o sistema deve continuar se mantendo. Consolido aqui a doutrina de manutenção **já normatizada** (não inventada) + o único ajuste estrutural recomendado (termômetro sweep:vertical) + a higiene documental da minha raia. READ-ONLY; síntese, não norma soberana — cartório vem depois.

## Premissa
O projeto **não precisa inventar** como se manter — precisa **não abandonar** o que já normatizou. A doutrina existe e é coerente. O risco não é falta de método; é o método ser largado sob pressão.

## Os 8 pilares da auto-manutenção (canônicos, com fonte)
1. **Congelado por padrão; muda só por Gate binário.** `06_GOVERNANCA §3/§6` — descongelamento explícito/temporário/documentado/reversível; "nada permanece aberto indefinidamente". → frente só abre com critério de fechamento declarado.
2. **Norma vence código — convergência, não greenfield.** `06 §10` + `AGENT_PROTOCOL §2.2.7`; "código nunca vence norma". Vestígio ≠ bug (5 hipóteses antes de amputar — `lei_historica_sistema`).
3. **CORE conecta, não duplica.** `CORE_IMUTAVEL` + DECISION-0021 — verdade é core quando divergência criaria realidade paralela; soberania = writer + enforcement + impossibilidade de contradição (não é pasta). Régua que matou `company_documents` e o leak do `unified-calendar`.
4. **Memória append-only + estado vivo separado.** `DECISIONS_LOG`/`DT_LOG` append-only (superação por nova entrada, nunca reescrita); `STATUS`/`opus` vivos; `DECISOES.md` índice. Aplicado certo no ADENDO 0113 e na retratação do fechamento 0113.
5. **Norma assintótica — exceção carrega prazo.** DT/ALLOWLIST preserva runtime durante convergência mas com critério de fechamento; conviver com violação ≠ ratificar drift; `GOVERNED/DECIDED ≠ CLOSED`. `PLAN`: DEBT→sprint dedicado, DEFERRED→issue+deadline.
6. **Diagnóstico nunca colapsa em execução.** `AGENT_PROTOCOL §4` GUARDIÃO vs EXECUTOR + prova de rastreabilidade + gate antes de alterar. A separação de instâncias (IA-DT mapeia / IA-BANCO executa money / IA-DOCUMENTOS audita coerência / Yala sela) é a aplicação viva — saudável, preservar.
7. **Fatia forward-only com prova e gates verdes.** `PLAN` — commit isolado, E2E fail-first, 4–5 gates simultâneos, sem regressão, snapshot antes/depois; piora não-justificada → parar. Padrão das fatias PJ (e2e N/N + 4 gates + arch critical_new=0 + dev migrations estável).
8. **Critério de conclusão explícito e binário.** `PLAN §15` — checklist booleano (0 BLOCKERs, 5 gates verdes, tsc 0, seed consistente, 30 achados resolvidos, snapshots sem piora); feature nova bloqueada até lá. Usar o mesmo rigor para fechar 0113 (denominador completo + sweep Yala) e cada raiz.

## O risco que a doutrina sozinha NÃO cobre (executora acertou)
A doutrina garante que **o que existe está certo**; não garante que **o suficiente vai existir**. Sinal material: `invoices`/`b2b_contracts`/`organization_units` com **rota viva mas tabela ausente** = mais desenhado que rodando. Risco = **andaime perfeitamente governado** (autoridade/Bank/DTs impecáveis, poucos fluxos humanos ponta-a-ponta). Não contradiz a norma — alinha com `sistema_operacional_vivo` (frente só se bloqueia runtime/coerência/causalidade financeira) e `actor_unidade_operacional_soberana` (capability-additive = licença para verticais incrementais, não desculpa para horizontais infinitas).

## Único ajuste estrutural recomendado
- **Termômetro sweep:vertical.** A cada N fatias de sweep horizontal (autoridade em todas as rotas, vocabulário, etc.), **uma vertical humana fechada** (um actor real, uma operação econômica início-ao-fim, com prova E2E de **fluxo humano**, não só de invariante).
- **Reconciliar rota-fantasma.** Rota viva sem tabela = ou aterra (migration + fluxo) ou tombstone honesto (501) — nunca ghost. `DT-MODULES-ASPIRATIONAL-VS-RUNTIME` é o gate, não a gaveta.

## Higiene documental (minha raia — goteiras que apodrecem a memória se não pingar a cada fatia)
1. **Decisão aterra em cartório, não morre no chat.** Flutuando hoje: nota da executora "ACTIVE=B ratificado, falta cartório". Regra (`DECISIONS_LOG` cabeçalho): decisão de Clayton → log no mesmo corte; senão "não foi decidido".
2. **Índice e metadado sincronizados ou marcados stale.** `DECISOES.md` para em 0111 (sem 0112/0113/0114); cabeçalho do `DECISIONS_LOG` ainda diz "última entrada 0057" (corpo vai a 0114). Índice/metadado ≠ soberania, mas viram armadilha de leitura — frente documental periódica.
3. **Cada exceção com deadline** (higiene = pilar 5): DT sem critério de fechamento vira paisagem.
4. **Distinguir eixos que parecem o mesmo.** Caso-mãe: 3 IDs (camadas constitucionais, NÃO colapsar) vs 3 `actor_type` (drift convergível) — a doc tem que impedir que "limpeza" vire regressão constitucional.

## Veredito de manutenção
- A **fundação se mantém sozinha se a disciplina não for abandonada** — está escrita e é rigorosa.
- A **única adição estrutural** é o **termômetro sweep:vertical** — para o andaime virar organismo; não é mudar o método, é redirecioná-lo periodicamente a fluxo humano completo.
- A **higiene documental** (cartório em dia, índice sincronizado, exceção com prazo, eixos não-embolados) é barata e impede a memória institucional de mentir conforme o sistema cresce.

## Fronteira de escopo
Decidir *quais* verticais priorizar, sequência de raízes, ou tocar runtime/schema = Clayton (produto) + IA-DT/IA-BANCO (execução). IA-DOCUMENTOS mapeia coerência e saúde documental; não executa.

## Documentos lidos (esta pesquisa de manutenção)
- `docs/01_normative/06_GOVERNANCA_CANONICA.md` (integral) — Gates, congelamento, blindagem, hierarquia
- `docs/01_normative/CORE_IMUTAVEL.md` (integral) — CORE = jurisdição não pasta (DECISION-0021); Agenda/Actors/Eventos/Identidade/Publicação/Auditoria/Observabilidade; conecta-não-duplica
- `SYSTEM_REMEDIATION_PLAN.md` §15 (critério de conclusão) + §5 (fases) + classificação DEBT/DEFERRED + anti-regressão
- (cruzado com memórias: `sistema_operacional_vivo`, `norma_assintotica`, `actor_unidade_operacional_soberana`, `lei_historica_sistema`)

---
---

# SELO DE REGISTRO — GO de Clayton 2026-06-09 (índice de orientação para futuras instâncias)

> **GO de Clayton (2026-06-09):** registrar como memória documental, para orientar futuras instâncias, o relatório consolidado de identidade + manutenção. **Sem editar norma / DECISION / código / execução** — apenas memória. Confirmado: os seis tópicos **já estão registrados** nesta memória (entradas append-only abaixo). Este selo é só o índice de navegação; não duplica conteúdo.

| # | Tópico do GO | Onde está registrado (nesta memória) |
|---|---|---|
| 1 | Distinção `global_user_id` / `user_id` / `actor_id` | § **REFERÊNCIA — Os 3 vocabulários de identidade** → tabela "As três camadas" + cadeia de resolução |
| 2 | Proibição de colapsar IDs | § REFERÊNCIA → "Risco de interpretação" + STOPs ("NÃO unificar/colapsar… regressão constitucional") |
| 3 | Camadas de identidade × drift de `actor_type` | § REFERÊNCIA → "Drift REAL" item 3 + "Risco de interpretação" (dois eixos) |
| 4 | Doutrina de manutenção | § **DOUTRINA DE MANUTENÇÃO** → "Os 8 pilares da auto-manutenção" |
| 5 | Termômetro sweep:vertical | § DOUTRINA → "Único ajuste estrutural recomendado" |
| 6 | Higiene documental: cartório / índice stale / DT com critério | § DOUTRINA → "Higiene documental" (1–4) |

**Base normativa cruzada (≥7 docs soberanos):** `03_IDENTITY_CANONICA`, `02_ACTORS_SSOT`, `IDENTITY_SSOT_PRECEDENCE`, `08_AUTORIDADE_CANONICA`, `CORE_IDENTITY_AND_ACTORS_CONTRACT`, `LEI_DE_COERENCIA_SISTEMICA §4.8/§4.9`, `06_GOVERNANCA_CANONICA`, `CORE_IMUTAVEL`, `SYSTEM_REMEDIATION_PLAN §15`.

**Natureza deste registro:** insumo operacional / mapa de orientação — **não** é norma soberana, **não** é cartório. Se algum destes pontos precisar virar regra vigente (ex.: institucionalizar o termômetro sweep:vertical, ou a sincronização periódica do índice), exige **frente documental própria** + promulgação de Clayton em `REMEDIATION_DECISIONS_LOG` / STATUS. Cartório vem depois.
