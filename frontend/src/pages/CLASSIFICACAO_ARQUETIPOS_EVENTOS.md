# CLASSIFICAÇÃO DE ARQUÉTIPOS - MÓDULO EVENTOS

Status: CANÔNICO — CLASSIFICAÇÃO INSTITUCIONAL  
Data: 2024  
Escopo: Módulo Eventos — Frontend

---

## CLASSIFICAÇÃO OBRIGATÓRIA

### EventCreationPage.tsx
**Arquétipo:** Entity Declaration / Creation Page

**Justificativa:**
- Permite criação e edição de rascunhos
- Nenhum wizard obrigatório
- Nenhuma validação decisória
- Declaração progressiva de intenção

**Conformidade:** ✅

---

### EventDetailPage.tsx
**Arquétipo:** Entity Detail Page

**Justificativa:**
- Visualização focada em UMA entidade (evento)
- Read-model puro
- Pode conter CTA explícito (ex: Publicar)
- Não executa decisão automaticamente

**Conformidade:** ✅

---

### EventosPage.tsx
**Arquétipo:** Entity Listing Page

**Justificativa:**
- Listagem homogênea de entidades (eventos)
- Comparação visual
- Navegação
- Zero decisão

**Conformidade:** ✅

---

### MeusCompromissosPage.tsx
**Arquétipo:** Draft / Management Page (provisório)

**Justificativa:**
- Status informativo
- Histórico
- Decisões sempre explícitas
- Gestão de compromissos

**Conformidade:** ✅ (provisório)

---

## OBSERVAÇÕES

Esta classificação é OBRIGATÓRIA e deve ser respeitada em todas as refatorações.

Qualquer alteração que viole os arquétipos canônicos é INSTITUCIONALMENTE INVÁLIDA.

