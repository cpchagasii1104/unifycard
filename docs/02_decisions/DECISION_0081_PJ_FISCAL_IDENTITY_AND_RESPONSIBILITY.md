# DECISION-0081 — Pessoa Jurídica: identidade fiscal própria, não-soberana (M0) + responsabilidade e proteção antifraude

**Status:** PROMULGADA POR CLAYTON — DECISÃO DE NATUREZA/ARQUITETURA (M0). **DOCS-ONLY**; implementação **NÃO** autorizada aqui (2026-06-02).
**Sessão:** 2026-06-02 — frente `F-PJ-BIRTH-AND-COMMERCIAL-SSOT-READONLY` (pós prova read-only de CNPJ + desenho fechado das 7 peças).
**Decisor:** Clayton (M0 e diretrizes verbalizadas). **Commit âncora:** HEAD origem `f7d15a8a`.
**Natureza:** registra a **decisão-mãe (M0)** sobre a natureza da PJ + diretrizes derivadas verbalizadas. **NÃO** implementa derivadas, schema, constraints, fluxo de transferência, motor de quarentena, KYC nem detecção de fraude.
**Documento canônico:** este arquivo.
**Subordinada a:** `CONSTITUICAO_UNIFICARD.md`, `LEIS_OPERACIONAIS_UNIFICARD.md`, `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md`, `AUTHORITY_LAW.md`, `IDENTITY_SSOT_PRECEDENCE.md`, `SSOT_REGISTRY_UNIFICARD.md`, `07_NOMENCLATURA_CANONICA.md`, `CORE_IMUTAVEL.md`.
**Vinculada a:** `DECISION-0075` (freeze/Opção B do nascimento PJ), `DESENHO_PJ_C0_MAPA_SSOT_E_BLOQUEIOS.md`; DTs registradas nesta frente (ver §5/§DTs): `DT-PJ-CNPJ-CANONICAL-HOME-MISSING`, `DT-PJ-CNPJ-UNIQUE-CHECK-MISSING`, `DT-PJ-KYC-DOCUMENTS-SUBSTRATE-MISSING`, `DT-PJ-TRANSFER-OWNERSHIP-MISSING`, `DT-PJ-TRANSITIONAL-RESPONSIBILITY-MISSING`, `DT-PJ-ANTI-LARANJA-CORRELATION-MISSING`, `DT-PJ-TRANSVERSAL-RISK-SIGNALS-MISSING`, `DT-RISK-HUMAN-OPERATIONS-SUBSTRATE-MISSING`, `DT-RISK-FALSE-POSITIVE-SAFEGUARD-MISSING`, `DT-COMPANY-CANONICAL-SERVICE-SCHEMA-DRIFT` (pré-existente).

---

## 1. Status

PROMULGADA POR CLAYTON. DOCS-ONLY. Não autoriza código, schema, migration ou DML. Registra a M0 (decisão-mãe) e prepara o terreno documental; as derivadas exigem desenho técnico e/ou promulgação própria posterior.

## 2. Contexto

A frente `F-PJ-BIRTH-AND-COMMERCIAL-SSOT-READONLY` provou (schema vivo + migrations + código) que o CNPJ é persistido mas órfão de garantias canônicas de KYC/autoridade, e que a "casa canônica" do CNPJ depende de uma decisão **anterior ao schema**: a natureza da Pessoa Jurídica no Unificard. Clayton promulgou essa decisão-mãe (M0). Este documento a registra, separada das derivadas, sem implementar nada.

## 3. Estado factual provado (tri-confirmado: schema vivo + migrations + código)

- `companies.cnpj` existe (text, nullable), mas **sem UNIQUE, sem CHECK de 14 dígitos, sem índice, sem FK** para `identities`. [`information_schema`/`pg_constraint`/`pg_indexes`; `migration 0066:29-32`]
- `companies.global_user_id` → `global_users` (não `identities`). [`pg_constraint`]
- `identities` **aceita** `tax_id_type='cnpj'` com CHECK de 14 dígitos, mas **tax_id não é UNIQUE** e **nenhum fluxo vivo grava CNPJ** ali (dead-code para PJ; 0 linhas). [`pg_constraint`; COUNT; `identity.service.ts:256` só CPF]
- `createCompany` valida só **formato 14 dígitos** (não dígito verificador) e checa duplicidade só por `(tenant_id, global_user_id, cnpj)` → schema **permite o mesmo CNPJ em empresas distintas por CPFs distintos**. [`companies.service.ts:266-292`]
- Caminho paralelo `company-canonical` **quebrado** (usa `document_number`/`legal_name` inexistentes no schema vivo). [`company-canonical.service.ts:26-84`]
- **Substrato vivo existente:** `company_validation_requests` (submit→review→decisão), `actor_delegations` (representação temporal/revogável), `atl_blocked_actors` (quarentena por actor), `economic_identities` (trust_score por actor/tenant). [`information_schema.columns`]
- **Substrato AUSENTE:** `actor_relationships`, `risk_signals`, transferência/venda, responsabilidade transitória de 5 anos, e substrato de operação humana de risco. [`to_regclass`=NULL]
- DEV zerado: 0 companies / 0 cnpj / 0 identities-cnpj / 0 page-actors (registro é sobre schema/código, não dado).

## 4. M0 PROMULGADA (decisão-mãe — separada das derivadas)

> **Pessoa Jurídica/empresa no Unificard é identidade fiscal própria, mas não autoridade soberana.**

Significado:
- A empresa tem **identidade fiscal própria**; o **CNPJ é a identidade fiscal da empresa**.
- A empresa pode ter **KYC, documentos, status de validação, histórico, reputação e continuidade próprios**.
- A empresa pode **sobreviver à troca de responsável/dono**.
- **Venda/transferência não apaga o histórico** da empresa.
- O **histórico pertence à empresa/CNPJ**, não ao CPF que a controlava naquele momento.
- Mas a empresa **nunca age sozinha como autoridade soberana**.
- Toda ação da empresa **fecha em CPF/actor humano responsável**.
- Toda decisão, controle, responsabilidade e consequência é **rastreável a CPF**.
- **CNPJ nunca substitui CPF** como raiz de responsabilidade humana.
- **CPF continua a âncora civil, histórica e antifraude.**

Alinhamento normativo: `AUTHORITY_LAW Art.1.4` (persona/CNPJ nunca soberana), `Art.1.5/Art.2` (CPF raiz única, irrenunciável), `IDENTITY_SSOT_PRECEDENCE` (fiscal/KYC vive em identities — hoje pessoa-cêntrico; ver §6 lacuna), `LEI_DE_COERENCIA §4.8.2/§4.8.3` (responsible_actor_id), `CONSTITUIÇÃO Art.I` ("empresas coordenam; pessoas decidem"), `07_NOMENCLATURA §3.1` (actor_organizational nunca soberano).

A M0 **não inclui**: prazo específico de responsabilidade, schema, tabelas, constraints, fluxo técnico de transferência, motor de quarentena, implementação de KYC, mecânica de detecção de fraude (são derivados — §5).

## 5. Diretrizes derivadas já verbalizadas por Clayton (exigem desenho técnico/promulgação própria — NÃO implementadas, NÃO schema)

### 5.1 Nascimento e validação
- Page-actor nasce no início do fluxo, mas **pendente/não operacional** até validação manual (DECISION-0075 Opção B).
- Full-birth futuro deve ser **transacional e causalmente fechado** (sem cleanup compensatório frágil).
- Documentos PJ enviados na criação e **analisados manualmente**.
- Operador interno pode **aprovar / pedir complemento / rejeitar**.
- Gerente/procurador pode **representar** se houver documento registrado / autorização formal.

### 5.2 Transferência e responsabilidade
- Venda/transferência de empresa exige **processo formal**.
- O CPF anterior permanece vinculado por **responsabilidade transitória**.
- Clayton verbalizou **prazo inicial de 5 anos**, mas schema/eventos e promulgação derivada específica **ainda dependem de desenho**.

### 5.3 Proteção antifraude equilibrada (diretriz verbalizada; pendente de desenho técnico)
**Princípio-raiz:** o sistema deve se proteger contra fraude e laranjas **sem se tornar inoperante nem barrar inocentes por métrica automática**. Os dois erros são inaceitáveis: ser ingênuo (deixar o golpe operar) e ser cego (punir o legítimo por correlação estatística). **O equilíbrio é a diretriz, não um dos extremos.**

Subdiretrizes:
- O sistema **detecta, correlaciona e sinaliza** padrões de risco.
- O sistema **não decide sozinho** quarentenar/bloquear pessoa real por métrica automática.
- **Sinal de risco é insumo para decisão humana, não sentença automática.**
- Decisão de quarentenar/bloquear pessoa ou empresa real **passa por revisão humana** por equipe própria do sistema.
- Existem **funções de operação humana** (funcionários/equipes) que verificam, validam, auditam e decidem sobre risco, aprovação de PJ e quarentena.
- Essas equipes podem precisar **consultar fontes externas** para decidir.
- O **operador humano é, ele mesmo, um actor com autoridade definida, limitada e auditável**.
- Toda decisão de operador deixa **trilha rastreável**: quem decidiu, quando, com base em quê, qual consequência.
- A autoridade do operador também **fecha em CPF/actor humano**.
- O **alvo da proteção é o ecossistema interno do Unificard**: impedir que o sistema seja veículo do golpe.
- O Unificard **não substitui** Receita, polícia ou Judiciário; protege o que passa pelo Unificard.
- Correlação anti-laranja (grafo CPF↔CNPJ↔CPF) é **detecção/sinal** e fica sujeita à **revisão humana antes de consequência** sobre pessoa real.
- **Falso positivo é dano.** A arquitetura deve **preferir sinalizar-e-revisar a bloquear-automático**.

### 5.4 Outras diretrizes verbalizadas
- CPF problemático **pode ser impedido** de abrir novas empresas até regularização, **mediante decisão humana revisável**, não bloqueio puramente automático.
- Risco deve ser **transversal** entre módulos.
- **Produtos e serviços seguem trilhos diferentes.**
- **PF regional fund e PJ regional fund** precisam ser **verificados em norma/código, não assumidos**.

## 6. Decisões derivadas ainda PENDENTES (não decidir aqui)

- **(LACUNA NORMATIVA)** Precedência de identidade fiscal de PJ: `IDENTITY_SSOT_PRECEDENCE.md` existe mas é **pessoa-cêntrico** (`global_user_id`); não normatiza onde a identidade fiscal/KYC da EMPRESA mora. Com a M0 (empresa = identidade fiscal própria), resta promulgar **como** essa identidade-PJ se materializa.
- D1. Casa canônica do CNPJ (A `companies.cnpj` / B `identities` / C ambos com precedência) — agora condicionada pela M0.
- D2. Escopo de unicidade do CNPJ (global vs por-tenant) + nível de validação (formato/dígito verificador).
- D3. Schema de documentos PJ + fluxo de aprovação manual.
- D4. Responsabilidade transitória (prazo verbalizado 5 anos) — modelo temporal/append-only.
- D5. Processo formal de transferência/venda (evento + aprovação + disparo da D4).
- D6. Correlação anti-laranja (grafo CPF↔CNPJ) + gate de criação revisável para CPF em quarentena.
- D7. Materialização do risco transversal (sinais + revisão humana) + confirmação PF/PJ regional fund.

## 7. Consequências diretas da M0

- O **CNPJ deixa de ser um atributo solto** e passa a ser **identidade fiscal da empresa** — o que exige (futuramente) casa canônica, unicidade e KYC próprios.
- A **empresa ganha continuidade própria**: histórico/reputação/risco pertencem ao CNPJ, sobrevivem à troca de dono.
- **Toda autoridade da empresa permanece ancorada em CPF** — inclusive a do operador humano de risco.
- Habilita conceitualmente **transferência sem apagar histórico** e **responsabilidade transitória** do CPF anterior.
- Fixa o **princípio de proteção equilibrada**: sinalizar-e-revisar, não bloquear-automático.

## 8. O que a M0 RESOLVE

- A pergunta-raiz "empresa é identidade própria ou entidade ancorada a CPF?" → **identidade fiscal própria, não-soberana**.
- Desbloqueia o desenho coerente das 7 peças a partir de uma raiz única (em vez de 7 decisões paralelas).
- Estabelece a precedência humana (CPF raiz) e o princípio antifraude equilibrado como invariantes do desenho futuro.

## 9. O que a M0 NÃO implementa

- Não define schema, tabelas, constraints, UNIQUE, CHECK, FK.
- Não cria casa canônica do CNPJ nem KYC de PJ.
- Não cria transferência, responsabilidade transitória, quarentena, grafo anti-laranja, risk_signals, nem substrato de operação humana de risco.
- Não toca código/runtime. Não escolhe D1–D7.

## 10. Diretriz para futura migration

Quando as derivadas forem promulgadas: **uma migration ÚNICA e coerente** das peças acopladas (casa do CNPJ + unicidade + documentos + transferência + responsabilidade transitória + correlação + risco transversal), **não fatias isoladas** ("só UNIQUE", "só vínculo"). Migration só **após** promulgação da norma de identidade-PJ (norma antes de schema) e do desenho técnico das derivadas.

## 11. Fronteiras (vinculante)

```text
NÃO tocar CPF F5 (user_profiles.cpf / profiles.cpf).
NÃO tocar Bank / ledger.
NÃO tocar preço.
NÃO tocar marketplace executável.
NÃO tocar agenda / recurso físico.
NÃO alterar backend/src, frontend/src, schema, migrations.
NÃO implementar derivadas. NÃO escolher D1–D7.
```

## 12. Ordem futura

```text
1. Consolidação Opus/ChatGPT deste registro.
2. Promulgação das derivadas (D1–D7) por Clayton — NORMA antes de SCHEMA (identidade-PJ primeiro).
3. docs-only: DECISION(s) das derivadas + atualização das DTs.
4. Desenho técnico da migration única.
5. Migration única e coerente das 7 peças.
6. Código (createCompany transacional Opção B + writers + gates de operação humana/risco).
7. Gates.
```

## 13. Superada por

(em aberto — decisão vigente)
