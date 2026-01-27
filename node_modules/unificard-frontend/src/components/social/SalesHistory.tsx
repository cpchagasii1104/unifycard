// src/components/social/SalesHistory.tsx
// Histórico leve de vendas/ofertas do actor

import { type PostCardData } from './PostCard';
import './SalesHistory.css';

interface SalesHistoryProps {
  posts: PostCardData[];
  actorType: 'user' | 'page';
}

export default function SalesHistory({ posts, actorType }: SalesHistoryProps) {
  // Filtrar posts com ofertas (serviços ou produtos)
  const offers = posts.filter(
    post => 
      (post.intent === 'service_offer' || post.intent === 'product_offer') &&
      post.cta &&
      post.cta.price &&
      post.cta.price > 0
  ).slice(0, 3); // Apenas últimos 3

  if (offers.length === 0) {
    return null;
  }

  const getOfferType = (intent?: string) => {
    if (intent === 'service_offer') return { emoji: '🛠️', label: 'Serviço' };
    if (intent === 'product_offer') return { emoji: '🛍️', label: 'Produto' };
    return { emoji: '📦', label: 'Oferta' };
  };

  return (
    <div className="sales-history">
      <h3 className="sales-history-title">
        {actorType === 'page' ? 'Últimas ofertas' : 'Últimas ofertas'}
      </h3>
      <div className="sales-history-items">
        {offers.map((post) => {
          const offerType = getOfferType(post.intent);
          return (
            <div key={post.post_id} className="sales-history-item">
              <div className="sales-item-header">
                <span className="sales-item-icon">{offerType.emoji}</span>
                <div className="sales-item-info">
                  <h4 className="sales-item-title">
                    {post.intent_metadata?.title || post.content.substring(0, 50) + '...'}
                  </h4>
                  <span className="sales-item-type">{offerType.label}</span>
                </div>
              </div>
              {post.cta?.price && (
                <div className="sales-item-price">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: post.cta.currency || 'BRL',
                  }).format(post.cta.price)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


