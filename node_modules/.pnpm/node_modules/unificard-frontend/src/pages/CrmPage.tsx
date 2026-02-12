// frontend/src/pages/CrmPage.tsx
// SPRINT 88: CRM Canônico - Lista de Contatos

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listContacts, type Contact } from '../api/contacts';
import './CrmPage.css';

export default function CrmPage() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadContacts();
  }, [searchTerm]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      setError(null);
      const filters = searchTerm ? { search: searchTerm } : undefined;
      const data = await listContacts(filters);
      setContacts(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar contatos');
    } finally {
      setLoading(false);
    }
  };

  const handleContactClick = (contactId: string) => {
    navigate(`/crm/contacts/${contactId}`);
  };

  return (
    <div className="crm-page">
      <div className="crm-header">
        <h1>CRM - Contatos</h1>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="crm-search">
        <input
          type="text"
          placeholder="Buscar por nome, email, telefone ou CPF/CNPJ..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {loading ? (
        <div className="loading">Carregando...</div>
      ) : contacts.length === 0 ? (
        <div className="empty-state">
          <p>Nenhum contato encontrado.</p>
        </div>
      ) : (
        <div className="contacts-list">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="contact-card"
              onClick={() => handleContactClick(contact.id)}
            >
              <div className="contact-info">
                <h3>{contact.name}</h3>
                <div className="contact-details">
                  {contact.taxId && (
                    <span className="detail-item">
                      {contact.type === 'PERSON' ? 'CPF' : 'CNPJ'}: {contact.taxId}
                    </span>
                  )}
                  {contact.email && (
                    <span className="detail-item">Email: {contact.email}</span>
                  )}
                  {contact.phone && (
                    <span className="detail-item">Tel: {contact.phone}</span>
                  )}
                </div>
              </div>
              <div className="contact-actions">
                <button className="btn-view">Ver detalhes</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}





