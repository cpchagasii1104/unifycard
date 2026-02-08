# 04 — CATEGORIES SSOT

## STATUS
CANÔNICO · VIGENTE · OBRIGATÓRIO

---

## 1. PRINCÍPIO FUNDAMENTAL

O sistema UnifiCard possui **uma única ontologia canônica de categorias**.

Categorias existem para **classificar**, nunca para:
- decidir
- autorizar
- executar lógica

Se algo classifica qualquer entidade no sistema, **deve usar Categories**.

---

## 2. DEFINIÇÃO DE CATEGORIA

Categoria é uma **unidade ontológica de classificação**.

Categorias:
- não agem
- não decidem
- não carregam estado
- não possuem comportamento

Elas **apenas classificam** entidades existentes.

---

## 3. UNICIDADE DA ÁRVORE

Existe **uma única árvore de categorias** no sistema.

É proibido:
- múltiplas árvores
- taxonomias paralelas
- enums locais
- classificações “temporárias”

Toda classificação **DEVE** apontar para:
- `categories.category_id`

---

## 4. ESCOPO DE APLICAÇÃO

Categorias podem classificar:
- Actors
- Entidades de domínio
- Serviços
- Eventos
- Conteúdos
- Produtos
- Qualquer objeto classificável

Categorias **não criam significado fora do contexto do classificado**.

---

## 5. HIERARQUIA E ESTRUTURA

A hierarquia de categorias:
- é explícita
- é estável
- é imutável por padrão

Alterações na árvore:
- exigem Gate formal
- não podem ser feitas por conveniência técnica
- não podem ser inferidas

---

## 6. PROIBIÇÕES EXPLÍCITAS

É proibido:
- classificar usando strings livres
- duplicar categorias por domínio
- criar aliases não normatizados
- usar categorias como flags de lógica

Qualquer violação invalida o uso da categoria.

---

## 7. AUTORIDADE DO SSOT DE CATEGORIES

Este documento é a **única fonte de verdade** sobre:
- o que é uma categoria
- como categorias se organizam
- como categorias podem ser usadas

Nenhum contrato, serviço, API ou módulo pode:
- redefinir categorias
- criar árvore paralela
- estender categorias implicitamente

---

## 8. RELAÇÃO COM OUTROS SSOTs

- Actors podem ser classificados por categorias
- Identidade não é categoria
- Contratos não são categorias
- Estados não são categorias

Misturar categoria com papel, permissão ou estado é **violação de modelo**.

---

## 9. EVOLUÇÃO DAS CATEGORIAS

Qualquer mudança em categorias:
- exige atualização explícita deste documento
- exige Gate formal
- exige impacto avaliado em todo o sistema

Se não passou por Gate, **não existe**.

---

## 10. REGRA FINAL

Se uma classificação não aponta para `categories.category_id`:
→ ela **não é válida**.

O sistema deve ser corrigido **na ontologia**, nunca contornado.

---

FIM DO DOCUMENTO
