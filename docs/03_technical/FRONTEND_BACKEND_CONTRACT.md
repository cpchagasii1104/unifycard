# FRONTEND_BACKEND_CONTRACT.md

Status: CANÔNICO — EXTENSÃO ORGANIZACIONAL  
Autoridade: DERIVADA  
Documentos-base:
- CORE_IMUTAVEL.md
- PADRAO_FRONTEND_CANONICO.md
- ARQUETIPOS_PAGINA_CANONICOS.md
- DESIGN_SYSTEM_CANONICO.md
- GOLDEN_PATH_VISUAL_CANONICO.md
- Database_Canonical_Truth_Contract.md

Escopo: Fronteira institucional entre Frontend e Backend  
Audiência: IAs Guardiãs · IAs Executoras · Arquitetura · Operadores Humanos

================================================================
FINALIDADE
================================================================

Este documento define, de forma EXPLÍCITA e NÃO AMBÍGUA,
o contrato institucional entre:

- FRONTEND (camada derivada, perceptiva)
- BACKEND (autoridade de verdade, decisão e validação)

Seu objetivo é:
- impedir inferência implícita
- impedir confiança excessiva entre camadas
- impedir validação duplicada
- impedir decisões silenciosas
- garantir rastreabilidade e auditoria

Este documento:
- NÃO cria regra de negócio
- NÃO cria decisão
- NÃO redefine Core
- APENAS estabelece limites claros de leitura e escrita

================================================================
PRINCÍPIO FUNDAMENTAL
================================================================

Frontend NÃO é fonte de verdade.  
Backend É a única autoridade institucional.

O Frontend:
- declara intenção
- exibe estado
- orienta o usuário

O Backend:
- valida
- decide
- rejeita
- registra
- audita

================================================================
1️⃣ RESPONSABILIDADES DO FRONTEND (OBRIGATÓRIAS)
================================================================

O Frontend PODE:

- Exibir READ-MODELS derivados do backend
- Declarar INTENÇÕES explícitas do usuário
- Coletar dados incompletos (rascunhos)
- Navegar entre estados institucionais
- Tornar decisões humanas visíveis (após confirmação)

O Frontend NUNCA PODE:

- Validar regra de negócio
- Validar permissões
- Validar tempo, agenda ou disponibilidade
- Inferir transições de estado
- Completar dados “faltantes”
- Executar ações automáticas
- Tomar decisão implícita
- Assumir sucesso sem resposta explícita do backend

================================================================
2️⃣ RESPONSABILIDADES DO BACKEND (OBRIGATÓRIAS)
================================================================

O Backend DEVE:

- Ser a fonte única da verdade
- Validar TODAS as regras institucionais
- Validar permissões e autoria
- Validar tempo via Core Temporal
- Rejeitar dados inválidos de forma explícita
- Retornar estado institucional claro
- Registrar eventos e decisões para auditoria

O Backend NUNCA DEVE:

- Confiar em validação feita no frontend
- Assumir completude de dados
- Inferir intenção do usuário
- “Ajudar” completando dados
- Silenciar erros institucionais

================================================================
3️⃣ CONTRATO DE LEITURA (READ-MODEL)
================================================================

O Frontend pode LER apenas dados:

- Explicitamente fornecidos pelo backend
- Classificados como READ-MODEL
- Identificados como derivados (não verdade)

Todo READ-MODEL:
- É apenas uma projeção
- Pode estar defasado
- Nunca decide nada

O Frontend:
- NÃO corrige
- NÃO reconcilia
- NÃO interpreta inconsistências

Se houver inconsistência visual:
➡️ Exibir estado retornado
➡️ Nunca tentar “ajustar”

================================================================
4️⃣ CONTRATO DE ESCRITA (WRITE / INTENÇÃO)
================================================================

O Frontend NÃO “escreve estado”.

O Frontend apenas:
- envia COMANDOS
- declara INTENÇÕES
- solicita AÇÕES

Exemplos institucionais:
- criar rascunho
- solicitar publicação
- solicitar pagamento
- solicitar cancelamento

O Backend:
- aceita ou rejeita
- retorna decisão explícita
- nunca assume sucesso implícito

================================================================
5️⃣ RASCUNHO VS DECISÃO
================================================================

Rascunho:
- pode ser incompleto
- não gera efeito institucional
- não exige validação completa

Decisão:
- exige confirmação explícita
- exige validação completa
- gera efeito institucional
- deve ser auditável

O Frontend:
- NÃO promove rascunho a decisão
- NÃO valida se algo “está pronto”
- apenas solicita

================================================================
6️⃣ ERROS, REJEIÇÕES E ESTADOS
================================================================

Toda rejeição do backend DEVE:
- ser explícita
- ser rastreável
- retornar motivo institucional
- nunca ser silenciosa

O Frontend:
- exibe erro
- orienta o usuário
- NÃO tenta corrigir automaticamente

Erro NÃO é falha de UX.
Erro é parte do contrato institucional.

================================================================
7️⃣ TEMPO, AGENDA E DISPONIBILIDADE
================================================================

Tempo é CORE.

O Frontend:
- apenas EXIBE tempo
- coleta input temporal como referência visual
- NÃO valida conflito
- NÃO valida disponibilidade

O Backend:
- valida tempo exclusivamente via Core Temporal
- decide conflitos
- rejeita inconsistências

Qualquer validação temporal no frontend
é violação institucional.

================================================================
8️⃣ STATUS, ETAPAS E FLUXOS
================================================================

O Frontend:
- exibe status retornado
- NÃO infere próxima etapa
- NÃO oculta caminhos
- NÃO cria atalhos

Fluxos visuais:
- seguem GOLDEN_PATH_VISUAL_CANONICO.md
- NÃO substituem fluxos funcionais

Se o backend retornar estado inesperado:
➡️ exibir
➡️ não interpretar
➡️ não “corrigir”

================================================================
9️⃣ AUDITORIA E OBSERVABILIDADE
================================================================

Toda decisão relevante:
- ocorre no backend
- é registrada
- é auditável

Observabilidade:
- NUNCA aciona decisão
- NUNCA altera estado
- apenas observa

Frontend:
- apenas consome observabilidade
- nunca reage automaticamente

================================================================
10️⃣ REGRA DE CONFLITO
================================================================

Em qualquer conflito entre camadas:

CORE > BACKEND > FRONTEND

Em qualquer conflito documental:

Documento de maior hierarquia VENCE.

Frontend nunca vence conflito institucional.

================================================================
DECLARAÇÃO FINAL
================================================================

Este contrato existe para:

- proteger o Core
- proteger o usuário
- proteger o time
- proteger a IA

No UnifiCard:
- o Frontend não decide
- o Backend não adivinha
- o sistema não improvisa

Tudo que importa
é explícito, validado e auditável.
