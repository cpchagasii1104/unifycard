# MINHA MEMÓRIA BANCO DE DADOS

> **Protocolo de uso:** esta memória é insumo operacional, **não norma soberana**. Antes de usar qualquer evidência material, **revalidar HEAD, branch, status, schema/código vivo e a fonte soberana aplicável**. Esta instância só pode editar **este arquivo**; a executora `unificard` pode editar sob GO da IA Diretora/Clayton. Protocolo completo: `docs/memorias/README.md`.

> Instância permanente **IA-BANCO-DE-DADOS** do projeto Unificard / UnifyBank.
> Este arquivo é a ÚNICA escrita permitida a esta instância.
> Última atualização: **2026-06-22** (19ª: RAIO X IA-17 Banco/Schema/Gates/Cartório — HEAD **`aaeb50b5`**; relatório em `docs/memorias/IA-17-BANCO-SCHEMA-GATES-CARTORIO.md`; VEREDITO **FECHA_COM_RISCO** / **HOLD_FINANCEIRO**; headline = **RLS-THEATRE** (runtime=postgres superuser/bypassrls → 62 tab/78 pol inertes; unificard_app NOLOGIN; preflight não-wired); drift migration=0 (400=400); cartório CONTRADITA (hardening "NOT LIVE" × aplicada id 398/inerte); bank_splits MUTÁVEL; 7 money RLS-off; payout dupla-verdade; booking sem conflict-guard; gates só-regex-código; dinheiro=BIGINT/0-NUMERIC/TIMESTAMPTZ OK).

> Histórico (18ª): F-OFFER-5/6 EXECUÇÃO read-first — HEAD **`891dfa87`**; DECISION-0146 promulgada; **bookings status CHECK = 6 vivos**, bloqueantes {confirmed,checked_in,checked_out} EXISTEM/inequívocos (G4 sem STOP); provider DERIVÁVEL via booking→availability.owner_id→service_offerings.provider_actor_id (G9 ✓, sem coluna crua); rollup viável, índices do chain presentes (falta só 1 opcional em bookings status); `pg_advisory_xact_lock` disponível = lock per-provider no CONFIRM (FOR UPDATE insuficiente p/ phantom; EXCLUDE proibido §A.7); bookings=0/avail offer=0 virgem; VEREDITO **PASS_PARA_GO**, execução MODO C sob ciclo).

> Histórico (17ª): F-OFFER-5 prova-viva substrato temporal — HEAD vivo **`bca473fa`**; owner_type CHECK 6 tipos fail-closed aplicado; **owner_id SEM FK** (polimórfico); **ZERO trigger/EXCLUDE/gist** + detect_availability_conflicts STUB ⇒ garantia de overlap AUSENTE no banco; availability=48 todas owner='user', service/service_offering=0×0; VEREDITO **PASS_PARA_DECISAO** — mecanismo de overlap constrangido por Constituição Art. II (detector+alerta, NÃO EXCLUDE-hard-block) → IA-TEMPO decide).

> Histórico (16ª): F-OFFER-4 prova-viva re-key por concept_id — HEAD vivo **`f6c07742`**, schema_migrations=**400** drift=0; **F-OFFER-2A+F-OFFER-3 FORAM EXECUTADAS** (migrations 20260621100000/120000) → `services.canonical_service_id` agora **NOT NULL** (era NULLABLE em F-OFFER-2; pré-estado superado); cadeia `services.canonical_service_id→canonical_services.concept_id` = NOT NULL+FK RESTRICT+índice nas 2 pontas, JOIN index-only sem seq scan; categories.concept_id só em folha level=2 (70/147 NULL by design); discrepância ~200 = **erro do 1º elo** (services=0, nenhum objeto ~200; n_live_tup STALE→usar count(*)); VEREDITO **PASS_PARA_GO**; usei workflow ultracode + reconfirmei 1ª mão o que contrariava meu estado).

> Histórico (15ª): F-OFFER-3 prova-viva schema `service_offerings` — HEAD vivo **`74a04819`**; F-OFFER-2 virou **DECISION-0144**; oferta vazia; espinha preço/dur/status JÁ constrangida (price_cents BIGINT CHECK≥0·duration>0·status enum·modality enum·UNIQUE provider+canonical); `service_id` NULLABLE+SET NULL+nunca populado (bypass 2B, mandatório=grátis 0 linhas); **buraco company_id CONFIRMADO** (SET NULL, NENHUMA constraint p/ provider); provider_actor_id=RESTRICT+NOT NULL âncora; VEREDITO PASS_PARA_GO_DE_DECISAO).

---

============================================================
RAIO X IA-17 — Banco/Schema/Gates/Cartório · IA-BANCO
Tipo: insumo READ-ONLY append-only (workflow ultracode de apoio + reconfirmação 1ª mão dos headlines; NÃO migration/patch/GO)
Data: 2026-06-22 · HEAD vivo `aaeb50b5` · unificard_dev · relatório: docs/memorias/IA-17-BANCO-SCHEMA-GATES-CARTORIO.md
============================================================
- ESCOPO: auditoria macro+micro do banco (migrations/tipos/constraints/FK/índices/RLS/grants/financeiro/identidade/semântica/tempo/comércio/código/gates/cartório). Permissão de escrita = só o relatório IA-17. Usei Workflow (11 auditores READ-ONLY) e reconfirmei de 1ª mão os achados que contradiziam o cartório.
- ESTADO VIVO: HEAD aaeb50b5; schema_migrations=400 = disco 400 (comm diff vazio) → DRIFT=0; 272 tabelas public; 62 tabelas RLS + 78 policies; 4 extensões.
- HEADLINE RLS-01 (RLS-THEATRE): DATABASE_URL=postgres (rolsuper=t, rolbypassrls=t, is_superuser=on) → toda RLS inerte em runtime. unificard_app (NOSUPER/NOBYPASS, grants mínimos) = rolcanlogin=FALSE; app_role login mas 0 grants. runDbRoleRlsPreflight só no validate-script, NÃO no boot. Defesa real do bank_ledger = triggers append-only (no_update/no_delete/non_negative) — bypassáveis por superuser.
- CARTORIO-DB-01: cartório (STATUS/REMEDIATION) diz F-DB-ROLE-AND-RLS-HARDENING CLOSED/NOT-LIVE-IN-DEV/drift=1; VIVO = migration 20260620120000 (id 398) APLICADA, RLS instalada, drift=0, mas inerte. CONTRADITA/STALE. ⚠️ "migration 395 RLS" do brief = confusão: id 395 = rename_amount_to_amount_cents; a RLS é id 398.
- FINANCEIRO (HOLD): bank_splits MUTÁVEL (só validate_total, sem no_update/no_delete); 7 money RLS-off (payment_intents, payment_transactions, payout_requests, bank_settlements, ledger_snapshots, service_payment_requests, treasury_split_executions); payout dupla-verdade (payout_requests thin × actor_wallet_payout_requests forte); bank_transactions/wallets/recovery sem trigger imutabilidade. amount_cents=BIGINT em 101/101; 0 NUMERIC monetário; TIMESTAMPTZ 100%.
- TEMPO: bookings/availability/schedule_slots SEM unique/EXCLUDE conflict-guard E sem start<end CHECK → double-booking só app-enforced (grátis, bookings=0). unified_availability AUSENTE (SSOT=availability).
- CONSTRAINT/FK: valor/enum forte (amount>0, bps[0,10000], intervalos em events/service_orders/passes); 35 tabelas sem FK (actor_debts/actor_delegations/payout_requests/bank_settlements/treasury_split_executions/governance_financial_actions); 297/619 FK sem índice líder.
- GATES: 81 audit-*.mjs + 3 em CI, mas 100% regex de CÓDIGO (readFileSync) — ZERO consulta a schema vivo; RLS/TOCTOU/payout-e2e só em *.ps1 efêmeros FORA do CI. validate-architectural-patterns.mjs AUSENTE (real=-rules.ts fora da cadeia).
- CÓDIGO: ~150 SELECT * em produção (incl wallet-payout FOR UPDATE, rbac); devLog=@utils logger nomeado em prod; bank_ledger write SÓ no boundary repo (limpo); ZERO update/delete em append-only de produção.
- IDENT/SEMÂNTICA: user→actor coerente (0 órfãos GUI); concept_id FK em 6 tabelas RESTRICT; relation_type CHECK 6; chk_n2 coerente. DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION confirmada (10 valores/3 vocab). KYB: chk_actor_requires_identity não cobre company.
- COMÉRCIO: products/inventory/offers/service_orders MATERIAL (vazio exceto canonical_products=35); rentals/subscriptions/plans/entitlements/fulfillment AUSENTES.
- VEREDITO: FECHA_COM_RISCO (eixo) / HOLD_FINANCEIRO (dinheiro). Próxima: MODO_B_RLS_395_APPLY_VERIFY (+3 paralelas, toca RLS money) + MODO_B_CARTORIO_RECONCILIATION + HANDOFF_DINHEIRO (3 paralelas) + MODO_B_SCHEMA_CONSTRAINT_HARDENING (conflict-guard booking, janela virgem). DECISION-0131 não-promulgada.
STOPs: honrados — só catálogo/count/grep/EXPLAIN+git; probes descartados; nada mutado/migrado/commitado; editei só o relatório IA-17 + esta memória. INSUMO, não GO. Financeiro → IA-DINHEIRO com 3 paralelas.
Status: RAIO X IA-17 CONCLUÍDO — aguardando IA-DIRETORA.
============================================================

============================================================
F-OFFER-5/6 EXECUÇÃO — READ-FIRST BANCO (booking conflict guard) · IA-BANCO
Tipo: insumo operacional append-only (READ-ONLY; probes descartados; NÃO migration/patch/GO)
Data: 2026-06-21 · HEAD vivo `891dfa87` · branch `rescue-structural` · unificard_dev · respondido em docs/orquestracao/processo/cadeia-de-oferta/respostas/IA-BANCO.md §F-OFFER-5/6 EXECUÇÃO
============================================================
- RÉGUA: DECISION-0146 (PROMULGADA) — availability declara/alerta (sem EXCLUDE, Art. II); booking CONFIRMADO compromete/bloqueia; rollup por provider_actor_id; status bloqueantes do schema vivo (ambiguidade=STOP); concorrência provada; MODO C. IA-TEMPO PRONTO_PARA_GO: guard no CONFIRM, bloqueantes {confirmed,checked_in,checked_out}.
- PROVA-VIVA (HEAD 891dfa87):
  1. detect_availability_conflicts = STUB (RETURN;) — re-confirmado.
  2. availability.owner_id SEM FK (só FK = purpose_concept_id→concepts RESTRICT); polimórfico, 0 ON DELETE. Colunas tempo = start_datetime/end_datetime (timestamptz NOT NULL).
  3. bookings: PK booking_id; availability_id NOT NULL (FK→availability CASCADE); requester_actor_id (FK→actors CASCADE); status varchar DEFAULT 'requested'; confirmed_at/checked_in_at/checked_out_at/cancelled_at/expired_at. NÃO tem coluna provider/service_offering.
  3b. chk_bookings_status = 6 valores VIVOS: requested,confirmed,cancelled,expired,checked_in,checked_out. ⇒ bloqueantes {confirmed,checked_in,checked_out} EXISTEM e são inequívocos → G4/§A.4 satisfeito, SEM STOP. Sem status de pagamento misturado (G12 ok).
  3c. índices bookings: pkey, idx_bookings_tenant_availability(tenant_id,availability_id), idx_bookings_tenant_requester. SEM índice em status.
  4. rollup F-OFFER-6: provider DERIVADO via booking.availability_id→availability.owner_id(owner_type='service_offering')→service_offerings.id→provider_actor_id (G9: nunca do body, derivável server-side ✓). EXPLAIN usa idx_service_offerings_provider; seq scan em availability/bookings só por tabelas vazias (não falta índice).
  5. concorrência: pg_advisory_xact_lock/try/hashtext/hashtextextended TODOS disponíveis.
  6. bookings=0 (nenhum status); availability=48 todas user, service_offering=0 → virgem.
- ÍNDICES: presentes p/ rollup (idx_service_offerings_provider; idx_availability_tenant_owner(tenant,owner_type,owner_id); idx_availability_tenant_window; idx_bookings_tenant_availability). FALTA (opcional, NÃO blocker): bookings(availability_id) WHERE status IN bloqueantes (parcial) ou (tenant,availability_id,status). Registrei necessidade; NÃO criei.
- LOCK (recomendação DB): pg_advisory_xact_lock keyed por provider_actor_id no CONFIRM (serializa per-provider, libera no commit, vence o phantom). SELECT FOR UPDATE sozinho INSUFICIENTE (não impede insert/transição fantasma). EXCLUDE PROIBIDO (§A.7/Art. II).
- VEREDITO: PASS_PARA_GO — substrato sustenta confirm-guard + rollup por provider + advisory lock; status bloqueantes mapeados sem STOP; provider derivável; virgem=grátis; 1 índice opcional. Execução MODO C (createBooking/confirm + concorrência) sob GO→ChatGPT→Yala→Clayton, não meu ato. Itens de writer/semântica (validar owner_id por tipo G5; guard na transição G11; conter service-feed G6) = código/IA-TEMPO, sinalizo.
STOPs: honrados — só catálogo/count/pg_get_functiondef/EXPLAIN(não-EXECUTE)/git; probes descartados; nada mutado/commitado; não auditei dinheiro/payout/ranking; editei só meu IA-BANCO.md + esta memória. INSUMO, não GO.
Status: F-OFFER-5/6 EXECUÇÃO RESPONDIDA — aguardando "consolida"/GO da DIRETORA.
============================================================

============================================================
F-OFFER-5 — PROVA-VIVA substrato temporal (availability) · IA-BANCO
Tipo: insumo operacional append-only (READ-ONLY; probes descartados; NÃO migration/patch/GO)
Data: 2026-06-21 · HEAD vivo `bca473fa` · branch `rescue-structural` · unificard_dev · respondido em docs/orquestracao/processo/cadeia-de-oferta/respostas/IA-BANCO.md §F-OFFER-5
============================================================
- CONTEXTO: IA-TEMPO=PARTIAL (substrato único e são; gap=garantia temporal). Sem ultracode → fiz 1ª mão eu mesma.
- PROVA-VIVA (HEAD bca473fa):
  1. CHECK chk_availability_owner_type APLICADO = 6 tipos (user,service,event,group,page,service_offering); migration 20260612110000 em schema_migrations; fail-closed por enumeração.
  2. owner_id = uuid NOT NULL SEM FK (única FK de availability = purpose_concept_id→concepts RESTRICT). Polimórfico, 0 integridade referencial, sem ON DELETE → service_offering deletado deixa availability órfã.
  3. ZERO triggers em availability (overlap FANTASMA confirmado); 0 EXCLUDE constraint (tstzrange); 0 índice gist/range. ⇒ NENHUMA garantia de overlap no banco.
  4. detect_availability_conflicts = STUB (BEGIN RETURN; END;). Call site só owner_type='user' (código, IA-TEMPO).
  5+6. availability = 48 linhas TODAS owner_type='user'; service=0, service_offering=0, page/event/group=0. Ambiguidade legado service × service_offering = 0×0 em dados (convergência grátis).
- ACHADO CENTRAL: garantia temporal de overlap AUSENTE no banco (sem trigger/EXCLUDE/gist/detector-real). "Fotógrafo em 2 ofertas no mesmo horário" não é prevenido em lugar nenhum. Não é corrupção (offer-time vazio); é ausência de mecanismo, grátis na janela virgem.
- VEREDITO: PASS_PARA_DECISAO — substrato único+virgem+owner=service_offering fail-closed; mas garantia temporal = régua a DECIDIR (não código mecânico). Inputs: (1) mecanismo de overlap — EXCLUDE constraint HARD-BLOQUEIA, COLIDE com Constituição Art. II (conflito=fato→alerta→humano, nunca auto-bloquear) → provável = detector real + alerta, NÃO constraint; escolha de IA-TEMPO/Clayton; (2) rollup cross-oferta por provider_actor_id ausente; (3) owner_id sem FK; (4) converger owner service×service_offering (0×0 grátis). Eu sinalizo trade-off DB, NÃO decido (Art. II = IA-TEMPO).
STOPs: honrados — só catálogo/count/pg_get_functiondef/git; probes descartados; nada mutado/commitado; não auditei dinheiro/payout/ranking; editei só meu IA-BANCO.md + esta memória. INSUMO, não GO.
Status: F-OFFER-5 RESPONDIDA — aguardando "consolida"/próximo da DIRETORA.
============================================================

============================================================
F-OFFER-4 — PROVA-VIVA re-key por concept_id · IA-BANCO
Tipo: insumo operacional append-only (READ-ONLY; probes descartados; workflow ultracode de apoio + reconfirmação 1ª mão; NÃO migration/patch/GO)
Data: 2026-06-21 · HEAD vivo `f6c07742` · branch `rescue-structural` · unificard_dev · schema_migrations=400 (drift=0) · respondido em docs/orquestracao/processo/cadeia-de-oferta/respostas/IA-BANCO.md §F-OFFER-4
============================================================
- MÉTODO: usei Workflow (ultracode on) — contexto + 6 probes psql READ-ONLY paralelos + verificação adversarial da discrepância. CRÍTICO: como sou TERMINUS da prova-viva, reconfirmei DE 1ª MÃO os achados que contrariavam meu estado anterior antes de publicar (subagente ≠ prova até eu verificar o que diverge).
- EVOLUÇÃO DE ESTADO MATERIAL: desde F-OFFER-2/3, EXECUTADAS migrations 20260621100000_f_offer_2a_service_concept_mandatory_fk_restrict + 20260621120000_f_offer_3_service_offering_service_id_mandatory. As réguas que marquei PASS_PARA_GO_DE_DECISAO foram promulgadas+materializadas. ⇒ `services.canonical_service_id` agora NOT NULL (em F-OFFER-2 provei NULLABLE = pré-estado SUPERADO). Disco vence narrativa, inclusive minha própria prova anterior.
- PROVA-VIVA (HEAD f6c07742):
  Rowcounts: services=0, canonical_services=1, service_offerings=0, categories=147 (70 concept_id NULL), tenant_concept_offerings=0; concepts=150, canonical_products=35.
  services.canonical_service_id: NOT NULL, NULL=0/0, FK→canonical_services(id) RESTRICT, índice parcial idx_services_canonical_service. canonical_services.concept_id: NOT NULL, NULL=0, órfãos=0, FK→concepts RESTRICT, índice idx_canonical_services_concept.
  JOIN services→canonical_services→concept_id: EXPLAIN index-only (Nested Loop sobre os 2 índices), SEM seq scan; filtro WHERE cs.concept_id=:resolved viável/eficiente; NÃO precisa índice novo. (counts 0 por services vazia = vacuidade.)
  categories.concept_id: nullable, 147 total/70 NULL/0 órfãos; concept_id só em FOLHA (level=2; UNIQUE parcial ux_category_concept_scope WHERE level=2); serviços-raiz todos NULL (só 3 folhas medico-*). Hop navegação→concept_id = filtro de leitura efêmero, viável SÓ em folha; NUNCA concept_ref persistido.
  tenant_concept_offerings: read-model concept-keyed VAZIO, casa por concept_id puro (não category/domain), FKs CASCADE; risco SSOT indevido baixo (vazio). As 4 colunas-chave do re-key TODAS indexadas.
- DISCREPÂNCIA ~200 vs 0: ERRO DO 1º ELO. Varredura count(*) exato de todas tabelas public → nenhuma na faixa 180-220; services=0; candidatos concepts=150/categories=147 (soma 297≠200); "200" no seed-dev = "capacidade até 200 pessoas" (texto). LIÇÃO: pg_stat_user_tables.n_live_tup STALE neste banco — usar count(*) exato sempre.
- VEREDITO: PASS_PARA_GO (schema suporta re-key sem blocker E sem índice novo). Próxima: GO_DIRETO_MODO_B_SEM_DECISION_NOVA — re-key é CÓDIGO (trocar filtro domain='servicos' de assertServicosCategory services-discovery.service.ts:305-322 + 3 superfícies por join canonical_services.concept_id); execução sob ciclo GO→ChatGPT→Yala→Clayton, não meu ato. Caveat não-blocker p/ IA-DESCOBERTA-FRONT: resolução da ENTRADA de navegação via categories.concept_id só cobre folhas (level=2); serviços-raiz NULL.
STOPs: honrados — só catálogo/rowcount/EXPLAIN(não-EXECUTE)/grep+git; probes descartados; nada mutado/commitado; não auditei dinheiro/availability/ranking/presence/service_order; editei só meu IA-BANCO.md + esta memória. INSUMO, não GO.
Status: F-OFFER-4 RESPONDIDA — aguardando "consolida"/próximo da DIRETORA.
============================================================

============================================================
F-OFFER-3 — PROVA-VIVA schema service_offerings · IA-BANCO
Tipo: insumo operacional append-only (READ-ONLY; probes descartados; NÃO migration/patch/GO)
Data: 2026-06-21 · HEAD vivo `74a04819` (avançou de 4431b8fc) · branch `rescue-structural` · respondido em docs/orquestracao/processo/cadeia-de-oferta/respostas/IA-BANCO.md
============================================================
- CONTEXTO: F-OFFER-2 promulgada = DECISION-0144 (createService = ponto da elegibilidade 2B; service_offerings ficou FORA → F-OFFER-3 = régua análoga da oferta). Cross-input: IA-OFERTA + IA-AUTORIDADE ambas FALTA_DECISAO (createOffering bypassa service_id; buraco company_id/professional_actor_id = proveniência livre do body; Opção A = oferta exige service_id válido mesmo provider+concept).
- PROVA-VIVA (HEAD 74a04819, catálogo vivo):
  service_offerings + services EXISTEM, rls=f/0pol, AMBOS 0 linhas (virgem).
  service_id: EXISTE, NULLABLE, FK→services(service_id) SET NULL (fraca), nunca populado; NULL=0 de 0 → mandatório=GRÁTIS.
  FKs: canonical_service_id→canonical_services RESTRICT (forte); provider_actor_id→actors RESTRICT+NOT NULL (âncora real); company_id→companies SET NULL+nullable; professional_actor_id→actors SET NULL+nullable; tenant_id→tenants CASCADE.
  CHECKs vivos: price_cents bigint NOT NULL CHECK≥0; duration_minutes int NOT NULL CHECK>0; status enum(draft,active,suspended); modality enum(in_person,remote,home). UNIQUE(provider_actor_id,canonical_service_id).
  ITEM 5 (buraco): NENHUMA constraint (FK/CHECK/UNIQUE/trigger) liga company_id ao provider → company_id é só FK SET NULL = proveniência livre. CONFIRMADO estruturalmente o buraco que IA-OFERTA/IA-AUTORIDADE apontaram. professional_actor_id idem.
- VEREDITO: PASS_PARA_GO_DE_DECISAO — espinha preço/dur/status/modality JÁ constrangida (nada a corrigir); oferta vazia ⇒ tornar service_id mandatório+match e fechar proveniência (derivar company_id server-side) = grátis agora. Não é blocker; régua a promulgar análoga à 0144. Inputs: (1) service_id nullable+SETNULL→mandatório grátis; (2) company_id/professional_actor_id sem constraint p/ provider→fechar server-side; (3) status default schema=draft mas writer crava active (decisão produto); (4) provider_actor_id RESTRICT+NOTNULL = manter.
STOPs: honrados — só catálogo/rowcount/grep+git; probes descartados; nada mutado/commitado; não auditei availability/discovery/dinheiro/payout/presence; editei só meu IA-BANCO.md + esta memória. INSUMO, não GO.
Status: F-OFFER-3 RESPONDIDA — aguardando "consolida"/próximo da DIRETORA.
============================================================

---

============================================================
F-OFFER-2 (3º elo) — PROVA-VIVA ponte declaração→service · IA-BANCO
Tipo: insumo operacional append-only (READ-ONLY; probes descartados; NÃO migration/patch/GO)
Data: 2026-06-21 · HEAD vivo `4431b8fc` (avançou de 9f5e9c5e) · branch `rescue-structural` · respondido em docs/orquestracao/processo/cadeia-de-oferta/respostas/IA-BANCO.md
============================================================
- CONTEXTO: F-OFFER amplo fatiado (roadmap no CONSOLIDADO da cadeia-de-oferta). U1/A1/U1b/F-OFFER-0(DECISION-0143)/F-OFFER-1(ghost assign-skill→501) CLOSED. F-OFFER-2 = ponte: criar `service` exige concept_id + autoridade + declaração prévia. Cross-input: IA-ACTOR=FALTA_X (substratos prontos, ponte ausente), IA-AUTORIDADE=FALTA_DECISAO (origem sólida, régua a promulgar; gap KYB-transitivo; resíduo ramo-4 delegado a mim).
- PROVA-VIVA (HEAD 4431b8fc, catálogo vivo):
  Existência+RLS: os 7 (actor_professional_concepts, company_concept_publications, tenant_concept_offerings, services, service_offerings, canonical_services, actor_capability_grants) EXISTEM; TODOS rls=f/forced=f/0pol.
  Rowcounts (estável vs R7): apc=1, ccp=0, tco=0, services=0, service_offerings=0, canonical_services=1, actor_capability_grants=0 (dormant).
  FK ON DELETE: services.canonical_service_id & service_offerings.canonical_service_id → canonical_services = RESTRICT (forte); apc.concept_id & ccp.concept_id → concepts = NO ACTION (fraca, ambos).
  PONTE: **`services.canonical_service_id` é NULLABLE** ⇒ service concept-less permitido pelo schema (fura "discovery só por concept_id"/0142 se não fechado). `services.service_id` NOT NULL. UNIQUE: apc = UNIQUE(tenant_id,actor_id,concept_id); ccp = UNIQUE(company_id,concept_id) WHERE status='active' (partial).
  RAMO-4: company_users=2 linhas, AMBAS role='owner'+can_manage_company=true; resíduo (admin/is_primary sem can_manage_company)=**0** ⇒ TEÓRICO (caminho legado checkOwnership existe no código mas 0 dados o exploram; conter=grátis).
- VEREDITO: **PASS_PARA_GO_DE_DECISAO** — substratos prontos+vazios+FK destino forte ⇒ janela virgem aberta, ponte é grátis agora; ramo-4 não bloqueia. 3 inputs estruturais p/ a régua D3: (1) services.canonical_service_id NULLABLE → impor NOT NULL ou gate de app; (2) concept_id→concepts NO ACTION → considerar RESTRICT; (3) sem RLS (decisão de IA-AUTORIDADE/ops). NÃO decido a régua — é de Clayton/donos.
- LIÇÃO reforçada: barramento migrou p/ docs/orquestracao/processo/cadeia-de-oferta/; meu arquivo de resposta append-only é o desta pasta; HEAD confirmado de 1ª mão (CONSOLIDADO citava 9f5e9c5e stale).
STOPs: honrados — só catálogo/rowcount/grep+git; probes descartados; nada mutado/commitado; não auditei oferta/discovery/availability/material/dinheiro; editei só meu IA-BANCO.md + esta memória. INSUMO, não GO.
Status: F-OFFER-2 RESPONDIDA — aguardando "consolida"/próximo da DIRETORA.
============================================================

---

============================================================
NOVO BARRAMENTO + RODADA 7 — F-PROFILE-PJ-OFFER (prova-viva 14/14) · IA-BANCO
Tipo: insumo operacional append-only (READ-ONLY; probes descartados; NÃO migration, NÃO patch, NÃO GO)
Data: 2026-06-20 · HEAD vivo `9f5e9c5e` (avançou de dd270f41) · branch `rescue-structural`
============================================================
- MUDANÇA DE BARRAMENTO: a DIRETORA migrou o canal §14 do PLANO para a pasta **`docs/orquestracao/`** (METODO.md + INBOX.md + CONSOLIDADO.md + respostas/IA-<X>.md). Eu respondo agora em **`docs/orquestracao/respostas/IA-BANCO.md`** (append-only; criei). Rótulo IA-BANCO. Sou **terminus da prova-viva**; autorizada a probe READ-ONLY descartável em unificard_dev.
- MÉTODO novo: **JANELA VIRGEM** (sistema sem usuário/dado real → cirurgia estrutural ~0 agora; rowcount=prova de custo: vazio=grátis, com dados=cuidado). Verificação BIDIRECIONAL (forward+reverse, `<`=depende-de, falha de fundação=GOAL-BREAKER). Rodadas 3-6 já fecharam: U1 (widen 3→6, commit 2a0d3c21), A1 (reindex DECISOES 6c93c648), U1b (seed árvore casamento, schema_migrations=398).
- PROVA-VIVA 14/14 (HEAD 9f5e9c5e, catálogo vivo):
  A1/A2: `user_skills_categories` e `human_mvp_service_offers` AUSENTES, mas rota `POST /categories/assign-skill` (categories.routes.ts:779→service.ts:1271 INSERT) e módulo `/human-mvp` (app.builder.ts:558) MONTADOS ⇒ **2 ghosts reachable** (42P01). Guard `audit-automation-human-mvp-ghost-containment` existe.
  B3: espinha EXISTE — actor_professional_concepts(1)·actor_professional_profiles(0)·canonical_services(1)·services(0)·service_offerings(0)·company_concept_publications(0)·tenant_concept_offerings(0). Todas rls=f/0pol.
  B4: services canonical_service_id NULL = 0 de 0. B5: FK força — services.canonical_service_id=RESTRICT, service_offerings.canonical_service_id=RESTRICT (fortes); service_offerings.service_id→services=SET NULL (legado); actor_professional_concepts.concept_id→concepts=NO ACTION (fraca).
  C6: **detect_availability_conflicts = STUB** (BEGIN RETURN; END;). C7: CHECK chk_availability_owner_type = **6 tipos incl service_offering**; purpose_concept_id(uuid) vivo em `availability`. C8: availability=48, TODAS owner_type='user' (0 service/service_offering).
  D9: products(0)·canonical_products(**35**)·product_offers(0)·canonical_variants(0)·product_variants(0); AUSENTES catalog_products·tenant_products(apesar de migration 0112)·product_concepts. D10: product_offers.**price_cents BIGINT** (não NUMERIC). D11: coluna product_concept_id AUSENTE; canonical_variant_id em 4 tabelas, todas 0 non-null. D12: inventory_movements 4 triggers tgenabled='O' (append-only ativo); movements=0/balances=0.
  E13: actor_capability_grants=**0** (dormant). E14: **schema_migrations=398 = disco 398 → DRIFT=0** (db_role_rls_hardening aplicado; o drift=1 da R2 fechou). Último aplicado: 20260620150000_seed_concept_relations_wedding_pilot.
- VEREDITO: **PASS_TO_CONVERGENCE** — espinha canônica existe + vazia + FK forte ao canonical ⇒ janela virgem ABERTA (convergência grátis). STOPs p/ F-OFFER: conter/matar os 2 ghosts (grátis), reconciliar nome unified_availability×availability, detect_conflicts STUB, FK concept_id fraca (NO ACTION), duplo vínculo service_id(SET NULL)×canonical(RESTRICT) em service_offerings. CUIDADO (não-vazio): actor_professional_concepts(1)·canonical_services(1)·canonical_products(35)·availability(48 user).
- LIÇÃO: confirmar HEAD vivo SEMPRE (INBOX citava dd270f41; vivo era 9f5e9c5e). Tabela viva da agenda = `availability` (NÃO unified_availability — plano erra o nome).
STOPs: honrados — só catálogo/SELECT/pg_get_functiondef/grep + git; probes descartados; nada mutado/commitado; editei só respostas/IA-BANCO.md + esta memória. INSUMO, não GO.
Status: RODADA 7 RESPONDIDA (14/14) em respostas/IA-BANCO.md — aguardando "consolida"/próxima da DIRETORA.
============================================================

---

============================================================
RODADA 2 — PROVA-VIVA (alvo único IA-BANCO) — 8 itens · IA-BANCO
Tipo: insumo operacional append-only (READ-ONLY; probe descartável apagado; NÃO migration, NÃO patch, NÃO GO)
Data: 2026-06-20 · HEAD vivo `dd270f41` · branch `rescue-structural` · respondido no PLANO §14.9.3
============================================================
- DIRETORA abriu RODADA 2 só p/ mim (os INCONCLUSIVOs de todas as instâncias convergiram à prova-viva no banco). 8 itens, todos provados de 1ª mão via psql READ-ONLY (pg_class/pg_policy/pg_trigger/pg_proc/pg_constraint/information_schema/schema_migrations). Probe apagado.
- RESULTADOS (catálogo vivo):
  1. trigger 0077 `trg_concept_relation_governance` APLICADO+ATIVO (tgenabled='O'); função existe. Base do negative-proof viva.
  2. RLS 6 planos autoridade — TODAS existem, mas **rls_on=f · forced=f · 0 policies** em company_users, actor_delegations, financial_approval_authorities, tenant_operator_grants, reconciliation_disputes, reversals. Isolamento só app-level. (relrowsecurity=f é verdade definitiva; caveat superuser nem se aplica — não há policy a bypassar.)
  3. REVOKE C63 `20260428200000_schedules_revoke_write.sql` APLICADA (em schema_migrations). `purpose_concept_id` (uuid, 0132) VIVO na tabela **`availability`**. ⚠️ CORREÇÃO: `to_regclass('unified_availability')`=NULL — a tabela viva é **`availability`**, não `unified_availability` (plano/IA-TEMPO citam o nome errado).
  4. inventory_movements: 4 triggers não-internos TODOS tgenabled='O' (prevent_update, prevent_delete, validate_movement_lot_variant, actor_tenant). O DISABLE de backfill (20260411120000) foi reabilitado. Sem trigger de INSERT (correto). movements=0/balances=0 → sem drift, DEV vazio = INCONCLUSIVO p/ comportamento.
  5. `rides_rides` EXISTE (rides=NULL); 6 migrations rides_* aplicadas. **FK direta `rides_rides_bank_transaction_id_fkey → bank_transactions(id)`** ⇒ NÃO é greenfield; vetor money-via-carona possível (mediação = código, não meu veredito).
  6. services/service_offerings/company_concept_publications TODAS existem; rows 0/0/0 (DEV vazio → INCONCLUSIVO comportamento). FKs de service_offerings: `service_id→services(service_id) ON DELETE SET NULL` (LEGADO/fraco) + `canonical_service_id→canonical_services(id) ON DELETE RESTRICT` (CANÔNICO/forte). Confirma "service_id legado/projeção" do §4.
  7. financial_approval_authorities/policies/policy_events = **0/0/0**. `economic_policy_lines.bps` (integer) MATERIALIZADA. Assimetria RLS confirmada: service_payment_executions rls=t/forced=t × service_payment_requests rls=f/forced=f.
  8. `actor_has_permission()` = STUB FAIL-CLOSED `RETURN FALSE` (cita AUTHORITY_PRECEDENCE.md §4.4; FASE 6 substituirá). Migration count: 395 disco × 394 schema_migrations → drift 1 (db_role_rls_hardening pendente).
- LEITURA TRANSVERSAL: o drift=1 é a migration de RLS-hardening pendente — logo o RLS-OFF do item 2 pode ser estado PRÉ-hardening; reprovar após aplicar. Tudo que dependia de prova-viva foi provado; 0 INCONCLUSIVO de banco — restam só decisões de POLÍTICA (donos de eixo) + aplicar a migration (executora).
STOPs: honrados — só catálogo/SELECT count + git; probe descartável apagado; nada mutado/aplicado/commitado; editei só PLANO §14.9.3 + esta memória. INSUMO, não GO.
Status: RODADA 2 RESPONDIDA (8/8) no §14.9.3 — aguardando consolidação da DIRETORA.
============================================================

---

============================================================
TASK O2 (RODADA 1) — concept_relations CHECK + trigger 0077 + re-baseline · IA-BANCO
Tipo: insumo operacional append-only (READ-ONLY; probe descartável apagado; NÃO migration, NÃO patch, NÃO GO)
Data: 2026-06-20 · HEAD vivo `dd270f41` · branch `rescue-structural`
============================================================
- CONTEXTO: DIRETORA reestruturou §14 (13 instâncias, barramento único, resposta NA §14.x do arquivo, NÃO no chat). Rótulo IA-BANCO-DE-DADOS → **IA-BANCO**. Respondi TASK O2 em §14.9.2 do PLANO. ⚠️ O arquivo está sob **edição concorrente intensa** por outras sessões — o Edit-tool racejou ~6× ("modified since read"); só fechou ancorando na MINHA linha estável (§14.9.1 item 2) e disparando Read→Edit imediato. NÃO usei rewrite via PowerShell (clobberaria seção alheia).
- PROVA-VIVA (probe psql READ-ONLY apagado):
  Q1 — CHECK vivo `concept_relations_relation_type_check` = `relation_type = ANY (ARRAY['enables','evolves_to','related_to'])` → **3 tipos**. Coluna `relation_type` = **TEXT** (não enum pg) ⇒ widening = ALTER de CHECK, não ALTER TYPE. Origem `0076_concept_relations.sql:18-22`. `0092_global_semantic_graph.sql` só removeu tenant_id (L91-123), NÃO mexeu no vocabulário. Nenhuma migration posterior alargou.
  Q1-cross (drift schema×código, MEU eixo) — 3 PONTOS ALINHADOS em 3 tipos: banco(CHECK) = `graph.adapter.ts:9` (`GraphRelationType='enables'|'evolves_to'|'related_to'`) = `graph-governance.service.ts:9-12` (`RELATION_TYPES` Set). **ZERO drift hoje.** Widening exige lockstep nos 3.
  Q2 — trigger `trg_concept_relation_governance` BEFORE INSERT OR UPDATE, `tgenabled='O'` (ATIVO), executa `enforce_concept_relation_governance()` (EXISTE em pg_proc); gate = `current_setting('app.graph_governance',true) IS DISTINCT FROM 'true' → RAISE check_violation` (`0077_graph_relation_governance_trigger.sql`). Base do negative-proof MATERIALIZADA (não executei o INSERT-sem-config — seria escrita).
  Q3 — ⚠️ **migration 0077 ≠ DECISION-0077** (DECISION-0077 = Location Core geo, LOG L6290). Âncora mais próxima do vocabulário = `SELO_DECISION_0097_ONTOLOGY_FULL_READ.md:31` lista `enables/requires/part_of/related_to/substitutes` (**5 tipos, SEM evolves_to**) — diverge dos 6 do plano (que INCLUI evolves_to). NÃO achei DECISION carimbando "6 tipos" nem "remoção de suggests". → frontier IA-SEMANTICA/IA-DECISOES.
  Q4 — GAP-B já fechado (minha §14.9 existe). Migration count: 395 disco × 394 schema_migrations = drift 1 (`db_role_rls_hardening` pendente; não afeta concept_relations).
- ALERTAS levantados no §14.9.2: R1 U1-não-é-conformidade-sem-âncora-dos-6 (NÃO ratifico constraint que cristaliza decisão); R2 "remover suggests" é framing VAZIO (suggests inexiste nos 3 pontos); R3 lockstep obrigatório; R4 DEV vazio (0 rows) = INCONCLUSIVO p/ comportamento; R5 drift de migration.
- APRENDIZADO operacional: o canal §14 é multi-mão e volátil; para escrever na minha seção, ancorar SEMPRE em texto exclusivamente meu e fazer Read→Edit consecutivo; nunca incluir cabeçalho de seção alheia no old_string (ela muda). Edit-tool atômico protege contra clobber — preferir insistir nele a rewrite manual.
STOPs: honrados — só SELECT/catálogo + Read/Grep/git; probe descartável apagado; nada aplicado/migrado/commitado; editei só o PLANO §14.9.2 e esta memória. Insumo, não GO.
Status: TASK O2 RESPONDIDA no §14.9.2 — 1 frontier aberta (âncora dos 6 tipos) p/ IA-SEMANTICA+IA-DECISOES.
============================================================

---

============================================================
PROVA-VIVA pós-onboarding IA-DIRETORA — IA-BANCO-DE-DADOS
Tipo: insumo operacional append-only (READ-ONLY; probe descartável apagado; NÃO migration, NÃO patch)
Data: 2026-06-20 · HEAD vivo `dd270f41` · branch `rescue-structural`
============================================================
- IA-DIRETORA formalizou meu charter como **IA-BANCO**, ampliando eixos: (a) RUNTIME/INFRA (env/flags/worker arming/prova de RLS aplicada), (b) LOCALIZAÇÃO/TERRITÓRIO (addresses/address_assignments/países-UF-cidades/regiões), e me designou **TERMINUS DA PROVA-VIVA** (todas as instâncias encaminham a mim o que não alcançam read-only). Autorizada a probe READ-ONLY descartável em `unificard_dev`.
- Formato de resposta às tarefas = **bloco copiável no chat** para a IA-DIRETORA (ela consolida no canal §14), não arquivo. GAP-B já fechado: §14.9 registrada nesta sessão.
- **PROVA-VIVA de 1ª mão (probe psql READ-ONLY, apagado ao fim):**
  - HEAD `dd270f41` / branch `rescue-structural`.
  - Disco: **395** `.sql` em `backend/migrations`.
  - Banco `unificard_dev`: `SELECT count(*) FROM schema_migrations` = **394**. Colunas: id, filename, executed_at, checksum, execution_time_ms (chave = `filename`, NÃO `version`).
  - **DRIFT = 1.** Diff disco×DB: pendente (no disco, não em schema_migrations) = `20260620120000_db_role_rls_hardening.sql`; órfãos (em DB, não no disco) = **0**. Casa com a commit recente `cd697da7 security(db): harden app role and rls preflight`.
  - ⇒ dev está **1 migration atrás** do disco/HEAD; `npm run migrate` não rodou após a última commit. NÃO é "dev vazio"; é drift real de aplicação. Veredito de schema sobre RLS-hardening em dev = **INCONCLUSIVO até aplicar** (a tabela/policy da migration pendente pode não existir em dev).
  - Caveat permanente confirmado: conexão `postgres` = superuser/bypassrls ⇒ **RLS inerte** mesmo onde `forced` — prova de RLS exige role app-level, não `postgres`.
STOPs: honrados — só SELECT/diff via psql + Read/Grep/git; probe descartável apagado (`/tmp/*_migs.txt` removidos); nada aplicado/migrado/commitado; editei só esta memória e o plano §14.9. Insumo, não GO.
Status: PROVA-VIVA CONCLUÍDA — drift de 1 migration sinalizado à IA-DIRETORA; aguardando 1ª tarefa.
============================================================

---

============================================================
ATRIBUIÇÃO DE PAPEL — DESENVOLVER O PLANO DE ORQUESTRAÇÃO COMO IA-BANCO-DE-DADOS
Tipo: insumo operacional append-only (READ-ONLY; NÃO norma, NÃO migration, NÃO patch)
Data: 2026-06-20 · HEAD vivo `dd270f41` · branch `rescue-structural` · git status: só memórias (M) + untracked docs/imgs/outputs
============================================================
- Clayton (via /remote-control) atribuiu: ajudar a desenvolver `PLANO_ORQUESTRACAO_SISTEMICA_UNIFICARD.md` (raiz) **na minha especialidade**. A EXECUTORA pede tarefas DENTRO do próprio plano (§14.3 INBOX); respondo só meu eixo, quando Clayton/EXECUTORA pedir.
- LIMITE DE ESCRITA DURO (Clayton, enfático "SOMENTE ESSES ARQUIVOS"): só posso editar (1) `PLANO_ORQUESTRACAO_SISTEMICA_UNIFICARD.md` e (2) esta memória `MINHA_MEMORIA_BANCO_DE_DADOS.md`. Nada mais — nem código, nem migration, nem banco, nem outros docs/memórias.
- Me identifiquei no plano em **§14.9 IA-BANCO-DE-DADOS** (trato · frase-guia · itens do plano sob meu olhar · serviço à executora · fronteira de eixo · STOPs · declaração de disponibilidade · §14.9.1 dúvidas). Padrão espelhado de §14.7 IA-DINHEIRO / §14.8 IA-TEMPO. NÃO editei a lista central §14.3 / assinatura ("cinco instâncias") — texto compartilhado; IA-TEMPO criou precedente de não tocá-lo; minha §14.9 já roteia. Evita edit-race com instâncias paralelas (o plano mudou sob mim 1× durante esta sessão: DINHEIRO+TEMPO entraram entre meu Read e meu Edit).
- Estado vivo: HEAD pulou de `c41476f7` (âncora da 8ª, dev 394) para `dd270f41` (commits recentes: payout toctou hardening / db role+rls hardening, por git log). Memória levemente STALE → revalido de 1ª mão (`to_regclass`/`check:migrations`/catálogo) antes de qualquer veredito.
- Itens do plano no meu eixo (mapa p/ quando a EXECUTORA chamar): U1 CHECK `concept_relations` 3→6 (3 pontos: CHECK DB + `graph.adapter.ts:9` + `graph-governance.service.ts:9-17`) + negative-proof trigger `0077`; §4 DDL `services`/`service_offerings`/`company_concept_publications`/`tenant_concept_offerings` + FK `service_id→services` + guard de separação de fase; drift `price_cents` INTEGER(services)×BIGINT(service_offerings); `service_offerings` sem coluna de tempo (DECISION-0132); cluster schema-ghost de presença (`event_checkins` tombstone sem `checked_out_at` / `presence_rsvps`/`checkins`/`checkin_tokens`/`promo_benefits` ghost / `cultural_event_checkins` archive / `event_staff` CHECK `active/inactive/cancelled` incompatível com `expected/checked_in`); drift código `event_sessions` `start_time/end_time`→`starts_at/ends_at`; RLS assimétrica `service_payment_requests`(rls=f)×`service_payment_executions`(rls=t); acceptQuote 5 writes não-atômicos; drift disco×`schema_migrations`.
STOPs: honrados — só Read/Grep + `git rev-parse`/`branch`/`ls`. Nenhum SQL ainda. Editei só o plano (§14.9) e esta memória. Insumo, não GO.
Status: IDENTIFICAÇÃO CONCLUÍDA — aguardando a primeira tarefa da EXECUTORA em §14.3.
============================================================

============================================================
REANCHOR PÓS-REBOOT — IA-BANCO-DE-DADOS
Tipo: insumo operacional append-only (READ-ONLY; NÃO norma, NÃO migration, NÃO patch)
Data: 2026-06-17
HEAD: `c41476f7` (= esperado pela executora) · git status: só memórias (M) + untracked docs/imgs/outputs; nenhum toque em código/migration/schema
Branch: `rescue-structural` ✅
Migrations: check:migrations GATE 3 PASSOU — 394 no disco; `schema_migrations` = **394** (disco = banco, sem drift)
Schema verificado (to_regclass, read-only):
  - posts = VIVO ✅ (tabela da frente R6.2 social-posts)
  - services = VIVO ✅ (selada em R6.1)
  - bank_ledger / bank_transactions / bank_splits = VIVOS ✅ (existência confirmada; não inspecionados além do necessário)
  - system_notifications = NULL → segue SCHEMA-GHOST
  - menus / menu_items / tabs / tab_orders = NULL → seguem SCHEMA-GHOST (cluster venue/tab)
  - contacts = NULL → segue SCHEMA-GHOST (6ª do cluster DT-SCHEMA-DRIFT)
Veredito: estado COMPATÍVEL com R6.2 e com o histórico recente. Nenhum schema-ghost materializou pós-reboot.
Riscos: nenhum novo. Ghosts mantêm risco já registrado (callers vivos → 42P01) — fora desta frente. RLS inerte sob `postgres` (alerta transversal prévio) permanece.
STOPs: só SELECT/catálogo + check:migrations; nada migrado/alterado/commitado; editei só esta memória.
Status: REANCHOR CONCLUÍDO
============================================================

============================================================
R7 EVENT-RFQ — SCHEMA MAP READ-ONLY (EVIDENCE PACK v1)
Tipo: insumo operacional append-only (READ-ONLY; NÃO norma, NÃO migration, NÃO GO)
Data: 2026-06-17 · HEAD `bf81c34c` (= esperado) · branch rescue-structural · status só memórias/untracked
Frente: R7 EVENT-RFQ ACTING-USER-GATE
============================================================

## FATO CENTRAL: RFQ/QUOTE NÃO TÊM TABELA — são metadata-resident em `events.metadata.rfqs[].quotes[]`
- `to_regclass` NULL para: event_rfqs, quotes, quote_requests, rfqs → NENHUMA tabela dedicada de RFQ/quote.
- Decisão de design explícita (NÃO drift): `event-rfq.types.ts:3-5` e `event-rfq.service.ts:31-33` — "RFQ é conceitual, pode viver em metadata do evento; NÃO cria nova tabela; NÃO aceita proposta automaticamente; NÃO cria booking automaticamente".
- Toda escrita de RFQ/quote = `UPDATE events SET metadata=$1::jsonb` (service L146/295/436/569). RFQ vive em `event.metadata.rfqs`; quotes em `rfq.quotes`; aceite grava `accepted:true/acceptedAt` no jsonb + fecha RFQ.
- Consequência: RFQ/quote NÃO têm FK, NÃO têm CHECK de status no DB, NÃO têm idempotência no DB, NÃO têm RLS — só estrutura jsonb validada em código (enum RFQStatus open/closed em TS).

## MATERIALIZAÇÃO ECONÔMICA: o dinheiro entra via `acceptQuote` → cadeia de tabelas reais
`acceptQuote` (event-rfq.service.ts:532-629), §7 LEI_COERENCIA ESTADO→FINANCEIRO→EVENTO, encadeia:
  1. `availability` (createAvailability ad-hoc, owner_type=service) — 48 linhas vivas
  2. `bookings` (createBooking, requester=organizerActorId) — 0 linhas
  3. service_booking_decisions (provider ACCEPTED)
  4. **`service_payment_requests`** (createPaymentRequest PENDENTE — não executa pagamento) — 0 linhas
🔴 BLINDAGEM no código: acceptQuote cria booking + payment request **pendente**, NÃO executa dinheiro.

## TABELA MATERIAL MONEY-ADJACENT: `service_payment_requests` (DDL vivo, HEAD bf81c34c)
Colunas: payment_request_id uuid PK (gen_random_uuid) · tenant_id NOT NULL · booking_id NOT NULL · service_id NOT NULL · payer_actor_id NOT NULL · receiver_actor_id NOT NULL · payment_request_status varchar(30) NOT NULL default 'pending' · amount_cents **bigint** NOT NULL · currency varchar(3) default 'BRL' · requested_at/created_at/updated_at NOT NULL · cancelled_at/expired_at NULLABLE · metadata jsonb NOT NULL default '{}'.
- **Mapeamento de colunas (pergunta 4):** actor→payer_actor_id/receiver_actor_id; user→NENHUMA coluna user; company→NENHUMA; event→NENHUMA (vínculo a evento só via metadata jsonb {rfqId,quoteId,eventId}); booking→booking_id; payment→a própria linha (request) + service_payment_executions (execução); request→payment_request_id; amount→amount_cents (bigint, centavos, canônico 07); status→payment_request_status.
- **owner_actor_id? NÃO.** **created_by_actor_id? NÃO.** Donos = as duas PARTES (payer/receiver), padrão de pagamento bilateral — adequado; não há autor separado das partes.
- **FKs (pergunta 3/9):** SÓ `payer_actor_id`→actors(id) e `receiver_actor_id`→actors(id) (sem ON DELETE = NO ACTION). **NÃO há FK para booking_id, service_id nem tenant_id.** booking_id/service_id são uuid-cru. Referenciada por `service_payment_executions` (FK ON DELETE CASCADE) — ponte para a execução/Bank.
- **Idempotência (pergunta 10):** `service_payment_requests_booking_id_key` UNIQUE(booking_id) ⇒ **1 payment request por booking** (idempotência material). PK gen_random_uuid. Índices: (tenant,booking),(tenant,payer),(tenant,receiver),(tenant,service).
- **Status lifecycle (pergunta 11):** CHECK status ∈ {pending,cancelled,expired,paid} + colunas cancelled_at/expired_at. Transições materiais existem no enum DB; máquina de transição é no service (não há trigger).
- **Nullable perigoso (pergunta 12):** cancelled_at/expired_at nullable = normal (timestamps de evento). Sem nullable de autoridade perigoso (payer/receiver são NOT NULL+FK). booking_id/service_id NOT NULL mas SEM FK = integridade fraca (uuid pendurado possível).
- **Migrations (pergunta 2):** create=`20260530494000_create_service_booking_decisions_and_payment_requests.sql`; FK+índice=`20260615200000_service_payment_requests_fk_index.sql` (ONDA DECISION-0131/C1_MONEY/DT-SPR-READ-AUTHORITY-RESIDUES R3 — **adicionou FK payer/receiver conscientemente, NÃO criou FK booking/service, SEM RLS/trigger**); money naming=`20260616220000_rename_..._amount_to_amount_cents.sql` + `20260616230000_align_service_money_nomenclature_07.sql`. Execução: `20260530514000_create_service_payment_executions.sql`.

## RLS (pergunta 14) — ASSIMETRIA MATERIAL
- `service_payment_requests`: **rls=f, SEM policy** → o request money-adjacent NÃO tem RLS; isolamento só app-level (`runQueryWithTenant` WHERE tenant_id).
- `service_payment_executions`: **rls=t FORÇADA**, policy `tenant_isolation` (`app.current_tenant`) → a execução (mais perto do Bank) TEM RLS.
- `events`, `bookings`, `availability`: rls=f, sem policy.
- Caveat permanente: mesmo onde RLS existe, é INERTE sob conexão `postgres` (superuser/bypassrls) — alerta transversal já registrado. RLS não é prova de autoridade aqui.

## tenant-only sem owner? (pergunta 8) / schema ghost? (pergunta 13)
- `service_payment_requests`: NÃO é tenant-only-sem-owner — tem partes (payer/receiver) com FK. Tem dono material (as partes).
- `events` (substrato do RFQ): isolamento só por tenant_id no WHERE; RFQ dentro do jsonb não tem dono próprio além de `organizerActorId` (string no jsonb, sem FK).
- **Schema ghost? NÃO no sentido drift.** event_rfqs/quotes/rfqs NULL é **intencional** (metadata-resident), com callers vivos coerentes (escrevem em events.metadata). Diferente do cluster DT-SCHEMA-DRIFT (lá os callers esperavam tabela e estouravam 42P01). Aqui os callers NÃO esperam tabela.

## OBSERVAÇÃO p/ a frente ACTING-USER-GATE (NÃO é meu veredito — domínio authority)
- createRFQ/createQuote gate autoridade só `if (userId)` → `authorityService.canPerformAction(actorId,...,{userId})` (service L76/L357).
- **`acceptQuote` (L532) NÃO chama authorityService no corpo** — confia em `organizerActorId`/`organizerUserId` recebidos; gate, se houver, é no boundary da rota (NÃO VERIFICADO rota-a-rota nesta passada). É exatamente o ponto que move dinheiro (cria booking + payment request). Acting-user↔actor binding desta cadeia = pergunta da frente R7, a confirmar pela executora/IA-AUTHORITY no boundary.

## CLASSIFICAÇÃO
- RFQ/quote substrate: **schema ambíguo** (metadata-resident por design; sem table/FK/CHECK/idempotência no DB) — NÃO schema ghost (intencional).
- `service_payment_requests`: **schema suficiente** para request bilateral (actor FK + idempotência por booking + status enum + money canônico) **+ FK ausente** (booking_id/service_id sem FK, consciente) **+ money-adjacent material** (amount_cents/currency/status) **+ risco tenant-only** (sem RLS na tabela request; só app-level).
- Status lifecycle: **com regra** (CHECK enum + timestamps).

## RECOMENDAÇÃO (insumo, não GO)
- R7 ACTING-USER-GATE pode ser **correção LOCAL code-only, SEM migration**: o schema já tem `payer_actor_id`/`receiver_actor_id` FK→actors; basta o boundary das rotas RFQ (createRFQ/createQuote/**acceptQuote**) injetar o usuário autenticado e exigir `canRepresentActor(tenant, req.user.id, organizerActorId/payerActorId)` antes de mutar metadata/criar payment request. Não precisa frente maior de schema.
- NÃO precisa criar tabela de RFQ/quote para fechar R7 (o gate é de autoridade, não de substrato). Promover RFQ a tabela própria = decisão arquitetural separada (rastreabilidade/constraints/idempotência de quote), NÃO bloqueia R7.
- Resíduos a registrar (não fechar aqui): (a) assimetria RLS request×execution; (b) booking_id/service_id sem FK (integridade fraca da cadeia RFQ→booking→PR; bookings.requester_actor_id também sem FK por memória anterior); (c) RFQ-metadata sem idempotência/lifecycle no DB.

## EVIDENCE PACK v1 — RESULTADO: **PROVA**
Substrato material mapeado e provado em schema vivo + código. RFQ/quote = metadata-resident (sem tabela, por design); money real = service_payment_requests (request pendente) → service_payment_executions (RLS) → Bank. R7 é gate de autoridade no boundary, correção local code-only viável. Decisões-pendentes residuais (RLS assimétrica, FK ausente booking/service, RFQ-as-table) ficam como insumo p/ IA-DT/Diretora — não fecho DT, não dou GO.
STOPs honrados: só SELECT/catálogo + Read/Grep; nenhuma migration/escrita/commit; editei só esta memória.
============================================================

============================================================
R7b ACCEPTQUOTE — SCHEMA / TRANSACTION / INTEGRITY (EVIDENCE PACK v1)
Tipo: insumo operacional append-only (READ-ONLY; NÃO norma, NÃO migration, NÃO GO)
Data: 2026-06-18 · HEAD `ca3c99a6` (= seal R7a docs-only) · branch rescue-structural · status só memórias/untracked
Migrations: 394 disco = 394 schema_migrations (sem drift)
Frente: R7b ACCEPTQUOTE — money-adjacent · R7a CLOSED (W1-W5), W6 acceptQuote deixado fora de escopo
============================================================

## ACHADO #1 — acceptQuote NÃO É ATÔMICO (raiz material R7b)
`acceptQuote` (event-rfq.service.ts:532-629) executa 5 writes, cada um em transação PRÓPRIA/independente — NÃO há BEGIN/COMMIT único envolvendo a cadeia, NÃO há client compartilhado threaded:
  W1 `UPDATE events SET metadata` (runQueryWithTenant, L567) — marca quote accepted:true + RFQ CLOSED → commit isolado
  W2 createAvailability (L580) → `unifiedAvailabilityRepository.create` — SEM param de client; tx própria
  W3 createBooking (L590) → assinatura `createBooking(tenant,user,input,trx?)` TEM param opcional `trx?` MAS acceptQuote chama com 3 args (trx undefined) → tx própria
  W4 createDecision (L603) → `service-booking-decision.service` outboxClient BEGIN (L212) — tx própria
  W5 createPaymentRequest (L611) → repo.create (commit) + outbox em 2ª tx separada (BEGIN L163/COMMIT L193) — dual-write interno também não-atômico
→ acceptQuote NÃO abre transação; usa runQueryWithTenant standalone (W1) e delega aos sub-services, cada um com seu próprio getClientWithTenant/outboxClient. **Nenhum rollback total. Estado parcial é possível.**

## ACHADO #2 — estados parciais perigosos (ordem de commit)
- W1 commita (RFQ CLOSED + quote accepted) e qualquer Wn>1 falha → **aceitação econômica gravada no jsonb sem substrato**; RFQ já CLOSED ⇒ retry barrado por guard `if rfq.status===CLOSED throw 'RFQ já está fechado'` (L547). Beco sem saída: não completa nem refaz.
- W1-W4 commitam, W5 (payment_request) falha → **booking + decision ACCEPTED (provider comprometido a entregar) SEM payment_request** = obrigação sem intenção de pagamento registrada. MAIS PERIGOSO (money-adjacent: compromisso sem money substrate).
- W1-W2 commitam, W3/W4 falham → availability/booking órfãos de decisão; PR impossível depois (createPaymentRequest exige decision ACCEPTED, L143-150).
- Sem idempotency key em acceptQuote: retry recria NOVA availability+booking (novo booking_id) ⇒ UNIQUE(booking_id) não protege contra duplicação na cadeia (só protege 1 PR por booking).

## ACHADO #3 — acceptQuote ROUTE não tem gate de autoridade (W6 confirmado)
event-rfq.routes.ts:468-500: a rota `/quotes/:quoteId/accept` chama `eventRFQService.acceptQuote(...)` direto com `actionContext.actorId` + `(req.user?.userId || actionContext.actorId)`. **NENHUM canRepresentActor / assertCanReadEventMoney** — ao contrário de TODAS as irmãs R7a (createRFQ L44-48, createQuote L218-222, close L166-173, from-spec L303-310, dispatch L427-434). É a única rota money-adjacent (cria booking+PR) e a única sem gate. Domínio authority (não meu veredito), mas materialmente: o ponto que materializa dinheiro é o único destravado.

## ACHADO #4 — RFQ/quote: sem tabela, lifecycle econômico dentro de jsonb
- event_rfqs/quotes/rfqs = `to_regclass` NULL (confirmado R7). RFQ vive em events.metadata.rfqs[]; quote em rfq.quotes[]; aceite grava accepted/acceptedAt + status CLOSED no jsonb.
- SEM FK/CHECK/RLS/idempotência no DB para RFQ/quote. Status RFQStatus(open/closed) e accepted são só TypeScript/jsonb — DB não valida transição. **Risco de lifecycle econômico em metadata = SIM**: a decisão econômica (quote aceita, RFQ fechado) é gravada num jsonb não-transacional, não-constrangido, sem RLS, e é o gatilho dos writes financeiros subsequentes.

## FK/CHECK/UNIQUE/RLS por tabela (schema vivo ca3c99a6)
- **service_payment_requests**: FK só payer_actor_id/receiver_actor_id→actors. **booking_id SEM FK**, **service_id SEM FK**. UNIQUE(booking_id)=idempotência 1-PR/booking. status CHECK {pending,cancelled,expired,paid}. amount_cents BIGINT. currency CHECK='BRL'. **SEM RLS** (rls=f, sem policy). Ref. por service_payment_executions (FK CASCADE).
- **service_payment_executions**: **RLS FORÇADA** (tenant_isolation, app.current_tenant). Assimetria vs request.
- **bookings**: availability_id NOT NULL FK→availability CASCADE; **requester_actor_id NOT NULL FK→actors CASCADE** (⚠️ CORREÇÃO de registro anterior: HOJE TEM FK). status CHECK {requested,confirmed,cancelled,expired,checked_in,checked_out} — NÃO tem 'accepted' (aceite vive na decision). **SEM coluna/FK de service nem event** (vínculo só via availability.owner_id + booking.metadata.serviceId). **SEM RLS**. Ref. por service_orders (SET NULL).
- **availability**: owner_type CHECK inclui 'service'; **owner_id NOT NULL mas SEM FK** (polimórfico uuid-cru). status CHECK {active,paused}. FK só purpose_concept_id→concepts. **SEM RLS**. Disponibilidade fantasma possível (owner_id sem garantia referencial).
- **service_booking_decisions**: **booking_id NOT NULL SEM FK** (uuid-cru); UNIQUE(booking_id)=1 decisão/booking. status CHECK {accepted,rejected,pending,expired}. FK só service_offering_id→service_offerings SET NULL. Ref. por service_orders (SET NULL).
- **events**: SEM RLS; RFQ no metadata depende 100% de app-level (runQueryWithTenant seta GUC mas nenhuma policy consome).

## IDEMPOTÊNCIA (resumo)
- acceptQuote: NENHUMA idempotency key na cadeia. Guard RFQ-CLOSED previne double-accept mas NÃO é idempotência (barra o retry em vez de torná-lo seguro/no-op).
- service_payment_requests: UNIQUE(booking_id) (1 PR/booking) — só vale se o MESMO booking_id reentrar (não vale para retry que cria novo booking).
- service_booking_decisions: UNIQUE(booking_id) (1 decisão/booking).
- outbox W5: insertEventOutboxRow com deterministicServicePaymentRequestedOutboxEventId (idempotente por eventId) — mas é 2ª tx pós-commit do PR (dual-write best-effort com catch).

## RLS (pergunta 6) — rede de segurança ausente no caminho do dinheiro
service_payment_requests SEM RLS · bookings SEM RLS · availability SEM RLS · events SEM RLS. Só service_payment_executions tem RLS. events.metadata 100% app-level. **Se o gate de app falhar (e em acceptQuote NÃO HÁ gate), não há rede DB.** Caveat permanente: RLS inerte sob postgres superuser de qualquer forma.

## 07_NOMENCLATURA (pergunta 7)
- amount_cents BIGINT ✓ · priceCents/expectedPriceCents = money em centavos ✓ coerente · currency CHECK=BRL ✓.
- status/type lowercase (open/closed, pending/accepted) ✓ — NÃO há PENDING uppercase como valor real; sem actor_system como actor_type neste caminho.
- 🟠 **RESÍDUO 07**: `totalCents` usado como CONTAGEM, não money — EventRFQListResult.totalCents = rfqs.length (event-rfq.service.ts:247) e QuoteListResult.totalCents = quotes.length (L520). Sufixo "Cents" sobre contador. Resíduo nomenclatural (não money corrompido; engana leitor).

## VEREDITO EVIDENCE PACK v1: **DECISÃO PENDENTE**
A auditoria PROVA (schema vivo + código) os gaps materiais; a resolução exige DECISÃO (não é correção trivial nem descarte):
  (1) atomicidade: cadeia de 5 writes não-transacional → estados parciais econômicos (booking+decision ACCEPTED sem payment_request é o pior). Decisão: transação única (threading client por todos os sub-services — alguns ainda não aceitam client) OU saga/compensação OU idempotência+reconciliação. NÃO é code-trivial: createAvailability/createDecision/createPaymentRequest hoje NÃO aceitam client externo (só createBooking tem trx? opcional, não usado).
  (2) W6 gate de autoridade na rota accept (domínio authority; materialmente o único ponto money sem gate).
  (3) idempotency key de acceptQuote (hoje guard RFQ-CLOSED só barra retry, deixa cadeia quebrada presa).
  (4) lifecycle econômico em jsonb sem constraint/RLS — decisão se RFQ/quote permanece metadata-resident ou promove a tabela quando vira gatilho financeiro.
  Resíduos menores p/ IA-DT: booking_id/service_id sem FK em SPR; decision.booking_id sem FK; availability.owner_id polimórfico sem FK; assimetria RLS request×execution; totalCents-as-count (07).
NÃO fecho DT · NÃO abro DECISION · NÃO dou GO. Insumo para IA-DIRETORA/IA-DT/IA-DECISOES.
STOPs honrados: só SELECT/catálogo + Read/Grep; nenhuma migration/escrita/patch/commit; editei só esta memória.
============================================================

============================================================
REGISTRO OPERACIONAL — F-CONTACTS-SUPPLIERS-INSTITUTIONAL-AUTHORITY-PREFLIGHT
Tipo: insumo operacional append-only (NÃO norma soberana, NÃO patch, NÃO migration, NÃO fechamento de DT)
Preflight em HEAD: `7e104d70` · branch rescue-structural · dev 389/389
HEAD vivo no registro: `17f25d66` (divergiu de 7e104d70; dev segue 389 ⇒ schema provavelmente intacto, mas
  EXECUÇÃO FUTURA EXIGE REVALIDAÇÃO contra HEAD/schema/código vivo antes de qualquer ação).
Working tree no registro: sem toque relacionado a suppliers/contacts (só memórias + 2 frontend + opus.md + docs untracked).
============================================================

## SUPPLIERS (fatos do preflight, HEAD 7e104d70)
- Tabela `suppliers` EXISTE. `row_count = 0` no momento do preflight.
- Tem `tenant_id` (escopo, NÃO autoridade) e `created_by_actor_id` (autoria/auditoria, NÃO ownership).
- **NÃO** há `owner_actor_id`, `company_id` nem `user_id`. `created_by_user_id` (nullable, sem FK) NÃO é owner.
- Readers são tenant-only por shape (sem canRepresentActor) → leak intra-tenant estrutural, latente (0 linhas).
- **RLS não é defesa efetiva** enquanto a app conecta como `postgres` (rolsuper/rolbypassrls = true/true): RLS forced porém INERTE.
- Não existem tabelas relacionais `supplier_owners`/`company_suppliers` (to_regclass NULL).
- **Decisão pendente no preflight:** ownership institucional.
- **Recomendação técnica consolidada por Clayton:** suppliers devem ser **company-owned via `owner_actor_id` → page-actor/company actor**, espelhando o padrão de `purchase_orders`. Ainda exige cartório soberano mínimo antes de qualquer migration/patch.

## CONTACTS (fatos do preflight, HEAD 7e104d70)
- `to_regclass('public.contacts') = NULL` → **NÃO EXISTE no banco vivo** (schema-ghost). 6ª tabela do cluster DT-SCHEMA-DRIFT.
- Há callers VIVOS dependentes (contact.routes POST/PATCH/GET/search; payment-link; venue open-tab; subscription; fiscal-kyc/payment-execution em try/catch; frontend ContactsPage/CrmPage). WRITE-callers → **risco real 42P01/500 cru** em runtime.
- `migrations_archive/0065_contacts.sql` **NÃO é SSOT vivo**; **não restaurar cru** (sem owner material suficiente; exige auditoria — `feedback_archive_nao_e_ssot`).
- **Decisão pendente:** gênese/ownership.
- **Escolha técnica atual de Clayton:** NÃO criar `contacts` agora; primeiro **conter o schema-ghost em fail-closed (501/503)**. Gênese futura deve ser auditada à parte e tender a `owner_actor_id`/company-owned — **NÃO autorizado nesta frente**.

## RLS (alerta transversal — DT futura)
- App conectando como `postgres`/superuser/bypassrls ⇒ **RLS está INERTE como defesa de runtime** (bypass total).
- **Não usar RLS como prova de autoridade** enquanto o role real da aplicação não for provado não-superuser.
- RLS pode ser defesa-em-profundidade futura, mas **não substitui** authority app-level server-side.
- Registrar como alerta/DT transversal (não fecho/abro DT oficial aqui — só insumo).

> Lembrete de protocolo: este registro é insumo; qualquer execução futura sobre suppliers/contacts deve revalidar HEAD/schema/código vivo e a fonte soberana antes de agir.
============================================================

---

============================================================
PEDIDO DA EXECUTORA — 2026-06-10
Status: RESPONDIDO
HEAD no momento do pedido: 3d8ad25b
Branch: rescue-structural
Para: IA-BANCO-DE-DADOS
Frente relacionada: F-G10-TENANT-SHARED-ISOLATION — substrato de ownership e isolamento
Prioridade: alta
============================================================

CONTEXTO:
Tenant inicial COMPARTILHADO + RLS por tenant ⇒ readers tenant-only vazam entre usuários. Preciso
saber se o SCHEMA VIVO já suporta isolamento correto por recurso, ou se falta coluna/FK/índice/policy.
Somente SELECT/catálogo (information_schema, pg_policies, pg_indexes, \d). NÃO migrar, NÃO alterar.

AUDITAR NO SCHEMA VIVO:
1. `suppliers`: colunas de owner/creator/company/actor/tenant + FKs (existe owner_actor_id/created_by?).
2. `contacts`: colunas de owner/creator/company/actor/user/tenant + FKs (existe user_id/owner?).
3. daily-metrics: tabelas consultadas (event_organizers, events, organizer_subscriptions, event_metrics) —
   TÊM tenant_id? É possível escopo correto por tenant? (as queries vivas não filtram tenant_id hoje).
4. escrow: como `escrow_accounts`, `agreement`, `milestones`, `transactions` se ligam às PARTES reais
   (requester/provider actor) e ao Bank (`bank_transaction_id`)? Há coluna/FK que permita escopo por parte?
5. inventory: há owner actor POR MOVIMENTO (`inventory_movements.actor_id`)? Há índice que suporte filtrar
   por CONJUNTO de actors representáveis sem table scan (ex.: índice em (tenant_id, actor_id, product_variant_id))?
6. RLS: confirmar EXATAMENTE quais dessas tabelas têm policy tenant-only, nenhuma policy, ou policy adicional
   (pg_policies). Confirmar se `app.current_tenant` GUC é o único mecanismo.

RESPONDER:
- se o schema já suporta isolamento correto por recurso (sim/não/parcial, por tabela);
- se falta coluna/FK/índice (qual);
- se a correção exigiria migration (e de que tipo) ou se é possível só no WHERE da aplicação;
- SEM recomendar RLS actor-wide genérica sem antes distinguir classes públicas/organizacionais
  (ex.: catálogo público vs contato privado vs estoque por company);
- HEAD na resposta + fonte (tabela/coluna provada).

STOPs:
somente SELECT/catálogo; não criar nem aplicar migration; não alterar banco. Insumo, não GO.

============================================================

RESPOSTA DA INSTÂNCIA — IA-BANCO-DE-DADOS (vinculada ao PEDIDO 2026-06-10, F-G10-TENANT-SHARED-ISOLATION)

Status do pedido: RESPONDIDO
HEAD no momento da resposta: `3d8ad25b` (= HEAD do pedido; sem divergência)
Branch: `rescue-structural`
Fonte soberana confirmada: schema vivo (`\d` de suppliers/events/event_organizers/organizer_subscriptions/event_metrics/escrow_accounts/escrow_transactions/payment_milestones/inventory_movements; `pg_policies`; `pg_class.relrowsecurity/relforcerowsecurity`; `to_regclass`; row counts); 365 migrations aplicadas = 365 no disco; código vivo lido; `migrations_archive/0065_contacts.sql`.
Arquivos/schema efetivamente lidos: DDL completo das 10 tabelas acima via psql; `backend/src/core/dashboard/daily-metrics.service.ts` (íntegra); `backend/src/modules/marketplace/contact.repository.ts` (íntegra); greps de consumidores (`contactService`: contact.routes, payment-execution.service, payment-link.routes, venue.routes, subscription.service, fiscal-kyc.service); `pg_policies` global (quals distintos).

VEREDITO:
O schema vivo suporta isolamento por recurso **PARCIALMENTE e de forma desigual por tabela**: `inventory_movements` e `escrow_accounts` têm substrato completo (owner/partes NOT NULL + FK + índice); `suppliers` tem owner mas sem índice composto; as 4 tabelas de daily-metrics têm `tenant_id` mas os readers vivos nem o tenant filtram (e 2 queries estão QUEBRADAS por colunas fantasmas); `contacts` **não existe no banco** (tabela fantasma com repositório vivo + 6 consumidores). RLS é tenant-only onde existe, **inexistente** em todo o domínio events/escrow, e o GUC **NÃO é único** (`app.current_tenant` E `app.current_tenant_id` coexistem). Materialidade: TODAS as tabelas auditadas têm **0 linhas hoje** (2 tenants) — todos os leaks são latentes.

EVIDÊNCIAS PROVADAS (schema vivo, HEAD `3d8ad25b`):
1. **suppliers** (20 colunas): `created_by_actor_id uuid NOT NULL` FK→`actors(id)` ON DELETE RESTRICT; `created_by_user_id uuid` nullable **SEM FK** (rastro, não autoridade). Índices: PK, `idx_suppliers_tenant (tenant_id)`, `idx_suppliers_status (tenant_id,status)`, `uidx_suppliers_code (tenant_id,code)` — **NÃO há índice (tenant_id, created_by_actor_id)**. RLS forçada tenant-only (`suppliers_rls`, `app.current_tenant`). Referenciada por `purchase_orders.supplier_id` (RESTRICT). 0 linhas.
2. **contacts**: `to_regclass('public.contacts')` = **NULL — tabela NÃO existe**. Migration só em `migrations_archive/0065_contacts.sql` (não aplicada; runner oficial não lê archive). Código vivo: `contact.repository.ts` faz INSERT/SELECT/UPDATE em `contacts` (colunas esperadas: tenant_id, type, name, tax_id, email, phone, address, `user_id` nullable, kyc_status, metadata — **sem owner actor**); consumidores: contact.routes, payment-execution.service, payment-link.routes, venue.routes, subscription.service, fiscal-kyc.service. Qualquer exercício → `42P01`. Design arquivado declara "Contact ≠ User, Contact ≠ Actor; user_id opcional" — ou seja, **mesmo o design arquivado não tem coluna de dono** para isolamento intra-tenant.
3. **daily-metrics** (`daily-metrics.service.ts`): as 4 tabelas EXISTEM e TODAS têm `tenant_id uuid NOT NULL` FK→tenants (provado por `\d`). Porém: (a) as queries usam `pool.query` cru — sem `runQueriesWithTenant`, sem GUC, sem `WHERE tenant_id` (L124-131 event_organizers; L135-143 events; L147-155 organizer_subscriptions; L166-184 event_metrics) → leitura **plataforma-wide cross-tenant**; (b) nenhuma das 4 tem RLS (rls=f) → não há rede de segurança; (c) **2 queries referenciam colunas FANTASMAS**: `organizer_subscriptions.current_period_end` (L152 — colunas reais: starts_at/ends_at) e `event_metrics.type` (L170/L180 — coluna real: `metric_type`) → `countActiveSubscriptions` e `calculateConversionRate` estouram `42703` em runtime: o serviço está **quebrado**, não só vazando; (d) índices: `events` tem idx_tenant_* (ok); `event_metrics` e `event_organizers` só PK — filtro tenant/data = seq scan (irrelevante com 0 linhas).
4. **escrow**: `escrow_accounts` tem as PARTES reais: `buyer_actor_id`/`seller_actor_id` uuid **NOT NULL** FK→actors, índices individuais (`idx_escrow_accounts_buyer`/`_seller`) + `idx_escrow_accounts_tenant`. (Pedido fala requester/provider — vocabulário do schema é **buyer/seller**.) `agreement_id uuid` nullable **SEM FK** e **não existe** nenhuma tabela `%agreement%` no banco → ponteiro pendurado. Milestones = `payment_milestones` (FK escrow_id→escrow_accounts, tenant_id NOT NULL, `bank_transaction_id` FK→bank_transactions). `escrow_transactions`: FK escrow_id, `milestone_id` FK→payment_milestones, `bank_transaction_id` FK→bank_transactions (índice parcial `idx_escrow_transactions_bank`), unique idempotência (tenant_id, idempotency_key). Filhas **não têm coluna de parte** → escopo por parte via JOIN `escrow_accounts` pelo `escrow_id` (FKs existem). **NENHUMA tabela escrow tem RLS — nem tenant-only** (rls=f nas 3). Vínculo Bank: completo e com FK nas 3 pontas.
5. **inventory** (revalidado neste HEAD): `inventory_movements.actor_id uuid NOT NULL` FK→actors RESTRICT — owner POR MOVIMENTO existe. Índice `idx_inventory_movements_tenant_actor_variant (tenant_id, actor_id, product_variant_id)` suporta `actor_id = ANY($set)` por probes no btree, sem table scan; `idx_inventory_movements_tenant_variant_created` cobre ordenação. RLS forçada tenant-only.
6. **RLS — mapa exato (pg_policies + pg_class):**
   - Tenant-only com `app.current_tenant`: `inventory_movements`, `inventory_balances`, `suppliers` (todas FORÇADAS).
   - **SEM RLS nenhuma**: `events`, `event_organizers`, `organizer_subscriptions`, `event_metrics`, `escrow_accounts`, `escrow_transactions`, `payment_milestones`.
   - **`app.current_tenant` NÃO é o único GUC**: existe um SEGUNDO GUC `app.current_tenant_id` em `audit_events`, `partner_employees`, `webauthn_challenges`, `webauthn_credentials` e `category_ai_logs` (esta com cláusula `tenant_id IS NULL OR ...` que expõe linhas globais). Fragmentação real: app que seta só um GUC deixa o outro conjunto fail-closed — ou exposto no caso do IS NULL.
   - Policies `infra_bypass` com `qual=true` (bypass por role) em `actors`, `authority_roots`, `bank_accounts`, `bank_ledger`, `bank_splits`, `bank_transactions`, `economic_guardianship`.
   - `b2b_payment_intents`: policy composta buyer_tenant OR supplier_tenant (via b2b_orders).
7. **Materialidade:** suppliers=0, events=0, event_organizers=0, organizer_subscriptions=0, event_metrics=0, escrow_accounts=0, escrow_transactions=0, payment_milestones=0; tenants=2. Tudo latente.

INFERÊNCIAS (claramente identificadas):
- `agreement_id` em escrow_accounts provavelmente aponta para conceito nunca materializado (nenhuma tabela alvo, nenhuma referência `escrow_agreements` no código) — **INCONCLUSIVO** o destino pretendido; falta arqueologia no histórico/archive para provar.
- As policies `infra_bypass qual=true` presumo restritas a role de infra (padrão já provado em `bank_ledger` na minha análise anterior); não re-verifiquei o `roles` de cada policy nesta rodada — se a executora for depender disso, pedir verificação do campo `roles` em `pg_policies`.
- `created_by_actor_id` em suppliers é CRIADOR; tratá-lo como "dono organizacional" (company) é decisão semântica, não fato de schema.

RISCOS:
1. **Tenant compartilhado anula a única defesa existente**: onde a RLS existe ela é tenant-only; com todos os usuários no MESMO tenant, RLS não separa nada entre usuários. Nas tabelas sem RLS (events/escrow), nem isso.
2. **`contacts` fantasma com 6 consumidores vivos** — qualquer fluxo G10 que toque contato/pagador estoura 42P01 (500). Mesma família da DT-SCHEMA-DRIFT-CLUSTER-5-TABLES (vira 6ª tabela do cluster).
3. **daily-metrics quebrado E vazando**: 2 queries 42703 (colunas fantasmas) + 2 queries cross-tenant sem filtro. Dashboard plataforma-wide exposto a qualquer tenant que chame a rota.
4. **Dois GUCs de tenant** (`app.current_tenant` × `app.current_tenant_id`) = segunda verdade de mecanismo de isolamento; convergência exigirá migration de policies.
5. Escopo "por parte" em escrow filhas depende de JOIN — qualquer reader que esqueça o JOIN vaza milestones/transactions de terceiros (sem RLS para segurar).

RESPOSTAS ÀS DÚVIDAS DA EXECUTORA (uma a uma):
1. **suppliers**: owner EXISTE — `created_by_actor_id uuid NOT NULL` FK→actors RESTRICT; `created_by_user_id` nullable sem FK; NÃO existe company_id/owner_actor_id distinto do criador. Isolamento por recurso: **SIM (code-only)** via `WHERE created_by_actor_id = ANY($representáveis)`; falta apenas índice composto (tenant_id, created_by_actor_id) — opcional hoje (0 linhas), migration futura por volume.
2. **contacts**: **NÃO EXISTE no banco** — pergunta sobre colunas é prejudicada. Código espera `user_id` (link opcional), sem owner. Qualquer materialização = **migration** (e o design arquivado 0065 NÃO serve cru: não tem coluna de dono → não resolve isolamento em tenant compartilhado; restaurar exige auditoria contextual + decisão de ownership).
3. **daily-metrics**: as 4 tabelas TÊM `tenant_id NOT NULL` → escopo correto por tenant é possível **SEM migration** (code-only: trocar pool.query por leitura tenant-scoped + WHERE tenant_id). Mas a correção real exige TAMBÉM consertar as 2 colunas fantasmas (`current_period_end`→ends_at?, `type`→`metric_type`) — semântica de `current_period_end` não é mapeável 1:1 no schema vivo (INCONCLUSIVO; decisão de produto/executora com a Diretora).
4. **escrow**: partes reais = `buyer_actor_id`/`seller_actor_id` (NOT NULL, FK, indexadas) em `escrow_accounts`; filhas (`payment_milestones`, `escrow_transactions`) escopam por parte via JOIN pelo `escrow_id` (FKs existem). Bank: `bank_account_id` (accounts) e `bank_transaction_id` (transactions/milestones) com FK. Escopo por parte: **SIM, code-only** — nenhuma coluna nova necessária. `agreement_id` é ponteiro sem FK e sem tabela alvo — não usar.
5. **inventory**: **SIM** — owner por movimento (`actor_id NOT NULL` FK→actors) e índice `(tenant_id, actor_id, product_variant_id)` já existem; filtro por conjunto representável sem table scan, sem migration.
6. **RLS**: tenant-only FORÇADA em inventory_movements/inventory_balances/suppliers; **nenhuma policy** em events/event_organizers/organizer_subscriptions/event_metrics/escrow_accounts/escrow_transactions/payment_milestones; `app.current_tenant` **não é o único mecanismo** — `app.current_tenant_id` (segundo GUC) vive em audit_events/partner_employees/webauthn_*/category_ai_logs; bypasses `true` por role infra em actors/authority_roots/bank_*/economic_guardianship.

Resumo por tabela (suporta isolamento por recurso?):
| Tabela | Suporta? | Falta | Migration? |
|---|---|---|---|
| suppliers | SIM (parcial) | índice (tenant, created_by_actor_id); semântica dono=criador é decisão | NÃO p/ escopo; índice = migration opcional |
| contacts | N/A — não existe | tabela inteira + coluna de dono | **SIM** (com decisão de design) |
| event_organizers/events/organizer_subscriptions/event_metrics | SIM p/ tenant | filtro nos readers (código); índices em event_metrics/event_organizers; RLS ausente | NÃO p/ escopo (code-only); índice/RLS = decisão futura |
| escrow_accounts | SIM | — | NÃO |
| payment_milestones/escrow_transactions | SIM via JOIN | coluna de parte própria (só se decidido desnormalizar); RLS ausente | NÃO p/ escopo |
| inventory_movements | SIM | — | NÃO |

DECISÃO DE CLAYTON NECESSÁRIA: **SIM** — (a) classes de visibilidade por tabela (catálogo público × organizacional/company × privado pessoal × dinheiro) ANTES de qualquer RLS além de tenant — concordo com a restrição do pedido: RLS actor-wide genérica seria errada (events.visibility='public' é público por design; estoque é por company; contato é privado); (b) `contacts` deve existir como entidade (e com QUE dono) ou ser substituída (actor/identity já cobrem?); (c) semântica de ownership de suppliers (criador × company dona); (d) GUC canônico único de tenant (convergir `app.current_tenant_id` → `app.current_tenant` ou vice-versa; é migration de policies).

RECOMENDAÇÃO (insumo, não GO):
1. Fatia 1 (code-only, sem migration): escopar readers — suppliers por `created_by_actor_id = ANY(representáveis)`; escrow por parte (JOIN escrow_accounts em buyer/seller); inventory pelo padrão já respondido em 2026-06-09; daily-metrics: tenant-scoped + corrigir colunas fantasmas (ou tombstonar a rota se for vestigial — decisão da Diretora).
2. `contacts`: NÃO exercitar os fluxos; registrar como 6ª tabela fantasma do cluster (insumo p/ IA-DT); materialização só com decisão de design (dono) + migration própria.
3. RLS adicional e índices novos: adiar para depois da classificação de classes (decisão Clayton); registrar a fragmentação de GUC como dívida própria.

O QUE A EXECUTORA NÃO DEVE FAZER:
- NÃO restaurar `0065_contacts.sql` cru do archive (sem owner; sem auditoria contextual — `feedback_archive_nao_e_ssot`).
- NÃO criar RLS actor-wide genérica nem policies novas nesta fatia (decisão de classes pendente + 2 GUCs em conflito).
- NÃO confiar em RLS nas tabelas de events/escrow — **não há nenhuma**; todo isolamento ali é do WHERE da app.
- NÃO usar `pool.query` cru em leitores multi-tenant (daily-metrics é o anti-exemplo vivo).
- NÃO tratar `created_by_user_id` (suppliers, sem FK) como autoridade; autoridade é actor.
- NÃO usar `agreement_id` de escrow_accounts como vínculo válido (sem FK, sem tabela alvo).
- NÃO "consertar" daily-metrics só adicionando WHERE tenant — as queries 42703 quebram antes.

STOPs: somente SELECT/catálogo executados; nenhuma migration criada/aplicada; nenhum código/banco/doc oficial alterado; nada commitado; resposta é insumo, não GO.

Status: RESPONDIDO
============================================================
PEDIDO DA EXECUTORA — 2026-06-09
Status: RESPONDIDO
HEAD no momento do pedido: 1d42a9d2
Branch: rescue-structural
Para: IA-BANCO-DE-DADOS
Frente relacionada: marketplace residual traps / DECISION-0113 / inventory scope
Prioridade: alta
============================================================

CONTEXTO:
`GET /marketplace/inventory/movements` SEM `actorId` retorna linhas itemizadas de TODOS os actors da variante (SELECT inclui `actor_id`, `quantity`, `movement_type`, `reason`, `created_by_user_id`...). `inventory.service.getMovements` só valida que a variante existe — não escopa aos actors representáveis. Classifiquei A latente / leak itemizado cross-company por ausência de escopo. Ver `DT-INVENTORY-MOVEMENTS-ITEMIZED-CROSSCOMPANY-SCOPE`.

DÚVIDA OBJETIVA:
1. O escopo de `inventory_movements` sem actorId deve ser resolvido em app/service, query SQL, RLS, view ou constraint?
2. Existe RLS por actor em `inventory_movements` (ou isolamento é só `tenant_id`)?
3. Há índice que suporte filtrar por um CONJUNTO de actors representáveis sem table scan?
4. O schema atual suporta escopar aos actors representáveis SEM migration?
5. Quais constraints/FKs/tipos relevantes para esse caso (ex.: `inventory_movements.actor_id` → `actors.id`)?

EVIDÊNCIA ESPERADA:
- schema vivo (DDL de `inventory_movements`, índices, RLS policies), norma de isolamento por tenant/actor;
- classificação; riscos; recomendação; STOPs.

FORMATO DE RESPOSTA ESPERADO:
RESPOSTA DA INSTÂNCIA · HEAD no momento da resposta · Fonte soberana confirmada · VEREDITO · EVIDÊNCIAS · RISCOS · RECOMENDAÇÃO · STOPs · Status: RESPONDIDO ou STALE

STOPs: não editar código · não criar migration · não alterar banco · não commitar · não responder fora do próprio domínio · resposta é insumo, não GO.
============================================================

RESPOSTA IA-BANCO-DE-DADOS — 2026-06-10
HEAD no momento da resposta: `b6cc69a3` (branch `rescue-structural`; pedido foi em `1d42a9d2` — delta = commits docs/decisions, schema inalterado: 365 migrations aplicadas = 365 no disco)
Fonte soberana confirmada: schema vivo (`\d inventory_movements`, `pg_class.relrowsecurity/relforcerowsecurity`), código vivo (`inventory-movement.repository.ts:140-200`, `inventory.service.ts:122-142`, `marketplace-inventory.routes.ts:110-220`), DECISION-0113 (canal query `actor_id`/broad read), protocolo de isolamento por tenant (RLS `app.current_tenant`).

VEREDITO: classificação **A latente confirmada** — leak itemizado cross-actor (e cross-company, se houver mais de uma company no mesmo tenant) por ausência de escopo de actor no caminho sem `actorId`. **Latente, não ativo: `inventory_movements` tem 0 linhas hoje** (0 actors, 0 tenants distintos). Correção é **code-only — NENHUMA migration necessária**.

EVIDÊNCIAS (schema vivo, HEAD `b6cc69a3`):
1. **DDL:** `inventory_movements` (14 colunas): `actor_id uuid NOT NULL` com FK `fk_inventory_movements_actor → actors(id) ON DELETE RESTRICT`. `tenant_id NOT NULL` FK→tenants CASCADE. `product_variant_id` FK→product_variants **CASCADE**.
2. **RLS:** habilitado e **FORÇADO** (`relrowsecurity=t`, `relforcerowsecurity=t`), mas a ÚNICA policy é `inventory_movements_rls` por **tenant** (`tenant_id = current_setting('app.current_tenant')`). **NÃO existe RLS por actor.** Isolamento vivo = só tenant.
3. **Código:** rota `GET /inventory/movements` (preHandler só `requirePermission('marketplace_manage_inventory')`): com `actorId` → exige canRepresentActor (fatia 0113 já aplicada); **sem `actorId` → comentário explícito "broad read, fora desta fatia" — comportamento tenant-wide preservado conscientemente**. `getMovements` (service L122) só valida existência da variante. `getMovementsByVariant` (repo L140) filtra `tenant_id + product_variant_id`; `actor_id` só entra se `options.actorId` vier. SELECT é explícito (não `SELECT *`) e **inclui `actor_id`, `quantity`, `movement_type`, `reason`, `created_by_user_id`** — linhas itemizadas de TODOS os actors da variante no tenant.
4. **Triggers de integridade:** append-only enforced (`prevent_inventory_movements_update/delete`); `trg_inventory_movements_actor_tenant` (coerência actor↔tenant no INSERT); `validate_movement_lot_variant`. CHECK `check_quantity_positive_in_out`. Unique de idempotência `uidx_inventory_movements_reference (tenant_id, reference_type, reference_id, product_variant_id, actor_id)` WHERE reference NOT NULL.

RESPOSTAS ÀS 5 DÚVIDAS:
1. **Onde resolver o escopo?** → **App/service + cláusula SQL na query do repositório.** O conjunto "actors representáveis" é verdade de AUTORIDADE (canRepresentActor/delegações, DECISION-0113) — dinâmica por requisição, não expressável em constraint nem view estática. Padrão recomendado: rota/service resolve o conjunto representável → repositório recebe `actorIds: string[]` e aplica `AND actor_id = ANY($n)` SEMPRE (fail-closed: conjunto vazio ⇒ 0 linhas, nunca tenant-wide). RLS por actor exigiria nova session-var (`app.current_actor_set`) + policy nova = padrão inédito no schema + migration — desproporcional para esta fatia; RLS de tenant permanece como defesa em profundidade. Constraint: inviável (não é regra de linha). View: não resolve (o filtro é por requisição).
2. **Existe RLS por actor?** → **NÃO.** Só `inventory_movements_rls` por `tenant_id` (forçada). Qualquer conexão com `app.current_tenant` setado vê TODAS as linhas do tenant, de todos os actors.
3. **Índice para filtrar por CONJUNTO de actors?** → **SIM, já existe:** `idx_inventory_movements_tenant_actor_variant (tenant_id, actor_id, product_variant_id)` serve `tenant = $1 AND actor_id = ANY($set) AND variant = $2` via probes múltiplos no btree. Além dele, `idx_inventory_movements_tenant_variant_created (tenant_id, product_variant_id, created_at DESC)` já estreita a variante e dá a ordenação `created_at DESC`; o filtro de actor-set sobre ele é barato. **Nenhum índice novo necessário** (e com 0 linhas hoje, qualquer plano é trivial; revisitar só se volume crescer).
4. **Suporta escopar SEM migration?** → **SIM.** `actor_id` é NOT NULL + FK→actors. Basta o app passar o conjunto representável e o repo aplicar `actor_id = ANY(...)`. Zero DDL.
5. **Constraints/FKs/tipos relevantes:** `actor_id uuid NOT NULL` FK→`actors(id)` **ON DELETE RESTRICT** (movimento nunca orfana actor); `tenant_id` FK→tenants CASCADE; `product_variant_id` FK→product_variants **CASCADE** ⚠️ (ver risco 3); `quantity numeric(20,4)` (ledger FÍSICO — numeric é legítimo aqui, NÃO é dinheiro); `movement_type` enum `inventory_movement_type` {IN,OUT,ADJUSTMENT}; CHECK quantity>0 para IN/OUT; append-only via triggers.

RISCOS:
1. **Leak itemizado (A latente):** sem actorId, qualquer user com `marketplace_manage_inventory` (default de company) vê extrato físico itemizado de actors que não representa — quantidades, razões, referências, autoria. Hoje 0 linhas ⇒ sem dano material AINDA; vira ativo na primeira movimentação real multi-actor (alinhado a `feedback_ampliar_vigilancia_inclui_universo_atual`: hoje o universo marcado é VAZIO).
2. **Fail-open por omissão:** o desenho atual trata ausência de `actorId` como "tudo", não como "meus representáveis" — inversão do default fail-closed da 0113.
3. ⚠️ **`product_variant_id ON DELETE CASCADE` × triggers append-only:** delete de `product_variants` tenta cascatear em `inventory_movements`, mas `prevent_inventory_movements_delete` dispara TAMBÉM em delete por cascade → o delete da variante com movimentos deve FALHAR em runtime (cascade bloqueado por trigger). Incoerência declarativa (FK diz cascade, trigger diz nunca) — registrar, não corrigir nesta fatia.
4. `created_by_user_id` é nullable e SEM FK — autoria fraca (rastro, não autoridade). Não usar como gate.

RECOMENDAÇÃO (insumo, não GO):
- Fatia code-only no caminho sem `actorId`: resolver actors representáveis no app → repo SEMPRE filtra `actor_id = ANY($set)` fail-closed. Tenant-wide verdadeiro (auditoria/admin), se for requisito de produto, vira rota/permissão própria por decisão explícita — não default.
- NÃO criar RLS por actor / view / constraint nesta fatia; NÃO criar índice novo.
- Registrar a incoerência FK-cascade × trigger append-only (risco 3) como DT própria de banco se a frente de variantes for tocá-la.

STOPs: não criei migration · não alterei banco/código · só SELECT/catálogo · resposta é insumo, não GO · decisão "broad read é produto?" é de Clayton/Diretora, não minha.
Status: RESPONDIDO
============================================================

---

# PARALELA FIN-B — F-DISPUTE-REVERSAL-AUTHORITY-HARD-STOP (READ-ONLY, 2026-06-13)

> Âncora: HEAD `8af211be` ✅ · branch `rescue-structural` ✅ · dev 378 ✅. Aprofundamento do fluxo rota→service→Bank + schema/RLS.

**VEREDITO: P0 CONFIRMADO (estrutural) — exposição LATENTE (0 linhas hoje; limitador é dado, não gate).**

Novos fatos materiais (além da triagem):
- **Motor:** `requestAndExecuteReversalSync` (`reversal.service.ts:431`) → guard pós-D-money (`checkPostDmoneyBlock:441`) → se novo: `requireFinancialRiskClearance(tenantId,{actorId: input.actorId,...})` (`:444-449`) → `createReversalRequest` → `executeReversal:156`. `executeReversal` abre transação, `FOR UPDATE` em `reversals` (`:188`) e `getTransactionLockedForReversal` em bank_transactions (`:198`), valida original completo / não-reversal-de-reversal, e grava o estorno (cria bank_transaction de reversal). **Write financeiro real confirmado.**
- **O "gate financeiro" usa o actor do BODY:** `requireFinancialRiskClearance`→`authorityDecisionService.evaluateFinancialSensitiveAction({actorId})` (`risk-financial-gate.ts:45-65`) é RISCO por actor, **não** binding com `req.user`. Atacante escolhe actor de baixo risco. Nenhuma prova de representabilidade em todo o caminho.
- **Schema `reversals`:** `actor_id` NOT NULL FK→actors RESTRICT; `authority_source` CHECK {system,ownership,delegation,account_acl}|NULL; **`chk_external_reversal_is_systemic`**: external_reversal/chargeback_* **proíbem `performed_by_user_id` NOT NULL** → o caminho da disputa (external_reversal+system) grava com `performed_by_user_id` **forçado NULL**. ⇒ **a linha de reversal NÃO captura o usuário real**; forense só tem o `actor_id` do body. UNIQUE(original_transaction_id) = idempotência. amount_cents>0.
- **Schema `reconciliation_disputes`:** CHECK `created_by_kind ∈ {system,admin,support}` (espelha o whitelist do body — DB valida o enum, mas o valor segue escolhido pelo cliente), status ∈ {open,under_review,resolved,reversed}, UNIQUE(ledger_discrepancy_id), FK→discrepancies RESTRICT. **SEM RLS** (sem bloco Políticas) — isolamento só app via `runQueryWithTenant`. `reversals` idem (sem RLS). (bank_ledger tem RLS forçada; o substrato de dispute/reversal não.)
- **Auditoria insuficiente p/ usuário real:** `reconciliation_dispute_events` grava `actorKind`+`actorId` (ambos do body) + status; `logFinancialEvent('reversal_requested')`. Nenhum registra `req.user`. + `performed_by_user_id` NULL por CHECK ⇒ **impossível atribuir o estorno ao principal autenticado**.
- **Counts (todos 0):** reconciliation_disputes=0, reconciliation_dispute_events=0, reversals=0, bank_ledger=0, bank_transactions=0, reconciliation_ledger_discrepancies=0. ⇒ hoje um estorno nem executa (ORIGINAL_TRANSACTION_NOT_FOUND). **Buraco completo no código, exploração travada só por ausência de dados.**
- **Rotas irmãs (mesmo `parseActor(req.body.actor)`):** `/disputes/from-discrepancy` (`routes:57`), `/disputes/:id/to-review` (`:112`), `/disputes/:id/resolve` (`:149`) — só ESTADO (createDispute/transição), **NÃO** Bank. Só `/reversal` move dinheiro. Mas o padrão actor-no-body é idêntico nas 4.
- **State guards (antes do dinheiro):** dispute under_review; type∈REVERSAL_REFERENCE_TYPES; idempotência (uq + short-circuit executed); checkPostDmoneyBlock; original existe/completo; não reversal-de-reversal; locks FOR UPDATE.
- **Authority guards:** NENHUM binding req.user↔actor. Só kind-whitelist (cosmético) + risco por actor do body.
- **Testes:** sem e2e HTTP da rota. Os `validate-pipeline-e2e-refund-*` chamam o **motor** direto com actor de fixture → **mascaram** a falha HTTP (provam motor, nunca o binding da rota).

**Menor superfície de correção futura (NÃO implementar):** no boundary das 4 rotas, injetar o principal autenticado e exigir `canRepresentActor(tenantId, req.user.id, actor.actorId)` antes de chamar o service (um helper único aplicado às 4); parar de confiar em `actor.kind` do body para 'admin'/'support'/'system' (kind real vem de gate, não do payload). Chokepoint único de dinheiro = `executeDisputeFinancialReversal`. Code-only — sem migration (schema já tem `actor_id`/FK; opcional futuro: permitir capturar usuário real, mas hoje CHECK força NULL p/ external_reversal).

---

# F-DISPUTE-REVERSAL-AUTHORITY-EXPOSURE-TRIAGE (READ-ONLY, 2026-06-13)

> Âncora: HEAD `8af211be` ✅ · branch `rescue-structural` ✅ · dev 378 ✅. Triagem de P0-candidato financeiro `POST /disputes/:id/reversal`.

**VEREDITO: P0 CONFIRMADO** (com ressalva: autenticado, não anônimo).

Cadeia provada (file:line):
- **Montada/exposta:** `app.builder.ts:681` `protectedScope.register(reconciliationDisputeRoutes,{prefix:'/reconciliation'})` → `POST /reconciliation/disputes/:id/reversal` (`reconciliation-dispute.routes.ts:186`).
- **Auth:** dentro de `protectedScope` que registra `authPlugin` (`app.builder.ts:292`) + tenant + actionContext + rbac. Exige sessão autenticada no tenant. (Não reli o corpo do authPlugin linha-a-linha; se fosse frouxo seria pior, não melhor.)
- **Gate de autoridade:** NENHUM real. Handler `:186-226` **sem preHandler** (rbacPlugin só decora `requirePermission/requireRole`; não aplicado aqui). Único "gate" = `assertAuthorityForDisputeMutation(actor)` (`reconciliation-dispute.service.ts:43-51`) que só valida `actor.kind ∈ {'system','admin','support'}` — e `kind` vem de `req.body.actor.kind`. **Autoridade auto-declarada no body** (cosmética).
- **Sem canRepresentActor/canActAs/authorityService** na rota nem no service (confirmado por leitura).
- **Origem do actor:** 100% `req.body.actor` → `parseActor` (`routes:18-35,191-193`) → service. `actor.actorId` (body) entra direto em `requestAndExecuteReversalSync({originalTransactionId: disc.referenceId, actorId, authoritySource:'system', reversalType:'external_reversal'})` (`service:281-289`). **Nunca comparado a req.user.**
- **Write financeiro:** SIM — `requestAndExecuteReversalSync` (`modules/reversal/reversal.service.ts:431`) é o motor formal de estorno (mexe bank_ledger/bank_transactions). Estorno externo sistêmico real.
- **Cobertura:** os e2e de reversal (`validate-pipeline-e2e-refund-*`) exercitam o MOTOR `requestAndExecuteReversalSync` diretamente, **não** o binding de autoridade da rota HTTP. Nenhum teste do binding actor↔user desta rota encontrado.
- **Pré-condições (limitam blast radius, NÃO são gate de autoridade):** dispute precisa existir e estar `under_review`; type ∈ REVERSAL_REFERENCE_TYPES; guards do motor (ex.: REVERSAL_POST_DMONEY_REQUIRES_RECOVERY_FLOW).

Resumo do risco: qualquer usuário **autenticado** no tenant pode POSTar `actor.kind='admin'` + `actor_id` arbitrário e disparar estorno financeiro com `authoritySource:'system'` — confused-deputy/escalada. As 3 rotas irmãs (`/from-discrepancy`, `/to-review`, `/resolve`) têm o MESMO padrão de actor-no-body (só `/reversal` move dinheiro).

STOPs honrados: só Read/Grep + 1 SELECT de count; nenhum teste mutável; Bank não tocado; sem patch; editei só esta memória.

---

# PARALELA B — F-AUTHORITY-PJ-ROLES-GRANTS-CNAE — mapa dos 4 primitivos (READ-ONLY, 2026-06-13)

> Tarefa direta (não veio como bloco PEDIDO). Âncora: HEAD `8af211be` ✅ · branch `rescue-structural` ✅ · dev **378/378** (= disco) ✅ — sem divergência. Tudo provado em schema vivo + leitura de código; agente Explore usado só como insumo, revalidado.

## 1. Schema vivo — existência + count (provado)
| Tabela | Estado | Count | Colunas/constraints decisivas |
|---|---|---|---|
| company_users | existe | **2** | `role`(CHECK owner/admin/staff/contractor/member), `can_manage_company`, `can_manage_financial`, `can_manage_employees`, `can_view_reports`, `can_manage_services`, `can_view_consolidated_inventory`, `is_active`, `member_status`(CHECK active/invited/suspended), `is_primary`; UNIQUE (company_id, global_user_id); FK company/global_user/tenant |
| actors | existe | 10 | `user_id`, `actor_type`, `company_id`, `group_id` |
| actor_delegations | existe | **9** | `user_actor_id`, `institutional_actor_id`, `scopes_json jsonb`, `is_transitive`, `expires_at`, `status`(active/revoked/expired). **SEM FK** para actors; SEM RLS |
| roles | existe | 8 | catálogo RBAC V2 |
| permissions | existe | **76** | catálogo |
| role_permissions | existe | **136** | mapa role→perm povoado |
| user_roles | existe | **1** | `user_id`, `role_id` (USER-scoped, não actor); UNIQUE(tenant,user,role); RLS tenant |
| service_offerings | existe | 0 | `provider_actor_id` NOT NULL FK→actors RESTRICT; `service_id` NULL FK→services SET NULL; `company_id` NULL FK SET NULL; `professional_actor_id` NULL; UNIQUE(provider_actor_id, canonical_service_id) |
| services | existe | 0 | `actor_id` NOT NULL FK→actors CASCADE; UNIQUE(tenant,actor,slug); `price_cents` **integer** (drift conhecido) |
| service_orders | existe | 0 | `worker_actor_id`/`customer_actor_id`/`created_by_actor_id` NOT NULL FK→actors; `booking_id` **NULL e SEM FK**; `decision_id` NULL; RLS tenant isolation |
| bookings | existe | 0 | `requester_actor_id` NOT NULL **SEM FK**; `availability_id` FK→availability CASCADE; SEM RLS |
| availability | existe | 32 | `owner_type`(CHECK user/service/event/group/page/service_offering) + `owner_id` polimórfico **SEM FK** |
| companies | existe | 2 | (dual-status já mapeado) |
| fiscal_identities | existe | 2 | KYB SSOT (`kyb_status`) |
| fiscal_identity_economic_activities | existe | 0 | `cnae_code`, `is_primary`; UNIQUE(fiscal_identity_id, cnae_code) |
| cnae_concept_suggestions | existe | n/v | — |
| company_concept_publications | existe | **0** | substrato de publicação vazio |
| **NÃO EXISTEM** | — | — | `actor_roles`, `company_roles`, `grants`, `role_assignments`, `service_publications`, `unified_availability`, `unified_bookings` |

> ⚠️ Correção de memória anterior: o SSOT temporal vivo é a tabela **`availability`** (+ `bookings`), NÃO `unified_availability`/`unified_bookings` (estas NÃO existem no schema vivo neste HEAD). Tipos em `unified-availability.types.ts` são nomenclatura de código sobre a tabela `availability`.

## 2. Os 4 primitivos (file:line provado)
| # | Primitivo | Def (file:line) | Tabela/coluna decisória | Lê o quê | Veredito |
|---|---|---|---|---|---|
| 1 | `canRepresentActor` | `core/authorization/authorization.service.ts:333-391` | `actors`(user_id/actor_type/company_id/group_id) → `company_users`(via canManageCompany) → `groups`(owner_actor_id) → `actor_registry` → `actor_delegations` | 5 fontes fail-closed, permission-AGNÓSTICO | **SOBERANO** p/ "pode agir COMO actor" |
| 2 | `canManageCompany` | `core/companies/companies.service.ts:937-948` | **`company_users`**: `(can_manage_company OR role='owner')` + `is_active` + `member_status='active'` | só company_users | **SOBERANO/FONTE** p/ autoridade PJ |
| 3 | `authorityService.canPerformAction` | `modules/authority/authority.service.ts:30-51` | quarentena `isActorEffectivelyBlocked` → delega `authorizationService.canActAs` (`authorization.service.ts:78`) | canActAs: ownership direto + ownership de entidade (registry) + delegação + capability de registry. **NÃO chama actor_has_permission** | **SOBERANO** p/ módulos (ownership/delegação/capability) |
| 4 | `rbacService.requireRole` / `requirePermission` | `plugins/rbac.plugin.ts:233-275` / `:145-186` | gate `assertActorRepresentable`(0113 → canRepresentActor) → `actor_has_any_role` / `actor_has_permission` | role: SQL `actor_has_any_role` JOIN `actors`→`user_roles` ON **a.user_id=ur.user_id** (USER-scoped). perm: SQL `actor_has_permission` = **stub `RETURN FALSE`** | binding 0113 REAL; resolução **DORMENTE/DIVERGENTE** |

## 3. Achado mais material — RBAC V2 permission é parede FALSE
- `actor_has_permission(p_tenant_id, p_actor_id, p_resource, p_action)` — **overload único**, corpo = `RETURN FALSE` com comentário "FASE 6 substituirá esta função pela implementação real (RBAC + policy engine)". Provado por `pg_proc.prosrc`.
- `rbac.service.ts:165-189 actorHasAllPermissions` e `:139-159 actorHasAnyPermission` apenas **iteram** chamando `actor_has_permission` (`:122-126`) → **sempre FALSE**.
- Consequência material: `requirePermission(...)`/`requireAnyPermission(...)` (`rbac.plugin.ts:145,190`), após passar o gate 0113, **negam toda permission no substrato**. RBAC V2 de permission é aspiracional (catálogo 76 perms/136 role_permissions povoado, mas **não consultado** pela função stub). ⚠️ Reconciliação de runtime (rotas que dependem só de `requirePermission` ficam deny-all) é da executora confirmar rota a rota — eu PROVEI o stub, NÃO tracei alcançabilidade de cada rota.
- `actor_has_any_role` resolve por `user_id` (não por actor) e só há **1** linha em `user_roles` → camada role quase vazia + semântica USER, não actor (apesar do comentário "sem expor user_id"/"NÃO converte actorId→userId" — o JOIN faz exatamente isso).

## 4. Respostas às 20 perguntas (resumo)
1. Ver matriz §2 (tabela/coluna por primitivo).
2. **Divergem por camada**: para "pode agir como actor" os três reais (canRepresentActor/canManageCompany/canActAs) concordam; o RBAC V2 (#4) diverge — nega permission (stub) e resolve role por user. Não há contradição allow-vs-deny entre #1-3; #4 é deny-all de permission.
3. **"pode publicar pela empresa X?"** → hoje: `canRepresentActor`(actor da company) que cai em `canManageCompany`(company_users `can_manage_company` OR owner). `company_concept_publications` vazio; sem camada CNAE/permission fina ativa. → decide **company_users**.
4. **"pode criar/editar oferta pela empresa X?"** → `service-offering.service.ts:97/148` usa `canRepresentActor(provider_actor_id)`; se provider for actor de company → `canManageCompany`. → decide **canRepresentActor → company_users**.
5. **"pode agir como actor da empresa X?"** → `canRepresentActor` (§2 #1). → **soberano**.
6. **"pode operar financeiro pela empresa X?"** → **LACUNA**: `company_users.can_manage_financial` existe mas NÃO há leitor vivo provado que o consuma como gate financeiro; `actor_has_permission` (que cobriria) é stub FALSE; gate financeiro real é `requireFinancialRiskClearance`/risk-gate (citado no próprio stub). → **falta** binding fino financeiro PJ.
7. `company_users` **NÃO é flag grosseira** — tem grão real: 6 booleans de capability + role + member_status. Granularidade existe; falta é leitor que use além de `can_manage_company`/`can_view_consolidated_inventory`.
8. Permissões finas: catálogo povoado (`permissions`=76, `role_permissions`=136) MAS **não consultado** (stub FALSE); atribuição a usuário quase nula (`user_roles`=1). Povoado no catálogo, morto no caminho de decisão.
9. `actor_delegations` existe e **povoada (9)**; lida por `findActiveDelegation` em `canRepresentActor:386` e `canActAs`. SEM FK p/ actors, SEM RLS. → **lida por writer vivo de autoridade**.
10. **R2 parcialmente ativo** (não dormente): substrato + leitura no caminho canônico vivos; mas sem FK/RLS e a frente R2 está congelada por norma (DECISION-0113 ainda aberta).
11. **CNAE/indústria**: `fiscal_identity_economic_activities`(0) + `cnae_concept_suggestions`; `fiscal-identity-economic-activity.service.ts` declara "CNAE é EVIDÊNCIA, não autoriza publicação/domínio" (D1/D10/D11). **NÃO há resolver de capability por ramo** no código. → capability por indústria **não materializada**.
12. Booking/service_order writer de autoridade: repositórios (`service-order.repository.ts:97`, `service-booking-decision.repository.ts:92`) **não checam autoridade**; gate fica em rota/service. `bookings` writer sem FK em `requester_actor_id`. → autoridade **fora do writer** (NÃO VERIFICADO gate exato de cada rota de booking).
13. actorId vs userId: separação mantida nos primitivos #1-3; **conflation real no #4 role**: `actor_has_any_role` converte actor→user via `a.user_id=ur.user_id` apesar do comentário negar. 
14. UNIQUE/FK por booking: `bookings` PK só; `requester_actor_id` SEM FK; `service_orders.booking_id` SEM FK (só índice parcial). → binding booking **fraco**.
15. Dependência frágil: `availability.owner_id` polimórfico SEM FK; `service_orders.metadata jsonb`; `booking_id`/`decision_id` sem FK. → vários vínculos por uuid cru.
16. `service_offerings.provider_actor_id` (vendedor, FK RESTRICT) ≠ `services.actor_id` (criador do serviço base, FK CASCADE); `service_id` é link opcional (SET NULL) → offering pode ter provider distinto do dono do service base.
17. availability `owner_type='service_offering'` (deriva provider_actor_id de service_offerings) vs `='service'` (deriva actor_id de services) — política em `availability-owner-authority.ts`; CHECK aceita ambos. Binding por (owner_type, owner_id) sem FK.
18. **Mais confiável hoje**: `canRepresentActor` + `canManageCompany` (+ `canActAs` ownership/delegação) — implementados, fail-closed, lendo substrato real e povoado.
19. **Redundante**: RBAC V2 permission (catálogo 76/136 não consultado; stub FALSE).
20. **Divergente/dormente**: `actor_has_permission` (stub) e `actor_has_any_role` (USER-scoped, 1 atribuição) — RBAC V2 como mecanismo de decisão.

## 5. Conclusão
- **Mecanismo mais confiável hoje:** representabilidade + company_users (canRepresentActor/canManageCompany/canActAs).
- **Mais perigoso:** RBAC V2 dá *aparência* de autoridade fina (decorators `requirePermission`/`requireRole`, catálogo povoado) sobre um substrato que **nega tudo** (perm stub) ou resolve por user (role). Risco = falsa sensação de gate fino + conflation actor/user na role.
- **Primeira raiz técnica provável:** decidir se a autoridade fina PJ vive em **company_users (grão já existente)** ou no **RBAC V2 (FASE 6)** — hoje há duas verdades aspiracionais e uma real; CNAE NÃO entra como capability (é evidência). Bindings fracos (bookings/availability/service_orders sem FK) são raiz adjacente.
- **NÃO VERIFICADO:** alcançabilidade rota-a-rota das rotas `requirePermission`; gate de autoridade exato dos writers de booking; corpo de `cnae_concept_suggestions`.

STOPs honrados: só SELECT/catálogo + Read/Grep; nenhuma migration/escrita/commit; editei só esta memória. Insumo, não GO.

---

## Papel da instância

Sou a instância especialista em **Banco / Migrations / Schema**. Opero em modo **GUARDIÃO permanente** (auditoria, não execução).

**NÃO faço:** implementar código, criar/aplicar migration, alterar banco, commitar, editar documentação institucional (STATUS / DT_LOG / DECISIONs / contratos / código / frontend / migrations).

**Única escrita permitida:** este arquivo (`docs/memorias/MINHA_MEMORIA_BANCO_DE_DADOS.md`).

**Comandos permitidos no banco:** `SELECT`, catálogo (`information_schema`, `pg_catalog`, `to_regclass`), `\d`, `\dt`, `\di`, `\df`.
**Proibidos:** `INSERT/UPDATE/DELETE/ALTER/DROP/CREATE/TRUNCATE`, migration, seed, reset.

**Arquivos protegidos (nunca tocar/stagear/commitar):** `CRIACAO_DE_EMPRESAS.md`, `criacao-de-empresa.png`, `fluxo-empresa.png`.

**Conexão (read-only):** `DATABASE_URL` em `backend/.env` → `postgresql://postgres:***@localhost:5432/unificard_dev`. `psql` disponível e funcional.

### Canal com a executora `unificard` (protocolo desde 2026-06-06)

Este arquivo também é **canal de comunicação** com a executora. Convenção:
- A executora escreve blocos `PEDIDO DA EXECUTORA` **no TOPO** deste arquivo (acima desta seção).
- Quando Clayton avisar "veja sua memória": ler o topo, achar o `PEDIDO DA EXECUTORA` mais recente com `Status: ABERTO`.
- Responder **abaixo do próprio pedido**, sem apagar nada; mudar `Status: ABERTO` → `Status: RESPONDIDO`.
- Resposta com evidência material (schema vivo, migration, constraint, FK, query READ-ONLY, arquivo/linha) no formato `RESPOSTA IA-BANCO-DE-DADOS`.
- Nunca apagar pedidos/respostas antigas; conteúdo mais recente no topo; não reescrever histórico.
- Fora do escopo → "FORA DO ESCOPO IA-BANCO-DE-DADOS — encaminhar para IA-DT / IA-DECISOES / IA-DOCUMENTOS."
- Pedido de execução → "IA-BANCO-DE-DADOS é READ-ONLY. Posso mapear schema e risco, mas não executar."
- Lembrete: esta memória é **insumo operacional, não norma soberana**; schema vivo é checado antes de qualquer veredito.
- **Topo absoluto deste arquivo reservado aos PEDIDOs da executora** — minhas seções analíticas ficam abaixo.

---

# FECHAMENTO PJ — análise READ-ONLY (2026-06-06, HEAD `a312174a`)

## Estado verificado
- **HEAD:** `a312174a` ✅ (esperado)
- **Branch:** `rescue-structural` ✅
- **Working tree:** limpo, exceto 3 autorais protegidos (`CRIACAO_DE_EMPRESAS.md`, `criacao-de-empresa.png`, `fluxo-empresa.png`) + `docs/memorias/` untracked (quarentena). ✅
- **Migrations aplicadas:** **365** (DB) = 365 (.sql disco). ✅

## Escopo desta análise
Fechamento PJ — delete guard, PROVISIONAL→ACTIVE, fiscal_identity_id, constraints. READ-ONLY estrito.

## Achados principais
1. 🔴 **`deleteCompany` está QUEBRADO**: o guard financeiro consulta `accounts` e `transactions` — **tabelas que NÃO existem** (`to_regclass` = NULL). Toda chamada estoura `42P01` (HTTP 500) antes do soft-delete. PJ **não pode ser removida** hoje.
2. 🔴 **Não existe writer de runtime PROVISIONAL → ACTIVE.** O ciclo vivo só promove `DRAFT → PROVISIONAL` (`activateCompanyOperationally`, L878). `ACTIVE` é aceito pelo CHECK mas só é escrito por E2E/migration de normalização — **gap de lifecycle** (provável dependência do futuro `F-PJ-KYB-RELEASE-GATE`).
3. 🟢 **`createCompany` é fiscal-first correto**: insere `fiscal_identities` ANTES de `companies` (L500-509), FK presente desde o nascimento. 2 companies vivas, **0 com `fiscal_identity_id` NULL**.
4. 🟠 **`companies.fiscal_identity_id` é NULLABLE** — sem garantia de banco; fiscal-first é só código. Risco em legado/backfill/caminho alternativo.
5. **Verificação PJ = `fiscal_identities.kyb_status`** (eixo separado), NUNCA `company_status` (congelado, DECISION-0089/0090).

## A) deleteCompany
Arquivo: `backend/src/core/companies/companies.service.ts` L1996-2054.

| Item | Evidência | Veredito |
|---|---|---|
| Consulta tabela inexistente? | L2014 `FROM accounts`; L2027 `FROM transactions` | 🔴 SIM — ambas |
| `to_regclass('public.accounts')` | NULL | 🔴 não existe |
| `to_regclass('public.transactions')` | NULL | 🔴 não existe |
| Acesso direto a banco financeiro? | `pool.query(...)` direto (L2011, L2024), **não** `runQueryWithTenant`; sem RLS de tenant | 🔴 anti-padrão de fronteira |
| Deveria usar Bank port? | Verdade financeira = `bank_ledger` via Bank; SQL cru fora de `modules/bank/` é vetado (protocolo 2.3.2/2.3.3) | 🔴 SIM — viola NO_DIRECT_BANK_TABLE_ACCESS em espírito |
| Mismatch com bank_accounts/bank_transactions | `bank_accounts` tem `id`/`actor_id`/`owner_type∈{actor,system,escrow}` — **sem** `account_id`, **sem** owner_type='company'; `bank_transactions` tem `account_id`/`counterpart_account_id` — **sem** `from_account`/`to_account` | 🔴 modelo de dinheiro do guard nunca existiu neste sistema |
| Soft-delete em si | L2043-2051 `runQueryWithTenant` → `UPDATE companies SET status='inactive'` (tenant-scoped) | 🟢 correto, mas **inalcançável** (guard estoura antes) |

## B) Bug material do delete guard
**Causa raiz: tabela ausente + query antiga + modelo de dinheiro fantasma.** O guard de `deleteCompany` foi escrito contra um esquema financeiro pré-histórico (`accounts.account_id` + `accounts.owner_id`/`owner_type='company'`; `transactions.from_account`/`to_account`) que **não existe no schema vivo** — `accounts` e `transactions` retornam NULL em `to_regclass`. O SSOT financeiro atual é `bank_ledger`/`bank_transactions`/`bank_accounts`, com colunas e modelo totalmente diferentes (sem from/to account, sem owner_type='company', `bank_transactions` usa `account_id`+`counterpart_account_id`). Resultado material: a primeira query do guard (`SELECT ... FROM accounts`) lança `relation "accounts" does not exist` (42P01) → **`deleteCompany` lança HTTP 500 para QUALQUER empresa**; o soft-delete correto (status='inactive', tenant-scoped) **nunca é alcançado**. Agravante de fronteira: usa `pool.query` direto (sem contexto de tenant/RLS) em vez do Bank port — mesmo que as tabelas existissem, seria acesso financeiro cru proibido fora de `modules/bank/`. **Não é owner_id composite** — é tabela inexistente + modelo divergente.

## C) Writer PROVISIONAL → ACTIVE

| Busca | Resultado | Veredito |
|---|---|---|
| `SET company_status` / `company_status = CASE` | só L878: `CASE WHEN company_status='DRAFT' THEN 'PROVISIONAL' ELSE company_status END` (em `activateCompanyOperationally`) | DRAFT→PROVISIONAL existe; preserva ACTIVE/SUSPENDED, não promove a ACTIVE |
| `company_status='ACTIVE'` (writer runtime) | **nenhum** em `backend/src` fora de E2E | 🔴 gap — sem writer |
| `'ACTIVE'` em companies | só E2E `validate-pipeline-e2e-pj-company-status-lifecycle.ts` L103-105 ("normalização VERIFIED→ACTIVE, mesma lógica da migration") | ACTIVE só via migration de normalização, não runtime |
| `activateCompanyOperationally` | promove a **PROVISIONAL** (nome enganoso — "activate" não chega a ACTIVE) | Momento 2 do onboarding, não ativação operacional plena |

**Veredito:** lifecycle de runtime para em `PROVISIONAL`. **Não há writer PROVISIONAL → ACTIVE.** `ACTIVE` é alcançável apenas por migration histórica de normalização. Promoção a ACTIVE provavelmente dependerá do futuro `F-PJ-KYB-RELEASE-GATE` (PILAR 1, passo 5). **GAP registrado.**

## D) companies.fiscal_identity_id

| Checagem | Resultado | Risco |
|---|---|---|
| Sempre populado no nascimento fiscal-first? | `createCompany` insere `fiscal_identities` ANTES (L500-509); company recebe `fiscal_identity_id` no INSERT (L514-525) | 🟢 baixo no caminho canônico |
| Ordem fiscal → company | fiscal primeiro; CNPJ único global `uq_fiscal_identities_cnpj` explode antes da company; companies.cnpj = projeção | 🟢 correto |
| Linhas vivas com NULL | 2 companies, **0 NULL** | 🟢 hoje consistente |
| Constraint NOT NULL | **AUSENTE** (`is_nullable = YES`) | 🟠 sem garantia de banco |
| FK | `fk_companies_fiscal_identity` → `fiscal_identities(fiscal_identity_id)` **ON DELETE RESTRICT** | 🟢 protege identidade fiscal |
| Risco legado/backfill | coluna nullable + 94 atores legados no sistema; caminho alternativo de INSERT poderia gravar sem fiscal_identity_id | 🟠 latente — fiscal-first só garantido em código |

## E) Constraints / FKs relevantes

| Tabela | Constraint/FK | Função |
|---|---|---|
| companies | `chk_companies_company_status_lifecycle` | `company_status ∈ {DRAFT,PROVISIONAL,ACTIVE,SUSPENDED}` (ou NULL) |
| companies | `chk_companies_status` | `status ∈ {active,inactive,suspended,closed}` (eixo legado paralelo) |
| companies | `chk_companies_primary_classification_paired` | `(primary_company_type_id, primary_concept_id)` ambos NULL ou ambos NOT NULL |
| companies | `fk_companies_fiscal_identity` → fiscal_identities | ON DELETE **RESTRICT** — empresa não pode orfanar identidade fiscal |
| companies | `companies_primary_concept_id_fkey` → concepts | ON DELETE RESTRICT |
| companies | `companies_primary_company_type_id_fkey` → company_types | ON DELETE RESTRICT |
| companies | `companies_tenant_id_fkey` → tenants | ON DELETE CASCADE |
| companies | `companies_primary_address_id_fkey` → addresses | ON DELETE SET NULL |
| fiscal_identities | `chk_fiscal_identities_kyb_status` | `kyb_status ∈ {pending,approved,rejected,suspended,closed}` — **SSOT de verificação PJ** |
| fiscal_identities | `uq_fiscal_identities_cnpj` (citada no código L588) | CNPJ único global — gênese fiscal-first |
| fiscal_identity_documents | `fk_fidoc_fiscal_identity` | → fiscal_identities **ON DELETE CASCADE** (🔴 risco retenção, ver seção dedicada) |
| fiscal_identity_documents | `chk_fidoc_status` / `chk_fidoc_type` / `chk_fidoc_final_audit` | lifecycle + tipo + audit trail enforced |
| company_users | `chk_company_users_role_valid` | `role ∈ {owner,admin,staff,contractor,member}` |
| company_users | `chk_company_users_member_status_valid` | `member_status ∈ {active,invited,suspended}` |

**Nota dual-status:** `companies` mantém DOIS eixos — `status` (lowercase legado) e `company_status` (lifecycle PJ). `deleteCompany` escreve `status='inactive'`; o lifecycle PJ usa `company_status`. Segunda verdade já registrada.

## Lacunas materiais (fechamento PJ)
1. 🔴 `deleteCompany` inoperante — guard contra tabelas fantasmas (`accounts`/`transactions`). Empresa **não removível** com segurança.
2. 🔴 Sem writer PROVISIONAL → ACTIVE — empresa não atinge estado operacional pleno em runtime.
3. 🟠 `fiscal_identity_id` sem NOT NULL — fiscal-first não garantido por banco.
4. 🟠 Guard de delete deveria consultar `bank_ledger`/`bank_transactions` via **Bank port**, não SQL cru — hoje nem o modelo nem o canal estão certos.
5. 🟡 KYB documental (PILAR 1) ainda não executado — sem provider de storage; `fiscal_identity_documents` vazio (0 linhas).

## Riscos para fechar PJ
- **Remoção segura impossível hoje** (delete quebrado): qualquer "remover empresa" estoura 500. Bloqueia a definição de "PJ fechada".
- **Capability/gating por estado**: se a UI/autorização assume `ACTIVE` para liberar operação, nenhuma empresa chega lá (sem writer) → ou tudo opera em PROVISIONAL (gate frouxo) ou nada opera (gate travado). Confirmar onde o gate de capability lê o estado.
- **Acoplamento financeiro fantasma**: o delete guard sugere intenção de "não apagar empresa com dinheiro" — intenção correta, implementação morta. Ao reescrever, fazer via Bank port consultando `bank_ledger` (verdade de saldo/transação), não via `accounts`/`transactions`.
- **fiscal_identity_id nullable**: backfill ou import futuro pode criar empresa sem identidade fiscal, furando a gênese fiscal-first sem o banco reclamar.

## Recomendações READ-ONLY para a consolidação
1. Tratar `deleteCompany` como **frente própria** (ex.: `F-PJ-DELETE-GUARD-BANK-PORT`): substituir `accounts`/`transactions` por consulta ao Bank (port/serviço) sobre `bank_ledger`/`bank_transactions` filtrando o actor da empresa — **não** SQL cru, **não** tabelas fantasmas. Migration NÃO necessária (só código).
2. Definir o **writer PROVISIONAL → ACTIVE** como parte de `F-PJ-KYB-RELEASE-GATE` (promoção a ACTIVE condicionada a `kyb_status='approved'`). Confirmar se ACTIVE é o estado-alvo operacional pleno antes de implementar.
3. Avaliar tornar `companies.fiscal_identity_id` **NOT NULL** (migration) após confirmar 0 NULL e nenhum caminho de INSERT sem fiscal-first — endurece a gênese no banco.
4. Antes de qualquer delete real, confirmar onde a **capability/gating por estado** lê `company_status` vs `status` (dual-axis) para não autorizar/negar pelo eixo errado.

## STOPs para a executora futura
> 🔴 **NÃO executar `deleteCompany` como está** — estoura HTTP 500 (`relation "accounts" does not exist`). Qualquer fluxo de remoção de empresa está quebrado até a frente do delete guard.

> 🔴 **NÃO reescrever o delete guard com SQL cru contra `bank_*`** — usar Bank port/serviço (protocolo 2.3.2/2.3.3: proibido acesso direto a `bank_ledger`/`bank_transactions`/`bank_accounts` fora de `modules/bank/`). A verdade de "tem dinheiro?" é `bank_ledger`.

> 🔴 **NÃO assumir que empresa chega a ACTIVE** — não há writer de runtime. Lifecycle vivo para em PROVISIONAL. Promoção a ACTIVE é gap a ser preenchido pelo KYB release gate.

> 🟠 **NÃO confiar em `fiscal_identity_id` como sempre presente** em joins/lógica — coluna nullable; garantia é só de código (fiscal-first em `createCompany`). Tratar NULL defensivamente até existir NOT NULL.

> 🟠 **NÃO escrever verificação PJ em `company_status`** — SSOT de verificação é `fiscal_identities.kyb_status` (eixo congelado por DECISION-0089/0090). `company_status` é lifecycle de cadastro, não verificação.

> 🟢 **PILAR 1 (KYB documental) permanece NÃO iniciado** — `F-PJ-DOCUMENT-STORAGE-PORT` travado; pré-condição = verificação READ-ONLY da DECISION-0112 + ADENDO §10. Esta análise é só mapeamento paralelo de banco.

---

## Estado inicial verificado

- **HEAD:** `eba663b5` (`decisions: DECISION-0112 storage documental KYB/PJ (docs-only)`)
- **Branch:** `rescue-structural` ✅ (esperada)
- **Working tree:** limpo, exceto 3 untracked = exatamente os arquivos protegidos (`CRIACAO_DE_EMPRESAS.md`, `criacao-de-empresa.png`, `fluxo-empresa.png`). Nada staged.
- **Migrations aplicadas:** **365** linhas em `schema_migrations`.
  - ⚠️ `schema_migrations` usa coluna **`filename`** (não `version`). Schema: `id serial PK`, `filename varchar(255) UNIQUE NOT NULL`, `executed_at timestamptz`, `checksum`, `execution_time_ms`.
  - **365 arquivos `.sql`** em `backend/migrations/` = 365 aplicadas → **schema em sincronia** (sem migration pendente nem fantasma no runner oficial). O `368` de `ls` inclui `AUDITORIA_MIGRATIONS_COMPLETA.txt`, `desktop.ini` e não-`.sql`.
  - Última aplicada = última no disco: `20260605200000_seed_company_type_service_categories_salon.sql` (2026-06-05).
- **Tabelas base no schema `public`:** **250**.

---

## Documentos lidos

1. `docs/01_normative/00_AGENT_PROTOCOL.md` (íntegra) — bootstrap, modos GUARDIÃO/EXECUTOR, gate 2.3.2, proibições 2.3.3, fronteira financeira de código (§17 baseline `canonical_products`).
2. `docs/01_normative/SSOT_EXCLUSIVE_BANK_RULE.md` (íntegra) — força constitucional; UnifyBank = SSOT financeiro exclusivo.
3. `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md` (seção temporal + seção dinheiro/centavos/ledger).
4. `docs/01_normative/07_NOMENCLATURA_CANONICA.md` (regras de dinheiro/tempo/booleanos).
5. `backend/migrations/` (listagem; últimas ~30).
6. `STATUS_EXECUCAO_GLOBAL.md` (entradas recentes — frente KYB/PJ).
7. `REMEDIATION_DT_LOG.md` (DT-SCHEMA-DRIFT-CLUSTER-5-TABLES íntegra + cabeçalhos).
- _Pendente de leitura profunda (ler sob demanda):_ `CONSTITUICAO_UNIFICARD.md`, `LEIS_OPERACIONAIS_UNIFICARD.md`, `INVARIANTES_OPERACIONAIS_LEDGER.md`, `PROHIBITED_STRUCTURES.md`, `REMEDIATION_DECISIONS_LOG.md`. (`DECISOES.md` **não existe**; o log canônico é `REMEDIATION_DECISIONS_LOG.md`. `MIGRATIONS_FULL.txt` existe na raiz.)

---

## Estado atual do schema

- 250 tabelas base, 365 migrations aplicadas, alinhado ao disco.
- Domínios vivos materializados: **bank/financeiro**, **identity/actor**, **companies/fiscal (KYB/PJ)**, **concepts/semântica**, **temporal (unified_availability + legado schedules)**, **location core (addresses/cities/...)**, **marketplace/products/orders**, **rides**, **escrow**, **governança/regional fund**, **inventory (ledger físico)**.
- Convenção de naming financeiro **majoritariamente respeitada**: dinheiro em `*_cents BIGINT`.

---

## Tabelas críticas por domínio

- **Identity / Actor:** `actors` (PK `id uuid`, `actor_type text NOT NULL`, `global_user_id uuid NULL`, `kyc_limit_cents bigint`), `global_users`, `fiscal_identities`. SSOT identity = `actors` (DECISION-0021/0062). `global_user_id` **nullable** (94 atores legados com NULL — backfill futuro, ver memória 0062).
- **Companies / KYB-PJ (frente ativa):** `companies`, `company_users`, `company_types`, `company_type_allowed_concepts`, `company_type_service_categories`, `company_concept_publications`, `company_validations`, `company_validation_requests`, `fiscal_identities`, `fiscal_identity_documents`, `fiscal_identity_kyb_requests`, `fiscal_identity_economic_activities`, `cnae_concept_suggestions`.
- **Semântica (CONCEPT = SSOT semântico):** `concepts`, `concept_relations`, `concept_labels`, `canonical_concept_resolution_queue`, `tenant_concept_offerings`, `actor_professional_concepts`, `actor_learning_concepts`, `actor_interest_concepts`.
- **Temporal:** SSOT = `unified_availability` + `unified_bookings`. Legado READ-ONLY: `schedules`, `schedule_slots` (existem; WRITE = violação C63).
- **Location core (DECISION-0020):** `countries`, `states`, `cities`, `neighborhoods`, `addresses`, `address_assignments`.
- **Inventory (ledger físico, ≠ dinheiro):** `inventory_balances`, `inventory_movements`, `inventory_reservations`.

---

## `fiscal_identity_documents` — SSOT documental KYB (verificado por SELECT próprio 2026-06-06)

Substrato da frente ativa KYB/PJ (DECISION-0087/0112). **0 linhas hoje; 93 `fiscal_identities`.** Confirmado independentemente (não só via relatório de outra instância).

**Colunas (14):** `document_id uuid PK` · `fiscal_identity_id uuid NOT NULL` (âncora/dono) · `kyb_request_id uuid NULL` · `document_type text NOT NULL` · `document_status text NOT NULL default 'submitted'` · **`file_reference text NOT NULL`** (ponteiro **opaco** — nunca blob/base64/path público) · **`file_hash text NULL`** · `submitted_by_actor_id uuid NOT NULL` · `reviewed_by_actor_id uuid NULL` · `reviewed_at timestamptz NULL` · `decision_reason text NULL` · `supersedes_document_id uuid NULL` (self) · `created_at/updated_at timestamptz NOT NULL now()`.
**Ausentes:** `mime_type`, `size_bytes`, qualquer `bytea`/blob — arquivo bruto **não** mora no banco (alinhado D4/D11; mime/size = adição futura OPCIONAL).

**CHECKs:**
- `chk_fidoc_status`: ∈ {submitted, accepted, rejected, superseded}.
- `chk_fidoc_type`: ∈ {cnpj_registration, articles_of_association, articles_amendment, business_address_proof, complementary_document}.
- `chk_fidoc_final_audit`: status terminal **exige** `reviewed_by_actor_id + reviewed_at + decision_reason` NOT NULL → **audit trail enforced no banco**.

**FKs (com ON DELETE, `confdeltype` verificado):**
- 🔴 `fk_fidoc_fiscal_identity` → `fiscal_identities` **ON DELETE CASCADE** (`c`).
- `fk_fidoc_submitted_by_actor` → `actors(id)` **ON DELETE RESTRICT** (`r`) — protege autoria.
- `fk_fidoc_kyb_request` / `fk_fidoc_reviewed_by_actor` / `fk_fidoc_supersedes` → **ON DELETE SET NULL** (`n`).

**Unique:** apenas a PK (`document_id`). **NÃO há unique em `(fiscal_identity_id, document_type)`** → múltiplos documentos por identidade são permitidos (correto p/ append-only + supersede).

**Veredito migration:** port de storage + user-submit + admin-review = **NENHUMA migration** (SSOT já suporta submit/list/review/supersede). Migration só seria necessária para materializar `mime_type`/`size_bytes`, tornar `file_hash` NOT NULL, criar status de revogação ou política de retenção — tudo decisão de produto, não cravado.

---

## Tabelas financeiras críticas

SSOT financeiro = **UnifyBank** (`SSOT_EXCLUSIVE_BANK_RULE.md`, força constitucional):

- `bank_ledger` — **SSOT contábil de dinheiro** (verdade de saldo).
- `bank_transactions`, `bank_accounts`, `bank_splits`, `bank_settlements`, `bank_policies`, `bank_limit_change_requests`.
- Wallet/recovery/payout: `actor_wallet_payout_requests`, `actor_wallet_recovery_obligations`, `actor_wallet_recovery_obligation_entries`, `payout_requests`.
- Escrow: `escrow_accounts`, `escrow_transactions`.
- Reconciliação: `reconciliation_ledger_discrepancies`, `reconciliation_discrepancies`, `ledger_snapshots`, `ledger_compensations`.
- **NÃO-SSOT (log/snapshot/intenção):** `b2b_payment_intents`, `b2b_order_items`, `payment_intents`, `payment_transactions`, `unifycard_transactions` (LOG), `impact_ledger`/`impact_balances` (impacto, não dinheiro). Não podem virar ledger disfarçado.

---

## Constraints e CHECKs importantes

**`bank_ledger` (blindado):**
- CHECK `amount_cents > 0`; CHECK `direction IN ('credit','debit')`.
- **RLS forçado** (`bank_ledger_rls` por `app.current_tenant` + bypass `unificard_infra`).
- Triggers: `bank_ledger_no_delete` / `bank_ledger_no_update` (`prevent_bank_ledger_modification` — **append-only**), `bank_ledger_non_negative_balance` (`validate_non_negative_balance`), `trg_check_coverage` (`check_coverage_before_credit`), `trg_update_activity`.
- FKs: `account_id → bank_accounts`, `tenant_id → tenants`, `transaction_id → bank_transactions`.

**`bank_accounts`:** CHECK `account_type` (lista de 14: credit/user_wallet/escrow_*/seller_*/platform_*/clearing/.../`actor_wallet`); CHECK `owner_type IN (actor,system,escrow)`; CHECK actor_owner exige `actor_id NOT NULL`.

**`bank_transactions` / `escrow_accounts`:** `amount_cents > 0`. `escrow_accounts.status IN (active,released,refunded,disputed,cancelled)`.

**Wallet payout/recovery:** vários CHECKs de status + amount positivo + `recovered_amount_cents BETWEEN 0 AND amount_cents`; `actor_wallet_payout_requests.destination_type = 'internal_settlement'` (payout externo ainda fechado).

**`company_users`:**
- `chk_company_users_role_valid`: role ∈ **{owner, admin, staff, contractor, member}** ← vocabulário ÚNICO vivo (frente F-PJ-COMPANY-USER-ROLE-VOCABULARY-MISMATCH alinhou contrato/UI a isto).
- `chk_company_users_member_status_valid`: ∈ {active, invited, suspended}.

**`companies` (⚠️ dual-status — ver seção de segunda verdade):**
- `chk_companies_status`: `status ∈ {active, inactive, suspended, closed}` (lowercase).
- `chk_companies_company_status_lifecycle`: `company_status ∈ {DRAFT, PROVISIONAL, ACTIVE, SUSPENDED}` (uppercase) — migration `20260604120000`.
- `chk_companies_primary_classification_paired`: `(primary_company_type_id, primary_concept_id)` ambos NULL ou ambos NOT NULL.

---

## FKs importantes

- `bank_ledger.{account_id,tenant_id,transaction_id}` → `bank_accounts`/`tenants`/`bank_transactions`.
- `bank_accounts.actor_id` → `actors` (via CHECK actor_owner).
- `companies.fiscal_identity_id` → `fiscal_identities` (migration `20260603120000`).
- `categories.concept_id` → `concepts` (ponte category→concept governada; ver protocolo 2.3.5).
- _A mapear em profundidade conforme a frente exigir (não auditado exaustivamente nesta sessão)._

---

## Índices importantes

- `bank_ledger`: PK + `idx_bank_ledger_account`, `idx_bank_ledger_created`, `idx_bank_ledger_transaction`.
- `schema_migrations`: `unique_filename` (UNIQUE), `idx_schema_migrations_filename`, `idx_schema_migrations_executed_at`.
- _Demais índices por tabela: levantar sob demanda com `\d <tabela>`._

---

## Tabelas fantasmas conhecidas

Código vivo referencia tabela que **NÃO existe** no banco (`to_regclass` = NULL). Cluster registrado em **`DT-SCHEMA-DRIFT-CLUSTER-5-TABLES` (OPEN)**. Todas têm migration escrita em `backend/migrations_archive/` (NÃO aplicada pelo runner oficial `migrate.ts`, que só lê `backend/migrations/`).

| Tabela | Existe? | Severidade | Tratamento código | Archive |
|--------|---------|------------|-------------------|---------|
| `company_documents` | ❌ NULL | era DRIFT → **neutralizado** | upload/readers/admin **tombstoned 501** (commits `8180a493`/`dd4e202c`, DECISION-0087); SSOT real = `fiscal_identity_documents` | `0046` |
| `business_audit_logs` | ❌ NULL | ÓRFÃO | try/catch externo (`recordBusinessAuditSafely`) — degrada silencioso | `0922` |
| `company_domains` | ❌ NULL | ÓRFÃO | catch `42P01` explícito | `0404` |
| `company_opportunity_preferences` | ❌ NULL | ÓRFÃO | try/catch interno | `0078` |
| `referral_codes` | ❌ NULL | ÓRFÃO/PLANEJADO | try/catch + retry lazy; `run-migration-073.js` avulso na raiz | `0073` |

**Origem provável:** reorganização das migrations para formato timestamped `20260530XXX_*`; features escritas e nunca convergidas ao banco vigente. Resolução prevista = frente individual por tabela quando dor material aparecer (`feedback_archive_nao_e_ssot.md`: auditoria contextual antes de restaurar).

---

## Drift código × schema

1. **5 tabelas fantasmas** acima (DT-SCHEMA-DRIFT-CLUSTER-5-TABLES OPEN). `company_documents` é o de maior risco histórico (quebrava HTTP 500), hoje tombstoned a 501 — circuito morto, mas a tabela continua ausente.
2. **`services.price_cents` = `integer`** (não BIGINT). Viola nomenclatura canônica (07, linha 444: `_cents` ⇒ BIGINT). Coluna de dinheiro fora do tipo soberano. **Não é o ledger** (services é catálogo de oferta), mas é drift de tipo monetário. Ver alerta abaixo.
3. **`bank_limit_change_requests.requested_amount`** é BIGINT mas **sem sufixo `_cents`** — naming drift menor (tipo correto, rótulo fora da convenção).
4. Verdade temporal: `schedules`/`schedule_slots` ainda existem e há WRITE paths ativos (C63 CRITICAL, IN_PROGRESS via DECISION-0014) — verdade paralela ao SSOT `unified_availability`.

---

## Campos financeiros e tipos de dinheiro

- **Regra canônica (07_NOMENCLATURA §dinheiro):** sufixo `_cents` obrigatório; tipo **BIGINT** (nunca INTEGER); proibido FLOAT/DOUBLE/DECIMAL/**NUMERIC** para dinheiro. `TIMESTAMPTZ` para tempo. Booleanos `is_`/`has_`/`can_`.
- **Varredura:** ~80 colunas `*_cents`/amount/price/balance verificadas → **todas BIGINT**, EXCETO `services.price_cents` (**integer** — drift confirmado).
- **`numeric` no schema = legítimo onde não é dinheiro:** lat/lng (`addresses`, `cities`, `actor_active_location`), scores/confidence (`trust_*`, `actor_reputation`, `*_confidence`), quantidades (`inventory_*`, `order_items.quantity`), percentuais (`bank_splits.percentage`, `treasury_split_config.pct_*`, `rides_distribution_rules.*_percentage`), impacto (`impact_balances.balance`, `impact_ledger.impact_delta`).
- ⚠️ **Atenção a vigiar:** `impact_balances.balance` e `impact_ledger.impact_delta` são `numeric` e nominalmente "balance/ledger" — porém são **impacto social, não dinheiro**. Confirmar que nunca sejam tratados como saldo monetário (seriam violação se promovidos a dinheiro).

---

## Status/lifecycle com risco de segunda verdade

1. **`companies` tem DUAS colunas de status** com vocabulários divergentes e CHECKs separados:
   - `status` (lowercase: active/inactive/suspended/closed) — legado.
   - `company_status` (uppercase lifecycle: DRAFT/PROVISIONAL/ACTIVE/SUSPENDED) — novo (migration `20260604120000`).
   - **Risco:** duas fontes de "estado da empresa" coexistindo. Qual é soberana? Ambas têm CHECK vivo. Pergunta pendente (abaixo). `is_verified` foi **dropada** (migration `20260604130000`) — bom, reduziu uma terceira verdade.
2. **`kyb_status` NÃO está em `companies`** — KYB vive no domínio fiscal (`fiscal_identities` / `fiscal_identity_kyb_requests`). Documento KYB não promove `company_status` (DECISION-0087/0112). Confirmar que nenhum código tenta mexer `company_status` a partir de documento.
3. **Temporal dual:** `unified_availability` (SSOT) vs `schedules`/`schedule_slots` (legado com WRITE ativo, C63).
4. Múltiplos CHECKs de status em payout/recovery/escrow — coerentes, sem segunda verdade aparente.

---

## SSOTs paralelos suspeitos

- **Financeiro:** nenhum ledger paralelo material detectado. Vigiar que `b2b_payment_intents`, `payment_intents`, `unifycard_transactions`, `impact_ledger` **não** virem saldo. `services.price_cents`/`product_*_cents` são oferta comercial, não saldo — OK desde que não persistam "dinheiro movimentado".
- **Identidade:** 3 vocabulários de `actor_type` coexistindo (DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION, ver memória 0062); `chk_actor_requires_identity` inefetiva sobre `actor_type='user'` em runtime.
- **Semântica:** CONCEPT é SSOT; vigiar `category`/`category_id` não ser usado como identidade semântica (protocolo §12). Múltiplas filas de resolução (`canonical_concept_resolution_queue`, `_deprecated_product_concept_resolution_queue`) — a depreciada está marcada.
- **Companies status:** ver dual-status acima (segunda verdade ativa de lifecycle).

---

## Riscos de migration futura

1. **`company_status` × `status`:** qualquer migration que consolide lifecycle de empresa precisa decidir soberania e backfill — não pode introduzir terceira verdade nem deixar CHECKs contraditórios. Migration = cirurgia.
2. **Correção de `services.price_cents` → BIGINT:** `ALTER TYPE integer→bigint` é seguro em PG (widening), mas é migration, **não code-only**. Verificar callers/contratos que assumem int32.
3. **Convergência das 5 tabelas fantasmas:** se restauradas do archive, exige auditoria contextual por tabela (design mudou? há substituto? — `company_documents` já tem substituto SSOT em `fiscal_identity_documents`). Restaurar `0046_company_status_and_documents.sql` cru seria reintroduzir caminho não-SSOT.
4. **C63 temporal:** REVOKE de WRITE em `schedules`/`schedule_slots` (migration `20260428200000` não aplicada) bloqueará writes legados — migrar writers antes.
5. **Frente KYB/PJ docs (DECISION-0112):** storage documental será **port + provider**, metadado mínimo (`mime_type`/`size_bytes`) = adição futura de schema; arquivo bruto **nunca** no banco; `file_reference` opaco. Qualquer migration aqui deve respeitar isso. Port + user-submit **não exigem migration** (verificado).
7. 🔴 **`fiscal_identity_documents` → `fiscal_identities` é ON DELETE CASCADE.** Apagar uma fiscal identity **apaga silenciosamente a evidência documental KYB**. Conflita com retenção probatória/LGPD. Hoje invisível (0 linhas) — exatamente o tipo de risco que só aparece quando já é tarde. Resolver (RESTRICT/SET NULL + política de expurgo) **antes** de existir documento real exige migration. (Confirma/anexa material à D10 da DECISION-0112.)
8. **`file_hash` é nullable.** Integridade/dedupe não garantidos no nível do banco — dependem do port preencher. Tornar NOT NULL = migration + decisão.
6. Toda nova tabela exige RFC/contrato normativo (protocolo 2.3.3) — proibido criar SSOT paralelo ou tabela por suposição.

---

## Queries READ-ONLY úteis

```bash
# carregar conexão (bash)
export $(grep -E '^DATABASE_URL=' /c/unificard/backend/.env | xargs)

# migrations aplicadas (coluna é filename, NÃO version)
psql "$DATABASE_URL" -c "SELECT count(*) FROM schema_migrations;"
psql "$DATABASE_URL" -c "SELECT filename, executed_at::date FROM schema_migrations ORDER BY executed_at DESC LIMIT 15;"

# tabela existe?
psql "$DATABASE_URL" -c "SELECT to_regclass('public.<tabela>');"

# dinheiro fora de BIGINT (caça-drift)
psql "$DATABASE_URL" -c "SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND column_name LIKE '%_cents' AND data_type<>'bigint';"

# CHECKs de uma tabela
psql "$DATABASE_URL" -c "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='<tabela>'::regclass AND contype='c';"

# estrutura completa
psql "$DATABASE_URL" -c "\d <tabela>"
```

---

## Perguntas pendentes para Clayton

1. **`companies.status` vs `companies.company_status`:** qual é a coluna soberana de lifecycle? A `status` (lowercase legada) deve ser deprecada/dropada em favor de `company_status`? Hoje há **duas verdades de estado** com CHECKs vivos divergentes.
2. **`services.price_cents` é `integer`:** confirmar que deve convergir para BIGINT (nomenclatura canônica). É drift consciente ou acidental?
3. **5 tabelas fantasmas (DT-SCHEMA-DRIFT-CLUSTER):** alguma deve ser convergida proativamente, ou todas permanecem "frente por dor material"? `referral_codes` (incentivo econômico — visão do projeto) tem prioridade?
4. **C63 temporal:** quando migrar os 6 WRITE paths de `schedules`/`schedule_slots` para `unified_availability` (DECISION-0014)?

---

## Alertas para a executora unificard

> 🔴 **DUAL-STATUS em `companies`.** Existem `status` (lowercase) **e** `company_status` (uppercase) com CHECKs separados. Antes de qualquer leitura/escrita de "estado da empresa", confirmar QUAL é soberano para o caso — não escrever em ambos sem decisão. Segunda verdade de lifecycle ativa.

> 🟠 **`services.price_cents` é INTEGER, não BIGINT.** Se a frente tocar precificação de `services`, isto é drift da nomenclatura canônica de dinheiro. Corrigir exige **migration** (`ALTER ... TYPE bigint`) — **não passar como code-only**.

> 🟠 **5 tabelas fantasmas vivas no código:** `company_documents` (tombstoned 501), `business_audit_logs`, `company_domains`, `company_opportunity_preferences`, `referral_codes`. Se uma frente exercitar esses caminhos, contar com degradação/501 — a tabela **não existe**. NÃO restaurar do `migrations_archive/` sem auditoria contextual por feature.

> 🟠 **Fronteira financeira (protocolo 2.3.2/2.3.3):** código fora de `backend/src/modules/bank/` **não pode** acessar `bank_ledger`/`bank_transactions`/`bank_accounts` em SQL, nem definir `FOR UPDATE`/lock sobre elas, nem inferir saldo. Saldo só de `bank_ledger`. Se uma frente precisar disso → encapsular no Bank, não furar a fronteira.

> 🟠 **Temporal:** WRITE em `schedules`/`schedule_slots` = violação C63. Estado temporal só em `unified_availability`/`unified_bookings`.

> 🟡 **`actor.global_user_id` é nullable** (94 atores legados NULL). Não assumir não-nulo em joins de identidade.

> 🟡 **Qualquer "vou criar uma tabela / coluna nova":** exige RFC/contrato normativo (proíbe SSOT paralelo). Migration é cirurgia, não decoração. Avisar esta instância para auditar antes.

> 🟡 **Frente ativa = KYB/PJ documental (DECISION-0112).** Storage documental será port+provider; arquivo bruto nunca no banco; metadado mínimo é adição de schema futura. Documento NÃO promove `company_status`/KYB. **Port + user-submit + admin-review NÃO precisam de migration** — o SSOT `fiscal_identity_documents` já suporta submit/list/review/supersede. Não inventar schema desnecessário na fatia.

> 🔴 **`fiscal_identity_documents` tem ON DELETE CASCADE para `fiscal_identities`.** Apagar uma fiscal identity apaga a evidência documental KYB. Antes de existir documento real, decidir retenção (cascade vs RESTRICT/SET NULL + expurgo governado) — é migration. Não deixar passar como "detalhe": evidência legal não pode sumir por cascade.

> 🟢 **Audit trail KYB já é enforced no banco:** `chk_fidoc_final_audit` exige revisor+data+razão para status terminal. Não duplicar essa regra em código como se não existisse; confiar no CHECK.

---
<!-- append-only: acrescentado pela EXECUTORA unificard — 2026-06-06 — não editar/reescrever conteúdo do especialista -->

## Nota de coordenação — ACTIVE vestigial no MVP

Não existe writer runtime `PROVISIONAL → ACTIVE`.

Clayton ratificou que esse writer NÃO deve ser criado no MVP.

`company_status='ACTIVE'` não deve ser usado como:
- proxy de KYB;
- liberação financeira;
- liberação de publicação/oferta;
- autorização operacional.

Capacidades devem continuar dependendo de `fiscal_identities.kyb_status` e dos gates de autoridade.
