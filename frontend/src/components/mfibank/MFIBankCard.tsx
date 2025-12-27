// frontend/src/components/mfibank/MFIBankCard.tsx
// Card principal da Conta MFIBank no Dashboard

import { useState } from 'react';
import MFIBankSummary from './MFIBankSummary';
import MFIBankRecentTransactions from './MFIBankRecentTransactions';
import TransactionDetail from '../TransactionDetail';
import './MFIBankCard.css';

interface MFIBankCardProps {
  onViewFullStatement?: () => void;
}

export default function MFIBankCard({ onViewFullStatement }: MFIBankCardProps) {
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);

  const handleTransactionClick = (transactionId: string) => {
    setSelectedTransactionId(transactionId);
  };

  const handleCloseDetail = () => {
    setSelectedTransactionId(null);
  };

  if (selectedTransactionId) {
    return (
      <div className="mfibank-card">
        <TransactionDetail
          transactionId={selectedTransactionId}
          onClose={handleCloseDetail}
        />
      </div>
    );
  }

  return (
    <div className="mfibank-card">
      <div className="mfibank-card-header">
        <h2>MFIBank</h2>
        <p className="mfibank-card-subtitle">Sua conta financeira unificada</p>
      </div>

      <div className="mfibank-card-content">
        <MFIBankSummary onViewFullStatement={onViewFullStatement} />
        <MFIBankRecentTransactions onTransactionClick={handleTransactionClick} />
      </div>
    </div>
  );
}















