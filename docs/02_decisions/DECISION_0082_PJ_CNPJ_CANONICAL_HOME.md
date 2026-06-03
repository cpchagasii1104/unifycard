# DECISION-0082 — D1: casa/precedência canônica do CNPJ (identidade fiscal própria de PJ)

**Status:** PROMULGADA POR CLAYTON — DECISÃO DE PRECEDÊNCIA (D1, derivada da M0). **DOCS-ONLY**; implementação **NÃO** autorizada aqui (2026-06-02).
**Sessão:** 2026-06-02 — frente `F-PJ-BIRTH-AND-COMMERCIAL-SSOT-READONLY`.
**Decisor:** Clayton. **Commit âncora:** HEAD origem `1b768037`.
**Natureza:** registra a **D1** (onde o CNPJ mora canonicamente) — primeira derivada da M0. É decisão de **PRECEDÊNCIA**, NÃO de schema/tabela/UNIQUE/CHECK/FK/índice (isso é D2/desenho técnico).
**Documento canônico:** este arquivo.
**Deriva de:** `DECISION-0081` (M0 — PJ é identidade fiscal própria, não-soberana).
**Subordinada a:** `CONSTITUICAO_UNIFICARD.md`, `AUTHORITY_LAW.md`, `IDENTITY_SSOT_PRECEDENCE.md`, `SSOT_REGISTRY_UNIFICARD.md`, `07_NOMENCLATURA_CANONICA.md`, `LEIS_OPERACIONAIS_UNIFICARD.md` (Lei 5 — Bank).
**Vinculada a:** `DT-PJ-CNPJ-CANONICAL-HOME-MISSING` (endereçada por esta D1; estrutura ainda pendente), `DT-PJ-CNPJ-UNIQUE-CHECK-MISSING` (D2/desenho técnico), `DESENHO_PJ_C0_MAPA_SSOT_E_BLOQUEIOS.md`.

---

## 1. Status

PROMULGADA POR CLAYTON. DOCS-ONLY. Deriva de `DECISION-0081` (M0). Decide **precedência** (a casa do CNPJ), não estrutura técnica. Não autoriza código/schema/migration/DML.

## 2. Contexto

A M0 (`DECISION-0081`) promulgou que a Pessoa Jurídica é **identidade fiscal própria, mas não autoridade soberana**. D1 é a **primeira derivada** da M0 e responde: **onde o CNPJ mora canonicamente?** É decisão de precedência — não de nome de tabela nem de constraint.

## 3. Estado factual provado (já fechado; reusado)

- `companies.cnpj` existe (text, nullable), **sem UNIQUE, sem CHECK de 14 dígitos, sem índice, sem FK→identities**. `companies.global_user_id` → `global_users` (não identities). [`pg_constraint`; `migration 0066:29-32`]
- `identities` aceita `tax_id_type='cnpj'` (CHECK 14 díg) mas **tax_id não é UNIQUE** e **nenhum fluxo vivo grava CNPJ** ali (dead-code PJ; 0 linhas); é **pessoa-cêntrico** (`PK global_user_id`). [`pg_constraint`; COUNT; `identity.service.ts:256`]
- **A camada de identidade fiscal de PJ ainda não existe** como substrato.
- Caminho paralelo `company-canonical` quebrado (`document_number`-fantasma). [`company-canonical.service.ts:26-84`]

## 4. D1 PROMULGADA (três elementos)

**(1) Onde o CNPJ mora.** A identidade fiscal da empresa/CNPJ — **incluindo KYC, documentos, histórico, reputação e continuidade** — é **canônica em uma CAMADA PRÓPRIA de identidade fiscal de PJ**. O CNPJ é **identidade própria da empresa**, de **natureza distinta** da identidade fiscal de pessoa física.

**(2) O que `companies.cnpj` é.** `companies.cnpj` **NÃO é a fonte soberana**. É uma **PROJEÇÃO OPERACIONAL PROTEGIDA** da identidade fiscal canônica — não uma verdade solta.

**(3) Como se opera a empresa.** Toda operação, representação e controle sobre a empresa depende de **VÍNCULO AUTORIZADO com CPF/actor humano**. **NUNCA** por compartilhamento de login/senha — **cada CPF age com a própria identidade**. (Coerente com a M0: autoridade sempre fecha em CPF.)

→ Em termos das opções neutras do desenho C0 (A `companies.cnpj` / B `identities` / C ambos com precedência): **D1 escolhe o caminho C — fonte canônica própria + `companies.cnpj` como projeção protegida** — porém com a fonte canônica sendo uma **camada própria de identidade fiscal de PJ** (não `identities`, que é pessoa-cêntrico).

## 5. Razão (natureza própria / caminho C)

A empresa tem **ciclo de vida e estrutura que a pessoa física não tem**: transferência, sócios, procuradores, funcionários, **histórico que sobrevive ao dono**, CNPJ e reputação próprios. Isso é evidência de **natureza fiscal própria** → **camada própria** → `companies.cnpj` como **projeção**. Como `IDENTITY_SSOT_PRECEDENCE` é **pessoa-cêntrico** e **não acomoda PJ**, a camada de identidade fiscal de PJ é, ela mesma, **norma a materializar**: D1 promulga a **PRECEDÊNCIA**; o **COMO materializar** é desenho técnico posterior (D2).

## 6. Relação com a M0

D1 **materializa a precedência** da identidade fiscal que a M0 (`DECISION-0081`) **afirmou existir**. A M0 disse "empresa é identidade fiscal própria, não-soberana"; D1 diz "essa identidade é canônica em camada própria, `companies.cnpj` projeta, e toda operação passa por vínculo CPF". Precedência humana preservada (`AUTHORITY_LAW Art.1.4/1.5`): a identidade fiscal própria da empresa **não a torna soberana** — autoridade segue fechando em CPF.

## 7. O que D1 resolve / o que D1 NÃO decide

**Resolve:** a casa/precedência canônica do CNPJ (camada própria de PJ é fonte; `companies.cnpj` é projeção protegida; operação por vínculo CPF, nunca login compartilhado).
**NÃO decide (são derivadas/desenho técnico):**
- nome de tabela / schema / UNIQUE / CHECK 14 díg / FK / índice / escopo de unicidade (= D2 + desenho técnico);
- como revalidar permissões após venda (= D5);
- contrato/fluxo de transferência (= D5);
- biometria / gov.br / facial / prova de vida (= frente de validação forte, com LGPD);
- operador humano que analisa mudança brusca (= D6/D7 — VERBALIZADO na `DECISION-0081`, não promulgado como mecanismo);
- prazo dos 5 anos no schema (= D4);
- grafo anti-laranja (= D6);
- caução/retenção de saldo na transferência (= D4/D5 + Bank — ver §8).

## 8. Derivadas ainda PENDENTES (não promulgadas aqui)

Decorrem de D1, mas exigem promulgação própria:
- **D2** — estrutura técnica da casa do CNPJ (UNIQUE, CHECK 14 díg, FK, índice, escopo de unicidade global vs tenant).
- **D3** — vínculo/autorização/representação de CPFs sobre o CNPJ (sócio, procurador, gerente, funcionário).
- **D5** — transferência/venda formal de empresa dentro do sistema (+ revalidação de permissões pós-troca).
- **D4** — responsabilidade transitória do CPF anterior (prazo verbalizado de 5 anos; schema/eventos pendentes).
- **D6** — quarentena anti-laranja + grafo de correlação CPF↔CNPJ↔CPF.
- **D7** — risco transversal + operador humano auditável (camada que analisa mudança brusca — VERBALIZADA, a promulgar).
- **Frente de VALIDAÇÃO FORTE** — gov.br/biometria/facial/prova de vida, com LGPD/consentimento/retenção/acesso/auditoria (dado sensível; substrato de proteção próprio **antes** de coletar).

### 8.1 Diretriz VERBALIZADA por Clayton, a ESTUDAR (NÃO decidida, NÃO D1) — caução/retenção de saldo na transferência
Matéria de **D4/D5 + Bank**. Ideia: na transferência de empresa do CPF vendedor para o CPF comprador, amarrar por um período não só o saldo da **EMPRESA (CNPJ)** transferida, mas também **parte do saldo PESSOAL do CPF vendedor**, como garantia que **aumenta o custo de um golpe** (vender para laranja e sumir custa o saldo retido).
**TRAVAS OBRIGATÓRIAS (registrar junto, a respeitar quando for desenhada):**
- **(a)** Saldo pessoal só pode ser retido com **CONSENTIMENTO explícito** do vendedor (caução/garantia contratual aceita) — **NUNCA** retenção forçada unilateral (seria sequestro de patrimônio pessoal; bloqueio de dinheiro pessoal normalmente exige ordem judicial).
- **(b)** **PROPORCIONAL** e preferencialmente acionada por **SINAL DE RISCO com decisão de OPERADOR HUMANO** — **NÃO** automática em toda transferência (reter saldo de todo vendedor honesto = falso positivo financeiro, contradiz a antifraude equilibrada da `DECISION-0081` "sinaliza-e-revisa").
- **(c)** Qualquer retenção vive **DENTRO do Bank** (Lei 5: só `modules/bank` escreve no ledger). **NUNCA** um campo `saldo_retido` paralelo (= realidade paralela proibida).
**PENDÊNCIA DE VIABILIDADE:** exige prova read-only futura — "o Bank suporta hold/escrow/reserva de saldo financeiro? como? ou nasce?" — antes de qualquer decisão. É da **mesma família da D4** (responsabilidade transitória): a caução é a **versão financeira** de amarrar o vendedor ao passado.
*(Nota: esta diretriz NÃO gera DT nesta sessão — vira DT própria só quando D4/D5 forem desenhadas.)*

**Ordem de dependência:** D1 (feita) → D2/D3 → D5 → D4/D6/D7 → validação forte → desenho técnico → migration.

## 9. Fronteiras (vinculante)

```text
NÃO tocar CPF F5 (user_profiles.cpf / profiles.cpf).
NÃO tocar Bank / ledger.
NÃO tocar preço.
NÃO tocar marketplace executável.
NÃO tocar agenda / recurso físico.
NÃO alterar backend/src, frontend/src, schema, migrations.
NÃO promulgar D2–D7. NÃO decidir nome de tabela/UNIQUE/CHECK/FK. NÃO implementar.
```

## 10. Ordem futura

```text
1. Consolidação Opus/ChatGPT desta D1.
2. Promulgação das demais derivadas (D3 próxima na ordem; depois D5; depois D4/D6/D7; validação forte).
3. docs-only: DECISION(s) das derivadas + atualização das DTs.
4. Desenho técnico da migration única (após todas as derivadas de precedência).
5. Migration única e coerente das peças acopladas.
6. Código (createCompany transacional Opção B + writers + gates).
7. Gates.
```

## 11. Superada por

(em aberto — decisão vigente)
