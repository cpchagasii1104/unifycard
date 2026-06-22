# DECISION-0147 — Ativação segura de service_offering (draft→active) · F-SERVICE-OFFERING-ACTIVATION-SAFE-PUBLICATION (P3 / Caminho A)

**Status:** **PROMULGADA / DOCS-ONLY / DECISÃO ARQUITETURAL+PRODUTO-AUTORITATIVO / ATIVAÇÃO SEGURA DE SERVICE_OFFERING** (Clayton 2026-06-22; ChatGPT ratificado).
**NÃO** altera `docs/01_normative`. **NÃO** toca runtime/migration/frontend/backend. Precede a execução material (harden da ativação), que só roda após GO próprio (**MODO B/C**).

**Data:** 2026-06-22 · **Branch:** `rescue-structural` · **HEAD (pré-commit):** `1b6f1fea` · **Tipo:** arquitetural / produto-autoritativo (docs-only) · **Frente:** F-SERVICE-OFFERING-ACTIVATION-SAFE-PUBLICATION (P3 / Caminho A)
· **Responsável:** Clayton (decisão soberana Q1–Q5) / IA-DIRETORA (executor: Claude Opus 4.8) · **Ratificação:** Clayton + ChatGPT
· **READ-FIRST (3 elos, READ-ONLY):** A superfície de ativação = **FECHA_COM_RISCO** (ativação só `canRepresentActor`; status free-form; elegibilidade só na criação) · B gates KYB/trust = **DECISION_REQUIRED** (régua não deriva inteira de norma) · C active-only/cascata/bypass = **FECHA_COM_RISCO** (discovery active-only ✓; cascata KYB→publicação/tco atômica ✓; **mas não suspende `service_offerings.status`**).

**Deriva de / subordinada a:** DECISION-0100 D5/D6 (KYB + empresa operacional p/ **publicação** PJ) · DECISION-0101 (cascata de revogação KYB sobre publicações) · DECISION-0088 §3.6 (KYB strict) · DECISION-0117 D (oferta de serviço: autoriza criação; **não** prescrevia ativação segura) · DECISION-0144 (elegibilidade declaração/publicação→service) · DECISION-0145 (vínculo service→offering; nasce draft) · DECISION-0113 (autoridade server-side).

---

## §0 — Natureza e contexto
`service_offering` nasce **draft** (DECISION-0145). A transição **draft→active** é o ato que torna a oferta **pública/contratável**. Hoje a ativação é **self-serve insegura**: `PUT /services/offerings/:id`→`updateOwnOffering` exige apenas `canRepresentActor(provider)`, aceita `status` livre do body (sem state-machine), e **não revalida** a elegibilidade (declaração/publicação ACTIVE só é checada na **criação**). A cascata de revogação de KYB (DECISION-0101) retira publicações + `tenant_concept_offerings` atomicamente, **mas não suspende** a `service_offering` já ativa → uma oferta pode permanecer contratável-direto após a base cair. Ativação ≠ patch mecânico: é **autoridade/produto**.

## §A — A RÉGUA (decisão soberana de Clayton, 2026-06-22 · Modelo A)

**Semântica canônica do status:**
- **`active`** = "esta oferta está **pública/contratável agora**, e suas pré-condições (autoridade · semântica · identidade institucional/profissional · elegibilidade operacional) estão **válidas neste momento**".
- **`draft`** = "existe como **preparação interna**; **não** aparece como contratável nem recebe booking".
- **`suspended`** = "já existiu/foi preparada, mas está **temporariamente impedida** de contratação".

**Q1 — Revalidação na ativação: SIM.** `draft→active` **revalida a elegibilidade no momento da ativação**, não só na criação. Criação prova que o provider podia *preparar*; ativação prova que a oferta pode virar *pública/contratável agora*.

**Q2 — KYB/KYC/operacional: SIM.**
- **Provider PJ/company:** publicação ativa do concept · **KYB aprovado** quando a empresa é o sujeito institucional · empresa **operacional** (regra vigente, 0100 D6) · provider **representável** server-side.
- **Provider PF:** **declaração profissional ativa** do concept · **identidade civil mínima/KYC-lite** quando materialmente disponível · **ausência de bloqueio ATL/trust** impeditivo · provider **representável** server-side.

**Q3 — offering active ↔ publicação: SIM.** offering `active` **exige base pública/semântica ativa**: `company_concept_publications` ACTIVE (PJ) **ou** `actor_professional_concepts` ACTIVE (PF). **NÃO** autorizado "offering active contratável-direto sem publicação". Oferta privada/direta/limitada futura = **nova decisão + novo estado/modo de visibilidade**, NUNCA reaproveitar `active`.

**Q4 — State-machine: SIM.** `status` **não é free-form do body**. Transições mínimas:
- `draft → active`: **somente** com o gate completo de ativação (Q1+Q2+Q3).
- `active → suspended`: pausa / perda de condição / ação do provider autorizado.
- `suspended → active`: **somente** com revalidação completa.
- `active → draft`: **não** é transição livre.
- `draft → suspended`: não é caminho normal (justificar se necessário).
- transição desconhecida → **fail-closed**.

**Q5 — Cascata: SIM.** Quando **KYB, publicação, declaração profissional, canonical service ou condição operacional** que sustentava a ativação for revogada/suspensa, as offerings `active` afetadas **são suspensas**. A cascata **não apaga** oferta/histórico e **não move dinheiro** — muda **estado operacional** para impedir contratação indevida. **Invariante:** *nenhuma offering fica `active` se a base que a autoriza caiu.*

## §B — Escopo
**ENTRA (nível decisório; execução sob GO próprio):** harden de `updateOwnOffering`/endpoint de ativação · state-machine de status · revalidação de elegibilidade em `draft→active` e `suspended→active` · garantir active-only em discovery/by-canonical (já vigente; reforçar) · suspender `service_offerings.status` quando a base cair (extensão da cascata 0101) · guard + negative-proof · E2E.
**FORA:** dinheiro · checkout · payment_request · payout · Bank/Core · ledger/splits · `docs/01_normative` · o modo "oferta privada/direta" (decisão futura). **Migration** só se a execução provar necessária (state-machine/cascata) **com STOP + GO**.

## §B-bis — Guards a materializar (insumo p/ execução; não-exaustivo)
G1. ativação **NUNCA** só por `canRepresentActor` — exige o gate completo (Q1+Q2+Q3). (NP: ativar só com canRep → guard/teste morde.)
G2. **state-machine** fail-closed — `status` não-livre do body; transição inválida/desconhecida → erro controlado. (NP: `active→draft` livre ou status arbitrário → morde.)
G3. **re-validação** em `draft→active` e `suspended→active` (publicação/declaração ACTIVE no momento). (NP: revogar publicação e ativar → bloqueia.)
G4. **PJ** = KYB-approved + operacional + publicação ACTIVE; **PF** = declaração ACTIVE + KYC-lite (se disponível) + sem ATL. (NP: PJ sem KYB ativa → morde.)
G5. **cascata** = base revogada → `service_offerings.status` active→suspended (sem apagar/dinheiro). (NP: revogar KYB e oferta seguir active → morde.)
G6. **active-only** em discovery/by-canonical permanece (draft/suspended não vazam).
G7. nenhum bypass de ativação (createOffer legado nascendo active; status no body de outra rota) — contido/fail-closed.

## §C — Execução (após promulgação, GO próprio)
**MODO B/C** (toca a transição de status + provável extensão da cascata; talvez migration p/ state-machine/índice). READ-FIRST de execução mapeia: onde plugar o gate completo; como herdar os gates de publicação (0100 D5/D6) sem duplicar; como estender a cascata 0101 para `service_offerings.status`; nível de KYC-lite do PF (se ausente, gate degrada fail-closed e registra). E2E: draft invisível · active visível · revogação suspende · booking só em active.

## §D — STOPs (vinculantes)
- **active = base viva**: nenhuma offering `active` sem elegibilidade revalidada (Q1) + gates (Q2/Q3).
- **status só por state-machine** (Q4), nunca livre do body.
- **cascata obrigatória** (Q5): base caiu → suspende; nunca apaga; nunca move dinheiro.
- **draft nunca contratável**; **contratável-direto-sem-publicação NÃO autorizado** (Q3) — modo próprio futuro.
- Nível de **KYC-lite do PF**: se a régua material não estiver definível do schema vivo na execução → **STOP_DECISION_REQUIRED** (não inventar).
- **Não** tocar dinheiro/checkout/payout/Bank/Core/ledger; migration só com STOP+GO.
- Análise/minuta = INSUMO; execução só sob GO pós-promulgação.

---

## Resumo seco
**`active` = público/contratável com elegibilidade VIVA (revalidada na ativação) · PJ herda KYB+operacional+publicação; PF = declaração+KYC-lite+sem-ATL · offering active EXIGE publicação/declaração ativa (sem contratável-direto agora) · status = state-machine fail-closed · base revogada SUSPENDE a oferta (cascata, sem apagar/dinheiro). Nenhuma offering fica active se a base que a autoriza caiu.**
