# Fluxo de ativação — pré-requisito ao primeiro write (LOTE 1)

**Estado:** definição normativa e operacional — **nenhuma escrita em BD** foi executada para este documento.  
**Bloqueio:** até este fluxo estar **aceite por produto/compliance**, não executar `INSERT`/`UPDATE` em `users`, `actors`, `identities` ou `global_users` para o LOTE 1.

**Referências:** `RFC_OPTION_A_PERSON_TO_USER_ACTIVATION.md`, `docs/03_execution_log/LOTE_1_PREP_ALTA_2026-04-16.md`, `ACTOR_TRACEABILITY_CONTRACT.md`, `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` §4.8–4.9, runbook identity (Batch1 / Batch2).

**Modelos excluídos:** criação automática de `users` com email ou CPF sintéticos (proibido).

---

## FASE 1 — Fluxo completo: `person` → `user` → `identity`

### 1.1 Como nasce o `users` (escolha única para produção)

| Modelo | Descrição | Uso |
|--------|-----------|-----|
| **Convite** | Sistema ou admin envia convite (email/SMS/app) com token; destinatário completa registo; cria-se `users` com email verificado. | Padrão B2C/B2B quando há contacto real. |
| **Claim / reivindicação** | Utilizador já autenticado associa-se a um `actor_id` pré-existente após prova forte (código, documento, suporte). | Legado, fusões, “esta conta é minha”. |
| **Híbrido** | Convite para email conhecido + passo de claim se o email já existir noutro tenant (política de merge). | Empresas, substituição, sucessão — sempre com auditoria. |

**Proibido:** “MODELO 3” — `INSERT` em `users` por script sem pessoa real e sem processo de verificação.

### 1.2 Validação de identidade civil

1. **`global_users` + `identities`:** `tax_id` / `tax_id_type` válidos; `kyc_status` conforme produto — **sem** CPF/CNPJ de teste em ambiente que se pretenda auditável como produção.
2. **Mesmo CPF:** um `global_user_id` canónico; `users` de vários tenants podem referenciar o mesmo GU se a política multi-tenant o permitir (não duplicar identidade fiscal).

### 1.3 Vinculação técnica (ordem)

1. Existe `actors` (`person`) sem `user_id`.
2. Passo humano: identificar **a quem** o actor pertence (titular real ou política de empresa).
3. Convite ou claim → criação de `users` (email verificado).
4. **Batch1 (identity):** garantir linha em `global_users` + `identities` e `users.global_user_id` preenchido.
5. **Batch2 / SQL documentado:** `actors.user_id` + `actors.global_user_id` + convergência de `actor_type` para `user` quando a norma de produto o exigir.
6. **Precheck** + evidência no log.

### 1.4 Duplicidade e vários actors

- **Mesmo CPF → mesmo `global_user_id`:** SSOT em `identities`; não criar segundo GU para o mesmo documento.
- **Múltiplos `actors` → mesmo `users`:** permitido (ex.: papéis no tenant) desde que `user_id` nos actors aponte para o mesmo `users.id` e authority esteja resolvida.

---

## FASE 2 — Simulação com LOTE 1 (4 actors)

**Tenant:** `9bdc68b6-c94e-43d4-bf4d-cfa00e9b5fc5`  

**actor_id:**

- `ec75df56-5bb8-4afd-b945-5729ec0282a0`
- `c9fca56e-9a2f-4841-b762-e6271dafe188`
- `3e6e0ea1-871d-4f71-b357-4717e822b68f`
- `5d0f2c4a-855e-498e-aea2-b383eb46da70`

*(Read-only: não há “dono” na BD sem processo de negócio.)*

| Pergunta | Resposta operacional |
|----------|------------------------|
| Quem é o dono? | **Definir por produto/ops** (titular da conta bancária, organizador, contrato). Não inferir por nome. |
| Como convidar? | Um convite por actor (ou por lote) com identificador interno `actor_id` no token de vínculo. |
| Se não responder? | Actor permanece **pendente**; operações críticas bloqueadas ou em modo observação conforme §3. |
| Se recusar? | Registar recusa; actor continua sem `user_id`; **PROPOSTA** (encerramento, outro titular, tenant de teste). **Histórico financeiro não é apagado.** |

---

## FASE 3 — Regras formais do sistema (proposta)

1. **`actor` humano elegível sem `user_id`:** estado **pendente de dono** (metadado ou fila operacional) — não significa “sem responsabilidade civil” se outra norma fixar âncora.
2. **Operações críticas** (lista a fechar: débito, publicação jurídica, etc.): **bloquear** ou **soft-block** até `users.global_user_id` + actor coerente, salvo excepção RFC.
3. **Quarentena:** reutilizar `isActorEffectivelyBlocked` / ATL onde aplicável (`LEI` §4.8.4).
4. **Histórico:** append-only em domínios normados; nunca apagar trilho para “resolver” pendência.

---

## FASE 4 — Log e auditoria (o que registar antes/depois do write)

| Evento | Mínimo a registar |
|--------|-------------------|
| Convite criado | `actor_id`, `tenant_id`, canal, id do convite, timestamp, executor |
| Convite aceite | `user_id` criado, email, timestamp |
| Identidade criada | referência a `global_user_id` / `identities` (sem expor documento em log público) |
| Vínculo actor–user | `actor_id`, `user_id`, PROPOSTA ou script, PR/commit |
| Recusa / timeout | motivo, timestamp, próximo passo |

**Onde:** `docs/03_execution_log/IDENTITY-ACTIVATION-<DATA>.md` e/ou tabela de decisões se existir no produto.

---

## Pontos de risco

| Risco | Mitigação |
|-------|-----------|
| User “fake” para destravar | Bloqueio cultural + revisão humana obrigatória no LOTE 1 |
| Dois users para o mesmo actor | Transação única ou idempotência por `actor_id` |
| Executar batch2 antes de identity | Precheck A1/A2 falha — ordem fixa Batch1 → Batch2 |
| Pressa para baixar A2 | Não usar `is_identity_required = false` sem CP-5 |

---

## Critério de desbloqueio do primeiro write

- [ ] Este fluxo lido e **aceite** pelo dono de produto/compliance.  
- [ ] Para cada um dos 4 `actor_id`, **destinatário do convite** ou **critério de claim** definido por escrito.  
- [ ] **PROPOSTA** única com SQL/comandos previstos e rollback conceitual.  
- [ ] **Precheck** imediatamente antes e depois do lote.

---

*Documento de gate — execução do LOTE 1 só após checkboxes acima.*
