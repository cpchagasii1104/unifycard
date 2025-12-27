// src/components/social/SmartEmptyState.tsx
// Estado vazio inteligente para o feed

import { useState, useEffect } from 'react';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { hasCompletedFirstAction } from './FirstActionHint';
import './SmartEmptyState.css';

interface SmartEmptyStateProps {
  posts: Array<{ intent?: string }>;
  culturalEvents: Array<{ id: string }>;
  standaloneEvents?: Array<{ eventId: string }>;
  isLoading: boolean;
}

interface EmptyStateContext {
  hasRelevantContent: boolean; // service_offer, event, product_offer
  postsCount: number;
  hasPersonalPosts: boolean;
}

export default function SmartEmptyState({ posts, culturalEvents, standaloneEvents = [], isLoading }: SmartEmptyStateProps) {
  const { activeActor } = useActiveActor();
  const [context, setContext] = useState<EmptyStateContext>({
    hasRelevantContent: false,
    postsCount: 0,
    hasPersonalPosts: false,
  });
  const [suggestion, setSuggestion] = useState<{
    message: string;
    icon: string;
    actions: Array<{ label: string; action: () => void; primary?: boolean }>;
  } | null>(null);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    // Analisar contexto do feed
    const relevantIntents = ['service_offer', 'event', 'product_offer'];
    const hasRelevantContent = 
      posts.some(p => relevantIntents.includes(p.intent || '')) || 
      culturalEvents.length > 0 || 
      standaloneEvents.length > 0;
    const postsCount = posts.length;
    const hasPersonalPosts = posts.some(p => !p.intent || p.intent === 'personal' || p.intent === 'friends');

    setContext({
      hasRelevantContent,
      postsCount,
      hasPersonalPosts,
    });

    // Determinar sugestão baseada no contexto
    if (!hasRelevantContent && postsCount === 0) {
      // Feed completamente vazio
      setSuggestion({
        message: 'Nada acontecendo agora — que tal criar algo?',
        icon: '🌱',
        actions: [
          {
            label: 'Criar publicação',
            action: () => {
              const composer = document.getElementById('intent-composer');
              if (composer) {
                composer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => {
                  const textarea = composer.querySelector('textarea') as HTMLTextAreaElement;
                  const input = composer.querySelector('input[type="text"]') as HTMLInputElement;
                  const target = textarea || input;
                  if (target) {
                    target.focus();
                  }
                }, 300);
              }
            },
            primary: true,
          },
        ],
      });
    } else if (!hasRelevantContent && hasPersonalPosts) {
      // Apenas posts pessoais, sem ofertas
      setSuggestion({
        message: 'Ainda não há serviços ou eventos por aqui. Seja o primeiro a oferecer algo!',
        icon: '💡',
        actions: [
          {
            label: 'Criar serviço',
            action: () => {
              const composer = document.getElementById('intent-composer');
              if (composer) {
                composer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => {
                  const textarea = composer.querySelector('textarea') as HTMLTextAreaElement;
                  if (textarea) {
                    textarea.focus();
                  }
                }, 300);
              }
            },
            primary: true,
          },
          {
            label: 'Criar evento',
            action: () => {
              const composer = document.getElementById('intent-composer');
              if (composer) {
                composer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => {
                  const textarea = composer.querySelector('textarea') as HTMLTextAreaElement;
                  if (textarea) {
                    textarea.focus();
                  }
                }, 300);
              }
            },
          },
        ],
      });
    } else if (!hasRelevantContent && postsCount > 0) {
      // Há posts mas não são relevantes (oferta)
      setSuggestion({
        message: 'Convide alguém da sua comunidade para participar e criar ofertas.',
        icon: '👥',
        actions: [
          {
            label: 'Criar publicação',
            action: () => {
              const composer = document.getElementById('intent-composer');
              if (composer) {
                composer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => {
                  const textarea = composer.querySelector('textarea') as HTMLTextAreaElement;
                  const input = composer.querySelector('input[type="text"]') as HTMLInputElement;
                  const target = textarea || input;
                  if (target) {
                    target.focus();
                  }
                }, 300);
              }
            },
            primary: true,
          },
        ],
      });
    } else {
      setSuggestion(null);
    }
  }, [posts, culturalEvents, standaloneEvents, isLoading]);

  // Não mostrar se FirstActionHint ainda está visível
  if (!hasCompletedFirstAction()) {
    return null;
  }

  // Não mostrar se há conteúdo relevante
  if (context.hasRelevantContent || !suggestion) {
    return null;
  }

  return (
    <div className="smart-empty-state">
      <div className="empty-state-content">
        <span className="empty-state-icon">{suggestion.icon}</span>
        <p className="empty-state-message">{suggestion.message}</p>
        
        <div className="empty-state-actions">
          {suggestion.actions.map((action, index) => (
            <button
              key={index}
              className={`empty-state-action ${action.primary ? 'primary' : 'secondary'}`}
              onClick={action.action}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

