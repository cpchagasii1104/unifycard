# DECISION-0097 — Nascimento e ativação operacional da empresa PJ (modelo canônico)

**Status:** PROMULGADA POR CLAYTON — DECISÃO ARQUITETURAL / INSTITUCIONAL (institucionaliza o desenho canônico de nascimento/classificação/ativação de empresa PJ, sincronizado com o estado vivo pós-DECISION-0090–0096). **DOCS-ONLY / SEM CÓDIGO / SEM MIGRATION / SEM SCHEMA / SEM FRONTEND / SEM BACKEND-RUNTIME** (2026-06-04). Fixa o modelo e as fronteiras; **não** implementa nada.
**Data:** 2026-06-04.
**Tipo:** arquitetural / institucional.
**Sessão:** 2026-06-04 — frente `F-PJ-COMPANY-BIRTH-CANONICAL` (docs-only). **Commit âncora:** `0c4abed2` (pós encerramento da frente presencial PJ — UX 1A/1B/2 + DT-PJ-PRESENTIAL-VALIDATION-UX-ORPHANED CLOSED).
**Decisor:** Clayton. **Validação prévia:** desenho autoral de Clayton (`CRIACAO_DE_EMPRESAS.md`, fora do git) + verificação read-only (esta sessão) + cadeia de DECISIONs 0075/0089–0096.
**Documento canônico:** este arquivo.
**Deriva de:** `CRIACAO_DE_EMPRESAS.md` (desenho autoral de Clayton — Imagem 1 soberana/ontológica + Imagem 2 UX/produto); `DECISION-0075` (dois momentos / Opção B); `DECISION-0084` (precedência fiscal PJ); `DECISION-0089` (reconciliação de leitura KYB); `DECISION-0094` (gate social KYB); `DECISION-0090/0091/0096` (writers VERIFIED + presencial).
**Subordinada a:** `CONSTITUICAO_UNIFICARD.md`, `LEIS_OPERACIONAIS_UNIFICARD.md` (Lei 5/Lei 7), `SSOT_REGISTRY_UNIFICARD.md`, `18_DOMAIN_ONTOLOGY_UNIFICARD.md`, `02_ACTORS_SSOT.md`, `EMPRESA_NASCIMENTO_CANONICO.md`, `IDENTITY_SSOT_PRECEDENCE.md`, `PROHIBITED_STRUCTURES.md`, `SSOT_EXCLUSIVE_BANK_RULE.md`, `07_NOMENCLATURA_CANONICA.md`, `REGRA_CANONICA_CRIACAO_DE_CONTEXT.md`.
**Vinculada a:** `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` (atualizada — ganha DECISION governante p/ Fase 3.3), `DT-PJ-OPERATIONAL-ACTIVATION-VOCABULARY-DRIFT` (criada), `DT-PJ-ONBOARDING-DOMAIN-SELECTION-MISSING` (criada).

---

## 1. Contexto

A criação de empresa PJ vinha sendo descrita por duas lentes que a UX tende a fundir: a lente **soberana/ontológica** (o que a empresa *é*) e a lente **UX/produto** (como o usuário *vê*). Clayton entregou um desenho canônico autoral (`CRIACAO_DE_EMPRESAS.md`) que reconcilia as duas em uma verdade, citando schema/código/norma por evidência. A frente fiscal/KYB PJ (cadeia 0075→0089) e a frente presencial (0090–0096) já materializaram boa parte da espinha; falta **institucionalizar o modelo de nascimento/ativação** como DECISION soberana, sincronizada com o estado vivo atual.

## 2. Problema

`companies.company_status` (default `'ACTIVE'`) funde quatro eixos distintos — verificação fiscal (KYB), lifecycle, prontidão operacional e liberação financeira — e por isso é a origem histórica da "segunda-verdade" fiscal. Sem uma DECISION governante, a Fase 3.3 (schema de `company_status`/`is_verified`) não tem planta; e o vocabulário de ativação (`businessType`/`businessCategory`/`primary_company_type_id`) coexiste em três formas sem soberano declarado. O desenho autoral, além disso, foi gerado de um snapshot anterior a 0090–0096 e contém claims a corrigir contra o disco.

## 3. Decisão

Promulga-se o **modelo canônico de nascimento e ativação operacional da empresa PJ**: a empresa nasce **inerte** (Momento 1, fiscal-first transacional) e só **opera** após ativação explícita (Momento 2, par `type+concept`); verificação fiscal é **exclusivamente** `fiscal_identities.kyb_status`; os quatro eixos de estado permanecem **independentes**; o acoplamento é por **page-actor** e a descoberta por **CONCEPT**. As decisões específicas seguem em D1–D10 (§8). Esta DECISION é **docs-only** e **não autoriza** nenhuma execução (§10).

## 4. Princípio normativo

Ordem causal inviolável: `SEMÂNTICA → IDENTIDADE → AUTORIDADE → TEMPO → ESTADO → FINANCEIRO → EVENTO`. Nenhuma camada cria realidade paralela; abas/telas/status são **projeção** de SSOT (Constituição Art. I/III/V; Lei 5; Lei 7; `EMPRESA_NASCIMENTO_CANONICO`). Empresa é **origem de legitimidade, não de comportamento**: quem age é o page-actor, que exige actor humano responsável (CPF). Identidade antes de comércio.

## 5. Documentos lidos (prova de rastreabilidade — §2.2.2)

Lidos **em full** nesta sessão: `CONSTITUICAO_UNIFICARD`, `LEIS_OPERACIONAIS_UNIFICARD` (Lei 5/7), `EMPRESA_NASCIMENTO_CANONICO`, `02_ACTORS_SSOT`, `PROHIBITED_STRUCTURES`, `IDENTITY_SSOT_PRECEDENCE`, `SSOT_EXCLUSIVE_BANK_RULE`, `REGRA_CANONICA_CRIACAO_DE_CONTEXT`, `18_DOMAIN_ONTOLOGY` (princípios/critério N0/camadas), `00_AGENT_PROTOCOL` (bootstrap). `CRIACAO_DE_EMPRESAS.md` (autoral, full). DECISIONs 0090–0096 (conhecimento direto desta cadeia de sessões), DT_LOG/STATUS/opus. **Por referência** (design doc cita por file:line; sem claim novo sobre seus internos): `SSOT_REGISTRY`, `08_AUTORIDADE`, `AUTHORITY_LAW/ENFORCEMENT`, `SERVICE_CANONICO`, `DEFINICAO_DE_PRODUTO`, `19_N1`/`20_N2`, `03_IDENTITY`, `LEI_DE_COERENCIA`. **Ausente registrado:** `SEMANTIC_CATALOG_GOVERNANCE.md` não existe em `01_normative/`.

## 6. SSOT aplicáveis (e o que NÃO é SSOT)

**SSOT:** identidade civil = `global_user_id`/`identities`; actor operacional = `actors(id)` (page-actor); CNPJ/KYB PJ = `fiscal_identities` (`kyb_status` é a verdade da verificação); semântica = **CONCEPT**; navegação = N0/N1/N2/`categories` (árvore, não identidade); financeiro = `bank_ledger`/UnifyBank (apenas **fronteira negativa** nesta sessão).
**NÃO é SSOT de verificação fiscal:** `companies.company_status`, `companies.status`, `is_verified`, `verifiedAt`, frontend, metadata, validação presencial. **NÃO é identidade semântica:** `businessType`, `businessCategory`, `category_id`, `slug`, N1/N2.

## 7. Decisão (precedência aplicada)

`Constituição > Leis Operacionais > SSOT Registry > 18_DOMAIN_ONTOLOGY > DECISIONs > código/runtime`. Em conflito, a norma vence o código; o código vivo que diverge é dívida, não fonte.

## 8. Decisões específicas (D1–D10)

### D1 — Nascimento PJ em dois momentos
A empresa nasce **inerte**. **Momento 1** (nascimento jurídico/fiscal) cria: identidade fiscal + `companies` + `company_users` + page-actor. **NÃO** cria service, product_offer, availability, capability, oferta, agenda, venda ou trilho financeiro. Estado inicial: `fiscal_identities.kyb_status='pending'`, `company_status` provisional. Empresa nasce com page-actor, **não** nasce operacionalmente vendendo. (Fonte: `EMPRESA_NASCIMENTO_CANONICO` §3–8; design §2/§3.)

### D2 — Ratificação da DECISION-0075 Opção B
O **nascimento fiscal-first transacional** é a opção vencedora e está **materializado** em `companies.service.ts → createCompany`. Ordem canônica (uma transação): (1) validar CNPJ → (2) `INSERT fiscal_identities` (CNPJ duplicado explode em `uq_fiscal_identities_cnpj` → rollback total) → (3) `INSERT companies` (CNPJ = **projeção** subordinada) → (4) `INSERT company_users` → (5) `ensurePageActorTx`. Esta DECISION **ratifica institucionalmente** o estado vivo e **fecha a ambiguidade A/B** da 0075. **Não altera código.**

### D3 — Verificação fiscal PJ
SSOT **único** de verificação fiscal PJ = **`fiscal_identities.kyb_status`**. `company_status`/`companies.status`/`is_verified`/`verifiedAt`/frontend/metadata/validação presencial **não verificam** PJ. `company_status` pode sobreviver **apenas** como lifecycle/projeção operacional compatível, **nunca** como verdade fiscal. **A Fase 3.3 deriva desta DECISION.** (Fonte: `IDENTITY_SSOT_PRECEDENCE` §PJ; `PROHIBITED_STRUCTURES` "enums não são autoridade"; DECISION-0089/0096.)

### D4 — Separação dos quatro eixos
Permanecem **independentes**, cada um com seu SSOT: **fiscal/KYB** (`fiscal_identities.kyb_status`); **lifecycle da company** (`companies` — provisional→active→blocked, projeta, não inventa); **prontidão operacional** (par `type+concept`: draft→configured→ready_to_operate); **visibilidade/transacionabilidade** (marketplace: hidden→visible→transactable). **Proibido** fundir os quatro em `company_status`. `verificada(KYB) ≠ lifecycle ≠ pronta p/ operar ≠ liberada financeiramente`.

### D5 — Produtos / Serviços / Ambos
"Produtos/Serviços/Ambos" é **seleção de domínios N0 operacionais** (`produtos-e-comercio` / `servicos` / ambos = **duas seleções/trilhos paralelos**). "Ambos" **NÃO** é `hybrid` atômico, **não** é CONCEPT único, **não** é blob, **não** é metadata soberana. Relações produto↔serviço são modeladas por **GRAPH** (LAYER 6) entre CONCEPTs, jamais colapsadas num nó híbrido. `businessType`/`businessCategory` são vocabulários **legados/de entrada/UX** a reconciliar, **sem** autoridade soberana. (Fonte: `18_DOMAIN_ONTOLOGY` §3/§4; Lei 7; design §3/§5.)

### D6 — Ativação operacional (Momento 2)
O Momento 2 grava/valida o par **`(primary_company_type_id, primary_concept_id)`** sob CHECK pareado. **CONCEPT** é identidade semântica (Lei 7). N0/N1/N2/`categories` são navegação/árvore/contexto, **não** identidade. **Sem fallback/default/hardcode** de CONTEXT/CONCEPT (`REGRA_CANONICA_CRIACAO_DE_CONTEXT`). `company_type_allowed_concepts` governa a validação de compatibilidade. Enquanto a ativação for primária/singular, o par acima é o vocabulário canônico de ativação.

### D7 — Page-actor como eixo operacional único
A `companies` **não acopla diretamente** a módulo nenhum. O eixo operacional é o **page-actor `actors(id)`**. Marketplace (`product_offers.merchant_id`), serviços (`services.actor_id`), eventos (`events.actor_id`) acoplam **por actor**. A **descoberta/matching semântico** acopla por **`concept_id`** (concept→concept), não pela árvore N0→N1. (Fonte: `02_ACTORS_SSOT`; `EMPRESA_NASCIMENTO_CANONICO` §2; design §4.)

### D8 — Financeiro (fronteira negativa)
Esta DECISION **não mexe em Bank**. Dinheiro vive **exclusivamente** em UnifyBank/`bank_ledger` (Lei 5; `SSOT_EXCLUSIVE_BANK_RULE`). KYB gateia **dinheiro** (F2-C) e **broadcast social** (DECISION-0094), conforme já materializado. Qualquer gate futuro de **operação comercial** (catálogo/oferta/booking) é **decisão posterior**, nunca inferência desta sessão.

### D9 — Correções de snapshot (disco vence narrativa)
O `CRIACAO_DE_EMPRESAS.md` é desenho autoral com correções de estado vivo confirmadas por `psql` nesta sessão:
1. As migrations fiscais/KYB `20260603120000`/`130000`/`140000` **ESTÃO aplicadas em `unificard_dev`** (a incerteza "só DB efêmera" está superada; `fiscal_identities` + `uq_fiscal_identities_cnpj` + `chk_fiscal_identities_approved_audit` + `fiscal_identity_kyb_requests` + `fiscal_identity_documents` presentes).
2. A claim "`product_offers.price NUMERIC`" está **stale**: o schema vivo mostra **`product_offers.price_cents BIGINT`** (não há coluna `price` NUMERIC). **NÃO registrar DT de dinheiro em produto** sem nova verificação dedicada.
3. O desenho **não conhecia DECISION-0090–0096**; sincronização vinculante: os **5 writers legados de `company_status='VERIFIED'/'APPROVED'` já foram neutralizados** (0090/Fases 2.1–2.5; grep ZERO writer vivo); a **validação presencial/QR/UX órfã está encerrada** (0091/0096 + UX 1A/1B/2; `DT-PJ-PRESENTIAL-VALIDATION-UX-ORPHANED` CLOSED). Logo o **SECOND-TRUTH residual hoje é principalmente schema/compat/lifecycle** (`company_status` CHECK + `is_verified` drop), **não** writer vivo de VERIFIED — corrige a leitura da §10.2 do desenho.

### D10 — Bloqueios explícitos
Esta DECISION **NÃO autoriza** (cada um vira execução/decisão própria): schema da Fase 3.3; migration; CHECK em `company_status`; drop de `is_verified`; novo wizard de produtos/serviços; alteração em marketplace/services/events; gate KYB de oferta/booking; alteração de Bank. "O mapa habilita o desenho; a execução espera Clayton." Em especial, as **decisões §9.1–4 do desenho** (domínios N0; vocabulário; ratificar 0075-B — agora feito em D2; reconciliar `company_status`) condicionam a sequência.

## 9. O que esta DECISION supera/ratifica

- **Ratifica:** DECISION-0075 Opção B (nascimento fiscal-first transacional) como vencedora (D2) — fecha a ambiguidade A/B.
- **Consolida e governa:** o modelo de nascimento/ativação do desenho autoral `CRIACAO_DE_EMPRESAS.md`.
- **Sincroniza:** a visão de estado vivo do desenho com HEAD `0c4abed2` (incorpora 0090–0096; corrige claims de snapshot — D9).
- **Não supera** nenhuma DECISION vigente; é compatível e subordinada à cadeia 0089/0094/0096.

## 10. O que NÃO está autorizado

Ver D10. Reforço: **zero** código/schema/migration/Bank/frontend/backend-runtime nesta frente. Nenhuma execução das frentes da §12 começa antes da palavra explícita de Clayton sobre as decisões pendentes.

## 11. Impacto em DTs

- **`DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH`** → permanece **OPEN**; agora tem **DECISION governante** (esta) para a Fase 3.3 — o resíduo é schema/compat/lifecycle, não writer vivo (D9.3).
- **`DT-PJ-OPERATIONAL-ACTIVATION-VOCABULARY-DRIFT`** → **criada (OPEN)**: `businessType`(front) ≠ `businessCategory`(back) ≠ `primary_company_type_id`(SSOT); o SSOT é o par `type+concept`, os outros são legado/UX a reconciliar.
- **`DT-PJ-ONBOARDING-DOMAIN-SELECTION-MISSING`** → **criada (OPEN)**: a seleção "produtos/serviços/ambos" sobre N0/`company_type`/`concept` ainda não tem writer no onboarding; "ambos" = dois trilhos via GRAPH.
- **NÃO criada:** DT de `product_offers.price NUMERIC` — claim refutada pelo disco (D9.2).

## 12. Próximas frentes autorizáveis (sem execução agora)

1. **Fase 3.3** (schema), **desenhada a partir desta DECISION**: CHECK em `company_status` (lifecycle puro), destino de `is_verified` (drop/compat), política de dados legados — derivando de D3/D4.
2. **Read-only do vocabulário de ativação** (`businessType`/`businessCategory`/`primary_company_type_id`) → DECISION de reconciliação (D5/`DT-...VOCABULARY-DRIFT`).
3. **Desenho de produtos/serviços/ambos** (onboarding domain-selection) sobre N0 (D5/D6/`DT-...DOMAIN-SELECTION-MISSING`).

## 13. Evidência material (verificada nesta sessão)

`unificard_dev`, HEAD `0c4abed2`, 355 migrations. `schema_migrations` contém `20260603120000_create_fiscal_identities_and_company_fk.sql` / `130000_create_fiscal_identity_kyb_requests.sql` / `140000_create_fiscal_identity_documents.sql`. `fiscal_identities` com `uq_fiscal_identities_cnpj` + `chk_fiscal_identities_approved_audit`. `companies` com `status` (default `'active'`) **e** `company_status` (default `'ACTIVE'`) + `is_verified` (default false) + `fiscal_identity_id`/`primary_company_type_id`/`primary_concept_id` (nullable). `product_offers.price_cents BIGINT`; `services.price_cents INTEGER`.

## 14. Referências normativas

`CONSTITUICAO_UNIFICARD` (Art. I/III/V/VII); `LEIS_OPERACIONAIS` (Lei 5 Bank, Lei 7 CONCEPT); `SSOT_EXCLUSIVE_BANK_RULE`; `02_ACTORS_SSOT`; `EMPRESA_NASCIMENTO_CANONICO`; `IDENTITY_SSOT_PRECEDENCE` (§PJ); `PROHIBITED_STRUCTURES`; `18_DOMAIN_ONTOLOGY` (§3 N0, §4 camadas/GRAPH); `REGRA_CANONICA_CRIACAO_DE_CONTEXT`; `07_NOMENCLATURA_CANONICA` (`*_cents`, governança semântica).

## 15. Referências de commits recentes

`0c4abed2` (UX 2 / DT presencial CLOSED) · `c93c9886` (UX 1B) · `461f4339` (UX 1A backend 501) · `c8faed44` (DECISION-0096) · `0945b577` (Profile Progress 1) · `a2ca7f0c` (DECISION-0095) · `db00546d` (depreca status legados). Cadeia fiscal: DECISION-0075/0084/0089; gate social 0094.

## 16. Nota de sincronização com HEAD atual

Esta DECISION nasce **alinhada ao HEAD `0c4abed2`**. O desenho autoral que a originou era de snapshot anterior a 0090–0096; as três correções de D9 (migrations aplicadas; `price_cents` não NUMERIC; writers VERIFIED já neutralizados + presencial encerrada) reconciliam a planta com o disco. **Disco vence narrativa**: qualquer execução futura re-verifica o estado vivo antes de agir.

## 17. Superada por

(em aberto — decisão vigente)
