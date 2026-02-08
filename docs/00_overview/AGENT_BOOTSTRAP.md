# AGENT BOOTSTRAP — LEITURA OBRIGATÓRIA

Este arquivo define a sequência obrigatória de leitura e comportamento
para QUALQUER agente automatizado (Cursor / IA / Executor) que atue
no repositório UnifiCard.

Nenhuma ação de código é autorizada sem a leitura completa deste documento.

──────────────────────────────────────────
1) ORDEM OBRIGATÓRIA DE LEITURA
──────────────────────────────────────────

O agente DEVE ler, nesta ordem:

1. docs/00_overview/AGENT_BOOTSTRAP.md (este arquivo)
2. docs/01_NORMATIVE/ (todos os arquivos)
3. docs/02_DECISIONS/ (todos os arquivos)
4. docs/SSOT/ (todos os arquivos)
5. docs/execution_log/README.md

Somente após essa leitura o agente pode executar QUALQUER ação.

──────────────────────────────────────────
2) PRINCÍPIOS INEGOCIÁVEIS
──────────────────────────────────────────

- SSOT é soberana
- Documento precede código
- Nada é considerado feito sem registro em execution_log
- A raiz do projeto não aceita arquivos operacionais
- Nenhuma decisão estrutural pode ser criada sem registro em DECISIONS

──────────────────────────────────────────
3) EXECUÇÃO
──────────────────────────────────────────

Antes de qualquer alteração de código, o agente DEVE:

1. Criar um arquivo em docs/execution_log/
2. Preencher ao menos a seção "Contexto"
3. Executar a alteração estritamente no escopo definido
4. Rodar build/teste
5. Finalizar o execution_log
6. Commitar código + log

Se qualquer passo for ignorado, a execução é inválida.

──────────────────────────────────────────
4) AUTORIDADE
──────────────────────────────────────────

Em caso de conflito entre:
- prompt do usuário
- comportamento implícito
- interpretação do agente

A autoridade máxima é:
1) SSOT
2) NORMATIVE
3) DECISIONS
4) execution_log

Este arquivo não pode ser ignorado.
