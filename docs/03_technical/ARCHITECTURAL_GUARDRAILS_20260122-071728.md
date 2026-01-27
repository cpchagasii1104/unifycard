# ARCHITECTURAL_GUARDRAILS

TIPO: NORMA DE GOVERNANCA  
AUTORIDADE: NIVEL 2  
PRECEDENCIA: SUBORDINADO A CONSTITUICAO_TREINAMENTO.md  
ESCOPO: EVOLUCAO, MODIFICACAO E INTERPRETACAO DO SISTEMA DOCUMENTAL  

---

## 1. OBJETIVO

Este documento estabelece os **GUARDRAILS ARQUITETURAIS** do sistema UnifiCard no que diz respeito
à **estrutura conceitual, documental e institucional**.

Seu objetivo nao e definir dominio, regra de negocio ou realidade do sistema,
mas **limitar e conter como os contratos podem ser alterados, estendidos ou interpretados**.

Este documento:
- governa o **COMO**
- nao redefine o **O QUE**

---

## 2. PRINCIPIO FUNDAMENTAL

> **NENHUMA EVOLUCAO E VALIDA SE QUEBRAR A COERENCIA DO SISTEMA CONCEITUAL.**

Qualquer mudanca que:
- introduza ambiguidade
- crie fonte paralela de verdade
- dependa de interpretacao benevolente
- exija contexto externo para ser entendida

e considerada **INVALIDA INSTITUCIONALMENTE**.

---

## 3. RELACAO COM CONTRATOS CANONICOS

- Contratos Canonicos definem a realidade do sistema.
- Guardrails **NAO** podem:
  - sobrescrever contratos
  - reinterpretar contratos
  - criar excecoes silenciosas

Em caso de conflito:
> **O CONTRATO CANONICO SEMPRE PREVALECE.**

Se um guardrail parecer contradizer um contrato,
o guardrail deve ser considerado **mal escrito**.

---

## 4. PROIBICOES EXPLICITAS

Sao **PROIBIDAS** no sistema:

### 4.1 Autoridade Implicita
- Tradicao
- Costume
- "Sempre foi assim"
- Interpretacao historica

Nada fora de texto escrito tem valor institucional.

---

### 4.2 Fonte Paralela de Verdade
- Dois documentos definindo o mesmo dominio
- Duas leituras validas do mesmo conceito
- Complementos silenciosos a contratos

SSOT e regra de invalidação, nao principio moral.

---

### 4.3 Evolucao Sem Precedencia
- Criar documento sem classe
- Criar regra sem declarar autoridade
- Criar excecao sem protocolo

Toda evolucao precisa declarar **ONDE SE ENCAIXA**.

---

## 5. REGRA DE EVOLUCAO DOCUMENTAL

Toda mudanca estrutural DEVE:

1. Declarar o tipo do documento
2. Declarar sua precedencia
3. Declarar seu escopo
4. Declarar impacto em contratos existentes
5. Ser auditavel apenas por leitura de texto

Se algum desses pontos nao for atendido,
a mudanca e considerada **INVALIDA**.

---

## 6. RELACAO COM DIAGNOSTICOS

- Diagnosticos **NAO CRIAM OBRIGACAO**
- Diagnosticos **NAO ALTERAM CONTRATOS**
- Diagnosticos **NAO DEFINEM COMPORTAMENTO**

Diagnostico serve para:
- apontar problema
- fundamentar decisao futura

Qualquer diagnostico que:
- pareca normativo
- use linguagem imperativa
- determine acao

esta violando este documento.

---

## 7. RELACAO COM CHECKLISTS

- Checklists sao mecanismos de controle
- Checklists nao definem regras
- Checklists nao substituem contratos

Checklist obrigatorio sem consequencia escrita
e considerado **INVALIDO**.

---

## 8. REGRA CONTRA AMBIGUIDADE

> **SE UMA REGRA PODE SER INTERPRETADA DE MAIS DE UMA FORMA, ELA ESTA ERRADA.**

Nao existe:
- interpretacao correta "no contexto"
- entendimento avancado
- leitura experiente

Ou o texto fecha, ou falha.

---

## 9. PAPEL DA IA E DOS AGENTES

Nenhuma IA, agente ou operador humano
possui autoridade para:

- reinterpretar contratos
- suavizar regras
- agir "em prol do sistema"
- corrigir ambiguidade por conta propria

Agir fora do texto e **violacao institucional**.

---

## 10. CLAUSULA DE ENCERRAMENTO

Este documento existe para impedir que o sistema
degenere em:

- boas intencoes
- regras informais
- governanca oral
- interpretacao criativa

> **O SISTEMA E O TEXTO.**
> **FORA DO TEXTO, NAO HA AUTORIDADE.**

---

FIM DO DOCUMENTO
