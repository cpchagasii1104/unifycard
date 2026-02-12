# Setup: Checklist Financeiro Obrigatório em PRs

## Objetivo

Este documento descreve como configurar o checklist financeiro obrigatório para Pull Requests no GitHub.

## Componentes Implementados

### 1. Template de PR

**Arquivo:** `.github/PULL_REQUEST_TEMPLATE.md`

O template inclui uma seção obrigatória de checklist financeiro que aparece automaticamente em todos os PRs.

### 2. GitHub Action

**Arquivo:** `.github/workflows/pr-financial-check.yml`

Workflow que:
- Detecta se PR toca em código financeiro
- Verifica se checklist financeiro está completo
- Comenta no PR se checklist incompleto
- **Falha o workflow** se checklist incompleto (bloqueia merge)

### 3. CODEOWNERS

**Arquivo:** `.github/CODEOWNERS`

Domínio Bank protegido:
- `/backend/src/core/bank/` — Requer aprovação de CODEOWNER
- `/backend/src/modules/bank/` — Requer aprovação de CODEOWNER
- Scripts de validação financeira protegidos

## Configuração Necessária

### Passo 1: Verificar Template de PR

O template já está configurado em `.github/PULL_REQUEST_TEMPLATE.md`. Verifique se a seção de checklist financeiro está presente.

### Passo 2: Verificar GitHub Action

O workflow `.github/workflows/pr-financial-check.yml` já está criado. Ele será executado automaticamente em PRs.

### Passo 3: Configurar Branch Protection (Obrigatório)

Para tornar o checklist verdadeiramente bloqueante, configure branch protection no GitHub:

1. Vá para **Settings** → **Branches**
2. Clique em **Add rule** (ou edite regra existente)
3. Configure para branches `main` e `develop`:
   - ✅ **Require status checks to pass before merging**
   - ✅ **Require branches to be up to date before merging**
   - ✅ Adicione check: `Verify Financial Checklist`
   - ✅ **Do not allow bypassing the above settings**

### Passo 4: Testar

1. Crie um PR de teste que toque em código financeiro
2. Verifique se:
   - Template aparece automaticamente
   - GitHub Action executa
   - Checklist incompleto bloqueia merge
   - Checklist completo permite merge

## Como Funciona

### Detecção Automática

O GitHub Action detecta automaticamente se um PR toca em código financeiro verificando se arquivos modificados estão em:

- `backend/src/core/bank`
- `backend/src/modules/bank`
- `backend/src/core/economy`
- `backend/src/modules/marketplace`
- `backend/src/core/events`
- `backend/migrations`

### Verificação de Checklist

O workflow verifica se todos os 8 itens do checklist estão marcados:

1. Este PR NÃO cria saldo fora do Bank
2. Este PR NÃO calcula dinheiro fora do Bank
3. Este PR NÃO cria ledger fora do Bank
4. Este PR NÃO cria transaction fora do Bank
5. Este PR NÃO cria split fora do Bank
6. Este PR NÃO adiciona vocabulário financeiro fora do Bank
7. Este PR respeita o SSOT financeiro definido em docs/01_normative/
8. Se toca em dinheiro, passa EXCLUSIVAMENTE pelo Bank

### Bloqueio de Merge

Se o checklist estiver incompleto:

1. ✅ GitHub Action **falha** (status check vermelho)
2. ✅ Comentário automático no PR alertando sobre checklist incompleto
3. ✅ Merge **bloqueado** (se branch protection configurado)

## Troubleshooting

### Checklist não aparece no PR

**Causa:** Template não está na branch correta ou nome incorreto.

**Solução:**
- Verifique se `.github/PULL_REQUEST_TEMPLATE.md` existe na branch `main`
- Nome deve ser exatamente `PULL_REQUEST_TEMPLATE.md` (case-sensitive)

### GitHub Action não executa

**Causa:** Workflow não está configurado corretamente.

**Solução:**
- Verifique se `.github/workflows/pr-financial-check.yml` existe
- Verifique se está na branch `main`
- Verifique logs do GitHub Actions

### Checklist completo mas merge ainda bloqueado

**Causa:** Outros status checks falhando ou branch protection configurado incorretamente.

**Solução:**
- Verifique todos os status checks no PR
- Verifique configuração de branch protection
- Verifique se `validate:financial-vocabulary` e `validate:financial-ssot` passam

## Referências

- [PR Checklist Financeiro](./PR-CHECKLIST-FINANCIAL.md)
- [Financial Vocabulary Lint](../../../backend/docs/FINANCIAL_VOCABULARY_LINT.md)
- [Financial SSOT Test](../../../backend/docs/FINANCIAL_SSOT_TEST.md)




