# CHECKLIST — ALTERAÇÃO DE SCHEMA

## Status
ATIVO • OBRIGATÓRIO • RISCO CRÍTICO

Este checklist deve ser utilizado
ANTES de qualquer alteração de schema:
tabelas, colunas, constraints, índices, enums, tipos ou relações.

Se qualquer item falhar → **NÃO PROSSIGA**.

---

## 1. NECESSIDADE REAL

- [ ] Existe uma necessidade REAL de alterar o schema?
- [ ] O problema NÃO pode ser resolvido apenas em código?
- [ ] A alteração NÃO é “só para facilitar” uma feature?

Schema é infraestrutura.  
Alterar sem necessidade cria dívida permanente.

---

## 2. DECISÃO FORMAL

- [ ] Existe decisão explícita em `docs/02_decisions/`?
- [ ] A decisão descreve claramente:
  - o que muda
  - por que muda
  - impacto esperado?
- [ ] Não estou inferindo decisão a partir de conversa ou IA?

Sem decisão → sem schema.

---

## 3. TIPO DE ALTERAÇÃO

Marque TODAS que se aplicam:

- [ ] Adição de coluna
- [ ] Remoção de coluna
- [ ] Alteração de tipo
- [ ] Alteração de nullability
- [ ] Nova tabela
- [ ] Alteração de constraint
- [ ] Alteração de índice
- [ ] Alteração de enum / tipo fechado

Cada tipo acima exige cuidado extra.

---

## 4. BACKWARD COMPATIBILITY

- [ ] A alteração é backward-compatible?
- [ ] Código antigo continua funcionando?
- [ ] Leitura de dados antigos continua válida?
- [ ] Existe plano de transição (se necessário)?

Se quebra compatibilidade → risco alto.

---

## 5. MIGRATIONS

- [ ] Existe migration clara e isolada?
- [ ] Migration NÃO mistura múltiplas intenções?
- [ ] Migration é reversível (ou rollback aceitável)?
- [ ] Script `check-migration-numbering.js` continua passando?

Schema sem migration correta quebra CI e deploy.

---

## 6. DADOS EXISTENTES

- [ ] Impacto em dados existentes foi avaliado?
- [ ] Não haverá perda silenciosa de dados?
- [ ] Defaults perigosos NÃO estão sendo usados?
- [ ] Backfill é explícito (se necessário)?

Dados silenciosamente alterados = bug grave.

---

## 7. IMPACTO TRANSVERSAL

- [ ] Avaliei impacto em:
  - backend
  - frontend
  - APIs públicas
  - integrações
  - relatórios
  - jobs / cron
- [ ] Nada depende implicitamente do schema antigo?

Schema muda tudo, mesmo quando parece pequeno.

---

## 8. TESTES E VALIDAÇÃO

- [ ] Testes relevantes cobrem a alteração?
- [ ] Não estou confiando apenas em “funciona local”?
- [ ] Erros de schema falham explicitamente?

Schema sem teste é aposta.

---

## 9. USO DE IA

- [ ] IA foi instruída a NÃO propor schema novo?
- [ ] IA NÃO tomou decisão estrutural?
- [ ] IA apenas executou decisão documentada?

IA não decide banco de dados.

---

## 10. DOCUMENTAÇÃO

- [ ] Decisão está documentada
- [ ] Alteração está registrada no local correto
- [ ] Nenhum documento canônico foi violado

Schema sem rastro é dívida eterna.

---

## 11. CONFIRMAÇÃO FINAL

- [ ] Todos os itens acima foram verificados
- [ ] Nenhuma exceção informal foi aceita
- [ ] Não é “só dessa vez”

Se tudo estiver marcado → **PODE PROSSEGUIR**.

---

## REGRA FINAL

> Schema é contrato de longo prazo.
> Mudança apressada vira problema permanente.

Fim.
