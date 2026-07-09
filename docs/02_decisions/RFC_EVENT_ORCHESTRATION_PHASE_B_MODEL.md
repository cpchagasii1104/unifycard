# RFC_EVENT_ORCHESTRATION_PHASE_B_MODEL — modelo da Fase B (necessidades operacionais de evento)

**Status:** PROPOSTA (docs-only) — aguarda ratificação de Clayton. NENHUM código/tabela/migration/endpoint/seed.
**Data:** 2026-07-08 · **Decisor:** Clayton · **Precede:** implementação forward-only (só com GO)
**Relacionado:** F-SHARED-SUBJECT-CONCEPT-POOL (selado), F-OFFER-KIND-SERVICE-GATE (selado), F-GUARD-ANTI-HARDCODE-EVENT-ORCHESTRATION, API_CONTRACT_GOVERNANCE.md
**Fecha o READ-FIRST:** F-EVENT-ORCHESTRATION-PHASE-B.

---

## 0. Prova normativa (00_AGENT_PROTOCOL §2.2/§2.3 + §2.2.8)

- **Domínio:** eventos + ontologia/CONCEPT + serviços. **SSOT semântico = CONCEPT** (`concepts.concept_id`).
- **Pilar:** necessidade operacional de evento = relação governada evento/formato → CONCEPT com **aplicabilidade explícita**; NÃO vocabulário paralelo de "need"; NÃO texto livre; NÃO `event_type` legado como chave.
- **Suficiência documental:** precedentes de aplicabilidade/template já existem (`concept_offer_kinds`, `event_format_concepts` com `orchestration_template_key`+`required_capabilities` já previstos). Compõe do padrão.
- **Contrato de API (§2.2.8):** a rota nova de sugestões **começa pelo contrato** (`API_CONTRACT_GOVERNANCE.md`) antes do código — este RFC já propõe o contrato (§4).

## 1. Modelo proposto

**Princípio (anti-4º-substrato):** uma NECESSIDADE aponta para um CONCEPT com aplicabilidade explícita; a
definição semântica da necessidade **é o próprio CONCEPT**, a tabela só diz "este evento/formato precisa deste
concept". **Nesta fatia v1, só `fulfillment_kind='service'`** (validado por `concept_offer_kinds.offer_kind=
'service'`). Locação/recurso/produto ficam **fora da v1**, mas o modelo **não os impede** por extensão futura.

- **`fulfillment_kind`** (coluna GOVERNADA — ratificado Clayton): vocabulário governado
  `EVENT_NEED_FULFILLMENT_KINDS = ['service']` (const + manifest + CHECK que COMPÕE do vocab, não literal
  solto — espelho de `CONCEPT_OFFER_KINDS`). v1 = só `'service'`; extensão futura (`'rentable'`, `'product'`)
  amplia o vocabulário por decisão própria. Guard morde se necessidade usar fulfillment_kind fora do vocab
  ou concept sem a aplicabilidade correspondente.
- **Autoridade da necessidade → concept:** FK real a `concepts(concept_id)`; validação de que o concept tem
  `offer_kind='service'` no gate (guard) + idealmente CHECK/trigger na escrita.

## 2. Nomes físicos propostos (07_NOMENCLATURA — snake_case, plural, FK `<entidade>_id`)

- **`event_orchestration_template_items`** — linhas de TEMPLATE por formato:
  `format_concept_id` (FK concepts) → `need_concept_id` (FK concepts, offer_kind='service' na v1) +
  `fulfillment_kind` + `is_required` (bool) + `sort_order`. "festa → [buffet, som, decoração, limpeza]" vira DADO.
- **`event_operational_needs`** — INSTÂNCIA por evento (o organizador escolheu):
  `event_id` (FK events) + `need_concept_id` (FK concepts) + `fulfillment_kind` + `status` + `notes` (texto
  livre SÓ como nota, nunca matching) + timestamps.
- **NÃO** usar `event_need_definitions` (soaria como vocabulário paralelo — a definição é o CONCEPT).
- **NÃO** usar `orchestration_templates` genérico.

## 3. `orchestration_template_key` existente (event_format_concepts)

Hoje 100% VAZIO. **Recomendação:** autoridade por **`format_concept_id`** (via `event_orchestration_template_
items`), NÃO por key string. O campo `orchestration_template_key` é **aposentado/ignorado** como autoridade
(no máximo projeção/compat futura). Não transformar string em autoridade.

## 4. Contrato de API proposto (registrar em API_CONTRACT_GOVERNANCE.md ANTES do código)

### `GET /events/:eventId/orchestration-suggestions`
- **Autoridade:** autenticada, `requireContext` (actionContext.actorId + tenant.id); organizador do evento
  (representação verificada). Read-only.
- **Entrada:** param `eventId`.
- **Saída:** `{ suggestions: Array<{ needConceptId, label, fulfillmentKind, isRequired }> }` — derivadas do
  `event_format_concept_id` (+ tema, futuro) do evento via `event_orchestration_template_items`.
- **SSOT:** template governado; label vem do concept (canonical_service auxiliar). Nada de texto livre.
- **Efeitos colaterais:** NENHUM (não cria needs; a escolha do organizador é POST futuro em Fase B impl).
- **Erros:** 400 sem contexto; 403 sem representação; 404 evento inexistente/sem formato.
- **Guard:** `audit-event-orchestration-templates` (§5).

## 5. Guards / mutações esperados (expandido — ratificado Clayton)

Guard `audit-event-orchestration-templates` deve FALHAR se:
1. template/need apontar para concept SEM `offer_kind='service'` (na v1). Mutação: inserir need não-service → FAIL.
2. template/need usar `category_id`, `slug` ou texto livre como necessidade (só `need_concept_id` FK).
3. `event_type` legado virar chave de template (chave = `format_concept_id`).
4. Step5OperationalRoles/EventNeedsWizard continuarem hardcoded DEPOIS da substituição (saem da allowlist
   do anti-hardcode → guard passa a morder regressão).
5. `orchestration_template_key` (string) for usado como AUTORIDADE.
6. `fulfillment_kind` fora de `EVENT_NEED_FULFILLMENT_KINDS`.
Cada vetor provado por mutação (FAIL na mutação, PASS ao restaurar) na implementação.

## 6. SEED PACK — decision pack (PROVA MATERIAL por query, 2026-07-08; ajustes ratificados por Clayton)

Regra: **não criar sinônimo genérico**; reusar só o concept real quando a semântica PROVAR que serve para
EVENTO. `limpeza-comercial` e `buffet` genérico REJEITADOS por prova (abaixo).

**PRONTOS (aceitos COM prova material — zero seed):**
| Necessidade | Concept | canonical (label) | domínio | service? |
|---|---|---|---|---|
| Segurança | `seguranca-eventos` | "Segurança de eventos" | servicos | ✅ |
| Cozinha | `cozinheiro` | "Cozinheiro" | servicos | ✅ |
| Garçom | `garcom` | "Garçom" | servicos | ✅ |

**REJEITADOS por prova semântica (não reusar por conveniência):**
- `limpeza-comercial` = canonical "Limpeza comercial" = limpeza de ESTABELECIMENTO/escritório, NÃO de evento.
  `faxina-residencial` = residencial. → NÃO usar nenhum p/ evento. **SEED `limpeza-de-eventos`.**
- `buffet` = sem canonical, não-service, ambíguo (pode ser restaurante/tema/label). → NÃO marcar o genérico.
  **SEED `buffet-para-eventos`** (necessidade operacional própria; cozinheiro/garçom são capabilities
  RELACIONADAS mas NÃO cobrem "buffet").
- `decoracao`/`fotografia` = domínio **educacao** (sentido "ensino/curso"), não serviço de evento.

**SEED MÍNIMO APROVADO (novos service concepts governados, se não existirem com este sentido):**
`buffet-para-eventos` · `decoracao-de-eventos` · `fotografia-de-eventos` · `limpeza-de-eventos`.
Cada um DEVE: existir em `concepts` (domain=servicos, via trigger de governança); receber `offer_kind='service'`;
ter canonical_service/label governado (se o service picker exigir); ter alias governado se aplicável; NÃO
duplicar concept existente (dedup provado); NÃO tocar Bank.

**FORA da v1 (ratificado — não entram como service por gambiarra):**
- Som/sonorização, iluminação → hoje = `caixa-de-som`/`torre-de-iluminacao` = PRODUTO/locável. Entram em fase
  futura com `fulfillment_kind='rentable'`, não como service.
- Transporte/frete → `mudanca-e-frete`/`motoboy`/`guincho` = MOBILIDADE (alinha c/ pendência motoboy).
- Música → `musica` = ASSUNTO (shared_subject), não serviço. (DJ/banda = service próprio, decisão futura.)
- Qualquer recurso locável.

## 6b. Templates v1 iniciais (conservadores — só concepts service válidos; SEM event_type legado)

Chave = `format_concept_id` (NÃO event_type). Só concepts service da lista PRONTOS+SEED. Exemplos propostos:
- **festa / casamento / celebração** → buffet-para-eventos, decoracao-de-eventos, fotografia-de-eventos,
  seguranca-eventos, limpeza-de-eventos, garcom, cozinheiro.
- **workshop / palestra / treinamento** → fotografia-de-eventos (opcional); segurança/limpeza só se fizer
  sentido; NÃO inventar som/iluminação na v1.
- **show / apresentação** → som/iluminação FICAM FORA da v1; segurança/fotografia/limpeza podem entrar (service).
`is_required` marca obrigatório vs sugerido; organizador confirma/remove. Nada é imposto.

## 7. Fases de implementação (só com GO, forward-only)

1. **Seed pack** (governado): concepts de serviço faltantes decididos na §6 + offer_kind='service'.
2. **Migration** `event_orchestration_template_items` + `event_operational_needs` (nomes §2).
3. **Seed dos templates** por formato (festa/campeonato/casamento… → needs concept_id).
4. **Contrato** em API_CONTRACT_GOVERNANCE.md + endpoint read-only de sugestões.
5. **Frontend:** Step5OperationalRoles + EventNeedsWizard UNIFICADOS numa tela que LÊ sugestões e declara por
   concept_id em `event_operational_needs`; remover listas hardcoded; tirar da allowlist do guard anti-hardcode.
6. **Guard + mutação.** Cada fatia com prova.

## 8. O que fica FORA da Fase B (STOP)

Fase C e além (só com decisão própria): RFQ×service_demands (unificação — RFC própria); propostas/quotes;
`source_event_id` em service_demands; Bank/preço/pagamento; agenda/booking; locação/produto como fulfillment
(extensão futura de `fulfillment_kind`); event_type legado como chave; need vocab paralelo; category como
identidade; texto livre como verdade.

## 9. Ratificação Clayton (2026-07-08) — RFC aceito COM ajustes; falta só o GO de implementação

- [x] Modelo: need → CONCEPT, v1 `fulfillment_kind='service'` **governado** (EVENT_NEED_FULFILLMENT_KINDS + CHECK/guard).
- [x] Nomes: `event_orchestration_template_items` + `event_operational_needs`.
- [x] `orchestration_template_key`: APOSENTADO como autoridade (autoridade por `format_concept_id`).
- [x] Seed pack §6: PRONTOS = seguranca-eventos/cozinheiro/garcom (provados). REJEITADOS por prova =
  limpeza-comercial (limpeza de estabelecimento) + buffet genérico. SEED = buffet-para-eventos,
  decoracao-de-eventos, fotografia-de-eventos, limpeza-de-eventos. FORA da v1 = som/iluminação (produto/
  locável), transporte/frete (mobilidade), música (assunto).
- [x] Contrato §4 do endpoint (entra em API_CONTRACT_GOVERNANCE.md ANTES do código).
- [ ] **GO para implementação forward-only** (fases §7) — ÚNICO item pendente.
