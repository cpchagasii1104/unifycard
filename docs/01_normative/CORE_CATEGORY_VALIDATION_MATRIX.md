Categorias Profissionais — Core Category

Status: SUBORDINATED
Domain: Categories
Governing Contract: CORE_CATEGORY_CONTRACT.md
Nature: Validation Matrix (Non-Executable)

1. OBJETIVO DO DOCUMENTO

Este documento define critérios formais e objetivos para validar se categorias profissionais existentes ou futuras estão em conformidade com a Constituição Canônica do Core.

Ele NÃO:

executa validação

corrige dados

sugere implementação

referencia categorias específicas

Ele SERVE como:

regulamento de aplicação da Constituição

base para auditorias

insumo obrigatório da Fase 3 (execução)

2. DEFINIÇÃO — CATEGORIA PROFISSIONAL

Para efeito desta matriz, considera-se categoria profissional toda Category usada para:

identificar atuação profissional de PF

classificar oferta de serviço baseada em mão de obra

compor agenda, matching e reputação

Categorias profissionais NÃO representam:

produtos

empresas

contratos

tipos de vaga

especializações

3. CHECKLIST CANÔNICO DE VALIDAÇÃO

Toda categoria profissional DEVE cumprir TODOS os critérios abaixo.

CRITÉRIO A — POSIÇÃO NA HIERARQUIA
Regra	Obrigatória
level >= 1	✅
level == 0	❌
Possui parent_id	✅
parent_id = NULL	❌

Profissão nunca é raiz.

CRITÉRIO B — TIPO DE NÓ
Regra	Obrigatória
Nó LEAF (sem filhos)	✅
Nó intermediário	❌
Nó ROOT	❌

Profissão não agrupa outras categorias.

CRITÉRIO C — DOMÍNIO SEMÂNTICO DO PAI

O parent_id de uma profissão DEVE apontar para uma categoria de domínio semântico amplo, como:

setor

área de atuação

domínio conceitual

Pais INVÁLIDOS:

marketplace

produto

serviço

empresa

contrato

vaga

Pai funcional invalida a profissão.

CRITÉRIO D — PUREZA SEMÂNTICA

A categoria profissional NÃO PODE:

misturar profissão + especialização

misturar profissão + tipo de contrato

misturar profissão + produto

conter qualificadores operacionais no nome

Especialização é atributo, não categoria.

CRITÉRIO E — CONTEXTO ≠ IDENTIDADE

Uma categoria profissional PODE ser utilizada em múltiplos contextos desde que:

o category_id seja único

a hierarquia não mude

o significado não seja reinterpretado

Contexto filtra uso, não redefine categoria.

4. CLASSIFICAÇÃO FINAL

Após aplicar os critérios A → E, cada categoria profissional deve ser classificada em uma única classe:

🟢 CONFORME

Cumpre 100% dos critérios

Nenhuma ação necessária

🟡 ZONA DE RISCO

Cumpre a maioria dos critérios

Viola apenas um critério leve

Não compromete a hierarquia

Monitoramento recomendado.

🔴 VIOLA

Viola qualquer critério estrutural, incluindo:

root indevido

ausência de pai

não ser leaf

pai funcional

mistura semântica

Correção obrigatória na Fase 3.

5. CATÁLOGO DE VIOLAÇÕES
Código	Descrição
V1	Profissão como ROOT
V2	Profissão com filhos
V3	Profissão sem parent_id
V4	Pai funcional
V5	Mistura profissão + especialização
V6	Reinterpretação por contexto
6. USO DESTE DOCUMENTO

Este documento:

é obrigatório antes de qualquer correção de dados

deve ser aplicado a todas as categorias profissionais

deve ser usado como base para queries de auditoria

impede exceções individuais ou “hotfix”

7. ENCERRAMENTO DA FASE 2

✔️ Matriz de validação definida
✔️ Critérios fechados e não interpretáveis
✔️ Nenhuma execução realizada

Sem esta matriz, não existe correção legítima.

FIM DO DOCUMENTO