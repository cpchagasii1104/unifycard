# MARKETPLACE-SCHEMA-FIX — FASE S (fechamento)

**Data:** 2026-04-14  
**Contexto:** seguimento a `MARKETPLACE-AUDIT-20260414.md` (18 tabelas “ausentes” no PostgreSQL local).  
**Nota:** não foi criada migration nova nesta sessão — **causa raiz** e **decisões** estão abaixo; promoção de DDL exige revisão de FKs com `tenants(id)` / `actors(id)` atuais.

---

## 1. Veredito

| Pergunta | Resposta |
|----------|----------|
| FASE S do marketplace está **consistente** neste ambiente? | **Não** — várias relações referenciadas pelo código **não existem** em `public`. |
| `pnpm migrate` aplica tudo o que falta? | **Não** — o runner está alinhado à cadeia `backend/migrations/*.sql` (211 ficheiros); **219** entradas já registadas; **nada pendente** a aplicar. As tabelas em falta **não estão** nessa cadeia. |
| Onde está o DDL “perdido”? | Quase tudo está em **`backend/migrations_archive/`**, não promovido para `migrations/`. |

---

## 2. Errata à auditoria anterior (lista de 18)

| Item | Correção |
|------|----------|
| `order_revenue` | **Não é tabela.** Em `real-margin.service.ts` é nome de **CTE** (`WITH order_revenue AS (...)`). Contagem “18 ausentes” deve ser **17 tabelas físicas** + 1 falso positivo. |
| `payment_intent_splits` | **Tabela física** referenciada em SQL (ex.: `real-margin.service.ts`, `financial-report.service.ts`). **Não** há `CREATE TABLE` em `backend/migrations/**/*.sql` nem em `migrations_archive` (grep global). Risco: **código órfão de DDL** ou DDL noutro repositório não sincronizado. |
| `payment_transactions` | Referenciada em `real-margin.service.ts`. No BD local verificado, **também ausente** (query pontual). Mesma categoria de risco. |

---

## 3. Classificação das 17 tabelas (exceto `order_revenue`)

Legenda: **A** = existe ficheiro em `migrations_archive/` com `CREATE TABLE`; **N** = não encontrado em archive na triagem inicial.

| # | Tabela | Migration em `migrations/`? | Archive (referência) | Observação |
|---|--------|-----------------------------|----------------------|------------|
| 1 | `business_segments` | Não | `migrations_archive/0048_business_segments.sql` | FK/colunas: validar contra `tenants(id)` atual |
| 2 | `contacts` | Não | `migrations_archive/0065_contacts.sql` | Idem |
| 3 | `groups` | Não | `migrations_archive/0052_groups_system.sql` | Possível sobreposição com domínio social; **não** promover sem decisão de produto |
| 4 | `product_attributes` | Não | `migrations_archive/0401_product_attributes.sql` | |
| 5 | `company_profiles` | Não | `migrations_archive/0071_company_profiles.sql` | Archive usa `tenants(tenant_id)` — **incompatível** com genesis `tenants(id)` sem adaptação |
| 6 | `commission_rules` | Não | `migrations_archive/0150_commission_rules.sql` | |
| 7 | `event_settlements` | Não | `migrations_archive/0215_event_settlements.sql` | Nome colide semanticamente com domínio `events` |
| 8 | `fiscal_documents` | Não | `migrations_archive/0193_fiscal_documents.sql` | Inclui `fiscal_document_items` no mesmo ficheiro |
| 9 | `fiscal_document_items` | (idem) | (idem) | |
| 10 | `fiscal_provider_attempts` | Não | `migrations_archive/0628_fiscal_provider_attempts.sql` | |
| 11 | `inventory_adjustments` | Não | `migrations_archive/0619_inventory_adjustments.sql` | |
| 12 | `payment_methods` | Não | `migrations_archive/0141_payment_methods.sql` | |
| 13 | `regional_fees` | Não | `migrations_archive/0189_regional_fees.sql` | |
| 14 | `tax_profiles` | Não | `migrations_archive/0072_tax_profiles.sql` | |
| 15 | `unifycard_payment_methods` | Não | `migrations_archive/0142_unifycard_payment_methods.sql` | |
| 16 | `referral_codes` | Não | `migrations_archive/0073_referral_codes.sql` | |
| 17 | `payment_intent_splits` | **Não** | **Não localizado** | Depende de desenho: alinhar a `bank_splits` / Bank ou criar tabela de aplicação |

---

## 4. Uso no código (amplitude)

- **Repositórios com INSERT/UPDATE** — uso **ativo** para a maioria das linhas 1–16 (ver auditoria §3).
- **`payment_intent_splits` / `payment_transactions`** — leitura em relatórios; sem DDL no repo = **bloqueio funcional** para queries que as referenciam.

---

## 5. Decisão recomendada (por tabela)

| Caso | Ação recomendada |
|------|------------------|
| Linhas 1–16 com DDL em archive | **Opção A (preferida):** promover para **`backend/migrations/YYYYMMDDHHMMSS_*.sql`**, **adaptando** FKs para `tenants(id)`, `actors(id)`, enums e RLS ao padrão actual — **uma ou poucas** migrations bem revistas (não copiar/colar cegos). |
| `groups` | **Parar:** decidir se a tabela do marketplace é a mesma entidade que `groups` social ou renomear / separar. |
| `payment_intent_splits` | **Parar:** workshop rápido com SSOT Bank — ou criar DDL alinhado a `payment_intents` + papéis de split, ou alterar leituras para `bank_splits` (isso já seria **alteração de código**, fora do escopo “só schema”). |
| `payment_transactions` | Mapear origem pretendida (gateway vs bank); hoje **sem CREATE** na cadeia observada. |

---

## 6. Execução (`pnpm migrate`)

Comando executado:

```bash
cd backend && pnpm migrate
```

**Resultado:** perfil **CORE_ONLY**; todas as migrations registadas; **nenhuma nova** aplicada — **não** cria as tabelas em falta porque **não existem ficheiros pendentes** na pasta ativa.

Para ambiente completo (incl. módulos latentes): `MIGRATION_PROFILE=FULL` — **não** altera o facto de as tabelas acima estarem fora da cadeia `migrations/`.

---

## 7. Validação SQL (reproduzir após promoção de DDL)

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'business_segments','contacts','groups','product_attributes','company_profiles',
    'commission_rules','event_settlements','fiscal_documents','fiscal_document_items',
    'fiscal_provider_attempts','inventory_adjustments','payment_methods','regional_fees',
    'tax_profiles','unifycard_payment_methods','referral_codes','payment_intent_splits'
  )
ORDER BY 1;
```

Objetivo futuro: **17 linhas** (e tabelas satélites como `payment_transactions` se forem mantidas).

---

## 8. Conclusão

- **FASE S marketplace ≠ OK** até que o DDL destas entidades exista em **`migrations/`** aplicável e consistente com o **schema actual** (`tenants(id)`, etc.).
- A “inconsistência” não é só ambiente: é **lacuna de cadeia de migrations** (archive ≠ produção) + **falso positivo** `order_revenue` + **buraco** `payment_intent_splits` / `payment_transactions` sem DDL no repositório.
- **Próximo passo de engenharia:** PR(s) que **promovam** DDL (Opção A) + decisão explícita sobre splits/pagamentos — **depois** disso, repetir esta query e marcar FASE S **OK**.

---

**Fim.** Nenhum ficheiro `.ts` de aplicação foi alterado para gerar este documento.
