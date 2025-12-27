// src/components/AssistantChat.tsx
import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../api/client';
import VoiceButton from './VoiceInput/VoiceButton';
import type {
  AssistantConversation,
  AssistantResponse,
  AssistantSuggestedAction,
  SendMessageInput,
  AssistantMessage,
  ExecuteActionInput,
  ExecuteActionResponse,
} from '../types/assistant';
import type { VoiceResponse } from './VoiceInput/voice.types';

const SESSION_ID_KEY = 'unificard_assistant_session_id';

export default function AssistantChat() {
  const [conversation, setConversation] = useState<AssistantConversation | null>(null);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [executingActions, setExecutingActions] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll para última mensagem
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation?.messages]);

  // Carregar conversa existente ao montar
  useEffect(() => {
    const sessionId = localStorage.getItem(SESSION_ID_KEY);
    if (sessionId) {
      loadConversation(sessionId);
    }
  }, []);

  const loadConversation = async (sessionId: string) => {
    try {
      const response = await apiFetch(`/assistant/conversation/${sessionId}`);
      const data: AssistantConversation = await response.json();
      setConversation(data);
    } catch (error) {
      console.error('Erro ao carregar conversa:', error);
      // Se falhar, limpar sessionId inválido
      localStorage.removeItem(SESSION_ID_KEY);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const text = inputText.trim();
    setInputText('');
    setIsLoading(true);

    try {
      const sessionId = localStorage.getItem(SESSION_ID_KEY);
      
      const payload: SendMessageInput = {
        text,
        channel: 'chat',
        targetType: 'global',
        sessionId: sessionId || undefined,
      };

      const response = await apiFetch('/assistant/message', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const data: AssistantResponse = await response.json();

      // Salvar sessionId se não existir
      if (!sessionId && data.conversation.sessionId) {
        localStorage.setItem(SESSION_ID_KEY, data.conversation.sessionId);
      }

      setConversation(data.conversation);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      alert(`Erro ao enviar mensagem: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const executeAction = async (action: AssistantSuggestedAction) => {
    if (executingActions.has(action.actionId) || action.status === 'executed' || action.status === 'failed') {
      return;
    }

    const sessionId = localStorage.getItem(SESSION_ID_KEY);
    if (!sessionId) {
      alert('Sessão não encontrada. Por favor, envie uma mensagem primeiro.');
      return;
    }

    // Adicionar ação ao conjunto de ações executando
    setExecutingActions((prev) => new Set(prev).add(action.actionId));

    // Adicionar mensagem de "Executando..."
    const executingMessage: AssistantMessage = {
      messageId: `executing-${action.actionId}-${Date.now()}`,
      author: 'system',
      content: `Executando sua ação: ${action.label}...`,
      createdAt: new Date().toISOString(),
    };

    setConversation((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: [...prev.messages, executingMessage],
      };
    });

    try {
      // Chamar endpoint de execução
      const payload: ExecuteActionInput = {
        actionId: action.actionId,
      };

      const response = await apiFetch('/social-actions/execute', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const result: ExecuteActionResponse = await response.json();

      // Remover mensagem de "Executando..." e adicionar resultado
      setConversation((prev) => {
        if (!prev) return prev;
        const messagesWithoutExecuting = prev.messages.filter(
          (msg) => msg.messageId !== executingMessage.messageId
        );
        
        const resultMessage: AssistantMessage = {
          messageId: `result-${action.actionId}-${Date.now()}`,
          author: 'system',
          content: result.success
            ? `✅ Ação concluída: ${action.label}`
            : `❌ Falhou ao executar: ${action.label}${result.error ? ` (${result.error})` : ''}`,
          createdAt: new Date().toISOString(),
        };

        return {
          ...prev,
          messages: [...messagesWithoutExecuting, resultMessage],
        };
      });

      // Recarregar conversa completa para atualizar status das ações
      await loadConversation(sessionId);
    } catch (error) {
      console.error('Erro ao executar ação:', error);
      
      // Remover mensagem de "Executando..." e adicionar erro
      setConversation((prev) => {
        if (!prev) return prev;
        const messagesWithoutExecuting = prev.messages.filter(
          (msg) => msg.messageId !== executingMessage.messageId
        );
        
        const errorMessage: AssistantMessage = {
          messageId: `error-${action.actionId}-${Date.now()}`,
          author: 'system',
          content: `❌ Erro ao executar ação: ${action.label}${error instanceof Error ? ` (${error.message})` : ''}`,
          createdAt: new Date().toISOString(),
        };

        return {
          ...prev,
          messages: [...messagesWithoutExecuting, errorMessage],
        };
      });

      // Tentar recarregar conversa mesmo em caso de erro
      try {
        await loadConversation(sessionId);
      } catch (reloadError) {
        console.error('Erro ao recarregar conversa:', reloadError);
      }
    } finally {
      // Remover ação do conjunto de ações executando
      setExecutingActions((prev) => {
        const next = new Set(prev);
        next.delete(action.actionId);
        return next;
      });
    }
  };

  const handleActionClick = (action: AssistantSuggestedAction) => {
    executeAction(action);
  };

  const handleShortcutClick = (shortcut: { label: string; intent: string; parameters: Record<string, any> }) => {
    // Preencher input com texto baseado no shortcut
    // Por enquanto, usar um texto genérico
    const text = `Repetir: ${shortcut.label}`;
    setInputText(text);
    
    // Opcional: disparar diretamente
    // setTimeout(() => sendMessage(), 100);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="assistant-chat">
      {/* Seção de atalhos sugeridos */}
      {conversation?.memoryContext?.suggestedShortcuts && 
       conversation.memoryContext.suggestedShortcuts.length > 0 && (
        <div className="shortcuts-section">
          <h3>Atalhos sugeridos</h3>
          <div className="shortcuts-list">
            {conversation.memoryContext.suggestedShortcuts.map((shortcut) => (
              <button
                key={shortcut.shortcutId}
                className="shortcut-button"
                onClick={() => handleShortcutClick(shortcut)}
              >
                {shortcut.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Área de mensagens */}
      <div className="messages-container">
        {conversation?.messages.map((message) => (
          <div
            key={message.messageId}
            className={`message message-${message.author}`}
          >
            <div className="message-content">
              <p>{message.content}</p>
              <span className="message-time">
                {new Date(message.createdAt).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message message-system">
            <div className="message-content">
              <p className="typing-indicator">Digitando...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Ações sugeridas */}
      {conversation?.suggestedActions && conversation.suggestedActions.length > 0 && (
        <div className="suggested-actions">
          {conversation.suggestedActions.map((action) => {
            const isExecuting = executingActions.has(action.actionId);
            const isDisabled = action.status === 'executed' || action.status === 'failed' || isExecuting;
            
            return (
              <button
                key={action.actionId}
                className={`action-button action-${action.status} ${isExecuting ? 'action-executing' : ''}`}
                onClick={() => handleActionClick(action)}
                disabled={isDisabled}
              >
                {isExecuting ? (
                  <>
                    <span className="spinner"></span>
                    Executando...
                  </>
                ) : (
                  action.label
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Input de mensagem */}
      <div className="input-container">
        <VoiceButton
          sessionId={localStorage.getItem(SESSION_ID_KEY) || undefined}
          onResponse={(response: VoiceResponse) => {
            if (response.data?.conversation) {
              setConversation(response.data.conversation);
              // Salvar sessionId se não existir
              if (response.data.conversation.sessionId) {
                localStorage.setItem(SESSION_ID_KEY, response.data.conversation.sessionId);
              }
            }
          }}
          disabled={isLoading}
        />
        <input
          type="text"
          className="message-input"
          placeholder="Digite sua mensagem..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isLoading}
        />
        <button
          className="send-button"
          onClick={sendMessage}
          disabled={isLoading || !inputText.trim()}
        >
          {isLoading ? 'Enviando...' : 'Enviar'}
        </button>
      </div>
    </div>
  );
}

