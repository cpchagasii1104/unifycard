// src/components/social/CommentsDrawer.tsx
// Drawer para exibir e gerenciar comentários de um post

import { useState, useEffect } from 'react';
import { getComments, createComment, type Comment } from '../../api/social';
import { showToast } from '../common/Toast';
import './CommentsDrawer.css';

interface CommentsDrawerProps {
  postId: string;
  isOpen: boolean;
  onClose: () => void;
  onCommentAdded?: () => void;
}

export default function CommentsDrawer({ postId, isOpen, onClose, onCommentAdded }: CommentsDrawerProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentContent, setCommentContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (isOpen && postId) {
      loadComments();
    } else {
      // Reset ao fechar
      setComments([]);
      setCursor(null);
      setHasMore(true);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, postId]);

  const loadComments = async (nextCursor?: string | null) => {
    if (isLoading) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await getComments(postId, { cursor: nextCursor || undefined, limit: 20 });
      
      if (nextCursor) {
        setComments(prev => [...prev, ...result.comments]);
      } else {
        setComments(result.comments);
      }
      
      setCursor(result.next_cursor);
      setHasMore(result.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar comentários');
      console.error('Erro ao carregar comentários:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const newComment = await createComment(postId, { content: commentContent });
      setComments(prev => [newComment, ...prev]);
      setCommentContent('');
      
      if (onCommentAdded) {
        onCommentAdded();
      }
    } catch (err) {
      console.error('Erro ao comentar:', err);
      showToast('Erro ao comentar. Tente novamente.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'agora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <div className="comments-drawer-overlay" onClick={onClose}>
      <div className="comments-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="comments-drawer-header">
          <h3>Comentários</h3>
          <button className="comments-drawer-close" onClick={onClose}>×</button>
        </div>

        <div className="comments-drawer-content">
          {error && (
            <div className="comments-error">
              <p>{error}</p>
              <button onClick={() => loadComments()}>Tentar novamente</button>
            </div>
          )}

          {isLoading && comments.length === 0 ? (
            <div className="comments-loading">Carregando comentários...</div>
          ) : comments.length === 0 ? (
            <div className="comments-empty">
              <p>Nenhum comentário ainda. Seja o primeiro a comentar!</p>
            </div>
          ) : (
            <div className="comments-list">
              {comments.map((comment) => (
                <div key={comment.comment_id} className="comment-item">
                  <div className="comment-author">
                    {comment.actor.avatar_url ? (
                      <img src={comment.actor.avatar_url} alt={comment.actor.display_name} className="comment-avatar" />
                    ) : (
                      <div className="comment-avatar-placeholder">
                        {comment.actor.display_name[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                    <div className="comment-info">
                      <span className="comment-author-name">{comment.actor.display_name}</span>
                      <time className="comment-time">{formatDate(comment.created_at)}</time>
                    </div>
                  </div>
                  <p className="comment-content">{comment.content}</p>
                </div>
              ))}
            </div>
          )}

          {hasMore && !isLoading && (
            <button
              className="comments-load-more"
              onClick={() => loadComments(cursor)}
              disabled={isLoading}
            >
              Carregar mais comentários
            </button>
          )}

          {isLoading && comments.length > 0 && (
            <div className="comments-loading-more">Carregando...</div>
          )}
        </div>

        <div className="comments-drawer-footer">
          <form onSubmit={handleSubmit} className="comment-form">
            <input
              type="text"
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              placeholder="Escreva um comentário..."
              disabled={isSubmitting}
            />
            <button type="submit" disabled={isSubmitting || !commentContent.trim()}>
              {isSubmitting ? '...' : 'Comentar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

