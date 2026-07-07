# DECISION-0163 — Propósito de grupo (eixo governado, ANTES da categoria)

**Status:** 🟡 PROPOSTA (aguarda ratificação de Clayton; NADA codado)
**Data:** 2026-07-07 · **Origem:** Clayton, testando o wizard de grupo: "um grupo que cuida de
animais, deficientes, pessoas de rua tem propósito diferente de uma torcida organizada, igreja,
moto clube — na busca, antes da categoria, a gente podia pensar no propósito".

## 1. Enquadramento ontológico (por que NÃO é categoria nem CONCEPT novo)
- **Categoria (TREE)** = navegação: ONDE o grupo se acha na árvore única (`categories`, §13).
- **Propósito** = POR QUE o grupo existe — semântica LEVE de intenção coletiva, eixo ORTOGONAL
  à categoria (mesmo padrão já promulgado: vínculo jurídico × cargo operacional na 0160).
- **Consequência sistêmica** (a razão de governar): propósito muda o que o grupo pode COMPOR —
  `cuidado_e_impacto` conversa com o pilar Impacto/Ledger Social/Fundo Regional (quando dinheiro
  abrir, PORTA-1); `fe_e_espiritualidade` e `torcida` têm sensibilidade LGPD de INFERÊNCIA sobre
  membros (religião/afiliação — mesma família da DECISION-0071); descoberta filtra por propósito
  ANTES de categoria.

## 2. Decisão proposta
- **D1 — Vocabulário governado `groups.purpose`** (coluna + CHECK + manifest, fonte TS única):
  `cuidado_e_impacto` (animais, rua, deficientes, doação) ·
  `comunidade_e_pertencimento` (vizinhos, condomínio, torcida, moto clube) ·
  `fe_e_espiritualidade` (igreja, círculos de fé) ·
  `interesse_e_hobby` (fotografia, games, colecionismo) ·
  `aprendizado` (estudo, reforço, línguas) ·
  `ajuda_mutua_e_cooperacao` (mutirões, compras coletivas, caronas solidárias).
  — 6 valores; extensão só por DECISION. `financial_purpose` (texto do dinheiro) NÃO se funde.
- **D2 — Wizard:** pergunta ANTES da categoria: "Qual o propósito do grupo?" (pílula+dropdown,
  padrão do composer); categoria vira refinamento de navegação depois.
- **D3 — Descoberta/busca:** propósito = faceta PRIMÁRIA de filtro de grupos (antes de categoria);
  apresentação apenas — não cria autoridade nem verdade nova (Lei: frontend projeta).
- **D4 — Sensibilidade:** propósito é do GRUPO (público, autodeclarado pelo criador) — NUNCA
  inferência sobre pessoa; membros de grupo `fe_e_espiritualidade` não ganham atributo religioso
  (anti-inferência, 0071/PROHIBITED_STRUCTURES).
- **D5 — Ponte futura (nomeada, não construída):** `cuidado_e_impacto` como pré-condição de
  compor com Impacto/Fundo Regional quando PORTA-1 abrir — gate próprio, decisão separada.

## 3. O que Clayton precisa cravar
1. Ratifica os 6 valores (ou emenda a lista — ex.: separar `torcida_e_fandom`? `civico_e_politico`?)
2. Propósito é OBRIGATÓRIO no wizard ou opcional com default?
3. Grupos existentes (Comunidade genérica) — backfill manual pelo dono ou default `comunidade_e_pertencimento`?

## 4. Cruza com
DECISION-0160 (eixos ortogonais) · 0071 (sensível/anti-inferência) · 0162 (plateias) ·
DT-GROUP-CATEGORY-TAXONOMY-DECISION-PENDING (a taxonomia TREE de grupos segue pendente —
propósito NÃO a substitui; são camadas diferentes).

## ADENDO 0163-A (2026-07-07, ratificado por Clayton via "qual a forma certa de incluir")
+ **`encontros_e_relacionamentos`** (7º valor): paquera, dating, encontros, festas de conhecer
gente. **SALVAGUARDAS-LEI deste valor (família 0071):** propósito é do GRUPO (público,
autodeclarado); NUNCA gera atributo/inferência sobre MEMBRO; PROIBIDO targeting por participação;
visibilidade da LISTA DE MEMBROS desses grupos = sub-decisão pendente (default atual do sistema
mantido até Clayton cravar). Executado: fonte + CHECK (migration 20260707060000) + manifest + wizard.
