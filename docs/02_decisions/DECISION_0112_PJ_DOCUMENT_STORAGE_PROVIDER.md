# DECISION-0112 — Storage documental KYB/PJ: provider, port canônico, autoridade e segurança/LGPD

**Data:** 2026-06-06
**Tipo:** Arquitetura / Identidade Fiscal (PJ) / Storage / LGPD-Segurança — **docs-only**
**Status:** PROMULGADA (docs-only) — **NÃO** autoriza código/runtime/migration/provider/upload/download/wizard/endpoint. Define o **desenho canônico** do storage documental KYB; a implementação é fase seguinte. **Parâmetros de produto (§7) NÃO são promulgados** — dependem de escolha do Clayton.
**Frente:** `D-PJ-DOCUMENT-STORAGE-PROVIDER` (design-first, READ-ONLY material)
**HEAD de origem:** `81fd4d8e`
**Decisor:** Clayton (diretrizes cravadas no envelope de `D-PJ-DOCUMENT-STORAGE-PROVIDER`)
**Deriva de / subordinada a:** `DECISION-0087` (SSOT documental KYB; provider deixado FORA por §3.8), `DECISION-0085/0086` (identidade fiscal + writer KYB), `AUTHORITY_LAW` / `AUTHORITY_ENFORCEMENT_MODEL` (autoridade canônica), `LEIS_OPERACIONAIS_UNIFICARD`, `SSOT_REGISTRY_UNIFICARD`, `07_NOMENCLATURA_CANONICA`, `COMPLIANCE_REGULATORIO_UNIFYBANK`.
**Vinculada a:** `DT-PJ-DOCUMENT-STORAGE-PROVIDER-MISSING` (governada por esta DECISION), `DT-PJ-KYB-DOCUMENTS-NOT-IN-ONBOARDING` (segue OPEN), `DT-PJ-HUMAN-LINK-DOCUMENTS-LGPD-MISSING` (docs de pessoa = outro trilho).

---

## 1. Contexto / gap (READ-ONLY, HEAD `81fd4d8e`)

- **SSOT vivo, provider ausente.** `fiscal_identity_documents` existe (migration `20260603140000`, DECISION-0087) com `file_reference` **OPACO** + `file_hash`; o writer canônico (`fiscal-identity-document.service.ts`: submit/list/review/supersede) e o gate KYB de docs mínimos (`fiscal-identity-kyb.service.ts`) estão vivos (rotas `/identity/pj/kyb/*`, admin). **Não há provider real de armazenamento.**
- **O circuito legado morreu** (`company_documents` fantasma; upload/readers/admin tombstonados — commits `8180a493`/`dd4e202c`). `company_documents` **não existe e não deve ser recriada**.
- **Achados materiais de segurança (centrais para esta DECISION):**
  - **`uploads/` é servido como estático PÚBLICO sem autenticação** — `app.builder.ts` registra `@fastify/static` com `root=process.cwd()/uploads`, `prefix='/uploads/'`. O caminho legado `/uploads/companies/...` (já tombstonado) era **baixável por URL por qualquer um**. **Documento KYB jamais pode residir em diretório estático público.**
  - **`media` (`modules/media`) é placeholder fake** (`POST /media/presign` devolve `https://storage.example.com/...`; upload "direto" placeholder) — **não é provider**, não usar para documento KYB.
  - **`group-image.service`** grava **imagem** em disco local (`uploads/groups`, webp) — impróprio para documento legal/probatório.
  - **`COMPLIANCE_REGULATORIO_UNIFYBANK`** já registra: "Armazenamento de documentos ❌ — sem gestão documental probatória".
- **Arquivo bruto NÃO entra no banco hoje** (a tabela SSOT não tem coluna de blob/base64/bytea; o e2e de F2-B prova ausência dessas colunas). Esta DECISION **mantém** esse invariante.
- **`file_reference` opaco é suficiente** para apontar a um objeto em storage externo/local sem expor caminho — falta o **provider** que produz/resolve essa referência com segurança.

**Tese central (vinculante):** documento KYB é **evidência sensível**. **Storage é um PORT**, não uma pasta. O **banco guarda metadado, nunca o binário**. **Acesso (submit e download) é autorizado e auditado**, nunca por posse de ID nem por URL pública. **Provider local existe só em dev**; em produção, ausência de provider configurado **falha fechado**.

## 2. O que esta DECISION promulga (arquitetura — técnica)

> Numeração D1…D13. São invariantes técnicos diretivos do Clayton. Parâmetros de produto ficam em §7 (não promulgados).

- **D1 — Storage não é `company_documents`.** A tabela fantasma está morta e **não será recriada**. O SSOT documental KYB é `fiscal_identity_documents` (âncora `fiscal_identity_id`, DECISION-0087).
- **D2 — `file_reference` é referência OPACA, não caminho público.** É um ponteiro provider-agnóstico resolvido pelo port. **Proibido**: caminho de filesystem público, URL pública adivinhável, `/uploads/...`, nome de arquivo do usuário como chave. Documento KYB **nunca** é servido por estático público.
- **D3 — Arquivo bruto NUNCA entra no banco.** Sem `bytea`/blob/base64/`file_data` na tabela documental nem em `metadata`/jsonb. O banco guarda **só metadado**.
- **D4 — Metadados mínimos no SSOT.** `file_reference`, `file_hash` (checksum), `document_type`, `submitted_by_actor_id`, `document_status`, timestamps — **já existem**. **`mime_type` e `size_bytes` são adição futura** (pequena migration na fatia `F-PJ-DOCUMENT-STORAGE-PORT`, **não agora**) — ou residem no metadado do próprio provider, decisão da fatia de implementação. Nada além de metadado mínimo entra.
- **D5 — Provider acessado por PORT/interface canônica.** Um `DocumentStoragePort` (contrato único: `put`/`get`/`delete`/`exists` sobre referência opaca + hash) — **não** chamadas diretas a SDK de provider espalhadas pelo código. Precedente: `pix-provider.interface.ts` (port + mock/real). O core fala com o port; o provider é detalhe substituível.
- **D6 — Provider local/dev é implementação do port, não verdade normativa.** Em **dev** é permitido um provider local (disco **privado**, fora de `/uploads/` público). Em **produção** o provider é **explícito e configurado**; **ausência de provider em produção = fail-closed** (boot ou submit recusa, nunca cai num default público).
- **D7 — Upload user-facing exige AUTORIDADE (não posse de ID).** Para o dono/operador da empresa submeter: resolver **`companyId → fiscal_identity_id`** (coluna `companies.fiscal_identity_id`) e **provar vínculo autorizado** do actor com a empresa — `canManageCompany` (company_users) **ou** regra equivalente de authorized links/delegations. **Posse do ID não basta.** (Hoje as rotas canônicas são admin-only; a porta user-facing é fatia futura com este gate.)
- **D8 — Download/visualização exige autorização SEPARADA e auditável.** Usuário autorizado da empresa vê/submete seus documentos conforme política; admin/reviewer vê para revisão. **Sempre** por endpoint autorizado e auditado — **nunca** por estático público. Autorização de download ≠ autorização de submit (gates distintos).
- **D9 — Documento não verifica empresa.** Review documental **não aprova KYB** sozinho; upload **não muda `company_status`**; upload **não muda `kyb_status`**. A aprovação KYB segue **só** no writer fiscal auditado (`fiscal-identity-kyb.service.ts`) com o gate de docs mínimos aceitos (DECISION-0087 §3.10). Storage entrega/guarda evidência; **autoridade decide**.
- **D10 — Retenção e exclusão.** Evidência sensível **não é apagada sem política**. Versionamento por **supersede** (append-only de metadado, DECISION-0087 §3.6); **revocation/retention** previstos; histórico documental **permanece auditável**. Expurgo de binário (quando houver) é ato **com política e trilha**, conciliando append-only de metadado com LGPD — **não** delete silencioso.
- **D11 — Segurança do objeto.** Limitar **MIME** e **tamanho** permitidos; **calcular hash** (integridade/dedupe); **impedir path traversal**; **não expor path local público**; **não confiar no filename do usuário** (chave gerada pelo port). Validação na borda, fail-closed.
- **D12 — Eventos/auditoria.** **Submissão, supersede, review e download sensível** geram **trilha auditável** (quem/quando/qual documento/qual decisão), coerente com `AUTHORITY_ENFORCEMENT_MODEL`.
- **D13 — Dev vs produção.** Provider local **só em dev**; produção usa provider **explícito configurado**; **ausência em produção falha fechado** (sem fallback público, sem disco mundo-legível).

## 3. Invariantes herdados (não reabrir)

`company_documents` morta (não recriar) · SSOT = `fiscal_identity_documents` · `file_reference` opaco · arquivo bruto fora do banco · upload/review não mexem `company_status`/`kyb_status` · aprovação KYB só no writer fiscal com gate documental · `/uploads/` público **proibido** para documento KYB.

## 4. Impacto de schema (sem executar)

- **Já existe** em `fiscal_identity_documents`: `file_reference`, `file_hash`, `document_type`, `submitted_by_actor_id`, `document_status`, `created_at`/`updated_at`, `supersedes_document_id`, FKs e CHECKs.
- **Adição futura** (fatia `F-PJ-DOCUMENT-STORAGE-PORT`, **não nesta DECISION**): `mime_type`, `size_bytes` — **OU** mantê-los no metadado do provider (a fatia de implementação decide). Migration **pequena e forward-only**, fora do escopo docs-only de hoje.
- **Sem migration agora.** dev permanece 365.

## 5. O que fica FORA desta DECISION

Implementação · migration · provider real (S3/GCS/MinIO/disco-privado como destino final) · upload real · download real · wizard · endpoint novo · antivírus (vendor/infra) · documentos de **pessoa** (sócio/representante/procuração — `DT-PJ-HUMAN-LINK-DOCUMENTS-LGPD-MISSING`, outro trilho) · Bank · KYB release gate.

## 6. Plano de execução futuro (registrado, NÃO executado)

1. **`F-PJ-DOCUMENT-STORAGE-PORT`** — `DocumentStoragePort` + provider local-dev (disco privado, fora de `/uploads/`) + (se decidido) colunas `mime_type`/`size_bytes`; fail-closed sem provider em prod. **Nenhum upload user-facing ainda.**
2. **`F-PJ-KYB-DOCUMENTS-USER-SUBMIT`** — rota user-facing de submit com o gate de autoridade D7 (`companyId→fiscal_identity_id` + `canManageCompany`/delegations); produz `file_reference` via port.
3. **`F-PJ-KYB-DOCUMENTS-ADMIN-REVIEW-UI`** — UI admin sobre `fiscal_identity_documents` (list/review canônicos já existem no backend) + download autorizado/auditado via port.
4. **`F-PJ-KYB-RELEASE-GATE`** — gate de autoridade que confia em KYB aprovado **com lastro documental** (já gated por docs mínimos no writer).

## 7. Parâmetros de PRODUTO — NÃO promulgados (perguntas ao Clayton)

A arquitetura (D1–D13) está promulgada. **Os itens abaixo dependem de escolha de produto/infra e NÃO são cravados como decisão técnica** — ficam abertos para o Clayton antes da fatia `F-PJ-DOCUMENT-STORAGE-PORT`:

1. **Provider de produção:** qual (S3 / GCS / MinIO self-hosted / outro)? Decisão de infra/deploy — não escolher "de ouvido".
2. **Antivírus:** obrigatório já no MVP (custo/infra) ou fase posterior? (D11 prevê o lugar; a obrigatoriedade é produto.)
3. **Retenção:** por quanto tempo guardar documentos aceitos/rejeitados/superseded? Política de expurgo (LGPD/compliance) — número e gatilho a definir.
4. **Porta de submit no MVP:** o **dono da empresa** submete (user-facing já no MVP) **ou** começa **só admin/back-office**? (D7/D8 definem o gate; a sequência de produto é sua.)

## 8. DTs

- `DT-PJ-DOCUMENT-STORAGE-PROVIDER-MISSING` → **governada por esta DECISION** (desenho cravado; segue OPEN até a fatia `F-PJ-DOCUMENT-STORAGE-PORT` implementar). Não fechar sem runtime.
- `DT-PJ-KYB-DOCUMENTS-NOT-IN-ONBOARDING` → **OPEN** (depende do port + porta user-facing).
- `DT-PJ-HUMAN-LINK-DOCUMENTS-LGPD-MISSING` → **OPEN** (docs de pessoa, outro trilho).

## 9. Superada por

(em aberto — decisão vigente)
