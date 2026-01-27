# CHECK_DUPLICIDADE_OBRIGATORIO.md

Status: CANÔNICO  
Autoridade: OPERACIONAL MÁXIMA  
Aplicação: IAs, código, banco, arquitetura, documentação e decisões humanas  

---

## DEFINIÇÃO

Este documento define a **VERIFICAÇÃO OBRIGATÓRIA DE NÃO DUPLICAÇÃO**
antes de qualquer **proposta, criação, alteração ou refatoração**
no sistema **UnifiCard**.

Este checklist é **NÃO OPCIONAL** e possui **AUTORIDADE OPERACIONAL**
sobre qualquer decisão técnica, arquitetural, funcional ou institucional.

Ele é o **checkpoint zero** do sistema.

---

## REGRA FUNDAMENTAL (INQUEBRÁVEL)

❗ **Nenhuma nova estrutura pode ser criada**
sem provar explicitamente que ela **NÃO DUPLICA** algo existente.

No UnifiCard, assume-se sempre que:

> **Se algo parece novo, provavelmente já existe em alguma forma.**

O **ônus da prova é sempre de quem propõe**, nunca do sistema.

---

## O QUE É CONSIDERADO DUPLICAÇÃO

Duplicação inclui, mas não se limita a:

- lógica
- conceito
- responsabilidade
- fluxo
- estado
- contrato
- engine
- service
- tabela
- migration
- read-model
- projector
- documento
- regra institucional
- decisão já registrada

Se **qualquer um destes já existir**, mesmo que parcialmente:
➡️ **NÃO CRIAR OUTRO**

---

## REGRA ESPECIAL — TEMPO, DATA E DISPONIBILIDADE (CORE)

⚠️ **REGRA CANÔNICA ABSOLUTA**

> **Se algo toca tempo, data, agenda, calendário ou disponibilidade,
> assume-se AGENDA UNIVERSAL como fonte única de verdade,
> ATÉ prova canônica explícita em contrário.**

É **TERMINANTEMENTE PROIBIDO**:

- criar agendas paralelas
- duplicar lógica temporal
- manter datas ou horários como verdade fora da Agenda Universal
- sincronizar tempo “depois”
- resolver conflito temporal localmente

📌 **Documentos de autoridade obrigatória**:
- CORE_IMUTAVEL.md
- AGENDA_UNIVERSAL_CONTRACT.md

Sem autorização explícita nesses documentos:
❌ **PROPOSTA BLOQUEADA**

---

## VERIFICAÇÃO OBRIGATÓRIA (ANTES DE QUALQUER AÇÃO)

Antes de propor, implementar ou alterar **QUALQUER COISA**,
é obrigatório executar **TODAS** as etapas abaixo.

---

### 1. VERIFICAÇÃO NO CÓDIGO

Verifique explicitamente:

- Existe engine com responsabilidade semelhante?
- Existe service que resolve isso parcial ou totalmente?
- Existe fluxo ativo que já executa essa função?
- Existe lógica equivalente em outro módulo?
- Existe possibilidade clara de extensão em vez de criação?

⚠️ **“Não está ideal” NÃO é justificativa para duplicação.**

---

### 2. VERIFICAÇÃO NO BANCO DE DADOS

Verifique explicitamente:

- Existe tabela que já representa esse conceito?
- Existe migration que cria algo similar?
- Existe campo JSON que já armazena essa informação?
- Existe read-model ou projector relacionado?
- Existe histórico auditável (append-only) que já cobre isso?

Se existir **QUALQUER estrutura relacionada**:
➡️ **NÃO CRIAR NOVA**

---

### 3. VERIFICAÇÃO NOS DOCUMENTOS CANÔNICOS

É **OBRIGATÓRIO** consultar e respeitar:

- CORE_IMUTAVEL.md
- AGENDA_UNIVERSAL_CONTRACT.md
- CORE_EXECUTAVEL_VS_CORE_CONCEITUAL.md
- CORE_VS_MODULOS_CONTRACT.md
- Category_System_Contract_UnifiCard.md
- Decision_Safety_and_Containment_Contract.md
- Database_Canonical_Truth_Contract.md
- OBSERVABILIDADE_CONSTITUCIONAL.md
- MATRIZ_FONTES_DE_VERDADE.md
- GOVERNANCA_CANONICA.md

Se **QUALQUER documento já cobrir o tema**:
➡️ **NÃO CRIAR NADA NOVO**

---

## REGRA DE DESCRIÇÃO DO FLUXO EXISTENTE

Se algo similar **JÁ EXISTIR**, é **OBRIGATÓRIO**:

1. Descrever o fluxo atual **COMPLETO**
2. Apontar claramente onde ele começa e onde termina
3. Explicar por que **NÃO atende** ao novo caso
4. Provar por que **EXTENSÃO** é melhor que **DUPLICAÇÃO**

❌ Sem cumprir os 4 pontos → **PROPOSTA INVÁLIDA**

---

## PROIBIÇÕES ABSOLUTAS

É **TERMINANTEMENTE PROIBIDO**:

- Criar engine nova sem mapear engines existentes
- Criar tabela nova sem provar ausência de estrutura equivalente
- Criar soluções paralelas “temporárias”
- Criar atalhos fora do core
- Reimplementar lógica existente com outro nome
- Criar “v2” sem contrato explícito de substituição
- Criar segunda fonte de verdade
- Ignorar estrutura existente por conveniência

Violou qualquer item:
❌ **BLOQUEAR**

---

## REGRA PARA IAs (OBRIGATÓRIA)

Qualquer IA que atue no projeto **UnifiCard**:

- DEVE executar este checklist antes de responder
- DEVE apontar arquivos, services, tabelas e documentos existentes
- DEVE RECUSAR propostas que violem este documento
- DEVE citar explicitamente onde já existe algo similar

Se não conseguir provar ausência de duplicação:
❌ **RECUSAR**

---

## AUTORIDADE

Este documento é respaldado por:

- CORE_IMUTAVEL.md
- AGENDA_UNIVERSAL_CONTRACT.md
- GOVERNANCA_CANONICA.md
- Decision_Safety_and_Containment_Contract.md
- Database_Canonical_Truth_Contract.md

Este checklist possui **precedência operacional**
sobre qualquer checklist, prompt, instrução ou sugestão inferior.

---

## FRASE CANÔNICA FINAL

> **No UnifiCard, não se cria antes de verificar.  
> Não se duplica por conveniência.  
> Não se improvisa fora do core.  
> O sistema registra, sugere e executa apenas decisões humanas explícitas.**
