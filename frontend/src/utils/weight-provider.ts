// src/utils/weight-provider.ts
// SPRINT 42.2: Abstração para balança (opcional)
// Placeholder para futura integração (ex: WebSerial/WebUSB)

/**
 * Interface para provedor de peso
 * 
 * Permite abstrair entrada de peso:
 * - Manual (input)
 * - Balança física (futuro: WebSerial/WebUSB)
 */
export interface WeightProvider {
  /**
   * Obtém peso atual (em kg)
   * Retorna null se não disponível
   */
  getCurrentWeight(): Promise<number | null>;

  /**
   * Verifica se balança está disponível
   */
  isAvailable(): Promise<boolean>;

  /**
   * Inicia leitura contínua (opcional)
   */
  startReading?(callback: (weight: number) => void): Promise<void>;

  /**
   * Para leitura contínua (opcional)
   */
  stopReading?(): Promise<void>;
}

/**
 * Implementação padrão: input manual
 */
class ManualWeightProvider implements WeightProvider {
  private currentWeight: number | null = null;

  setWeight(weight: number | null) {
    this.currentWeight = weight;
  }

  async getCurrentWeight(): Promise<number | null> {
    return this.currentWeight;
  }

  async isAvailable(): Promise<boolean> {
    return true; // Sempre disponível (input manual)
  }
}

/**
 * Factory para criar provedor de peso
 * 
 * Por enquanto, apenas retorna implementação manual.
 * Futuro: pode retornar WebSerialWeightProvider, WebUSBWeightProvider, etc.
 */
export function createWeightProvider(): WeightProvider {
  // Por enquanto, apenas manual
  // Futuro: verificar se balança está disponível e retornar provider apropriado
  return new ManualWeightProvider();
}

/**
 * Hook para usar provedor de peso
 * 
 * Exemplo de uso:
 * ```tsx
 * const { weight, setWeight, isAvailable } = useWeightProvider();
 * ```
 */
export function useWeightProvider() {
  const provider = createWeightProvider();
  const manualProvider = provider as ManualWeightProvider;

  return {
    weight: null as number | null,
    setWeight: (weight: number | null) => {
      manualProvider.setWeight(weight);
    },
    isAvailable: async () => await provider.isAvailable(),
  };
}







