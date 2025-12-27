// src/components/MatchingContextual.tsx
// Matching Contextual - conexão por momento de vida

import { useState, useEffect } from 'react';
import { getMatchingSuggestions, recordMatchAction, type MatchResult, type MatchSuggestion } from '../api/matching';
import MatchSection from './MatchSection';
import './MatchingContextual.css';

export default function MatchingContextual() {
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissedMatchIds, setDismissedMatchIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadMatching();
  }, []);

  const loadMatching = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getMatchingSuggestions(5);
      // Filtrar matches já dispensados
      const filteredSuggestions = result.suggestions.filter(
        s => !dismissedMatchIds.has(s.id)
      );
      setMatchResult({
        ...result,
        suggestions: filteredSuggestions,
      });
    } catch (err) {
      console.error('Erro ao carregar matching:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar sugestões');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async (matchId: string) => {
    try {
      await recordMatchAction(matchId, 'accept');
      // Remover da lista visualmente
      if (matchResult) {
        setMatchResult({
          ...matchResult,
          suggestions: matchResult.suggestions.filter(s => s.id !== matchId),
        });
      }
      // TODO: Navegar para perfil ou iniciar conversa
    } catch (err) {
      console.error('Erro ao aceitar match:', err);
    }
  };

  const handleDismiss = async (matchId: string) => {
    try {
      await recordMatchAction(matchId, 'dismiss');
      setDismissedMatchIds(new Set([...dismissedMatchIds, matchId]));
      // Remover da lista visualmente
      if (matchResult) {
        setMatchResult({
          ...matchResult,
          suggestions: matchResult.suggestions.filter(s => s.id !== matchId),
        });
      }
    } catch (err) {
      console.error('Erro ao dispensar match:', err);
    }
  };

  const groupSuggestionsByType = (suggestions: MatchSuggestion[]) => {
    const groups: { [key: string]: MatchSuggestion[] } = {
      exploration: [],
      learning: [],
      mirroring: [],
    };

    suggestions.forEach(s => {
      if (groups[s.type]) {
        groups[s.type].push(s);
      }
    });

    return groups;
  };

  if (isLoading) {
    return (
      <div className="matching-contextual">
        <div className="matching-loading">Buscando conexões possíveis...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="matching-contextual">
        <div className="matching-error">
          <p>Não foi possível carregar sugestões.</p>
          <button onClick={loadMatching} className="matching-retry-button">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!matchResult || matchResult.suggestions.length === 0) {
    return (
      <div className="matching-contextual">
        <div className="matching-empty">
          <p>Nenhuma sugestão de conexão no momento.</p>
        </div>
      </div>
    );
  }

  const grouped = groupSuggestionsByType(matchResult.suggestions);

  return (
    <div className="matching-contextual">
      {grouped.exploration.length > 0 && (
        <MatchSection
          title="Pessoas explorando algo parecido"
          subtitle="Gente descobrindo coisas similares"
          suggestions={grouped.exploration}
          onSuggestionAccept={handleAccept}
          onSuggestionDismiss={handleDismiss}
        />
      )}

      {grouped.learning.length > 0 && (
        <MatchSection
          title="Gente aprendendo isso também"
          subtitle="Alguém está explorando caminhos parecidos"
          suggestions={grouped.learning}
          onSuggestionAccept={handleAccept}
          onSuggestionDismiss={handleDismiss}
        />
      )}

      {grouped.mirroring.length > 0 && (
        <MatchSection
          title="Histórias que podem te interessar"
          subtitle="Pessoas com trajetórias parecidas"
          suggestions={grouped.mirroring}
          onSuggestionAccept={handleAccept}
          onSuggestionDismiss={handleDismiss}
        />
      )}
    </div>
  );
}













