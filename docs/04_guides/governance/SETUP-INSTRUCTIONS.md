# Setup Instructions — Instruções de Configuração

**Status:** `CORE`  
**Data de Criação:** 2025-01-22

---

## Objetivo

Este documento fornece instruções passo a passo para configurar o sistema de governança do Unificard no GitHub.

---

## Passo 1: Configurar CODEOWNERS

### 1.1 Verificar Arquivo

O arquivo `.github/CODEOWNERS` já foi criado. Verifique se está correto:

```bash
cat .github/CODEOWNERS
```

### 1.2 Substituir Placeholder

**IMPORTANTE:** Substitua `@unificard/core-team` pelo time real do GitHub.

**Opções:**

1. **Usuário específico:**
   ```
   /backend/src/core/ @username
   ```

2. **Time do GitHub:**
   ```
   /backend/src/core/ @org/team-name
   ```

3. **Múltiplos owners:**
   ```
   /backend/src/core/ @user1 @user2 @org/team
   ```

### 1.3 Commit e Push

```bash
git add .github/CODEOWNERS
git commit -m "feat: adicionar CODEOWNERS para governança"
git push
```

---

## Passo 2: Configurar Branch Protection

### 2.1 Acessar Configurações

1. Vá para o repositório no GitHub
2. Clique em **Settings**
3. Clique em **Branches** (no menu lateral)
4. Clique em **Add rule** (ou edite regra existente)

### 2.2 Configurar Regra

**Branch name pattern:** `main` (ou `master`, conforme seu repositório)

#### 2.2.1 Require Pull Request Reviews

✅ Marque as seguintes opções:

- **Require pull request reviews before merging**
  - **Required number of approvals:** `1`
  - ✅ **Dismiss stale pull request approvals when new commits are pushed**
  - ✅ **Require review from CODEOWNERS**

#### 2.2.2 Require Status Checks

✅ Marque as seguintes opções:

- **Require status checks to pass before merging**
  - ✅ **Require branches to be up to date before merging**
  - **Status checks:**
    - `test` (se configurado)
    - `lint` (se configurado)
    - `build` (se configurado)
    - `test:invariants` (se configurado)

**Nota:** Se CI/CD ainda não estiver configurado, você pode pular esta seção por enquanto e configurar depois.

#### 2.2.3 Require Conversation Resolution

✅ Marque:

- **Require conversation resolution before merging**

#### 2.2.4 Do Not Allow Bypassing

✅ Marque:

- **Do not allow bypassing the above settings**

**IMPORTANTE:** Isso garante que mesmo admins não possam fazer merge sem aprovação.

### 2.3 Salvar

Clique em **Create** (ou **Save changes** se editando regra existente).

---

## Passo 3: Verificar PR Template

### 3.1 Verificar Arquivo

O arquivo `.github/PULL_REQUEST_TEMPLATE.md` já foi criado. Verifique se está correto:

```bash
cat .github/PULL_REQUEST_TEMPLATE.md
```

### 3.2 Testar Template

1. Crie um PR de teste
2. Verifique se o template aparece automaticamente
3. Preencha os checkboxes
4. Verifique se CODEOWNER é solicitado automaticamente

---

## Passo 4: Configurar CI/CD (Opcional)

### 4.1 GitHub Actions

Se você usa GitHub Actions, adicione workflow para executar testes de invariantes:

**Arquivo:** `.github/workflows/invariants.yml`

```yaml
name: Invariants Tests

on:
  pull_request:
    branches: [main, master]
  push:
    branches: [main, master]

jobs:
  test-invariants:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:invariants
```

### 4.2 Outros CI/CD

Se você usa outros sistemas (CircleCI, Jenkins, etc.), adicione step para executar:

```bash
npm run test:invariants
```

---

## Passo 5: Verificar Funcionamento

### 5.1 Testar CODEOWNERS

1. Crie um PR que toque em `backend/src/core/auth/`
2. Verifique se CODEOWNER é solicitado automaticamente
3. Verifique se merge está bloqueado até aprovação

### 5.2 Testar PR Template

1. Crie um PR
2. Verifique se template aparece
3. Preencha checkboxes
4. Verifique se merge está bloqueado se checkboxes não preenchidos (se configurado)

### 5.3 Testar Branch Protection

1. Tente fazer merge direto na branch protegida
2. Verifique se merge é bloqueado
3. Crie PR e tente fazer merge sem aprovação
4. Verifique se merge é bloqueado

---

## Troubleshooting

### CODEOWNERS não funciona

**Possíveis causas:**

1. Arquivo não está em `.github/CODEOWNERS`
2. Syntax incorreta (espaços, tabs)
3. Usuário/time não existe no GitHub
4. Branch protection não está configurado

**Solução:**

1. Verifique localização do arquivo
2. Verifique syntax: `<path> <@username>`
3. Verifique se usuário/time existe
4. Configure branch protection

### PR Template não aparece

**Possíveis causas:**

1. Arquivo não está em `.github/PULL_REQUEST_TEMPLATE.md`
2. Nome do arquivo está incorreto
3. Arquivo não está na branch correta

**Solução:**

1. Verifique localização do arquivo
2. Verifique nome do arquivo (case-sensitive)
3. Certifique-se de que arquivo está na branch `main`/`master`

### Branch Protection não bloqueia

**Possíveis causas:**

1. Regra não está configurada corretamente
2. Branch name pattern não corresponde
3. "Do not allow bypassing" não está marcado

**Solução:**

1. Verifique configuração da regra
2. Verifique branch name pattern
3. Marque "Do not allow bypassing"

---

## Checklist Final

- [ ] `.github/CODEOWNERS` criado e configurado
- [ ] `@unificard/core-team` substituído por time real
- [ ] Branch protection configurado
- [ ] PR template criado e testado
- [ ] CI/CD configurado (opcional)
- [ ] CODEOWNERS testado (PR toca área protegida)
- [ ] Branch protection testado (merge bloqueado)

---

## Referências

- **CODEOWNERS:** [`.github/CODEOWNERS`](../../.github/CODEOWNERS)
- **PR Template:** [`.github/PULL_REQUEST_TEMPLATE.md`](../../.github/PULL_REQUEST_TEMPLATE.md)
- **Processo de Revisão:** [`CODE-REVIEW-PROCESS.md`](CODE-REVIEW-PROCESS.md)
- **Visão Geral:** [`GOVERNANCE-OVERVIEW.md`](GOVERNANCE-OVERVIEW.md)

---

## Suporte

Se encontrar problemas, consulte:

1. [GitHub Docs: CODEOWNERS](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
2. [GitHub Docs: Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
3. [GitHub Docs: PR Templates](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template)

