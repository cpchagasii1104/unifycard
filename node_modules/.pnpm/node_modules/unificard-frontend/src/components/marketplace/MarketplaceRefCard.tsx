// src/components/marketplace/MarketplaceRefCard.tsx
// Card melhorado para referência do marketplace no feed (read-only)
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMarketplaceRef, type MarketplaceRef } from '../../api/marketplace';
import StatusBadge from './StatusBadge';
import './MarketplaceRefCard.css';

interface MarketplaceRefCardProps {
  type: string;
  id: string;
}

export default function MarketplaceRefCard({ type, id }: MarketplaceRefCardProps) {
  const navigate = useNavigate();
  const [ref, setRef] = useState<MarketplaceRef | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRef();
  }, [type, id]);

  const loadRef = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getMarketplaceRef(type, id);
      setRef(data);
    } catch (error: any) {
      console.error('Erro ao carregar referência do marketplace:', error);
      if (error.status === 404 || error.code === 'FEATURE_UNAVAILABLE') {
        setError('Item não encontrado ou sem acesso');
      } else {
        setError('Erro ao carregar item');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClick = () => {
    if (ref) {
      navigate(ref.link);
    }
  };

  const getTypeLabel = () => {
    if (!ref) return '';
    switch (ref.type) {
      case 'product_variant':
        return '📦 Produto';
      case 'order':
        return '🛒 Pedido';
      case 'payment_intent':
        return '💳 Pagamento';
      default:
        return ref.type;
    }
  };

  if (isLoading) {
    return (
      <div className="marketplace-ref-card loading">
        <div>Carregando...</div>
      </div>
    );
  }

  if (error || !ref) {
    return (
      <div className="marketplace-ref-card error">
        <div>{error || 'Item não encontrado'}</div>
      </div>
    );
  }

  return (
    <div className="marketplace-ref-card" onClick={handleClick}>
      <div className="marketplace-ref-header">
        <div className="marketplace-ref-name">{ref.name}</div>
        <StatusBadge 
          status={ref.status} 
          type={ref.type === 'product_variant' ? 'order' : ref.type === 'payment_intent' ? 'payment' : 'order'} 
        />
      </div>
      <div className="marketplace-ref-meta">
        <span className="marketplace-ref-type">{getTypeLabel()}</span>
      </div>
      <div className="marketplace-ref-action">
        <button className="marketplace-ref-button">Ver no marketplace →</button>
      </div>
    </div>
  );
}

