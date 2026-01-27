// src/components/FeedSection.tsx
// Seção do feed - agrupa conteúdos por contexto

import { type FeedSection as FeedSectionType } from '../api/feed';
import FeedCard from './FeedCard';
import './FeedSection.css';

interface FeedSectionProps {
  section: FeedSectionType;
  onContentSave?: (contentId: string) => void;
  onContentIgnore?: (contentId: string) => void;
  onContentLike?: (contentId: string) => void;
  onContentDislike?: (contentId: string) => void;
}

export default function FeedSection({ 
  section, 
  onContentSave, 
  onContentIgnore,
  onContentLike,
  onContentDislike
}: FeedSectionProps) {
  if (section.contents.length === 0) {
    return null;
  }

  return (
    <div className="feed-section">
      <div className="feed-section-header">
        <h2 className="feed-section-title">{section.title}</h2>
        {section.subtitle && (
          <p className="feed-section-subtitle">{section.subtitle}</p>
        )}
        <p className="feed-section-hint">
          Essas sugestões mudam conforme você interage.
        </p>
      </div>
      <div className="feed-section-contents">
        {section.contents.map((content) => (
          <FeedCard
            key={content.id}
            content={content}
            onSave={onContentSave}
            onIgnore={onContentIgnore}
            onLike={onContentLike}
            onDislike={onContentDislike}
          />
        ))}
      </div>
    </div>
  );
}


