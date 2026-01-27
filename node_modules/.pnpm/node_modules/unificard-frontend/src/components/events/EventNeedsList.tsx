// src/components/events/EventNeedsList.tsx
// Lista de Necessidades do Evento
// SPRINT: Eventos Assistidos

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './EventNeedsList.css';

export interface EventNeed {
  id: string;
  category: string;
  status: 'PENDENTE';
  description: string | null;
  createdAt: string;
}

export interface EventNeedsListProps {
  needs: EventNeed[];
  onUpdate: (needs: EventNeed[]) => void;
  canEdit?: boolean;
  eventId?: string; // Para criar Service Order a partir da necessidade
}

export default function EventNeedsList({ needs, onUpdate, canEdit = true, eventId }: EventNeedsListProps) {
  const navigate = useNavigate();
  const [isAdding, setIsAdding] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const handleRemove = (id: string) => {
    if (window.confirm('Deseja remover esta necessidade?')) {
      onUpdate(needs.filter(n => n.id !== id));
    }
  };

  const handleAdd = () => {
    if (!newCategory.trim()) {
      alert('Informe a categoria da necessidade');
      return;
    }

    const newNeed: EventNeed = {
      id: `need-${Date.now()}-${Math.random()}`,
      category: newCategory.trim(),
      status: 'PENDENTE',
      description: newDescription.trim() || null,
      createdAt: new Date().toISOString(),
    };

    onUpdate([...needs, newNeed]);
    setNewCategory('');
    setNewDescription('');
    setIsAdding(false);
  };

  const handleCreateServiceOrder = (need: EventNeed) => {
    if (!eventId) {
      alert('ID do evento não disponível');
      return;
    }

    // Navegar para criar Service Order com informações da necessidade
    navigate(`/service-orders/new?eventId=${eventId}&needId=${need.id}&needCategory=${encodeURIComponent(need.category)}&needDescription=${encodeURIComponent(need.description || '')}`);
  };

  if (needs.length === 0 && !isAdding) {
    return (
      <div className="event-needs-list">
        <div className="needs-empty">
          <p>Nenhuma necessidade cadastrada ainda.</p>
          {canEdit && (
            <button onClick={() => setIsAdding(true)} className="btn-primary">
              Adicionar Necessidade
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="event-needs-list">
      <div className="needs-header">
        <h3>Necessidades do Evento</h3>
        {canEdit && (
          <button onClick={() => setIsAdding(true)} className="btn-add">
            + Adicionar
          </button>
        )}
      </div>

      {isAdding && (
        <div className="need-add-form">
          <div className="form-group">
            <label htmlFor="new-category">Categoria *</label>
            <input
              id="new-category"
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Ex: Decoração, Buffet, Som..."
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="new-description">Descrição (opcional)</label>
            <textarea
              id="new-description"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Detalhes adicionais..."
              rows={2}
            />
          </div>
          <div className="form-actions">
            <button onClick={() => { setIsAdding(false); setNewCategory(''); setNewDescription(''); }} className="btn-secondary">
              Cancelar
            </button>
            <button onClick={handleAdd} className="btn-primary">
              Adicionar
            </button>
          </div>
        </div>
      )}

      <div className="needs-items">
        {needs.map((need) => (
          <div key={need.id} className="need-item">
            <div className="need-content">
              <strong>{need.category}</strong>
              {need.description && <p>{need.description}</p>}
            </div>
            <div className="need-actions">
              <span className="status-badge">{need.status}</span>
              {eventId && (
                <button 
                  onClick={() => handleCreateServiceOrder(need)} 
                  className="btn-create-service-order"
                  title="Criar Service Order para esta necessidade"
                >
                  Criar Service Order
                </button>
              )}
              {canEdit && (
                <button onClick={() => handleRemove(need.id)} className="btn-remove">
                  Remover
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

