# 02 — ACTORS SSOT

## STATUS
CANÔNICO · VIGENTE · OBRIGATÓRIO

---

## 1. PRINCÍPIO FUNDAMENTAL

O sistema UnifiCard opera sobre uma **ontologia explícita de Actors**.

Um **Actor** é a **única entidade capaz de agir, decidir, iniciar ou sofrer efeitos**
dentro do sistema.

Se algo:
- age → é um Actor
- não age → não é um Actor

Não existe ação sem Actor.
Não existe Actor implícito.

---

## 2. DEFINIÇÃO DE ACTOR

Actor é uma **unidade ontológica de ação**.

Ele **não é**:
- identidade civil
- usuário
- conta
- perfil
- sessão
- token

Esses elementos **nunca substituem** um Actor.
São apenas **vínculos, projeções ou mecanismos técnicos** associados a ele.

---

## 3. UNICIDADE E EXISTÊNCIA

Todo Actor no sistema:

- possui existência única
- é identificado de forma canônica
- não pode ser duplicado por conveniência técnica

É proibido:
- criar Actors implícitos
- inferir Actors a partir de dados técnicos
- representar o mesmo Actor em múltiplas estruturas paralelas

---

## 4. CATEGORIAS DE ACTORS

O sistema reconhece apenas Actors definidos explicitamente.

Exemplos de categorias válidas (não exaustivo):

- Pessoa Física
- Pessoa Jurídica
- Sistema
- Serviço
- Instituição
- Agente Automatizado

A criação de uma nova categoria de Actor:
- exige norma explícita
- exige atualização deste documento
- não pode ocorrer apenas via código

---

## 5. ACTOR ≠ IDENTIDADE

Identidade:
- define **quem responde juridicamente**
- é persistente
- é histórica

Actor:
- define **quem age no sistema**
- é operacional
- é temporário por definição

Misturar Actor com identidade é **violação estrutural**.

---

## 6. ACTOR ≠ PERFIL ≠ CONTA

- **Perfil** é uma projeção contextual do Actor
- **Conta** é uma estrutura técnica ou financeira
- **Actor** é a origem de toda ação

Nenhuma dessas estruturas pode:
- substituir o Actor
- redefinir sua existência
- carregar autoridade por si só

---

## 7. AUTORIDADE DO SSOT DE ACTORS

Este documento é a **única fonte de verdade** sobre:

- o que é um Actor
- quais tipos de Actor existem
- quais limites ontológicos se aplicam a Actors

Nenhum contrato, serviço, API ou módulo pode:
- redefinir Actor
- criar variações semânticas
- introduzir subclasses implícitas

---

## 8. RELAÇÃO COM OUTROS SSOTs

- Identidade: **ancora responsabilidade histórica**
- Categorias: **classificam Actors**
- Contratos: **regulam ações**
- Governança: **controla evolução**
- Autoridade: **define poder, delegação e revogação**

Actors **não governam a si mesmos**.

---

## 9. VÍNCULO LEGAL OBRIGATÓRIO

Todo Actor no sistema deve possuir **vínculo histórico obrigatório
com pelo menos uma Pessoa Física (CPF)**.

Um Actor pode representar:
- diretamente uma Pessoa Física (CPF), ou
- uma Pessoa Jurídica (CNPJ)

Regra estrutural:

> **Um Actor pode existir sem CNPJ.  
> Um Actor NUNCA pode existir sem CPF.**

Em todos os casos:
- o vínculo com CPF é obrigatório
- o histórico de atuação é permanente
- a autoridade é revogável
- a responsabilidade nunca é apagável

As regras completas de:
- criação
- delegação
- ocupação
- revogação
- encerramento
- responsabilização

estão definidas em:

**docs/01_normative/08_AUTORIDADE_CANONICA.md**

---

## 10. PROIBIÇÕES EXPLÍCITAS

É proibido:

- tratar usuário como sinônimo de Actor
- criar Actors sem CPF responsável
- criar Actors temporários “para depois decidir”
- usar IDs técnicos como identidade ontológica
- inferir Actor a partir de sessão, token ou request

Qualquer violação invalida o fluxo onde ocorre.

---

## 11. REGRA FINAL

Se existir ação no sistema sem Actor explícito:
→ o modelo está quebrado.

Correções devem ocorrer **no modelo**, nunca por contorno técnico.

---

FIM DO DOCUMENTO

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- 08_AUTORIDADE_CANONICA.md

### Referenciado por
- 00_INDEX.md
- 00_SUMARIO.md
- 07_NOMENCLATURA_CANONICA.md
- 99_GLOSSARIO_CANONICO.md
<!-- AUTO-GENERATED-END -->