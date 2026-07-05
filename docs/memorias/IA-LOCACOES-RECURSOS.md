# IA-13 — Locações/Recursos

> RAIO X READ-FIRST · eixo Locações / Recursos alugáveis · Unificard
> Modo: auditoria macro+micro, sem correção, sem commit, sem código.

## 1. Carimbo

* **HEAD:** `aaeb50b5182120888a72418775a9d211e33bff4d`
* **Data/hora:** 2026-06-22
* **Git status:** branch `rescue-structural`; working tree com docs/memorias/* e artefatos `.png`/`.md`/`.txt` não-versionados (nenhum relacionado a rental; este relatório é o único arquivo criado por esta auditoria).
* **READ-ONLY confirmado:** SIM — nenhum arquivo de backend/frontend/migration/norma/decision/DT/status foi tocado. Nenhuma migration rodada. Nenhuma escrita no banco. Apenas leitura, grep, glob e `psql` read-only (colunas explícitas / `count(*)`, sem `SELECT *`).
* **Arquivo criado/atualizado:** `docs/memorias/IA-13-LOCACOES-RECURSOS.md` (criado).
* **Backend/frontend/schema/docs consultados:** módulo `services` (types/routes/repository/service/category-guard/discovery), `core/availability` (unified-availability repo/types), `core/navigation/module-registry`, `modules/marketplace` (offerings), `contracts/marketplace/ServiceResource.contract`, frontend `api/services`, `config/actorContextConfig`, páginas/serviços de marketplace; `docs/02_decisions/DECISION_0109_*`, `DECISION_0110_*`, `SELO_SERVICE_SALON_BANK_FREE.md`; relatório irmão `IA-10-MARKETPLACE-JORNADA.md`.
* **Comandos/probes usados:** `git rev-parse HEAD`; `git status --short`; `rg/grep` por ~60 termos (rental/locacao/aluguel/resource/asset/equipment/vehicle/room/reservation/availability/deposit/caucao/penalty/late_fee/price_cents/numeric/DECISION-0109/0110 etc.); `psql` em `unificard_dev`: lista de tabelas por padrão, `services_service_type_check`, `information_schema.columns` (services/availability/bookings/inventory_reservations), `pg_catalog` da função `detect_availability_conflicts`, `count(*)` de `services` por `service_type`.
* **Método:** 6 auditores read-only em paralelo (model-runtime · resource-entity · temporal-reservation-conflict · money-deposit · marketplace-frontend · cartório-decisões), evidência viva exigida em cada achado; síntese cruzada com IA-10.

## 2. Escopo

**Auditado (dentro do eixo):** existência material do modelo de locação; entidade de recurso alugável (owner/seller, status, quantidade, unidade, semântica); disponibilidade temporal de recurso; reserva; conflito/overlap por recurso; back-to-back; quantidade/estoque para locação; caução/preço/multa (contrato e tipos, **sem executar dinheiro**); retirada/devolução; superfície no marketplace e frontend; decisões de cartório que governam locação (DECISION-0109/0110).

**Fora (handoff, não aprofundado):** cadastro/auth, perfil/SSOT, actor model completo, autoridade global, empresa/PJ completa, semântica global completa, oferta/serviço completa, tempo/booking completo (exceto reutilização por locação), marketplace inteiro, produtos detalhados, assinaturas, ledger/split/payout/recovery, frontend inteiro, schema geral.

## 3. Mapa macro de locação

```
CONCEPT ─────────────► ENUM_ONLY   (locação não tem concept próprio; é só service_type='rental')
   │
   ▼
RECURSO LOCÁVEL ─────► NÃO_FECHA    (nenhuma entidade rental_resource/resource/asset/equipment)
   │
   ▼
OWNER / SELLER ──────► NÃO_FECHA    (sem coluna owner/seller em recurso porque não há recurso)
   │
   ▼
DISPONIBILIDADE ─────► NÃO_FECHA    (availability existe mas não tem owner_type rental; não-wired)
TEMPORAL                 (genérico: provider-keyed, não resource-keyed)
   │
   ▼
RESERVA ─────────────► NÃO_FECHA    (sem rental_reservation; bookings é por offering de serviço)
   │
   ▼
CONFLITO DE RECURSO ─► NÃO_FECHA    (overlap existe por provider_actor_id; função SQL é STUB vazio)
   │
   ▼
RETIRADA/DEVOLUÇÃO ──► NÃO_FECHA    (nenhum check-out/check-in/inspeção/dano)
   │
   ▼
CAUÇÃO / DINHEIRO ───► NÃO_FECHA / HOLD   (sem deposit_cents/penalty/late_fee; money em HOLD)
```

**Veredito do elo de entrada:** locação é **ENUM_ONLY** — a cadeia inteira está vazia abaixo do enum.

## 4. Matriz do eixo

| item | fecha/não-fecha | evidência viva | blocker | risco | próxima frente | modo |
|---|---|---|---|---|---|---|
| rental model | **ENUM_ONLY** | `services.types.ts:10-15` `RENTAL='rental'`; sem branch em `services.service.ts:143-160` | desenho ausente | médio | DECISION_RENTAL_MODEL | DECISION |
| rental schema | **NÃO_FECHA** | DB: 0 tabelas `rental*`; só `services_service_type_check` aceita 'rental' | substrato ausente | médio | rental tables | DECISION→MODO B |
| rental routes | **ENUM_ONLY (ghost)** | `services.routes.ts:18,37` aceita `rental`; POST→201 sem lifecycle | path fantasma | médio | DECISION | DECISION |
| rental frontend | **STUB** | `module-registry.ts:51` status=STUB `/em-desenvolvimento?feature=locacoes`; `actorContextConfig.ts:346` | placeholder honesto | baixo | UX pós-modelo | HOLD |
| rental resource | **NÃO_FECHA** | sem `rental_resources/resource/asset/equipment`; `ServiceResource.contract.ts:10` é p/ execução de serviço | entidade ausente | alto | resource model | MODO B |
| resource owner/seller | **NÃO_FECHA** | inexistente (não há recurso) | — | alto | resource model | MODO B |
| resource concept_id | **NÃO_FECHA** | locação sem concept; herda navegação de `services` | semântica ausente | médio | DECISION + HANDOFF_SEMANTICA | DECISION |
| category_id/domain | **RISCO** | `service-category-guard.ts:11,30` exime rental de governança ("fora desta fatia/DECISION-0109") | governança órfã | alto | DECISION | DECISION |
| availability temporal | **NÃO_FECHA** | `availability` sem owner_type rental; 48 linhas todas owner_type='user' | não-wired | médio | MODO B temporal | MODO B |
| reservation | **NÃO_FECHA** | `bookings` FK→availability/offering; `event_reservations`/`inventory_reservations` são outros domínios | reserva ausente | alto | MODO B reservation | MODO B |
| overlap conflict | **NÃO_FECHA** | `unified-availability.repository.ts:360-410` chave=provider_actor_id, não resource_id | conflito por recurso ausente | alto | DECISION conflito | DECISION |
| back-to-back | **N/A (correto p/ serviço)** | repo:384-385 `start < end AND end > start` (half-open, [start,end)) | — | baixo | reusar semântica | — |
| quantity/unit | **NÃO_FECHA** | `availability.capacity` existe mas **não validado** no confirm de booking | overbooking | alto | MODO B quantity | MODO B |
| deposit/caução | **NÃO_FECHA** | sem `deposit_cents` em qualquer tabela | dinheiro ausente | médio | HANDOFF_DINHEIRO | HOLD |
| price_cents | **N/A** | `services.price_cents BIGINT` único; uniforme p/ todo service_type | — | baixo | — | — |
| NUMERIC/decimal | **NÃO (limpo)** | 0 colunas NUMERIC/DECIMAL em services/bookings/availability money | — | baixo | — | — |
| return/check-in/out | **NÃO_FECHA** | nenhum fluxo de retirada/devolução/inspeção | operação ausente | médio | HANDOFF_LOGISTICA | MODO B |
| marketplace rental card | **NÃO_FECHA** | template `property-rental` só in-memory `marketplace-offerings.service.ts:64`, nunca persistido/consumido (dead code) | card ausente | baixo | HANDOFF_MARKETPLACE | MODO B |
| dinheiro fora/HOLD | **HOLD (ok)** | `service-payment-*` não ramifica por service_type; 0 chamada rental→ledger | — | baixo | HANDOFF_DINHEIRO | HOLD |
| DECISION-0109 | **DEFERRED** | `SELO_SERVICE_SALON_BANK_FREE.md:59` "(event/job/rental fora da DECISION-0109)"; D4 bloqueia booking/payment | bloqueio normativo | alto | DECISION | DECISION |
| DECISION-0110 | **DEFERRED** | `DECISION_0110:1-30` só Track B salão; sem política financeira de rental | bloqueio normativo | alto | DECISION | DECISION |
| testes existentes | **AUSENTE** | nenhum teste `rental*`/locação no backend | sem cobertura | baixo | pós-modelo | — |

## 5. Achados críticos

### RENTAL-01 — Locação é ENUM_ONLY (enum sem substrato)
* **Descrição:** `ServiceType.RENTAL='rental'` é aceito em rotas e no `CHECK` do banco, mas cria uma linha `services` idêntica a qualquer outra. Nenhum caminho lê `service_type='rental'` para fazer algo distinto.
* **Evidência viva:** `services.types.ts:10-15`; `services.service.ts:143-160` (só `=== ServiceType.SERVICE` ramifica canonical/elegibilidade); `services.repository.ts:159`; `services_service_type_check = ARRAY['service','rental','event','job']`.
* **Impacto:** locação não existe como produto; é rótulo.
* **Bloqueia MTP?** NÃO (não é vertical MTP). **Bloqueia público?** NÃO. **Bloqueia dinheiro?** NÃO. **Exige DECISION?** SIM. **Exige YALA?** NÃO (read-first). **Modo:** DECISION. **Handoff:** IA-DECISOES-DT.

### RESOURCE-01 — Não existe entidade "recurso alugável"
* **Descrição:** zero tabelas `rental_resources/resource/asset/equipment/vehicle/room`. `inventory_reservations` é variante de produto; `media_assets` é conteúdo; `ServiceResource.contract.ts:10` (`individual_provider|company_professional|equipment|facility`) modela recurso de **execução de serviço**, não item locável autônomo.
* **Impacto:** sem recurso não há owner/seller, status, quantidade, unidade, localização nem semântica de locação.
* **Bloqueia MTP?** NÃO. **Público?** NÃO. **Dinheiro?** NÃO. **DECISION?** SIM. **Modo:** MODO B (após DECISION). **Handoff:** IA-OFERTA / IA-PRODUTOS-ESTOQUE (para decidir reuso vs entidade própria).

### RENTAL-TIME-01 — Disponibilidade não tem owner_type de recurso e não está wired
* **Descrição:** `availability` tem `start_datetime/end_datetime TIMESTAMPTZ` e `capacity`, mas `owner_type` não inclui recurso de locação; 48 linhas, todas `owner_type='user'`. Locação não consome availability/bookings.
* **Evidência:** `migrations/...create_unified_availability_tables.sql`; `unified-availability.types.ts:76` (`capacity?`).
* **Impacto:** locação sem calendário por recurso.
* **DECISION?** SIM (reusar availability com novo owner_type vs calendário próprio). **Modo:** MODO B. **Handoff:** IA-TEMPO.

### RENTAL-CONFLICT-01 — Conflito é por provider, não por recurso; e a função de detecção é STUB vazio
* **Descrição:** overlap em `confirmBookingWithProviderLock` chaveia em `provider_actor_id` (não `resource_id`), com `pg_advisory_xact_lock` e intervalo half-open `[start,end)` (back-to-back **não** conflita — correto p/ serviço). Mas `detect_availability_conflicts(...)` no banco é **`BEGIN RETURN; END;`** (retorna vazio); e `capacity` **não é validado** no confirm → overbooking possível.
* **Evidência:** `unified-availability.repository.ts:360-410, 384-385, 298-349, 771-810`; `pg_catalog` `prosrc='BEGIN RETURN; END;'`.
* **Impacto:** mesmo se locação reusasse o guard, ele protege o provider, não o recurso; locação precisa de exclusão **por recurso** + capacidade.
* **DECISION?** SIM (modelo de conflito de recurso). **Modo:** DECISION→MODO B. **Handoff:** IA-TEMPO.

### RENTAL-MONEY-01 — Sem dinheiro de locação; tipos limpos; HOLD respeitado
* **Descrição:** sem `deposit_cents/daily_rate_cents/hourly_rate_cents/penalty_cents/late_fee_cents`. `services` tem só `price_cents BIGINT`. **Zero** colunas NUMERIC/DECIMAL em services/bookings/availability. `service-payment-*` não ramifica por `service_type`; nenhuma chamada rental→`bank_ledger`/`payment_intent`. 0 linhas em `services`.
* **Impacto positivo:** invariante cents/BIGINT preservado; dinheiro de locação corretamente ausente sob HOLD.
* **Risco futuro:** se ativarem rental sem modelo próprio, a booking de rental cairia no mesmo trilho de pagamento do serviço (preço fixo), sem caução/multa.
* **DECISION?** SIM (modelo financeiro de locação). **Modo:** HOLD/MODO C. **Handoff:** IA-DINHEIRO.

### RENTAL-MARKET-01 — Template de marketplace existe só em memória (dead code) e card não existe
* **Descrição:** `getServiceTemplates()` retorna um template `property-rental` hardcoded num `Map`, nunca persistido nem consumido por criação/descoberta. Marketplace não renderiza card de locação; `getServiceTypeLabel('rental')→'Aluguel'` rotula mas a UI é genérica (sem calendário/período/caução/devolução).
* **Evidência:** `marketplace-offerings.service.ts:64`; `ServiceDetailPage.tsx:53`, `ServicesListPage.tsx:63`; `actorContextConfig.ts:346`; `module-registry.ts:51`.
* **Impacto:** expectativa falsa potencial; hoje o placeholder é honesto (`/em-desenvolvimento`).
* **Modo:** MODO B (pós-modelo). **Handoff:** IA-MARKETPLACE-JORNADA, IA-FRONTEND-UX-CONTRATOS.

### DECISION-RENTAL-01 — Locação é governança-órfã: deferida, não bloqueada por desenho, mas sem trilho próprio
* **Descrição:** DECISION-0109 governa apenas `service_type='service'`; rental/event/job estão "fora da DECISION-0109". `service-category-guard.ts:11,30` exime rental de validação de ramo/categoria. DECISION-0110 (financeiro) também não cobre rental. **Nenhum DT** aberto para rental — apenas "fora desta fatia", sem critério de convergência.
* **Evidência:** `SELO_SERVICE_SALON_BANK_FREE.md:59`; `DECISION_0109:52-86` (D4 bloqueia booking/order/payment/Bank); `DECISION_0110:1-30`.
* **Impacto:** o enum existe sem framework de autoridade, ponte de categoria ou política financeira; criar rental hoje fura governança de categoria por early-return.
* **DECISION?** SIM (é o achado-raiz). **Exige YALA?** SIM quando houver desenho a selar. **Modo:** DECISION. **Handoff:** IA-DECISOES-DT.

## 6. Gaps de conexão

* **Semântica ↔ locação:** locação não tem `concept_id` próprio; herda navegação de `services`. Sem ponte concept→recurso locável.
* **Recurso ↔ tempo:** não há entidade de recurso para ancorar disponibilidade; availability é provider/user-keyed.
* **Tempo ↔ conflito:** guard de overlap é por provider; falta exclusão por `resource_id` + capacidade; função SQL de conflito é stub vazio.
* **Reserva ↔ estado:** sem máquina de estados de locação (requested/confirmed/checked_out/returned/overdue/damaged).
* **Marketplace ↔ modelo:** template `property-rental` em memória nunca conectado a criação/descoberta.
* **Locação ↔ dinheiro:** sem caução/multa; trilho de pagamento não distingue rental de serviço.
* **Enum ↔ governança:** `services.routes` aceita `rental` mas o guard de categoria o ignora → path fantasma sem ramo.

## 7. Handoffs para outras IAs

* **IA-SEMANTICA:** definir se locação ganha `concept_id`/domínio próprio ou reusa taxonomia de serviço; ponte concept→recurso locável.
* **IA-OFERTA:** decidir se recurso locável é entidade própria, produto adaptado (inventory) ou offering adaptado; relação com `ServiceResource.contract`.
* **IA-PRODUTOS-ESTOQUE:** quantidade/unidade/serialização de itens locáveis (recurso único vs múltiplas unidades) — interface com inventory.
* **IA-TEMPO:** disponibilidade por recurso (novo `owner_type` em availability vs calendário próprio); conflito por `resource_id`; capacidade; janela de buffer (limpeza) via bounds.
* **IA-MARKETPLACE-JORNADA:** jornada de locação ponta-a-ponta (card, filtro por período, seleção de intervalo, reserva); destino do template `property-rental` em memória. (IA-10 já fez handoff explícito para cá.)
* **IA-FRONTEND-UX-CONTRATOS:** manter `/em-desenvolvimento?feature=locacoes` honesto até o modelo existir; desenhar calendário/período/caução/devolução quando LIVE.
* **IA-DINHEIRO:** modelo financeiro de locação (deposit/daily_rate/hourly_rate/penalty/late_fee em *_cents BIGINT; caução→escrow/refund) — permanece HOLD.
* **IA-LOGISTICA:** fluxo de retirada/devolução/inspeção/dano (check-out/check-in), se locação envolver bem físico.
* **IA-AUTORIDADE / IA-EMPRESA-PJ:** quem pode criar recurso locável (PF/PJ), derivação server-side de owner/seller, isolamento de tenant — não aprofundado aqui.
* **IA-DECISOES-DT:** abrir DT/Decisão de governança de locação após selo do Track B salão (categoria/ramo + política financeira + modelo de recurso/conflito).

## 8. Riscos para MTP

* **Bloqueia MTP?** **NÃO.** Locação não é vertical do MTP (serviço é; ver IA-10). É contida em STUB e não está na navegação viva.
* **Não bloqueia, mas deve ser corrigido:** o path fantasma `POST /services serviceType='rental'` (201 sem lifecycle, sem ramo) — risco de criação silenciosa; idealmente rejeitar `rental` até existir modelo (decisão, não ação agora).
* **V2:** modelo de recurso locável, disponibilidade por recurso, reserva período-based, conflito por recurso, caução/devolução, card de marketplace.
* **Cleanup:** template `property-rental` em memória (dead code) — decidir remover ou conectar.
* **Exige decisão de produto/arquitetura:** tudo acima — locação é decisão-dependente, não executora-autônoma.

## 9. Riscos para público e dinheiro

* **Blockers antes de público:** nenhum específico de locação (locação está fora da navegação viva; placeholder honesto). O único cuidado é não expor `/em-desenvolvimento` como funcional.
* **Blockers antes de dinheiro:** DECISION-0109 D4 e DECISION-0110 mantêm booking/order/payment/Bank bloqueados; locação não tem política financeira própria → **não ativar dinheiro de locação** antes de DECISION dedicada.
* **Blockers de recurso:** ausência total de entidade de recurso locável (RESOURCE-01).
* **Blockers de conflito temporal:** conflito por provider, não por recurso; função SQL stub; capacidade não validada (RENTAL-CONFLICT-01).
* **Blockers de caução:** sem `deposit_cents`/escrow/refund (RENTAL-MONEY-01).
* **Blockers que exigem DECISION:** modelo de locação, recurso/conflito, política de caução (DECISION-RENTAL-01).
* **Blockers que exigem MODO C:** ponte financeira de locação (deposit/penalty→ledger/escrow) — futuro.
* **Permanece HOLD:** todo o dinheiro de locação (caução, multa, pagamento, repasse).

## 10. Veredito final

**ENUM_ONLY.**

Locação existe apenas como valor de enum `ServiceType.RENTAL='rental'` aceito em rota e `CHECK`, sem entidade de recurso, sem disponibilidade por recurso, sem reserva, sem conflito por recurso, sem caução/devolução e sem card de marketplace. A cadeia CONCEPT→RECURSO→OWNER→TEMPO→RESERVA→CONFLITO→DEVOLUÇÃO→CAUÇÃO está vazia abaixo do enum. Invariantes de dinheiro (cents/BIGINT, sem NUMERIC, HOLD) e de tempo (half-open `[start,end)`) estão limpos no substrato genérico, mas nada disso está conectado a locação. Governança é **órfã/deferida**: DECISION-0109/0110 excluem rental explicitamente, sem DT nem critério de convergência.

## 11. Próxima frente recomendada

**Modo: DECISION → `DECISION_RENTAL_MODEL`.**

Justificativa: locação não é gap de implementação que a executora possa fechar sozinha — é gap de **decisão soberana**. Antes de qualquer MODO B (recurso, temporal, reserva, marketplace) é preciso uma DECISION que defina:
1. **Recurso locável** = entidade própria vs produto/inventory adaptado vs offering adaptado;
2. **Semântica** = `concept_id`/domínio próprio vs reuso;
3. **Temporal/conflito** = reuso de `availability` com novo `owner_type` por recurso + exclusão por `resource_id` + capacidade vs calendário próprio;
4. **Caução/financeiro** = modelo de deposit/daily_rate/penalty em cents + escrow/refund (permanece HOLD até promulgação);
5. **Governança** = ponte de categoria/ramo (hoje exime rental) e quem pode criar recurso (PF/PJ, autoridade server-side).

Sequência sugerida (não-vinculante, insumo): `DECISION_RENTAL_MODEL` → `MODO_B_RENTAL_RESOURCE_MODEL` → `MODO_B_RENTAL_TEMPORAL_MODEL` (+ conflito por recurso) → `MODO_B_RENTAL_RESERVATION` → `MODO_B_RENTAL_MARKETPLACE` → `MODO_C_RENTAL_MONEY_BRIDGE` (pós-HOLD). Não iniciar antes do selo do Track B salão.

## 12. Resumo executivo

* Locação = **ENUM_ONLY**: só `ServiceType.RENTAL='rental'`; cria linha `services` genérica, sem comportamento próprio.
* **Zero** tabelas de recurso/reserva de locação no banco; `services` tem 0 linhas; navegação marca `rentals` como **STUB** (`/em-desenvolvimento?feature=locacoes`).
* **Nenhuma entidade de recurso alugável** (owner/seller, status, quantidade, unidade, semântica) — `ServiceResource.contract` é para execução de serviço, não item locável.
* Disponibilidade/conflito existem só no trilho genérico: chave por **provider**, não por recurso; função `detect_availability_conflicts` é **stub vazio**; `capacity` **não validado** (overbooking possível). Back-to-back `[start,end)` correto.
* Dinheiro de locação **ausente** e em **HOLD**: sem `deposit_cents`/penalty/late_fee; cents/BIGINT limpos; **zero NUMERIC**; sem chamada rental→ledger.
* Marketplace: template `property-rental` existe **só em memória** (dead code), nunca persistido; sem card; rótulo "Aluguel" sobre fluxo genérico.
* Path fantasma: `POST /services` aceita `rental` (201) mas sem lifecycle e o guard de categoria o **exime** (early-return) → criação sem ramo.
* Cartório: DECISION-0109/0110 **excluem rental explicitamente**; governança **órfã/deferida**, **sem DT** e sem critério de convergência.
* **Não bloqueia MTP nem público** (contido em STUB); **não deve tocar dinheiro** antes de DECISION dedicada.
* **Veredito: ENUM_ONLY · Próxima frente: DECISION_RENTAL_MODEL** (locação é decisão-dependente, não executora-autônoma).

---
*Auditoria read-first concluída. Nenhum código/runtime/dinheiro/migration tocado. Nenhum commit. Nenhuma frente aberta.*
