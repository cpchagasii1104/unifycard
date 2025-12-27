// src/pages/WalletPage.tsx
// Página de extrato/carteira

import { useNavigate } from 'react-router-dom';
import Wallet from '../components/Wallet';

export default function WalletPage() {
  const navigate = useNavigate();

  return (
    <Wallet
      onTransactionClick={(transactionId) => {
        navigate(`/transaction/${transactionId}`);
      }}
    />
  );
}













