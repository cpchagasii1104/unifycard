// src/components/social/FeaturedToday.tsx
// Seção "Em destaque hoje" - mostra serviços e eventos relevantes

import { useState, useEffect } from 'react';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { getIdentityProfile } from '../../api/identity';
import { type PostCardData } from './PostCard';
import { type CulturalEvent } from '../../api/cultural';
import CTAModal from './CTAModal';
import './FeaturedToday.css';

interface FeaturedTodayProps {
  posts: PostCardData[];
  culturalEvents: CulturalEvent[];
  onCTAConfirmed?: () => void;
}

export default function FeaturedToday({ posts, culturalEvents, onCTAConfirmed }: FeaturedTodayProps) {
  const { activeActor } = useActiveActor();
  const [userCity, setUserCity] = useState<string | null>(null);
  const [selectedCTA, setSelectedCTA] = useState<{ cta: PostCardData['cta']; postId: string } | null>(null);

  // Carregar cidade do usuário
  useEffect(() => {
    const loadUserCity = async () => {
      const city = await safeApiCall(
        async () => {
          const identity = await getIdentityProfile();
          return identity.residence?.city?.name || null;
        },
        null,
        'Erro ao carregar cidade do usuário'
      );
      setUserCity(safeUserCity(city));
    };
    loadUserCity();
  }, []);

  // Filtrar e ordenar posts relevantes
  const getFeaturedItems = () => {
    const items: Array<{
      type: 'service' | 'product' | 'event';
      data: PostCardData | CulturalEvent;
      isLocal?: boolean;
    }> = [];

    // Serviços (service_offer com CTA)
    const services = posts
      .filter(post => 
        post.intent === 'service_offer' && 
        post.cta?.cta_type === 'service' &&
        post.cta.price !== null &&
        post.cta.price > 0
      )
      .slice(0, 1)
      .map(post => {
        // Detectar se é local (mesmo tenant ou cidade mencionada no conteúdo/metadata)
        const isLocal = userCity && (
          post.intent_metadata?.city?.toLowerCase().includes(userCity.toLowerCase()) ||
          post.content.toLowerCase().includes(userCity.toLowerCase())
        );
        return {
          type: 'service' as const,
          data: post,
          isLocal: !!isLocal,
        };
      });

    items.push(...services);

    // Produtos (product_offer com CTA)
    const products = posts
      .filter(post => 
        post.intent === 'product_offer' && 
        post.cta?.cta_type === 'payment' &&
        post.cta.price !== null &&
        post.cta.price > 0
      )
      .slice(0, 1)
      .map(post => {
        // Detectar se é local
        const isLocal = userCity && (
          post.intent_metadata?.city?.toLowerCase().includes(userCity.toLowerCase()) ||
          post.content.toLowerCase().includes(userCity.toLowerCase())
        );
        return {
          type: 'product' as const,
          data: post,
          isLocal: !!isLocal,
        };
      });

    items.push(...products);

    // Eventos culturais
    const events = culturalEvents
      .filter(event => 
        (event.status === 'PUBLISHED' || event.status === 'CONFIRMED') &&
        event.ticket_price_cents &&
        event.ticket_price_cents > 0
      )
      .slice(0, 2)
      .map(event => {
        // Detectar se é local (cidade mencionada no título/descrição)
        const isLocal = userCity && (
          event.title.toLowerCase().includes(userCity.toLowerCase()) ||
          (event.description && event.description.toLowerCase().includes(userCity.toLowerCase()))
        );
        return {
          type: 'event' as const,
          data: event,
          isLocal: !!isLocal,
        };
      });

    items.push(...events);

    // Limitar a 3 itens
    return items.slice(0, 3);
  };

  const featuredItems = getFeaturedItems();

  if (featuredItems.length === 0) {
    return null;
  }

  const handleServiceCTA = (post: PostCardData) => {
    if (post.cta) {
      setSelectedCTA({ cta: post.cta, postId: post.post_id });
    }
  };

  const handleEventCTA = (event: CulturalEvent) => {
    // Para eventos, redirecionar para página de detalhes ou abrir checkout
    window.location.href = `/cultural/events/${event.id}`;
  };

  return (
    <>
      <div className="featured-today">
        <div className="featured-today-header">
          <span className="featured-icon">⭐</span>
          <h3 className="featured-title">Em destaque hoje</h3>
        </div>

        <div className="featured-items">
          {featuredItems.map((item, idx) => {
            if (item.type === 'service') {
              const post = item.data as PostCardData;
              return (
                <div 
                  key={`service-${post.post_id}`} 
                  className={`featured-card featured-card--service ${item.isLocal ? 'featured-card--local' : ''}`}
                >
                  {item.isLocal && (
                    <div className="featured-local-badge">📍 Local</div>
                  )}
                  <div className="featured-card-content">
                    <div className="featured-card-header">
                      <span className="featured-card-icon">🛠️</span>
                      <div className="featured-card-info">
                        <h4 className="featured-card-title">
                          {post.intent_metadata?.title || 'Serviço'}
                        </h4>
                        <p className="featured-card-author">
                          {post.actor?.display_name || 'Prestador'}
                        </p>
                      </div>
                    </div>
                    {post.cta?.price && (
                      <div className="featured-card-price">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: post.cta.currency || 'BRL',
                        }).format(post.cta.price)}
                      </div>
                    )}
                    <button
                      className="featured-card-cta"
                      onClick={() => handleServiceCTA(post)}
                    >
                      Contratar
                    </button>
                  </div>
                </div>
              );
            } else if (item.type === 'product') {
              const post = item.data as PostCardData;
              return (
                <div 
                  key={`product-${post.post_id}`} 
                  className={`featured-card featured-card--product ${item.isLocal ? 'featured-card--local' : ''}`}
                >
                  {item.isLocal && (
                    <div className="featured-local-badge">📍 Local</div>
                  )}
                  <div className="featured-card-content">
                    <div className="featured-card-header">
                      <span className="featured-card-icon">🛍️</span>
                      <div className="featured-card-info">
                        <h4 className="featured-card-title">
                          {post.intent_metadata?.title || 'Produto'}
                        </h4>
                        <p className="featured-card-author">
                          {post.actor?.display_name || 'Vendedor'}
                        </p>
                      </div>
                    </div>
                    {post.cta?.price && (
                      <div className="featured-card-price">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: post.cta.currency || 'BRL',
                        }).format(post.cta.price)}
                      </div>
                    )}
                    <button
                      className="featured-card-cta"
                      onClick={() => handleServiceCTA(post)}
                    >
                      Comprar
                    </button>
                  </div>
                </div>
              );
            } else {
              const event = item.data as CulturalEvent;
              return (
                <div 
                  key={`event-${event.id}`} 
                  className={`featured-card featured-card--event ${item.isLocal ? 'featured-card--local' : ''}`}
                >
                  {item.isLocal && (
                    <div className="featured-local-badge">📍 Local</div>
                  )}
                  <div className="featured-card-content">
                    <div className="featured-card-header">
                      <span className="featured-card-icon">🎭</span>
                      <div className="featured-card-info">
                        <h4 className="featured-card-title">{event.title}</h4>
                        <p className="featured-card-meta">
                          {new Date(event.datetime_start).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    {event.ticket_price_cents && (
                      <div className="featured-card-price">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(event.ticket_price_cents / 100)}
                      </div>
                    )}
                    <button
                      className="featured-card-cta"
                      onClick={() => handleEventCTA(event)}
                    >
                      Ver evento
                    </button>
                  </div>
                </div>
              );
            }
          })}
        </div>
      </div>

      {/* Modal de CTA para serviços */}
      {selectedCTA && (
        <CTAModal
          cta={selectedCTA.cta}
          postId={selectedCTA.postId}
          onClose={() => setSelectedCTA(null)}
          onConfirm={() => {
            if (onCTAConfirmed) {
              onCTAConfirmed();
            }
            setSelectedCTA(null);
          }}
        />
      )}
    </>
  );
}

