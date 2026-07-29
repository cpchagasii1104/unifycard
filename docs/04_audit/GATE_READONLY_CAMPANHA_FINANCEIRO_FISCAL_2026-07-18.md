# GATE READ-ONLY — CAMPANHA FINANCEIRO / FISCAL / CONTÁBIL (pós-selos A/C/D)

**MODO: GUARDIÃO** · 2026-07-18 · read-only absoluto
**HEAD:** `8397b41cb` · **Worktree:** `C:\unificard` @ `rescue-structural`
**Escrita autorizada:** SOMENTE este arquivo. Zero commit/selo/material/migration/DDL/DML; banco só leitura.
**Âncoras normativas lidas:** `00_AGENT_PROTOCOL` (§2.2/§2.3.2/§8), `CONSTITUICAO` (Art. I/V/VIII/X), `LEIS_OPERACIONAIS` (Lei 5/7), `AUTHORITY_LAW`, `AUTHORITY_ENFORCEMENT_MODEL`, `ACTOR_TRACEABILITY_CONTRACT`, `SSOT_EXCLUSIVE_BANK_RULE`, `SSOT_REGISTRY` (§5.2/§5.9.2/§5.16), `DECISION-0113` (actionContext=hint; canRepresentActor), `DECISION-0114` (Fundo Regional é da plataforma), `DECISION-0166` (Lei do Contador — fiscal é PROVISÃO/estimativa, nunca apuração; `fiscal_config_missing`), `DECISION-0177/0020` (localização soberana). N0/N1/N2/ontologia: verificados intactos (diff-zero).

---

## 0. VEREDITO EXECUTIVO
A campanha **é elegível para MATERIAL PARCIAL** (read-models honestos de Bank/contábil-projeção + higiene de frontend), **condicionada a UMA decisão soberana** (matriz de autoridade de leitura) e **bloqueada** para a parte fiscal-de-negócio (provisões/reservas) enquanto o motor fiscal permanecer **dormente** e a autoridade fiscal não for promulgada. **Nada aqui move dinheiro, materializa Invoicing, ativa fiscal, abre PORTA 01, ou depende de D9.2-B / B-CITY-2.**

---

## 1. CONFIRMAÇÃO DOS SELOS E DO RUNNER (sem reabrir fatias)
- **SELO D** (Fatia D · endpoint `GET /bank/regional-fund` via portas do Bank), **SELO A** (Fatia A · viewer Actor Page + perfil efêmero governado), **SELO A/PROCESSUAL** e **SELO B** (Fatia C · contenção fail-closed do Invoicing) — todos **restritos**, registrados no cartório (`REMEDIATION_DT_LOG.md` topo). Não reabertos.
- **Runner canônico** (última reprodução independente pela YALA no HEAD): **192/192 · exit 0 · 0 GATE FAIL**. Typecheck backend (`tsconfig.build`) e frontend = 0.
- **DTs abertas relevantes:** `DT-UNIFYBANK-CORE-DIRECT-BANK-LEDGER-SQL` (OPEN·PARCIAL — dívida-irmã), `DT-EPHEMERAL-MIGRATION-PROFILE-UNGOVERNED` (OPEN·PARCIAL), `DT-INVOICING-HARDCODED-TAX-RATE` (OPEN·PARCIAL). Nenhuma a fechar aqui.

## 2. DT-SOCIAL-AUDIENCE-PARALLEL-READERS-BYPASS — **CORREÇÃO FACTUAL: NÃO É P0; ESTÁ CLOSED NO HEAD**
O prompt presumiu esta DT OPEN/BLOCKING/alcançável. **Verificado de 1ª mão que NÃO é o caso.** A entrada de cartório mais recente (topo, ~linha 1673) sela `CLOSED · SELADA PELA YALA`; a entrada `OPEN·BLOCKING` (~linha 1720) é **anterior e superada**. Prova no código vivo (HEAD `8397b41cb`):
- casa canônica `modules/social/post-audience.house.ts` viva (`postAudiencePredicateSql`/`canViewPost`/`resolveViewerResidenceCity`);
- os 3 readers de conteúdo (`getFeed`/`getActorPosts`/`getActorCounts` em `social-2.0.service.ts:270/1326/1490`) **compõem** o predicado; detalhe-por-id via `canViewPost` (`:1253`, null→404);
- `/api/feed` legado **410** (`services/feed/feed.routes.ts:20`);
- os `FROM posts` em `core/feed/feed.routes.ts:191/210/248` são **contadores agregados** de badge (ratificados DECISION-0115 D1), não disclosure; group readers são member-scoped;
- **guard `audit-social-territory-city-audience` = GATE OK** no HEAD ("nenhum reader de conteúdo sem compor a casa; dead-at-db contidos").
**Conclusão:** não há bypass de conteúdo alcançável. **A DT NÃO é um P0 pré-campanha.** (Se surgir prova de um reader vivo específico não coberto, abrir microfatia própria — mas nada disso apareceu.)

## 3. SUBSTRATO FISCAL/CONTÁBIL — ESTADO REAL (unificard_dev, read-only)
| Objeto | Existe? | Rows | Natureza |
|---|---|---|---|
| `actor_fiscal_profiles` | EXISTS | **0** | casa fiscal canônica (DECISION-0166 4b) — VAZIA |
| `tax_types` / `tax_rules` | EXISTS | **0** / **0** | catálogo fiscal governado 4c — nasce VAZIO por design |
| `fiscal_provision_logs` | EXISTS | **0** | log de provisão — VAZIO |
| `fiscal_provision_events` | **ABSENT** | — | 4E — substrato DORMENTE, nunca aplicado em dev |
| `fiscal_reserve_accounts` | **ABSENT** | — | 4E — DORMENTE, nunca aplicado em dev |
| `bank_splits.split_type='tax_reserve'` | — | **0** | nenhuma reserva fiscal real |
| `bank_accounts.account_type='fiscal_reserve'` | — | **0** | nenhuma conta fiscal provisionada |
| `bank_ledger` / `bank_transactions` / `bank_splits` | EXISTS | **0/0/0** | Δbank=0 |
| `bank_accounts` / `regional_fund_accounts` | EXISTS | **16 / 1** | substrato Bank + fundo Curitiba |
| `economic_policies` / `economic_policy_lines` | EXISTS | **45 / 75** | policies de split de comissão (config do money-path) |
| `invoices` / `invoice_items` | **ABSENT** | — | schema-ghost (só `migrations_archive/0212`) |

**Wiring:** `fiscal-provision.service`, `fiscal-economic-policy-composition.service`, `fiscal-reserve-account.resolver`, `fiscal-reserve-bank-composition.service` **existem** mas com **ZERO caller de money-path** (grep de `fiscalReserveBankComposition`/`composePlatformCommission` fora do próprio arquivo/testes = vazio). **FISCAL-4E SELADA e DORMENTE** (cartório: caller zero, firewall OFF, PORTA fechada, Δbank=0). **Veredito:** o motor fiscal é **infraestrutura DORMENTE** — materializada em parte, sem dados reais, sem integração ao money-path, sem apuração.

## 4. READ-MODELS / ROTAS FISCAL-CONTÁBEIS VIVAS — o que existe de fato
**Financeiro Bank VIVO (materialmente provado):** `GET /bank/balance`, `GET /bank/statement`, `GET /bank/actor-statement`, `GET /bank/regional-fund` (selo D), `GET /bank/transaction/:id/splits`, admin `GET /admin/finance/consolidated-balance*` (admin-gated). Saldo = `bank_ledger` (único SSOT).
**Fiscal VIVO — exatamente UMA superfície honesta:** `GET /companies/:companyId/fiscal-template-checklist` (`companyTemplatesRoutes`, montado `/companies`; DECISION-0170) — **read-model de CHECKLIST sugerido**, authority-gated (`canManageCompany`), **read-only, sem cálculo, disclaimer "configuração sugerida — requer validação"**. NÃO é apuração/provisão/imposto. **Não consumido pelo frontend hoje.**
**KYB fiscal-identities** (`/identity/pj/kyb/fiscal-identities/*`): domínio de **identidade fiscal (CNPJ)**, não apuração.
**Invoicing:** módulo montado (`app.builder:597-598`) porém **fail-closed 503 `INVOICE_MODULE_UNAVAILABLE`** (Fatia C/R-6) antes do schema-ghost. Rotas de invoice do frontend **comentadas**.
**AUSENTES (nenhuma rota viva):** provisões fiscais, reservas fiscais, catálogo tax_rules exposto, projeções contábeis, "contábil" read-model, documento fiscal oficial. **Confirmado: não há read-model fiscal/contábil vivo além do checklist sugerido + Bank.**

## 5. FRONTEND — superfícies e higiene (coerência N1/N2)
- **Vivas honestas:** `/banco`,`/bank`→WalletPage (saldo/extrato reais); `/fundo-regional`→RegionalFundUser (estados territoriais honestos pós-Fatia D); card home "Fundo Regional" honesto.
- **`/extrato`** = `Navigate` para `/banco` (não há página de Extrato própria — oportunidade de superfície própria).
- **FANTASMA a higienizar:** `/ledger`→`SocialLedger` **MONTADA** mas `api/social.ts getLedger/getLedgerSummary` lançam **`NOT_IMPLEMENTED`** (social-ledger em extinção, SSOT_EXCLUSIVE_BANK_RULE §4) → a página sempre erra. **"Ledger Social" no menu é fantasma** — deve ser retirada/reconvertida a extrato do Bank.
- **`/financial-dashboard`**→FinancialDashboardPage (montada; "Financial & Compliance") — não é fiscal-apuração; auditar escopo antes de expandir.
- **Invoices:** rotas comentadas (module-fantasma) — corretamente não expostas.
- **Nenhuma página Fiscal/Contábil existe.** Nenhum cálculo fiscal no cliente. `fiscal-template-checklist` não tem consumidor front.

## 6. RFC CANDIDATO — SEPARAÇÃO (promulgado × soberano × executor-implementável)
Artefato: `docs/02_decisions/RFC_FINANCIAL_FISCAL_READ_AUTHORITY_DECISION_PACK.md` — **CANDIDATO, docs-only, NÃO PROMULGADO** (banner de não-promulgação + §4.3 já registrados; não ocupa número DECISION).
- **JÁ PROMULGADO (não precisa de nova decisão — só executar):** primitivo de autoridade `actorId ∈ canActAs(req.user)` / `canRepresentActor` (DECISION-0113); Bank como SSOT único e contábil = projeção (Lei 5 / SSOT_EXCLUSIVE_BANK_RULE); fiscal = provisão/estimativa `fiscal_config_missing`, nunca apuração (DECISION-0166); Fundo Regional é da plataforma, transparência ≠ movimentação (DECISION-0114 / 0184 D15); residência canônica territorial (0177/0020); raiz humana e "authority não nasce de role" (AUTHORITY_LAW art. 17).
- **AINDA SOBERANO DO TITULAR (decisão nova exigida antes de expor):** (a) **matriz de autoridade de leitura** D-1..D-11 — quem vê saldo/extrato pessoal, saldo/extrato de empresa (e QUAL capability de `company_users`), provisões/reservas fiscais, projeções contábeis, transparência vs administração do fundo, auditoria de plataforma, exportação/retenção LGPD, segregação PII; (b) **existência de uma capability financeira de LEITURA em `company_users`** (hoje inexistente — decisão dependente); (c) **capability fiscal de representação** (contador delegado) — inexistente; (d) se a superfície fiscal expõe apenas "estimativa" (4E dormente) ou aguarda ativação.
- **EXECUTOR PODE FAZER SEM DECISÃO NOVA (governado por norma já vigente):** read-models de **Bank** (saldo/extrato/regional) contract-first reusando `canRepresentActor`/`canManageCompany`; **contábil = projeção** sobre `bank_ledger` (sem 2º ledger); **higiene de frontend** (retirar Ledger Social fantasma; Extrato próprio; estados honestos); **contratos candidatos + testes de contrato + matriz de autorização** SEM montar rota protegida nova; manter Invoicing/fiscal-provision **fail-closed/dormentes** com estados honestos.

## 7. MATRIZ DE AUTORIDADE DE LEITURA (INSUMO — não decide pelo titular)
Regra-mãe (todas as linhas): sujeito provado server-side (`req.user → canActAs/canRepresentActor`); ausência de autoridade → **403/neutro** (não revela existência); **falha de infra → 5xx** (nunca `false`/zero/vazio); tenant-scoped + RLS; leitura não cria estado.

| # | Recurso | Sujeito legítimo | Prova server-side | Sem autoridade | Falha técnica |
|--:|---|---|---|---|---|
| D-1 | Saldo pessoal | actor dono / representante | `canRepresentActor` | 403/neutro | 5xx |
| D-2 | Extrato pessoal | idem | `canRepresentActor` (mascarar contrapartes PII) | 403/neutro | 5xx |
| D-3 | Saldo/extrato de EMPRESA | membro c/ capability financeira | `canManageCompany` + capability de leitura (**a criar — decisão**) | 403/neutro | 5xx |
| D-4 | Projeção CONTÁBIL | = sujeito do recurso-fonte | herda D-1/D-3 (sem 2º ledger) | 403/neutro | 5xx |
| D-5 | Provisões fiscais (estimativa) | contribuinte-actor / representante fiscal | `canRepresentActor` (+ capability fiscal **a definir**) | 403/neutro · rótulo "reserva fiscal estimada" | 5xx |
| D-6 | Reservas fiscais (4E dormente) | plataforma/contribuinte conforme titularidade | capability fiscal governada (**inexistente**) | **HOLD** até 4E ativar | 5xx |
| D-7 | Transparência PÚBLICA do Fundo Regional | residente da cidade (agregado) | residência canônica → cidade; agregado sem PII | estado territorial honesto | 5xx |
| D-8 | Administração do Fundo Regional | detentor grant `regional_treasury` | `actor_capability_grants` (**DORMENTE, grants=0**) | **HOLD** (B-CITY-2) | 5xx |
| D-9 | Auditoria/plataforma cross-tenant | Risk/Platform Authority | capability de plataforma explícita (sem chave-mestra — Const. I §4) | 403/neutro | 5xx |
| D-10 | Exportação/retenção (LGPD) | titular / base legal | ownership + base legal | 403 | 5xx |
| D-11 | PII / segregação tenant×actor | — (transversal) | RLS FORCE + tenant + representação | 403/neutro | 5xx |

## 8. CONTRATOS CONTRACT-FIRST (candidatos — §2.2.8; NÃO montar rota antes da decisão de autoridade)
- **Bank saldo/extrato:** `{ balanceCents, currency }` / `{ entries[], summary }` — SSOT `bank_ledger`; autoridade herdada; Δbank=0. (Já vivo; catalogar em `API_CONTRACT_GOVERNANCE §5` qualquer evolução.)
- **Contábil/projeção:** shape derivado do `bank_ledger` (agregações), **sem 2º ledger**; mesma autoridade do saldo-fonte; nunca decide dinheiro.
- **Fiscal (provisões/reservas):** `{ taxReserveEstimatedCents: number|null, label:'reserva_fiscal_estimada', state:'found'|'fiscal_config_missing' }` — **estimativa interna, NUNCA "imposto oficial devido"** (DECISION-0166); enquanto 4E dormente → `fiscal_config_missing` honesto.
- **Documentos fiscais:** **Invoicing NÃO materializado** — contrato declara `INVOICE_MODULE_UNAVAILABLE`/schema-ghost; nenhuma emissão/NF-e; nenhum "issued" como oficial.
- **Fundo Regional territorial:** `RegionalFundView` **selo D preservado** (byte-idêntico; portas do Bank; residência canônica; sem mono-fundo; `currentBalanceCents number|null`, zero só quando ledger prova zero). Evoluir SEM tocar o selo.

## 9. SUPERFÍCIES FRONTEND COERENTES COM N1/N2 (projeção, não decisão)
`Financeiro`: UnifyBank (saldo) · **Extrato próprio** (hoje só redirect) · Em processamento/Limite (placeholders "—", honestos) · Fundo Regional (estados honestos, selo D). `Fiscal` (read-only): situação cadastral · regime · **reserva fiscal ESTIMADA** · configuração pendente (`fiscal_config_missing`) · elegibilidade de emissão · aviso "não substitui contador"; **checklist de segmento** (DECISION-0170) já existe honesto. `Contábil`: projeções sobre o Bank. **Estados honestos obrigatórios:** ausência (sem residência/config) ≠ zero; indisponibilidade (módulo não materializado → mensagem, não R$ 0,00); erro técnico → não vira ausência. **Retirar "Ledger Social" fantasma** (NOT_IMPLEMENTED). **Nenhum cálculo fiscal no cliente; frontend não decide região/valor/regime.**

## 10. D9.2-B / B-CITY-2 — **NÃO são dependências causais desta campanha**
- **D9.2-B** (cutover de membership de Groups) — sem relação causal com read-models financeiro/fiscal; só entraria se tesouraria coletiva de grupo virasse superfície financeira (não é o caso). **FORA.**
- **B-CITY-2** (composição regional monetária / grants `regional_treasury` / PORTA) — é **movimentação/ativação**, não leitura. A transparência do Fundo Regional (D-7) já é read-only e não depende dela; a **administração** do fundo (D-8) depende de grants B-CITY-2 → fica **HOLD** (não é pré-requisito para os read-models de leitura). **FORA** da campanha de read-models; só a linha D-8 permanece bloqueada por ela.

## 11. ORDEM CAUSAL + ENVELOPE EXECUTOR
**Blockers ativos:** (B1) matriz de autoridade de leitura **não promulgada** (decisão soberana); (B2) capability financeira de leitura em `company_users` inexistente (decisão dependente de B1); (B3) motor fiscal DORMENTE → superfície fiscal só pode expor "estimativa/pending", não apuração; (B4) capability fiscal de representação inexistente.

**Ordem causal:**
1. **[TITULAR — decisão soberana]** ratificar a matriz D-1..D-11 (§7), incl. capability financeira de leitura e política fiscal (estimativa vs HOLD). Só então promulgar a DECISION.
2. **[EXECUTOR — sem decisão nova]** higiene de frontend + read-models de Bank/contábil contract-first (governados por norma vigente).
3. **[EXECUTOR — após B1]** montar rotas protegidas dos read-models fiscais (estimativa/pending) com a matriz como teste de autorização.
4. **[frente própria, GO próprio]** ativação fiscal 4E / B-CITY-2 / Invoicing material — **fora**.

**ENVELOPE EXECUTOR (amplo; commits monotemáticos; NÃO promulga decisão):**
- `commit 1 — higiene frontend`: retirar/reconverter "Ledger Social" (NOT_IMPLEMENTED) → extrato do Bank; **Extrato próprio** em `/extrato` (deixar de ser só redirect); estados honestos de ausência/indisponibilidade nos cards; **zero fictício proibido**; guard front de "sem zero falso" (reusar `audit-c1-human-journey-closure` que já veda). Frontend typecheck+build.
- `commit 2 — read-model Bank (contrato)`: catalogar `GET /bank/balance` e `GET /bank/statement` em `API_CONTRACT_GOVERNANCE §5` (contract-first, autoridade `canRepresentActor`); teste de contrato; nenhum comportamento novo além do catalogado.
- `commit 3 — projeção contábil (read-only)`: read-model contábil = agregação derivada de `bank_ledger` via **porta do Bank** (nunca SQL direto em `core/unifybank` — respeitar `DT-UNIFYBANK`), autoridade herdada; sem 2º ledger; guard de fronteira Bank; teste.
- `commit 4 — fiscal read-only honesto (estimativa/pending)`: read-model que projeta `actor_fiscal_profiles`/`fiscal_provision_logs` como **"reserva fiscal estimada" / `fiscal_config_missing`** (rótulo obrigatório; nunca "imposto devido"); Invoicing permanece 503; guard `audit-invoicing-no-hardcoded-tax` mantido; teste de contrato dos estados.
- `commit 5 — matriz de autorização (testes + contratos candidatos)`: fixtures + testes adversariais (dono/representante/terceiro/plataforma/infra-down) por recurso D-1..D-11, **sem montar rota protegida** (aguarda B1). Guard de authority-boundary reusado.
- `commit 6 — cartório + execution log`: registrar como MATERIAL IMPLEMENTADO · AGUARDA YALA; DTs não fechadas; pacote YALA.
- **Pacote YALA:** vereditos por superfície; prova de `canRepresentActor`/`canManageCompany`; prova de fail-closed (403/5xx); prova de "ausência ≠ zero"; Δbank=0; fronteira Bank respeitada (portas, não SQL direto); confirmação de que fiscal continua estimativa/dormente e Invoicing 503.

## 12. EXPRESSAMENTE FORA DESTA CAMPANHA
Promulgar a matriz em nome do titular; ativar/integrar o motor fiscal 4E; materializar `invoices`/emitir NF-e; declarar apuração fiscal; criar capability/grant real; abrir PORTA 01; B-CITY-2 material / composição regional monetária; D9.2-B cutover; mover dinheiro; fechar `DT-UNIFYBANK`/`DT-EPHEMERAL`/`DT-INVOICING`; SQL direto a `bank_*` em `core/unifybank` (usar portas); alterar N0/N1/N2/ontologia/vocabulário; reconciliar `schema_migrations` do dev; tocar `02_decisions_FULL.txt` ou relatórios YALA.

## 13. DECLARAÇÃO FINAL
Auditoria read-only; nenhum código/guard/migration/cartório/DT/banco alterado; única escrita = este relatório. HEAD `8397b41cb`; `unificard_dev` intocado (Δbank=0). **Veredito:** MATERIAL PARCIAL ELEGÍVEL (Bank read-models + higiene frontend) sob a norma vigente; **1 decisão soberana** (matriz de autoridade) destrava a exposição fiscal-de-negócio; fiscal permanece **estimativa/dormente**; Invoicing **não materializado (503)**; D9.2-B/B-CITY-2 **não são dependências causais**; a `DT-SOCIAL-AUDIENCE` **NÃO é P0** (está CLOSED no HEAD).
