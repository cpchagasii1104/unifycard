# RFC / DECISION PACK (CANDIDATO — NÃO PROMULGADO) — Autoridade de LEITURA financeira, contábil, fiscal e regional

**Status:** 📋 CANDIDATO · **docs-only** · **NÃO PROMULGADO** · aguarda decisão soberana do titular (Clayton).
**Origem:** Fatia G / §11 da campanha de contenção+convergência (2026-07-18). Preparado pela guardiã como INSUMO.
**Natureza:** este documento **não** promulga decisão, **não** cria endpoint protegido, **não** monta rota. Ele enumera as decisões de autoridade de LEITURA que precisam ser tomadas ANTES do frontend contábil/fiscal, com uma recomendação por decisão para o titular ratificar, ajustar ou rejeitar.
**Subordinado a:** `AUTHORITY_LAW.md`, `AUTHORITY_ENFORCEMENT_MODEL.md`, `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` §4.6–4.9, `SSOT_EXCLUSIVE_BANK_RULE.md`, `DECISION-0113` (actionContext.actorId = hint; autoridade = binding com o principal), `DECISION-0114` (Fundo Regional é da plataforma), `DECISION-0166` (Lei do Contador — fiscal é provisão, não apuração oficial), `DECISION-0177/0020` (localização soberana).

---

## 0. Princípios que atravessam TODAS as decisões (não negociáveis)

1. **Quem lê é o Actor, provado server-side.** Nenhuma leitura sensível confia em `actionContext.actorId`/header/body/query. A autoridade exige `actorId ∈ canActAs(req.user)` — ownership OU delegação — via `authorizationService.canRepresentActor`/`canActAs` ou gate equivalente (`canManageCompany`). (DECISION-0113 D5.)
2. **Ausência de autoridade ≠ erro técnico.** Sem autoridade → resposta neutra/negada conforme contrato (o recurso "não existe para você"), NUNCA vazando existência. Falha de infraestrutura → **5xx observável**, jamais `false`/vazio/página neutra (invariante "falha deve falhar").
3. **Verdade financeira é uma só: o Bank (`bank_ledger`).** Contábil e fiscal são **projeções/estimativas** sobre o Bank, nunca um segundo ledger. Fiscal provisionado é **estimativa interna** (`fiscal_config_missing` quando não há config), **nunca tributo oficial**.
4. **PII e segregação por tenant + actor.** Todo read é tenant-scoped (RLS FORCE onde aplicável) e não cruza actor sem representação provada. Logs/evidências nunca expõem PII/segredos.
5. **Leitura não cria estado.** Nenhum `ensure/create` em read path (sem criar actor/wallet/conta/residência/grant no GET).

**Modelo de authority reutilizado (não inventar novo):**
`req.user (principal autenticado)` → `canRepresentActor(tenant, user, actorId)` (pessoa/ownership/delegação) · `canManageCompany` / `company_users` (empresa) · `tenant_operator_grants` / capability tenant (plataforma) · `actor_capability_grants scope_type='regional_treasury'` (governança regional — hoje DORMENTE).

---

## 1. Matriz-resumo (sujeito × recurso × prova de autoridade)

| # | Recurso (leitura) | Sujeito legítimo | Prova de autoridade (server-side) | Sem autoridade | Falha técnica |
|--:|-------------------|------------------|-----------------------------------|----------------|---------------|
| D-1 | Saldo pessoal (`/bank/balance` de um actor) | o próprio actor / representante | `canRepresentActor(user, actorId)` | 403/neutro (não revela saldo) | 5xx |
| D-2 | Extrato pessoal (`/bank/statement`) | idem D-1 | `canRepresentActor` | 403/neutro | 5xx |
| D-3 | Saldo/extrato de EMPRESA representada | membro com capability financeira | `canManageCompany` / `company_users.can_*` | 403/neutro | 5xx |
| D-4 | Projeções CONTÁBEIS (sobre o Bank) | mesmo sujeito do saldo subjacente | mesma prova do recurso-fonte (D-1/D-3) | 403/neutro | 5xx |
| D-5 | Provisões fiscais (estimativa) | o contribuinte-actor / representante fiscal | `canRepresentActor` + (futuro) capability fiscal | 403/neutro | 5xx |
| D-6 | Reservas fiscais (`fiscal_reserve` — 4E, dormente) | plataforma/contribuinte conforme titularidade | capability fiscal governada (a definir) | 403/neutro | 5xx |
| D-7 | Transparência PÚBLICA do Fundo Regional | residente da cidade (agregado) | residência actor-scoped (cidade) — agregado, sem PII | estado territorial honesto | 5xx |
| D-8 | Administração do Fundo Regional | detentor de grant regional_treasury | `actor_capability_grants regional_treasury` (DORMENTE) | 403/neutro | 5xx |
| D-9 | Auditoria / plataforma (cross-tenant) | Risk/Platform Authority | capability de plataforma explícita | 403/neutro | 5xx |
| D-10 | Exportação / retenção (LGPD) | titular do dado / base legal | ownership + base legal registrada | 403 | 5xx |
| D-11 | PII / segregação tenant×actor | — (transversal) | RLS FORCE + tenant scope + representação | 403/neutro | 5xx |

---

## 2. Decisões detalhadas

Para cada decisão: **sujeito · recurso · ação · prova de authority · escopo · resposta sem autoridade · resposta em falha técnica · dados visíveis · dados proibidos · opção recomendada · alternativas/consequências.**

### D-1 — Saldo pessoal
- **Sujeito:** o actor dono da conta, ou quem o representa (delegação ativa).
- **Recurso/ação:** GET saldo do actor (`bank_ledger` via serviço do Bank).
- **Prova de authority:** `canRepresentActor(tenant, req.user, actorId)` = true. Posse do `actorId` na URL/header NÃO basta.
- **Escopo:** tenant do principal; um actor por vez.
- **Sem autoridade:** 403 (ou 200 neutro que não revela existência/valor) — nunca o saldo de outro actor.
- **Falha técnica:** 5xx observável (nunca saldo 0 falso).
- **Dados visíveis:** saldo em `*_cents`, moeda. **Proibidos:** dados de outro actor, PII de terceiros, CPF/tax_id.
- **Recomendada:** **Opção A** — binding obrigatório `canRepresentActor`; multi-actor legítimo (pessoa operando página/empresa que administra) permitido por delegação/ownership. (Consistente com o que `/bank/balance` já faz via `actorCapabilitiesService.resolveForUser`.)
- **Alternativas:** (B) restringir ao actor-humano-próprio (quebra multi-actor legítimo — rejeitada); (C) confiar no actionContext (spoofável — proibido por DECISION-0113).

### D-2 — Extrato pessoal
- Igual a D-1 aplicado a `/bank/statement`. **Recomendada:** mesma prova `canRepresentActor`. Paginação sem vazar contrapartes com PII (mascarar identidade de terceiros no extrato).

### D-3 — Saldo/extrato de empresa representada
- **Sujeito:** membro da empresa com capability financeira (não qualquer membro).
- **Prova:** `canManageCompany` OU `company_users` com `can_view_financials`/equivalente (capability fina, não papel textual). Autoridade nasce da membership provada + capability, nunca de role string (AUTHORITY_LAW art. 17).
- **Recomendada:** **Opção A** — exigir capability financeira específica em `company_users` (separar "gerir empresa" de "ver finanças"); default: apenas owner/finance veem finanças.
- **Consequência:** exige que o vocabulário de capabilities de `company_users` tenha uma chave financeira de leitura; se não existir, decisão dependente = criar essa capability (frente própria).

### D-4 — Projeções contábeis
- **Sujeito/prova:** herda do recurso-fonte (pessoal D-1 ou empresa D-3). Contábil é **projeção sobre o Bank**, sem segundo ledger (SSOT_EXCLUSIVE_BANK_RULE).
- **Dados visíveis:** agregações/relatórios derivados do `bank_ledger`. **Proibidos:** qualquer valor que não derive do Bank; acumulador paralelo.
- **Recomendada:** read-models contábeis são **derivados** e carregam a MESMA autoridade do saldo subjacente; nunca autoridade própria.

### D-5 — Provisões fiscais (estimativa)
- **Sujeito:** o contribuinte-actor e seu representante fiscal (contador/representante com capability fiscal).
- **Prova:** `canRepresentActor` + (recomendado) capability fiscal explícita quando for representação por terceiro (contador).
- **Dados visíveis:** **"reserva fiscal estimada"** e provisões, SEMPRE rotuladas como estimativa interna. **Proibidos:** apresentar como "imposto oficial devido" / NF-e / apuração da Receita (DECISION-0166 D9).
- **Recomendada:** **Opção A** — leitura fiscal exige representação; UI obrigada a rotular "estimativa, não substitui contador".

### D-6 — Reservas fiscais (FISCAL-4E, dormente)
- **Sujeito/titularidade:** a reserva `fiscal_reserve` é conta system (DECISION-0183); sua leitura administrativa é da plataforma; a projeção "quanto foi reservado sobre minha comissão" pertence ao contribuinte.
- **Prova:** capability fiscal governada (**a definir** — não existe hoje). Enquanto 4E está dormente, **não abrir leitura** que sugira valor real.
- **Recomendada:** **HOLD** até 4E ativar; expor no máximo "estimativa" derivada do evento fiscal, com a mesma prova de D-5.

### D-7 — Transparência pública do Fundo Regional
- **Sujeito:** residente da cidade (base territorial actor-scoped — a mesma da Fatia D/D3).
- **Prova:** residência canônica resolvida (`resolveActorTerritory(ACTOR_RESIDENCE)` → cidade). É transparência AGREGADA (saldo/movimentos do fundo da cidade), sem PII de indivíduos.
- **Dados visíveis:** saldo do fundo (do `bank_ledger`), entradas/saídas agregadas, cidade. **Proibidos:** identidade/valor de contribuintes individuais, listas de moradores (Constituição art. VIII/X — expor concentração, não indivíduos).
- **Sem residência:** estado territorial honesto (residence_missing etc. — já entregue na Fatia D), não erro.
- **Recomendada:** **Opção A** — transparência agregada por cidade, gated por residência canônica; nunca desce ao indivíduo.

### D-8 — Administração do Fundo Regional
- **Sujeito:** detentor de grant `regional_treasury` (`treasury:regional_policy_manage` / `treasury:regional_fund_activation_manage`).
- **Prova:** `actor_capability_grants scope_type='regional_treasury'` (substrato SELADO porém **DORMENTE**; grants reais = 0; migration não aplicada em dev).
- **Recomendada:** **HOLD** — nenhuma leitura administrativa antes de grants reais + PORTA (frente própria B-CITY-2, com GO separado). O Fundo é da plataforma (DECISION-0114 D1); nenhuma empresa o governa.

### D-9 — Auditoria / plataforma (cross-tenant)
- **Sujeito:** Risk/Platform Authority (capability de plataforma explícita).
- **Prova:** capability de plataforma governada; NUNCA "conta-deus"/bypass admin (Constituição art. I §4).
- **Recomendada:** **Opção A** — leitura cross-tenant só por capability de plataforma explícita, auditável, sem chave-mestra; toda leitura registrada.

### D-10 — Exportação / retenção (LGPD)
- **Sujeito:** titular do dado; ou base legal registrada (retenção/compliance).
- **Prova:** ownership + base legal; exportação de dados de terceiro proibida sem base.
- **Recomendada:** **Opção A** — exportação self-service para o titular; retenção segue política de dados (soft-delete/logs, sem apagar civil — ACTOR_TRACEABILITY_CONTRACT §5).

### D-11 — PII / segregação tenant×actor (transversal)
- **Regra:** todo read financeiro/fiscal é tenant-scoped (RLS FORCE onde a tabela suporta) e não cruza actor sem representação. Contrapartes em extratos aparecem sem PII (id opaco/nome público, nunca CPF/tax_id/global_user_id).
- **Recomendada:** **Opção A** — segregação por tenant + actor por padrão (zero-trust); read-models nunca serializam PII de terceiros.

---

## 3. Contratos candidatos (sem montar rota — apenas shape para os read-models)

Preparados como INSUMO; **não** promulgados, **não** expostos. Discriminam autoridade e estado, seguindo o padrão honesto já usado no fundo regional (Fatia D).

```ts
// Envelope comum de leitura financeira/fiscal (candidato)
type ReadAuthzState = 'authorized' | 'forbidden' | 'not_applicable';
interface FinancialReadEnvelope<T> {
  authz: ReadAuthzState;      // forbidden nunca revela existência do recurso
  subjectActorId: string;    // provado server-side (nunca do actionContext)
  data: T | null;            // null quando !authorized (jamais valor fabricado)
}

// Read-models (shapes candidatos; autoridade herdada do recurso-fonte)
interface BankReadModel { balanceCents: number; currency: string; }         // D-1/D-3
interface AccountingProjection { /* derivado do bank_ledger, sem 2º ledger */ } // D-4
interface FiscalEstimate { taxReserveEstimatedCents: number | null; label: 'reserva_fiscal_estimada'; } // D-5/D-6
interface RegionalTransparency { cityId: string; cityName: string; balanceCents: number; /* agregado */ } // D-7
```

**Matriz de autorização candidata** (para testes de contrato futuros): produto cartesiano {D-1..D-11} × {dono, representante-com-capability, terceiro-sem-representação, plataforma, infra-down} → {authorized/forbidden/5xx}. A ser materializada como testes de contrato quando o titular ratificar as decisões.

---

## 4. O que este pacote NÃO faz
- Não promulga nenhuma DECISION (não ocupa o slot 0189+; é RFC/candidato).
- Não monta nenhuma rota protegida nem read-model público.
- Não cria capability/grant nova (aponta as que faltam — ex.: capability financeira de leitura em `company_users`, capability fiscal de representação — como decisões dependentes).
- Não ativa leitura fiscal/regional dormente (4E/B-CITY-2 seguem com GO próprio).

## 5. Próximo GO soberano
Ratificar (ou ajustar) as recomendações D-1..D-11. Só então: (a) promulgar a DECISION correspondente; (b) materializar os read-models contract-first com a matriz de autorização como teste; (c) só depois o frontend financeiro/fiscal projeta.
