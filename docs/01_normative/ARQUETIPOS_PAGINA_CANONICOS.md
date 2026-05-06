# ARQUETIPOS_PAGINA_CANONICOS.md

Status: NON-NORMATIVE  
Autoridade: DERIVADA de PADRAO_FRONTEND_CANONICO.md  
Nível hierárquico: IGUAL ao PADRAO_FRONTEND_CANONICO.md  
Escopo: Frontend institucional do UnifiCard

---

## FINALIDADE

Este documento organiza, classifica e explicita os **ARQUÉTIPOS CANÔNICOS DE PÁGINA** permitidos no frontend do UnifiCard.

Ele:
- NÃO cria regras de negócio
- NÃO cria decisões
- NÃO altera o Core
- NÃO substitui checklists existentes

Ele existe para:
- eliminar duplicação estrutural
- impedir páginas ad-hoc
- garantir identidade consistente por módulo
- reduzir ambiguidade institucional

---

## PRINCÍPIO FUNDAMENTAL

> O frontend do UnifiCard não cria páginas livremente.  
> Ele compõe **contextos diferentes** sobre um **conjunto fixo de arquétipos**.

Arquétipos são **classificações estruturais**, não fluxos.

---

## LISTA OFICIAL DE ARQUÉTIPOS

### 1️⃣ Home / Discovery Page
Página de entrada, descoberta e navegação inicial.

- Pode atuar como Feed (Golden Path)
- Contém múltiplos blocos independentes
- Não decide nada
- Não valida nada

---

### 2️⃣ Category / Collection Page
Página de organização visual por categoria.

- Categorias são descritivas
- Nunca influenciam regra, permissão ou fluxo
- Apenas navegação e leitura

---

### 3️⃣ Entity Listing Page
Listagem homogênea de entidades.

- Comparação visual
- Navegação
- Zero decisão

---

### 4️⃣ Entity Detail Page
Visualização focada em UMA entidade.

- Read-model puro
- Pode conter CTA explícito
- Não executa decisão automaticamente

---

### 5️⃣ Action / Checkout Page
Página de decisão humana explícita.

- Confirmação consciente
- Impacto visível
- Nenhuma decisão implícita

---

### 6️⃣ Entity Declaration / Creation Page
Página de declaração progressiva de intenção.

- Criação e edição de rascunhos
- Nenhum wizard obrigatório
- Nenhuma validação decisória

---

### 7️⃣ Draft / Management Page
Página de acompanhamento e gestão.

- Status informativo
- Histórico
- Decisões sempre explícitas

---

## IDENTIDADE POR MÓDULO

Identidade visual por módulo (marketplace, food, mobility, eventos) ocorre APENAS via:
- layout
- ordem de blocos
- tom comunicacional
- hierarquia visual

Nunca via:
- lógica
- regra
- decisão
- permissão
- priorização algorítmica

---

## RELAÇÃO COM CHECKLISTS

- Este documento NÃO substitui:
  - CHECKLIST_PRE_FRONTEND_OBRIGATORIO.md
- Todo frontend continua obrigado a:
  - executar checklist
  - passar por anti-duplicação

---

## PÁGINAS EXISTENTES

Páginas existentes devem ser:
1. Classificadas em um arquétipo existente, ou
2. Avaliadas via CHECK_DUPLICIDADE_OBRIGATORIO.md

Nenhuma página é revogada automaticamente.

---

## REGRA FINAL

> Qualquer página que não possa ser classificada em um arquétipo canônico
> é institucionalmente inválida até decisão humana explícita.

---

FIM DO DOCUMENTO

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
_nenhuma referência explícita_

### Referenciado por
- 00_INDEX.md
<!-- AUTO-GENERATED-END -->