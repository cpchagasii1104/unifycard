Status: CORE
Domain: Temporal
Governing Contract: CORE_IMUTAVEL.md
Authority Level: 1
Canonical Scope: Temporal Governance

# CORE_TEMPORAL_CONTRACT.md
## Contrato Fundacional — Governança Temporal do UnifiCard

Este documento define a **governança temporal fundacional** do UnifiCard.

Ele estabelece **quem manda no tempo**, **o que é tempo no sistema** e **como contratos temporais se organizam**.

Qualquer contrato, módulo, decisão ou implementação que toque tempo **DEVE** obedecer este documento.

---

## 1) Escopo do Contrato

Este contrato governa **todo e qualquer conceito temporal**, incluindo, mas não se limitando a:

- tempo e data
- agenda e disponibilidade
- duração, janelas e recorrência
- conflitos temporais
- bloqueios e reservas
- RSVP com efeito temporal
- sincronização temporal externa
- projeções temporais e read-models

📌 Este contrato **não implementa** tempo.  
Ele **define autoridade e organização** do domínio temporal.

---

## 2) Hierarquia Canônica

A hierarquia temporal é **fixa e não-negociável**:

CORE_IMUTAVEL.md
└── CORE_TEMPORAL_CONTRACT.md
└── AGENDA_UNIVERSAL_CONTRACT.md

yaml
Copiar código

- `CORE_IMUTAVEL.md` define estruturas não duplicáveis
- Este contrato define a **governança temporal**
- `AGENDA_UNIVERSAL_CONTRACT.md` define a **implementação canônica do tempo**

Nenhum outro documento pode governar tempo fora dessa árvore.

---

## 3) Fonte Única de Verdade Temporal

Regra absoluta:

> **Existe UMA e somente UMA fonte canônica de verdade temporal no UnifiCard.**

Essa fonte é definida no contrato subordinado:

- `AGENDA_UNIVERSAL_CONTRACT.md`

Qualquer outro artefato temporal é, por definição:
- derivado
- projetado
- informativo
- não-decisório

---

## 4) Proibição de Governança Paralela

É proibido que qualquer módulo, contrato ou domínio:

- crie regra temporal própria
- resolva conflitos de tempo
- bloqueie ou reserve tempo
- decida precedência temporal
- “corrija” ou “otimize” tempo

Se um comportamento toca tempo e **não passa pela Agenda Universal**, ele é inválido.

---

## 5) Separação de Responsabilidades (Obrigatória)

### Este contrato:
- define autoridade
- define hierarquia
- define limites

### A Agenda Universal:
- registra
- bloqueia
- resolve conflitos
- persiste tempo

### Outros domínios (Eventos, Serviços, Profissionais, etc.):
- **declaram intenção temporal**
- **consultam tempo em modo read-only**
- **nunca governam tempo**

---

## 6) Decisão Safety aplicada ao tempo

No domínio temporal, o sistema:

### ❌ Não pode
- decidir horários automaticamente
- resolver conflitos por heurística
- criar bloqueios sem ação explícita
- executar otimizações temporais

### ✅ Pode
- sugerir horários (não vinculantes)
- alertar conflitos
- simular cenários sem executar

---

## 7) Validade e Aplicação

Este contrato é:

- **normativo**
- **fundacional**
- **não substituível**
- **não opcional**

Se houver conflito entre:
- código
- documentação
- decisões
- comportamento do sistema

👉 **Este contrato prevalece.**

---

## 8) Checklist de Conformidade Temporal

Antes de aprovar qualquer mudança que toque tempo:

- [ ] Este contrato foi citado?
- [ ] A Agenda Universal foi respeitada?
- [ ] Não há core temporal paralelo?
- [ ] Não há decisão automática?
- [ ] A separação de domínio foi mantida?

Se alguma resposta for “não” → **bloquear**.

---

## 9) Frase Canônica Final

No UnifiCard:

> **Tempo é governado.  
> Governança não se negocia.**