# DECISION-0087 — F2-B Documentos PJ: SSOT documental KYB

**Status:** PROMULGADA POR CLAYTON — DECISÃO TÉCNICA (F2-B, derivada da D2-técnica/0085 e do writer KYB F2-A/0086). **DOCS-ONLY / SEM MIGRATION / SEM CÓDIGO / SEM SCHEMA** (2026-06-03). Autoriza a futura implementação F2-B, mas **não a executa**.
**Sessão:** 2026-06-03 — frente `F-PJ-KYB-DOCUMENTS-SSOT` (pós read-only F2-B).
**Decisor:** Clayton. **Commit âncora (fundação F2-A):** `0dfb849d`.
**Natureza:** fixa o **desenho do SSOT documental KYB** da PJ (`fiscal_identity_documents`), ancorado em `fiscal_identity_id`. **NÃO** cria tabela, **NÃO** escolhe provider de storage, **NÃO** cria upload/rota, **NÃO** altera o writer F2-A, **NÃO** roda migration.
**Documento canônico:** este arquivo.
**Deriva de:** `DECISION-0081` (M0), `DECISION-0082` (D1), `DECISION-0083` (D3-princípio), `DECISION-0084` (D2-princípio), `DECISION-0085` (D2-técnica), `DECISION-0086` (F2-A KYB writer).
**Subordinada a:** `CONSTITUICAO_UNIFICARD.md`, `AUTHORITY_LAW.md`, `IDENTITY_SSOT_PRECEDENCE.md`, `SSOT_REGISTRY_UNIFICARD.md`, `07_NOMENCLATURA_CANONICA.md`, `LEIS_OPERACIONAIS_UNIFICARD.md`, `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md`, `COMPLIANCE_REGULATORIO_UNIFYBANK.md`.
**Vinculada a:** `DT-PJ-KYC-DOCUMENTS-SUBSTRATE-MISSING` (atualizada), `DT-PJ-DOCUMENT-STORAGE-PROVIDER-MISSING` (criada), `DT-PJ-HUMAN-LINK-DOCUMENTS-LGPD-MISSING` (criada).

---

## 1. Status

PROMULGADA POR CLAYTON. DOCS-ONLY. Registra a **decisão técnica** do SSOT documental KYB. Implementação (migration `fiscal_identity_documents` + service + pré-condição documental no review F2-A + testes) é **fase seguinte**. Provider de storage = **fatia própria**. Documentos de PESSOA = **outro trilho**.

## 2. Contexto / gap (read-only HEAD 0dfb849d)

- **NÃO existe SSOT documental vivo.** `media` é **placeholder** (tabela ausente em DEV, URL fake `storage.example.com`, "em produção usar S3"); `fiscal_documents` é **NF-e/documento fiscal de VENDA** (marketplace/SEFAZ, domínio errado, nem está em DEV); `uploads/groups` é **imagem local** (não documento legal). Zero append-only documental.
- → **greenfield.** A F2-B não nasce sobre fundação; precisa criar a SSOT de metadados/trilha do zero, com provider de arquivo deixado para fatia própria.

**Tese central (vinculante):** **Documento é EVIDÊNCIA. KYB request é PROCESSO. `fiscal_identities.kyb_status` é RESULTADO. `fiscal_identity_id` é a ÂNCORA.** Não misturar os quatro. Sem essa separação, contrato social acaba em `metadata` e vira "legado histórico" em seis meses.

## 3. Decisões promulgadas

### 3.1 Nome da tabela documental
A tabela futura será **`fiscal_identity_documents`**.

### 3.2 Escopo inicial — documentos DA EMPRESA
**Entra:** documento fiscal/registral da empresa; contrato social; alterações contratuais; comprovante de endereço comercial; complementares da empresa solicitados pelo operador.
**Fica FORA da F2-B inicial:** documentos pessoais de sócios; documentos pessoais do responsável legal; documentos pessoais de administradores; **procuração** (documento de representação humana).
**Justificativa:** documentos da empresa **sobrevivem à transferência**; documentos de pessoa pertencem ao **trilho de vínculo humano / D3 / D5 / LGPD** (ver `DT-PJ-HUMAN-LINK-DOCUMENTS-LGPD-MISSING`).

### 3.3 Âncora
Documento da empresa pertence a **`fiscal_identity_id`**. **NÃO** a: CPF, actor humano, `company_user`, `company_id` (como fonte), request (como fonte final).

### 3.4 Relação com KYB request
`kyb_request_id` **NULLABLE**. Função: registrar qual request KYB avaliou o documento + congelar evidência da revisão. **NÃO** é dono do documento.

### 3.5 Status documental
`submitted` · `accepted` · `rejected` · `superseded`. **Sem `pending_review`** (`submitted` já significa aguardando análise).

### 3.6 Append-only / supersede
Documentos são **append-only**: não sobrescrever arquivo anterior; não substituir in-place; nova versão usa **`supersedes_document_id`**; histórico documental permanece rastreável.

### 3.7 Arquivo
Documento **não** é blob no banco. Campos: **`file_reference` opaco** (ponteiro provider-agnóstico) + **`file_hash`**. **Proibido:** arquivo binário no banco; base64; documento em `metadata`; contrato social em jsonb; usar `media` placeholder como SSOT; usar `fiscal_documents` (NF-e/venda) como KYB.

### 3.8 Storage provider — FORA
Provider de storage fica **fora** desta DECISION. **NÃO escolher** S3, disco local, `media` placeholder, nem provider "de ouvido". Fatia futura decide: provider · upload · download protegido · antivírus · retention · expurgo de binário · acesso por role (ver `DT-PJ-DOCUMENT-STORAGE-PROVIDER-MISSING`).

### 3.9 `document_type` — valores literais fixados
**Obrigatórios para primeiro KYB:** `cnpj_registration` · `articles_of_association`.
**Condicionais:** `articles_amendment` · `business_address_proof` · `complementary_document`.
**Fora da F2-B inicial (trilho humano/LGPD):** `power_of_attorney` · `legal_representative_document` · `partner_document` · `administrator_document`.

### 3.10 Mínimo documental para KYB approved
**Aprovar KYB sem documentos mínimos aceitos é proibido.** Regra: `reviewFiscalKybRequest(... approved ...)` **deve falhar** se não houver, no mínimo: **um `cnpj_registration` com status `accepted`** E **um `articles_of_association` com status `accepted`** para a `fiscal_identity_id`. Essa regra será implementada na futura F2-B, tocando o writer F2-A **somente** para acrescentar a **pré-condição documental de aprovação**. Enquanto a F2-B não for implementada, a DECISION **registra a regra, mas não altera runtime**.

### 3.11 Rejeição documental
Documento rejeitado: permanece registrado · recebe `decision_reason` · **não some** · pode ser `superseded` por novo documento.

### 3.12 LGPD / docs de pessoa — FORA
Documentos pessoais ficam fora. Motivo: dados pessoais sensíveis; mudam com a transferência; pertencem ao vínculo humano (não à identidade fiscal estável); precisam de desenho próprio de retenção/acesso/expurgo/responsabilidade. **NÃO misturar** documento de empresa com documento de pessoa no mesmo substrato.

### 3.13 Relação com transferência
Documentos da empresa **acompanham a identidade fiscal**. Na transferência: CNPJ/contrato social/histórico permanecem; aceitos/rejeitados seguem auditáveis; novas alterações contratuais entram como **novos documentos**; vínculos humanos mudam em **outro trilho**.

### 3.14 Gate
Gate **F2-C** fica fora. Mas o gate futuro deve confiar em **KYB aprovado com lastro documental**, não em aprovação "no grito" — é a justificativa de a F2-B vir antes da F2-C.

## 4. Schema alvo conceitual — NÃO EXECUTAR (desenho, não SQL)

```text
TABELA FUTURA: fiscal_identity_documents  (GLOBAL, sem tenant)

Campos candidatos:
  document_id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
  fiscal_identity_id     UUID NOT NULL
  kyb_request_id         UUID NULL
  document_type          TEXT NOT NULL
  document_status        TEXT NOT NULL DEFAULT 'submitted'
  file_reference         TEXT NOT NULL
  file_hash              TEXT NULL
  submitted_by_actor_id  UUID NOT NULL
  reviewed_by_actor_id   UUID NULL
  reviewed_at            TIMESTAMPTZ NULL
  decision_reason        TEXT NULL
  supersedes_document_id UUID NULL
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()

Constraints conceituais:
  FK fiscal_identity_id     -> fiscal_identities(fiscal_identity_id)
  FK kyb_request_id         -> fiscal_identity_kyb_requests(kyb_request_id)
  FK submitted_by_actor_id  -> actors(id)
  FK reviewed_by_actor_id   -> actors(id)
  FK supersedes_document_id -> fiscal_identity_documents(document_id)  (self)
  CHECK document_status IN ('submitted','accepted','rejected','superseded')
  CHECK document_type   IN ('cnpj_registration','articles_of_association','articles_amendment',
                            'business_address_proof','complementary_document')
  CHECK final-audit: accepted/rejected exigem reviewed_by_actor_id + reviewed_at + decision_reason
                     (superseded conforme aplicável no desenho da implementação).

NÃO incluir: blob, metadata, provider específico, documento de pessoa, global_user_id,
  company_user_id, CPF, tenant_id.
```
**Isto é desenho alvo, NÃO SQL executável.** A migration futura usa o MESMO CHECK de `document_type`.

## 5. O que fica fora da F2-B DECISION

implementação · migration · rotas · upload real · provider de storage · frontend · download protegido · antivírus · retention final · documentos pessoais · procuração · gate authority (F2-C) · reconciliação company_status · Bank · KYC PF · D3/D5/D4/D6/D7.

## 6. Testes futuros (implementação F2-B, harness efêmero)

migration cria tabela+constraints; documento pertence a `fiscal_identity_id`; `file_reference` obrigatório (sem blob/metadata); `submitted_by_actor_id` obrigatório; append-only/supersede (rejeitado não some); accepted/rejected exige reviewer+reason (CHECK); **review KYB `approved` bloqueado sem o conjunto mínimo aceito** (`cnpj_registration`+`articles_of_association`); transferência preserva documentos; zero Bank; zero `identities` PF; zero frontend; DB efêmera; gates padrão.

## 7. Ordem futura

```text
1. (esta DECISION) F2-B documentos promulgada.
2. Implementação F2-B: migration fiscal_identity_documents + service + pré-condição documental no
   reviewFiscalKybRequest (mínimo aceito para approved) + testes.
3. Storage provider (fatia própria): upload/download protegido/antivírus/retention/expurgo.
4. F2-C gate evaluateKybLayer (lê kyb_status com lastro documental).
5. Reconciliação company_status × kyb_status. Trilho humano/LGPD de docs de pessoa.
```
**PJ comercial bloqueada até F2-C.** Implementação **não** autorizada nesta sessão.

## 8. Superada por

(em aberto — decisão vigente)
