# FASE 5 — WIZARD PAGE REGISTRY

**Arquivo:** FASE_5_WIZARD_PAGE_REGISTRY.md  
**Fase:** FASE 5 — Event Creation  
**Status:** ATIVO  
**Autoridade:** GOVERNANÇA DE FRONT-END  
**Caráter:** CONTRATUAL · NÃO EXECUTÁVEL · NÃO DECISÓRIO  

---

## 1. OBJETIVO DESTE DOCUMENTO

Este documento define o **Page Registry** do Wizard da FASE 5.

O Page Registry é o **mecanismo institucional** responsável por:
- declarar **quais páginas** compõem o formulário
- definir a **ordem das páginas**
- associar páginas a um `event_type`

O Page Registry **não executa lógica**, **não toma decisões**
e **não interpreta dados**.

Ele apenas **declara estrutura**.

---

## 2. DEFINIÇÃO CANÔNICA

> O Page Registry é uma **tabela declarativa de composição**
> que mapeia `event_type` → lista ordenada de páginas do Wizard.

Ele é:
- determinístico
- estático por versão
- auditável
- livre de lógica condicional

---

## 3. RESPONSABILIDADES DO PAGE REGISTRY

O Page Registry **DEVE**:

1. Declarar a composição do Wizard por tipo de evento
2. Definir a ordem exata das páginas
3. Permitir reutilização de páginas comuns
4. Ser a **única fonte de verdade** sobre quais páginas existem no fluxo

---

## 4. PROIBIÇÕES ABSOLUTAS

O Page Registry **NUNCA** pode:

- conter lógica de negócio
- conter if/else baseados em respostas do usuário
- decidir obrigatoriedade de campos
- inferir necessidades
- criar ou remover páginas dinamicamente
- acessar dados do EventSpec
- executar código assíncrono

Qualquer violação transforma o Registry em motor de regra,
o que é **proibido institucionalmente**.

---

## 5. RELAÇÃO COM O WIZARD ORQUESTRATOR

- O Wizard:
  - consulta o Page Registry
  - renderiza páginas na ordem definida
- O Wizard:
  - NÃO altera o Registry
  - NÃO interpreta seu conteúdo

Fluxo conceitual:

```ts
pages = WizardPageRegistry.get(event.event_type)
Se um event_type não estiver registrado:

o Wizard não tenta inferir

o backend deve bloquear a edição

6. ESTRUTURA CONCEITUAL DO REGISTRY
Interface conceitual:

ts
Copiar código
type EventType = string

interface WizardPageDefinition {
  id: string
  component: string
}

interface WizardPageRegistry {
  [eventType: EventType]: WizardPageDefinition[]
}
O Registry contém apenas:

identificadores

referências a componentes

ordem explícita

Nada além disso.

7. PÁGINAS COMUNS (REUTILIZÁVEIS)
Páginas comuns podem ser utilizadas por múltiplos tipos de evento.

Exemplos:

ProjectName

Finalization

TimeWindow

Essas páginas:

seguem o mesmo contrato de WizardPage

não conhecem o tipo de evento

não alteram comportamento com base em event_type

8. REGISTRO DE PÁGINAS — FESTA DE ANIVERSÁRIO
Event Type
nginx
Copiar código
BIRTHDAY
Ordem canônica das páginas
ts
Copiar código
[
  { id: "project_name", component: "CommonProjectNamePage" },
  { id: "birthday_profile", component: "BirthdayProfilePage" },
  { id: "attendance", component: "BirthdayAttendancePage" },
  { id: "location", component: "BirthdayLocationPage" },
  { id: "style_theme", component: "BirthdayStyleThemePage" },
  { id: "activities", component: "BirthdayActivitiesPage" },
  { id: "music_av", component: "BirthdayMusicAVPage" },
  { id: "support_services", component: "BirthdaySupportServicesPage" },
  { id: "time_window", component: "BirthdayTimeWindowPage" },
  { id: "finalize", component: "CommonFinalizePage" }
]
Essa ordem:

é fixa para esta versão

reflete exatamente o Form Flow da FASE 5

não pode ser alterada em runtime

9. VERSIONAMENTO
Qualquer alteração no Page Registry:

cria uma nova versão do documento

não afeta eventos já em andamento

Eventos existentes continuam usando:

a versão do Registry vigente no momento da criação

10. FUNDAMENTO INSTITUCIONAL
Este documento está alinhado com:

FASE_5_WIZARD_ORQUESTRATOR_CONTRACT.md

MATRIZ_FONTES_DE_VERDADE.md

CORE_IMUTAVEL.md

CHECK_DUPLICIDADE_OBRIGATORIO.md

11. REGRA FINAL
O Wizard executa.
O Registry declara.
As páginas especializam.

Se o Registry decidir,
o sistema perdeu governança.