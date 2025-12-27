export interface SocialLedgerEntry {
    ledger_id: string;
    tenant_id: string;
    post_id: string | null;
    cta_id: string | null;
    transaction_id: string | null;
    recipient_actor_id: string | null;
    recipient_group_id: string | null;
    owner_actor_id: string | null;
    amount_cents: number;
    currency: string;
    amount_type: 'revenue' | 'profit_share' | 'donation' | 'commission';
    description: string | null;
    metadata: Record<string, any>;
    idempotency_key: string | null;
    created_at: string;
}
export interface UserLedgerSummary {
    total_revenue_cents: number;
    total_profit_share_received_cents: number;
    total_donations_given_cents: number;
    total_commissions_cents: number;
    group_contributions: Array<{
        group_id: string;
        group_name: string;
        total_contributed_cents: number;
    }>;
}
export declare class SocialLedgerService {
    /**
     * Registra entrada no ledger (append-only, imutável)
     * IMPORTANTE: Ledger só deve ser criado de transação econômica REAL (pagamento/contratação confirmados)
     * NÃO criar ledger automaticamente ao criar post com CTA/preço.
     */
    recordEntry(tenantId: string, data: {
        post_id?: string;
        cta_id?: string;
        transaction_id?: string;
        recipient_actor_id?: string;
        recipient_group_id?: string;
        owner_actor_id?: string;
        amount_cents: number;
        currency?: string;
        amount_type: 'revenue' | 'profit_share' | 'donation' | 'commission';
        description?: string;
        metadata?: Record<string, any>;
        idempotency_key?: string;
    }): Promise<SocialLedgerEntry>;
    /**
     * Busca entrada por ID
     */
    private getEntryById;
    /**
     * Busca ledger de um usuário (ganhos pessoais + repasses)
     */
    getUserLedger(tenantId: string, globalUserId: string, limit?: number): Promise<SocialLedgerEntry[]>;
    /**
     * Resumo do ledger do usuário
     */
    getUserLedgerSummary(tenantId: string, globalUserId: string): Promise<UserLedgerSummary>;
}
export declare const socialLedgerService: SocialLedgerService;
//# sourceMappingURL=social-ledger.service.d.ts.map