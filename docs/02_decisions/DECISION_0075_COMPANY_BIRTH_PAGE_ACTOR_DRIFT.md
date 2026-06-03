# DECISION-0075 — Diagnóstico de drift no nascimento PJ: page-actor vivo no Momento 1

**Status:** DECISÃO DE DIAGNÓSTICO / FREEZE (2026-06-02) → **RECONCILIADA 2026-06-03: Opção B promulgada por Clayton — ver §9.** A escolha A/B **deixa de estar pendente**; a **implementação continua pendente** (atomicidade do nascimento é pré-requisito ATIVO — §9.2). **DOCS-ONLY**; implementação **NÃO** autorizada aqui.
**Sessão:** 2026-06-02 — frente `F-PJ-BIRTH-AND-COMMERCIAL-SSOT-READONLY` (paralelas A/B/C + checagem cirúrgica de divergências).
**Natureza:** congelamento e registro de drift + abertura de decisão pendente. **NÃO escolhe** entre as filosofias de nascimento de PJ.
**Ratificação do registro:** diagnóstico read-only (Claude Code / Opus) + consolidação (ChatGPT) + autorização docs-only (Clayton). **A escolha A/B foi RECONCILIADA em §9 — Opção B promulgada por Clayton (2026-06-03); a implementação permanece pendente.**
**Commit âncora (origem do diagnóstico):** HEAD `335a5eaf`.
**Documento canônico:** este arquivo.
**Subordinada a:** Constituição / LEIS, `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md`, `CORE_IMUTAVEL.md`, `EMPRESA_NASCIMENTO_CANONICO.md`, `SSOT_REGISTRY_UNIFICARD.md`, `07_NOMENCLATURA_CANONICA.md`.
**Vinculada a:** `DT-COMPANY-BIRTH-PAGE-ACTOR-DRIFT`, `DT-COMPANY-BIRTH-NON-TRANSACTIONAL-CLEANUP`, `DT-COMMERCIAL-PRICE-FEDERATED-SSOT` (todas OPEN, registradas em `REMEDIATION_DT_LOG.md`), `DESENHO_FASE_3B_EMPRESA_DOIS_MOMENTOS.md`, `EMPRESA_NASCIMENTO_CANONICO.md`. Pendência já sinalizada em `REMEDIATION_DT_LOG.md` (linha ~1310: "DECISION arquitetural formal sobre qual filosofia é soberana").

---

## 1. Contexto

A frente `F-PJ-BIRTH-AND-COMMERCIAL-SSOT-READONLY` (read-only) descobriu que o **fluxo vivo** de criação de empresa cria um **page-actor no nascimento da empresa**, enquanto o **desenho ratificado de dois momentos** (`DESENHO_FASE_3B`) previa empresa **inerte no Momento 1, sem page-actor operacional**, com o page-actor nascendo apenas no Momento 2 (ativação operacional transacional).

Esta DECISION **não** afirma que PJ nasce corretamente, **nem** afirma que PJ não deve ter actor. Ela **classifica o estado atual como drift material entre documento ratificado e runtime** e **congela** qualquer avanço de implementação de PJ até Clayton decidir qual filosofia é soberana.

## 2. Evidência (caminho + linha reais, HEAD `335a5eaf`)

**Runtime — nascimento cria page-actor no Momento 1:**
- `backend/src/core/companies/companies.service.ts:254-731` (`createCompany`): cria `companies` (`INSERT` em `:441-467`), `company_users` (`INSERT` em `:591-621`), chama `ensureUserActor` + **`ensurePageActor` em `:654-655`** — page-actor (`actor_type='page'`) criado no **Momento 1**, incondicionalmente. Não é seed/backfill.
- Writer do page-actor: `backend/src/modules/social/actor.repository.ts:243-323` (`findOrCreatePageActor`) — `actor_type='page'`, `company_id`, `responsible_actor_id` (âncora humana).

**Runtime — nascimento NÃO é transação DB única:**
- `createCompany` usa `pool.query(...)` **statement a statement**, sem `BEGIN`/`COMMIT`/client dedicado.
- O "rollback" é **compensação manual por `DELETE`s** num `catch` (`:676-697`). O **registro de endereço (Location Core / endereçamento básico)** criado em `:499-518` **não** é desfeito nessa compensação; `company_opportunity_preferences` (`:707`) fica fora do `try`. *(Sobre a natureza desse endereço, ver §7 — não é localização enriquecida.)*

**Documento ratificado — previa o oposto:**
- `DESENHO_FASE_3B_EMPRESA_DOIS_MOMENTOS.md §2`: Momento 1 cria linha em `companies` **"sem page-actor operacional"**; `primary_*` = NULL; empresa invisível ao resolver.
- `DESENHO_FASE_3B §3`: page-actor (`actor_type='page'`) + `responsible_actor_id` no **Momento 2**, via writer único **transacional** (`activateCompanyOperationally`, rollback total em qualquer falha).
- `DESENHO_FASE_3B §7`: admite que `companies.service` **já ancora** essa cadeia hoje (`ensureUserActor`/`ensurePageActor` em `:653-654`) — i.e., o desenho documentou o drift.
- `EMPRESA_NASCIMENTO_CANONICO §4`: reforça que **criar empresa NÃO implica criar Actor** (nem Page, nem Service, nem Availability).

**Numeração:** `DECISION-0074` está OCUPADA (`docs/02_decisions/DECISION_0074_PROFILE_RESIDENCE_ADDRESS_LOCATION_CORE.md`). Esta decisão usa **0075** (próximo livre na série `docs/02_decisions/`; sem colisão com a série paralela `REMEDIATION_DECISIONS_LOG.md`, que vai até ~0059).

## 3. Decisão registrada (freeze)

1. O estado atual é classificado como **drift material** entre documento ratificado (`DESENHO_FASE_3B §2`) e runtime (`createCompany` cria page-actor no Momento 1, sem transação DB real).
2. **Nenhuma implementação de PJ deve avançar** antes de Clayton decidir qual filosofia é soberana.
3. Este diagnóstico **não escolhe** entre as filosofias.

## 4. Opções pendentes (decisão de Clayton, futura)

- **Opção A — nascimento canônico inerte:** `companies` + responsável humano (`company_users` / `companies.global_user_id`), **sem page-actor no Momento 1**; page-actor só no Momento 2 (ativação operacional). Restaura `DESENHO_FASE_3B`/`EMPRESA_NASCIMENTO §4`. Consequência: remover/adiar `ensurePageActor` do nascimento vira frente futura.
- **Opção B — nascimento full operacional:** empresa nasce com `company` + `company_user` + page-actor, **mas** o fluxo deve ser **transacional, causalmente fechado e sem cleanup compensatório** (transação DB única / client compartilhado). Consequência: a atomicidade de `createCompany` vira **pré-requisito** de ratificação.

A decisão final entre A e B foi **promulgada em §9 — Opção B (Clayton, 2026-06-03); a implementação permanece pendente** (atomicidade do nascimento é pré-requisito ativo — §9.2).

## 5. Consequência

- **PJ comercial permanece BLOQUEADA para implementação.**
- Antes de qualquer execução futura: desenho próprio + decisão de Clayton.
- Se **B** vencer → atomicidade de `createCompany` (transação DB única) é pré-requisito.
- Se **A** vencer → remoção/adiamento do `ensurePageActor` no nascimento vira frente futura.
- Em paralelo, o pilar de preço comercial fica bloqueado por federação de `price_cents` (ver `DT-COMMERCIAL-PRICE-FEDERATED-SSOT`): frente read-only própria de precedência antes de acoplar PJ comercial.

## 6. Fora de escopo (vinculante)

```text
NÃO altera código (backend/src, frontend/src).
NÃO altera schema / migrations / banco.
NÃO mexe em actor_type.
NÃO decide actor_organizational.
NÃO decide preço (precedência de price_cents).
NÃO implementa PJ.
NÃO afirma que PJ nasce corretamente.
NÃO afirma que PJ não deve ter actor.
NÃO redefine Location Core nem cria modelo fiscal/geográfico para PJ (ver §7).
```

## 7. Fronteira Location Core / endereço PJ (adendo da mesma sessão, 2026-06-02)

Correção de premissa para evitar leitura falsa do diagnóstico de nascimento:

- Esta decisão **não redefine Location Core**.
- Esta decisão **não cria modelo fiscal/geográfico** para PJ.
- O diagnóstico de nascimento PJ **não assume `city`/`state`/`neighborhood` textual canônico**. No fluxo vivo, `createCompany` passa `stateId`/`cityId`/`neighborhoodId` = **NULL** a `locationRepository.createAddress` (`backend/src/core/companies/companies.service.ts:484-497`); endereço PJ hoje = `postalCode`/`street`/`number`/`complement` + FK de localização nullable. É **uso de Location Core / endereçamento básico, não localização enriquecida**.
- O risco de órfão descrito em §2 e em `DT-COMPANY-BIRTH-NON-TRANSACTIONAL-CLEANUP` é de **`address`/`address_assignment` (registro de Location Core / endereço básico)** — **não** de "cidade/estado/bairro canônico".
- **Endereço PJ enriquecido** — `city`/`state`/`neighborhood` para fiscalidade, geografia, marketplace, display regional, filtro por localidade ou onboarding empresarial — é **frente/decisão futura própria**, via CEP / catálogo administrativo / geocoding / ligação canônica com Location Core. Não é resolvido por esta decisão nem pelo nascimento PJ atual.
- `DECISION-0074` trata **residência PF → Location Core**; **não** resolve automaticamente endereço **PJ/company/HQ/operacional**.

## 8. Superada por

(em aberto — decisão vigente; NÃO superada — reconciliada in-place em §9)

## 9. Reconciliação — Opção B promulgada por Clayton (2026-06-03)

**Status desta seção:** PROMULGADA POR CLAYTON. Resolve o FREEZE A/B de §3/§4. **DOCS-ONLY** — implementação **NÃO** autorizada aqui. **Ratificação:** rascunho-insumo (Opus) + consolidação (ChatGPT — caminho 1) + ratificação com ajustes e promulgação (Clayton). **Commit âncora:** HEAD origem `ba41cc29`.

A escolha **A/B deixa de estar pendente**: vence a **Opção B**. A **implementação continua pendente** (ver §9.2 e §9.4).

### 9.1 Decisão de nascimento PJ (B)

- **Opção B promulgada como decisão de nascimento PJ.** A empresa/PJ nasce no início já com **page-actor** e **identidade fiscal PJ**, porém em estado **pendente / bloqueado / NÃO-operacional**. A existência institucional nasce; a capacidade de operar, não.
- **Validação/KYB libera, não cria.** A validação manual/KYB **não cria** a existência da empresa — **libera a operação** de uma empresa que já existe pendente. (3 camadas, espelho `identity-validation`: cadastro CRIA EXISTÊNCIA → KYB APROVA CAPACIDADE → authority LIBERA EXECUÇÃO.)
- **CNPJ reservado desde o pendente.** O CNPJ pode ser **reservado/ancorado** na casa fiscal PJ já no nascimento pendente (unicidade global + âncora de histórico), **sem** habilitar nenhuma operação **pública/financeira** até a aprovação.
- **Não soberania mantida (M0/D2.8).** A identidade fiscal própria não torna a empresa autoridade soberana: toda autoridade/operação fecha em **CPF/actor humano responsável** (page-actor exige `responsible_actor_id` humano — §4.8.2 `LEI_COERENCIA_SISTEMICA`, já vivo).

### 9.2 Custo técnico obrigatório — atomicidade vira pré-requisito ATIVO

- A escolha B **torna a atomicidade do nascimento um pré-requisito ATIVO** (não mais condicional). Cf. §5: "Se **B** vencer → atomicidade de `createCompany` (transação DB única) é pré-requisito".
- Estado vivo a corrigir antes da implementação (§2, reconfirmado HEAD `ba41cc29`): `createCompany` (`backend/src/core/companies/companies.service.ts:254-731`) grava **statement a statement com `pool.query`, sem `BEGIN`/`COMMIT`**; o "rollback" é **compensação manual por `DELETE`s** (`:676-697`) que **não** desfaz o endereço (`:499-518`).
- Sob B isso fica perigoso: identidade fiscal PJ + **CNPJ global já reservado** nascendo junto num fluxo não-atômico pode deixar **identidade fiscal órfã com CNPJ global consumido**, page-actor órfão ou company órfã — meio-caminho irreconciliável com unicidade global.
- **Exigência promulgada por B:** o nascimento (`createCompany`/full-birth) **deve ser transacional e causalmente fechado** (transação DB única / client compartilhado), **sem cleanup compensatório frágil**, **sem** órfãos de `company` / `company_user` / page-actor / identidade fiscal PJ / endereço.
- 🔴 **TRAVA (frase vinculante):** **A escolha B NÃO autoriza implementação imediata da casa fiscal PJ no Momento 1 enquanto `createCompany`/full-birth não for transacional.** Sem transação única, não se implementa CNPJ global no nascimento.

### 9.3 DTs impactadas

- `DT-COMPANY-BIRTH-PAGE-ACTOR-DRIFT`: **direção A/B resolvida (B)**, execução pendente → atualizada para **PARTIALLY MITIGATED** com nota D0075-B (page-actor no Momento 1 é permitido como **pendente/não-operacional**, **desde que** o nascimento seja transacional).
- `DT-COMPANY-BIRTH-NON-TRANSACTIONAL-CLEANUP`: **promovida de adjacente a pré-requisito ATIVO da D2 técnica** (B venceu → atomicidade deixa de ser condicional). Permanece **OPEN**; é o gate técnico que destrava o momento de criação da casa fiscal PJ.
- `DT-PJ-CNPJ-CANONICAL-HOME-MISSING` / `DT-PJ-CNPJ-UNIQUE-CHECK-MISSING`: ganham o **momento** (nascimento pendente) — destrava parte da D2 técnica.
- `DT-PJ-KYC-DOCUMENTS-SUBSTRATE-MISSING`, `DT-PJ-IDENTITY-PRECEDENCE-NORM-GAP`: inalteradas.
- `DT-COMMERCIAL-PRICE-FEDERATED-SSOT`: inalterada; PJ **comercial** segue bloqueada por federação de `price_cents` (independe desta reconciliação).

### 9.4 O que continua pendente para o desenho técnico (D2 técnica)

- Depende desta reconciliação **+** da atomicidade (§9.2): nome canônico da tabela; CNPJ `VARCHAR(14)` vs `text` (drift); razão social fonte vs projeção (`companies.company_name`); escopo só-PJ vs fiscal genérico; DV de CNPJ borda vs banco; writer auditado (espelho `identity-validation`); histórico/continuidade; imutabilidade pós-aprovação; sincronização unidirecional `companies.cnpj`.
- **Sequência:** atomicidade do nascimento (`DT-COMPANY-BIRTH-NON-TRANSACTIONAL-CLEANUP`) → D2 técnica (momento = nascimento pendente) → D3-técnica → D5/D4/D6/D7 → validação forte LGPD-first → migration/código/gates.
- **NADA de migration/código/schema/banco** nesta reconciliação — só documento. PJ comercial segue bloqueada.

### 9.5 Invariante de ordem (reafirmado)

Identidade antes de autoridade. **Nascimento antes de tabela. Atomicidade antes de casa fiscal.**
