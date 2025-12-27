// frontend/src/components/ai/AIChat.tsx
import { useState } from 'react';
import { postChat } from '../../api/ai';
import './AIChat.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatProps {
  tab: string;
}

export default function AIChat({ tab }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: inputText };
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await postChat(inputText, tab);
      const assistantMessage: Message = { role: 'assistant', content: response.response };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      const errorMessage: Message = { role: 'assistant', content: 'Erro ao processar mensagem.' };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ai-chat">
      <div className="ai-chat-messages">
        {messages.length === 0 && (
          <div className="ai-chat-empty">Envie uma mensagem para começar</div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`ai-chat-message ai-chat-message-${msg.role}`}>
            <div className="ai-chat-message-content">{msg.content}</div>
          </div>
        ))}
      </div>
      <div className="ai-chat-input-container">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Digite sua mensagem..."
          className="ai-chat-input"
          disabled={isLoading}
        />
        <button onClick={handleSend} disabled={isLoading || !inputText.trim()} className="ai-chat-send">
          {isLoading ? 'Enviando...' : 'Enviar'}
        </button>
      </div>
    </div>
  );
}


