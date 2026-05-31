# VISÃO — Perfil Contextual por Actor

**Trilho:** UnifiCard original · âncora `b1e48f99`
**Natureza:** documento de direção. Não cria schema, não decide substrato, não libera código.
**Função:** lembrança e foco — o *porquê* por trás de cada etapa.

---

## A tese

> **Perfil coleta. SSOT guarda. Actor molda a superfície.**

O perfil não é uma gaveta de cadastro. É uma porta organizada por actor e por aba. Cada aba coleta dados; o destino de cada dado é o substrato (SSOT) do domínio certo.

O sistema é único. Nenhuma camada cria realidade paralela. O perfil é projeção e porta — nunca fonte de verdade.

---

## C1 profissional é a primeira fatia, não o destino

O substrato profissional declarativo — `actor_professional_profiles` + `actor_professional_concepts` — e sua camada de serviço/API são a **primeira fatia específica** do modelo de perfil contextual por actor.

"Perfil profissional" não é o sistema inteiro nem o produto final. É uma peça de uma estratégia maior. Cada etapa que vier pela frente serve a este desenho — não o contrário.

---

## A ordem do MVP (sequência inviolável)

1. **O perfil adapta abas e campos conforme o actor ativo.** Pessoa física, empresa, grupo, prestador, loja, organizador, comunidade — cada um com dados próprios. A superfície muda com o actor.

2. **Cada informação preenchida vai para o SSOT correto do domínio.** Identidade, profissional, semântica (CONCEPT), temporal, empresa. Nunca para um "SSOT de perfil".

3. **O perfil não vira gaveta universal nem SSOT paralelo.** Ele coleta e projeta; não armazena verdade própria.

4. **Os módulos se conectam às verdades por actor / contexto / CONCEPT / capability / authority.** Pelos pontos canônicos — não por improviso de frontend.

5. **O financeiro só entra depois do contexto correto, com E2E específico.** Plugar financeiro antes do contexto é dinheiro andando em trilho errado.

---

## O resolver de contexto por actor é frente futura própria

A camada que responde *"para este actor, quais abas, contextos e capacidades fazem sentido?"* é uma frente **separada**. Exige diagnóstico read-only e contrato ratificado **antes** de qualquer código — o mesmo rito que o Contrato A1 seguiu. Não faz parte de A2. Não é decidida aqui.

---

## Proibições de direção

- **Proibido** resolver actor ou contexto por `display_name`, slug ou keyword. Identidade e contexto vêm de fact / SSOT / backend (actor_type estrutural + CONCEPT + capability + modo) — nunca de string.
- Este documento **não cria schema novo**.
- **Não decide** `actor_personal_profiles`, `actor_self_facts` nem qualquer substrato futuro. Cada um, quando proposto, exige READ-FIRST próprio (existe? colide? qual a FK de actor?) antes de migration.
- **Não reabre** o `DESENHO_A2_C1_SERVICE_API.md` já committado. Esta visão é o norte sob o qual A2 é a primeira peça; não altera A2.
- **Não libera** A2-código.
- Trilho único: UnifiCard original. O laboratório Genesis/Go é bancada de comparação e aprendizado, **isolado** — sem cruzar decisão, schema ou prompt.

---

## Lugar na hierarquia

Subordinado a: Constituição → Leis Operacionais → SSOT Registry → ordem causal (SEMÂNTICA → IDENTIDADE → AUTORIDADE → TEMPO → ESTADO → FINANCEIRO → EVENTO) → Contrato A1.

Em conflito, prevalece a norma de maior precedência. Esta visão não derroga nenhuma. É norte, não lei.

---

## O que este documento não é

Não é desenho de implementação. Não é decisão de schema. Não é autorização de código. Não é roadmap datado.

É a declaração de direção que impede tratar "perfil profissional" como o sistema inteiro — e que mantém cada etapa futura ligada ao motivo de existir.

---

*Cada etapa passa por algo. Este documento é o lembrete de por quê.*
