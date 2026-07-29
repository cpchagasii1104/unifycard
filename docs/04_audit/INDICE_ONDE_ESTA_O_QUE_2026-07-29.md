# ÍNDICE — ONDE ESTÁ O QUÊ · assunto → documento que governa

**Produzido:** 2026-07-29 · **Método:** varredura read-only da instância especialista DOCUMENTOS (`00_INDEX.md` 120 arquivos + `00_SUMARIO.md` + amostragem de headers reais + topo do cartório), com as contradições **resolvidas de 1ª mão pela direção**.

> ### 🔴 POR QUE ESTE ARQUIVO EXISTE
> A ausência dele custou uma noite inteira em 2026-07-28/29. Num único dia a direção: quase recomendou **apagar um módulo** que tinha documento de encerramento **vinculante nível 3**; propôs como "passo mecânico" uma dívida **já classificada com veredito C** 11 dias antes; disse *"precisa de SQL nova"* depois de checar **uma camada** quando a de baixo já tinha a função pronta.
> **"Não existe" dito sem procurar é o erro mais caro deste repositório** — cria uma segunda verdade, e duas verdades sobre *"para quem vai o dinheiro"* divergem em silêncio até ninguém saber qual manda.
>
> **⚠️ ESTE ÍNDICE NÃO É FONTE DE VERDADE.** É ponteiro. Contradisse a norma? **A norma vence e o índice é bug.** Lê-lo NÃO dispensa `00_AGENT_PROTOCOL §2.2`.

## Hierarquia (respeite ao resolver conflito)
`CONSTITUICAO` > `LEIS_OPERACIONAIS` > `SSOT_REGISTRY` > `18_DOMAIN_ONTOLOGY` > demais de `01_normative/` > `02_decisions/` **SELADAS** > cartório (estado, não norma) > planos e pacotes da raiz.
**Decisão NÃO-SELADA não é autoridade.** Sempre cite o status junto do conteúdo.

---

## 1 · DINHEIRO / SPLIT
`01_normative/SSOT_EXCLUSIVE_BANK_RULE.md` · `SSOT_CONTRACT.md` · `SSOT_REGISTRY_UNIFICARD.md` · `PROHIBITED_STRUCTURES.md` — **pacote obrigatório do `§8` do protocolo antes de qualquer código financeiro.**
`01_normative/CORE_SPLIT_PAGAMENTO_CANONICO.md` — promulga *"drift para `revenue_share[0]`"* (`:94`).
Percentuais/base: `DECISION-0166` (D1 base · D6 · D7 · D8) · ✅ **`DECISION-0194` SELADA 2026-07-28** (D2 base única · D3 duas etapas · D3.1-BIS sobra do centavo · D4 base derivada).
🔴 **DOUTRINA SELADA ≠ CÓDIGO CONFORME.** O motor **ignora `applies_to`**; a validação **não tem trava de base única**; allowlist do Bank **vazia**; agrupador multi-base **vivo**. Ver tabela no selo (cartório).
⛔ `bank-split-engine.service.ts` é **LEGADO CERCADO**, não canônico. Os 70/3/10/17 são defaults de dev **nunca ratificados**.

## 2 · IDENTIDADE E ACTOR
`01_normative/CORE_IDENTITY_AND_ACTORS_CONTRACT.md` · `02_ACTORS_SSOT.md` · `03_IDENTITY_CANONICA.md` · `IDENTITY_SSOT_PRECEDENCE.md` · `ACTOR_TRACEABILITY_CONTRACT.md` · `CAPACIDADES_ACTOR_CONTRATO.md` — todos CANÔNICO·VIGENTE.
**Regra que decide deleção:** Actor é *"temporário por definição"*; Identidade é persistente. *"A autoridade é revogável; **a responsabilidade nunca é apagável**"* (`02_ACTORS_SSOT §9`). Por isso o banco **recusa** apagar o autor dos 75 bairros — é norma materializada em `RESTRICT`, não obstáculo técnico.

## 3 · TENANCY E CROSS-TENANT
`DECISION-0149` — **PROMULGADA** (2026-06-23): modelo canônico de tenant-loop cross-tenant.
`DECISION-0191` — ✅ **SELADA · VEREDITO A** (cartório `:21490`, commit `4223d3651`).
> **⚠️ ARMADILHA CONFIRMADA:** o **cabeçalho do arquivo 0191 ainda diz "NÃO-SELADA"**. Não é erro — o selo foi **cartorial**, num commit separado, e *"o corpo D0-D15 não foi reeditado neste ato"* (cartório `:21493`). **O arquivo mente sobre o próprio status para quem o abre direto.** Confirme selo no cartório, nunca no header.
**Descoberta cross-tenant JÁ RESOLVIDA** — e **não** por fusão de tenants, mas pela **vitrine** (`public_profiles`, read-model global anti-PII). `LOTE_L6_IDENTIDADE_TENANCY.md` (raiz): *"o argumento 'destrava a descoberta' deste D1 CADUCOU"*. Resíduo aberto: `0115 D1` — o novo PF ainda *"nasce numa ilha vazia"*.

## 4 · TERRITÓRIO E LOCALIZAÇÃO
Núcleo Location Core: `DECISION-0074/0076/0077/0078/0079`.
Bairro→nacional: `0171` → `0172` → `0173` → `0174` → `0175` → `0176/0177`.
Fundo regional: `DECISION-0114` · `DECISION-0165`.
🔴 `DECISION-0192` — **NÃO-SELADA · REPROVADA (veredito C)**. Não é autoridade de roteamento. Vale `0166`/`0177`.
> **⚠️ SINAPSE ROMPIDA:** `CORE_SPLIT_PAGAMENTO_CANONICO.md` cita **`DECISION-0020`**, que **não existe como arquivo** (numeração real do cluster começa em `0074`). Verificado 2026-07-29. Mesma classe do `§2.5` do protocolo, que exige 4 leituras e **3 não existem**.

## 5 · AUTORIDADE E PERMISSÕES
`01_normative/AUTHORITY_LAW.md` (lei suprema) · `08_AUTORIDADE_CANONICA.md` (criação/delegação/revogação/**encerramento**/responsabilização) · `AUTHORITY_ENFORCEMENT_MODEL.md` · 3 anexos `AUTHORITY_ANNEX_*`.
⚠️ `MAPA_CANONICO_PERMISSIONS_v1.md` — **CONGELADO**.
**PORTA_HOLD** (7 chaves de dinheiro em deny estrutural): `backend/src/core/authorization/company-policy-registry.ts:230-243`.

## 6 · MIGRATIONS E SCHEMA
**Lei 2 — forward-only, NUNCA editar migration existente.** Tag `GENESIS_CONSTITUCIONAL_v1` (`LEIS_OPERACIONAIS:19`). Baseline quando registro e banco divergem: **`00_AGENT_PROTOCOL §17`** — *"não recuperar o passado, consolidar o presente"*.
Nomenclatura: `07_NOMENCLATURA_CANONICA.md` (BLINDADO).
Skip governado: `IGNORED_MIGRATIONS` em `backend/src/core/db/migration-runner-core.ts:60`.
**Estado dos dois bancos** (`dev` × `local`): cartório, entrada *"POR QUE EXISTEM DOIS BANCOS"* (2026-07-29). **Toda prova declara contra qual banco rodou.**

## 7 · EVENTOS-PRODUTO (shows, ingressos, vaquinha)
`DECISION-0161` — ✅ **RATIFICADA** (2026-07-06). `DECISION-0190` — SELADA (contenção honesta 501 em `economic/v2`).
`RFC_EVENT_ORCHESTRATION_PHASE_B_MODEL.md` — **PROPOSTA, aguarda ratificação**.
`EVENT_ENGINE_COMPLETION_PLAN.md` (raiz) — plano de execução vivo, **não é norma**.
🔴 Antes de tocar o fluxo de criação: cartório, `F-EVENT-CREATION-CONTRACT-SWEEP` — rota `/events/:id/economic` **não existe**, `event_type` é **órfão de escrita**, `event_custody` **sem tabela**.

## 8 · EVENTOS DE DOMÍNIO (event-sourcing / outbox)
> **🔴 ARMADILHA DE NOME — a mais cara do repositório.** `01_normative/10_EVENTS_CANONICA.md` **NÃO** é sobre eventos-produto. É sobre **evento como fato histórico**. E está marcado **PROPOSTO · NÃO VIGENTE** no `00_INDEX`. Quem procura a norma de "eventos" cai aqui e ou se perde, ou aplica regra de event-sourcing a shows e ingressos.
Vigentes: `EVENT_OUTBOX_E_ENTREGA_CANONICO.md` · `HANDLER_EXECUTION_AND_RELIABILITY.md` · `EFFECTS_ACTOR_CONTRATO.md`.

## 9 · GRUPOS
🔴 `01_normative/CONTRATO_GRUPOS_V2.md` — **é LEI**, com cláusula *"implementação que contradiga é BUG por definição"*.
`CONTRATO_GRUPOS_V1.md` — **PARCIALMENTE REVOGADO PELO V2**.
Cap de participação = **3** (`DECISION-0188`), com trigger/lock — não é configuração.
⛔ `user_group_allocation` = **REVOGADO POR LEI**. Modelo correto é **PULL por membership**. Não ressuscite.

## 10 · CATÁLOGO E ONTOLOGIA
`18_DOMAIN_ONTOLOGY_UNIFICARD.md` · `04_CATEGORIES_SSOT.md` · `CATEGORY_SCOPES_SEMANTICS.md` · `CATEGORY_TREE_CANONICAL_DECISION.md`.
⚠️ `CATEGORY_TREE_SCHEMA.md` é **LEGADO** — substituído por `CATEGORY_TREE_ARCHITECTURAL_CLOSURE.md`. **Não use o primeiro.**
**Lei 7:** CONCEPT é o SSOT semântico; `categories` é árvore de navegação; `slug`/`metadata` **nunca** são identidade. N0/N1/N2 são navegação e **NUNCA** participam de roteamento financeiro.

## 11 · PORTA-01
**NÃO existe norma dedicada em `01_normative/`** — verificado por nome de arquivo e grep em todo o repo. É **marco operacional do cartório**, não entidade normativa.
Documento operante: `READINESS_PORTA1.md` (raiz, 2026-07-04) — *"fechar as facas antes de cortar a corda"*. ⚠️ **Tem 3+ semanas: reverifique item por item.** Já se provou parcialmente desatualizado (a "faca principal" `p2p-transfer` foi **excisada**, devolve 501).
Definição estrutural real: `PORTA_HOLD_KEYS` (ver §5).

## 12 · FISCAL
`DECISION-0167` (motor de provisão) → `0170` (checklist/API) → `0178` (`applies_to` + composição) → `0179` (`tax_reserve` no Bank) → `0183`.
⚠️ Status de 0178/0179 vem da memória do projeto (**MATERIAL SELADO · VEREDITO A**), **não reverificado de 1ª mão** nesta varredura. **4e está DORMENTE** (firewall OFF, caller 0).

---

## ⚠️ O QUE ESTE ÍNDICE **NÃO** COBRE (declarado)
`docs/03_execution_log/` · `docs/04_audit/` (exceto 1 hit) · `docs/99_archive/` · `docs/_arquivo/` · o **corpo** das ~194 DECISIONs (só as citadas foram abertas e confirmadas por header).

## 🔧 MANUTENÇÃO
Mantido pela instância especialista **DOCUMENTOS**. Entrada nova exige: caminho real · status (selada/não-selada/dormente/revogada/legado) · data. **Anote só o que verificou** — índice falso é pior que ausente, porque a próxima instância confia.
