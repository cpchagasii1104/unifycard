# FASE 5 — WIZARD ORQUESTRATOR CONTRACT

**Arquivo:** FASE_5_WIZARD_ORQUESTRATOR_CONTRACT.md  
**Fase:** FASE 5 — Event Creation  
**Status:** ATIVO  
**Autoridade:** GOVERNANÇA DE FRONT-END  
**Caráter:** CONTRATUAL · NÃO EXECUTÁVEL · NÃO DECISÓRIO  

---

## 1. OBJETIVO DESTE DOCUMENTO

Este documento define o **contrato institucional do Wizard padrão** utilizado
na FASE 5 para criação e edição de eventos.

O Wizard atua **exclusivamente como ORQUESTRADOR DE PÁGINAS**,
sendo completamente **agnóstico ao tipo de evento**.

Ele **não contém lógica de domínio**, **não conhece regras de negócio**
e **não toma decisões**.

---

## 2. DEFINIÇÃO CANÔNICA

> O Wizard da FASE 5 é um **orquestrador genérico de fluxo**, responsável apenas por:
>
> - navegação entre páginas
> - controle de progresso
> - persistência incremental
> - fechamento explícito do EventSpec
>
> Toda lógica de domínio reside nas **páginas plugadas**, nunca no Wizard.

---

## 3. RESPONSABILIDADES DO WIZARD (O QUE ELE FAZ)

O Wizard padrão **DEVE**:

1. Controlar a navegação:
   - próximo
   - anterior
   - salvar rascunho
   - finalizar

2. Gerenciar o estado de fluxo:
   - etapa atual
   - total de etapas
   - progresso visual

3. Orquestrar páginas dinamicamente:
   - carregar páginas com base em `event_type`
   - respeitar a ordem definida pelo Page Registry

4. Persistir dados:
   - salvar incrementalmente em `event_specs.answers`
   - nunca normalizar dados
   - nunca inferir campos ausentes

5. Executar o fechamento do EventSpec:
   - somente mediante ação humana explícita
   - no botão final do fluxo

---

## 4. PROIBIÇÕES ABSOLUTAS (O QUE O WIZARD NÃO PODE FAZER)

O Wizard **NUNCA** pode:

- interpretar `event_type`
- criar regras condicionais de domínio
- decidir quais campos são obrigatórios
- inferir serviços, fornecedores ou preços
- validar lógica de negócio
- alterar `EventDeclaration`
- criar ou alterar `Event`
- criar novos `EventSpec`
- decidir transição de fase do Event

Qualquer violação deste bloco é considerada **quebra de contrato institucional**.

---

## 5. RELAÇÃO COM EVENT TYPE

- O Wizard **não conhece** semântica de `event_type`
- Ele apenas solicita ao **Page Registry** quais páginas devem ser renderizadas

Exemplo conceitual:

```ts
pages = WizardPageRegistry.get(event.event_type)
O Wizard não valida se o event_type é permitido.
Essa validação pertence exclusivamente ao backend.

6. RELAÇÃO COM AS PÁGINAS (STEPS)
Cada página do Wizard:

é uma unidade isolada

conhece apenas:

seu próprio escopo

o EventSpec

não conhece páginas anteriores ou futuras

não controla navegação global

O Wizard:

injeta contexto

coleta dados

controla o fluxo

7. MODELO DE INTERAÇÃO WIZARD ↔ PÁGINA
Interface conceitual:

ts
Copiar código
interface WizardPage {
  render(props: {
    eventId: string
    eventSpec: EventSpec
    onChange: (partialSpec) => void
  })
}
O Wizard:

não interpreta partialSpec

apenas persiste o que recebe

8. PERSISTÊNCIA DE DADOS
Todos os dados coletados pelo Wizard:

são persistidos em event_specs.answers

Persistência é:

incremental

tolerante a campos ausentes

sem validação de domínio no front-end

9. FECHAMENTO DO EVENTSPEC
O Wizard executa o fechamento do EventSpec quando:

o usuário clica em “Salvar planejamento”

o backend confirma a persistência final

Após esse momento:

o EventSpec torna-se imutável

qualquer alteração futura exige novo snapshot

o Wizard não pode reabrir um EventSpec fechado

10. FUNDAMENTO INSTITUCIONAL
Este contrato está alinhado com:

MATRIZ_FONTES_DE_VERDADE.md

Database_Canonical_Truth_Contract.md

CORE_IMUTAVEL.md

Decision_Safety_and_Containment_Contract.md

11. REGRA FINAL
O Wizard orquestra.
As páginas declaram.
O backend valida.

Qualquer mistura dessas responsabilidades
compromete a escalabilidade e a governança do sistema.