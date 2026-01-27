// frontend/src/pages/CrmContactDetailPage.tsx
// SPRINT 88: CRM Canônico - Detalhe do Contato

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getContactById, type Contact } from '../api/contacts';
import {
  getContactTimeline,
  listContactNotes,
  addContactNote,
  listTags,
  createTag,
  assignTag,
  removeTag,
  getConsents,
  setConsent,
  type CrmNote,
  type CrmTag,
  type CrmConsent,
  type CrmTimelineEvent,
  type CreateCrmNoteInput,
  type CreateCrmTagInput,
} from '../api/crm';
import './CrmContactDetailPage.css';

export default function CrmContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contact, setContact] = useState<Contact | null>(null);
  const [timeline, setTimeline] = useState<CrmTimelineEvent[]>([]);
  const [notes, setNotes] = useState<CrmNote[]>([]);
  const [tags, setTags] = useState<CrmTag[]>([]);
  const [contactTags, setContactTags] = useState<CrmTag[]>([]);
  const [consents, setConsents] = useState<CrmConsent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'notes' | 'tags' | 'consents'>('timeline');

  // Form states
  const [newNote, setNewNote] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#007bff');

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);

      const [contactData, timelineData, notesData, tagsData, consentsData] = await Promise.all([
        getContactById(id),
        getContactTimeline(id),
        listContactNotes(id),
        listTags(),
        getConsents(id),
      ]);

      setContact(contactData);
      setTimeline(timelineData);
      setNotes(notesData);

      // Filtrar tags do contato (assumindo que temos uma forma de identificar)
      // Por enquanto, vamos mostrar todas as tags disponíveis
      setTags(tagsData);
      setConsents(consentsData);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!id || !newNote.trim()) return;
    try {
      const note: CreateCrmNoteInput = {
        note: newNote,
        visibility: 'INTERNAL',
      };
      const created = await addContactNote(id, note);
      setNotes([created, ...notes]);
      setNewNote('');
    } catch (err: any) {
      setError(err.message || 'Erro ao adicionar nota');
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const tag: CreateCrmTagInput = {
        name: newTagName,
        color: newTagColor,
      };
      const created = await createTag(tag);
      setTags([...tags, created]);
      setNewTagName('');
    } catch (err: any) {
      setError(err.message || 'Erro ao criar tag');
    }
  };

  const handleAssignTag = async (tagId: string) => {
    if (!id) return;
    try {
      await assignTag(id, tagId);
      const tag = tags.find((t) => t.id === tagId);
      if (tag && !contactTags.find((t) => t.id === tagId)) {
        setContactTags([...contactTags, tag]);
      }
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao atribuir tag');
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!id) return;
    try {
      await removeTag(id, tagId);
      setContactTags(contactTags.filter((t) => t.id !== tagId));
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao remover tag');
    }
  };

  if (loading) {
    return <div className="loading">Carregando...</div>;
  }

  if (error || !contact) {
    return (
      <div className="error-message">
        {error || 'Contato não encontrado'}
      </div>
    );
  }

  return (
    <div className="crm-contact-detail">
      <div className="contact-header">
        <button className="btn-back" onClick={() => navigate('/crm')}>
          ← Voltar
        </button>
        <h1>{contact.name}</h1>
      </div>

      <div className="contact-info-section">
        <div className="info-item">
          <strong>Tipo:</strong> {contact.type === 'PERSON' ? 'Pessoa Física' : 'Pessoa Jurídica'}
        </div>
        {contact.taxId && (
          <div className="info-item">
            <strong>{contact.type === 'PERSON' ? 'CPF' : 'CNPJ'}:</strong> {contact.taxId}
          </div>
        )}
        {contact.email && (
          <div className="info-item">
            <strong>Email:</strong> {contact.email}
          </div>
        )}
        {contact.phone && (
          <div className="info-item">
            <strong>Telefone:</strong> {contact.phone}
          </div>
        )}
      </div>

      <div className="tabs">
        <button
          className={activeTab === 'timeline' ? 'active' : ''}
          onClick={() => setActiveTab('timeline')}
        >
          Timeline
        </button>
        <button
          className={activeTab === 'notes' ? 'active' : ''}
          onClick={() => setActiveTab('notes')}
        >
          Notas
        </button>
        <button
          className={activeTab === 'tags' ? 'active' : ''}
          onClick={() => setActiveTab('tags')}
        >
          Tags
        </button>
        <button
          className={activeTab === 'consents' ? 'active' : ''}
          onClick={() => setActiveTab('consents')}
        >
          Consentimentos
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'timeline' && (
          <div className="timeline-section">
            <h2>Timeline</h2>
            {timeline.length === 0 ? (
              <p className="empty-state">Nenhum evento encontrado.</p>
            ) : (
              <div className="timeline-events">
                {timeline.map((event, idx) => (
                  <div key={idx} className="timeline-event">
                    <div className="event-date">
                      {new Date(event.occurredAt).toLocaleString('pt-BR')}
                    </div>
                    <div className="event-content">
                      <h4>{event.title}</h4>
                      <p>{event.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="notes-section">
            <h2>Notas</h2>
            <div className="add-note-form">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Adicionar nota..."
                rows={3}
              />
              <button onClick={handleAddNote} className="btn-primary">
                Adicionar Nota
              </button>
            </div>
            <div className="notes-list">
              {notes.map((note) => (
                <div key={note.id} className="note-item">
                  <div className="note-header">
                    <span className="note-date">
                      {new Date(note.createdAt).toLocaleString('pt-BR')}
                    </span>
                    <span className="note-visibility">{note.visibility}</span>
                  </div>
                  <div className="note-content">{note.note}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'tags' && (
          <div className="tags-section">
            <h2>Tags</h2>
            <div className="create-tag-form">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Nome da tag"
              />
              <input
                type="color"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
              />
              <button onClick={handleCreateTag} className="btn-primary">
                Criar Tag
              </button>
            </div>
            <div className="tags-list">
              {tags.map((tag) => (
                <div key={tag.id} className="tag-item">
                  <span
                    className="tag-badge"
                    style={{ backgroundColor: tag.color || '#007bff' }}
                  >
                    {tag.name}
                  </span>
                  <button
                    onClick={() => handleAssignTag(tag.id)}
                    className="btn-small"
                  >
                    Atribuir
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'consents' && (
          <div className="consents-section">
            <h2>Consentimentos</h2>
            <div className="consents-list">
              {['EMAIL', 'SMS', 'WHATSAPP', 'PUSH'].map((channel) => {
                const consent = consents.find((c) => c.channel === channel);
                return (
                  <div key={channel} className="consent-item">
                    <span className="consent-channel">{channel}</span>
                    <span className={`consent-status ${consent?.status || 'REVOKED'}`}>
                      {consent?.status || 'REVOKED'}
                    </span>
                    <button
                      onClick={async () => {
                        if (!id) return;
                        try {
                          await setConsent(id, {
                            channel: channel as any,
                            status: consent?.status === 'GRANTED' ? 'REVOKED' : 'GRANTED',
                          });
                          await loadData();
                        } catch (err: any) {
                          setError(err.message || 'Erro ao atualizar consentimento');
                        }
                      }}
                      className="btn-small"
                    >
                      {consent?.status === 'GRANTED' ? 'Revogar' : 'Conceder'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}





