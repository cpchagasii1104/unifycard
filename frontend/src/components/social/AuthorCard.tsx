// src/components/social/AuthorCard.tsx
// Card de autor melhorado com selos e informações de confiança

import { useState, useEffect, useMemo } from 'react';
import { getActor, type ActorResponse } from '../../api/social';
import { getTrustSignals, type ActorTrustData } from '../../utils/trustSignals';
import './AuthorCard.css';

interface AuthorCardProps {
  actorId: string;
  actorType: string;
  displayName: string;
  avatarUrl: string | null;
  companyStatus?: string;
  onClick?: () => void;
  compact?: boolean;
}

export default function AuthorCard({
  actorId,
  actorType,
  displayName,
  avatarUrl,
  companyStatus,
  onClick,
  compact = false,
}: AuthorCardProps) {
  const [actorData, setActorData] = useState<ActorResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Carregar dados do actor apenas se não for compacto
    if (!compact) {
      loadActorData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorId, compact]);

  const loadActorData = async () => {
    try {
      setIsLoading(true);
      const data = await getActor(actorId);
      setActorData(data as any);
    } catch (err) {
      console.warn('Erro ao carregar dados do actor:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // const isCompany = actorType === 'page';
  // Fase 3.3-B1: vestígio morto "isVerified = companyStatus==='VERIFIED'" removido (2ª-verdade). Verificação = isKybApproved.
  // const isProvisional = companyStatus === 'PROVISIONAL';

  // Contar serviços, produtos e eventos dos posts
  const servicesCount = actorData?.posts?.filter(
    post => post.intent === 'service_offer' && post.cta?.cta_type === 'service'
  ).length || 0;

  const productsCount = actorData?.posts?.filter(
    post => post.intent === 'product_offer' && post.cta?.cta_type === 'payment'
  ).length || 0;

  const eventsCount = actorData?.posts?.filter(
    post => post.intent === 'event' || post.linked_event
  ).length || 0;

  const postsCount = actorData?.counts?.posts_count || 0;

  // Gerar sinais de confiança dinâmicos
  const trustSignals = useMemo(() => {
    if (!actorData) return [];
    
    const trustData: ActorTrustData = {
      actor_id: actorId,
      actor_type: actorType as 'user' | 'page',
      posts_count: postsCount,
      services_count: servicesCount,
      products_count: productsCount,
      events_count: eventsCount,
      followers_count: actorData.counts?.followers_count || 0,
      company_status: companyStatus || null, // lifecycle — NÃO acende "Verificada" (DECISION-0089)
      // DECISION-0089 Fase 1: verificação deriva de kyb_status. Forward-wire: se/quando o payload
      // do actor expuser kyb_status, o selo "Verificada" passa a refletir o KYB (até lá, dormente).
      kyb_status: (actorData as any)?.kyb_status ?? null,
      created_at: undefined, // Actor não tem created_at na interface
      last_activity: actorData.posts?.[0]?.created_at, // Último post como proxy de atividade
    };
    
    return getTrustSignals(trustData);
  }, [actorData, actorId, actorType, postsCount, servicesCount, productsCount, eventsCount, companyStatus]);

  return (
    <div 
      className={`author-card ${compact ? 'author-card--compact' : ''} ${onClick ? 'author-card--clickable' : ''}`}
      onClick={onClick}
    >
      <div className="author-card-avatar">
        {avatarUrl ? (
          <img src={avatarUrl} alt={displayName} />
        ) : (
          <div className="author-avatar-placeholder">
            {displayName[0]?.toUpperCase() || 'U'}
          </div>
        )}
      </div>

      <div className="author-card-info">
        <div className="author-card-header">
          <span className="author-card-name">{displayName}</span>
          
          {/* Selos de confiança dinâmicos */}
          <div className="author-card-badges">
            {trustSignals
              .filter(signal => signal.type === 'badge')
              .map((signal, index) => (
                <span
                  key={index}
                  className={`author-badge author-badge--${signal.priority <= 2 ? 'high' : 'medium'}`}
                  title={signal.label}
                >
                  {signal.icon && <span className="badge-icon">{signal.icon}</span>}
                  <span className="badge-label">{signal.label}</span>
                </span>
              ))}
          </div>
        </div>

        {/* Contagens (apenas se não for compacto) */}
        {!compact && !isLoading && (
          <div className="author-card-stats">
            {servicesCount > 0 && (
              <span className="author-stat-item">
                <span className="stat-icon">🛠️</span>
                <span className="stat-value">{servicesCount}</span>
                <span className="stat-label">serviços</span>
              </span>
            )}
            {eventsCount > 0 && (
              <span className="author-stat-item">
                <span className="stat-icon">🎭</span>
                <span className="stat-value">{eventsCount}</span>
                <span className="stat-label">eventos</span>
              </span>
            )}
            {postsCount > 0 && (
              <span className="author-stat-item">
                <span className="stat-icon">📝</span>
                <span className="stat-value">{postsCount}</span>
                <span className="stat-label">publicações</span>
              </span>
            )}
          </div>
        )}

        {/* Sinais de confiança (stats) */}
        {!compact && !isLoading && trustSignals.length > 0 && (
          <div className="author-card-trust">
            {trustSignals
              .filter(signal => signal.type === 'stat')
              .map((signal, index) => (
                <span key={index} className="trust-stat">
                  {signal.label}
                </span>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

