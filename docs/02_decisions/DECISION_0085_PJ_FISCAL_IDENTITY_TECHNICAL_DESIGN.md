# DECISION-0085 — D2 Técnica: casa fiscal PJ canônica (`fiscal_identities`)

**Status:** PROMULGADA POR CLAYTON — DECISÃO TÉCNICA (D2-técnica, derivada da D2-princípio/DECISION-0084). **DOCS-ONLY / SEM MIGRATION / SEM CÓDIGO / SEM SCHEMA** (2026-06-03). Autoriza a próxima fase (migration única + código), mas **não a executa**.
**Sessão:** 2026-06-03 — frente `F-PJ-FISCAL-IDENTITY-TECHNICAL-DESIGN` (pós read-only final D2 no HEAD `8d5ee22c`).
**Decisor:** Clayton. **Commit âncora (fundação transacional):** `8d5ee22c` (F-ATOMIC-COMPANY-BIRTH).
**Natureza:** fixa o **desenho técnico** da casa fiscal PJ — nome, escopo, colunas-alvo, constraints-alvo, FK, writer, lifecycle e o **ponto na transação**. **NÃO** cria tabela, **NÃO** roda migration, **NÃO** altera schema/runtime.
**Documento canônico:** este arquivo.
**Deriva de:** `DECISION-0081` (M0), `DECISION-0082` (D1), `DECISION-0083` (D3-princípio), `DECISION-0084` (D2-princípio); `DECISION-0075 §9` (Opção B); F-ATOMIC (`8d5ee22c`).
**Subordinada a:** `CONSTITUICAO_UNIFICARD.md`, `AUTHORITY_LAW.md`, `IDENTITY_SSOT_PRECEDENCE.md`, `SSOT_REGISTRY_UNIFICARD.md`, `07_NOMENCLATURA_CANONICA.md`, `LEIS_OPERACIONAIS_UNIFICARD.md`, `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md`.
**Vinculada a:** `DT-PJ-CNPJ-CANONICAL-HOME-MISSING`, `DT-PJ-CNPJ-UNIQUE-CHECK-MISSING`, `DT-PJ-KYC-DOCUMENTS-SUBSTRATE-MISSING`, `DT-PJ-IDENTITY-PRECEDENCE-NORM-GAP` (atualizadas/referenciadas).

---

## 1. Status

PROMULGADA POR CLAYTON. DOCS-ONLY. Registra a **decisão técnica** da D2. Migration e código são **fase seguinte** (autorizada, não executada aqui).

## 2. Contexto / cadeia

- **DECISION-0081 / M0:** PJ é identidade fiscal própria, **não soberana**.
- **DECISION-0082 / D1:** CNPJ mora em **camada própria**; `companies.cnpj` projeta.
- **DECISION-0083 / D3-princípio:** atuação sobre PJ exige **vínculo formal auditável**.
- **DECISION-0084 / D2-princípio:** casa fiscal PJ **própria/canônica/global**; CNPJ verdade única; continuidade na transferência.
- **`IDENTITY_SSOT_PRECEDENCE.md`:** precedência PJ incorporada — **identidade fiscal PJ vence projeções operacionais**.
- **DECISION-0075 §9:** Opção B — PJ pode nascer no início **pending/bloqueada/não-operacional**.
- **F-ATOMIC / `8d5ee22c`:** núcleo `companies + company_users + page-actor + metadata` é **transacional** (`withTransaction`).

**A D2 técnica só é segura agora porque a caixa do nascimento foi fechada** (F-ATOMIC): há um seam transacional onde a identidade fiscal PJ pending pode ser reservada com CNPJ único sem deixar órfão.

## 3. Fatos de disco que fundamentam (read-only, HEAD `8d5ee22c`, `unificard_dev`)

- `global_users.cpf` tem **UNIQUE global** (`global_users_cpf_key`) → **precedente vivo** para CNPJ único global.
- `companies.cnpj` é **text, nullable, sem índice/UNIQUE/CHECK/FK** → **projeção fraca a proteger**.
- `identities.tax_id` é **text NOT NULL, sem UNIQUE**, chaveado por `global_user_id` → **pessoa-cêntrico, não serve PJ**.
- Substratos `fiscal_identities`/`tax_identities`/`organizational_identities`/`legal_entities`/`company_identities`/`pj_identities`/`company_documents` **ausentes**.
- Existem `company_validation_requests` e `identity_validation_requests` → **workflow/espelho** de validação, **não** casa fiscal PJ.
- DEV tem **0 companies** → **sem backfill de dados DEV** nesta etapa.
- Pós-F-ATOMIC, `createCompany` usa `withTransaction` → **seam seguro** para inserir a identidade fiscal PJ pending dentro da transação.

## 4. Decisões técnicas promulgadas

### 4.1 Nome
A casa fiscal PJ se chamará **`fiscal_identities`**. A decisão é sobre **identidade fiscal**, escopo **PJ/CNPJ**; não substitui `identities` (PF); não modela grupos/projetos/associações; não é actor; não é autoridade; não revive o company-canonical quebrado. **`fiscal_identities` nasce para identidade fiscal PJ/CNPJ nesta fase.**

### 4.2 Escopo
**Só PJ/CNPJ nesta fase** — não camada fiscal genérica, não PF, não grupos, não projetos, não associações, não actor, não authority.

### 4.3 CNPJ
`VARCHAR(14)` · `NOT NULL` · **UNIQUE global** · **CHECK 14 dígitos** · **dígito verificador validado na BORDA** (função local já existente — `companies.service.validateCNPJ` — ou equivalente); **sem** consulta a Receita/GovBR/internet na validação interna. `VARCHAR(14)` **converge com a nomenclatura canônica** e **não** carrega o drift `text` das tabelas legadas.

### 4.4 Razão social / nome legal
**NÃO** entra como campo canônico em `fiscal_identities`. `companies.company_name` permanece a **projeção operacional**. **Proibido** reviver `legal_name`/`document_number` do company-canonical quebrado. (Nome legal canônico pode ser reavaliado em decisão futura; **não** entra agora.)

### 4.5 FK `companies → fiscal_identities` (Opção 2)
`companies.fiscal_identity_id` **existe e está presente desde o nascimento pending**. FK aponta de `companies` para `fiscal_identities`. **Direção única**: `fiscal_identities` **não** carrega `company_id` (é a fonte soberana; o vínculo mora em `companies`). Evita circularidade e evita `companies.cnpj` como segunda verdade. A identidade fiscal **nasce antes da company** dentro da transação.

### 4.6 Sequência dentro do `withTransaction` (fiscal-first)
```
withTransaction {
  1. INSERT fiscal_identities  (cnpj reservado; kyb_status='pending'; UNIQUE global protege duplicidade)
  2. INSERT companies          (fiscal_identity_id = fiscalId; cnpj = projeção; estado provisional/pending)
  3. INSERT company_users
  4. ensurePageActorTx         (page-actor pending/não-operacional; autoridade fecha em CPF/actor humano)
  5. metadata/onboarding       (se mantido no núcleo)
  6. COMMIT
}
```
**Justificativa:** CNPJ duplicado **explode no passo 1 dentro da transação** → ROLLBACK total impede company/page-actor/fiscal_identity órfãos; **CNPJ nunca fica consumido pela metade**; **sem back-link circular** (FK `companies.fiscal_identity_id` pode nascer NOT NULL).

### 4.7 `companies.cnpj` como projeção
Fonte = `fiscal_identities.cnpj`; projeção = `companies.cnpj`; **sincronização unidirecional fonte → projeção**; em conflito **vence `fiscal_identities`**; `createCompany` **deixa de ser fonte autônoma de CNPJ**; **não pode existir writer paralelo** de `companies.cnpj`.

### 4.8 Lifecycle / status — eixo próprio `kyb_status`
Vocabulário **inicial enxuto**: `pending` · `approved` · `rejected` · `suspended` · `closed`.
- `under_review` e `needs_more_info` pertencem ao **workflow de validação**, **não** à identidade canônica.
- `blocked` fica **fora** do vocabulário inicial (não misturar risco/operacional com identidade fiscal).
- **Transferência é evento/vínculo, não status** da identidade.
- **Não repetir o drift `status` vs `company_status`** de `companies` — a casa fiscal nasce com **um** eixo próprio.

### 4.9 `kyb_level` — adiado
**Não entra agora.** Semântica de níveis KYB fica para decisão futura. **Não criar campo decorativo.**

### 4.10 Auditoria — sufixo explícito, sem nomes genéricos
**Não** usar `created_by`/`reviewed_by` genéricos. Os campos de auditoria precisam de **sufixo claro**: preferir `*_actor_id` quando o ato representa **autoridade operacional**; admitir `*_user_id` **apenas** se o workflow vivo exigir compatibilidade com padrão existente. A escolha **actor_id vs user_id** deve ser **explícita no desenho/migration** — **nada de campo ambíguo**. Diretriz: toda decisão relevante é **auditável**; operador/admin **rastreável**; **autoridade fecha em CPF/actor humano**.

### 4.11 Metadata — fora da tabela canônica
**Não** incluir `metadata jsonb` em `fiscal_identities` nesta fase. A tabela canônica **não vira gaveta genérica**; correlação/auditoria fica no **workflow / histórico / event-outbox / tabela auditável própria**. `company_validation_requests.metadata` segue como **workflow**, não SSOT fiscal.

### 4.12 Writer — híbrido
- **Reserva pending** dentro do nascimento transacional (passo 1 do §4.6), na camada fiscal (sem DML cru).
- **Aprovação KYB** depois, via **writer auditado** espelhando `identity-validation` (request → review → auditoria → transição de status → role/admin → **atomicidade na aprovação** → sem DML cru).
- `company_validation_requests` pode ser **workflow/espelho**, **não** SSOT fiscal. **KYB PJ ≠ KYC PF**; `identities` PF **não** é tocada.

### 4.13 Histórico / continuidade
A D2 técnica garante: a identidade fiscal PJ **não morre na transferência**; transferência muda **vínculos humanos**, não a identidade. Histórico **append-only/evento/tabela histórica** fica para **decisão posterior**. **Não** criar coluna solta de histórico agora.

### 4.14 Imutabilidade do CNPJ
Nesta fase: CNPJ **imutável pós-aprovação por borda + teste**; trigger/constraint de imutabilidade fica para **fase posterior** se necessário.

### 4.15 D3 técnica
Vínculos da D3 técnica deverão ancorar na **identidade fiscal PJ**, **não** em `companies.cnpj`, **não** na projeção operacional.

### 4.16 Fora da D2 técnica
D3 técnica · D5 (transferência) · D4 (responsabilidade transitória/caução) · D6 (anti-laranja) · D7 (risco) · validação forte LGPD-first · Bank · ledger · MVP-A · frontend · mock · **migration/código desta sessão**.

## 5. Schema alvo conceitual — NÃO EXECUTAR (desenho, não migration)

```text
TABELA FUTURA: fiscal_identities  (GLOBAL — sem tenant_id; espelho global_users/identities)

Campos mínimos conceituais:
  fiscal_identity_id   uuid PK default gen_random_uuid()
  cnpj                 varchar(14) NOT NULL
  kyb_status           text NOT NULL default 'pending'
  <auditoria — sufixo explícito, escolha actor_id vs user_id na migration>:
     created_by_actor_id  OU  submitted_by_user_id
     reviewed_by_actor_id OU  reviewed_by_user_id
  reviewed_at          timestamptz NULL
  decision_reason      text NULL
  created_at           timestamptz NOT NULL default now()
  updated_at           timestamptz NOT NULL default now()

NÃO incluir nesta fase: kyb_level, metadata jsonb, legal_name, document_number, company_id.

Constraints conceituais:
  UNIQUE global em cnpj
  CHECK length(cnpj) = 14
  CHECK kyb_status IN ('pending','approved','rejected','suspended','closed')
  timestamps NOT NULL
  FK de auditoria conforme escolha actor_id/user_id na implementação
  FK futura companies.fiscal_identity_id → fiscal_identities.fiscal_identity_id
```
**Isto é desenho alvo, NÃO SQL executável.**

## 6. Testes futuros obrigatórios (a implementação deve provar)

1. CNPJ único global. 2. CNPJ duplicado dentro da transação → rollback total. 3. Falha após `fiscal_identities` pending → rollback total. 4. Falha após page-actor com fiscal identity → rollback total. 5. `companies.cnpj` projeção sincronizada. 6. Conflito fonte/projeção → fonte vence. 7. KYB aprova → operação pode ser liberada. 8. KYB rejeita → identidade permanece com histórico, operação bloqueada. 9. Transferência futura não cria nova identidade fiscal. 10. D3 técnica ancora na fiscal identity. 11. Zero impacto em `identities` PF. 12. Zero Bank. 13. Fora do MVP-A. 14. Concorrência: dois creates com mesmo CNPJ → exatamente um vence. 15. Migração DEV com 0 companies. 16. Migração com companies existentes (ambiente não-zero). 17. Sem writer paralelo de `companies.cnpj`. 18. Sem DML cru para status KYB.
→ estender o harness efêmero da F-ATOMIC (`validate-pipeline-e2e-atomic-company-birth`).

## 7. Ordem futura

```text
1. (esta DECISION) D2 técnica promulgada.
2. Migration única: fiscal_identities + companies.fiscal_identity_id + constraints (UNIQUE global,
   CHECK 14, CHECK kyb_status, timestamps, FKs).
3. Código: passo 1 (fiscal-first) no withTransaction de createCompany + writer KYB auditado +
   companies.cnpj como projeção (retirar createCompany como fonte autônoma de cnpj).
4. Gates + testes (§6).
5. D3-técnica (vínculos ancorados na fiscal identity).
```
**PJ comercial segue bloqueada.** Implementação **não** autorizada nesta sessão.

## 8. Superada por

(em aberto — decisão vigente)
