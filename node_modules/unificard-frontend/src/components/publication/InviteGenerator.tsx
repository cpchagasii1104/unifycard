// frontend/src/components/publication/InviteGenerator.tsx
// Gerador de convite pronto para WhatsApp/E-mail

import { useState } from 'react';
import type { GeneratedLink } from '../../types/publication';
import './InviteGenerator.css';

interface InviteGeneratorProps {
  entityType: 'event' | 'post' | 'group' | 'channel';
  entityId: string;
  entityTitle: string;
  entityDate?: string;
  shareLink: GeneratedLink;
  referralCode?: string | null;
}

export default function InviteGenerator({
  entityType,
  entityId,
  entityTitle,
  entityDate,
  shareLink,
  referralCode,
}: InviteGeneratorProps) {
  const [copied, setCopied] = useState(false);

  // Gerar mensagem padrão
  const generateMessage = (): string => {
    let message = `Você foi convidado para: ${entityTitle}`;
    
    if (entityDate) {
      const date = new Date(entityDate);
      message += `\nData: ${date.toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    }
    
    message += `\nLink: ${shareLink.url}`;
    
    if (referralCode) {
      message += `\n\nUse meu código: ${referralCode}`;
    }
    
    return message;
  };

  const message = generateMessage();
  const encodedMessage = encodeURIComponent(message);

  // WhatsApp deep link
  const whatsappLink = `https://wa.me/?text=${encodedMessage}`;

  // E-mail (mailto)
  const emailSubject = encodeURIComponent(`Convite: ${entityTitle}`);
  const emailBody = encodeURIComponent(message);
  const emailLink = `mailto:?subject=${emailSubject}&body=${emailBody}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="invite-generator">
      <h3 className="generator-title">Compartilhar convite</h3>
      
      {/* WhatsApp */}
      <div className="invite-method">
        <div className="method-header">
          <span className="method-icon">📱</span>
          <span className="method-label">WhatsApp</span>
        </div>
        <div className="method-actions">
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="method-button method-button-primary"
          >
            Abrir WhatsApp
          </a>
          <button
            className="method-button method-button-secondary"
            onClick={() => copyToClipboard(message)}
          >
            {copied ? 'Copiado!' : 'Copiar mensagem'}
          </button>
        </div>
      </div>

      {/* E-mail */}
      <div className="invite-method">
        <div className="method-header">
          <span className="method-icon">📧</span>
          <span className="method-label">E-mail</span>
        </div>
        <div className="method-actions">
          <a
            href={emailLink}
            className="method-button method-button-primary"
          >
            Abrir cliente de e-mail
          </a>
          <button
            className="method-button method-button-secondary"
            onClick={() => copyToClipboard(message)}
          >
            {copied ? 'Copiado!' : 'Copiar mensagem'}
          </button>
        </div>
      </div>

      {/* Link direto */}
      <div className="invite-method">
        <div className="method-header">
          <span className="method-icon">🔗</span>
          <span className="method-label">Link direto</span>
        </div>
        <div className="method-link">
          <input
            type="text"
            value={shareLink.url}
            readOnly
            className="link-input"
          />
          <button
            className="method-button method-button-secondary"
            onClick={() => copyToClipboard(shareLink.url)}
          >
            {copied ? 'Copiado!' : 'Copiar link'}
          </button>
        </div>
      </div>

      {/* Preview da mensagem */}
      <div className="message-preview">
        <h4>Preview da mensagem:</h4>
        <div className="preview-content">
          {message.split('\n').map((line, idx) => (
            <div key={idx}>{line || '\u00A0'}</div>
          ))}
        </div>
      </div>
    </div>
  );
}



