# MINHA MEMÓRIA — IA-LOGÍSTICA (Fluxo Transversal / Cascata / Viabilidade)

> Instância READ-ONLY sob coordenação da IA-DIRETORA. Dona de NENHUM SSOT — leio vários, raciocino sobre o FLUXO. Especialista de domínio da futura MACRO 5 (engine de orquestração). Append-only. Disco vence narrativa.

## Identidade e travas (permanente)
- **Eixo:** "qual é o próximo passo coordenado — quem, quando, onde, em que ordem — e é factível dentro das blindagens?"
- **Trava de coerência:** evento REGISTRA, nunca CAUSA. Cascata = módulo emite TRANSIÇÃO DE ESTADO → eu LEIO e PROPONHO o próximo passo → humano confirma → só então muta estado e, depois, financeiro.
- **Blindagens:** presença HABILITA, não credita · money não pega carona (liquidação é da IA-DINHEIRO, a jusante) · eu filtro/ordeno/sequencio/PROPONHO, NUNCA cravo fornecedor final nem disparo mutação · substrato físico = gate-on-materialization (não "fecho" recurso físico sem DECISION + macro próprias).
- **Escrita permitida:** somente §14.11 do PLANO_ORQUESTRACAO_SISTEMICA_UNIFICARD.md + este arquivo.

---

## 2026-06-20 — RODADA 1 (re-baseline) · HEAD vivo `dd270f41` / branch `rescue-structural` (revalidado de 1ª mão)

### ACHADO MATERIAL: premissa "greenfield 0 tabelas" do plano está STALE
O plano §2 declara substrato físico (transporte/rotas/recursos/entrega) = GREENFIELD (0 tabelas). **O disco vivo contradiz.** Existe domínio `rides` (mobilidade) completo, no caminho de migrations VIGENTE (não-archive) e runtime-wired:

**Schema (migrations `2026-05-30…`):**
- `rides_drivers`, `rides_vehicles` — `backend/migrations/20260530350000_rides_core.sql:3,20` (recursos físicos: categoria, capacidade, aprovação/verificação).
- `rides_cities`, `rides_zones` (`polygon JSONB` + `area_m2` = zona/roteamento), `rides_service_types` (`base_fare_cents`/`price_per_km_cents`/`price_per_min_cents`) — `20260530360000_rides_requests.sql:3,14,25`.
- `rides_ride_requests` (`origin`/`destination`/`stops` JSONB = rota; `estimated_distance_m`/`estimated_duration_s`), `rides_rides` (rota real + `fare_cents`/`driver_amount_cents`/`platform_amount_cents`/`fund_amount_cents` + `bank_transaction_id`→`bank_transactions`) — `20260530360000_rides_requests.sql:38,61`.
- `rides_driver_locations`, `rides_driver_sessions`, `rides_pricing_config` — `20260530370000_rides_operational.sql:3,14,26`.
- `rides_distribution_rules`, `rides_ride_distributions` (dispatch AUTOMÁTICO) — `20260530390000_rides_distribution.sql`. `rides_referral_*` — `20260530380000_rides_referral.sql`.
- Patch: `20260523100000_rides_vehicles_concept_id_nullable.sql`.

**Runtime:** 20 arquivos em `backend/src/modules/rides/**` (availability, demand, distribution, drivers, location, ride-requests, rides, zones, pricing, lifecycle, safety, analytics) + `core/city/city-readiness`.

**Caveats honestos:**
- São arquivos de migration no caminho vigente; se APLICADAS no banco vivo (`schema_migrations`) = prova-viva runtime fora do meu alcance read-only → INCONCLUSIVO, encaminhar IA-BANCO-DE-DADOS.
- `rides` = transporte DE PESSOAS (ride-hailing), vertical silado; NÃO cobre entrega-de-bens / booking-de-recurso genérico da cascata. Cobertura PARCIAL: "greenfield=0" é falso, mas "logística resolvida" também seria.

### MAPA DE ACOPLAMENTO DO FLUXO (SSOT que leio × dono × existência no disco)
| Passo | Pergunta | SSOT | Dono | Disco |
|---|---|---|---|---|
| 1 SEMÂNTICA | precisa do quê? | `concepts`, `concept_relations` | IA-SEMANTICA | `0069_concepts.sql:12`, `0076_concept_relations.sql:10` ✓ |
| 2 DESCOBERTA | quem faz? | `services` | IA-OFERTA | `20260418120000_services_table_core.sql` ✓ |
| 3 CONTRATAÇÃO | qual pacote? | `service_offerings`, `company_concept_publications`, `tenant_concept_offerings`(read-model) | IA-OFERTA | `20260611180000…`✓ `20260604140000…:23`✓ `0072…:9`✓ |
| 4 TEMPO | quando/livre? | `unified_availability`(`owner_type='service_offering'`,0132), `unified_bookings` | IA-TEMPO | ALTERs `20260530509000…`/`20260616120100…` ✓ |
| 5 AUTORIDADE | pode? | `actors`, `canRepresentActor`, `actor_capability_grants`, gate 0110/R7b | IA-ACTOR / IA-AUTORIDADE | `0002_identity.sql:19`✓ `20260616210000…:29`✓ |
| 6 AFUNILAMENTO | raio/reputação/preço/fee | reputação read-model; `economic_policy_engine`(bps); região | IA-DINHEIRO / IA-BANCO | ✓ |
| 7 ESTADO | humano escolhe | `service_booking_decisions`→`service_order` | IA-COMERCIO | `20260530494000…:3`✓ `20260530555000…`✓ |
| 8 FINANCEIRO | liquida (jusante) | `bank_ledger`, `bank_splits`, `bank_transactions` | IA-DINHEIRO | `0003_bank_core.sql:67,83` ✓ |
| 9 EVENTO | registra, não causa | feed/notificações (projeção) | eventos | projeção |
| ONDE | jurisdição | `addresses`, `address_assignments`, countries→neighborhoods | IA-BANCO/localização | `20260530518000…` ✓ |
| FÍSICO | rota/recurso/entrega | **`rides_*` (existe!)** + entrega genérica (ausente) | revisar (não-greenfield) | `rides_*` ✓; aplicação INCONCLUSIVO |

### RISCOS sinalizados (não decididos)
- 🔴 **Auto-escolha já existe:** `rides_distribution_*` = dispatch automático (sistema escolhe motorista) → colide com Blindagem 2 (§7 "nunca cravar fornecedor final"). Se MACRO 5 generalizar a partir de `rides`, herda a auto-escolha. Fronteira necessária: "auto-dispatch é exceção de mobilidade, não padrão da cascata".
- 🟠 **Fee-truth paralela:** `rides_service_types` tem preço próprio; `rides_rides` calcula platform/fund SEM `economic_policy_engine` aparente → IA-DINHEIRO.
- 🟠 **Money por carona / evento-causa:** `rides_rides.bank_transaction_id` liga corrida↔bank direto; se conclusão DISPARA liquidação, fere "evento registra, não causa" → INCONCLUSIVO, IA-DINHEIRO/IA-BANCO.
- 🟡 **Risco invertido:** o clássico do meu eixo é "recurso inexistente tratado como existente"; aqui é o oposto — MACRO 5 pode criar rota/recurso PARALELO a `rides_*` por desconhecê-lo (fragmentação §3).

### Recomendação à IA-DIRETORA
Corrigir §2: de "greenfield 0 tabelas" para "substrato físico PARCIAL existe (`rides_*`, vertical de mobilidade silado); engine transversal de rota/recurso/entrega permanece NÃO-decidida (MACRO 5) e deve CONVERGIR, não duplicar".

### Dúvida aberta (registrada em §14.11.1)
Status de `rides`: vivo / tombstone / protótipo? Muda se MACRO 5 converge sobre ele ou o isola. Revalidar só sob tarefa explícita.
