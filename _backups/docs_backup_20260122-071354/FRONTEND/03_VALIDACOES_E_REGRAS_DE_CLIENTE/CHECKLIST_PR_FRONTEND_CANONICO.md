# CRIAÇÃO DE DOCUMENTO CANÔNICO
# PROJETO: UNIFICARD
# DOCUMENTO: CHECKLIST_PR_FRONTEND_CANONICO.md
# LOCAL: /treinamento

OBJETIVO:
Criar o checklist OBRIGATÓRIO para qualquer Pull Request
que altere frontend no UnifiCard.

================================================================
STATUS INSTITUCIONAL
================================================================

Status: CANÔNICO — CHECKLIST OBRIGATÓRIO
Autoridade: DERIVADA de:
- PADRAO_FRONTEND_CANONICO.md
- DESIGN_SYSTEM_CANONICO.md
- GOLDEN_PATH_VISUAL_CANONICO.md

================================================================
ESCOPO
================================================================

Este checklist é OBRIGATÓRIO para:
- qualquer alteração de UI
- qualquer nova página
- qualquer modificação visual
- qualquer refatoração de frontend

================================================================
CHECKLIST OBRIGATÓRIO (SIM / NÃO)
================================================================

ARQUÉTIPO
- [ ] O arquétipo da página está explicitamente declarado?
- [ ] O arquétipo é permitido para esta página?
- [ ] A página mistura arquétipos? (SE SIM → BLOQUEAR)

DESIGN SYSTEM
- [ ] O layout segue o Design System do arquétipo?
- [ ] Componentes usados são permitidos?
- [ ] Nenhum componente proibido foi usado?
- [ ] A identidade visual do módulo foi respeitada?

GOLDEN PATH VISUAL
- [ ] A primeira ação percebida está clara?
- [ ] O caminho visual principal está evidente?
- [ ] Não existem fluxos visuais paralelos?
- [ ] Nenhuma decisão está escondida?
- [ ] O visual não pressiona o usuário?

PROIBIÇÕES
- [ ] Não existe wizard obrigatório?
- [ ] Não existe validação visual decisória?
- [ ] Não existe CTA que execute decisão automática?
- [ ] Não existe lógica visual baseada em categoria?

CORE
- [ ] O frontend continua sendo camada derivada?
- [ ] Nenhuma regra de negócio foi criada?
- [ ] Nenhuma validação de tempo foi criada?
- [ ] Nenhuma decisão foi inferida?

================================================================
REGRA DE BLOQUEIO
================================================================

Se QUALQUER item acima for NÃO:
→ PR BLOQUEADO
→ Correção obrigatória
→ Nova submissão

================================================================
SEÇÃO FINAL
================================================================

Declaração explícita:
- Checklist é obrigatório
- Não pode ser ignorado
- Não pode ser flexibilizado
- Em caso de conflito, documentos superiores prevalecem
