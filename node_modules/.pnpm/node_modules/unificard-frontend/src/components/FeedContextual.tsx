// src/components/FeedContextual.tsx
// Feed Contextual - conteúdo que encontra a pessoa

import { useState, useEffect } from 'react';
import { getContextualFeed, recordContentAction, type FeedContextual as FeedContextualType } from '../api/feed';
import { getContextualOpportunities, type Opportunity } from '../api/opportunity';
import FeedSection from './FeedSection';
import OpportunitySuggestion from './OpportunitySuggestion';
import './FeedContextual.css';

export default function FeedContextual() {
  const [feed, setFeed] = useState<FeedContextualType | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedContentIds, setSavedContentIds] = useState<Set<string>>(new Set());
  const [ignoredContentIds, setIgnoredContentIds] = useState<Set<string>>(new Set());
  const [dismissedOpportunityIds, setDismissedOpportunityIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFeed = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const feedData = await getContextualFeed(20);
      setFeed(feedData);
      
      // Carregar oportunidades separadamente (não bloqueia o feed)
      try {
        const opportunitiesData = await getContextualOpportunities(3);
        // Filtrar oportunidades já dispensadas
        const filteredOpportunities = opportunitiesData.opportunities.filter(
          o => !dismissedOpportunityIds.has(o.id)
        );
        setOpportunities(filteredOpportunities);
      } catch (oppErr) {
        // Oportunidades são opcionais, não quebram o feed
        console.log('Oportunidades não disponíveis:', oppErr);
      }
    } catch (err) {
      console.error('Erro ao carregar feed:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar feed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContentSave = async (contentId: string) => {
    setSavedContentIds(new Set([...savedContentIds, contentId]));
    try {
      await recordContentAction(contentId, 'save');
    } catch (err) {
      console.error('Erro ao salvar conteúdo:', err);
    }
  };

  const handleContentIgnore = async (contentId: string) => {
    setIgnoredContentIds(new Set([...ignoredContentIds, contentId]));
    // Remover do feed visualmente
    if (feed) {
      const updatedFeed = {
        ...feed,
        sections: feed.sections.map(section => ({
          ...section,
          contents: section.contents.filter(c => c.id !== contentId),
        })).filter(section => section.contents.length > 0),
      };
      setFeed(updatedFeed);
    }
    try {
      await recordContentAction(contentId, 'ignore');
    } catch (err) {
      console.error('Erro ao ignorar conteúdo:', err);
    }
  };

  const handleContentLike = async (contentId: string) => {
    try {
      await recordContentAction(contentId, 'like');
    } catch (err) {
      console.error('Erro ao curtir conteúdo:', err);
    }
  };

  const handleContentDislike = async (contentId: string) => {
    // Remover do feed visualmente após dislike
    if (feed) {
      const updatedFeed = {
        ...feed,
        sections: feed.sections.map(section => ({
          ...section,
          contents: section.contents.filter(c => c.id !== contentId),
        })).filter(section => section.contents.length > 0),
      };
      setFeed(updatedFeed);
    }
    try {
      await recordContentAction(contentId, 'dislike');
    } catch (err) {
      console.error('Erro ao descurtir conteúdo:', err);
    }
  };

  const handleOpportunityAccept = async (opportunityId: string) => {
    try {
      const { recordOpportunityAction } = await import('../api/opportunity');
      await recordOpportunityAction(opportunityId, 'accept');
      // Remover da lista visualmente
      setOpportunities(opportunities.filter(o => o.id !== opportunityId));
      // TODO: Navegar para detalhes da oportunidade
    } catch (err) {
      console.error('Erro ao aceitar oportunidade:', err);
    }
  };

  const handleOpportunityDismiss = async (opportunityId: string) => {
    try {
      const { recordOpportunityAction } = await import('../api/opportunity');
      await recordOpportunityAction(opportunityId, 'dismiss');
      setDismissedOpportunityIds(new Set([...dismissedOpportunityIds, opportunityId]));
      // Remover da lista visualmente
      setOpportunities(opportunities.filter(o => o.id !== opportunityId));
    } catch (err) {
      console.error('Erro ao dispensar oportunidade:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="feed-contextual">
        <div className="feed-loading">Carregando conteúdo para você...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="feed-contextual">
        <div className="feed-error">
          <p>Não foi possível carregar o feed.</p>
          <button onClick={loadFeed} className="feed-retry-button">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!feed || feed.sections.length === 0) {
    return (
      <div className="feed-contextual">
        <div className="feed-empty">
          <p>Nenhum conteúdo disponível no momento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="feed-contextual">
      {feed.contextHeader && (
        <div className="feed-context-header">
          <p>{feed.contextHeader}</p>
        </div>
      )}

      <div className="feed-sections">
        {feed.sections.map((section) => (
          <FeedSection
            key={section.id}
            section={section}
            onContentSave={handleContentSave}
            onContentIgnore={handleContentIgnore}
            onContentLike={handleContentLike}
            onContentDislike={handleContentDislike}
          />
        ))}
      </div>

      {/* Oportunidades Suaves - aparecem discretamente no feed */}
      {opportunities.length > 0 && (
        <div className="feed-opportunities">
          {opportunities.map((opportunity) => (
            <OpportunitySuggestion
              key={opportunity.id}
              opportunity={opportunity}
              onAccept={handleOpportunityAccept}
              onDismiss={handleOpportunityDismiss}
            />
          ))}
        </div>
      )}
    </div>
  );
}


