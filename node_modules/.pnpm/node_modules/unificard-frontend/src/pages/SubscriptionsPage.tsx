// frontend/src/pages/SubscriptionsPage.tsx
// SPRINT 87: ASSINATURAS

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listSubscriptions,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  type Subscription,
} from '../api/subscriptions';
import { listContacts, type Contact } from '../api/contacts';
import './SubscriptionsPage.css';

export default function SubscriptionsPage() {
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'ALL'>('ALL');
  const [contactSearch, setContactSearch] = useState('');

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: any = {};
      if (statusFilter !== 'ALL') {
        filters.status = statusFilter;
      }

      const [subscriptionsData, contactsData] = await Promise.all([
        listSubscriptions(filters),
        listContacts(),
      ]);

      setSubscriptions(subscriptionsData);

      // Indexar contacts por ID
      const contactsMap: Record<string, Contact> = {};
      contactsData.forEach((contact) => {
        contactsMap[contact.id] = contact;
      });
      setContacts(contactsMap);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar assinaturas');
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async (subscriptionId: string) => {
    try {
      await pauseSubscription(subscriptionId);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao pausar assinatura');
    }
  };

  const handleResume = async (subscriptionId: string) => {
    try {
      await resumeSubscription(subscriptionId);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao retomar assinatura');
    }
  };

  const handleCancel = async (subscriptionId: string) => {
    if (!confirm('Tem certeza que deseja cancelar esta assinatura?')) {
      return;
    }
    try {
      await cancelSubscription(subscriptionId);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao cancelar assinatura');
    }
  };

  const filteredSubscriptions = subscriptions.filter((sub) => {
    if (!contactSearch) return true;
    const contact = contacts[sub.contactId];
    if (!contact) return false;
    return (
      contact.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
      contact.email?.toLowerCase().includes(contactSearch.toLowerCase()) ||
      contact.taxId?.includes(contactSearch)
    );
  });

  return (
    <div className="subscriptions-page">
      <div className="subscriptions-header">
        <h1>Assinaturas</h1>
        <button className="btn-primary" onClick={() => navigate('/subscriptions/new')}>
          Nova Assinatura
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="subscriptions-filters">
        <div className="filter-group">
          <label>Status:</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
            <option value="ALL">Todos</option>
            <option value="ACTIVE">Ativas</option>
            <option value="PAUSED">Pausadas</option>
            <option value="CANCELLED">Canceladas</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Buscar contato:</label>
          <input
            type="text"
            placeholder="Nome, email ou CPF/CNPJ..."
            value={contactSearch}
            onChange={(e) => setContactSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading">Carregando...</div>
      ) : filteredSubscriptions.length === 0 ? (
        <div className="empty-state">Nenhuma assinatura encontrada.</div>
      ) : (
        <div className="subscriptions-list">
          {filteredSubscriptions.map((subscription) => {
            const contact = contacts[subscription.contactId];
            return (
              <div key={subscription.id} className="subscription-card">
                <div className="subscription-info">
                  <h3>{contact?.name || 'Contato não encontrado'}</h3>
                  <div className="subscription-details">
                    <span className="detail-item">
                      Valor: R$ {subscription.amount.toFixed(2)} / {subscription.interval}
                    </span>
                    <span className="detail-item">Status: {subscription.status}</span>
                    {subscription.nextRunAt && (
                      <span className="detail-item">
                        Próxima execução: {new Date(subscription.nextRunAt).toLocaleString('pt-BR')}
                      </span>
                    )}
                    {subscription.failureCount > 0 && (
                      <span className="detail-item error">
                        Falhas: {subscription.failureCount}/{subscription.maxFailures}
                      </span>
                    )}
                  </div>
                </div>
                <div className="subscription-actions">
                  <button
                    className="btn-view"
                    onClick={() => navigate(`/subscriptions/${subscription.id}`)}
                  >
                    Ver detalhes
                  </button>
                  {subscription.status === 'ACTIVE' && (
                    <button
                      className="btn-warning"
                      onClick={() => handlePause(subscription.id)}
                    >
                      Pausar
                    </button>
                  )}
                  {subscription.status === 'PAUSED' && (
                    <button
                      className="btn-success"
                      onClick={() => handleResume(subscription.id)}
                    >
                      Retomar
                    </button>
                  )}
                  {subscription.status !== 'CANCELLED' && (
                    <button
                      className="btn-danger"
                      onClick={() => handleCancel(subscription.id)}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}





