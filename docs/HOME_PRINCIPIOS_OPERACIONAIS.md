# Princípios Operacionais da Home Contextual

**Status:** referência de design + arquitetura · não é norma soberana (ver `docs/01_normative/`)
**Origem:** consolidação Clayton + Claude + ChatGPT (2026-05-13 a 2026-05-18)
**Memória vinculada:** `~/.claude/projects/C--unificard/memory/project_home_contextual_modelo_2026-05-18.md`

---

Este documento destila o modelo arquitetural da Home Contextual em regras curtas, consumíveis por Codex e por qualquer dev tocando frontend/UX da home. Cada regra tem causalidade material rastreável na memória vinculada.

**Critério de revisão:** uma regra pode ser questionada se uso real puxar. Não é dogma — é princípio com gatilho de revisão. Sem uso material puxando, regra permanece vinculante.

---

## Função objetivo

> **A home maximiza próximos movimentos coordenados sob causalidade rastreável, com viés a continuidade relacional.**

Não maximiza atenção. Não maximiza scroll. Não maximiza retenção opaca.

---

## As regras

### Causalidade

1. **Todo item da home declara por que apareceu.** Item sem causalidade legível ao usuário é violação. Algoritmo opaco é vetado.

2. **Toda peça do feed ancora em entidade material verificável.** Cada item aponta para registro real (`event`, `rsvp`, `escrow`, `transaction`, `os`, `group`, `invite`). Conteúdo solto sem âncora não entra.

### Composição

3. **Home não é cronológica pura.** Tempo importa mas não governa sozinho.

4. **Feed é composto de 6 vetores com peso explícito:** Compromisso, Convite, Recorrência, Oportunidade, Descoberta, Momento. Cada item declara seu vetor visivelmente (badge).

5. **Cada vetor tem temperatura técnica** (quente / morna / fria) que determina infra (realtime / polling / cache longo).

### Layout

6. **Home tem 3 zonas:** AGORA (topo, 1-3 itens, quente) · PRÓXIMOS MOVIMENTOS (centro, 5-7 itens, morna) · DESCOBERTA VIVA (fim, scroll com limite suave).

7. **Não existe scroll infinito.** Mesmo com causalidade em cada item, há ponto natural de parada. Após ~20-30 itens da zona Descoberta: "Você viu o que era relevante. Pode voltar quando quiser."

### Soberania vs projeção

8. **Mode (Consumir/Operar) reorganiza prioridade, NÃO altera soberania.** Modo não cria capability, não muda ledger, não infere autoridade.

9. **Contexto reorganiza descoberta, NÃO altera causalidade econômica.** Contexto não vira "modo namoro / modo viagem". É filtro de feed, não tela própria.

10. **Relação emerge de comportamento, NÃO de declaração.** Sem "adicionar amigo" estilo Facebook. Coordenação histórica vira sinal; declaração explícita complementa, não substitui.

### Densidade

11. **Solo entrega valor completo.** Sistema funciona com 1 usuário: agenda + financeiro + ERP pessoal + marketplace consumer.

12. **Microdensidade é o vetor de crescimento.** 5 pessoas + 1 grupo + 1 condomínio + 1 banda + 1 atlética já geram vida suficiente. Não viralização nacional difusa.

13. **Célula tem precedência sobre geografia.** Atividade do seu grupo/condomínio aparece antes de atividade do bairro.

14. **Sistema degrada graciosamente em 4 estados:** Solo / Célula / Bairro / Ecossistema. Em cada estado, vetores vazios são cobertos por outros. Home nunca aparece morta.

### Temporalidade

15. **Oportunidade sem ação expira.** Items têm validade temporal explícita; ao expirar, somem.

16. **Compromisso vencendo tem precedência sobre descoberta.** Descoberta nunca interrompe ação que vence.

### Privacidade e poder

17. **Privacidade por default.** Perfil derivado e relação são privados. Exposição requer opt-in granular (com quem, em que contexto, por quanto tempo).

18. **Soberania cognitiva.** Usuário sempre pode auditar por que algo apareceu, qual vetor acionou, qual escopo originou, qual a validade temporal.

### UX

19. **Vocabulário arquitetural NÃO vaza para a UI.** "Actor", "mode", "contexto situacional", "businessProfile", "vetor" são vocabulário interno. Usuário lê "Atuando como", "Consumindo", "Operando", "Sua banda hoje", "Perto de você".

20. **Retomada > consumo.** Métrica saudável é "valeu a pena voltar?", não "ficou online?".

### IA

21. **IA serve para reduzir atrito de coordenação.** Não para prender atenção, gerar conteúdo viral, ou maximizar scroll.

22. **IA opaca é vetada.** Inferência só onde uso material justifica, sempre auditável, sempre validável pelo usuário.

### Métricas

23. **KPIs convencionais (DAU/MAU/CTR/tempo de sessão) são anti-KPIs.** Métricas core: recorrência de coordenação por par actor-actor, profundidade de vínculo, densidade da célula ativa, resolução de coordenação.

### Anti-padrões

24. **Gamificação ostensiva é vetada.** Pontos/badges/streaks instituem comportamento por dopamina superficial. Coordenação real é a recompensa.

25. **FOMO manufaturado é vetado.** "Últimas vagas!" sem fonte material rastreável = violação. Toda urgência tem ancoragem verificável.

---

## Anti-padrões P4 — explicitamente vetados (talvez nunca)

- Feed infinito (mesmo causal)
- Algoritmo opaco
- Amizade declarativa
- Microfrontend / app builder
- Engine de capability complexa no frontend
- Notificação push compulsiva
- Vigilância sem opt-in granular
- Reputação pública agressiva (até maturação institucional)
- IA generativa onipresente

---

## Para Codex e devs futuros

Antes de adicionar elemento à home, responder:
1. Que vetor (dos 6) ele representa?
2. Qual a causalidade legível ao usuário?
3. Que entidade material ele ancora?
4. Que temperatura técnica tem?
5. Em qual zona (AGORA / PRÓXIMOS / DESCOBERTA) vai?
6. Em quais estados de densidade (Solo/Célula/Bairro/Ecossistema) faz sentido?
7. Como degrada se vetor estiver vazio?

Se você não consegue responder qualquer uma dessas 7, **não adicione ainda**. Volte ao modelo vinculado e revise.

---

## Critério para adicionar nova regra

Toda proposta de nova regra (ou modificação de regra existente) deve passar simultaneamente em:

1. **Causalidade material única** — governa runtime que nenhuma outra regra governa
2. **SSOT inevitável OU implicação técnica concreta** — não é só metáfora
3. **Comportamento reproduzível** — produz efeito que pode ser observado em uso real

Sem os 3 critérios, a proposta é **estética**, não princípio. Não entra.

---

## Histórico

Documento consolidado em 2026-05-18 após 6 turnos de modelagem conjunta (Clayton + Claude + ChatGPT). Próxima revisão programada: após pelo menos 1 item de P1 do roadmap material mergeado, OU quando causalidade material nova surgir.
