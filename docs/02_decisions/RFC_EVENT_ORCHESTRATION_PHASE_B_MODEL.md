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

- **`fulfillment_kind`** (coluna): governa o tipo de cumprimento da necessidade. v1 = CHECK aceita só
  `'service'`; extensão futura (`'rentable'`, `'product'`) por decisão própria — evita gambiarra e deixa a
  porta aberta sem abrir agora. (Alternativa mais rígida: sem a coluna, com comentário "só service nesta
  versão" — recomendo a coluna, é mais honesta sobre a intenção arquitetural.)
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

## 5. Guards / mutações esperados

- **Guard governado:** template/needs só aceitam `need_concept_id` com `offer_kind='service'` (v1); mutação:
  inserir need com concept não-service → FAIL. Frontend não pode ter lista local de needs/papéis (estende
  anti-hardcode; quando Step5/EventNeedsWizard forem substituídos, **remover da allowlist** e o guard passa a
  morder qualquer regressão). Mutação: reintroduzir lista hardcoded → FAIL.
- **event_type legado NÃO é chave:** guard morde se template/needs usarem event_type como chave de orquestração.
- Cada guard provado por mutação (padrão da casa) na implementação.

## 6. SEED PACK — decision pack (deduplicado contra o estado REAL do repo)

Estado verificado por query (2026-07-08). Regra: **não criar sinônimo genérico**; reusar o concept real.

| Necessidade | Concept REAL existente | domínio | offer_kind=service? | Decisão proposta |
|---|---|---|---|---|
| Segurança | `seguranca-eventos` | servicos | ✅ SIM | **PRONTO** (reusar; zero seed) |
| Limpeza | `limpeza-comercial` (e `faxina-residencial`) | servicos | ✅ SIM | **PRONTO** (usar `limpeza-comercial` p/ evento) |
| Comida/garçom | `cozinheiro`, `garcom` | servicos | ✅ SIM | **PRONTO** (reusar) |
| Buffet | `buffet` (existe, s/ canonical, s/ service) | servicos | ❌ | **DECISÃO:** marcar `buffet` como service (+canonical) OU cobrir por cozinheiro/garçom |
| Decoração | `decoracao` está em **educacao** (sentido "ensino") | educacao | ❌ | **SEED:** criar `decoracao-de-eventos` (servicos, service) — `decoracao(educacao)` é outro sentido |
| Fotografia | `fotografia` está em **educacao** | educacao | ❌ | **SEED:** criar `fotografia-de-eventos` (servicos, service) |
| Som/Iluminação | só `caixa-de-som`/`torre-de-iluminacao` = **PRODUTO/locável** | produtos | ❌ | **FORA da v1** (é locação de equipamento, não serviço) OU seed `sonorizacao-de-eventos`(service) — DECISÃO |
| Transporte/Frete | `mudanca-e-frete`, `motoboy`, `guincho` = **mobilidade** | mobilidade | ❌ | **FORA da v1** (trilho mobilidade, não service; alinha c/ pendência motoboy) |
| Música | `musica` = **assunto** (shared_subject) | educacao | ❌ | **FORA** (é tema/assunto, não necessidade-serviço; DJ/banda seria service próprio — decisão futura) |

**Resumo do seed:** PRONTOS = seguranca-eventos, limpeza-comercial, cozinheiro, garcom (4, zero seed). SEED
mínimo proposto = `decoracao-de-eventos`, `fotografia-de-eventos` (+ decisão sobre `buffet` e `sonorizacao-de-
eventos`). FORA da v1 = som/iluminação (locação de produto), transporte/frete (mobilidade), música (assunto).
Todo seed = ato governado (trigger de concept + offer_kind='service' + canonical label), deduplicado, sem
sinônimo genérico solto.

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

## 9. Decisões pendentes de Clayton (ratificar antes de código)

- [ ] Modelo: `fulfillment_kind='service'` (v1) com coluna extensível — OU sem coluna + "só service nesta versão".
- [ ] Nomes: `event_orchestration_template_items` + `event_operational_needs` (recomendados).
- [ ] `orchestration_template_key`: aposentar como autoridade (autoridade por format_concept_id).
- [ ] Seed pack §6: ratificar PRONTOS; decidir `buffet` (marcar vs cobrir por cozinheiro/garçom); aprovar SEED
  `decoracao-de-eventos`/`fotografia-de-eventos`; confirmar som/transporte/música FORA da v1.
- [ ] Contrato §4 do endpoint de sugestões.
- [ ] GO para implementação forward-only (fases §7).
