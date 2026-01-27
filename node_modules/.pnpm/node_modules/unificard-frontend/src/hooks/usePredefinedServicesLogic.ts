import type { PredefinedService } from '../api/categories';
import { validateMonetaryValue } from '../utils/validation';

export function usePredefinedServicesLogic() {
  const validateService = (service: PredefinedService): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (!service.name || service.name.trim().length < 3) {
      errors.push('Nome do serviço deve ter pelo menos 3 caracteres');
    }
    
    const priceValidation = validateMonetaryValue(service.basePrice);
    if (!priceValidation.valid) {
      errors.push(priceValidation.error || 'Preço base inválido');
    }
    
    if (service.discountPercentage !== undefined) {
      if (service.discountPercentage < 0 || service.discountPercentage > 100) {
        errors.push('Desconto deve estar entre 0% e 100%');
      }
    }
    
    return { valid: errors.length === 0, errors };
  };

  const calculateFinalPrice = (basePrice: number, discountPercentage: number): number => {
    return basePrice * (1 - discountPercentage / 100);
  };

  return {
    validateService,
    calculateFinalPrice,
  };
}



