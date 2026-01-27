Status: SUBORDINATED
Domain: UNKNOWN
Governing Contract: CORE_IMUTAVEL.md
# CORE EXECUTÁVEL VS CORE CONCEITUAL — UNIFICARD

Este documento define, de forma EXPLÍCITA e INEGOCIÁVEL, a diferença entre:
- CORE EXECUTÁVEL
- CORE CONCEITUAL

Esta separação existe para:
- evitar duplicação estrutural,
- evitar conflitos entre módulos,
- impedir que agentes (humanos ou IA) reinventem partes do sistema.


================================================================
1. DEFINIÇÕES
================================================================

CORE EXECUTÁVEL
--------------
São componentes centrais que:
- executam lógica estrutural do sistema,
- servem como infraestrutura base,
- NÃO podem ser duplicados,
- NÃO podem ser reinterpretados,
- NÃO podem ser substituídos por módulos.

CORE CONCEITUAL
---------------
São componentes que:
- definem regras, contratos, modelos mentais e limites,
- orientam decisões humanas e técnicas,
- NÃO executam lógica operacional direta,
- NÃO armazenam estado mutável do sistema.


================================================================
2. LISTA OFICIAL — CORE EXECUTÁVEL
================================================================

Os itens abaixo são CORE EXECUTÁVEL e NÃO podem ser duplicados:

- Agenda Universal (tempo, datas, horários, disponibilidade)
- Sistema de identidade de Actor (user, page, organization)
- Sistema de permissões canônicas
- Infraestrutura de pagamentos (Unify Bank / splits)
- Infraestrutura de auditoria imutável
- Infraestrutura de observabilidade passiva
- Infraestrutura de dispatch e inbox institucional

REGRA:
Todo módulo que envolva DATA, HORA, DISPONIBILIDADE ou SINCRONIZAÇÃO
DEVE obrigatoriamente CONSUMIR a Agenda Universal.


================================================================
3. LISTA OFICIAL — CORE CONCEITUAL
================================================================

Os itens abaixo são CORE CONCEITUAL:

- EventSpec (snapshot declarativo)
- Contratos canônicos (Decision Safety, Category System, etc.)
- Governança institucional
- Visão canônica do sistema
- Golden Path
- Guardrails arquiteturais
- Regras de anti-duplicação


================================================================
4. REGRA ABSOLUTA DE CONSUMO
================================================================

- Nenhum módulo pode criar sua própria lógica de tempo.
- Nenhum evento pode “ter sua própria agenda”.
- Nenhum profissional pode “gerenciar datas fora do core”.
- Nenhum sistema paralelo de calendário é permitido.

EVENTOS, PROFISSIONAIS, SERVIÇOS, RFQs, BOOKINGS
→ TODOS consomem a Agenda Universal.


================================================================
5. VIOLAÇÕES
================================================================

Qualquer proposta que:
- replique lógica de tempo,
- crie agenda paralela,
- armazene datas críticas fora do core,
- ignore a Agenda Universal,

DEVE ser recusada imediatamente.


================================================================
6. AUTORIDADE
================================================================

Este documento complementa e reforça:
- CORE_IMUTAVEL.md
- CORE_TEMPORAL_E_AGENDA_UNIVERSAL.md
- CORE_VS_MODULOS_CONTRACT.md

Em caso de dúvida:
CORE EXECUTÁVEL TEM PRECEDÊNCIA TOTAL.

