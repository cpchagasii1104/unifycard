# CRIAÇÃO DE EMPRESAS — DEFINIÇÃO CANÔNICA (UnifyCard / UnifyBank)

> **Tipo:** Desenho canônico + briefing de execução (read-first, candidato a DECISION).
> **Audiência:** o agente que vai agir (Claude Code executor / instância de pesquisa). Documento **autossuficiente** — o leitor NÃO tem o contexto da sessão que o gerou; tudo o que precisa saber está aqui.
> **Escopo:** Como uma empresa (PJ) nasce, é classificada, acopla aos módulos e opera — **da forma certa**.
> **Base de evidência:** auditoria direta de `MIGRATIONS_FULL.txt` (355 migrations, até `20260603140000`), `SRC_FULL.txt`, `frontend_src_completo.txt`, `01_NORMATIVE_FULL.txt`, `SSOT_FULL.txt`. Toda afirmação de estado vivo está citada por tabela/constraint/arquivo+função.
> **Aviso de snapshot:** este snapshot é **mais novo** que o HEAD `bca68684` dos relatórios de pesquisa — várias conclusões daqueles relatórios estão corrigidas na §7.
> **Não aplicado:** as migrations fiscais/KYB (`20260603120000/130000/140000`) **podem não estar aplicadas em `unificard_dev`** (relatório: só DB efêmera). Confirmar com `psql` antes de runtime local. Este documento não toca disco.

---

## ⚠️ PARA O AGENTE EXECUTOR — LEIA ANTES DE TUDO

Você (a IA que vai agir) **não tem** o contexto da sessão que gerou este documento. Internalize as regras abaixo antes de propor ou executar qualquer coisa. Violá-las = execução inválida.

### Como operar
- **Leitura primeiro, disco depois.** Procure código/schema em `SRC_FULL.txt` / `MIGRATIONS_FULL.txt` / `01_NORMATIVE_FULL.txt` / `SSOT_FULL.txt` **antes** de pedir leitura ao executor de disco. Não peça para ler o que já está nesses arquivos.
- **Disco vence narrativa.** Relatório — **inclusive este** — não é evidência. Toda afirmação de estado vivo exige `file:line` ou constraint/schema. Capture baseline **antes** de mudar; nunca assuma do histórico. *(Este doc nasceu corrigindo relatórios que a evidência refutou — §7.)*
- **Escopo cirúrgico.** Sem refactor oportunista. DTs são **registradas e nomeadas**, nunca corrigidas em silêncio. Documenta antes de corrigir.
- **Um executor escreve por vez.** Instâncias de pesquisa leem em paralelo (read-only). ChatGPT ratifica **diffs crus**, nunca narrativa.
- **Regra anti-vazamento:** prompt que depende de ratificação (Clayton + ChatGPT) **não** vai ao executor antes de ratificado; carrega no topo `NÃO EXECUTAR AINDA — LEVAR AO CHATGPT PRIMEIRO`. Convergência entre IAs **não é** promulgação de Clayton; selo exige a palavra explícita dele.
- **Gates após cada alteração** (todos verdes; se algum falhar, parar e investigar): `validate:actor-writer-boundaries` · `validate:bank-ledger-boundaries` · `validate:regression-guards` · `validate-architectural-patterns --strict`.

### O que você NUNCA faz (invariantes — detalhe na §1)
- Escrever em `bank_ledger`/`bank_transactions` fora de `modules/bank/` ou `core/unifybank/`.
- Criar actor fora de `ensureUserActor` / do writer de page-actor (`ensurePageActorTx`).
- Deixar `actor_type` carregar negócio/profissão/vertical (isso é CONCEPT / category / company_type).
- Inferir identidade de `slug` / `category_id` / `display_name` (identidade = CONCEPT).
- Usar `NUMERIC`/float para dinheiro (é `*_cents` inteiro).
- Tratar N0/N1/N2/CONTEXT como identidade ou regra de negócio.
- Criar realidade paralela: aba/feed/status são **projeção** de SSOT, nunca cópia concorrente.

### O que está ACIONÁVEL agora × BLOQUEADO
**Acionável (read-only / baixo risco):**
1. `psql` confirmando se as migrations fiscais/KYB (`20260603120000/130000/140000`) estão **aplicadas** em `unificard_dev` (§10.1 — fronteira de runtime).
2. Registrar como DT/diagnóstico os achados da §7/§8 ainda não corrigidos (sem correção).
3. Desenho read-only das frentes da §10 (sem tocar disco).

**BLOQUEADO até a palavra explícita de Clayton (§9, em especial 1–4):**
- Materializar "produtos/serviços/ambos" (decisão 1).
- Aposentar/reconciliar `company_status` como verdade de verificação (decisão 4).
- Apertar o CHECK de `actor_type` (decisão 6).
- Qualquer execução que dependa de ratificação ainda não concluída.

> Não confunda "o mapa está claro" com "estou autorizado a executar". O mapa habilita o **desenho**; a execução espera Clayton.

---

## 0. Propósito e precedência

Este documento é a **fonte única de como criar empresa**. Reconcilia a lente *soberana/ontológica* (Imagem 1) e a lente *UX/produto* (Imagem 2) em **uma verdade**. As duas lentes descrevem o mesmo objeto; nenhuma pode inventar status paralelo.

**Hierarquia normativa que governa (precedência):**
`Constituição > Leis Operacionais > SSOT Registry > 18_DOMAIN_ONTOLOGY > demais`.

**Ordem causal sistêmica (inviolável):**
`SEMÂNTICA → IDENTIDADE → AUTORIDADE → TEMPO → ESTADO → FINANCEIRO → EVENTO`.
Evento nunca é causa primária. Usar uma camada no lugar de outra = ERRO ESTRUTURAL.

**Princípio raiz:** *o sistema é único; nenhuma camada cria realidade paralela.* Abas, telas e status são **projeções** de SSOTs, nunca cópias concorrentes.

---

## 1. Invariantes aplicáveis à criação de empresa

| # | Invariante | SSOT / evidência |
|---|---|---|
| I1 | **CONCEPT é o único SSOT semântico.** `category_id`, `slug`, N0/N1/N2, `company_type` **não** definem identidade. | `concepts` (mig. `concepts`, tab. l.3033); Lei 7 |
| I2 | **`actors(id)` (page-actor) é a chave operacional universal de acoplamento.** A empresa não se liga a módulo nenhum direto; liga-se via seu page-actor. | `companies` não tem FK para módulos; toda FK de módulo → `actors(id)` (§4) |
| I3 | **`fiscal_identities` é a casa do CNPJ e o SSOT de `kyb_status`.** `companies.cnpj` é projeção unidirecional. | mig. `20260603120000`; `companies.fiscal_identity_id` FK |
| I4 | **`bank_ledger`/`bank_transactions` é o SSOT financeiro.** Só `modules/bank/` e `core/unifybank/` escrevem. | Lei 5 |
| I5 | **Empresa é origem de legitimidade, não de comportamento.** Quem age é o page-actor; page exige actor humano responsável (CPF). | `EMPRESA_NASCIMENTO_CANONICO`; `actors.company_id` + `responsible_actor_id` |
| I6 | **N0/N1/N2/CONTEXT = navegação e ativação, nunca identidade nem regra de negócio.** N2 não dispara dinheiro/estado/evento. | 18/19/20; `REGRA_CANONICA_CRIACAO_DE_CONTEXT` |
| I7 | **Valor monetário = `*_cents BIGINT` inteiro.** Nunca `NUMERIC`/float para dinheiro. | §Nomenclatura |

---

## 2. O modelo em dois momentos (a espinha)

A empresa **não nasce vendendo**. Nasce inerte e só depois é ativada.

- **Momento 1 — Nascimento jurídico inerte.** Cria identidade fiscal + entidade + vínculo + page-actor. **Não cria** service, availability, oferta ou capability. Estado: `company_status` provisional / `kyb_status='pending'`.
- **Momento 2 — Ativação operacional.** Grava o par `(primary_company_type_id, primary_concept_id)` validado, definindo *o que a empresa é operacionalmente* e abrindo os trilhos.

**Quatro eixos que a UX tende a fundir e que são DISTINTOS:**
`verificada (KYB)` ≠ `lifecycle da company` ≠ `pronta para operar` ≠ `liberada financeiramente`.
Fundir os quatro num campo só (`company_status`) é a origem da segunda-verdade (§6, §7).

---

## 3. Fluxo canônico — passo a passo (a definição "como deve ser")

### Etapa 0 — Responsável civil (pré-condição de tudo)
CPF → `global_user` → `identity` → **actor humano** → autoridade. Nenhum actor existe sem CPF responsável; o page-actor da empresa terá `responsible_actor_id` = actor humano.

### Etapa 1 — Nascimento (transacional, fiscal-first) — ✅ CONSTRUÍDO
Ordem **obrigatória**, dentro de **uma** transação (`withTransaction`):
1. **valida CNPJ** (DV/14 dígitos) **antes** de reservar qualquer coisa;
2. `INSERT fiscal_identities (cnpj, kyb_status='pending', created_by_actor_id)` — **CNPJ duplicado explode aqui** (`uq_fiscal_identities_cnpj`) → rollback total; CNPJ nunca consumido pela metade;
3. `INSERT companies (fiscal_identity_id, cnpj=PROJEÇÃO, company_status=provisional, ...)`;
4. `INSERT company_users` (vínculo + permissões);
5. `ensurePageActorTx(client, tenant, companyId, creatorActorId)` → page-actor (`actor_type='page'`, `company_id`, `responsible_actor_id`).

> Evidência: `core/companies/companies.service.ts → createCompany` (`withTransaction` → `INSERT fiscal_identities` → `INSERT companies` → `ensurePageActorTx`; tratamento `23505/uq_fiscal_identities_cnpj`). É a **Opção B** (full-birth transacional) da DECISION-0075.

### Etapa 2 — KYB — ✅ writer construído (workflow parcial)
SSOT = `fiscal_identities.kyb_status` (`pending/approved/rejected/suspended/closed`). Workflow `fiscal_identity_kyb_requests` (submit→review; 1 pending por fiscal_identity). `approved` exige reviewer + reviewed_at (CHECK `chk_fiscal_identities_approved_audit`).
**Regra:** verificação **nunca** vem de `company_status`/`is_verified`; vem só de `kyb_status` (DECISION-0089).

### Etapa 3 — Pergunta inicial: "produtos / serviços / ambos"
**Classificação ontológica:** NÃO é CONCEPT, NÃO é CONTEXT, NÃO é INTENT, NÃO é atributo livre. É **seleção de quais domínios N0 a empresa vai operar**: `produtos-e-comercio` (#4), `servicos` (#5), ou ambos — domínios **distintos e irredutíveis** (18 §7).

**Como materializar (correto):** projetar sobre `company_type` + `concept`; **"ambos" = união de duas seleções**, jamais um terceiro valor atômico.
**Anti-padrão a banir:** `businessCategory='hybrid'` como identidade soberana (achata dois N0). Rótulo de UX sugerido: *"Como sua empresa pretende operar no UnifyCard?"* → Vender produtos / Prestar serviços / Ambos. A resposta é **modo operacional**, não ramo nem string.

### Etapa 4 — Classificação `N0 → N1 → CONTEXT → CONCEPT` (Momento 2)
- **N0**: domínio(s) selecionado(s) na Etapa 3.
- **N1**: *área principal de atuação* — navegação governada (1 dos N1 do domínio), nunca texto livre.
- **CONTEXT**: perfil de uso; nasce pela regra canônica, **sem fallback/default/hardcode**.
- **CONCEPT**: identidade semântica soberana (Lei 7), validada contra `company_type_allowed_concepts`.
- **Persistência**: `activateCompanyOperationally` grava o par `(primary_company_type_id, primary_concept_id)` sob CHECK pareado.

### Etapa 5 — Trilhos operacionais (detalhe na §5)
Trilho A (produtos), Trilho B (serviços), ou os **dois trilhos em paralelo** ligados por GRAPH.

### Etapa 6 — Gates de operação (semáforo)
`actor existe → CPF responsável → vínculo autorizado → fiscal/CNPJ ok → KYB aprovado → domínio operacional selecionado → CONCEPT válido → oferta configurada → (produto: preço+estoque+catálogo | serviço: agenda+capacidade+execução) → só então publicar/vender/contratar`.

### Etapa 7 — Estados e UX
Status exibido (*Em Cadastro / Aguardando / Ajustes / Aprovada / Ativa / Suspensa / Rejeitada*) **deriva de** `kyb_status` + lifecycle; **não** inventa verdade na tela (§6).

---

## 4. Acoplamento aos módulos — o eixo único (page-actor)

A tese, confirmada no código: **tudo se acopla por UM eixo — o page-actor `actors(id)`.** A `companies` não toca módulo nenhum diretamente.

```
companies.company_id
   │ (ensurePageActorTx)
   ▼
actors(id)  ── PAGE-ACTOR ──►  eixo OPERACIONAL único
   ├─ Marketplace   product_offers.merchant_id  → actors(id)
   ├─ Serviços      services.actor_id           → actors(id)
   ├─ Serviços (OS) service_orders.worker_actor_id → actors(id)
   └─ Eventos       events.actor_id (organizer) → actors(id)

concept_id ── EIXO SEMÂNTICO (descoberta/matching) ──►
   tenant_concept_offerings(tenant_id, concept_id)   [empresa declara o que oferece]
   product_offers → products → categories.concept_id → concepts
```

| Módulo | Coluna de acoplamento | Aponta para | Padrão | Evidência |
|---|---|---|---|---|
| Marketplace | `product_offers.merchant_id` | `actors(id)` | actor-first ✅ | mig. `0122_product_offers` |
| Serviços (oferta) | `services.actor_id` | `actors(id)` | actor-first ✅ | tab. `services` |
| Serviços (booking) | `service_orders.worker_actor_id` | `actors(id)` | actor-first ✅ | relatório (confirmar) |
| Eventos (organizer) | `events.actor_id` | `actors(id)` | actor-first ✅ | tab. `events` |

**Eixo semântico:** o acoplamento *operacional* é por `actor_id`; o *de descoberta* é por **`concept_id`** (concept→concept), **não** pela árvore N0→N1. Bate com a frente C1 (Learning/Interest): conceito é identidade, categoria é breadcrumb.

**Regra do gate KYB no acoplamento (atualizada — §7):** KYB **gateia dinheiro** (débito/payout, F2-C) **e broadcast social** (publicar feed / votar, DECISION-0094). KYB **não gateia listar/ofertar** (criar oferta/serviço/evento) — por design: vendedor/prestador/organizador majoritariamente **recebem**; o gate fecha quando o dinheiro **sai** pelo lado da PJ.

---

## 5. Os dois trilhos em detalhe

### Trilho A — Produtos (`produtos-e-comercio`)
```
N1 (produto) → CONTEXT → CONCEPT (domínio pj_produtos)
  → canonical_product (concept_id OBRIGATÓRIO; herda do catálogo global, não cria universo)
    → oferta (product_offers.merchant_id = page-actor)
      → preço + estoque → PDV/checkout/logística
        → gate financeiro (KYB para sacar)
```
Produto **não nasce de nome digitado**; nasce de identidade semântica (CONCEPT) e depois vira item vendável.

### Trilho B — Serviços (`servicos`)
```
N1 (serviço) → CONTEXT → CONCEPT (domínio pj_servicos)
  → service offering (services.actor_id = page-actor)
    → agenda/availability (Agenda Universal; serviço só REFERENCIA slots, não cria agenda paralela)
      → capacidade/recurso → orçamento → booking/OS → dispatch
        → gate financeiro (KYB para sacar)
```
Serviço sem agenda/execução é cartão de visita: não opera. Tempo/conflito só existem pela Agenda Universal (`CORE_IMUTAVEL`).

### "Ambos" — sem blob misto
Como produtos e serviços são N0 **irredutíveis**, "ambos" = **dois trilhos independentes**, cada um com seu CONCEPT. A relação (ex.: vende peça **e** instala) é modelada por **GRAPH (LAYER 6)**, jamais colapsando num `company_type`/CONCEPT "híbrido".

| Empresa | Produto | Serviço | Modelagem |
|---|---|---|---|
| Material de construção | cimento/tinta | instalação/pintura | dois trilhos + relação complementar |
| Salão | cosmético | corte/manicure | produto + serviço c/ agenda |
| Clínica | item de saúde | consulta/exame | dois trilhos + **invariantes de saúde** (sigilo/CFM) |
| Tecnologia | licença | implantação/suporte | produto digital + serviço recorrente |

---

## 6. Estados canônicos — matriz (matar a segunda-verdade)

Quatro eixos **independentes**, cada um com seu SSOT:

```
Fiscal/KYB (SSOT: fiscal_identities.kyb_status)
   pending → approved | rejected | suspended | closed

Company lifecycle (companies)         ← deve PROJETAR fiscal/operacional, não inventar
   provisional → active | blocked

Operacional (par type+concept)
   draft → configured → ready_to_operate

Marketplace (visibilidade)
   hidden → visible → transactable
```

**Regra em vermelho:**
`KYB ≠ company_status` · `company_status não substitui autoridade` · `visível ≠ operável` · `operável ≠ liberado financeiramente`.

**Mapeamento UX → verdade** (a tela projeta, não decide):

| Status na UI | Deriva de |
|---|---|
| Em Cadastro / Aguardando | `kyb_status='pending'` (+ request submetido) |
| Ajustes Solicitados | `under_review`/`needs_more_info` *(estado DEFERIDO — decisão pendente, §9)* |
| Aprovada / Verificada | `kyb_status='approved'` |
| Suspensa / Rejeitada | `kyb_status` `suspended`/`rejected` |
| **Ativa** | `kyb_status='approved'` **+** ativação operacional (Momento 2) — **dois conceitos, não um** |

> **Risco vivo:** o que o usuário chama de "Ativa" funde *verificada* e *operacional*. Manter os dois separados ou recria-se o drift.

---

## 7. AUDITORIA — estado vivo vs. norma (com correções dos relatórios)

### ✅ Construído (verificado)
- **Nascimento fiscal-first transacional** — `companies.service.ts → createCompany` (`withTransaction`; fiscal→company→`ensurePageActorTx`; CNPJ dup na fonte).
- **`fiscal_identities`** GLOBAL (sem tenant), PK `fiscal_identity_id`, `cnpj` UNIQUE+CHECK 14, `kyb_status` enxuto, auditoria por `*_actor_id`, CHECK approved-audit — mig. `20260603120000`.
- **`fiscal_identity_kyb_requests`** (`20260603130000`) e **`fiscal_identity_documents`** (`20260603140000`).
- **Dois momentos** — `companies.primary_company_type_id` + `primary_concept_id` com CHECK pareado (ambos NULL = jurídico / ambos NOT NULL = operacional); `company_types`, `company_type_allowed_concepts`, `concepts` existem.
- **Acoplamento actor-first** — `product_offers.merchant_id`, `services.actor_id`, `events.actor_id` → `actors(id)`; `tenant_concept_offerings(tenant_id, concept_id)`.
- **F2-C (gate financeiro de KYB)** — `evaluateKybLayer` **existe** e é avaliada na camada de authority (lê `kyb_status='approved'`).
- **DECISION-0089 Fase 1 (reconciliação de leitura)** — leitura de company **deriva** `kybStatus`/`isKybApproved` de `fiscal_identities.kyb_status` via `LEFT JOIN`; endpoint legado `company_status='VERIFIED'` mantido só por compat.
- **DECISION-0094 (gate social de KYB)** — `modules/social/pj-kyb-gate.ts`: page-actor/PJ só **publica feed** e **vota** se `kyb_status='approved'` (`isPageActorKybApproved`).

### ⚠️ Drift / risco (verificado)
- **Segunda-verdade de status:** `companies.company_status DEFAULT 'ACTIVE'` + ghost `'APPROVED'` (comentário em migration) — empresa nasce "ACTIVE" independente de KYB. **Além disso `companies` tem DOIS campos de status (`status` e `company_status`).** É a `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH`.
- **Dinheiro com tipos divergentes entre trilhos (viola I7):** `product_offers.price NUMERIC(12,4)` vs `services.price_cents INTEGER`. Produtos usam `NUMERIC` (proibido para dinheiro) e cents só em serviços. Soma-se à `DT-COMMERCIAL-PRICE-FEDERATED-SSOT` (preço federado sem precedência).
- **`actors.actor_type` é uma união permissiva de 11 valores** (`user/page/group/channel/actor_human/actor_organizational/actor_system/person/company/system`). O CHECK aceita quase tudo → a fragmentação de vocabulário vive **aqui**, não na borda de eventos.
- **`SELECT c.*` nas leituras de company** (companies.service.ts) — viola "sem SELECT * em produção".

### ❌ Correções aos relatórios de pesquisa (evidência refuta a narrativa)
| Relatório afirmou | Evidência | Veredito |
|---|---|---|
| "F2-C / `evaluateKybLayer` AUSENTE" | `evaluateKybLayer` existe e roda na authority | **REFUTADO** (relatório de acoplamento estava defasado) |
| "Eventos validam `actor_type IN ('person','company','system')`" | `events`: `chk_events_actor_type_operational CHECK (actor_type IN ('user','page','group','channel','system'))` | **REFUTADO** — page-actor (`'page'`) passa; "empresa cria evento" funciona no vocabulário |
| "KYB não gateia nenhuma superfície de acoplamento, só dinheiro" | DECISION-0094 gateia feed/voto | **PARCIALMENTE DEFASADO** — broadcast social já é KYB-gated |
| "DECISION-0089 Fase 1 é o próximo executor (frontend)" | reconciliação de leitura já está no **backend** | **PARCIAL** — backend deriva; consumo no frontend pode seguir pendente |

### Não verificável neste snapshot (fronteira honesta)
- Texto das DECISIONs **0085–0089/0094** (meu `01_NORMATIVE` referencia só 0081–0084; pasta `02_decisions` fora do snapshot) — **materialização** confirmada em schema/código, texto não.
- **Migrations fiscais/KYB aplicadas em `unificard_dev`?** Relatório: só DB efêmera. Só `psql` confirma.
- **`business_templates` ausente** (só mapping hardcoded) e **feed/matching mockados** — afirmações de relatório, plausíveis; **confirmar** antes de planejar em cima.

---

## 8. DTs / riscos consolidados

| DT / risco | Sev | Estado | Evidência |
|---|---|---|---|
| `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` | ALTA | OPEN | `company_status DEFAULT 'ACTIVE'` + ghost `APPROVED` |
| `DT-COMMERCIAL-PRICE-FEDERATED-SSOT` (+ tipo `NUMERIC` em produto) | ALTA | OPEN | `product_offers.price NUMERIC` vs `services.price_cents` |
| `DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION` | MÉDIA | OPEN (relocalizada) | CHECK permissivo de 11 valores em `actors` |
| `businessType` (front) ≠ `businessCategory` (back) ≠ `primary_company_type` (SSOT) | MÉDIA | OPEN | `CompanyOnboardingWizard.tsx` (`businessType` submetido, sem reader canônico) |
| `businessCategory`/`serviceCategories` = metadata morta | MÉDIA | OPEN | aceitos na rota, sem consumidor downstream (relatório) |
| Gate KYB de **operação comercial** (catálogo/oferta/booking) | MÉDIA | GAP/2ª onda | F2-C cobre `financial_*`; 0094 cobre social |
| Motor de oportunidades **não acopla empresas** (user-scoped + mock) | MÉDIA | GAP | `opportunity/feed/matching` recebem `userId` (relatório — confirmar) |
| Localização não lida por matching | MÉDIA | GAP | `product_offers.location_*` existe, matching não cruza (relatório) |
| `tenant_concept_offerings` sem writer no onboarding | MÉDIA | GAP | tabela existe, lida só por lookup (relatório) |
| `business_templates` ausente | MÉDIA | GAP | mapping hardcoded (relatório — confirmar) |
| Wizard de serviços ausente (assimetria c/ `StoreOnboardingWizard`) | MÉDIA | GAP | `services` existe, sem fluxo de onboarding |
| `StoreOnboardingWizard` = wizard obrigatório (viola declaração progressiva) | BAIXA | OPEN | auditoria de frontend embutida |
| `SELECT c.*` em leituras de company | BAIXA | OPEN | companies.service.ts |

---

## 9. Decisões pendentes de Clayton (deduplicadas e atualizadas)

1. **"Produtos/serviços/ambos" como seleção de domínios N0** (projetada sobre `company_type`/`concept`, "ambos" = união) **ou** permanece `businessCategory` enum (incl. `hybrid`)? — define se "ambos" é dois trilhos ou um valor atômico.
2. **Qual vocabulário vence:** `businessType` (front), `businessCategory` (back schema), `primary_company_type_id` (SSOT)? Hoje são três; o SSOT já existe.
3. **DECISION-0075 A/B:** a Opção B (fiscal-first transacional) **já está no código** — ratificar como vencedora e fechar o freeze, ou manter aberto?
4. **`company_status` × `kyb_status`:** reconciliar/aposentar `company_status` como verdade (mantê-lo só como lifecycle projetado) — antes ou junto da próxima frente? (`DT-...SECOND-TRUTH`).
5. **Reabrir `under_review`/`needs_more_info` ("Ajustes Solicitados") e emissão de `suspended`** no writer KYB (a UX da Imagem 2 exige; foram deferidos)?
6. **Vocabulário canônico de `actor_type`:** apertar o CHECK de `actors` para o set operacional (`user/page/group/channel`[+`system`]) e migrar legado, ou manter permissivo?
7. **Dinheiro nos trilhos:** padronizar `product_offers.price` → `*_cents BIGINT` (I7) e definir precedência de preço (`DT-COMMERCIAL-PRICE-FEDERATED-SSOT`)?
8. **Documentos PJ que a UX pede:** `Inscrição Estadual` (tipo novo) + trilho **humano/LGPD** para RG/CNH do responsável (DT própria).
9. **Wizard de serviços** simétrico ao de produtos, ou serviços entram por outro caminho?
10. **`business_templates`:** materializar (template que pré-popula catálogo/agenda/papéis) ou manter classificação magra (type + allowed_concepts)?

---

## 10. Ordem de ataque recomendada (sem execução — identidade antes de comércio)

1. **Confirmar `psql`** que as migrations fiscais/KYB estão aplicadas em `unificard_dev` (fronteira de runtime local).
2. **Fechar `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH`** — `company_status` deixa de ser verdade de verificação; UX deriva de `kyb_status` (0089 já preparou a leitura no backend; falta varrer escritores residuais de `company_status='VERIFIED'/'APPROVED'`).
3. **`F-PJ-ONBOARDING-DOMAIN-SELECTION` (desenho)** — materializar "produtos/serviços/ambos" sobre N0/`company_type`/`concept`; aposentar/promover `businessCategory`; resolver `businessType`×`businessCategory`.
4. **Vocabulário `actor_type`** (apertar CHECK + migrar) — destrava confiança transversal (eventos já estão no set certo).
5. **Trilhos:** wizard de serviços + ligação availability "para quê"; padronização de preço (cents) no trilho produto.
6. **2ª onda:** gate KYB de operação comercial (catálogo/oferta/booking) e wire do page-actor no motor de oportunidades.

**Restrição:** nenhuma frente executa antes das respostas de Clayton às questões 1–4 da §9. O mapa está pronto; a sequência respeita `norma → schema → código` e `identidade antes de comércio`.

---

### Apêndice A — Base de evidência conferida
- **Schema** (`MIGRATIONS_FULL.txt`, 355 migrations): `actors` (CHECK original l.34 e CHECK atual permissivo l.2772; `company_id` l.2792); `companies` (mig. `0065`, `company_id`/`status`/`company_status` l.2869–2877; ghost `APPROVED` l.16642; par `primary_*` l.19092–19106); `concepts` l.3033; `company_types` l.6192; `company_type_allowed_concepts` l.6208; `tenant_concept_offerings` l.3114; `product_offers` mig. `0122` (`merchant_id`→actors l.6469, `price NUMERIC` l.6470); `services` l.9147 (`actor_id` l.9150, `price_cents` l.9159); `events` l.12255 (`actor_id` + `chk_events_actor_type_operational`); N0 list l.12126–12134; `fiscal_identities` mig. `20260603120000` l.20955+; `fiscal_identity_kyb_requests` `20260603130000` l.21068+; `fiscal_identity_documents` `20260603140000`.
- **Código** (`SRC_FULL.txt`): `companies.service.ts → createCompany` (withTransaction/fiscal-first/`ensurePageActorTx`); reconciliação 0089 (kybStatus/isKybApproved via join); `evaluateKybLayer` + invocação na authority; `modules/social/pj-kyb-gate.ts` (0094, feed/voto).
- **Frontend** (`frontend_src_completo.txt`): `CompanyCreationPage` (rotas `companies/new`, `empresas/nova`); `StoreOnboardingWizard` (rota `marketplace/store-onboarding`, produtos-only); `CompanyOnboardingWizard.tsx` (`businessType`); auditoria de frontend embutida.

### Apêndice B — Taxonomia N1 (verificada contra `19_N1`)

N1 = **navegação governada**, não identidade (identidade = CONCEPT). Use o **slug exato**, nunca texto livre. Os slugs estão semeados em migration (`('alimentacao','produtos-e-comercio',1)`, `('manutencao-e-reformas','servicos',1)`, ...). A coluna **fronteira** é o critério de desambiguação — é o que decide o N1 certo.

**`produtos-e-comercio` (13 N1):**

| # | slug | o que é (exemplos) | fronteira |
|---|---|---|---|
| 1 | `alimentacao` | comestíveis (perecíveis, processados) | sólido/semi-sólido (sopa = alimentação) |
| 2 | `bebidas` | líquidos p/ consumo (alcoólicas, funcionais) | líquido primário |
| 3 | `higiene-e-beleza` | uso corporal/estética (maquiagem, perfumaria) | evita "bem-estar" (≠ N0 saúde) |
| 4 | `vestuario-e-acessorios` | roupas, calçados, bolsas, joias, óculos | — |
| 5 | `casa-e-decoracao` | móveis, decoração, cama/mesa/banho, iluminação | — |
| 6 | `eletroeletronicos` | informática, telefonia, áudio, eletrodomésticos | unificado (evita "geladeira inteligente") |
| 7 | `materiais-de-construcao` | acabamento, estrutura, ferramentas, tintas | **materiais = produto**, não serviço de obra |
| 8 | `veiculos` | automóveis, motos, utilitários | possui chassis |
| 9 | `pecas-e-acessorios-automotivos` | motor, suspensão, acessórios | é componente (não tem chassis) |
| 10 | `produtos-para-animais` | alimentação, higiene, acessórios, saúde animal | evita "pet-shop" (estabelecimento) |
| 11 | `papelaria` | papéis, escritura, arte, embalagens | consumo descartável |
| 12 | `mobiliario-e-equipamentos-de-escritorio` | móveis, tecnologia/organização de escritório | ativo durável |
| 13 | `equipamentos-esportivos` | bicicletas, roupas técnicas, ginástica | critério = uso esportivo (não transporte) |

**`servicos` (10 N1):**

| # | slug | o que é (exemplos) | fronteira |
|---|---|---|---|
| 1 | `manutencao-e-reformas` | elétrica, hidráulica, pintura, consertos | **sem ART** (com ART → N0 construção condicional) |
| 2 | `servicos-domesticos` | limpeza, cuidados, cozinha, jardinagem | — |
| 3 | `consultoria-e-assessoria` | jurídica, contábil, financeira, gestão, RH | intelecto |
| 4 | `servicos-tecnicos-especializados` | eletricistas, mecânicos, TI, instalações | mão-de-obra técnica (≠ consultoria) |
| 5 | `estetica-e-cuidados-pessoais` | estética, massagem, SPA, terapias | remove "bem-estar" (≠ N0 saúde) |
| 6 | `treinamento-corporativo` | in-company, workshops, palestras (B2B) | B2B organizacional |
| 7 | `capacitacao-e-treinamentos` | cursos livres, aulas, oficinas (B2C) | **≠ educação** (N0 educação) |
| 8 | `producao-e-realizacao-de-eventos` | fotografia, buffet, decoração, som | **prestação ≠ o evento em si** (N0 cultura-lazer) |
| 9 | `servicos-de-tecnologia` | software, design digital, infra TI, suporte | — |
| 10 | `marketing-e-comunicacao` | publicidade, redes, conteúdo, SEO, PR | — |

---

### Apêndice C — Classificação por exemplo (verificada contra `18`/`19`)

Decisão de domínio começa pela pergunta da §3-Etapa 3. Casos reais:

| Negócio | N0 → N1 | Por quê |
|---|---|---|
| Loja vendendo roupa | `produtos-e-comercio` → `vestuario-e-acessorios` | bem material |
| Salão (corte/manicure) | `servicos` → `estetica-e-cuidados-pessoais` | prestação |
| Perfumaria (cosmético) | `produtos-e-comercio` → `higiene-e-beleza` | bem material |
| Pedreiro/pintor **sem ART** | `servicos` → `manutencao-e-reformas` | mão-de-obra sem ART |
| Tinta / cimento | `produtos-e-comercio` → `materiais-de-construcao` | "materiais" = produto |
| Obra com ART / estrutural | `construcao-e-infraestrutura` (**N0 condicional — não ativado**) | critério regulatório |
| Clínica médica | `saude-e-bem-estar` (N0 #10) | invariantes próprias: sigilo/CFM |
| **Ambos** (ex.: salão que vende cosmético + corta) | união de dois N1 (produto + serviço) | **nunca** um N1/`company_type` "híbrido" |

Regras de fronteira que mais geram erro: `alimentacao`×`bebidas` (estado físico) · `veiculos`×`pecas` (chassis) · `papelaria`×`mobiliario` (consumo vs durável) · `consultoria`×`servicos-tecnicos` (intelecto vs mão-de-obra) · `capacitacao`≠educação · `producao-de-eventos`≠o evento.

---

### Apêndice D — Catálogo de estudo (TIER 0–7)

*Fonte: relatório de catálogo (HEAD `bca68684`). Caminhos a confirmar no repo vivo; 18/19/N0 já confirmados neste snapshot. Legenda: 🔴 ler primeiro · 🟡 núcleo · 🟢 referência · ✅ já estudado.*

```
TIER 0 — MOLDURA NORMATIVA (governa todo o resto)
🔴 00_AGENT_PROTOCOL · CONSTITUICAO_UNIFICARD · LEIS_OPERACIONAIS · LEI_DE_COERENCIA_SISTEMICA
🔴 07_NOMENCLATURA_CANONICA · SSOT_REGISTRY_UNIFICARD
🟡 MATRIZ_FONTES_DE_VERDADE · IDENTITY_SSOT_PRECEDENCE ✅ · PROHIBITED_STRUCTURES

TIER 1 — O QUE A EMPRESA É E COMO NASCE (Etapa 1)
🔴 EMPRESA_NASCIMENTO_CANONICO · 02_ACTORS_SSOT
🟡 CORE_IDENTITY_AND_ACTORS_CONTRACT · 03_IDENTITY_CANONICA · CAPACIDADES_ACTOR_CONTRATO
🟡 ACTOR_TRACEABILITY_CONTRACT · DESENHO_PJ_C0_MAPA_SSOT_E_BLOQUEIOS

TIER 2 — CADEIA KYB PJ (espinha já construída) ✅
✅ DECISION 0075 (dois momentos/Opção B) · 0081 (M0) · 0082 (D1) · 0083 (D3)
✅ 0084/0085 (D2) · 0086 (F2-A writer) · 0087 (F2-B docs) · 0088 (F2-C gate) · 0089 (reconciliação)
   [⚠ neste snapshot existe também 0094 — gate social de KYB; confirmar no repo]
🔴 DESENHO_FASE_3B_EMPRESA_DOIS_MOMENTOS (ATIVAÇÃO/Momento 2)

TIER 3 — PERGUNTA INICIAL + CLASSIFICAÇÃO N0→N1→CONTEXT→CONCEPT (Etapas 2/3)
🔴 18_DOMAIN_ONTOLOGY · 19_N1_NAVIGATION · REGRA_CANONICA_CRIACAO_DE_CONTEXT
🟡 20_N2_NAVIGATION (+21 expansão) · 15_ACTION_CONTEXT_CANONICA · 04_CATEGORIES_SSOT

TIER 4 — TRILHOS OPERACIONAIS (Etapa 4)
🔴 [produtos] DEFINICAO_DE_PRODUTO · SEMANTIC_CATALOG_GOVERNANCE · 🟡 Marketplace_Atributos_Canonicos
🔴 [serviços] SERVICE_CANONICO · SERVICE_BOOKING_DECISION_* · 🟡 DESENHO_A2_C1_SERVICE_API · AGENDA_UNIVERSAL_CONTRACT

TIER 5 — GATES DE OPERAÇÃO (Etapa 6)
🔴 AUTHORITY_LAW · 08_AUTORIDADE_CANONICA · AUTHORITY_ENFORCEMENT_MODEL ✅(parcial)
🔴 POLITICA_ATIVACAO_ECONOMICA · 🟡 13_PERMISSIONS · 14_POLICIES

TIER 6 — UX/PRODUTO: STATUS, TELAS, ESTADO VIVO (Imagem 2)
🔴 09_STATES_CANONICA · AUDITORIA_DEFINITIVA_EMPRESAS · AUDITORIA_EMPRESAS_UNIFICARD
🟡 ARQUETIPOS_PAGINA_CANONICOS · FASE_6_1_CONTRATO_UX_ECONOMICA · FRONTEND_ARCHITECTURE_CHECKLIST

TIER 7 — FINANCEIRO/BANK ("Empresa Ativa" toca dinheiro)
🟡 BANK_DOMAIN_RULES · CORE_FINANCIAL_CONTRACT · LEDGER_SOVEREIGNTY · CORE_SPLIT_PAGAMENTO_CANONICO

CAMINHO MÍNIMO (se ler só o essencial, nesta ordem):
1. EMPRESA_NASCIMENTO_CANONICO  2. DESENHO_FASE_3B  3. DESENHO_PJ_C0_MAPA
4. cadeia DECISION 0075→0089 (✅)  5. 18_DOMAIN_ONTOLOGY + 19_N1 + REGRA_CRIACAO_DE_CONTEXT
6. SERVICE_CANONICO + DEFINICAO_DE_PRODUTO + SEMANTIC_CATALOG_GOVERNANCE
7. AUTHORITY_LAW + POLITICA_ATIVACAO_ECONOMICA  8. 09_STATES + AUDITORIA_DEFINITIVA_EMPRESAS
```

---

### Apêndice E — Checklists de configuração por trilho (Momento 2)

Perguntas que a configuração precisa responder — cada resposta vira parametrização sobre SSOT, **não** string em metadata.

**Trilho serviço — execução:** exige agenda? · exige orçamento? · tem duração? · exige deslocamento? · tem recurso/capacidade física? · é recorrente? · é por projeto? · atendimento individual ou empresa?
**Trilho serviço — infra a ativar:** availability (Agenda Universal) · catálogo de ofertas · preço ou orçamento · política de cancelamento · booking/ordem de serviço · permissões do page-actor.

**Trilho produto — catálogo:** industrializado? · próprio? · GTIN/código externo? · unidade? · variações? · preço (`*_cents`)? · estoque? · fotos? · retirada/entrega?
**Trilho produto — infra a ativar:** catálogo/store · PDV · checkout · estoque · entrega/logística · regras fiscais/KYB quando exigidas.

**Ambos — relação produto↔serviço (via GRAPH):** independentes? · complementares? · vendidos em pacote? · serviço de instalação/manutenção do produto? · produto usado na execução do serviço? Modelar a relação no GRAPH; nunca colapsar num nó híbrido.

---

*Briefing de execução autossuficiente. Não altera disco. Corpo (§0–§10) = a definição canônica e o estado vivo auditado; Apêndices A–E = evidência e referência. Materializações citadas por `file:line`/constraint; afirmações de relatório marcadas como "confirmar". O executor re-verifica no disco antes de agir e não executa o que está BLOQUEADO na §0 até a palavra de Clayton.*
