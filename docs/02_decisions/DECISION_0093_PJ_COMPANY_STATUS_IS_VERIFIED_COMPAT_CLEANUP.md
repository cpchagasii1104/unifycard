# DECISION-0093 — Fase 3.1 PJ: compatibilidade de company_status e is_verified

**Status:** PROMULGADA POR CLAYTON — DECISÃO ESTRATÉGICA (Fase 3.1 da reconciliação PJ — destino compatível de `companies.company_status` e `companies.is_verified`, **sem migration agora**). **DOCS-ONLY / SEM CÓDIGO / SEM MIGRATION / SEM SCHEMA / SEM REMOÇÃO DE CAMPO / SEM FRONTEND** (2026-06-04). Fixa a regra de compat/deprecação; **não** implementa, **não** altera schema/campos/frontend, **não** cria migration.
**Sessão:** 2026-06-04 — frente `F-PJ-COMPANY-STATUS-IS-VERIFIED-COMPAT` (pós read-only Fase 3.1).
**Decisor:** Clayton. **Commit âncora:** `ff4792e1` (pós Fase 3.0 — capability social + CNPJ-lock derivam de `kyb_status`; regressão sanada).
**Natureza:** continuação da Fase 3. Após os writers (Fase 2), o display (Fase 1), o gate financeiro (F2-C), a capability social e o CNPJ-lock (Fase 3.0) já estarem ancorados em `kyb_status`, restam os **campos legados** `company_status` e `is_verified`. O read-only Fase 3.1 mostrou que `company_status` **ainda tem função real** (lifecycle/onboarding — PROVISIONAL/DRAFT/SUSPENDED), enquanto `VERIFIED`/`APPROVED` são **valores mortos no write-path**; e `is_verified` é **vestigial** (sem gate). Esta DECISION fixa o destino **compat/deprecação sem migration** e adia CHECK/drop para a Fase 3.3 (após política de dados legados).
**Documento canônico:** este arquivo.
**Deriva de:** `DECISION-0092` (Fase 3 estratégia), `DECISION-0089` (fonte única), `DECISION-0090`/`0091` (writers/FASE 12).
**Subordinada a:** `CONSTITUICAO_UNIFICARD.md`, `AUTHORITY_LAW.md`, `IDENTITY_SSOT_PRECEDENCE.md`, `SSOT_REGISTRY_UNIFICARD.md`, `07_NOMENCLATURA_CANONICA.md`, `LEIS_OPERACIONAIS_UNIFICARD.md`, `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md`.
**Vinculada a:** `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` (atualizada), `DT-PJ-VERIFIED-AT-LEGACY-THIRD-GHOST` (atualizada), `DT-PJ-AUTHORITY-SOCIAL-KYB-GATE-UNVERIFIED` (criada), `DT-PJ-IS-VERIFIED-DEPRECATED-COMPAT` (criada).

---

## 1. Status

PROMULGADA POR CLAYTON. DOCS-ONLY. Registra a **regra de compat/deprecação** de `company_status`/`is_verified` (sem migration), o **adiamento** de CHECK/drop para a Fase 3.3 (gated em política de dados legados) e o **follow-up** de auditoria da authority social. Implementação é fatia compat pequena (executor sem schema).

## 2. Fatos materiais a registrar (read-only Fase 3.1, HEAD `ff4792e1`)

1. `companies.status` é o **lifecycle operacional limpo**: default `active`, CHECK `active/inactive/suspended/closed`.
2. `companies.company_status` (de `0065:23`): default `ACTIVE`, **sem CHECK**, eixo impuro histórico. **Ainda tem função real** de onboarding/lifecycle compat. Writers restantes gravam **só `PROVISIONAL`** (`createCompany` + reset de upload `:1920`); **nenhum writer grava `VERIFIED`/`APPROVED`**.
3. `companies.is_verified` (de `0066:32`): boolean default false; **sem leitor de gate** no domínio companies; só surface/payload compat; **nenhum writer grava true**.
4. `companies.verifiedAt` **não existe** — ghost de código já removido do write-path (Fase 2.5).
5. Display já usa `kybStatus`/`isKybApproved` (Fase 1).
6. Gate financeiro (F2-C) e capability social (Fase 3.0) já usam `fiscal_identities.kyb_status`.
7. `company_status VERIFIED/APPROVED` são **valores mortos no write-path**, mas ainda aparecem em: tipo/contrato (`CompanyStatus`), frontend (`CompaniesManagerForm:785`), comentários stale (`actor-capabilities:38,40`), mensagem stale (`social-votes` cita "validação presencial"=FASE 12), e **possível dado legado em ambiente não-zero**.
8. `company_status` **não pode ser removido agora** — ainda suporta onboarding/lifecycle (guards PROVISIONAL em nascimento/submit/requestValidation + UX).
9. `is_verified` **não deve ser projetado** para `kyb_status` agora (reintroduziria ambiguidade/2ª-verdade).
10. **Não é seguro criar CHECK/migration agora** — ambiente não-zero pode conter `VERIFIED/APPROVED` (o CHECK bloquearia a aplicação sem backfill prévio).
11. **Achado lateral:** `reputation.getPermissions` foi corrigido (Fase 3.0) mas é declarado como **input/métricas, não decisão** (`:252-255`); a autoridade real de post/vote no fluxo vivo é `authorityService.canPerformAction('publish_feed'/'cast_vote')`. É necessário **auditar se essa authority social é KYB-aware** para page-actors (pode haver resíduo na camada de decisão).

## 3. Princípio normativo

A reconciliação chegou ao osso: o que resta não é verdade paralela viva, é **vocabulário/campo legado** que ainda não foi aposentado. Aposentar campo de schema sem política de dados é introduzir risco onde havia dívida estável. Logo a Fase 3.1 **conserva e deprecа** (compat), e a remoção material (CHECK/drop) só ocorre depois que a política de dados legados (3.3) garantir que nenhum ambiente quebra.

## 4. Decisões promulgadas

### 4.1 Regra-mãe (vinculante)
A fonte de verificação PJ continua sendo **`fiscal_identities.kyb_status='approved'`**. **NÃO** são fonte: `company_status`, `is_verified`, `verifiedAt`, frontend state, `company_validation*`, metadata.

### 4.2 `company_status`
- **Manter** por compatibilidade e onboarding/lifecycle nesta fase. `company_status` **NÃO é verificação fiscal**.
- `VERIFIED` e `APPROVED` ficam **deprecated/mortos** (nenhuma lógica nova os produz ou lê como verificação).
- **Não remover** do tipo ainda; **não criar CHECK** ainda.
- **Futuro:** purificar como lifecycle/onboarding (ou aposentar) **após** política de dados legados.
- **Vocabulário compat por ora:** `DRAFT`, `PROVISIONAL`, `ACTIVE`, `SUSPENDED` (lógica nova); `VERIFIED`/`APPROVED` **só** para compat/dados antigos, nunca para lógica nova.

### 4.3 `is_verified`
- Fica **deprecated**. **Não é fonte.**
- **Não** deve ser projetado automaticamente para `kyb_status` nesta fase (evita reintroduzir ambiguidade).
- **Caminho preferido: aposentadoria futura** (após payload/frontend migrarem para `isKybApproved`).
- **Manter no payload** por compatibilidade até executor posterior.

### 4.4 `verifiedAt`
- É **ghost textual** — não existe no schema vivo; **sem migration de dados**. Limpeza futura = higiene textual/código residual.

### 4.5 Migration
- **Fase 3.1 NÃO terá migration.** CHECK de `company_status`, drop de `is_verified` e normalização de dados legados ficam para fase posterior (3.3).

### 4.6 Dados legados
- Em qualquer conflito, **`kyb_status` vence**. `company_status='VERIFIED'` ou `is_verified=true` **não promovem KYB**.
- Ambiente não-zero com valores legados exigirá **política própria antes de CHECK/drop** (3.3).

### 4.7 Authority social (follow-up)
- **Abrir follow-up** para auditar `authorityService.canPerformAction('publish_feed'/'cast_vote')`.
- Objetivo: garantir que a **decisão real** de post/vote de page-actor também respeita KYB, não apenas o input de reputação (`getPermissions`).
- **Não implementar** nesta DECISION (ver `DT-PJ-AUTHORITY-SOCIAL-KYB-GATE-UNVERIFIED`).

### 4.8 Executor posterior (Fase 3.1-A)
Executor compat **pequeno, sem migration**:
- marcar/deprecar `VERIFIED`/`APPROVED` no tipo `CompanyStatus` (comentário/JSDoc) — **sem remover**;
- marcar/deprecar `is_verified`/`isVerified` (JSDoc apontando para `isKybApproved`);
- limpar comentários stale (`actor-capabilities`);
- limpar mensagens que citam validação presencial morta (`social-votes`);
- **não** remover campos; **não** alterar schema; **não** projetar `isVerified`.

## 5. Ordem de implementação futura (vinculante na sequência)

```text
Fase 3.1-A — executor compat SEM migration:
  - deprecações textuais (tipo CompanyStatus VERIFIED/APPROVED; is_verified/isVerified);
  - comentários stale (actor-capabilities); mensagens stale (social-votes);
  - documentação de payload; ZERO schema.
Fase 3.1-B — auditoria authority social (READ-ONLY):
  - authorityService.canPerformAction('publish_feed'/'cast_vote');
  - page-actor/PJ pending vs approved; decidir se precisa gate KYB adicional.
Fase 3.2 — UX/vestígios:
  - QR/requestValidation; company_validations; partner_employees;
  - higiene final de verifiedAt.
Fase 3.3 — dados legados + migration:
  - política para ambiente não-zero; backfill company_status VERIFIED/APPROVED;
  - possível CHECK de company_status; possível drop de is_verified;
  - possível deprecação final de payload legado.
```

**Ordem recomendada (anotação Clayton):** rodar a **auditoria authority social (3.1-B)** **antes** do executor compat textual (3.1-A) — "primeiro garantir o portão, depois limpar a placa". Se `authorityService` ainda não for KYB-aware para page-actor, isso é mais crítico que comentário stale.

## 6. O que fica fora (vinculante)

implementação/código · migration/schema · CHECK em `company_status` · drop de `is_verified` · projeção de `is_verified` · normalização de dados legados · alteração de frontend · alteração do gate F2-C · Bank/ledger/split · KYC PF/`identities`.

## 7. Superada por

(em aberto — decisão vigente)
