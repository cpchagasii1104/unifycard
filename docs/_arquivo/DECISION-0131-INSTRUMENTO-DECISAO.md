# DECISION-0131 — INSTRUMENTO DE DECISÃO (esqueleto docs-only)

**Aguarda os rulings de Clayton.** Tudo em §A (âncoras) e §C (não-GO) é fixo/citado. **Só o §B precisa da sua palavra.** Responda cada item com a letra (ou "confirmar/ajustar"); com suas respostas, Opus monta a DECISION-0131 docs-only e Yala resela. READ-ONLY — não é DECISION até promulgada por você + reseal.

---

## §A — ÂNCORAS (0131 = DECISION-ÍNDICE: CITA, não re-decide)

A 0131 referencia e **não reabre**: DECISION-0021 (Core=jurisdição) · 0042 (membership SSOT) · 0113 (actorId cliente=hint) · 0114/0116 · 0119/0120/0121 · 0124 · 0125 (`can_*` grant fino) · 0126 (tenant-scope) · 0127 · 0128/0129/0130 (aprovação financeira) — e os textos soberanos AUTHORITY_LAW (Art.1.3, 11, 17) · AUTHORITY_ENFORCEMENT_MODEL · 08_AUTORIDADE §10/§11 · SSOT_REGISTRY §5.16 · AUTHORITY_PRECEDENCE.

**A0 —** Confirma este conjunto como a base que a 0131 cita?  → **[ confirmar / ajustar: ___ ]**

---

## §B — DECISÕES (suas)

### B-ABERTAS (arquitetura — escolha real)

**B1 — Cargo-template**
- **A)** Sem catálogo: cargo = só rótulo de UI; nenhuma tabela; atribuir = setar `can_*` manualmente. → zero reuso, inconsistente em escala.
- **B)** Catálogo-template que **materializa**: definição persistida (nome→capabilities); atribuir expande em grants reais; **runtime decide só por grant material ativo, nunca pelo cargo**; `grant_origin`=cargo_template_id; **revogar cargo cascateia** nos grants que ele materializou; alterar template não retroage em silêncio. → reuso+consistência sem virar SSOT de autoridade.
- **C)** Indireção viva (runtime resolve user→cargo→capabilities). **PROIBIDA** — reabre a porta que 0129/0130 fecharam (listada só para cravar fora).
→ **[ B1 = ___ ]**

**B2 — Contrato temporal comum** (hoje 3 vocabulários divergentes nos substratos vivos)
- **A)** Colunas por substrato, todas no MESMO vocabulário (`valid_from`/`valid_until`/`revoked_at`/`suspended_at`/`reason`/`created_by`/`revoked_by`). → simples; `tenant_operator_grants` ganha migration; drift entre substratos contido por guard.
- **B)** Envelope de lifecycle unificado por (grant_type, grant_id), append-only; substrato reflete o ativo-no-tempo; **envelope = auditoria, NUNCA autoridade decisória**. → uma semântica só.
- Em qualquer opção: `financial_approval_authorities` mantém o lifecycle **dentro do Core** (não compartilha envelope) — preserva o isolamento da 0129/0130.
→ **[ B2 = ___ ]**

**B3 — Mapper de identidade canônico** (o mais profundo; sem ele os planos **não compõem**)
- Contexto vivo: `company_users`/`tenant_operator_grants`→`global_user_id` · `financial_approval_authorities`→`user_id` · `actor_delegations`→`actor_id` · `canRepresentActor`→`(userId, actorId)`.
- **A)** `actor_id` é a chave operacional universal (**já é a Lei D2**); mapper explícito `user_id`/`global_user_id`→`actor_id` no ponto de composição; cada plano guarda sua chave de origem mas compõe via `actor_id`. → alinha à Lei de Identidade existente.
- **B)** Função de resolução central que traduz as 3 chaves sob demanda, sem eleger uma universal. → menos migração, mais indireção em runtime.
→ **[ B3 = ___ ]**

**B5 — RLS nos planos de autoridade** (nenhum tem hoje; isolamento é app-level)
- **A)** RLS forçada nos planos de autoridade (como já em `bank_ledger`/`user_roles`). → defesa em profundidade; migration.
- **B)** Manter app-level (`runQueryWithTenant`) + guard de regressão que prova o filtro `tenant_id`. → sem migration; depende de guard.
- **C)** Por plano (RLS nos que gateiam dinheiro; app-level nos demais).
→ **[ B5 = ___ ]**

### B-RATIFICAÇÃO (já determinado por cânone/dado — confirmar ou ajustar)

**B4 — Normalização T6:** `member_status` = SSOT de estado de vínculo (forçado por 0042); `is_active` = projeção/tombstone; `role='owner'` ≠ supergrant eterno em runtime (Art.17). → **[ confirmar / ajustar ]**

**B6 — Platform/cross-tenant:** deferido (P4); `platform_operator_grants` não nasce na 0131; tenant-scope segue em 0126. → **[ confirmar deferimento / abrir agora ]**

**B7 — Vocabulário + hard-rules:** os 5 estados (`CANÔNICO`/`ADAPTADOR_TRANSITÓRIO`/`CONTIDO_FAIL_CLOSED`/`TOMBSTONE`/`DIVERGENTE`) como linguagem da 0131 + hard-rule de jure *"actorId declarado pelo cliente (5 canais 0113 + variante body) nunca é autoridade; binding `canRepresentActor` obrigatório"* + guards de tombstone (incl. **travar o swap** do stub `actor_has_permission`). → **[ confirmar / ajustar ]**

---

## §C — NÃO-GO (fixos, do seu veredito)

- 0131 é **docs-only**: zero código/migration/seed/Bank/worker/endpoint.
- **Seed da 1ª row** em `financial_approval_policies`/`authorities` = **ATO SOBERANO** (DECISION/reseal próprio), nunca migration de dado casual. Idem ligar o stub RBAC e semear delegação ativa.
- **R2/delegação não deve ser ativada como autoridade viva** enquanto houver resíduos 0113/superfícies clássicas sem reseal e enquanto `actor_delegations` não tiver proveniência + E2E de delegação ativa.
- **Cartão físico = DECISION própria (0132+):** scope `physical_card_authorization` (exige migration do CHECK), gate KYB explícito, rehab de dispute/chargeback com binding, plano platform.
- Tombstones com guard anti-reativação; **citar, nunca reescrever** 0013/0042/0113/0125/0126/0128/0129/0130.

---

## §D — Depois das suas respostas

1. **Opus redige a DECISION-0131 docs-only** = (suas respostas §B) + (âncoras §A) + (não-GO §C); cabeçalho com "deriva de / subordinada a" toda a cadeia + AUTHORITY_PRECEDENCE; registro append-only no `REMEDIATION_DECISIONS_LOG`.
2. **Yala resela.**
3. **Verificação em paralelo** (não bloqueia a redação docs-only; **bloqueia execução**): sweep por-handler de `event.routes` (~25 POST) · sweep de superfícies (`/contacts`, `/suppliers`, `/dashboard/metrics/*`, `/groups/mine` + `DT-0113-CLASSIC-CHANNEL-READERS`) · proveniência das 9 delegações revogadas + E2E de delegação ativa.

---

**Resposta mínima esperada (exemplo de forma):** `A0=confirmar · B1=B · B2=A · B3=A · B4=confirmar · B5=C · B6=deferir · B7=confirmar` — com qualquer ajuste de texto que você queira em cada ponto.
