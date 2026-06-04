# DECISION-0091 — Destino da FASE 12 QR: writer fóssil de VERIFIED

**Status:** PROMULGADA POR CLAYTON — DECISÃO ESTRATÉGICA (destino do último writer legado de "empresa verificada"). **DOCS-ONLY / SEM CÓDIGO / SEM MIGRATION / SEM SCHEMA / SEM REMOÇÃO DE ROTA / SEM FRONTEND** (2026-06-04). Fixa o achado material e a estratégia; **não** implementa, **não** altera schema/rotas/frontend, **não** mexe em dados.
**Sessão:** 2026-06-04 — frente `F-PJ-VERIFIED-WRITERS-2.5` (pós read-only/design da FASE 12 QR).
**Decisor:** Clayton. **Commit âncora:** `d8d72666` (pós Fase 2.4 — `companies.service.ts` limpo de escritas VERIFIED).
**Natureza:** encerra a estratégia da Fase 2 (neutralização dos 5 writers legados) registrando que a FASE 12 QR (`validateInPerson`) é um **writer fóssil runtime-dead** — escreve contra schema arquivado (`migrations_archive/0047`) que foi superado pelo schema vivo mínimo (`0066`) — e fixa que ele deve ser **neutralizado** (não revivido) em executor posterior. Evidência presencial KYB fica como **greenfield futuro**.
**Documento canônico:** este arquivo.
**Deriva de:** `DECISION-0090` (reconciliação dos writers legados), `DECISION-0089` (fonte única), `DECISION-0087` (documentos KYB SSOT), `DECISION-0086` (writer KYB auditado).
**Subordinada a:** `CONSTITUICAO_UNIFICARD.md`, `AUTHORITY_LAW.md`, `IDENTITY_SSOT_PRECEDENCE.md`, `SSOT_REGISTRY_UNIFICARD.md`, `07_NOMENCLATURA_CANONICA.md`, `LEIS_OPERACIONAIS_UNIFICARD.md`, `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md`.
**Vinculada a:** `DT-PJ-FASE12-QR-KYB-EVIDENCE-DESIGN-MISSING` (atualizada — absorve o achado schema-drift/runtime-dead), `DT-PJ-LEGACY-VERIFIED-WRITERS-MULTIPLE` (atualizada), `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` (atualizada), `DT-PJ-VERIFIED-AT-LEGACY-THIRD-GHOST` (atualizada).

---

## 1. Status

PROMULGADA POR CLAYTON. DOCS-ONLY. Registra o **achado material** (FASE 12 é fóssil runtime-dead), a **regra-mãe** (FASE 12 nunca verifica fiscalmente) e o **destino** (neutralizar o writer `validateInPerson` em executor posterior; evidência presencial KYB = greenfield futuro). **Não** remove rota, **não** toca frontend/QR, **não** migra dados.

## 2. Fatos materiais a registrar (read-only/design, HEAD `d8d72666`)

1. `validateInPerson` (`core/companies/company-validation.service.ts:119`) é o **último** writer remanescente que tenta criar verificação PJ fora de `kyb_status` (os outros 4 foram neutralizados nas Fases 2.1–2.4).
2. O código tenta escrever, em transação: `companies.company_status='VERIFIED'`, `companies.verifiedAt`, e uma **linha rica** em `company_validations` (`company_status_before/after`, `validated_by_employee_id/partner_id`, `geo_lat/lng`, `device_fingerprint`, `metadata`, `validatedAt`).
3. **O schema vivo NÃO corresponde ao schema esperado pelo código:**
   - `company_validations` **vivo** (de `migrations/0066_profile_support_tables.sql:37`) tem **5 colunas**: `validation_id, company_id, validation_method, status, created_at`. O comentário em `migrations/20260530535000_c36_status_check_constraints.sql:6` confirma: _"company_validations.status — coluna nunca escrita pelo código"_.
   - O schema **rico** (que o código espera) está em `migrations_archive/0047_company_validations.sql` — **NÃO aplicado**.
   - `partner_employees` **vivo** tem 4 colunas (`id, tenant_id, partner_id, created_at`) — **sem** `name`/`active`, que o código SELECTa.
   - `companies.verifiedAt` **NÃO EXISTE** (companies tem `is_verified`, `company_status`).
4. Portanto, `validateInPerson` é **runtime-dead** no schema vivo: lançaria "column does not exist" no passo 4 (`partner_employees.name/active`) ou no INSERT/UPDATE — **não consegue escrever `VERIFIED`**. É fóssil (convergência interrompida: `0047` arquivado → `0066` mínimo).
5. **`verifiedAt` é ghost de CÓDIGO, não coluna viva** (o `UPDATE companies SET verifiedAt` referencia coluna inexistente).
6. `requestValidation`/QR (`service:61`) ainda é parte **visível na UI** (`frontend/src/components/CompanyValidationModal.tsx` gera o QR via `QRCodeSVG`), mas só gera token/JWT — **não escreve verificação**.
7. `validateInPerson` **não tem caller no frontend principal** (consumo do QR seria app de funcionário parceiro externo); seu único caller em código é a rota `POST /companies/validate/in-person` (auth-only).
8. Se revivida, a FASE 12 provaria **presença física/vistoria por funcionário parceiro**, **não** verificação de identidade fiscal completa (não valida documento, pessoa, representação nem vínculo fiscal).
9. Presença física **não substitui** o KYB documental mínimo (`cnpj_registration` + `articles_of_association` aceitos — DECISION-0087/§3).
10. Evidência presencial futura exige **design novo** — possivelmente novo `document_type` ou trilho humano/LGPD — não cabe como cleanup.

## 3. Princípio normativo

A FASE 12 QR é **prova de presença/vistoria**, não verificação fiscal. Mesmo se o schema fosse restaurado, presença física é **evidência**, não **resultado** KYB. Reviver o writer para escrever `VERIFIED` recriaria a segunda-verdade que a cadeia 0089/0090 eliminou. O ato presencial pode ter valor futuro como insumo — mas como evidência ligada à casa fiscal/humana, nunca como carimbo direto em `companies`.

## 4. Decisões promulgadas

### 4.1 Regra-mãe (vinculante)
A FASE 12 QR **não pode** verificar fiscalmente uma PJ escrevendo `companies.company_status='VERIFIED'`, `companies.is_verified=true` ou `companies.verifiedAt`. Fonte única de verificação PJ permanece **`fiscal_identities.kyb_status='approved'`**.

### 4.2 Destino do writer `validateInPerson` — neutralizar
- **Neutralizar** o writer `validateInPerson` em **executor posterior** (Fase 2.5).
- Deve **falhar com erro de domínio claro** antes de qualquer escrita.
- **Não** executar UPDATE em `companies`; **não** escrever em `company_validations`; **não** escrever `VERIFIED`/`verifiedAt`; **não** tocar `kyb_status`.
- Erro candidato: code `PJ_LEGACY_IN_PERSON_VERIFIED_DISABLED`, mensagem _"Validação presencial legada desabilitada. Evidência presencial KYB exige novo desenho."_

### 4.3 `requestValidation` e QR — manter inerte
- **Não remover** `requestValidation`/QR nesta decisão.
- Manter **inerte** por enquanto (gera token/QR, não escreve verificação).
- Remoção/redesenho de UX é **decisão de produto/frontend** (Codex), não cleanup de writer.
- A existência do QR **não** é aprovação fiscal.

### 4.4 Evidência presencial futura — greenfield
- Presença física **pode** ser valiosa como evidência, mas será **greenfield futuro**, não cleanup.
- Exige **decisão própria** antes de virar evidência KYB.
- **Não pode aprovar KYB sozinha**; **não substitui** `cnpj_registration` + `articles_of_association` aceitos.

### 4.5 Relação com DECISION-0087
`fiscal_identity_documents.document_type` **não** deve ser ampliado nesta decisão. Um `in_person_validation_evidence` (ou similar) futuro exige **emenda da DECISION-0087 + migration própria** (o CHECK atual fixa 5 literais).

### 4.6 Relação com trilho humano/LGPD
Geolocalização, `device_fingerprint`, employee/partner e eventual presença humana têm **superfície LGPD**. **Não** misturar esses dados de pessoa diretamente na identidade fiscal sem desenho. Avaliar em **trilho próprio futuro**.

### 4.7 `company_validations` e `partner_employees`
Tabelas vivas são **vestígios/incompatíveis** com o código rico da FASE 12. **Não** consertar schema agora. Qualquer reconstrução é **feature nova**, não correção pequena.

### 4.8 Escopo da Fase 2.5 (executor)
O executor da Fase 2.5 deve ser **cirúrgico**: neutralizar `validateInPerson`. **Não** tocar `requestValidation`; **não** tocar frontend; **não** criar schema novo; **não** criar evidência KYB; **não** tentar reviver a FASE 12.

## 5. O que fica fora (vinculante)

implementação/código · migration/schema · remoção de rotas · alteração de frontend/QR · DML/migração de dados · revivamento da FASE 12 · ampliação de `document_type` · trilho humano/LGPD · alteração do gate F2-C · Bank/ledger/split · KYC PF/`identities`.

## 6. Superada por

(em aberto — decisão vigente)
