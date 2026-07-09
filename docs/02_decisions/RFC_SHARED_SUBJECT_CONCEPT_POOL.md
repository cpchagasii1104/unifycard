# RFC-SHARED-SUBJECT-CONCEPT-POOL — pool canônico de ASSUNTO compartilhado (tema + interesse)

**Status:** PROPOSTA (docs-only) — aguarda GO de Clayton. NENHUM código/tabela/migration/seed criado.
**Data:** 2026-07-08 · **Autor:** executora · **Decisor:** Clayton
**Precede:** implementação forward-only (só com GO)
**Relacionado:** F-OFFER-KIND-SERVICE-GATE (selada), F-SHARED-SUBJECT-CONCEPT-SEED (seed dos assuntos), F-EVENT-CONCEPT-FIRST-MODEL

---

## 0. Prova normativa (00_AGENT_PROTOCOL §2.2/§2.3)

- **SSOT semântico = CONCEPT** (`concepts.concept_id`). Identidade e elegibilidade nascem do CONCEPT + aplicabilidade, nunca de TREE/N0/N1/N2/category (navegação/breadcrumb) nem de `canonical_services` (catálogo/rótulo de serviço).
- **Pilar:** dimensão de **APLICABILIDADE** de um concept — "este concept serve como ASSUNTO?" — análoga em forma a `concept_offer_kinds`/`event_format_concepts`, mas **NEUTRA**: assunto **não é oferta** (não é `service` nem `rentable`), por isso **NÃO** entra em `concept_offer_kinds`.
- **Frontend projeta, não cria verdade.** Cartório operacional = `REMEDIATION_DT_LOG.md`.
- **Suficiência documental:** os precedentes de aplicabilidade já existem no repo (`concept_offer_kinds`, `concept_rentable_types`, `event_format_concepts`); esta RFC compõe do padrão, não inventa mecânica nova.

## 1. Problema (do READ-FIRST F-INTEREST-PICKER-CONCEPT-POOL)

Interesse e tema **compartilham a identidade** `concepts.concept_id`, mas **descobrem por pools diferentes**:
- **Interesse** → navega árvore de `categories scope='interest'`.
- **Tema** → busca `canonical_services` PLANO por nome.

Os 9 assuntos compartilhados (futebol/sinuca/churrasco/festa/festa-infantil/campeonato/show/workshop/area-de-churrasco) estão hoje **fora de serviço** (gate `offer_kind='service'` ✅), **buscáveis como tema** (via `canonical_services`), mas **NÃO alcançáveis como interesse**. Além disso, `canonical_services` como índice de tema é o **mesmo resíduo** que acabamos de conter no trilho de serviço — não pode virar autoridade de pertencimento a "assuntos possíveis".

## 2. Decisão proposta

Criar uma **estrutura própria/neutra de ASSUNTO** — pool canônico compartilhado por **tema de evento** e **interesse declarado** (e, no futuro, recomendação interesse↔evento). **Um concept, vários papéis; sem duplicar; sem `canonical_services` como autoridade; sem `offer_kind='subject'`.**

### 2.1 Nome físico proposto (07_NOMENCLATURA)

**Recomendado:** `shared_subject_concepts` — espelha o padrão marcador `event_format_concepts` (`<X>_concepts`, `concept_id` PK), snake_case, e **evita a palavra "offer"** (exigência Clayton: isto é ASSUNTO, não oferta).
**Alternativa:** `concept_subject_applicabilities` (padrão `concept_<X>`). A RFC fixa o nome no GO; recomendação = `shared_subject_concepts`.

### 2.2 Estrutura (papel exato)

```
shared_subject_concepts (
  concept_id  UUID PRIMARY KEY REFERENCES concepts(concept_id) ON DELETE CASCADE,  -- IDENTIDADE semântica
  enabled     BOOLEAN NOT NULL DEFAULT true,                                       -- lifecycle (liga/desliga do pool)
  seed_reason TEXT,                                                                -- proveniência do seed (padrão do repo, opcional)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)
```
- `concept_id` = identidade (FK RESTRICT/CASCADE ao SSOT). **SEM** preço, **SEM** agenda, **SEM** `offer_kind`, **SEM** category como autoridade, **SEM** tenant (pool global de assunto; scoping fica para RFC futura se necessário).
- Marcador de pertencimento: "este concept é um ASSUNTO possível". Nada além disso.

## 3. Consumidores (quem LÊ o pool)

1. `GET /events/themes/search` — elegibilidade de tema vem do pool (não mais de `canonical_services`).
2. Picker de interesses (backend a definir na implementação; hoje `interest-c1` só declara por `conceptId`) — busca concepts no pool.
3. (Futuro) recomendação interesse↔evento — mesmo pool, mesma identidade.

## 4. O que fica FORA (não lê o pool; não é assunto)

- **Serviço/capability/demanda** → seguem `concept_offer_kinds.offer_kind='service'` (contido; guard `audit-offer-kind-service-gate`).
- **Locação** → segue `concept_offer_kinds.offer_kind='rentable'`.
- **Formato de evento** → segue `event_format_concepts` (formato ≠ tema/interesse).
- **Needs/orquestração** → Fase B (`event_need_definitions`/`orchestration_templates`) — fora desta RFC.

## 5. O que NÃO pode ser o pool canônico

- **`categories scope='interest'`** — navegação/breadcrumb/filtro, **não** "isto é interesse possível". Identidade/elegibilidade vêm de CONCEPT + pool de assunto.
- **`event_theme_links`** — vínculo de evento existente→concept, não catálogo global.
- **`actor_interest_concepts`** — declaração do actor, não catálogo global.
- **`event_format_concepts`** — formato, não assunto.
- **`canonical_services` flat** — resíduo que estamos removendo; no máximo join AUXILIAR de rótulo/texto em transição, **nunca** autoridade de pertencimento.

## 6. Seed inicial (na implementação, não agora)

- Os 9 forbidden + demais shared subjects entram em `shared_subject_concepts` (enabled=true).
- **NÃO** entram em `offer_kind='service'`; **NÃO** viram serviço vivo; continuam CONCEPT.
- Seed governado (trigger de governança de concept já respeitado pelos concepts existentes; aqui só marca aplicabilidade).

## 7. Migração do TEMA (forward-only)

- `GET /events/themes/search` passa a filtrar elegibilidade por `shared_subject_concepts` (JOIN), deixando `canonical_services` de ser autoridade de tema.
- Durante transição, `canonical_services.name` pode ser join AUXILIAR de label/text-search **se necessário**, mas **elegibilidade = pool de assunto**. Estado final: tema não depende de `canonical_services` para pertencimento.

## 8. Guards previstos (na implementação)

1. **Tema/interesse não podem ler `canonical_services` flat como AUTORIDADE** de pertencimento (só como label auxiliar, se houver join ao pool).
2. **Serviço/capability/demanda não podem ler o subject pool** (separação de trilhos; espelho do guard offer_kind).
3. **Categoria não pode virar identidade semântica** (scope='interest' = navegação).
4. **Frontend não pode criar lista local de assuntos** (estende o guard anti-hardcode).
5. Prova por mutação em cada um (padrão da casa).

## 9. STOP (até GO)

NÃO criar tabela · NÃO criar migration · NÃO alterar picker · NÃO alterar `/events/themes/search` · NÃO semear · NÃO tocar Fase B · NÃO tocar RFQ · NÃO tocar `service_demands` · NÃO tocar Bank. **Primeiro esta RFC/decisão docs-only; depois, com GO, implementação forward-only.**

## 10. Decisão pendente de Clayton

- [ ] Aprovar a estrutura própria/neutra (não `concept_offer_kinds`).
- [ ] Ratificar o nome físico (`shared_subject_concepts` recomendado).
- [ ] Confirmar migração do tema para o pool (canonical_services deixa de ser autoridade de tema).
- [ ] GO para implementação forward-only (migration + gate dos consumidores + guards + seed).
