# MARKETPLACE — plano oficial na raiz (registo)

**Data:** 2026-04-14  
**Evento:** Criação do documento governado **`PLANO_MARKETPLACE_REFATOR_ARQUITETURAL.md`** na raiz do repositório.

**Conteúdo do plano (resumo):**

- Base normativa explícita: `00_AGENT_PROTOCOL`, `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD`, `07_NOMENCLATURA_CANONICA`, `SSOT_REGISTRY_UNIFICARD`, referência a `SSOT_EXCLUSIVE_BANK_RULE`.
- **FASE S:** `STATUS: INCONSISTENTE` — encadeamento com `MARKETPLACE-AUDIT-20260414.md` e `MARKETPLACE-SCHEMA-FIX.md`.
- Blocos **BLOCO S** (schema), **BLOCO 1** (writers), **BLOCO 2** (readers) — BLOCO 1/2 bloqueados até `FASE S = OK`.
- **EXECUTION LOG** inicial no próprio plano.
- Proibições: não usar archive directamente sem adaptação; não criar tabela sem `07`.

**Próximo passo operacional:** preencher tabela de decisões §7 do plano e abrir PR(s) de migrations forward-only após revisão de FKs.

**Actualização (mesmo dia):** plano passou a **v1.1** com **§2.1** ordem de precedência (ATL > KYC > GUARDA > SISTEMA > PRODUTO), **§2.2** Gates SSOT (0 fechado; 1 Registry; 2 bloqueio estrutural activo; 3 fechado), **§2.3** bloqueios Gate 2 e remissão a `docs/ssot/FALSIFICATION_LOG.md` em violação.

**Actualização v1.2:** **§2.4** execução controlada (Cursor: plano + log + declaração normativa/Gate; sem registo = não executado), **§2.5** loop operacional por sessão, **§2.6** checklist pré-migration, **§2.7** grafo multi-domínio e fronteiras marketplace vs Bank.

**Actualização v1.3:** **§2.8** modo restrito (sem migrate automático, sem decisão de schema só), **parada obrigatória** em 5 situações, formato **PROPOSTA** / **APROVADO: opção X**, auditoria contínua, **invalidação** se faltar plano+log+justificativa normativa.

**Actualização v1.4:** **§2.9** ordem de ataque obrigatória (5 níveis de prioridade); regra **dúvida → PROPOSTA**; nota sobre candidatos iniciais de baixo risco (`referral_codes`, `tax_profiles`).

**2026-04-14 — PROPOSTA `referral_codes`:** análise no Agent (grep, archive `0073`, query BD); §7.1 + EXECUTION LOG no plano; **sem** migration executada; **sem** alteração de código.

**2026-04-14 — PROPOSTA refinada:** modelo de domínio `users.referral_code` vs `referral_codes` documentado no plano (§7.1); fecho da ambiguidade §2.8 para esta entidade; ainda **sem** APROVADO para DDL.

---

Documento canónico: **`PLANO_MARKETPLACE_REFATOR_ARQUITETURAL.md`** (raiz).
