# DECISION-0084 — D2: casa fiscal canônica da Pessoa Jurídica (princípio)

**Status:** PROMULGADA POR CLAYTON — DECISÃO DE PRINCÍPIO (D2, derivada da M0/D1). **DOCS-ONLY**; implementação/desenho técnico **NÃO** autorizados aqui (2026-06-03).
**Sessão:** 2026-06-03 — frente `F-PJ-BIRTH-AND-COMMERCIAL-SSOT-READONLY` (pós read-only D2).
**Decisor:** Clayton. **Commit âncora:** HEAD origem `d3de4785`.
**Natureza:** promulga o **princípio** — a PJ terá **casa fiscal própria, canônica e global**. **NÃO** batiza tabela, **NÃO** fixa colunas/constraints/FK/índices, **NÃO** escolhe nome canônico, **NÃO** implementa writer, **NÃO** cria migration.
**Documento canônico:** este arquivo.
**Deriva de:** `DECISION-0081` (M0 — PJ é identidade fiscal própria, não-soberana), `DECISION-0082` (D1 — CNPJ mora em camada própria; companies.cnpj é projeção). **Prepara:** D3-técnica (vínculos) e D5 (transferência).
**Subordinada a:** `CONSTITUICAO_UNIFICARD.md`, `AUTHORITY_LAW.md`, `IDENTITY_SSOT_PRECEDENCE.md`, `SSOT_REGISTRY_UNIFICARD.md`, `07_NOMENCLATURA_CANONICA.md`, `LEIS_OPERACIONAIS_UNIFICARD.md`.
**Vinculada a:** `DT-PJ-CNPJ-CANONICAL-HOME-MISSING`, `DT-PJ-CNPJ-UNIQUE-CHECK-MISSING`, `DT-PJ-KYC-DOCUMENTS-SUBSTRATE-MISSING` (todas da 0081; atualizadas/referenciadas), `DT-PJ-IDENTITY-PRECEDENCE-NORM-GAP` (nova).

---

## 1. Status

PROMULGADA POR CLAYTON. DOCS-ONLY. Deriva de `DECISION-0081` (M0) e `DECISION-0082` (D1); prepara D3-técnica e D5. Registra **princípio**; desenho técnico (nome/colunas/constraints/FK/writer/migration) é etapa posterior.

## 2. Contexto

A D2 é a **ponte norma→schema** da camada de identidade fiscal de PJ que a D1 promulgou. O **read-only D2** (mesma sessão) levantou a evidência viva que fundamenta esta promulgação (ver §3). Esta DECISION registra o **princípio**; o desenho técnico respeita o schema vivo e a nomenclatura canônica.

## 3. Fundamento de disco (resumo do read-only D2, HEAD `d3de4785`)

- `identities` é **pessoa-cêntrica**: PK `global_user_id` (pessoa), tabela **global (sem tenant_id)**, KYC de pessoa; aceita cnpj no CHECK mas **0 linhas cnpj, sem writer** (dead-code PJ); **tax_id NÃO é UNIQUE**. → não comporta PJ sem misturar PF+PJ.
- `companies.cnpj` é text **nullable, sem UNIQUE/CHECK/índice/FK** (re-confirmado) → permite CNPJ duplicado; confirma papel de **projeção** (a proteger).
- **Nenhum substrato fiscal PJ vivo** (`legal_entities`/`company_identities`/`fiscal_identities`/`tax_identities`/`pj_identities`/`company_documents` = inexistentes). `economic_identities` = trust por (tenant,actor), **não** é fiscal. A tentativa anterior `company-canonical` (+ archive `0043`) está **quebrada** (colunas-fantasma `legal_name`/`document_number`).
- **Precedente de unicidade GLOBAL de tax-id existe e é exercido:** `global_users.cpf` é **UNIQUE global** em tabela global sem tenant. → CNPJ único global é **tecnicamente viável**.
- `IDENTITY_SSOT_PRECEDENCE.md` **existe**, mas é **silencioso sobre PJ** (estabelece precedência de PESSOA: identities > actors > economic_identities). → lacuna de norma de precedência de PJ (ver `DT-PJ-IDENTITY-PRECEDENCE-NORM-GAP`).

## 4. D2 PROMULGADA (literal — aprovada por Clayton)

> A empresa dentro do Unificard tem uma identidade fiscal própria, separada da pessoa física. O CNPJ é a verdade dessa identidade e deve ser único no sistema.
>
> Essa identidade não nasce nem morre quando muda o responsável. Se a empresa for vendida ou transferida, o que muda são os vínculos humanos: quem responde, quem opera, quem representa. A empresa continua sendo a mesma, com o mesmo CNPJ, histórico, documentos, validações, reputação e responsabilidades acumuladas.
>
> O `companies.cnpj` não é a fonte da verdade. Ele é apenas uma projeção operacional da identidade fiscal da empresa. Se houver conflito entre a identidade fiscal PJ e qualquer reflexo em `companies`, vence a identidade fiscal PJ.
>
> Essa identidade fiscal própria não transforma a empresa em autoridade soberana. Toda ação, decisão, operação ou consequência continua fechando em CPF/actor humano responsável, com vínculo formal, auditável e rastreável.
>
> A D2 decide o princípio: a PJ terá uma casa fiscal própria, canônica e global. O nome exato da tabela, constraints, FKs, writer e migration ficam para o desenho técnico posterior, respeitando o schema vivo e a nomenclatura canônica.

## 5. As decisões que a D2 carrega (princípios — D2.1–D2.8)

- **D2.1 — CASA PRÓPRIA:** identidade fiscal PJ é **camada própria**, separada de `identities` (pessoa-cêntrica). Adaptar `identities` contraria a D1.
- **D2.2 — GLOBAL E CANÔNICA:** casa fiscal PJ é **canônica** (fonte da verdade do CNPJ) e **global** (precedente `global_users.cpf` UNIQUE global).
- **D2.3 — CNPJ ÚNICO NO SISTEMA:** CNPJ **único (global)** — impede duas empresas para o mesmo CNPJ **na fonte**.
- **D2.4 — `companies.cnpj` É PROJEÇÃO:** `companies` referencia/projeta a identidade fiscal PJ; `companies.cnpj` é **reflexo operacional sincronizado e SUBORDINADO**, nunca fonte.
- **D2.5 — KYC/DOCUMENTOS/HISTÓRICO na identidade fiscal PJ:** KYC, documentos, validações, histórico, reputação e continuidade pertencem à **identidade fiscal PJ** (sobrevivem à troca de responsável), não a `companies` (projeção) nem ao actor (responsável mutável).
- **D2.6 — CONTINUIDADE NA TRANSFERÊNCIA (porta para a D5):** transferência/venda **não** cria nova identidade fiscal, **não** apaga histórico, **não** troca a verdade do CNPJ; altera os **vínculos humanos** (quem responde/opera/representa) por processo formal auditável. A identidade fiscal PJ é a **âncora estável** a que a D5 aponta.
- **D2.7 — PRECEDÊNCIA:** identidade fiscal PJ canônica **VENCE** `companies.cnpj` e qualquer reflexo operacional. `IDENTITY_SSOT_PRECEDENCE` é silencioso sobre PJ; a D2 promulga: **identidade fiscal PJ > projeção `companies.cnpj`**. `identities` permanece a precedência fiscal da PESSOA física, **NÃO** da PJ — não competem; naturezas distintas em casas distintas.
- **D2.8 — NÃO SOBERANIA:** identidade fiscal própria **não** torna a empresa autoridade soberana; toda ação/decisão/operação/consequência fecha em **CPF/actor humano responsável** (coerente com M0 e D3).

## 6. O que a D2 NÃO decide (desenho técnico e derivadas — pendentes)

- **NOME EXATO da camada:** NÃO decidido. Candidatos do read-only (apenas candidatos): `fiscal_identities` / `tax_identities` (alinham com `tax_id`/"identidade fiscal"); `organizational_identities` (alinha com `actor_organizational`). **Evitar:** `company_identities`, `legal_entities`, `pj_identities`. **Proibido:** reusar `identities`; reviver `legal_name`/`document_number` do company-canonical quebrado. Nome = desenho técnico.
- **COLUNAS/CONSTRAINTS/FK/ÍNDICES:** NÃO decididos. A considerar no desenho (não promulgados como schema): CHECK 14 dígitos; validação de dígito verificador na borda; UNIQUE (global); FK `companies`→camada; NOT NULL na fase aprovada / nullable no nascimento pendente; timestamps; status/lifecycle; auditoria; histórico append-only / proibição de apagar.
- **WRITER:** NÃO implementado. A considerar: novo serviço fiscal PJ auditado (padrão `identity-validation`), relação com full-birth (`DECISION-0075` Opção B) e page-actor pendente.
- **ESTRATÉGIA DE DOCUMENTOS PJ:** SSOT de documento próprio (**não** blob/metadata) — a desenhar (`DT-PJ-KYC-DOCUMENTS-SUBSTRATE-MISSING`).
- **DERIVADAS POSTERIORES:** D3-técnica (vínculos, ancorados na identidade fiscal PJ desta D2, **não** na projeção); D5 (transferência/venda + responsabilidade transitória); **D4** = responsabilidade transitória do CPF anterior — a **caução/hold de saldo** é diretriz financeira a estudar **dentro de D4/D5** (consentimento, proporcionalidade, revisão humana, prova futura no Bank; a caução **não é** a própria D4); D6 (anti-laranja); D7 (risco transversal/operador); validação forte LGPD-first (gov.br/biometria); migration única; código; gates.

## 7. Fronteiras (vinculante)

```text
NÃO tocar CPF / identities PF (precedência de pessoa permanece intacta).
NÃO tocar Bank / ledger.
NÃO tocar preço.
NÃO tocar marketplace executável.
NÃO tocar agenda / recurso físico.
NÃO tocar biometria / validação forte.
NÃO tocar mock de pagamento.
NÃO alterar backend/src, frontend/src, schema, migrations.
NÃO batiza tabela, NÃO fixa colunas/constraints/FK, NÃO implementa writer. NÃO implementa PJ.
```

## 8. Ordem futura

```text
1. Consolidação Opus/ChatGPT desta D2.
2. DESENHO TÉCNICO DA D2 (nome canônico + colunas/constraints/FK + writer da casa fiscal PJ) — promulgação própria.
3. D3-técnica (vínculos, ancorados na identidade fiscal PJ da D2 — identidade antes de autoridade).
4. D5 (transferência) → D4 (responsabilidade transitória/caução) → D6 (anti-laranja) → D7 (risco transversal).
5. Validação forte LGPD-first.
6. Migration única e coerente → código → gates.
```
**Invariante de ordem:** a **D3-técnica NÃO precede a D2 técnica** — os vínculos ancoram na identidade fiscal PJ (âncora estável), não na projeção `companies`.

## 9. Superada por

(em aberto — decisão vigente)
