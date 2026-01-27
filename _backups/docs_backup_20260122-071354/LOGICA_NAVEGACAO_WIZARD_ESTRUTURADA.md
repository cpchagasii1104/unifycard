# LÓGICA ESTRUTURADA DE NAVEGAÇÃO DO WIZARD (APÓS CORREÇÃO)

## PRINCÍPIOS DA LÓGICA ESTRUTURADA

1. **Mapeamento Explícito:** Cada step tem um mapeamento claro de próximo/anterior
2. **Funções Separadas:** `getNextStep()` e `getPreviousStep()` são funções puras e testáveis
3. **Consistência:** Avançar e voltar são espelhos lógicos um do outro
4. **Independência:** Botão X é independente da navegação entre steps
5. **Clareza:** Cada condição é explícita e documentada

## ESTRUTURA DE STEPS

### Steps Principais:
- **Step 1:** Actor (obrigatório)
- **Step 2:** Tipo de Evento (obrigatório)
- **Step 2.5:** 
  - Se birthday sem faixa etária → BirthdayProfileStep
  - Se não birthday → EventFoundationStep
- **Step 2.6:** EventFoundationStep (apenas para birthday com faixa etária)
- **Step 3.5:** BirthdayWizard completo (steps 2-11 internos)
- **Step 3:** Contexto (visibilidade, convites)
- **Step 4:** Economia
- **Step 5:** Revisão e Publicação

## FUNÇÃO: getNextStep(step: number)

### Lógica de Avanço:

```typescript
Step 1 → Step 2 (sempre)

Step 2 → 
  - Se birthday sem faixa etária → Step 2.5 (BirthdayProfileStep)
  - Se não birthday mas precisa foundation → Step 2.5 (EventFoundationStep)
  - Caso contrário → Step 3 (Contexto)

Step 2.5 →
  - Se birthday com faixa etária e precisa foundation → Step 2.6 (EventFoundationStep)
  - Caso contrário → Step 3 (Contexto)

Step 2.6 →
  - Se tem birthday wizard → Step 3.5 (BirthdayWizard)
  - Caso contrário → Step 3 (Contexto)

Step 3.5 → Step 3 (Contexto)

Step 3 → Step 4 (Economia)

Step 4 → Step 5 (Revisão)

Step 5 → null (fim do wizard)
```

## FUNÇÃO: getPreviousStep(step: number)

### Lógica de Volta:

```typescript
Step 1 → null (não pode voltar)

Step 2 → Step 1

Step 2.5 → Step 2 (sempre)

Step 2.6 → Step 2.5

Step 3 →
  - Se tem birthday wizard → Step 3.5
  - Se tem foundation (birthday) → Step 2.6
  - Se tem foundation (não-birthday) → Step 2.5
  - Caso contrário → Step 2

Step 3.5 →
  - Se tem foundation → Step 2.6
  - Caso contrário → Step 2.5

Step 4 → Step 3

Step 5 → Step 4
```

## FUNÇÃO: handleNext()

```typescript
const handleNext = () => {
  if (!canProceedToNextStep()) {
    return; // Não pode avançar se validação falhar
  }

  const nextStep = getNextStep(currentStep);
  if (nextStep !== null) {
    setCurrentStep(nextStep);
    setError(null); // Limpar erros ao avançar
  }
};
```

## FUNÇÃO: handleBack()

```typescript
const handleBack = () => {
  const previousStep = getPreviousStep(currentStep);
  if (previousStep !== null) {
    setCurrentStep(previousStep);
    setError(null); // Limpar erros ao voltar
  }
};
```

## FUNÇÃO: handleClose()

```typescript
const handleClose = () => {
  // Verificar se há dados não salvos (independente do step atual)
  if (hasUnsavedData()) {
    const confirmed = window.confirm(
      'Você tem alterações não salvas. Deseja realmente sair? As alterações serão perdidas.'
    );
    if (!confirmed) {
      return; // Usuário cancelou - manter wizard aberto
    }
  }
  
  // Fechar wizard completamente - navegar para /eventos
  navigate('/eventos', { replace: true });
};
```

## FLUXO COMPLETO (BIRTHDAY)

1. **Step 1** (Actor) → `handleNext()` → **Step 2** (Tipo)
2. **Step 2** (Tipo: birthday) → `handleNext()` → **Step 2.5** (BirthdayProfileStep)
3. **Step 2.5** (Faixa etária definida) → `handleNext()` → **Step 2.6** (EventFoundationStep)
4. **Step 2.6** (Foundation) → `handleNext()` → **Step 3.5** (BirthdayWizard)
5. **Step 3.5** (BirthdayWizard completo) → `handleNext()` → **Step 3** (Contexto)
6. **Step 3** (Contexto) → `handleNext()` → **Step 4** (Economia)
7. **Step 4** (Economia) → `handleNext()` → **Step 5** (Revisão)

### Volta (Birthday):

1. **Step 5** → `handleBack()` → **Step 4**
2. **Step 4** → `handleBack()` → **Step 3**
3. **Step 3** → `handleBack()` → **Step 3.5** (se tem birthday wizard)
4. **Step 3.5** → `handleBack()` → **Step 2.6** (se tem foundation)
5. **Step 2.6** → `handleBack()` → **Step 2.5**
6. **Step 2.5** → `handleBack()` → **Step 2**
7. **Step 2** → `handleBack()` → **Step 1**

## FLUXO COMPLETO (NÃO-BIRTHDAY)

1. **Step 1** (Actor) → `handleNext()` → **Step 2** (Tipo)
2. **Step 2** (Tipo: não-birthday) → `handleNext()` → **Step 2.5** (EventFoundationStep)
3. **Step 2.5** (Foundation) → `handleNext()` → **Step 3** (Contexto)
4. **Step 3** (Contexto) → `handleNext()` → **Step 4** (Economia)
5. **Step 4** (Economia) → `handleNext()` → **Step 5** (Revisão)

### Volta (Não-Birthday):

1. **Step 5** → `handleBack()` → **Step 4**
2. **Step 4** → `handleBack()` → **Step 3**
3. **Step 3** → `handleBack()` → **Step 2.5** (se tem foundation) ou **Step 2**
4. **Step 2.5** → `handleBack()` → **Step 2**
5. **Step 2** → `handleBack()` → **Step 1**

## VANTAGENS DA LÓGICA ESTRUTURADA

1. **Testabilidade:** Funções puras `getNextStep()` e `getPreviousStep()` são fáceis de testar
2. **Manutenibilidade:** Cada transição é explícita e documentada
3. **Consistência:** Avançar e voltar são espelhos lógicos
4. **Clareza:** Código auto-documentado, fácil de entender
5. **Debugging:** Fácil identificar qual transição está sendo executada

## INDEPENDÊNCIA DO BOTÃO X

- **Botão X** (`handleClose`) é **independente** da navegação entre steps
- Não importa em qual step está - se tem dados não salvos, confirma antes de fechar
- Fecha o wizard completamente, navegando para `/eventos`
- Não interfere com `handleNext()` ou `handleBack()`

