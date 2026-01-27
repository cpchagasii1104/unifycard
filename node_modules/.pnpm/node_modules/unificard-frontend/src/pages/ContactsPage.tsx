// src/pages/ContactsPage.tsx
// SPRINT 0: Página de Contatos
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listContacts, createContact, updateContact, type Contact, type CreateContactInput, type UpdateContactInput } from '../api/contacts';
import './ContactsPage.css';

export default function ContactsPage() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [formData, setFormData] = useState<CreateContactInput>({
    type: 'PERSON',
    name: '',
    taxId: null,
    email: null,
    phone: null,
    address: {},
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      if (editingContact) {
        const updated = await updateContact(editingContact.id, formData);
        setContacts(contacts.map(c => c.id === updated.id ? updated : c));
      } else {
        const created = await createContact(formData);
        setContacts([created, ...contacts]);
      }
      setShowForm(false);
      setEditingContact(null);
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar contato');
    }
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      type: contact.type,
      name: contact.name,
      taxId: contact.taxId,
      email: contact.email,
      phone: contact.phone,
      address: contact.address,
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingContact(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      type: 'PERSON',
      name: '',
      taxId: null,
      email: null,
      phone: null,
      address: {},
    });
  };

  return (
    <div className="contacts-page">
      <div className="contacts-header">
        <h1>Contatos</h1>
        <button
          className="btn-primary"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          Novo Contato
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {showForm && (
        <div className="contact-form-container">
          <h2>{editingContact ? 'Editar Contato' : 'Novo Contato'}</h2>
          <form onSubmit={handleSubmit} className="contact-form">
            <div className="form-group">
              <label>Tipo</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'PERSON' | 'COMPANY' })}
                disabled={!!editingContact}
              >
                <option value="PERSON">Pessoa Física</option>
                <option value="COMPANY">Pessoa Jurídica</option>
              </select>
            </div>

            <div className="form-group">
              <label>Nome *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>{formData.type === 'PERSON' ? 'CPF' : 'CNPJ'}</label>
              <input
                type="text"
                value={formData.taxId || ''}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value || null })}
                placeholder={formData.type === 'PERSON' ? '000.000.000-00' : '00.000.000/0000-00'}
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value || null })}
              />
            </div>

            <div className="form-group">
              <label>Telefone</label>
              <input
                type="text"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value || null })}
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary">
                {editingContact ? 'Salvar' : 'Criar'}
              </button>
              <button type="button" className="btn-secondary" onClick={handleCancel}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="contacts-search">
        <input
          type="text"
          placeholder="Buscar por nome, email, telefone ou CPF/CNPJ..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading">Carregando...</div>
      ) : contacts.length === 0 ? (
        <div className="empty-state">
          {searchTerm ? 'Nenhum contato encontrado' : 'Nenhum contato cadastrado'}
        </div>
      ) : (
        <div className="contacts-list">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>CPF/CNPJ</th>
                <th>Email</th>
                <th>Telefone</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id}>
                  <td>{contact.name}</td>
                  <td>{contact.type === 'PERSON' ? 'PF' : 'PJ'}</td>
                  <td>{contact.taxId || '-'}</td>
                  <td>{contact.email || '-'}</td>
                  <td>{contact.phone || '-'}</td>
                  <td>
                    <button
                      className="btn-link"
                      onClick={() => handleEdit(contact)}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}





