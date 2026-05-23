Status: SUBORDINATED
Domain: UNKNOWN
Governing Contract: CORE_IMUTAVEL.md
CORE_VS_MODULOS_CONTRACT.md
(CONTRATO CANÔNICO — SEPARAÇÃO IMUTÁVEL)

OBJETIVO
Definir, de forma inequívoca, o que é CORE IMUTÁVEL do UnifiCard
e o que são MÓDULOS / EXTENSÕES.

Este contrato existe para impedir:
- duplicação estrutural
- atalhos arquiteturais
- decisões implícitas
- features virarem core sem autorização


==================================================
DEFINIÇÕES FUNDAMENTAIS
==================================================

DECISION-0021 — CRITÉRIO DE JURISDIÇÃO DO CORE

Este contrato deve ser lido à luz da DECISION-0021:

- CORE não é sinônimo de diretório físico `/core`.
- CORE é jurisdição sobre verdades compartilhadas que não podem divergir entre módulos.
- Soberania canônica pode existir fora de `/core` quando um SSOT, lei ou contrato declarar writer autorizado, enforcement e impossibilidade de contradição.
- Import graph, pasta, rota registrada, tabela existente ou `app.builder` provam acoplamento/vida técnica, não autoridade institucional.
- A pergunta obrigatória antes de classificar algo como core ou módulo é: **quem tem autoridade legítima sobre esta verdade?**

Consequência: módulos podem conter operação grande e até writer soberano reconhecido para um domínio específico (ex.: Bank/ledger), mas não podem criar mini-core clandestino nem verdade paralela para identidade, dinheiro, tempo, território, semântica, consentimento ou qualquer SSOT já definido.

--------------------------------------------------

CORE (IMUTÁVEL)

O CORE é o conjunto de sistemas que:

- NÃO pode ser duplicado
- NÃO pode ser inferido
- NÃO pode ser sobrescrito
- NÃO pode ser reimplementado em módulos
- NÃO pode ser adaptado silenciosamente

O CORE:
- define regras universais
- centraliza verdade
- é dependência obrigatória de tudo

Se uma verdade pertence à jurisdição do CORE, todo o resto se conecta à autoridade reconhecida para essa verdade.
Nunca o contrário. Essa autoridade pode estar fisicamente em `/core` ou em módulo expressamente autorizado por SSOT/lei/contrato.


--------------------------------------------------

MÓDULO / EXTENSÃO

Um módulo é tudo que:

- depende do CORE para funcionar
- pode ser ativado/desativado
- pode evoluir sem quebrar o sistema
- não cria regras universais

Módulos:
- não definem verdade soberana fora de autoridade reconhecida
- não decidem comportamento global
- não criam atalhos
- não mantêm estado concorrente ao core ou ao SSOT soberano de outro domínio


==================================================
CORE IMUTÁVEL — LISTA CANÔNICA
==================================================

1. AGENDA UNIVERSAL (CORE)

Documento: AGENDA_UNIVERSAL_CORE_CONTRACT.md

A Agenda Universal é a ÚNICA fonte de verdade para:
- datas
- horários
- disponibilidade
- conflitos de agenda
- sincronização entre:
  - eventos
  - profissionais
  - serviços
  - empresas
  - contratos

REGRAS BLOQUEANTES:
- Nenhum módulo pode armazenar data/hora como verdade própria
- Nenhum evento tem agenda própria
- Nenhum profissional tem agenda paralela
- Qualquer data/hora fora da Agenda Universal é apenas INPUT

Eventos NÃO gerenciam agenda.
Eventos SE REGISTRAM na Agenda Universal.


--------------------------------------------------

2. SISTEMA DE ACTORS (CORE)

Actors são a base identitária do sistema:
- Pessoa Física
- Empresa (CNPJ)
- Banda
- Organização
- Página
- Grupo

REGRAS BLOQUEANTES:
- Nenhum módulo cria identidade fora do sistema de actors
- Empresa sem actor NÃO EXISTE
- Ações, permissões e visibilidade sempre passam por actor


--------------------------------------------------

3. SISTEMA DE DECISÃO HUMANA (CORE)

Documentos:
- DECISION_SAFETY_AND_CONTAINMENT_CONTRACT.md
- VISAO_CANONICA_UNIFICARD.md

REGRAS BLOQUEANTES:
- Sistema não decide por score
- Sistema não decide por categoria
- Sistema não decide por heurística implícita
- Sistema não executa ação sem clique explícito

O sistema:
- sugere
- informa
- alerta
NUNCA decide.


--------------------------------------------------

4. VERDADE CANÔNICA DE DADOS (CORE)

Documento: DATABASE_CANONICAL_TRUTH_CONTRACT.md

- Banco guarda estado, não interpretação
- Mudanças são auditáveis
- Nada some
- Nada é reescrito silenciosamente


==================================================
MÓDULOS / EXTENSÕES (NÃO CORE)
==================================================

EVENTOS
- Módulo
- Depende de: Agenda Universal, Actors, Publication Engine
- Não controla agenda
- Não cria regras próprias de visibilidade


EMPRESAS / CNPJ
- Módulo
- Depende de: Actors, Documentos, Agenda Universal
- Não cria identidade fora do actor
- Não cria categorias decisórias


RFQ / OPORTUNIDADES
- Extensão
- Depende de: EventSpec, Opportunity Dispatch, Social Inbox
- Não cria ranking
- Não escolhe fornecedor
- Não dispara automaticamente


PUBLICATION ENGINE
- Engine transversal
- Não é core de decisão
- Atua como regra de visibilidade e distribuição
- Não decide quem deve ver
- Não altera ranking


==================================================
REGRA DE CONEXÃO OBRIGATÓRIA
==================================================

Todo módulo DEVE se conectar ao CORE.
Nenhum módulo pode simular o CORE.

EXEMPLOS PROIBIDOS:
- Evento guardando sua própria data final
- Serviço criando agenda interna
- Empresa decidindo compatibilidade automaticamente
- RFQ ranqueando empresas


==================================================
CHECKLIST ANTI-DUPLICAÇÃO (OBRIGATÓRIO)
==================================================

Antes de criar qualquer coisa nova:

1. Isso toca data ou hora?
   → AGENDA UNIVERSAL

2. Isso cria identidade?
   → ACTOR SYSTEM

3. Isso decide algo?
   → BLOQUEAR

4. Isso já existe no core?
   → REUTILIZAR

5. Isso cria uma versão alternativa do core?
   → RECUSAR


==================================================
REGRA FINAL
==================================================

Se algo:
- parece simples demais
- parece mais rápido
- parece "só um detalhe"

Provavelmente está tentando violar o CORE.

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- CORE_IMUTAVEL.md

### Referenciado por
- 00_INDEX.md
- 00_SUMARIO.md
- CORE_EXECUTAVEL_VS_CORE_CONCEITUAL.md
- CORE_IMUTAVEL.md
- GAPS_PROCESSADO_CANONICO.md
- IDENTITY_CORE_CONTRACT.md
- PROCESSAMENTO_GAPS_CANONICO.md
<!-- AUTO-GENERATED-END -->
