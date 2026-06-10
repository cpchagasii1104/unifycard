# Execution Log — DECISION-0115 (decisões-raiz do nascimento humano vertical G10)

- **Data:** 2026-06-10
- **Modo:** EXECUTOR — DOCS-ONLY
- **Frente:** `F-G10-NASCIMENTO-HUMANO-VERTICAL` (FASE A — decisão de produto; FASE B = auditoria READ-ONLY concluída/PASS IA Diretora)
- **HEAD origem:** `92eb49b4` · **branch:** `rescue-structural` · **dev:** 365
- **Status:** SUCESSO (docs-only; zero código/migration/banco/frontend)

## Objetivo executado

Promulgar, em documentação institucional, as decisões-raiz (D1–D5) necessárias para destravar a próxima fase do nascimento humano vertical, conforme go de Clayton e PASS da IA Diretora na auditoria FASE B. Sem implementação.

## Prova de rastreabilidade normativa (00_AGENT_PROTOCOL §2.2.2)

- **Documentos lidos:** `00_AGENT_PROTOCOL.md`, `CONSTITUICAO_UNIFICARD.md` (Art. I/V/IX), `LEIS_OPERACIONAIS_UNIFICARD.md` (Lei 5), e — via auditoria FASE B — `03_IDENTITY_CANONICA`, `02_ACTORS_SSOT`, `CORE_IDENTITY_AND_ACTORS_CONTRACT`, `USER_PROFILE_CONTRACT`, `AGENDA_UNIVERSAL_CONTRACT`/`CORE_TEMPORAL_CONTRACT`, `EMPRESA_NASCIMENTO_CANONICO`, `LEI_DE_COERENCIA §4.8`; logs `REMEDIATION_DECISIONS_LOG`/`REMEDIATION_DT_LOG`/`STATUS`/`opus`; memórias `MINHA_MEMORIA_DT`/`MINHA_MEMORIA_EXECUTORA`.
- **Suficiência:** o domínio é identidade/actor/perfil/onboarding (nascimento humano); o conjunto cobre os SSOTs por pilar e a precedência normativa. DECISIONs consultadas antes de classificar (0075/0080/0113/0062/0072).
- **SSOT por pilar:** identidade/actor = `global_users`/`identities`/`actors` (CONCEPT não aplicável ao nascimento civil); financeiro = `bank_ledger`/UnifyBank (Lei 5 — **não tocado**, D5); temporal = Unified Availability (writer canônico já vivo).
- **Precedência aplicada:** Constituição (Art. I soberania do ator; Art. V economia consentida; Art. IX fricção deliberada) > Leis (Lei 5) > SSOT Registry > demais. D3 **emenda** o enum da `DECISION-0080` (decisão soberana de Clayton, ponto específico).

## P1 — sintoma ou causa raiz?

Docs-only não altera runtime; corrige **causa-raiz cartorial/produto**. Promulga as decisões sem as quais qualquer patch de nascimento humano seria folha solta pendurada em raiz não-decidida: mundo inicial (D1), atomicidade mínima (D2), vocabulário civil (D3), escopo self-owned (D4), exclusão de evento econômico real (D5).

## Ações realizadas

1. Reancoragem (status/branch/HEAD `92eb49b4`) + READ-FIRST do protocolo e logs.
2. Confirmado próximo número livre de DECISION = **0115** (0114 é o último vivo, em arquivo e log).
3. Criado `docs/02_decisions/DECISION_0115_HUMAN_BIRTH_VERTICAL_ROOT_DECISIONS.md` (padrão DECISION-0114).
4. Entrada `### DECISION-0115` em `REMEDIATION_DECISIONS_LOG.md` (append ao fim).
5. 6 DTs OPEN em `REMEDIATION_DT_LOG.md` + nota de atualização em `DT-CORE-PROFILE-GET-CREATES-ACTOR`.
6. Entrada no topo de `STATUS_EXECUCAO_GLOBAL.md` e `opus.md`.
7. Nota append-only em `docs/memorias/MINHA_MEMORIA_EXECUTORA_UNIFICARD.md`.

## Arquivos afetados (todos markdown)

- `docs/02_decisions/DECISION_0115_HUMAN_BIRTH_VERTICAL_ROOT_DECISIONS.md` (novo)
- `REMEDIATION_DECISIONS_LOG.md`
- `REMEDIATION_DT_LOG.md`
- `STATUS_EXECUCAO_GLOBAL.md`
- `opus.md`
- `docs/03_execution_log/20260610_DECISION_0115_HUMAN_BIRTH_VERTICAL_ROOT_DECISIONS.md` (este)
- `docs/memorias/MINHA_MEMORIA_EXECUTORA_UNIFICARD.md`

## DTs registradas/atualizadas (todas OPEN)

`DT-HUMAN-BIRTH-TENANT-PER-SIGNUP-DEAD-WORLD` · `DT-HUMAN-BIRTH-IDENTITY-ACTOR-BEST-EFFORT-SILENT` · `DT-GENDER-INPUT-PERSISTENCE-VOCABULARY-DIVERGENCE` (emenda enum 0080) · `DT-IDENTITY-STATUS-COMPUTED-IN-MEMORY-ONBOARDING-GATE` · `DT-READ-PATH-ENSUREUSERACTOR-DIFFUSE-CURE` (amplia `DT-CORE-PROFILE-GET-CREATES-ACTOR`) · `DT-ONBOARDING-LOCK-FLAGS-METADATA-NO-EVENT`. Nenhuma DT de runtime fechada.

## Escopo intocado (STOPs honrados)

Zero código/migration/banco/frontend; `auth/register`, `profile`, actor-writer, company/PJ, Bank/ledger intocados; R2 não liberado; FASE 6 não liberada; `DECISION-0113` não declarada fechada; sem implementação automática.

## Próximo passo recomendado

Fatia de código `C1 — costurar register ao mundo inicial vivo + garantir identity/actor mínimo` (sem dinheiro), com GO próprio.
