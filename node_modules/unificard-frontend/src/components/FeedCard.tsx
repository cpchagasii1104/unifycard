// src/components/FeedCard.tsx
// Card de conteúdo do feed - simples, sem CTA pesado

import { type FeedContent } from '../api/feed';
import './FeedCard.css';

interface FeedCardProps {
  content: FeedContent;
  onSave?: (contentId: string) => void;
  onIgnore?: (contentId: string) => void;
  onLike?: (contentId: string) => void;
  onDislike?: (contentId: string) => void;
}

export default function FeedCard({ 
  content, 
  onSave, 
  onIgnore,
  onLike,
  onDislike 
}: FeedCardProps) {
  const handleSave = () => {
    onSave?.(content.id);
  };

  const handleIgnore = () => {
    onIgnore?.(content.id);
  };

  const handleLike = () => {
    onLike?.(content.id);
  };

  const handleDislike = () => {
    onDislike?.(content.id);
  };

  return (
    <div className="feed-card">
      <div className="feed-card-content">
        <h3 className="feed-card-title">{content.title}</h3>
        {content.description && (
          <p className="feed-card-description">{content.description}</p>
        )}
        {content.author && (
          <div className="feed-card-author">
            <span className="author-name">{content.author.name}</span>
          </div>
        )}
        {content.metadata?.tags && content.metadata.tags.length > 0 && (
          <div className="feed-card-tags">
            {content.metadata.tags.map((tag, idx) => (
              <span key={idx} className="feed-tag">{tag}</span>
            ))}
          </div>
        )}
        {content.metadata?.estimatedReadTime && (
          <span className="feed-read-time">{content.metadata.estimatedReadTime} min</span>
        )}
      </div>
      <div className="feed-card-actions">
        <button
          className="feed-action-button like"
          onClick={handleLike}
          aria-label="Gostei"
          title="Gostei"
        >
          👍 Gostei
        </button>
        <button
          className="feed-action-button dislike"
          onClick={handleDislike}
          aria-label="Não é pra mim"
          title="Não é pra mim"
        >
          👎 Não é pra mim
        </button>
        <button
          className="feed-action-button save"
          onClick={handleSave}
          aria-label="Salvar"
          title="Salvar"
        >
          💾 Salvar
        </button>
        <button
          className="feed-action-button ignore"
          onClick={handleIgnore}
          aria-label="Não mostrar mais"
          title="Não mostrar mais"
        >
          🚫 Não mostrar mais
        </button>
      </div>
    </div>
  );
}


