# DECISION-0160 — Governança do vocabulário `relationship_type` (delegação / vínculo jurídico PJ)

**Status:** 🟡 PROPOSTA (aguarda ratificação de Clayton + inserção no cânone `docs/01_normative/`)
**Data:** 2026-07-06 · **Origem:** ressalvas RN1 + RN2 da auditoria normativa Yala sobre R2 (delegação)
**Pilar:** AUTORIDADE (§5.16) · **Não toca:** dinheiro, CONCEPT, navegação N0/N1/N2

> **Por que esta DECISION existe:** a executora (IA) **não pode escrever em `docs/01_normative/`** (read-only,
> `00_AGENT_PROTOCOL §6.1`). Este documento é o DRAFT do que precisa ser registrado no cânone; Clayton
> ratifica e faz a inserção (glossário do `07_NOMENCLATURA` + referência no `SSOT_REGISTRY §5.16`).

---

## 1. Contexto

A frente R2 (Lote L2, DECISION D1-D5 de Clayton) materializou `actor_delegations.relationship_type` —
o **vínculo jurídico-institucional** entre uma pessoa e uma empresa, governado por CHECK. A auditoria
normativa da Yala (2026-07-06) confirmou que R2 **não cria segunda SSOT de delegação** (§5.16 OK) e que
`relationship_type` como CHECK é a nomenclatura correta (tipo social = CHECK, não CONCEPT). Mas apontou
**duas dívidas de governança de vocabulário** que esta DECISION resolve:

- **RN1 — vocabulário não registrado no cânone:** o CHECK enforça o vocabulário, mas ele só vive na
  migration + `LOTE_L2_DELEGACAO_R2.md` (doc de decisão, fora de `docs/01_normative/`). A `LEI §4.9` exige
  que nova vocabulária de delegação/papel seja proposta em RFC referenciada na lei. Sem registro no cânone,
  a vocab não é descobrível como canônica → código futuro poderia inventar um enum concorrente.
- **RN2 — sobreposição de tokens com `company_users.role`:** `administrator`/`employee` colidem
  semanticamente com `admin`/`staff` de `company_users.role`; `contractor` é idêntico. O `07 §3.2`
  ("Proteção Contra Enum Paralelo") desencoraja nomes distintos para o mesmo conceito.

---

## 2. Decisão

### 2.1 Registrar o vocabulário governado no cânone (resolve RN1)

O vocabulário canônico de `actor_delegations.relationship_type` é (CHECK `chk_actor_delegations_relationship_type`):

| Token | Vínculo jurídico | Nota |
|---|---|---|
| `partner` | Sócio | Participação societária |
| `director` | Diretor | Cargo estatutário |
| `administrator` | Administrador | Administrador nomeado (contrato social) |
| `attorney` | Procurador | Poderes por procuração |
| `legal_representative` | Representante legal | Responde civilmente pela PJ |
| `employee` | Funcionário | Vínculo empregatício (CLT/estatutário) |
| `contractor` | Prestador/terceiro | Sem vínculo empregatício |
| `NULL` | Não classificado | Delegação legada ou vínculo não declarado |

**Ação de Clayton:** inserir esta tabela no glossário do `07_NOMENCLATURA_CANONICA.md` + referência no
`SSOT_REGISTRY_UNIFICARD.md §5.16` (domínio authority). Mudanças futuras neste vocabulário = nova DECISION.

### 2.2 Declarar os DOIS EIXOS como ORTOGONAIS (resolve RN2)

`relationship_type` e `company_users.role` são **eixos distintos e ortogonais** (era a decisão D2 de Clayton),
e a sobreposição de tokens é **coincidência de nomenclatura, não conceito duplicado**:

| Eixo | Vocabulário | O que responde | SSOT |
|---|---|---|---|
| **Cargo operacional** (`company_users.role`) | `owner\|admin\|staff\|contractor\|member` | "que TIER de permissão operacional?" (deriva `can_manage_*`) | `company_users` |
| **Vínculo jurídico** (`actor_delegations.relationship_type`) | `partner\|director\|administrator\|attorney\|legal_representative\|employee\|contractor` | "que VÍNCULO institucional/civil?" (§4.9.9 cadeia de autoridade) | `actor_delegations` |

Um `admin` (cargo operacional) pode ser `partner` OU `attorney` (vínculo jurídico) — são fatos
independentes. A norma PJ (`20260606_PJ_COMPANY_USER_ROLE_VOCABULARY`) já reservou explicitamente o
eixo jurídico (sócio/diretor/procuração) para a frente de delegação — esta DECISION o cumpre.

**Não renomear os tokens:** `administrator`/`director`/etc são os termos jurídicos corretos; renomeá-los
para evitar a coincidência com `admin` degradaria a clareza do vínculo. A ortogonalidade fica DOCUMENTADA
(esta seção) em vez de tokens artificialmente distintos.

### 2.3 O vínculo é CAPTURADO, não DERIVADO (fecha a ressalva R2.2 — JÁ EXECUTADO)

A auditoria apontou que `relationship_type` era **derivado 1:1 do role** (`getRelationshipTypeForRole`:
admin→administrator, staff→employee, contractor→contractor; owner→null), o que (a) tornava o vínculo um
re-encoding redundante do cargo, (b) deixava 4/7 valores INALCANÇÁVEIS, (c) perdia o vínculo do owner.

**Correção já materializada (commit desta sessão):** `createMember` aceita `relationshipType` EXPLÍCITO
(vocabulário governado, validado pelo CHECK) — o gestor DECLARA o vínculo real (é sócio? procurador?).
A derivação do role permanece só como **fallback de compatibilidade** quando não declarado. Assim os 7
valores são alcançáveis e o owner recebe o vínculo correto quando declarado. Provado em E2E (gestor declara
`partner` sobre um membro de role `staff` → gravado `partner`, não `employee`).

---

## 3. O que NÃO muda

- O CHECK do banco (já vigente) — esta DECISION o RATIFICA e registra, não o altera.
- A separação de eixos (D2) — confirmada, não revista.
- Segurança (atomicidade/autoridade/RLS/não-repúdio) — fora de escopo (já selada).

---

## 4. Ações pendentes de Clayton

1. **Ratificar** este vocabulário e a ortogonalidade dos eixos.
2. **Inserir no cânone** (`docs/01_normative/`): glossário do `07_NOMENCLATURA` + referência no
   `SSOT_REGISTRY §5.16`. (Só Clayton escreve em `01_normative`.)
3. Ao ratificar, as DTs `DT-R2-RELATIONSHIP-TYPE-VOCAB-NOT-REGISTERED-IN-CANON` (RN1) e
   `DT-R2-RELATIONSHIP-TYPE-TOKEN-OVERLAP-WITH-COMPANY-ROLE` (RN2) fecham.
