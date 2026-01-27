# CHECKLIST — ALTERAÇÃO DE MIGRATIONS

## Status
ATIVO • OBRIGATÓRIO • RISCO CRÍTICO

Este checklist deve ser utilizado
ANTES de qualquer ação envolvendo migrations:
criação, renomeação, edição, reexecução ou exclusão.

Se qualquer item falhar → **NÃO PROSSIGA**.

---

## 1. NECESSIDADE REAL

- [ ] Existe uma necessidade REAL de criar ou alterar migration?
- [ ] A mudança NÃO pode ser resolvida sem tocar em migrations?
- [ ] Não estou tentando “consertar depois” algo mal decidido?

Migration errada vira problema eterno.

---

## 2. DECISÃO FORMAL

- [ ] Existe decisão explícita em `docs/02_decisions/`?
- [ ] A decisão autoriza criação/alteração de migration?
- [ ] Não estou inferindo decisão a partir de conversa ou IA?

Sem decisão → sem migration.

---

## 3. TIPO DE AÇÃO

Marque TODAS que se aplicam:

- [ ] Criar nova migration
- [ ] Renomear migration existente
- [ ] Editar migration existente
- [ ] Reexecutar migration
- [ ] Excluir migration (extremo)

Cada tipo acima aumenta o risco.

---

## 4. REGRA DE IMUTABILIDADE

- [ ] Migration já executada em produção NÃO foi editada
- [ ] Se foi editada, existe justificativa formal documentada
- [ ] O impacto é conhecido e controlado

Migration executada não se reescreve.

---

## 5. NUMERAÇÃO E ORDEM

- [ ] Numeração é única
- [ ] Sufixos são únicos
- [ ] Ordem é consistente
- [ ] Script `check-migration-numbering.js` passa (exit 0)

Quebrar isso mata CI.

---

## 6. CONTEÚDO DA MIGRATION

- [ ] Migration tem UMA intenção clara
- [ ] Não mistura múltiplas mudanças
- [ ] Não contém lógica condicional perigosa
- [ ] Não depende de estado externo

Migration não é código de aplicação.

---

## 7. REVERSIBILIDADE

- [ ] Existe rollback possível?
- [ ] Rollback é seguro?
- [ ] Se não for reversível, o risco foi aceito formalmente?

Irreversível sem decisão é irresponsável.

---

## 8. IMPACTO EM DADOS

- [ ] Impacto em dados existentes foi avaliado
- [ ] Não haverá perda silenciosa
- [ ] Backfill é explícito e controlado
- [ ] Defaults perigosos foram evitados

Dados não se recuperam facilmente.

---

## 9. AMBIENTES

- [ ] Migration foi testada em ambiente local
- [ ] Migration foi testada em staging (se existir)
- [ ] Não estou confiando apenas em “funcionou uma vez”

Migration funciona em todos os ambientes ou não funciona.

---

## 10. USO DE IA

- [ ] IA NÃO criou migration sozinha
- [ ] IA NÃO editou migration executada
- [ ] IA apenas executou decisão documentada

IA não escreve histórico do banco.

---

## 11. DOCUMENTAÇÃO

- [ ] Alteração está documentada no local correto
- [ ] Decisão foi atualizada se necessário
- [ ] Evidência foi registrada

Migration sem rastro é falha grave.

---

## 12. CONFIRMAÇÃO FINAL

- [ ] Todos os itens acima foram verificados
- [ ] Nenhuma exceção informal foi aceita
- [ ] Não é “só dessa vez”

Se tudo estiver marcado → **PODE PROSSEGUIR**.

---

## REGRA FINAL

> Migration é história imutável.
> Mexer sem rigor destrói confiança no sistema.

Fim.
