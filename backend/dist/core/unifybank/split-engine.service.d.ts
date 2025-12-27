import type { ApplySplitInput, ApplySplitResult, CompensateTransactionInput, CompensateTransactionResult } from './split-engine.types';
declare class SplitEngineService {
    /**
     * Obtém regra de split padrão para um contexto
     * Por enquanto, regras em memória (MVP)
     * Futuro: buscar do banco de dados
     */
    private getDefaultSplitRule;
    /**
     * Valida regra de split
     * - Soma de percentuais deve ser 1.0 (100%)
     * - Todos os percentuais devem ser >= 0 e <= 1
     */
    private validateSplitRule;
    /**
     * Gera eventId determinístico para split
     * Hash de: originTransactionId + splitGroupId + targetType + targetId + percentage
     */
    private generateDeterministicEventId;
    /**
     * Cria transferência dentro de uma transação SQL existente
     * Usa o mesmo client para garantir atomicidade
     */
    private createTransferInTransaction;
    /**
     * Resolve conta de destino baseado no targetType
     */
    private resolveTargetAccount;
    /**
     * Aplica split em uma transação base
     *
     * Fluxo:
     * 1. Validar entrada
     * 2. Obter regra de split
     * 3. Validar regra
     * 4. Resolver contas de destino
     * 5. Criar transações de split (todas na mesma transação SQL)
     * 6. Registrar metadados no ledger
     * 7. Retornar resultado
     */
    applySplit(input: ApplySplitInput): Promise<ApplySplitResult>;
    /**
     * Busca regra de split por ID (futuro: do banco)
     * Por enquanto, retorna null (usa default)
     */
    private getSplitRuleById;
    /**
     * Compensa uma transação criando transação inversa
     *
     * NÃO altera lançamentos existentes
     * Cria nova transação que inverte débitos/créditos
     */
    compensateTransaction(input: CompensateTransactionInput): Promise<CompensateTransactionResult>;
}
export declare const splitEngineService: SplitEngineService;
export {};
//# sourceMappingURL=split-engine.service.d.ts.map