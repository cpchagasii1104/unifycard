import type { FeeConfig, FeeCalculation, DistributionResult, AutoDistributeInput } from './distribution.types';
declare class DistributionService {
    /**
     * Calcula fees de uma transação
     *
     * @param amount - Valor da transação
     * @param config - Configuração de fees (opcional, usa default se não fornecido)
     * @returns Cálculo detalhado dos fees
     */
    calculateFees(amount: number, config?: Partial<FeeConfig>): FeeCalculation;
    /**
     * Distribui fundos automaticamente com cálculo de fees
     *
     * FLUXO:
     * 1. Calcula fees
     * 2. Transfere valor líquido para destinatário
     * 3. Distribui fees para contas de sistema
     * 4. Emite eventos de distribuição
     *
     * GARANTIAS:
     * - Tudo em transações atômicas
     * - Idempotência via event_id
     * - Double-entry bookkeeping automático
     * - Auditabilidade completa
     */
    autoDistribute(tenantId: string, input: AutoDistributeInput): Promise<DistributionResult>;
    /**
     * Recalcula fees em lote (útil para ajustes de configuração)
     *
     * NOTA: Isso NÃO cria transações, apenas calcula quanto seria
     * distribuído com as novas configurações.
     */
    batchRecalculateFees(amounts: number[], config?: Partial<FeeConfig>): Promise<FeeCalculation[]>;
    /**
     * Simula uma distribuição sem executar
     * Útil para preview antes de confirmar
     */
    simulateDistribution(amount: number, config?: Partial<FeeConfig>): Promise<FeeCalculation>;
    /**
     * Busca configuração de fees de um tenant
     * (Por enquanto retorna default, mas pode ser estendido para config por tenant no DB)
     */
    getFeeConfig(_tenantId: string): Promise<FeeConfig>;
    /**
     * Atualiza configuração de fees de um tenant
     * (Implementação futura: salvar no banco)
     */
    updateFeeConfig(_tenantId: string, _config: Partial<FeeConfig>): Promise<FeeConfig>;
}
export declare const distributionService: DistributionService;
export {};
//# sourceMappingURL=distribution.service.d.ts.map