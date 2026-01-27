import type { ComboDiscountRule } from '../api/categories';

export function useComboDiscountRulesLogic() {
  const validateRule = (rule: ComboDiscountRule): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (rule.minServices < 2) {
      errors.push('Mínimo de serviços deve ser pelo menos 2');
    }
    
    if (rule.discountPercentage < 0 || rule.discountPercentage > 100) {
      errors.push('Desconto deve estar entre 0% e 100%');
    }
    
    return { valid: errors.length === 0, errors };
  };

  return {
    validateRule,
  };
}



