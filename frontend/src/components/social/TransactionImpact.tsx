// src/components/social/TransactionImpact.tsx
// Mostra "Para onde foi meu dinheiro" em posts com transação

import { useState, useEffect } from 'react';
import { getLedger } from '../../api/social';
import './TransactionImpact.css';

interface TransactionImpactProps {
  postId: string;
  ctaId?: string | null;
  currency?: string;
}

interface LedgerEntry {
  ledger_id: string;
  post_id: string | null;
  cta_id: string | null;
  recipient_actor_id: string | null;
  recipient_group_id: string | null;
  amount_cents: number;
  currency: string;
  amount_type: 'revenue' | 'profit_share' | 'donation' | 'commission';
  description: string | null;
  created_at: string;
}

export default function TransactionImpact({ postId, ctaId, currency = 'BRL' }: TransactionImpactProps) {
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!postId) {
      setIsLoading(false);
      return;
    }

    loadLedgerEntries();
  }, [postId, ctaId]);

  const loadLedgerEntries = async () => {
    try {
      setIsLoading(true);
      const response = await getLedger({ limit: 100 });
      
      // Filtrar entries relacionadas a este post
      const postEntries = response.entries.filter(
        (entry: LedgerEntry) => 
          entry.post_id === postId || 
          (ctaId && entry.cta_id === ctaId)
      );

      setLedgerEntries(postEntries);
    } catch (error) {
      console.warn('Erro ao buscar ledger entries:', error);
      setLedgerEntries([]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return null; // Não mostrar nada enquanto carrega
  }

  if (ledgerEntries.length === 0) {
    return null; // Não mostrar se não houver transações
  }

  // Agrupar entries por tipo (apenas valores reais do ledger)
  const revenueEntry = ledgerEntries.find(e => e.amount_type === 'revenue');
  const profitShareEntry = ledgerEntries.find(e => e.amount_type === 'profit_share') as LedgerEntry & { recipient_group_id?: string | null; group_name?: string | null } | undefined;
  const donationEntry = ledgerEntries.find(e => e.amount_type === 'donation');
  const commissionEntry = ledgerEntries.find(e => e.amount_type === 'commission');
  
  // Calcular total apenas somando valores reais do ledger
  const totalAmount = ledgerEntries.reduce((sum, entry) => sum + entry.amount_cents, 0);
  
  if (totalAmount === 0) {
    return null;
  }

  const formatPrice = (cents: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
    }).format(cents / 100);
  };

  return (
    <div className="transaction-impact">
      <div className="transaction-impact-header">
        <span className="impact-icon">💰</span>
        <span className="impact-title">Para onde foi meu dinheiro</span>
      </div>
      
      <div className="transaction-impact-list">
        {revenueEntry && revenueEntry.amount_cents > 0 && (
          <div className="transaction-impact-item">
            <span className="impact-item-label">Prestador / Organizador</span>
            <span className="impact-item-value">{formatPrice(revenueEntry.amount_cents)}</span>
          </div>
        )}
        
        {profitShareEntry && profitShareEntry.amount_cents > 0 && (
          <div className="transaction-impact-item transaction-impact-item--group">
            <div className="impact-item-group-info">
              <span className="impact-item-label">
                {profitShareEntry.recipient_group_id ? (
                  <>
                    <span className="group-icon">👥</span>
                    Comunidade beneficiada
                  </>
                ) : (
                  'Comunidade / Grupo'
                )}
              </span>
              {profitShareEntry.recipient_group_id && (
                <button
                  className="impact-item-group-link"
                  onClick={() => {
                    window.location.href = `/groups/${profitShareEntry.recipient_group_id}`;
                  }}
                >
                  Ver comunidade →
                </button>
              )}
            </div>
            <span className="impact-item-value">{formatPrice(profitShareEntry.amount_cents)}</span>
          </div>
        )}
        
        {donationEntry && donationEntry.amount_cents > 0 && (
          <div className="transaction-impact-item">
            <span className="impact-item-label">Doação</span>
            <span className="impact-item-value">{formatPrice(donationEntry.amount_cents)}</span>
          </div>
        )}
        
        {commissionEntry && commissionEntry.amount_cents > 0 && (
          <div className="transaction-impact-item">
            <span className="impact-item-label">Comissão</span>
            <span className="impact-item-value">{formatPrice(commissionEntry.amount_cents)}</span>
          </div>
        )}
      </div>

      <div className="transaction-impact-total">
        <span className="total-label">Total da transação</span>
        <span className="total-value">{formatPrice(totalAmount)}</span>
      </div>
    </div>
  );
}

