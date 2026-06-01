# DESENHO_A3 — Migrar a aba Profissional do legado morto para o C1 selado

> **Status:** DESENHO read-only / diagnóstico. **Autorizado por Clayton (2026-05-31):** redigir e
> committar SOMENTE este documento. **A3-código NÃO autorizado.** Interesses/Aprendizado NÃO ·
> financeiro NÃO · migration NÃO. Este documento é insumo para ratificação tripla
> (Opus + ChatGPT + Clayton) antes de qualquer fatia de código.
>
> Natureza desta entrega: **zero código · zero migration · zero frontend · zero backend runtime ·
> commit documental único.**

## 1. Contexto e tese

O backend C1 do perfil profissional (`/profile/professional/c1`) está **selado e correto** (A2 /
DECISION-0063), mas **ocioso**: frontend e inferência ainda consomem o **serviço profissional legado**,
que está **morto** (consulta tabelas inexistentes no schema vivo: `user_skills_categories`,
`predefined_services`, `combo_discount_rules`, `workers`).

> **C1 backend pronto + frontend ainda chamando legado = entrega incompleta.**

Esta frente fecha o ciclo do C1: migrar a aba Profissional para o contrato C1 e desacoplar a inferência
do legado. **Princípio-mestre (Clayton):** *"melhor uma tela menor e verdadeira do que uma tela cheia
salvando mentira com gravata."* — NÃO aliasar o legado para C1; alias cria falsa compatibilidade.

## 2. Pré-leituras obrigatórias (ler INTEIRAS antes de transformar este desenho em código)

- `DECISION-0043` e `DT-CORE-PROFILE-IGNORES-ACTOR-CONTEXT` (`REMEDIATION_*_LOG.md`).
- `DECISION-0063` + `docs/02_decisions/DESENHO_MVP_C1_PERFIL_PROFISSIONAL.md` (contrato C1: dentro/fora).
- `docs/02_decisions/SELO_A2_C1_PERFIL_PROFISSIONAL.md` (selo A2 + premissas refutadas do Contrato A1).
- Estado/commits recentes que ancoram esta frente:
  - `38f17806` — preservação da visão contextual + status pós-A2.
  - `d18c800d` — fix erros pós-boot (SLA `payment_status`; `REDIS_ENABLED=false` local).
  - `d497fe63` — fix `categories.domain_type` (verdeou `/profile/physical`; fecha
    `DT-DRIFT-SCHEMA-CODE-MISMATCH-CATEGORIES`).
  - `5480572e` — 6 DTs de runtime do sweep de abas.
- DTs recém-registradas que esta frente endereça/cita:
  - `DT-PROFILE-PROFESSIONAL-LEGACY-MISSING-TABLES`,
    `DT-PROFILE-PROFESSIONAL-LEGACY-ROUTE-LIVE-BROKEN`,
    `DT-PROFILE-PROFESSIONAL-SERVICE-TABLES-ARCHIVE-ONLY`;
  - `DT-PROFILE-INFERENCE-COUPLED-TO-PROFESSIONAL-LEGACY`;
  - `DT-HEALTH-FACTS-TABLE-MISSING` / `DT-PROFILE-HEALTH-FACTS-SUBSTRATE-DRIFT` (vizinhas, NÃO escopo desta frente);
  - `DT-CORE-PROFILE-GET-CREATES-ACTOR`, `DT-AUTH-RATE-LIMIT-LOGS-MISSING`,
    `DT-MARKETPLACE-FINANCE-AGENDA-SCHEDULED-ACTIONS-MISSING` (runtime vizinhas, fora de escopo).

## 3. Blast radius comprovado (runtime + leitura de código, esta sessão)

**Serviço legado `backend/src/core/profile/profile-professional.service.ts` — 100% morto:**
ambos os métodos (`getProfessionalProfile`, `updateProfessionalProfile`) batem em tabelas ausentes em
todo caminho; sem degradação interna.

**Callers (raio de impacto):**

| Caller | Local | Hoje | Observação |
|---|---|---|---|
| `GET /profile/professional` | `profile-professional.routes.ts:24` | **500** | endpoint legado |
| `PUT /profile/professional` | `profile-professional.routes.ts:114` | 400/500 | escrita legada |
| `getUserProfileSnapshot` | `profile-inference.service.ts:245` | **500** | `Promise.all([physical, learning, professional])` — se professional rejeita, o `all` rejeita |
| `core.service.ts` | `core.service.ts:348` (try-catch `:359-361`) | **já seguro** | degrada para perfil parcial |

**Consumo real da inferência:** só `professional.count` (= `skills.length`, `profile-inference.service.ts:261-262`).
A inferência **nunca** lê atributos de skill (preço, serviços, availability, bio). Logo é trivialmente
desacoplável.

**Frontend (alçada Codex — diagnóstico read-only):**
- `frontend/src/api/categories.ts:231` `getProfessionalProfile()` → `GET /profile/professional`;
  `:280` `updateProfessionalProfile()` → `PUT /profile/professional`.
- UI: `frontend/src/components/ProfileProfessional.tsx`; load em `hooks/useProfessionalCategories.ts:97`.
- Cliente `frontend/src/api/client.ts` (`apiFetch`) já injeta Authorization / x-tenant-id / x-action-context.
- Abas de referência que funcionam: `api/physical.ts`, `api/learning.ts` (mesmo padrão, degradação graciosa).

## 4. Direção ratificada por Clayton (norte do desenho — NÃO reabrir)

### 4.1 Destino do legado `/profile/professional` (GET+PUT)
- NÃO restaurar tabelas legadas · NÃO criar alias automático legado→C1 · NÃO fingir compat de bundle.
- O frontend **migra para `/profile/professional/c1`**.
- **Pendência RESIDUAL (pós-migração, fatia própria):** o legado vira **410/501 limpo** OU permanece
  **temporariamente intocado**. Decisão adiada para depois da migração; este desenho NÃO a fecha.

### 4.2 Inference / snapshot (proposta de código FUTURO — não executar agora)
- Desacoplar do legado profissional **degradando APENAS o bloco profissional** para `{ skills: [], count: 0 }`.
- **NÃO engolir o erro geral da inferência** — só o bloco profissional degrada; physical/learning seguem
  reais e qualquer falha deles continua propagando.
- Honesto: NÃO inventa profissão · NÃO cria capability · NÃO cria authority · NÃO reanima o legado ·
  NÃO toca o C1.
- Forma conceitual (NÃO aplicada): isolar a chamada profissional dentro do `Promise.all` com um
  `.catch` LOCAL que retorna o bloco degradado, em vez de deixar a rejeição derrubar o `all`:

  ```ts
  // CONCEITUAL — não aplicar nesta fatia. profile-inference.service.ts ~245
  const [physical, learning, professional] = await Promise.all([
    profilePhysicalService.getPhysicalProfile(tenantId, userId),
    profileLearningService.getLearningProfile(tenantId, userId),
    profileProfessionalService
      .getProfessionalProfile(tenantId, userId)
      .catch(() => ({ skills: [], count: 0 })), // degrada SÓ o bloco profissional
  ]);
  ```
  Segue o padrão de degradação já existente em `core.service.ts` (try-catch → parcial). A inferência
  continua intacta porque só usa `professional.count`.

### 4.3 Frontend da aba Profissional → C1 (alçada Codex)
- Migrar para o contrato C1 selado; **aceitar a redução de escopo**.
- **C1 (DENTRO):** `professional_bio` + `concepts[]` com `concept_id`, `skill_level` (1..5),
  `years_experience` (0..80 | null).
- **FORA da A3:** preço, serviços ofertados, workers, agenda/availability, capability, authority,
  educação, certificação.
- Campos fora do C1 → **removidos, desabilitados, ou marcados "em breve"**. **NUNCA salvos em
  `metadata` nem no legado** (isso é maquiagem em vazamento — anti-padrão vetado).
- Conceitos chegam como **`concept_id`** (identidade semântica soberana), NÃO como `category_id`.
  `source_category_id`, se usado, é só **breadcrumb / rastro de navegação**.

### 4.4 Coordenação com Codex
- Codex só entra DEPOIS deste desenho · **escritor único** · frontend **não decide verdade** ·
  frontend **não manda `actorId` inventado no body** · usa o contexto/headers/middleware já definidos
  pelo backend (Authorization / x-tenant-id / x-action-context).

## 5. Mapa de migração frontend → C1 (campo a campo)

| Campo na aba legada | C1? | Tratamento na A3 |
|---|---|---|
| `bio` | SIM → `professional_bio` | migrar (rename) |
| `skills[].categoryId` | SIM → `concepts[].concept_id` | migrar como identidade `concept_id` (não `category_id`) |
| `skills[].skillLevel` | SIM → `concept.skill_level` | migrar (1..5) |
| `skills[].yearsExperience` | SIM → `concept.years_experience` | migrar (0..80 \| null) |
| `skills[].hourlyRate` / `pricingType` / `serviceType` / `chargeVisit` / `visitPrice` | NÃO (C2) | remover/desabilitar/"em breve" — nunca salvar fora |
| `predefinedServices` / `comboDiscountRules` | NÃO (C2) | idem |
| `availability` | NÃO (C3) | idem |
| `education` | NÃO (domínio separado) | idem |
| (certificação / authority / capability) | NÃO (C4) | idem |

## 6. Pendências explícitas (NÃO decidir aqui — fatias próprias)

- Destino final do legado `/profile/professional` (410/501 vs intocado) — pós-migração.
- Saúde (`user_health_facts` ausente) — `DT-PROFILE-HEALTH-FACTS-SUBSTRATE-DRIFT`, domínio sensível.
- Agenda (`scheduled_actions` ausente) e `auth_rate_limit_logs` — substratos/logging, decisão própria.
- `DT-CORE-PROFILE-GET-CREATES-ACTOR` (GET cria em leitura) — desenho próprio.

## 7. Verificação (das fatias de código FUTURAS — não desta entrega)

Esta entrega não altera runtime; a verificação é a **ratificação tripla** deste desenho. Para o código
posterior (fora deste documento):
- Re-sweep autenticado: `/profile/inference` + `/profile/inference/snapshot` → **200** (bloco
  profissional degradado), `/profile/professional/c1` **intacto**, `/profile/professional` no
  comportamento ratificado (decisão 4.1).
- `tsc --noEmit` limpo + 4 gates (actor-writer, bank-ledger, regression, architectural
  `critical_new=0`, baseline 20 inalterado) sem regressão.
- Frontend (Codex): a aba renderiza C1 (bio + concepts) e não persiste campos fora do C1 em
  metadata/legado.

## 8. Fronteira

Backend (desacoplar inference; destino do legado) = alçada Claude. **Frontend (migração da aba) = alçada
Codex**, só após este desenho. **A3-código permanece NÃO autorizado.** A3 (código) abre só com housekeeping
final + autorização explícita de Clayton.
