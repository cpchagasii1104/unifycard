# DECISION-0083 — D3: princípio do vínculo autorizado de CPF sobre PJ + camada enterprise de risco/governança humana

**Status:** PROMULGADA POR CLAYTON — DECISÃO DE PRINCÍPIO (D3, derivada da M0/D1). **DOCS-ONLY**; implementação **NÃO** autorizada aqui (2026-06-03).
**Sessão:** 2026-06-03 — frente `F-PJ-BIRTH-AND-COMMERCIAL-SSOT-READONLY`.
**Decisor:** Clayton. **Commit âncora:** HEAD origem `7b2baad1`.
**Natureza:** registra a **D3** — princípio do vínculo autorizado (CPF→PJ) + princípio da camada enterprise de risco/dados com julgamento humano. É decisão de **PRINCÍPIO**, NÃO de modelo A/B/C, enum, schema, motor de risco, backoffice, operador, correspondente ou biometria.
**Documento canônico:** este arquivo.
**Deriva de:** `DECISION-0081` (M0 — PJ é identidade fiscal própria, não-soberana), `DECISION-0082` (D1 — casa canônica do CNPJ; operação por vínculo CPF).
**Subordinada a:** `CONSTITUICAO_UNIFICARD.md`, `AUTHORITY_LAW.md`, `IDENTITY_SSOT_PRECEDENCE.md`, `SSOT_REGISTRY_UNIFICARD.md`, `07_NOMENCLATURA_CANONICA.md`, `LEIS_OPERACIONAIS_UNIFICARD.md`.
**Nota normativa:** `AUTHORITY_PRECEDENCE.md` **NÃO encontrado** em `docs/01_normative/` nesta sessão (test/ls-files); base de autoridade aplicada = `AUTHORITY_LAW.md`. Não se inventou norma de memória.
**Vinculada a:** DTs `DT-PJ-AUTHORIZED-LINKS-SUBSTRATE-MISSING`, `DT-PJ-CREDENTIAL-SHARING-RISK-GUARD-MISSING`, `DT-RISK-ENTERPRISE-CASE-REVIEW-SUBSTRATE-MISSING` (novas) + `DT-PJ-TRANSFER-OWNERSHIP-MISSING`, `DT-PJ-ANTI-LARANJA-CORRELATION-MISSING`, `DT-PJ-TRANSVERSAL-RISK-SIGNALS-MISSING`, `DT-RISK-HUMAN-OPERATIONS-SUBSTRATE-MISSING`, `DT-RISK-FALSE-POSITIVE-SAFEGUARD-MISSING`, `DT-PJ-KYC-DOCUMENTS-SUBSTRATE-MISSING` (existentes).

---

## 1. Status

PROMULGADA POR CLAYTON. DOCS-ONLY. Deriva de `DECISION-0081` (M0) e `DECISION-0082` (D1). Registra **princípio**, não estrutura técnica. Não autoriza código/schema/migration/DML/motor de risco/backoffice.

## 2. Contexto

A M0 (`DECISION-0081`) promulgou que a PJ é **identidade fiscal própria, não-soberana**; a D1 (`DECISION-0082`) promulgou a **casa canônica do CNPJ** e que toda operação passa por **vínculo CPF autorizado**. D3 é a derivada que crava **como** esse vínculo se qualifica e **como** o sistema trata risco/julgamento humano em nível enterprise. Prepara D5 (transferência), D6 (anti-laranja), D7 (risco transversal) e a futura camada enterprise de risco/operadores.

## 3. Estado factual conhecido (provado em auditorias anteriores)

- `company_users` existe como **associação/membership/role grosso**: `role` (CHECK `owner|admin|staff|contractor|member`) + flags `can_manage_*` + `member_status` (`active|invited|suspended`); **não materializa a política D3 completa** (sem escopo fino, sem `expires_at`, sem `revoked_at`). [`pg_constraint`]
- `actor_delegations` existe como **substrato genérico de delegação escopada/temporal/revogável**: `user_actor_id → institutional_actor_id`, `scopes_json`, `expires_at`, `status` (`active|revoked|expired`), `revoked_at`.
- `company_validation_requests` existe (aprovação manual: `submitted_by_user_id`, `reviewed_by_user_id`, `status`, `decision_reason`).
- `atl_blocked_actors` existe (bloqueio/quarentena por actor); `economic_identities` existe (trust por actor); `event_log` existe (trilha/evento).
- **`risk-command-center`/`policy-engine` podem existir como módulos/cascas — D3 NÃO assume maturidade runtime sem prova.**
- **AUSENTES/não consolidados:** substrato próprio completo de operador interno/risk operations; substrato de correspondente externo; grafo anti-laranja / `actor_relationships` / `risk_signals`.
- Há **embriões vivos**, mas a D3 completa **ainda não está materializada**.

## 4. D3 PROMULGADA — princípio do vínculo autorizado

> **No Unificard, nenhum CPF/actor humano opera, representa, valida, fiscaliza ou responde por uma Pessoa Jurídica/CNPJ sem vínculo formal autorizado dentro do sistema. Esse vínculo precisa ser rastreável, escopado, temporal, revogável e auditável. Compartilhar login ou senha nunca é autorização válida. Cada CPF age com sua própria identidade. Responder, operar e representar são naturezas diferentes. O sistema pode detectar, cruzar dados e sinalizar riscos em nível enterprise, mas consequências reais sobre pessoas ou empresas dependem de revisão humana por operadores/camadas de governança autorizadas e auditáveis.**

Registrado sem diluir:
- empresa tem identidade fiscal própria, mas **não soberana**;
- toda autoridade operacional **fecha em CPF/actor humano**;
- o CPF precisa ter **vínculo autorizado**;
- vínculo **não nasce de senha**, **não nasce de "sou o criador"**, **não nasce de tentativa informal**;
- vínculo precisa ter **limite, trilha e revogação**;
- **dados e risco informam decisão**;
- **operador humano/camada de governança decide consequências reais**;
- **falso positivo é dano** e deve ser tratado como risco do sistema.

Alinhamento: `AUTHORITY_LAW Art.1.2` (permissão revogável, não cria autoridade), `Art.1.3` (delegação com escopo/tempo/narrativa), `Art.1.4` (persona nunca soberana), `Art.2` (lastro humano; multiplicidade de personas aumenta vigilância do CPF), `Art.11` (IA não condena/age irreversível sem humano).

## 5. Distinção de naturezas (princípio D3)

**Responder ≠ operar ≠ representar ≠ validar/fiscalizar.**
- **Responder:** CPF/actor humano que carrega **responsabilidade principal** perante a empresa/CNPJ no Unificard.
- **Operar:** CPF/actor humano autorizado a executar **atividades cotidianas** (PDV, agenda, estoque, atendimento, entrega, gestão operacional ou módulo específico).
- **Representar:** CPF/actor humano autorizado **formalmente a agir em nome da empresa** (procuração, contrato, quadro societário, função ou documento validado).
- **Validar/fiscalizar:** operador interno, equipe de risco, backoffice, correspondente autorizado ou camada de governança que **analisa, aprova, rejeita, pede complemento, revisa ou audita**.

Regras:
- operador de caixa **não vira representante jurídico** por operar;
- procurador **não vira operador cotidiano** por representar;
- responsável principal **não concede automaticamente** todos os poderes a todos;
- **escopo amplo exige mais rastreabilidade, não menos**;
- mudança de controle futura **deve revisar** vínculos relevantes;
- permissões antigas **não devem sobreviver automaticamente** à transferência sem revalidação/reautorização.

D3 **não decide** quantos tipos/tabelas/enums existirão — apenas crava que as naturezas são diferentes.

## 6. Senha compartilhada como anti-padrão

Compartilhar login/senha **nunca** é autorização. Credencial compartilhada **não** equivale a vínculo autorizado — é, no máximo, **sinal de risco**. Cada CPF age com a própria identidade. (Materialização de guarda = `DT-PJ-CREDENTIAL-SHARING-RISK-GUARD-MISSING`.)

## 7. Camada enterprise de risco e dados (princípio, não implementação)

Por princípio, o Unificard terá uma **camada enterprise de análise de risco, dados e governança humana** que deve: cruzar dados entre módulos; detectar padrões suspeitos; sinalizar risco; preservar evidências; apoiar operadores humanos; permitir análise/aprovação/rejeição/pedido de complemento/quarentena/liberação; manter **trilha auditável** de cada decisão; permitir **revisão por camada superior**; proteger o sistema contra fraude; **proteger o usuário legítimo contra falso positivo**.

**Frase-chave: o sistema sinaliza; o humano autorizado julga; a trilha audita.**

Explícito:
- sinal de risco **não é condenação**;
- correlação **não é prova final**;
- algoritmo **não bloqueia permanentemente pessoa real sozinho**;
- operador interno **também responde** por sua decisão;
- operador interno deve atuar com **autoridade formal, limitada e auditável**;
- decisões de operador **podem ser auditadas e correlacionadas**;
- **governança superior decide** sobre abuso ou erro de operador;
- produto/UX **não pode passar por cima** de ATL, KYC, Guarda ou autoridade.

(NÃO cria motor de risco/backoffice/tabela/fluxo — só princípio. Materialização = `DT-RISK-ENTERPRISE-CASE-REVIEW-SUBSTRATE-MISSING` + `DT-RISK-HUMAN-OPERATIONS-SUBSTRATE-MISSING` + `DT-RISK-FALSE-POSITIVE-SAFEGUARD-MISSING`.)

## 8. O que D3 resolve (princípio)

- CPF diferente do criador **pode** operar uma empresa **se tiver vínculo autorizado**.
- CPF **sem** vínculo autorizado **não opera**.
- Autoridade sobre PJ/CNPJ **não nasce** de senha compartilhada nem de tentativa informal.
- Autoridade sobre PJ/CNPJ **nasce de vínculo formal, rastreável, escopado, temporal e revogável**.
- Responder, operar e representar são **naturezas diferentes**.
- Validação/fiscalização **também exige autoridade rastreável**.
- Operador/backoffice **não é "poder invisível"** — é actor/camada **auditável**.
- Dados e risco **alimentam** decisão humana, **não substituem** julgamento humano.
- D3 cria base conceitual para **D5** (transferência), **D6** (anti-laranja), **D7** (risco transversal) e a futura camada enterprise de risco.

## 9. O que D3 NÃO resolve (pendente; sem mecanismo promulgado)

- **D2** — estrutura técnica da casa do CNPJ (UNIQUE, CHECK, FK, índice, escopo de unicidade).
- **Estrutura técnica da D3:** modelo A/B/C; vínculo único+scopes; eixos distintos; híbrido type+scopes; convergência×coexistência `company_users`↔`actor_delegations`; enum de tipos; quantos eixos materializar.
- **D5** — transferência/venda formal + revalidação de vínculos pós-troca.
- **D4** — responsabilidade transitória (prazo verbalizado 5 anos) + possível caução/hold financeiro futuro.
- **D6** — grafo anti-laranja CPF↔CNPJ↔CPF (eventual extensão a operadores/correspondentes).
- **D7** — risco transversal, risk operations, operador auditável/correlacionável, governança superior, salvaguarda contra falso positivo.
- **Frente de validação forte** — gov.br/biometria/facial/prova de vida (LGPD/consentimento/retenção/acesso/auditoria).
- **Operador interno** — substrato próprio futuro. **Correspondente externo** — modelo contratual futuro (não cartorial). **Backoffice enterprise** — filas/casos/evidências/SLA/escalonamento/revisão/auditoria. **Métricas de risco** — desenho futuro; **nunca contagem bruta como sentença**.

## 10. Operador, backoffice, correspondente e biometria — insumos futuros (não mecanismos)

- **Operador interno/backoffice:** age por autoridade formal; fecha em CPF; aprova/rejeita/pede complemento/quarentena/libera **dentro de escopo**; auditável; correlacionável no futuro (mecanismo em D6/D7); governança acima julga abuso/erro/padrão anômalo.
- **Camada enterprise de análise:** dados = **evidência** (origem/data/fonte/contexto/trilha); painel de risco **não é juiz**; sinal exige revisão **proporcional**; falso positivo = risco operacional e institucional.
- **Correspondente autorizado:** possível futuro como **correspondente contratual**; **não é cartório**, **sem fé pública**; validade **interna/contratual** perante o Unificard; empresa correspondente e atendente correlacionáveis no futuro; mecanismo em derivadas futuras.
- **Biometria/gov.br/prova de vida:** frente futura de **validação forte**; dados sensíveis → **LGPD-first** (consentimento/finalidade/retenção/acesso/segurança/auditoria); **não coletar, desenhar ou prometer implementação nesta D3**.

## 11. Derivadas pendentes

D2 → estrutura técnica da D3 → D5 → D4 → D6 → D7 → validação forte LGPD-first. (Ordem em §13.)

## 12. Fronteiras (vinculante)

```text
NÃO tocar CPF F5 (user_profiles.cpf / profiles.cpf).
NÃO tocar Bank / ledger.
NÃO tocar preço.
NÃO tocar marketplace executável.
NÃO tocar agenda / recurso físico.
NÃO tocar biometria / validação forte.
NÃO tocar risk engine / backoffice.
NÃO alterar backend/src, frontend/src, schema, migrations.
NÃO fixar modelo A/B/C, enum de tipos, nem decidir company_users×actor_delegations. NÃO implementar.
```

## 13. Ordem futura

```text
1. Consolidação Opus/ChatGPT desta D3.
2. Estrutura técnica da D3 (modelo A/B/C + enum + company_users×actor_delegations) — promulgação própria.
3. D2 (casa técnica do CNPJ).
4. D5 (transferência) → D4 (responsabilidade transitória/caução) → D6 (anti-laranja) → D7 (risco transversal).
5. Validação forte LGPD-first.
6. Desenho técnico → migration única → código → gates.
```

## 14. Superada por

(em aberto — decisão vigente)
