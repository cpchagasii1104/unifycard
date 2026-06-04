# DECISION-0092 — Fase 3 PJ: separação entre lifecycle, verificação KYB e capabilities

**Status:** PROMULGADA POR CLAYTON — DECISÃO ESTRATÉGICA (Fase 3 da reconciliação PJ — separa lifecycle operacional, verificação KYB e capabilities sociais após a neutralização dos writers legados de VERIFIED). **DOCS-ONLY / SEM CÓDIGO / SEM MIGRATION / SEM SCHEMA / SEM FRONTEND** (2026-06-04). Fixa a regra e a ordem; **não** implementa, **não** altera schema/frontend, **não** mexe em dados.
**Sessão:** 2026-06-04 — frente `F-PJ-LIFECYCLE-VERIFICATION-CLEANUP` (pós read-only Fase 3).
**Decisor:** Clayton. **Commit âncora:** `467e05c1` (pós Fase 2.5 — todos os writers de VERIFIED neutralizados; `DT-PJ-LEGACY-VERIFIED-WRITERS-MULTIPLE` CLOSED).
**Natureza:** abre a Fase 3 da reconciliação. A Fase 2 (DECISION-0090/0091) neutralizou os 5 writers de `company_status='VERIFIED'`, o que **deixou leitores órfãos** que ainda gateiam comportamento por `company_status === VERIFIED/APPROVED` — gerando uma **regressão funcional** (PJ pode ficar travada para post/vote/project/CTA, pois ninguém mais escreve VERIFIED/APPROVED). Esta DECISION fixa que **capability social PJ não lê `company_status`**, define o destino dos campos legados, e ordena a sequência 3.0→3.3.
**Documento canônico:** este arquivo.
**Deriva de:** `DECISION-0091` (FASE 12 destino), `DECISION-0090` (writers reconciliação), `DECISION-0089` (fonte única), `DECISION-0088` (gate KYB).
**Subordinada a:** `CONSTITUICAO_UNIFICARD.md`, `AUTHORITY_LAW.md`, `IDENTITY_SSOT_PRECEDENCE.md`, `SSOT_REGISTRY_UNIFICARD.md`, `07_NOMENCLATURA_CANONICA.md`, `LEIS_OPERACIONAIS_UNIFICARD.md`, `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md`.
**Vinculada a:** `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` (atualizada), `DT-PJ-REPUTATION-GATE-USES-LEGACY-COMPANY_STATUS` (criada), `DT-PJ-CNPJ-LOCK-USES-LEGACY-COMPANY_STATUS` (criada), `DT-PJ-VERIFIED-AT-LEGACY-THIRD-GHOST` (atualizada).

---

## 1. Status

PROMULGADA POR CLAYTON. DOCS-ONLY. Registra a **regra** (capability PJ deriva de `kyb_status`, não `company_status`), o **destino** dos campos legados (`company_status`/`is_verified`/`verifiedAt`/vestígios) e a **sequência** (3.0 readers órfãos → 3.1 lifecycle/compat → 3.2 vestígios → 3.3 dados legados). Implementação por fatias (executor), começando pela correção funcional 3.0.

## 2. Fatos materiais a registrar (read-only Fase 3, HEAD `467e05c1`)

1. `companies.status` existe e **já é lifecycle operacional limpo**: text, default `active`, **CHECK** `active/inactive/suspended/closed`.
2. `companies.company_status` existe mas é **eixo impuro**: text, default `ACTIVE`, **SEM CHECK**, mistura onboarding/lifecycle/verificação. Vocabulário (contrato `CompanyStatus`): `DRAFT/PROVISIONAL/VERIFIED/APPROVED/SUSPENDED` — com `VERIFIED` documentado como "validada presencialmente" (modelo FASE 12, neutralizado).
3. `companies.is_verified` existe como flag booleana legada: default false, **sem leitor de gate** no domínio companies, só surfaceada em payload.
4. `companies.verifiedAt` **não existe** — era ghost de código; o write foi removido na Fase 2.5.
5. `company_validations` existe como tabela **mínima/vestigial** (5 colunas, `rows=0` em dev); o schema rico da FASE 12 (`archive/0047`) não está vivo; coluna `status` "nunca escrita pelo código".
6. `partner_employees` existe como vestígio mínimo (`rows=0` em dev), incompatível com o código rico antigo da FASE 12.
7. **Fase 1 corrigiu o display**: UI/API visual de "verificada" usa `kybStatus`/`isKybApproved` (derivado de `kyb_status`).
8. **Fase 2 neutralizou todos os 5 writers legados de VERIFIED**: `updateCompany`, `adminOverrideToVerified`, `updateDocumentStatus`, `reviewCompanyValidation`, `validateInPerson` (FASE 12).
9. **🔴 Achado crítico (regressão):** `modules/social/reputation.service.ts` ainda gateia capability social de **page-actor** por `companyStatus === 'VERIFIED' || 'APPROVED'` (`:280`, `:288-318`). Como nenhum writer escreve mais VERIFIED/APPROVED, `company_status` fica congelado em PROVISIONAL e **PJ pode ficar travada para post/vote/project/CTA**.
10. **Achado adicional:** o lock de edição de CNPJ (`companies.service.ts:1410`) ainda lê `companyStatus === 'VERIFIED'/'APPROVED'`. Como o CNPJ virou **projeção de `fiscal_identities.cnpj`**, esse lock deve ser repensado contra `kyb_status`/casa fiscal (hoje nunca dispara → CNPJ sempre editável).

## 3. Princípio normativo

Verificação fiscal, lifecycle operacional e capability social são **três eixos distintos** que `company_status` indevidamente conflava. A neutralização dos writers (Fase 2) tornou esse conflato visível como regressão: capabilities derivavam de um eixo agora congelado. A reconciliação final exige **ancorar cada eixo em sua fonte canônica** — lifecycle em `companies.status`, verificação em `fiscal_identities.kyb_status`, capability em autoridade/KYB — e parar de usar `company_status` como proxy de verificação em qualquer leitor.

## 4. Decisões promulgadas

### 4.1 Separação de eixos (vinculante)
Os eixos oficiais passam a ser:
- **Lifecycle operacional:** fonte primária `companies.status` (active/inactive/suspended/closed).
- **Onboarding/compat PJ legado:** `companies.company_status` — **NÃO é fonte de verificação**; será purificado/aposentado em fases.
- **Verificação fiscal/KYB:** fonte única `fiscal_identities.kyb_status` (`approved` = PJ verificada).
- **Display:** derivado de `kyb_status` (já mitigado na Fase 1).
- **Capability social:** **NÃO pode depender de `company_status='VERIFIED'/'APPROVED'`.**

### 4.2 Gate social / reputation
`reputation.service` **não pode** usar `company_status === 'VERIFIED'/'APPROVED'` como fonte de capability de PJ.
- Capabilities de page-actor devem derivar de **`kyb_status`** e/ou regra explícita para PJ pending.
- `company_status` **não pode** negar/autorizar post/vote/project/CTA por verificação.
- **Fase 3.0 deve corrigir esse leitor.**

**Política de produto promulgada (capability × KYB):**
- PJ `kyb_status='approved'`: capability **plena** (respeitando outras regras de autoridade/reputação).
- PJ `kyb_status='pending'`: **pode existir e montar presença básica** (leitura/perfil), mas **não deve ter capability comercial/financeira**, e **post/vote/project/CTA deve exigir `kyb_status='approved'`**, salvo exceção explicitamente decidida.
- Se houver, no futuro, política de "post limitado para pending", isso é **decisão de produto futura** — **não implementar agora**.

### 4.3 CNPJ lock
`companies.service` **não deve** travar edição de CNPJ usando `companyStatus === 'VERIFIED'/'APPROVED'`.
- CNPJ é **projeção de `fiscal_identities.cnpj`**; a regra de imutabilidade vive na **casa fiscal/KYB**.
- **Fase 3.0 deve remover ou repointar** esse lock para `kyb_status`/fiscal identity — **sem** reabrir `company_status` como fonte.

### 4.4 `company_status`
- **Não** deve carregar `VERIFIED`/`APPROVED` como verificação.
- Futuro: virar **lifecycle/onboarding compat** ou ser **aposentado**.
- Antes de migration/CHECK, a Fase 3.0 **só corrige os leitores órfãos** (não toca schema).

### 4.5 `is_verified`
- **Não é fonte.** Permanece **compat** por enquanto.
- Futura decisão (Fase 3.1): **projeção derivada de `kyb_status`** ou **aposentadoria**.

### 4.6 `verifiedAt`
- É **ghost de código, não coluna viva**; o write já foi removido (Fase 2.5).
- Remover **referências textuais/residuais** em fase de higiene. **Sem migration de dados.**

### 4.7 `company_validations` / `partner_employees`
- **Vestígios inertes** (vazios). **Não reviver** nesta Fase 3.
- Eventual remoção/convergência exige **decisão/migration própria** (Fase 3.2).

### 4.8 QR / `requestValidation`
- Permanece **decisão de produto/UX** (Codex). **Não é fonte de verificação.**
- **Não entra** no executor da Fase 3.0.

## 5. Ordem de implementação futura (vinculante na sequência)

```text
Fase 3.0 — correção funcional URGENTE (executor pequeno + testes):
  - repointar reputation.service: capability de page-actor NÃO depende de
    company_status VERIFIED/APPROVED; deriva de kyb_status (+ regra pending);
  - corrigir/neutralizar o lock de CNPJ baseado em company_status
    (repointar p/ kyb_status/casa fiscal ou remover);
  - testes específicos para page-actor pending vs approved.
Fase 3.1 — lifecycle/compat (DECISION + migration):
  - decidir company_status como lifecycle/onboarding compat OU aposentadoria;
  - banir VERIFIED/APPROVED do vocabulário se houver migration/CHECK;
  - decidir is_verified como projeção de kyb_status OU aposentadoria.
Fase 3.2 — vestígios:
  - company_validations; partner_employees; QR/requestValidation;
  - menções textuais residuais a verifiedAt.
Fase 3.3 — dados legados:
  - política para ambientes não-zero com company_status='VERIFIED' sem
    kyb_status='approved' (rebaixamento/migração).
```

A **Fase 3.0 é a prioridade absoluta** — fecha a regressão funcional aberta pela Fase 2. As demais são dívida organizada, sem urgência funcional.

## 6. O que fica fora (vinculante)

implementação/código · migration/schema · alteração de frontend · DML/migração de dados · CHECK em `company_status` (Fase 3.1) · remoção de tabelas vestigiais (Fase 3.2) · destino UX do QR · alteração do gate F2-C · Bank/ledger/split · KYC PF/`identities`.

## 7. Superada por

(em aberto — decisão vigente)
