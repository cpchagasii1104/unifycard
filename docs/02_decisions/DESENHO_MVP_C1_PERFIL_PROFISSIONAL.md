# DESENHO MVP C1 · SUBSTRATO PROFISSIONAL DECLARATIVO ACTOR-FIRST — DECISION-0063

> **NATUREZA DESTE DOCUMENTO:** **DECISION-0063 RATIFICADA** (Clayton + Opus + ChatGPT, 2026-05-31). Desenho VIGENTE do MVP C1, consolidado a partir da DESENHO-PROPOSTA v2 (ratificada pelo ChatGPT) + 13 decisões finais de Clayton + 2 ajustes finais do ChatGPT. **É DECISION de DESENHO** — fixa a arquitetura do substrato profissional declarativo. **NÃO implementa schema:** não autoriza migration, código, seed ou prompt executor; a migration canônica de C1 (`actor_professional_profiles` + `actor_professional_concepts`) é frente separada (§13).

> **NOMENCLATURA (vinculante):** a **aba** de perfil é porta/read-model (projeção). O **substrato C1** é o **substrato profissional declarativo actor-first** — grava verdade declarada ("este actor declara competência no concept X"), logo é SSOT da declaração profissional, NÃO read-model. Os dois papéis são distintos; o termo "read-model" jamais se aplica a C1.

**Data:** 2026-05-31
**Promulgado:** 2026-05-31
**Identificador:** DECISION-0063 — MVP_C1_PROFESSIONAL_DECLARATIVE_SUBSTRATE
**Status:** DECISION RATIFICADA — Clayton + Opus + ChatGPT, 2026-05-31. VIGENTE como desenho do MVP C1.
**Autor:** Opus (coordenador/arquiteto)
**Ratificação acumulada:** ChatGPT (proposta v1 + v2, 5 ajustes estruturais + 2 terminológicos + 2 ajustes finais) · Clayton (13 decisões abaixo + OK final de promulgação)
**Origem:** veredito do Gate D2 (HEAD 73527a3b) + grafo de dependências + DESENHO_PROPOSTA v2
**Frente:** F-PROFILE-PROFESSIONAL — MVP C1 (desenho; implementação é etapa futura, pós-ratificação)
**Padrão:** segue o modelo DESENHO_FASE_3B (desenho committado antes do código)

---

## 1. ESTADO PROVADO PELOS GATES (não suposição)

1. **Ponte governada user→actor EXISTE e é canônica.** `ensureUserActor(tenantId, userId)` → `findOrCreateUserActor` em `@modules/identity/actor-writer.service`. CI guard `validate:actor-writer-boundaries` previne contorno (44 lookups diretos já remediados, RESOLVIDO no log).

2. **Chão semântico EXISTE e é canônico.** `categories` (scope='professional': L0=2, L1=22, L2=3) + `concepts` (90). Os 3 L2 professional têm `concept_id` com `domain='servicos'` (3/3, zero colisão). Permite desenho concept-anchored.

3. **Substrato actor-keyed do perfil GERAL existe** — `public_profiles` (`20260530440000`): `actor_id UUID NOT NULL REFERENCES actors(id)`, `UNIQUE(tenant_id, actor_id)`. **Template de forma de keying, NÃO destino dos dados profissionais.**

4. **Substrato actor-keyed do perfil PROFISSIONAL NÃO existe.** As 4 tabelas antigas (`user_skills_categories`, `predefined_services`, `combo_discount_rules`, `workers`) ausentes do banco vivo (0/4), só em `migrations_archive/`, e global-user-keyed. O serviço atual é global-user-keyed e não chama a ponte.

5. **Consequência (veredito D2 = PARCIAL):** NÃO restaurar archive, NÃO migrar dados antigos (0 linhas). Desenhar **substrato novo, actor-first, concept-anchored**. A peça de D2 que falta — o substrato profissional declarativo — É o entregável desta frente, não fundação anterior.

---

## 2. DECISÕES DE CLAYTON — FECHADAS (consolidadas neste desenho final)

| # | Decisão | Valor fechado |
|---|---|---|
| 1 | **Multiplicidade** | SIM. `UNIQUE(tenant_id, actor_id, concept_id)`. NUNCA `UNIQUE(tenant_id, actor_id)`. Um actor pode declarar N profissões. |
| 2 | **Identidade semântica** | `concept_id`. A profissão "é" o concept, não a categoria, não o slug, não o `source_category_id`. |
| 3 | **`source_category_id`** | Opcional; só rastreio de navegação/seleção; NUNCA identidade nem SSOT semântico. |
| 4 | **`skill_level`** | Declaração qualitativa (autoavaliação) do actor; NÃO credencial verificada. |
| 5 | **`years_experience`** | Declaração quantitativa/temporal do actor; NÃO credencial verificada. |
| 6 | **Certificação/verificação** | FORA do MVP C1. Futura trilha própria de credencial/verificação. |
| 7 | **Bio profissional** | Distinta da bio geral (`public_profiles.bio`). |
| 8 | **Experiência mínima do MVP** | `skill_level` + `years_experience` por `concept_id`; ambos declarados, ambos não verificados. |
| 9 | **Preço/oferta/capability** | FORA do MVP C1 → C2/C4 futuras. |
| 10 | **Availability/agenda** | FORA do MVP C1 → SSOT temporal próprio (`unified_availability`/`unified_bookings`). |
| 11 | **Leitura** | Usa `actor_id` JÁ resolvido via `actionContext`/active actor. NÃO dispara `ensureUserActor` (sem side effect de criação). |
| 12 | **Escrita/provisionamento** | Usa `ensureUserActor`/`findOrCreateUserActor` via actor-writer. |
| 13 | **Lookup solto** | PROIBIDO. Nada de query avulsa user/global_user → actor_id fora da porta canônica. |

---

## 3. INVARIANTES NORMATIVAS (vinculantes)

1. **Resolução de actor governada, sem side effect em leitura.** Banco NÃO impõe unicidade de `global_user_id` em `actors` (só `UNIQUE(actor_id)`; índice de `user_id` não-único). Determinismo "1 user actor por global_user" garantido SÓ pelo `findOrCreateUserActor`. Escrita via porta (pode criar); leitura usa `actor_id` resolvido (não cria); lookup direto proibido sempre.
2. **`actor_id` é a chave operacional** (D2). C1 keyed por `actor_id`.
3. **CONCEPT é o SSOT semântico** (Lei 7). Identidade = `concept_id`. Slug/category_id/nome/metadata/string NÃO são identidade.
4. **Categoria L2 profissional exige `concept_id` com `domain='servicos'`**, validação estrita sem fallback silencioso; escrita de categoria só pelo pipeline canônico.
5. **Perfil é projeção/porta, não SSOT** quanto a availability/dinheiro/authority — mas o **substrato C1 É SSOT da declaração profissional** (verdade declarada de competência mora aqui).
6. **Frontend nunca cria verdade** de capability/oferta.

---

## 4. ESCOPO DO MVP C1 — O QUE ENTRA E O QUE NÃO ENTRA

### 4.1 ENTRA no MVP C1
- identidade/competência profissional **declarada**;
- `actor_id` como chave operacional;
- `concept_id` como identidade semântica (obrigatório);
- `source_category_id` opcional (só rastreio);
- `skill_level` declarado;
- `years_experience` declarado;
- bio profissional distinta da geral;
- ciclo de vida mínimo da declaração (desativação lógica, NÃO DELETE).

### 4.2 NÃO ENTRA no MVP C1 (lista de bloqueio dura)
preço · `hourly_rate` · `pricing_type` · `visit_price` · `predefined_services` · `combo_discount_rules` · `workers` · availability · agenda · capability · authority · `bank_*` · payout · split · qualquer verdade financeira · certificação verificada.

---

## 5. MODELO DE CAMADAS (separação que evita realidade paralela)

| Camada | Pergunta | SSOT | Autorada na aba? | No MVP C1? |
|---|---|---|---|---|
| **C1 — Identidade/competência declarada** | "que profissão/skill este actor declara" | substrato profissional declarativo (§6) | SIM (verdade declarável) | **SIM** |
| **C2 — Oferta/preço/workers** | "o que ofereço e por quanto" | offer/pricing/marketplace (a definir; toca financeiro) | NÃO (projetada) | NÃO (futura) |
| **C3 — Availability/agenda** | "quando estou disponível" | `unified_availability`/`unified_bookings` (existe) | NÃO | NÃO (futura) |
| **C4 — Capability/authority** | "o que PODE operar" | engine de autoridade + `actor_registry` | NÃO (resolvida) | NÃO (futura) |

O erro do serviço antigo foi fundir C1 com C2 (autorar preço na tela de identidade). O MVP nasce com C1 só.

---

## 6. SUBSTRATO PROFISSIONAL DECLARATIVO — ENTIDADES CANDIDATAS (sem migration)

> Candidatos para o desenho final. Nomes a validar contra a nomenclatura canônica. Nenhuma migration nasce daqui sem ratificação.

**C1 tem DOIS blocos lógicos**, separados por cardinalidade — bio é **1:1 por actor** (o resumo profissional do actor é um só, mesmo que ele tenha várias competências); competências são **1:N por actor** (multiplicidade, decisão #1). Misturá-las numa só tabela duplicaria a bio no nascimento.

### 6.1 `actor_professional_profiles` — bio profissional (1:1 por actor)

- `id` UUID PK
- `tenant_id` UUID NOT NULL → tenants(id)
- `actor_id` UUID NOT NULL → actors(id)   ← chave operacional (D2)
- `professional_bio` TEXT NULL   ← bio profissional **distinta** da geral (`public_profiles.bio`); resumo profissional do actor, um só
- `created_at` TIMESTAMPTZ NOT NULL
- `updated_at` TIMESTAMPTZ NOT NULL
- **`UNIQUE(tenant_id, actor_id)`**   ← uma bio profissional por actor

### 6.2 `actor_professional_concepts` — competências declaradas (1:N por actor)

- `id` UUID PK
- `tenant_id` UUID NOT NULL → tenants(id)
- `actor_id` UUID NOT NULL → actors(id)   ← chave operacional (D2)
- `concept_id` UUID NOT NULL → concepts(concept_id)   ← identidade semântica (Lei 7), OBRIGATÓRIO
- `source_category_id` UUID NULL → categories(category_id)   ← rastreio de navegação OPCIONAL; NUNCA identidade
- `skill_level` SMALLINT NOT NULL `CHECK (skill_level BETWEEN 1 AND 5)`   ← autoavaliação declarada (não credencial); nível estruturado e comparável (busca/matching futuro). Labels (iniciante/…/especialista) ficam na UI; o banco grava número (decisão Clayton 2026-05-31)
- `years_experience` SMALLINT NULL `CHECK (years_experience IS NULL OR years_experience BETWEEN 0 AND 80)`   ← anos declarados (não verificados); NULL = não informado, 0 = informou zero (decisão Clayton 2026-05-31)
- `is_active` BOOLEAN NOT NULL DEFAULT true   ← ciclo de vida binário (ativa/retirada); NÃO `status` enum (sem estados concretos além de ativo/inativo no MVP)
- `declared_at` TIMESTAMPTZ NOT NULL
- `updated_at` TIMESTAMPTZ NOT NULL
- `retired_at` TIMESTAMPTZ NULL   ← marca a retirada lógica
- **`UNIQUE(tenant_id, actor_id, concept_id)`**   ← multiplicidade (decisão #1)
- **`CHECK ((is_active = true AND retired_at IS NULL) OR (is_active = false AND retired_at IS NOT NULL))`**   ← trava o ciclo binário no banco: retirada ⟺ `retired_at` preenchido (decisão Clayton 2026-05-31)

Regras:
- `concept_id` obrigatório; identidade da profissão.
- `source_category_id`, se usado, é breadcrumb; jamais inferir o que a competência "é" a partir dele.
- `skill_level`/`years_experience` são declarações; verificação fica fora (decisão #6).
- **Remover competência = desativação lógica** (`is_active=false` + `retired_at`), NUNCA DELETE.
- **Ciclo binário no MVP:** ativa (`is_active=true`) ou retirada (`is_active=false`, `retired_at` preenchido). `status` enum só quando existir estado concreto além de ativo/inativo — não inventar agora.
- Sem preço/oferta/availability/capability nestas tabelas (decisões #9/#10).
- A bio profissional NÃO mora aqui (mora em 6.1, 1:1 por actor) — evita duplicação por competência.

---

## 7. RELAÇÃO COM CONCEPT/categories e public_profiles

- **CONCEPT é a identidade.** `actor_professional_concepts.concept_id` → `concepts`. Categoria L2 é navegação para encontrar o concept; persiste-se `concept_id`.
- **Ponte category→concept** só se 1:1/determinística/estável. Em fluxo transacional, proibido derivar identidade de `categories.concept_id`. Para o substrato declarativo de identidade/competência (C1), a navegação usa categoria, mas o que se persiste é `concept_id`.
- **public_profiles é template de keying, não destino.** Copia-se a forma (`actor_id NOT NULL`, `UNIQUE(tenant_id, actor_id)`). Dados profissionais NÃO vão para `public_profiles`; vão para C1 (`actor_professional_profiles` + `actor_professional_concepts`), que referenciam o mesmo `actor_id`. Um actor tem: um `public_profiles` (geral), uma `actor_professional_profiles` (bio profissional, 1:1), e zero-ou-mais `actor_professional_concepts` (competências, 1:N). Três âncoras no mesmo `actor_id`, cardinalidades distintas.

---

## 8. PONTOS EXATOS ALTERADOS EM RELAÇÃO À v2

1. **Status:** DESENHO-PROPOSTA v2 → **DESENHO FINAL CANDIDATO**.
2. **Decisões de Clayton consolidadas** na §2 como FECHADAS (13 itens), não mais "pendentes". As pendências do MVP (experiência, bio, certificação) viraram decisões: experiência = `skill_level`+`years_experience` por concept; bio = distinta; certificação = fora.
3. **§4 reescrita** como escopo MVP explícito (entra/não-entra) com lista de bloqueio dura.
4. **`professional_bio` separado** em entidade `actor_professional_profiles` (1:1 por actor), NÃO mais dentro de `actor_professional_concepts` (que é 1:N) — corrige cardinalidade, evita duplicação da bio por competência (decisão #7 + ajuste final ChatGPT).
5. **Ciclo de vida fixado binário:** `is_active BOOLEAN NOT NULL DEFAULT true` + `retired_at`, NÃO mais "is_active ou status" (ajuste final ChatGPT; status enum fica para quando houver estado concreto além de ativo/inativo).
6. **C2/C4 (preço/capability)** movidos de "decisão pendente" para "fora do MVP, frente futura" — não bloqueiam C1.
7. **Terminologia:** zero "read-model" aplicado a C1 em todo o documento (só a aba é projeção).

---

## 9. DECISÕES FECHADAS vs ADIADAS

**FECHADAS (no MVP C1):** multiplicidade, identidade=concept_id, source_category_id=rastreio, skill_level/years_experience=declarações, certificação fora, bio distinta, experiência mínima, keying actor_id, leitura sem side effect, escrita via writer, lookup proibido.

**ADIADAS (frentes futuras, NÃO bloqueiam C1):**
- **C2 — pretensão/preço/oferta/workers** (toca fronteira financeira; ratificação tripla se virar `bank_*`).
- **C4 — quando "ofereço serviço" vira capability operacional** (fronteira C1↔C2↔C4).
- **Certificação verificável** (trilha de credencial/verificação própria).
- **C3 — availability** (já tem SSOT temporal; integração futura, não no perfil).

---

## 10. ANTI-PATTERNS PROIBIDOS

1. Restaurar archive verbatim (substrato global-user-keyed anti-canônico).
2. `category_id` como identidade (viola Lei 7).
3. Resolver actor por query avulsa (banco não garante unicidade de global_user_id).
4. Autorar oferta/preço na aba de perfil (funde C2 com C1).
5. Availability persistida no perfil (viola SSOT temporal).
6. Tratar C1 como read-model (é SSOT da declaração) OU tratar a aba como SSOT (é projeção).
7. Lista de profissões hardcoded no frontend (viola CONCEPT como SSOT).
8. Criar `workers`/oferta/capability como subproduto do MVP C1.
9. Tocar `bank_*`/split/payout a partir do perfil.
10. DELETE de competência (deve ser desativação lógica).

---

## 11. GATES MÍNIMOS PARA A FUTURA IMPLEMENTAÇÃO (não nesta etapa)

- `validate:actor-writer-boundaries` — toda resolução de actor pela porta; zero lookup avulso.
- `validate:bank-ledger-boundaries` — nenhum `bank_*` tocado pelo perfil.
- `validate:regression-guards`.
- `validate-architectural-patterns --strict` — `critical_new=0`.
- `tsc --noEmit` limpo.
- Teste: `concept_id` obrigatório (rejeita competência sem concept).
- Teste: `actor_id` é a chave (não user_id/global_user_id).
- Teste: ausência de lookup solto user/global_user → actor_id.
- Teste: C2/C3/C4 NÃO autorados no perfil (sem preço, sem availability, sem capability, sem worker).
- Teste: remover competência = desativação lógica, não DELETE.
- Se tocar financeiro no futuro (C2): outra frente, ratificação tripla + E2E específico.

---

## 12. AMBIGUIDADES ENDURECIDAS (revisão anti-implementação-acidental)

Pontos onde a executora futura poderia implementar C2/C3/C4 por acidente — endurecidos:

1. **"perfil profissional" NÃO inclui oferta.** O substrato C1 é identidade/competência declarada. Qualquer campo de preço/serviço/worker é C2 e está PROIBIDO no MVP (§4.2). Se a executora encontrar referência a preço no código antigo, NÃO portar.
2. **"bio profissional" é um campo de texto declarado, não um perfil comercial.** Distinta da geral, mas não carrega oferta.
3. **`skill_level`/`years_experience` são declarações, não gatilho de capability.** Declarar competência NÃO concede authority nem cria capability (C4). O substrato C1 não escreve em `actor_registry` nem no engine de autoridade.
4. **Navegação por categoria NÃO é persistência de categoria como identidade.** A UI navega categorias; o que grava é `concept_id`. `source_category_id` é breadcrumb opcional, nunca identidade.
5. **O MVP C1 não integra availability.** Mesmo que a aba antiga tivesse campo de disponibilidade, ele NÃO entra. Availability é C3, SSOT temporal próprio.

---

## 13. PRÓXIMA ETAPA

```
1. ChatGPT ratifica este DESENHO FINAL CANDIDATO.
2. Clayton dá OK final → vira DECISION/documento de desenho ratificado.
3. SÓ ENTÃO nasce prompt executor — primeira fatia: migration canônica das duas tabelas de
   C1 (actor_professional_profiles + actor_professional_concepts), com os gates da §11.
4. C2/C3/C4 = frentes posteriores; C2 (preço) só após camada de pricing definida e sua
   relação com bank_* (ratificação tripla).
```

---

## RATIFICAÇÃO (histórico — respondida)

> Pergunta final ao ChatGPT (registro): este desenho incorpora as 13 decisões de Clayton, mantém C1 estritamente como identidade/competência declarada (sem preço/oferta/availability/capability/certificação verificada), usa `concept_id` como identidade e `actor_id` como chave, prevê ciclo de vida com desativação lógica, e endurece o texto contra implementação acidental de C2/C3/C4?
>
> **RESPOSTA: RATIFICADO.** ChatGPT ratificou sem nova ressalva técnica (após os 2 ajustes finais: bio em entidade 1:1 separada; ciclo `is_active + retired_at` sem `status` enum prematuro). Clayton deu OK final de promulgação. Opus consolidou. Promulgado como DECISION-0063 em 2026-05-31.

---

**Esta é uma DECISION promulgada (DECISION-0063), VIGENTE como desenho do MVP C1.** NÃO autoriza migration, código, seed ou prompt executor — a migration canônica das duas tabelas de C1 é frente separada (§13), em sessão própria, com os gates da §11. A planta está promulgada; o eletricista ainda não foi chamado.

---

*Read-only quanto a código/schema: a promulgação não alterou backend, frontend, migration nem banco. Único artefato desta etapa: este documento de desenho ratificado.*
