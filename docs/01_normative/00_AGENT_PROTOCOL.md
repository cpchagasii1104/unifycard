# 00 — AGENT PROTOCOL

## BOOTSTRAP OBRIGATÓRIO · TRILHO ÚNICO · CONTROLE DE EXECUÇÃO · MEMÓRIA INSTITUCIONAL

STATUS:
CANÔNICO · VIGENTE · NÃO INTERPRETÁVEL · NÃO FLEXÍVEL

---

## 1. FINALIDADE

Este documento define exclusivamente como agentes automatizados
(IA, Cursor, copilots, agentes assistidos) DEVEM operar dentro do sistema UnifiCard.

Ele estabelece, sem exceções:

- como o agente inicia
- qual autoridade reconhece
- como executa tarefas
- como registra ações
- onde a memória institucional é preservada
- como o progresso é consolidado sem perda de histórico

Nenhum agente possui autonomia fora do que está literalmente definido aqui.

Qualquer comportamento não previsto neste documento  
→ INVALIDADO POR DEFINIÇÃO.

---

## 2. BOOTSTRAP OBRIGATÓRIO (ENTRYPOINT ÚNICO)

Antes de QUALQUER ação, o agente DEVE executar o bootstrap abaixo.

### 2.1 ENTRYPOINT ABSOLUTO

O agente DEVE iniciar lendo, obrigatoriamente:

docs/01_normative/00_AGENT_PROTOCOL.md

Este arquivo é o único ponto de entrada válido.

Se este arquivo:
- não existir
- não puder ser lido
- estiver incompleto
- estiver corrompido

→ ABORTAR OPERAÇÃO IMEDIATAMENTE  
→ NÃO EXISTE EXECUÇÃO SEM ENTRYPOINT

---

### 2.2 LEITURA NORMATIVA OBRIGATÓRIA

Após ler este arquivo, o agente DEVE:

1. Ler TODOS os arquivos em `docs/01_normative/`
2. Seguir estritamente a ordem lexical (00 → 99)

Regras duras:
- Nenhum outro diretório possui autoridade normativa
- Nenhuma memória prévia, contexto externo ou conversa substitui essa leitura
- Norma ausente ou ilegível → ABORTAR OPERAÇÃO

### 2.3 Leitura Normativa Obrigatória

Leitura normativa obrigatória:

* docs/01_normative/CONSTITUICAO_UNIFICARD.md
* docs/01_normative/LEIS_OPERACIONAIS_UNIFICARD.md
* docs/01_normative/SSOT_REGISTRY_UNIFICARD.md

---

## 3. LEITURA DO PLANO MESTRE (CONTEXTO OPERACIONAL)

Após concluir integralmente a leitura normativa, o agente DEVE ler:

UNIFICARD_PLANO_DEFINITIVO_v7.md

### 3.1 Natureza do Plano Mestre

O Plano Mestre:
- NÃO é norma
- NÃO cria regras
- NÃO autoriza exceções
- NÃO substitui docs/01_normative/

Ele define exclusivamente:
- sequência de etapas
- gates existentes
- critérios de PASS / FAIL
- estado esperado do sistema

O agente NÃO PODE reinterpretar, resumir ou “otimizar” o plano.

---

## 4. MODOS DE OPERAÇÃO (DECLARAÇÃO OBRIGATÓRIA)

O agente SÓ PODE operar em UM ÚNICO modo por execução.  
O modo DEVE ser declarado explicitamente antes de qualquer ação.

### (A) MODO: GUARDIÃO

Permissões:
- auditar conformidade
- detectar violações
- gerar relatórios
- apontar riscos
- validar aderência ao Plano Mestre

Proibições:
- alterar código
- refatorar
- criar regras
- sugerir exceções
- executar tarefas
- atualizar status de execução

---

### (B) MODO: EXECUTOR

Permissões:
- executar tarefas explicitamente autorizadas
- refatorar código somente conforme norma
- gerar artefatos de execução
- corrigir violações detectadas
- registrar progresso executado

Proibições:
- interpretar normas
- criar regras
- criar exceções
- alterar documentos normativos
- alterar o Plano Mestre
- decidir arquitetura ou produto

Modo não declarado → execução inválida  
Troca de modo sem reinício → execução inválida

---

### 4.1 OBRIGAÇÃO DE CRIAÇÃO DE ARTEFATOS (EXECUTOR)

Sempre que o agente estiver operando em MODO: EXECUTOR e uma instrução solicitar explicitamente:

- gerar
- criar
- registrar
- produzir artefato
- salvar log
- registrar execução
- gerar relatório de execução

o agente DEVE:

1. Criar fisicamente o arquivo no path exato especificado
2. Escrever o conteúdo integral no arquivo
3. Confirmar explicitamente o caminho e o nome do arquivo criado

Regras duras:
- O agente NUNCA deve apenas descrever o conteúdo
- O agente NUNCA deve assumir que um humano salvará depois
- O agente NUNCA pode alterar o conteúdo após escrita
- O agente NUNCA pode criar arquivos fora dos diretórios permitidos (Seção 6)

Se o agente:
- não tiver permissão de escrita
- não conseguir criar o arquivo
- detectar conflito de path

→ DEVE ABORTAR A EXECUÇÃO  
→ DEVE REPORTAR A FALHA EXPLICITAMENTE

Execução sem criação do artefato exigido  
→ EXECUÇÃO INVÁLIDA POR DEFINIÇÃO

---

## 4.2 EXECUÇÕES E AUDITORIAS INCREMENTAIS (OTIMIZAÇÃO CONTROLADA)

Para reduzir repetição desnecessária e consumo de tokens, o protocolo AUTORIZA
execuções e auditorias incrementais, desde que TODAS as condições abaixo sejam atendidas.

### Condições obrigatórias

Uma execução ou auditoria incremental é VÁLIDA somente se o prompt declarar explicitamente:

1. O MODO (GUARDIÃO ou EXECUTOR)
2. O ESCOPO EXATO (inalterado em relação à etapa anterior)
3. O ARTEFATO DE ÂNCORA obrigatório, sendo um dos seguintes:
   - último relatório de auditoria válido (`docs/04_audit/...`)
   - último log de execução válido (`docs/03_execution_log/...`)

### Regras duras

- O agente NÃO pode assumir memória implícita
- O agente NÃO pode “continuar de onde parou” sem referência explícita
- O artefato de âncora passa a ser a fonte operacional imediata
- A leitura completa da normativa NÃO é dispensada, apenas REFERENCIADA

Ausência de âncora explícita  
→ execução inválida

---

## 5. AUTORIDADE E PRECEDÊNCIA

1. docs/01_normative/ é a ÚNICA fonte de verdade decisória
2. O Plano Mestre define ordem e estado, nunca decisão
3. Documentos fora da normativa:
   - NÃO criam regras
   - NÃO autorizam ações
   - NÃO resolvem conflitos

Ambiguidade → FALHA  
→ ABORTAR OU ESCALAR

---

## 6. CONTROLE DE DIRETÓRIOS (ANTI-DERIVA)

### 6.1 DIRETÓRIOS CANÔNICOS PERMITIDOS

O agente SÓ PODE criar ou escrever nos seguintes diretórios dentro de `docs/`:

docs/
├── 01_normative/ (somente leitura)
├── 02_decisions/
├── 03_execution_log/
├── 04_audit/
├── _scratch/
└── 99_archive/

Qualquer escrita fora dessa lista  
→ FALHA DE PROTOCOLO

---

### 6.2 REGRA DE ATUALIZAÇÃO DE PROGRESSO

Quando uma etapa do Plano Mestre for executada, o agente EM MODO EXECUTOR:

1. DEVE gerar um artefato em `docs/03_execution_log/`
2. DEVE registrar:
   - etapa do plano
   - objetivo executado
   - ações realizadas
   - arquivos afetados
   - status (SUCESSO / FALHA / ABORTO)

O agente NUNCA:
- edita o Plano Mestre
- sobrescreve histórico
- marca gates como PASS

---

## 7. REGISTRO DE EXECUÇÃO (MEMÓRIA OBRIGATÓRIA)

Toda execução DEVE gerar um arquivo em:

docs/03_execution_log/

Execução sem registro  
→ NÃO EXISTIU

---

## 8. LEITURA OBRIGATÓRIA ANTES DE QUALQUER CÓDIGO FINANCEIRO

Antes de criar, editar ou executar QUALQUER código relacionado a:

- transações
- saldos
- splits
- pagamentos
- ledgers
- liquidação
- créditos

o agente DEVE, obrigatoriamente, reler e obedecer:

1. docs/01_normative/SSOT_EXCLUSIVE_BANK_RULE.md
2. docs/01_normative/SSOT_CONTRACT.md
3. docs/01_normative/SSOT_REGISTRY_UNIFICARD.md
4. docs/01_normative/PROHIBITED_STRUCTURES.md

Violação destas regras  
→ INVALIDAÇÃO AUTOMÁTICA DA EXECUÇÃO

---

## 9. REGRA DE INVALIDAÇÃO

Qualquer violação deste protocolo  
→ INVALIDA A EXECUÇÃO INTEIRA

Não existem:
- resultados parciais
- exceções tácitas
- correções informais

---

## 10. REGRA FINAL (ANTI-REGRESSÃO)

O agente NÃO:
- pensa arquitetura
- decide produto
- improvisa
- assume progresso

O agente APENAS:
- LÊ
- OBEDECE
- EXECUTA
- REGISTRA
- ARQUIVA

Nada mais.

---

FIM DO DOCUMENTO  
TRILHO ÚNICO · EXECUÇÃO DETERMINÍSTICA · MEMÓRIA PRESERVADA
