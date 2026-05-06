# RFC — Domínio `rides`: fronteiras, SSOT e governança transversal

**ID:** RFC-RIDES-DOMAIN-BOUNDARIES-v1  
**Estado:** `RASCUNHO` — **não** autoriza migrations nem alteração de código até revisão humana explícita e registo em `docs/03_execution_log/` quando a execução for ordenada.  
**Tipo:** contrato de domínio / integração (ficheiro em `docs/02_decisions/` — **não** é `docs/01_normative/`)

---

## Precedência normativa

1. `docs/01_normative/CONSTITUICAO_UNIFICARD.md` (Art. II — agenda como verdade de disponibilidade no sentido constitucional).  
2. `docs/01_normative/LEIS_OPERACIONAIS_UNIFICARD.md` (Lei 5 — SSOT financeiro; Lei 7 — CONCEPT; remissões).  
3. `docs/01_normative/LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` (§3.1.2 *event*; §3.2 SSOT; §3.3 core imutável tempo; §4.6–4.7 Bank; §4.9 Authority; §4.10 semântica transacional; §7 composição sistémica).  
4. `docs/01_normative/00_AGENT_PROTOCOL.md` (§2.2.2 prova; §2.3.2 GATE; §2.3.3 proibições estruturais; cadeia **Mutation → Estado → Dinheiro → Evento** onde aplicável).  
5. `docs/01_normative/07_NOMENCLATURA_CANONICA.md` — **§18.14** (produto / estoque / `concept_ref` / READY).  
6. `docs/01_normative/EVENT_OUTBOX_E_ENTREGA_CANONICO.md` (transação + `event_outbox` + idempotência).  
7. `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md` (quando o escopo tocar inventário ou catálogo cruzado).  
8. **Este RFC** — fixa fronteiras do módulo `backend/src/modules/rides/`; em conflito com (1)–(7), prevalecem os documentos de maior precedência.

---

## Prova de rastreabilidade normativa (bootstrap deste RFC)

| Pergunta do GATE (protocolo §2.3.2) | Resposta contratual deste RFC |
|-------------------------------------|--------------------------------|
| **Pilar afetado** (por âmbito) | **Estado** da corrida (pedido, atribuição, viagem); **dinheiro** apenas via Bank após tarifa; **tempo** via Agenda quando for verdade de agenda (não `is_online`); **evento** como efeito pós-commit; **semântica** quando o fluxo tocar produto/oferta/checkout; **authority** em mutações sensíveis. |
| **SSOT** | **Financeiro:** `bank_ledger` / UnifyBank (APIs do domínio Bank) — §4.6 Lei de coerência. **Temporal canónico:** Agenda / Unified Availability — Constituição Art. II; protocolo §2.2.2 (nomes concretos). **Semântica transacional:** `concept_ref` via encadeamento normado — Lei de coerência §4.10; nomenclatura §18.14. **Identidade:** `actors` (§4.8). **Authority:** fachada `authority.service` — §4.9.8. |
| **Duplicação de verdade** | **Proibido:** segundo ledger; agenda paralela; `concept_ref` fora do adapter; tratamento de `rides_ride_distributions` ou analytics como verdade financeira primária. |
| **Cadeia causal** | Ordem sistémica §7 Lei de coerência; subconjunto operacional do protocolo: mutação de estado persistido → dinheiro via Bank → publicação de efeito (outbox). **Semântica e authority** antes de operações que as exijam. |
| **Nova estrutura sem contrato** | **Proibido** criar tabelas `ride_*` genéricas que dupliquem `rides_ride_requests`, `rides_rides`, etc., **sem** anexo de schema a este RFC ou RFC filho aprovado (protocolo §2.3.3). |

---

## 1. Finalidade

Definir **contrato único** do que o módulo **`rides`** **é** e **não é**, de forma que qualquer PR, migration ou integração possa ser julgada contra **GATE normativo** sem reinterpretação.

## 2. Não-objetivos (explícitos)

- **Não** altera a Constituição, Leis ou ficheiros em `docs/01_normative/`.  
- **Não** substitui o `MAPA_CANONICO_PERMISSIONS_v1.md` — chaves `rides:*` existentes mantêm-se até alinhamento explícito.  
- **Não** dispensa uso do adapter de `concept_ref` (`concept-offer-refs.adapter.ts`, §4.10.1) em fluxos transacionais.  
- **Não** autoriza, por si só, **nova migration** — apenas **prepara** critérios para RFCs de schema subsequentes.

---

## 3. Definição do domínio `rides`

### 3.1 O que o `rides` **é** (permitido)

- **Orquestração de estado operacional** de mobilidade: pedido de corrida, ofertas/atribuição, execução da viagem, cancelamentos, eventos de domínio **persistidos** em tabelas `rides_*` já existentes no repositório.  
- **Política de tarifa** (estimativa e cálculo final **em centavos** na borda de apresentação/persistência de quote): valores como **proposta numérica** até o Bank materializar movimento.  
- **Estado operacional do motorista** (`is_online`, sessão, localização recente) **desde que** documentado e verificável que **não** substitui **reserva de agenda** nem resolve **conflito temporal canónico** (Constituição Art. II).

### 3.2 O que o `rides` **não é** (proibido como substituto de SSOT)

| Papel | SSOT / autoridade canónica | Proibição no `rides` |
|--------|----------------------------|----------------------|
| Verdade financeira canónica | Bank (`bank_ledger`, APIs Bank) | Inferir saldo; SQL direto em `bank_*` fora do Bank (§4.6); usar projeção como fonte primária de cobrança. |
| Agenda / disponibilidade de **booking** | Agenda / Unified Availability | Persistir ou decidir **janela canónica** de agenda no lugar do núcleo temporal. |
| Decisão de **authority** | `authority.service` (§4.9.8) | Substituir por **apenas** `requirePermission` em mutações sensíveis (§4.9.7). |
| `concept_ref` em fluxo transacional | Adapter §4.10.1 + encadeamento §4.10.2 | Resolver semântica por `categories.concept_id`, slug ou SQL ad hoc (§4.10.5; nomenclatura §18.14). |
| Efeito observável assíncrono | `event_outbox` + worker (documento outbox) | `eventBus.emit` como **destino final** sem plano de migração para outbox na mesma unidade transacional onde aplicável. |

---

## 4. Inventário factual — persistência já referenciada no código (`rides`)

*(Baseado em `backend/src/modules/rides/**/*.ts`; lista para **evitar** duplicar entidades com nomes novos sem mapeamento explícito.)*

Inclui, entre outras: `rides_ride_requests`, `rides_rides`, `rides_ride_stops`, `rides_ride_events`, `rides_request_offers`, `rides_drivers`, `rides_driver_sessions`, `rides_driver_availability`, `rides_driver_locations`, `rides_driver_destinations`, `rides_pricing_config`, `rides_surge_multipliers`, `rides_zones`, `rides_zone_incentives`, `rides_distribution_rules`, `rides_ride_distributions`, funções SQL `rides_find_nearby_drivers`, `rides_check_driving_limit`, `rides_calculate_realtime_earnings`, `rides_calculate_zone_pressure`.

**Regra:** qualquer RFC de schema que introduza `ride_requests` / `ride_trips` / nomes alternativos **deve** declarar **mapeamento 1:1** com estas entidades ou **deprecação formal** — não criação paralela silenciosa.

---

## 5. Pilar **tempo**

- **Permitido:** `is_online`, sessão de trabalho, destinos operacionais do motorista, **desde** que a equipa prove no PR que **não** há persistência de “slot de agenda canónico” nem resolução de conflito de agenda fora do núcleo Agenda / Unified Availability.  
- **Obrigatório (evolução):** integração de leitura/escrita de **disponibilidade canónica** conforme contratos do módulo Agenda, quando o produto exigir booking sobre o mesmo ator.  
- **Comentário de código:** os serviços `availability.service.ts` marcados como LEGADO devem ser tratados como **dívida explícita**; remoção ou substituição **só** com plano de transição documentado em `docs/03_execution_log/`.

---

## 6. Pilar **dinheiro**

- **Tarifa:** `calculateEstimatedPrice` / `calculateFinalPrice` (ou equivalentes) = **política de preço**; valores **em centavos** (`MoneyCents` / `asMoneyCents`) na persistência de quote quando existir.  
- **Materialização:** apenas via **`bankIntegrationService`** (ou sucessores no domínio Bank) — padrão já presente em `distribution.service.ts`.  
- **`rides_ride_distributions`:** classificação obrigatória: **projeção / histórico de negócio**, **NÃO SSOT** financeiro. Nenhuma decisão de saldo, reconciliação contábil ou “receita oficial” pode depender exclusivamente desta tabela.  
- **Analytics:** mesma regra — derivado; fonte de verdade financeira permanece o Bank.

---

## 7. Pilar **evento** (entrega)

- **Norma aplicável:** `EVENT_OUTBOX_E_ENTREGA_CANONICO.md` — `INSERT` em `event_outbox` **na mesma transação** que persiste mutação relevante, quando o efeito for assíncrono observável.  
- **Estado de transição:** um único ponto `publishRideEvent` (nome indicativo) pode encapsular `emit` **temporariamente**, desde que o PR declare **data limite** e **critérios de done** para migração para outbox.  
- **Proibido:** tratar bus como SSOT de estado (Lei de coerência §3.1.2).

---

## 8. Pilar **authority**

- **RBAC** (`requirePermission('rides:…')`) = **primeira barreira** HTTP — mantém-se.  
- **Mutações sensíveis** (aceitar corrida, cancelar com efeito financeiro, iniciar/completar pagamento, atuar em nome de actor não próprio): **obrigatório** chamar **`authority.service`** (ou API estável documentada) **antes** de mutar estado ou invocar Bank, em linha com §4.9.5 e §4.9.8.  
- **Proibido** (§4.9.7): apenas middleware sem decisão de domínio testável.

---

## 9. Pilar **semântica** (Lei 7 + §4.10 + §18.14)

Quando o fluxo `rides` tocar **produto**, **oferta**, **intent**, **checkout** ou persistência que exija **`concept_ref`**:

1. Encadeamento obrigatório: `product → canonical_products` (predicado **READY**) → `concept_id` → `concept_ref` — Lei de coerência §4.10.2; nomenclatura §18.14.  
2. Resolução **exclusiva** via adapter referenciado em §4.10.1 — **proibido** bypass.  
3. **Proibido** derivar `concept_ref` de `categories.concept_id` — nomenclatura §18.14 (*fonte proibida*); Lei 7.

---

## 10. Critérios de aceitação (para marcar este RFC como `APROVADO`)

- [ ] Owner humano assina aprovação (comentário no PR do RFC ou entrada em `docs/03_execution_log/`).  
- [ ] Equipe confirma inventário §4 contra `backend/migrations/` ou baseline aplicável (sem divergência não documentada).  
- [ ] Plano de outbox: issues ou subtarefas ligadas com dono e ordem (P0 emissões críticas).  
- [ ] Plano authority: lista fechada de rotas/serviços `rides` que passam a invocar `authority.service`.  
- [ ] Semântica: checklist de endpoints que disparam checkout/oferta e verificação de uso do adapter.

---

## 11. Próximos artefactos (fora do corpo normativo deste RFC)

- **Anexo A (opcional):** matriz ficheiro-a-ficheiro com colunas: Pilar | SSOT | Risco duplicação | Causalidade | Ação (manter / encapsular / remover).  
- **RFC filho (obrigatório antes de novas tabelas):** diff de schema com justificativa de não-duplicação face a §4 e §5 da Lei de coerência.

---

## 12. Frase de encerramento (para revisão)

> **O `rides` persiste e evolui o estado operacional da mobilidade; não governa ledger, agenda canónica, semântica transacional nem entrega de efeitos — estes pilares permanecem nos SSOT e serviços instituídos.**

---

**Fim do RFC (rascunho v1).**
