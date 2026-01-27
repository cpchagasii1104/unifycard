# LÓGICA ATUAL DE NAVEGAÇÃO DO WIZARD (ANTES DA CORREÇÃO)

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

## LÓGICA ATUAL - handleNext()

```typescript
const handleNext = () => {
  if (canProceedToNextStep()) {
    // Se estiver no step 2 e for birthday, primeiro perguntar faixa etária
    if (currentStep === 2 && data.event_subtype === 'birthday' && !data.birthday_wizard?.birthday_profile) {
      setCurrentStep(2.5); // Ir para step de faixa etária
    }
    // Se estiver no step 2.5 e for birthday sem faixa etária, já foi definida, ir para foundation
    else if (currentStep === 2.5 && data.event_subtype === 'birthday' && data.birthday_wizard?.birthday_profile) {
      // Agora pode mostrar foundation
      if (shouldShowFoundationStep) {
        setCurrentStep(2.6); // Foundation step (renumerado)
      } else {
        setCurrentStep(3);
      }
    }
    // Se estiver no step 2.5 e não for birthday, é foundation step
    else if (currentStep === 2.5 && data.event_subtype !== 'birthday' && shouldShowFoundationStep) {
      setCurrentStep(3);
    }
    // Se estiver no step 2.6 (foundation para birthday), ir para birthday wizard completo
    else if (currentStep === 2.6) {
      if (shouldShowBirthdayWizard) {
        setCurrentStep(3.5); // Ir para birthday wizard completo (steps 2-11)
      } else {
        setCurrentStep(3);
      }
    } else if (currentStep === 3.5) {
      // Do birthday wizard, ir para step 3
      setCurrentStep(3);
    } else if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  }
};
```

## LÓGICA ATUAL - handleBack()

```typescript
const handleBack = () => {
  if (currentStep > 1) {
    // Se estiver no step 3 e deve mostrar birthday wizard, voltar para 3.5
    if (currentStep === 3 && shouldShowBirthdayWizard) {
      setCurrentStep(3.5);
    } else if (currentStep === 3.5) {
      // Do birthday wizard completo, voltar para foundation (2.6) ou step 2.5 se não tiver foundation
      if (data.event_subtype === 'birthday' && shouldShowFoundationStep) {
        setCurrentStep(2.6);
      } else {
        setCurrentStep(2.5);
      }
    } else if (currentStep === 2.6) {
      // Do foundation (birthday), voltar para step 2.5 (faixa etária já definida, mas pode editar)
      setCurrentStep(2.5);
    } else if (currentStep === 2.5) {
      // Se for birthday e não tem faixa etária, voltar para step 2
      // Se for birthday e tem faixa etária, voltar para step 2 (para redefinir)
      // Se não for birthday, voltar para step 2
      setCurrentStep(2);
    } else {
      setCurrentStep(currentStep - 1);
    }
  }
};
```

## PROBLEMAS IDENTIFICADOS

1. **Lógica Inconsistente:** `handleNext` e `handleBack` não são espelhos um do outro
2. **Múltiplos Casos Especiais:** Muitas condições aninhadas dificultam manutenção
3. **Step 2.5 Ambíguo:** Pode ser BirthdayProfileStep OU EventFoundationStep
4. **Botão X:** Pode não estar respeitando o estado atual do wizard ao fechar
5. **Falta de Rastreamento:** Não há histórico de navegação para voltar corretamente

## FLUXO ESPERADO (BIRTHDAY)

1. Step 1 (Actor) → Step 2 (Tipo)
2. Step 2 (Tipo: birthday) → Step 2.5 (BirthdayProfileStep)
3. Step 2.5 (Faixa etária definida) → Step 2.6 (EventFoundationStep)
4. Step 2.6 (Foundation) → Step 3.5 (BirthdayWizard)
5. Step 3.5 (BirthdayWizard completo) → Step 3 (Contexto)
6. Step 3 (Contexto) → Step 4 (Economia)
7. Step 4 (Economia) → Step 5 (Revisão)

## FLUXO ESPERADO (NÃO-BIRTHDAY)

1. Step 1 (Actor) → Step 2 (Tipo)
2. Step 2 (Tipo: não-birthday) → Step 2.5 (EventFoundationStep)
3. Step 2.5 (Foundation) → Step 3 (Contexto)
4. Step 3 (Contexto) → Step 4 (Economia)
5. Step 4 (Economia) → Step 5 (Revisão)

