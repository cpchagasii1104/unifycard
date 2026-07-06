# LOTE L2 — DELEGAÇÃO (R2) · Pacote de decisão + auditoria R2.0 executada

> **Data:** 2026-07-06 · HEAD pós-`5017c5c18` · branch `rescue-structural`
> **O que é:** a auditoria read-only R2.0 (primeira fatia do plano R2, autorizada pelo próprio
> desenho arquivado como pré-execução) foi EXECUTADA nesta sessão, com verificação direta em
> código e banco vivo. Este documento entrega os fatos + as 5 decisões que destravam a frente.
> **Por que importa AGORA:** a reconciliação APRENDIZADO↔sistema (2026-07-06) provou que o
> Compositor por departamentos (RH/Warehouse/Finance...) que Clayton desenhou É materialmente
> esta frente — o vocabulário de papel/limite/audiência por departamento aterrissa em
> `actor_delegations.scopes_json` + `relationship_type`. Sem R2, o Compositor PJ não nasce.

---

## 1. FATOS CRAVADOS (auditoria R2.0, verificação de 1ª mão)

### 1.1 O substrato EXISTE e o writer FUNCIONA (não é greenfield)
- **Tabela `actor_delegations`** (migration `20260530493000`, única do domínio): `delegation_id`,
  `tenant_id`, `user_actor_id`, `institutional_actor_id`, `scopes_json` (JSONB), `is_transitive`,
  `expires_at`, `status('active'|'revoked'|'expired')`, timestamps, `revoked_at`. Índices por
  `(tenant, user)` e `(tenant, institution)`.
- **Writer vivo:** `company-members.service.ts` cria delegação ao ativar membro (`:96`) e revoga
  ao remover (`:194-201`), com `softBlockService.validateDelegation` no caminho (bloqueia
  transitiva, sem-expiry, sem-scope, wildcard indevido — 4 soft-blocks ativos).
- **Banco vivo (query direta 2026-07-06):** 9 delegações, **TODAS `revoked`, 0 ativas**, todas
  com scope `["publish_feed","create_events"]`. → `DT-ACTOR-DELEGATIONS-ZERO-RUNTIME` está
  confirmada como **PARTIAL** (runtime dormante, não zero-histórico).

### 1.2 Os leitores (mapa completo — 2 leitores de runtime, não 1)
1. **`authorization.service.ts::canRepresentActor`** (`:335-404`) — fonte 5 da representação.
   **Scope-containment JÁ aplicado:** delegação só concede representação ampla se `scopes`
   inclui `'*'`; escopo estreito NÃO vira crachá em branco (fix DT-AUTHORITY-LATENTS ①,
   ratifica DECISION-0125). O afrouxamento por-rota (`canActAs` + PermissionKey via
   `checkDelegationPermission`, `:595`) existe e é o caminho scope-aware.
2. **`actor-capabilities.service.ts`** (`:166` e `:186`) — projeta delegações nos DOIS sentidos
   (user→institucionais e institucional→users recebidas). É leitor de PROJEÇÃO (UI), não de
   autoridade — mas precisa acompanhar qualquer mudança de shape.

### 1.3 O vocabulário de hoje é o embrião do Compositor por departamento
`company-members.service.ts::getScopesForRole` (`:121-132`) — TODO o vocabulário atual:
```
admin      → ['*']
staff      → ['publish_feed', 'create_events']
contractor → ['publish_feed']
```
É exatamente aqui que o desenho do APRENDIZADO (RH posta vaga, Warehouse procura fornecedor,
Finance aprova gasto, limites por departamento) precisa aterrissar. Hoje 3 roles, 3 scopes.

### 1.4 O gap normativo (§4.9.9 / SSOT §5.16) confirmado no schema
A tabela NÃO tem (verificado por grep na migration, zero ocorrências):
- `relationship_type` (sócio/diretor/procurador/funcionário-de-departamento...)
- `granted_by_actor_id` (quem concedeu, com que autoridade)
- `previous_link_id` (encadeamento da cadeia de delegação)
- trilha append-only de grant/revoke (o `revoke` é flip de status, não evento)
`expires_at` (temporalidade) já existe; `is_transitive` existe mas sem fecho humano enforçado.

### 1.5 Pré-condição do plano antigo: SATISFEITA
O desenho R2 arquivado (2026-06-08) congelava a frente até "0113 fechar de verdade + selo".
O `MAPA_DE_FECHAMENTO` (2026-07-04) confirma: cluster autoridade **ESGOTADO E BLINDADO**
(V1/V4, YALA #1 F1-F5, KYC-âncora, delegação-escopo, G1 baseline-ratchet — tudo fechado com
E2E + negative-proof + gate permanente). **R2 não está mais bloqueada por pré-condição.**

---

## 2. AS 5 DECISÕES DE CLAYTON (o que destrava a execução)

### D1 — Abrir R2 como próxima frente material? (SIM/NÃO)
Recomendação: **SIM.** É a frente de maior alavancagem sem tocar Bank (fecha/encaminha ~12 DTs
do cluster PJ/risco), e é o substrato direto do Compositor por departamentos do APRENDIZADO.

### D2 — Vocabulário de `relationship_type` (lista governada)
O que o APRENDIZADO já desenhou (6 departamentos) sugere DOIS eixos distintos que NÃO devem
ser conflacionados:
- **Vínculo jurídico-institucional:** `partner | director | administrator | attorney |
  legal_representative | employee | contractor`
- **Lotação operacional (departamento):** `rh | warehouse | finance | admin | sales | operations`
Recomendação: `relationship_type` = vínculo jurídico (enum governado, CHECK no banco);
departamento = scope estruturado dentro de `scopes_json` (ex.: `dept:warehouse` +
`warehouse:procure`, `warehouse:receive`...). Assim o vínculo legal e a lotação evoluem
independentes. **Decisão sua: ratificar ou ajustar as duas listas.**

### D3 — Trilha de auditoria: tabela de eventos vs colunas
Opções: (a) tabela `actor_delegation_events` append-only (grant/revoke/expire como eventos,
padrão já usado em `financial_approval_policy_events`) — recomendada; (b) só colunas
(`granted_by`, `revoked_by`, `revoke_reason`) — mais barato, trilha mais pobre.
Recomendação: **(a)** — o precedente financeiro já existe no schema, é copiar padrão.

### D4 — Escopo financeiro de delegação: FORA de R2 (confirmar)
Os limites de gasto por departamento do APRENDIZADO (Warehouse até R$50k etc.) são autoridade
FINANCEIRA — dependem do modelo AP/AR (DECISION-0114) e do Core de Aprovação (PORTA-1).
Recomendação: **confirmar que R2 entrega o substrato (vínculo+departamento+cadeia) e os scopes
NÃO-financeiros; limites de gasto entram só quando PORTA-1/0114 decidirem.** Sem isso, R2
viraria frente de dinheiro por acidente.

### D5 — Camada de risco (anti-laranja, credential-sharing, case-review): adiar (confirmar)
As 6 DTs de risco do cluster pressupõem o substrato pronto. Recomendação: **sub-frente própria
DEPOIS de R2.1-R2.3, com desenho read-only próprio.** Não empacotar agora.

---

## 3. SEQUÊNCIA DE EXECUÇÃO (quando você der GO)

- **R2.1 — Schema (migration forward-only):** `relationship_type` (enum governado por D2) +
  `granted_by_actor_id` + `previous_link_id` (FK self) + tabela `actor_delegation_events`
  (por D3). Zero writer nesta fatia; CHECK/FK/índice provados em DB efêmera.
- **R2.2 — Writer governado:** grant/revoke com gate de autoridade (só quem `canManageCompany`
  concede; autoria provada via `canRepresentActor`); `company-members` passa a gravar
  `relationship_type`/`granted_by`/evento; vocabulário de departamento entra em `scopes_json`
  estruturado. E2E fail-first (concedente sem poder rejeitado; expiração honrada; PF intacta).
- **R2.3 — Cobertura de leitura:** `actor-capabilities` projeta os campos novos; verificação
  de que `canRepresentActor`/`canActAs` seguem íntegros (nenhuma mudança de semântica de
  autoridade nesta fatia — os fixes de escopo JÁ estão aplicados).
- **R2.4 — Risco:** sub-frente própria, depois (D5).

**Modelo/esforço para execução:** Fable 5 ultracode (autoridade = zero margem de erro),
com selo Yala ao fim de R2.2 (writer é a fatia sensível).

---

## 4. O QUE ESTE LOTE NÃO TOCA (disciplina)

- `bank_*` / limites de gasto / aprovação financeira (PORTA-1/0114 — D4).
- Camada de risco (D5 — sub-frente própria).
- `company_users` como vínculo formal — authorized link COMPLEMENTA, não substitui.
- PORTA-3 (afrouxamento scope-aware por-rota de canRepresentActor) — frente separada já nomeada.

---

*Auditoria R2.0 executada em 1ª mão (código + banco vivo) por Fable 5 em 2026-07-06.
As 5 decisões são soberanas de Clayton; a execução R2.1-R2.3 só abre com GO explícito.*
