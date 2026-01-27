// frontend/src/components/contextual-messaging/ContextualThreadView.tsx
// Componente para visualizar e enviar mensagens em thread contextual
// 🔴 BLINDAGEM: NÃO toma decisões automáticas
// 🔴 BLINDAGEM: Comunicação apenas informativa

import { useState, useEffect, useRef } from 'react';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import {
  getContextualThread,
  getContextualMessages,
  sendContextualMessage,
  type ContextualThread,
  type ContextualMessage,
} from '../../api/contextual-messaging';
import { getActorProfile } from '../../api/social';
import { showToast } from '../common/Toast';
import AgreementPanel from '../agreements/AgreementPanel';
import { type Agreement } from '../../api/agreements';
import './ContextualThreadView.css';

interface ContextualThreadViewProps {
  threadId: string;
  contextLabel?: string; // Ex: "Evento: Aniversário", "RFQ: #123"
  contextType?: 'event' | 'service' | 'rfq' | 'booking' | 'bundle';
  contextId?: string;
  requesterActorId?: string;
  providerActorId?: string;
  onMessageSent?: (message: ContextualMessage) => void;
  onAgreementFinalized?: (agreement: Agreement) => void;
}

export default function ContextualThreadView({
  threadId,
  contextLabel,
  contextType,
  contextId,
  requesterActorId,
  providerActorId,
  onMessageSent,
  onAgreementFinalized,
}: ContextualThreadViewProps) {
  const { activeActor } = useActiveActor();
  const [thread, setThread] = useState<ContextualThread | null>(null);
  const [messages, setMessages] = useState<ContextualMessage[]>([]);
  const [enrichedMessages, setEnrichedMessages] = useState<Array<ContextualMessage & {
    sender?: any;
  }>>([]);
  const [newMessage, setNewMessage] = useState('');
  const [messageType, setMessageType] = useState<'informational' | 'proposal' | 'confirmation'>('informational');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (threadId) {
      loadThreadAndMessages();
    }
  }, [threadId]);

  useEffect(() => {
    scrollToBottom();
  }, [enrichedMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadThreadAndMessages = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const threadData = await getContextualThread(threadId);
      setThread(threadData);

      const messagesData = await getContextualMessages(threadId, 100, 0);
      setMessages(messagesData.messages);

      // Enriquecer mensagens com dados do sender
      const enriched = await Promise.all(
        messagesData.messages.map(async (msg) => {
          try {
            const sender = await getActorProfile(msg.senderActorId);
            return { ...msg, sender };
          } catch (err) {
            return msg;
          }
        })
      );

      setEnrichedMessages(enriched);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar thread');
      showToast(err.message || 'Erro ao carregar thread', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!activeActor) {
      showToast('Nenhum ator ativo para enviar mensagem.', 'error');
      return;
    }

    if (!newMessage.trim()) {
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      // Preparar metadata baseado no tipo de mensagem
      const metadata: any = {};
      
      if (messageType === 'proposal' || messageType === 'confirmation') {
        metadata.negotiationType = messageType;
        
        // Se for proposta, tentar extrair dados do acordo do texto (opcional)
        // O backend pode processar isso
        if (messageType === 'proposal') {
          // Frontend apenas marca, backend processa
          metadata.isProposal = true;
        }
        
        if (messageType === 'confirmation') {
          metadata.isConfirmation = true;
        }
      }

      const message = await sendContextualMessage(threadId, {
        content: newMessage.trim(),
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      });

      // Adicionar mensagem à lista
      const sender = await getActorProfile(message.senderActorId).catch(() => null);
      const enrichedMessage = { ...message, sender };

      setMessages((prev) => [...prev, message]);
      setEnrichedMessages((prev) => [...prev, enrichedMessage]);
      setNewMessage('');
      setMessageType('informational'); // Reset após envio

      if (onMessageSent) {
        onMessageSent(message);
      }

      showToast('Mensagem enviada!', 'success');
      
      // Recarregar mensagens para ver a nova
      loadThreadAndMessages();
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar mensagem');
      showToast(err.message || 'Erro ao enviar mensagem', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const getContextDisplayName = () => {
    if (contextLabel) return contextLabel;
    if (!thread) return 'Carregando...';

    const contextTypeNames: Record<string, string> = {
      event: 'Evento',
      rfq: 'RFQ',
      booking: 'Booking',
      service_order: 'Ordem de Serviço',
    };

    return `Você está conversando sobre: ${contextTypeNames[thread.contextType] || thread.contextType}`;
  };

  if (isLoading) {
    return (
      <div className="contextual-thread-view">
        <div className="loading">Carregando conversa...</div>
      </div>
    );
  }

  if (error && !thread) {
    return (
      <div className="contextual-thread-view">
        <div className="error">{error}</div>
      </div>
    );
  }

  // Determinar se deve exibir AgreementPanel
  const shouldShowAgreementPanel = 
    contextType && 
    contextId && 
    requesterActorId && 
    providerActorId;

  return (
    <div className="contextual-thread-view-with-agreement">
      {/* Agreement Panel (lado esquerdo ou acima em mobile) */}
      {shouldShowAgreementPanel && (
        <div className="agreement-panel-container">
          <AgreementPanel
            contextType={contextType}
            contextId={contextId}
            threadId={threadId}
            requesterActorId={requesterActorId}
            providerActorId={providerActorId}
            onAgreementFinalized={onAgreementFinalized}
          />
        </div>
      )}

      {/* Chat (lado direito ou abaixo em mobile) */}
      <div className="contextual-thread-view">
        <div className="thread-header">
          <h3>{getContextDisplayName()}</h3>
          {thread && (
            <div className="thread-info">
              <span className="context-id">ID: {thread.contextId.substring(0, 8)}...</span>
              {thread.title && <span className="thread-title">{thread.title}</span>}
            </div>
          )}
        </div>

        <div className="messages-container">
        {enrichedMessages.length === 0 ? (
          <div className="no-messages">
            <p>Nenhuma mensagem ainda.</p>
            <p className="help-text">Seja o primeiro a enviar uma mensagem!</p>
          </div>
        ) : (
          <div className="messages-list">
            {enrichedMessages.map((msg) => {
              const isOwnMessage = msg.senderActorId === activeActor?.actor_id;
              return (
                <div
                  key={msg.messageId}
                  className={`message-item ${isOwnMessage ? 'own-message' : 'other-message'}`}
                >
                  <div className="message-header">
                    <span className="sender-name">
                      {msg.sender?.display_name || msg.senderActorId.substring(0, 8) || 'Usuário'}
                    </span>
                    <span className="message-time">
                      {new Date(msg.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="message-content">{msg.content}</div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

        <div className="message-input-container">
          {/* Seletor de tipo de mensagem (apenas se houver acordo) */}
          {shouldShowAgreementPanel && (
            <div className="message-type-selector">
              <label>
                Tipo de mensagem:
                <select
                  value={messageType}
                  onChange={(e) => setMessageType(e.target.value as any)}
                  disabled={isSending}
                >
                  <option value="informational">Informativa</option>
                  <option value="proposal">Proposta (atualiza acordo)</option>
                  <option value="confirmation">Confirmação (aceita acordo)</option>
                </select>
              </label>
            </div>
          )}

          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={
              messageType === 'proposal'
                ? 'Digite sua proposta... (será usada para atualizar o acordo)'
                : messageType === 'confirmation'
                ? 'Digite sua confirmação... (aceitará o acordo)'
                : 'Digite sua mensagem...'
            }
            rows={3}
            disabled={isSending || !activeActor}
          />
          <button
            onClick={handleSendMessage}
            disabled={isSending || !newMessage.trim() || !activeActor}
            className="send-button"
          >
            {isSending ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}

