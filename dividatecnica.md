# DÍVIDA TÉCNICA — rastreador vivo (atualizar toda sessão)

> **Propósito:** este arquivo é o painel único de progresso rumo a **zero dívida executável**.
> Toda sessão que tocar dívida técnica: (1) lê o placar abaixo, (2) trabalha, (3) atualiza o
> placar + a checklist do lote tocado, (4) anexa uma linha no changelog (nunca reescreve o
> histórico). Nenhuma sessão termina sem atualizar este arquivo.
>
> **Relação com artefatos anteriores (protocolo §4.3):** `PLANO_ZERAGEM_DT.md` é a auditoria
> histórica de origem (2026-07-06, 100% do cartório) — **não editar mais**, consultar como
> referência. Este arquivo é o **sucessor vivo** que substitui o plano como fonte do dia-a-dia.
> `LOTE_L2_DELEGACAO_R2.md` e `LOTE_L5_FROZEN_FANTASMA.md` são os pacotes de decisão detalhados
> de cada lote — ficam à parte, este arquivo só resume o status.

---

## 🔴 O QUE SIGNIFICA "ZERO" AQUI (ler antes de entrar em pânico com os números)

Zero **não** significa 0 linhas no `REMEDIATION_DT_LOG.md` — significa:
- Zero DTs no bucket **executável sem decisão** (C_CLEANUP/D_FIX) — **JÁ ATINGIDO**.
- Zero módulos expostos batendo em schema-ghost sem contenção — **JÁ ATINGIDO** (Lote L5).
- Zero itens em **A_DECISION** sem uma decisão registrada (podem seguir HOLD por escolha
  soberana — o que conta é ter sido decidido, não estar fechado).
- PORTA-1 com o mecanismo provado e a decisão de escopo (semear ou não) registrada —
  **mecanismo ATINGIDO**; semear é ato soberano, pode nunca "zerar" por escolha, e tudo bem.
- Os buckets B_MONEY/E_BLOCKED/F_LATENT **não zeram por execução** — zeram quando a frente-mãe
  (produto, dinheiro, identidade) abrir. Este arquivo rastreia até aí.

---

## 📊 PLACAR (atualizar a cada sessão)

| Métrica | Valor | Data |
|---|---|---|
| DTs distintas no cartório | ~522 | 2026-07-06 |
| Fechadas | ~313 | 2026-07-06 |
| **Abertas** | **~156** | 2026-07-06 |
| Contidas/mitigadas (latência viva) | ~50 | 2026-07-06 |
| Typecheck backend | ✅ 0 erros | 2026-07-06 |
| Suite `validate:regression-guards` | ✅ 195 GATE OK / RC=0 | 2026-07-06 |

**Fechadas nesta semana:** Onda 4 (12 carimbos) + organizers (1) + L5 (7: 4 contidas + 3
já-resolvidas) + achado P2P registrado (+1 nova, honesta) = **líquido: ~168 → ~156**.

---

## ✅ FEITO (buckets executáveis sem decisão — ESGOTADOS)

- [x] Onda 1 — C_CLEANUP (20/20 processados, 2026-07-05)
- [x] Onda 2 — D_FIX esforço S (12/12 processados, 2026-07-05)
- [x] Onda 3 — D_FIX esforço M/L (21/21 processados, 2026-07-05)
- [x] Onda 4 — higiene cartorial (12 carimbos, commit `a898d80c2`, 2026-07-06)
- [x] Onda 5 — typecheck backend 48→0 erros (commit `794d51dba`, 2026-07-06)
- [x] Divergência `organizers` resolvida por verificação (commit `2a2002837`, 2026-07-06)
- [x] Reconciliação APRENDIZADO↔sistema — 7/12 gaps já tinham resposta (commit `5017c5c18`)
- [x] R2.0 auditoria read-only de delegação executada (commit `14334d27b` — `LOTE_L2_DELEGACAO_R2.md`)
- [x] PORTA-1 passo 4 (mecanismo) provado em DB efêmera, 9/9 PASS (commit `8fd1e63fa`)
- [x] **Lote L5 — contenção 501 dos 4 módulos expostos** (venue/work-instant/policy-engine/
      residence), guard+E2E 44/44, suite 195 GATE OK (commit `c6f412b4c`, 2026-07-06)

**Não há mais housekeeping autônomo disponível.** Tudo que resta pede decisão (lotes) ou é
dinheiro soberano (PORTA-1 §4).

---

## 🟡 LOTES DE DECISÃO (aguardando Clayton)

### L1 — PORTA-1 / dinheiro (~35 DTs) — MECANISMO PRONTO, escopo em aberto
- [x] Passo 1: Core de Aprovação confirmado (já existia, DECISION-0128/0129/0130)
- [x] Passo 2: firewall no sink (4 entrypoints, commit da Fatia 9 passo 2)
- [x] Passo 3: split-mecanismo + PF resolver (commit da Fatia 9 passo 3)
- [x] Auditoria Yala rodou 2× — PASS, bloqueador P2P fechado
- [x] Passo 4 mecanismo provado em efêmera (2026-07-06, 9/9 PASS)
- [ ] **Passo 4 semear saldo REAL** — Clayton escolheu "só mecanismo" por ora; reabrir quando quiser
- [ ] Achado novo: `DT-P2P-TRANSFER-ACTOR-RESOLUTION-USERID-VS-ACTORID` (latente, liga ao L2)
- Ver `READINESS_PORTA1.md` para o mapa completo.

### L2 — Delegação/R2 + risco PJ (~12 DTs) — **PRONTO PRA DECIDIR**
- [x] R2.0 auditoria read-only executada (substrato existe, 9 delegações todas revogadas)
- [ ] **D1** — abrir R2 como próxima frente? (recomendação: SIM)
- [ ] **D2** — vocabulário `relationship_type` (vínculo jurídico) × departamento (lotação)
- [ ] **D3** — trilha de auditoria: tabela de eventos vs colunas (recomendação: tabela)
- [ ] **D4** — escopo financeiro fica FORA de R2 (espera PORTA-1/0114) — confirmar
- [ ] **D5** — camada de risco (anti-laranja etc.) adiada pra sub-frente própria — confirmar
- Ler `LOTE_L2_DELEGACAO_R2.md` (~5 min) e decidir D1–D5 numa sentada.

### L3 — Catálogo/serviços/marketplace (~15 DTs) — não iniciado
- [ ] Seed de catálogo (hoje quase vazio, 1 serviço)
- [ ] Sinônimos profissão→serviço (só BELEZA tem ponte hoje)
- [ ] Curadoria headless (promote/reject/merge/RLS)
- [ ] W2 — produto vira actor-first ou segue taxonômico?
- [ ] Marketplace hybrid anti-pattern
- Pacote de decisão ainda não montado — próximo a preparar quando este lote entrar em pauta.

### L4 — Social/feed/votes (~10 DTs) — não iniciado
- [ ] Follow mechanics (decisão arquitetural pendente)
- [ ] Feed post-id drift (risco de verdade paralela)
- [ ] CTAs zumbi no frontend
- [ ] Votes eligibility (quem pode votar/criar votação)
- [ ] `DT-SOCIAL-POST-VISIBILITY-NOT-ENFORCED-ON-READ` (precondição da Fase 2 de descoberta)
- Pacote de decisão ainda não montado.

### L5 — Módulos frozen/fantasma (~10 DTs) — **CONTENÇÃO EXECUTADA, resíduo de decisão**
- [x] Saúde, automation, organization — já resolvidos, documentados no cartório
- [x] Venue, work-instant, policy-engine, core/residence — **contidos 501** (2026-07-06)
- [ ] Presence — decisão P4 (SSOT entre 9 modelos paralelos) ainda não tomada
- [ ] Bank-satellite — arquivar `core/intent` formalmente (único caso simples do bloco de 16)
- [ ] Operational-binding-fragmentation — investigar origem das 9 delegações revogadas (liga ao L2)
- [ ] Aspirational-vs-runtime — corrigir path do `MODULES_INVENTORY.md` movido
- Ver `LOTE_L5_FROZEN_FANTASMA.md` para o detalhe completo (12 itens originais).

### L6 — Identidade/nascimento C1 (~8 DTs) — não iniciado
- [ ] DECISION-0115 D1/D2 (tenant-por-signup, identity/actor best-effort silencioso)
- [ ] Tríade CPF F4/F5 (deprecar caches `user_profiles.cpf`/`profiles.cpf`)
- [ ] `pilot_invites` ausente em dev
- [ ] Actor institucional de sistema (decisão pendente)
- [ ] `DT-ONBOARDING-METADATA-STORAGE-DECISION` (4 opções de storage)
- Pacote de decisão ainda não montado.

**Ordem recomendada (herdada do plano original, revista pela reconciliação APRENDIZADO):**
L5 (quase feito) → **L2 (agora é prioridade alta — destrava o Compositor)** → L3 → L4 → L6 → L1.

---

## 🔵 SIGN-OFFS PENDENTES (não são dívida técnica — são validação sua)

- [ ] Fatia 6 (Chamado) — frontend entregue, aguarda teste visual
- [ ] Fatia 7 (CRM projetado) — frontend entregue, aguarda teste visual
- [ ] Fatia 8 (ERP composto) — frontend entregue, aguarda teste visual

---

## 📜 DISCIPLINAS VINCULANTES (herdadas — não renegociar sem motivo)

1. PJ, grupo, Bank e marketplace **nunca** na mesma execução.
2. Money/grupo/split/payout só com **três paralelas** + E2E fail-first.
3. SQL a `bank_*` só dentro de `backend/src/modules/bank/`.
4. Nada é "fechado" sem prova material (guard + negative-proof + E2E quando aplicável).
5. Reconfirmar HEAD/migrations no início de cada fatia.
6. **Fim de cada sessão:** atualizar o placar deste arquivo + reportar contagem a Clayton.
7. Fechamento de DT só vale com **re-carimbo no header do `REMEDIATION_DT_LOG.md`** — evita os
   headers mentirosos que a Onda 4 encontrou.
8. Modelo por tipo de tarefa: **Sonnet 5/alto** para verificação mecânica e higiene; **Fable
   5/extra** para julgamento arquitetural e reconciliação; **Fable 5/ultracode** reservado para
   execução de alto risco (PORTA-1, R2 writer).
9. Nunca rotular achado externo como "falso" sem checar `git log`/`git show` da história do
   arquivo — absença no presente ≠ nunca existiu.
10. Verdade está sempre no backend — nunca aceitar "frontend não chama mais" como garantia de
    segurança.

---

## 📚 DOCUMENTOS-FONTE (não duplicar aqui, só apontar)

- `REMEDIATION_DT_LOG.md` — cartório completo (fonte de verdade de cada DT individual)
- `MAPA_DE_FECHAMENTO.md` — retrato do cluster autoridade (esgotado) vs dinheiro (PORTA-1)
- `READINESS_PORTA1.md` — read-first completo do cluster de dinheiro
- `LOTE_L2_DELEGACAO_R2.md` — pacote de decisão da frente de delegação
- `LOTE_L5_FROZEN_FANTASMA.md` — pacote de decisão dos módulos frozen/fantasma
- `GUIA_MESTRE_ACOPLAMENTO_CRM_ERP_PDV.md` — trilho da missão de acoplamento (Fatias 1-9)
- `APRENDIZADO.md` — visão do Compositor + reconciliação contra o sistema vivo
- `PLANO_ZERAGEM_DT.md` — auditoria histórica de origem (não editar mais)

---

## 📝 CHANGELOG (mais recente no topo — append-only, nunca reescrever)

### 2026-07-06 — Lote L5 executado + arquivo criado
- Criado este rastreador vivo, consolidando o estado pós-execução da semana.
- Contidas 501: venue (15 rotas, pública), work-instant (12), policy-engine (11),
  core/residence (3). Guard + E2E 44/44 + suite 195 GATE OK. Commit `c6f412b4c`.
- 3 itens do L5 confirmados já-resolvidos por outra frente (saúde/automation/organization).
- PORTA-1 passo 4 mecanismo provado em efêmera (9/9). Achado novo registrado: P2P
  actor-resolution (latente, contido em dobro). Commit `8fd1e63fa`.
- R2.0 (delegação) auditado em 1ª mão — `LOTE_L2_DELEGACAO_R2.md` criado, pronto pra decisão.
- Reconciliação APRENDIZADO↔sistema: 7 de 12 gaps do Compositor já tinham resposta viva.
- Onda 4 (12 carimbos) + Onda 5 (typecheck 48→0) + organizers fechado por verificação.
- **Saldo da semana: ~168 → ~156 abertas.**

---

*Atualizar este arquivo é obrigatório ao fim de cada sessão que toque dívida técnica —
protocolo §4.3, disciplina §6 acima.*
