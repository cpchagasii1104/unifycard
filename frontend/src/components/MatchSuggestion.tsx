// src/components/MatchSuggestion.tsx
// Sugestão de match - conexão por momento de vida

import { type MatchSuggestion as MatchSuggestionType } from '../api/matching';
import './MatchSuggestion.css';

interface MatchSuggestionProps {
  suggestion: MatchSuggestionType;
  onAccept?: (matchId: string) => void;
  onDismiss?: (matchId: string) => void;
}

export default function MatchSuggestion({ suggestion, onAccept, onDismiss }: MatchSuggestionProps) {
  const handleAccept = () => {
    onAccept?.(suggestion.id);
  };

  const handleDismiss = () => {
    onDismiss?.(suggestion.id);
  };


  return (
    <div className="match-suggestion">
      <div className="match-content">
        <h3 className="match-title">{suggestion.title}</h3>
        <p className="match-message">{suggestion.message}</p>
        <div className="match-users">
          {suggestion.users.map((user) => (
            <div key={user.userId} className="match-user">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="match-avatar" />
              ) : (
                <div className="match-avatar-placeholder">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="match-user-name">{user.name}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="match-actions">
        <button
          className="match-button accept"
          onClick={handleAccept}
          aria-label="Conhecer"
        >
          Conhecer
        </button>
        <button
          className="match-button dismiss"
          onClick={handleDismiss}
          aria-label="Agora não"
        >
          Agora não
        </button>
      </div>
    </div>
  );
}














