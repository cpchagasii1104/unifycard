# PLANO DE ZERAGEM DAS DÍVIDAS TÉCNICAS — auditoria profunda 2026-07-06

> **Base:** varredura 100% do `REMEDIATION_DT_LOG.md` (15.826 linhas, 624 entradas, ~522 DTs distintas)
> + `MAPA_DE_FECHAMENTO.md` + `READINESS_PORTA1.md` + memória das Ondas 1–3 (2026-07-05).
> **HEAD:** `945cc466a` · branch `rescue-structural`.
> **Regra vinculante:** verdade está no backend; git history antes de rotular "falso"; read-first antes de fix.

---

## 1. ESTADO VALIDADO (inventário fresco)

| Métrica | Valor |
|---|---|
| DTs distintas no cartório | ~522 |
| CLOSED (todas as variantes) | ~302 |
| **ABERTAS (OPEN/PARTIAL/DEFERRED/PENDING)** | **~168** |
| CONTIDAS/MITIGADAS (não-CLOSED, latência viva) | ~50 |
| Headers mentindo OPEN (já fechadas em outra entrada) | ~10–15 |
| Typecheck backend | **NÃO limpo** (TS18047 `req.tenant` possibly-null; total não medido) |

**A verdade estrutural (confirmada 3× nas Ondas 1–3):** os buckets executáveis sem decisão
(C_CLEANUP e D_FIX) foram **ESGOTADOS** em 2026-07-05. As ~168 abertas restantes são, em
essência: **decisão soberana de Clayton** (~70), **dinheiro/PORTA-1 em HOLD** (~35),
**bloqueadas por outra frente** (~15), **latentes/doutrina "não construir agora"** (~26),
mais a cauda contida/mitigada (~50) que só fecha quando cada frente-mãe abrir.

**Tradução:** não existe mais "zerar dívidas" por execução autônoma. Zerar daqui pra frente
= **decidir em lotes + executar o que cada lote destravar**. Este plano organiza exatamente isso.

---

## 2. AS 5 ONDAS DO PLANO

### ONDA 4 — Higiene cartorial (AUTÔNOMA, barata, imediata)
Zero código. Só carimbos no cartório, corrigindo o que a auditoria achou:

1. Re-carimbar os headers que mentem OPEN (fechadas em outra entrada): `DT-PE5-PF-RESOLVER-PENDING`,
   `DT-MEMBERSHIP-MIGRATIONS-INTERROMPIDAS`, `DT-PJ-TABS-BANK-READS-MASK-ERRORS`, `F-PAYOUT-TOCTOU`.
2. Corrigir o falso-negativo da ONDA 0: `DT-event-reservations-mixed-case` (L2407, minúsculas)
   existe — carimbar como absorvida por `DT-DRIFT-STATUS-CASE-SYSTEMIC`.
3. Resolver os pares parent/filha com dupla contagem (STORAGE-PROVIDER, MALWARE-SCAN,
   PROFILE-GET×READ-PATH, RECOVERY-PAYOUT×EXTERNAL-SETTLEMENT, IDENTITY-TRIAD 2 entradas):
   carimbar o parent como GOVERNED/SUPERSEDED apontando pra filha viva.
4. Re-carimbar a renomeada `DT-COMPANIES-METADATA-COLUMN-MISSING` → `DT-ONBOARDING-METADATA-STORAGE-DECISION`.
5. Verificar e fechar `DT-PUBLIC-PROFILES-NO-FRONTEND-CONSUMER` (superada pela frente
   Visibilidade 2026-07-03 — confirmar no código antes, git history incluso).
6. Dar header próprio às 2 dívidas rastreadas só por texto (organizer-billing SaaS-vs-split;
   organizers remainder) ou carimbar como absorvidas.
7. Carimbar `F-DEV-DATA-CLEAN-RESET` (aguardando aprovação desde 2026-05-28, obsoleta).

**Efeito:** ~10–15 abertas a menos SEM tocar código. Cartório volta a dizer a verdade.
**Custo:** 1 sessão curta. **Risco:** zero (docs-only, com verificação read-first de cada carimbo).

### ONDA 5 — Typecheck limpo (AUTÔNOMA, engenharia pura)
`npx tsc --noEmit` no backend NÃO está limpo (família TS18047). Medir o total, triar:
erros mecânicos (null-guard de `req.tenant` que o runtime já garante via plugin) = fix
autônomo; erros que revelam bug real = DT nova ou fix imediato conforme gravidade.
**Critério de pronto:** `tsc --noEmit` = 0 erros, wired como gate (se ainda não for).
**Risco:** baixo. Nenhuma mudança de comportamento sem prova.

### ONDA 6 — PACOTE DE DECISÕES EM 6 LOTES (Clayton decide; eu preparo cada lote)
As ~70 A_DECISION não podem ser decididas uma-a-uma (fadiga garante paralisia).
Agrupo em **6 lotes temáticos**, cada um vira UM documento de 1 página com:
contexto mínimo · opções (2–3 por item) · recomendação da executora · custo de cada opção.
Clayton decide o lote inteiro numa sentada.

| Lote | Tema | ~DTs | O que destrava |
|---|---|---|---|
| **L1** | **PORTA-1 / dinheiro** (ver Onda 7) | ~35 | operação econômica real |
| **L2** | **R2 Delegação + risco PJ** (authorized links, anti-laranja, credential-sharing) | ~12 | PJ multi-pessoa, procuração, antifraude — desenho R2 JÁ EXISTE (arquivado, revalidar) |
| **L3** | **Catálogo/serviços/marketplace** (seed catálogo, sinônimos, curadoria headless, W2 produto actor-first, hybrid anti-pattern, pricing drift) | ~15 | descoberta útil, 2º provider, verticais |
| **L4** | **Social/feed/votes** (follow mechanics, feed post-id drift, mídia hidratação, CTAs zumbi, votes eligibility, post-visibility-on-read) | ~10 | Fase 2 da descoberta, rede social viva |
| **L5** | **Módulos frozen/fantasma — ratificar destino** (presence, venue, work-instant, policy-engine, organizers unmounted, health 501, 8 órfãos) | ~10 | ou morre com tombstone+guard, ou ganha frente nomeada — sai do limbo |
| **L6** | **Identidade/nascimento C1** (0115 D1/D2, tríade CPF F4/F5, tenant-por-signup, pilot_invites, actor institucional, metadata storage) | ~8 | onboarding real de gente de verdade |

**Ordem recomendada dos lotes: L5 → L3 → L4 → L6 → L2 → L1.**
Racional: L5 é o mais barato (ratificações, quase tudo já tem recomendação); L3/L4 destravam
produto visível sem dinheiro; L6 prepara o chão de gente; L2 prepara o chão de autoridade PJ;
L1 (dinheiro) por último, deliberadamente — é o evento de maior risco e a doutrina já diz
que não abre sem as facas fechadas.

### ONDA 7 — PORTA-1 DECISION PACK (evento único, soberano)
Já mapeado em `READINESS_PORTA1.md`. Sequência interna (imutável):
1. **Decidir modelo de aprovação** (Core 0128 mínimo vivo VS ratificar caminho MVP).
2. **Firewall DENTRO do sink** (`executePayment` + `createTransactionWithSplit` + `transfer`),
   default-OFF — mata V3 + P2P (YALA #3) + os ≥8 callers de uma vez. Catraca no sink, não na borda.
3. **Decidir split** (materializar motor VS MVP pagamento-direto).
4. **Semear saldo** só depois de 1–2 fechados, com E2E de dinheiro ephemeral.
5. Re-verificar /cta + resíduos 0113 sob Core ligado.

**Bloqueador nomeado:** `POST /bank/p2p-transfer` vivo sem firewall (contido só por ledger vazio).
**Nada disto executa sem GO explícito de Clayton.**

### ONDA 8 — DRENAGEM PÓS-DECISÃO (execução contínua)
Cada lote decidido vira fila de execução com a disciplina de sempre:
read-first → fix/guard → prova negativa → E2E quando aplicável → cartório → commit próprio →
selo Yala nos sensíveis. As ~50 contidas/mitigadas fecham naturalmente aqui, cada uma quando
sua frente-mãe abrir (ex.: PDV-F2 binding fecha na frente PDV; service-release-timeout fecha
na frente de runtime de serviço).

---

## 3. O QUE EU POSSO COMEÇAR AGORA SEM VOCÊ (recomendação)

1. **Onda 4 inteira** (higiene cartorial) — hoje.
2. **Onda 5** (typecheck) — na sequência.
3. **Preparar o Lote L5** (frozen/fantasma) — é o lote mais barato de decidir; te entrego
   o documento de 1 página pra você bater o martelo.

Com isso o número real de abertas cai pra ~150 sem risco, e a máquina de decisão começa a girar.

---

## 4. DISCIPLINAS (herdadas, vinculantes)

- PJ, grupo, Bank e marketplace **nunca** na mesma execução.
- Money/grupo/split/payout só com **três paralelas** + E2E fail-first.
- SQL a `bank_*` só dentro de `backend/src/modules/bank/`.
- Nada é "fechado" sem prova material (CONFIRMADO/PROVÁVEL/PENDENTE/BLOQUEADO).
- Reconfirmar HEAD/migrations no início de cada fatia.
- Fim de cada sessão: reportar DTs resolvidas na sessão + restantes no total.
- Convenção nova (proposta, a ratificar): **fechamento de DT só vale com re-carimbo no header** —
  as 4 formas atuais de fechar geraram os ~10–15 headers mentirosos.

---

*Plano montado pela executora em 2026-07-06 sob auditoria de 2 agentes (inventário 100% do
cartório + contexto/guards/typecheck). A sequência dos lotes é recomendação; a mão que move é de Clayton.*
