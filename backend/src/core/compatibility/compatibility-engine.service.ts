// backend/src/core/compatibility/compatibility-engine.service.ts
// Motor de Compatibilidade Técnica e Capacidade
// 🔴 BLINDAGEM: Validação antes de booking/confirm

import type {
  CompatibilityResult,
  CompatibilityStatus,
  CompatibilityInput,
} from './compatibility-engine.types';
import type { EventCapacityClass } from './event-capacity.types';

class CompatibilityEngineService {
  /**
   * Avalia compatibilidade entre evento e setup de serviço
   */
  evaluateCompatibility(input: CompatibilityInput): CompatibilityResult {
    const {
      eventCapacity,
      venueInfrastructure,
      serviceSetup,
      basePriceCents,
    } = input;

    const result: CompatibilityResult = {
      status: 'OK',
      missingRequired: [],
      missingOptional: [],
      extraAvailable: [],
      pricing: {
        reason: [],
      },
    };

    // 1. Verificar capacidade
    const capacityMismatch = this.checkCapacityCompatibility(
      eventCapacity.capacityClass as EventCapacityClass,
      serviceSetup.minCapacityClass as EventCapacityClass | undefined,
      serviceSetup.maxCapacityClass as EventCapacityClass | undefined
    );

    if (capacityMismatch) {
      result.capacityMismatch = true;
      result.status = 'BLOCKED';
      result.pricing.reason.push('Capacidade do evento fora do range do setup');
    }

    // 2. Verificar infraestrutura requerida
    const missingRequired = this.findMissingItems(
      serviceSetup.requires,
      venueInfrastructure.available
    );

    if (missingRequired.length > 0) {
      result.missingRequired = missingRequired;
      result.status = 'BLOCKED';
      result.pricing.reason.push(`Faltam itens obrigatórios: ${missingRequired.join(', ')}`);
    }

    // 3. Verificar infraestrutura opcional
    const missingOptional = serviceSetup.optional
      ? this.findMissingItems(serviceSetup.optional, venueInfrastructure.available)
      : [];

    if (missingOptional.length > 0) {
      result.missingOptional = missingOptional;
      if (result.status === 'OK') {
        result.status = 'WARNING';
      }
      result.pricing.reason.push(`Itens opcionais não disponíveis: ${missingOptional.join(', ')}`);
    }

    // 4. Verificar itens extras disponíveis (positivo)
    const extraAvailable = this.findExtraItems(
      venueInfrastructure.available,
      [...(serviceSetup.requires || []), ...(serviceSetup.optional || [])]
    );

    if (extraAvailable.length > 0) {
      result.extraAvailable = extraAvailable;
    }

    // 5. Verificar se requer produção assistida (XL/XXL)
    if (eventCapacity.capacityClass === 'XL' || eventCapacity.capacityClass === 'XXL') {
      result.requiresProductionAssistance = true;
      if (result.status === 'OK') {
        result.status = 'WARNING';
      }
      result.pricing.reason.push('Eventos XL/XXL requerem produção assistida');
    }

    // 6. Calcular precificação
    if (basePriceCents) {
      result.pricing.basePriceCents = basePriceCents;
      result.pricing.modifierApplied = serviceSetup.priceModifier;
      result.pricing.finalPriceCents = Math.round(basePriceCents * serviceSetup.priceModifier);
      result.pricing.reason.push(
        `Preço base: R$ ${(basePriceCents / 100).toFixed(2)}, Modificador: ${serviceSetup.priceModifier}x`
      );
    }

    return result;
  }

  /**
   * Verifica compatibilidade de capacidade
   */
  private checkCapacityCompatibility(
    eventCapacity: EventCapacityClass,
    minCapacity?: EventCapacityClass,
    maxCapacity?: EventCapacityClass
  ): boolean {
    if (!minCapacity && !maxCapacity) {
      return false; // Sem restrição de capacidade
    }

    const capacityOrder: EventCapacityClass[] = ['S', 'M', 'L', 'XL', 'XXL'];
    const eventIndex = capacityOrder.indexOf(eventCapacity);

    if (minCapacity) {
      const minIndex = capacityOrder.indexOf(minCapacity);
      if (eventIndex < minIndex) {
        return true; // Evento menor que mínimo
      }
    }

    if (maxCapacity) {
      const maxIndex = capacityOrder.indexOf(maxCapacity);
      if (eventIndex > maxIndex) {
        return true; // Evento maior que máximo
      }
    }

    return false; // Compatível
  }

  /**
   * Encontra itens faltantes
   */
  private findMissingItems(required: string[], available: string[]): string[] {
    return required.filter(item => !available.includes(item));
  }

  /**
   * Encontra itens extras disponíveis
   */
  private findExtraItems(available: string[], required: string[]): string[] {
    return available.filter(item => !required.includes(item));
  }
}

export const compatibilityEngineService = new CompatibilityEngineService();




