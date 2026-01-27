// src/components/CulturalProfilesManager.tsx
// Componente para gerenciar Perfis de Atuação Cultural (PAC) - FASE 16
// UI mínima funcional

import React, { useState, useEffect } from 'react';
import { useActiveActor } from '../contexts/ActiveActorContext';
import {
  createCulturalProfile,
  listCulturalProfiles,
  type CulturalProfile,
  type CreateCulturalProfileInput,
  type CulturalProfileType,
} from '../api/cultural';
import './CulturalProfilesManager.css';

const CULTURAL_TYPES: { value: CulturalProfileType; label: string }[] = [
  { value: 'ARTIST', label: 'Artista' },
  { value: 'BAND', label: 'Banda' },
  { value: 'BAR', label: 'Bar' },
  { value: 'VENUE', label: 'Casa de Eventos' },
  { value: 'COLLECTIVE', label: 'Coletivo' },
  { value: 'PRODUCER', label: 'Produtor' },
  { value: 'CIRCLE', label: 'Círculo Cultural' },
  { value: 'EDUCATOR', label: 'Educador' },
  { value: 'CURATOR', label: 'Curador' },
];

export default function CulturalProfilesManager() {
  const { activeActor } = useActiveActor();
  const [profiles, setProfiles] = useState<CulturalProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CreateCulturalProfileInput>({
    owner_actor_id: activeActor?.actor_id || '',
    owner_actor_type: activeActor?.actor_type === 'user' ? 'user' : 'page',
    type: 'ARTIST',
    display_name: '',
    slug: '',
    description: '',
  });

  useEffect(() => {
    if (activeActor) {
      loadProfiles();
    }
  }, [activeActor]);

  const loadProfiles = async () => {
    if (!activeActor) return;

    setLoading(true);
    setError(null);
    try {
      const ownerActorType = activeActor.actor_type === 'user' ? 'user' : 'page';
      const result = await listCulturalProfiles(activeActor.actor_id, ownerActorType);
      setProfiles(result.profiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar perfis culturais');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeActor) return;

    setCreating(true);
    setError(null);
    try {
      const input: CreateCulturalProfileInput = {
        ...formData,
        owner_actor_id: activeActor.actor_id,
        owner_actor_type: activeActor.actor_type === 'user' ? 'user' : 'page',
      };

      const newProfile = await createCulturalProfile(input);
      setProfiles([newProfile, ...profiles]);
      setShowCreateForm(false);
      setFormData({
        owner_actor_id: activeActor.actor_id,
        owner_actor_type: activeActor.actor_type === 'user' ? 'user' : 'page',
        type: 'ARTIST',
        display_name: '',
        slug: '',
        description: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar perfil cultural');
    } finally {
      setCreating(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleDisplayNameChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      display_name: value,
      slug: prev.slug || generateSlug(value),
    }));
  };

  if (!activeActor) {
    return (
      <div className="cultural-profiles-manager">
        <p>Selecione um ator ativo para gerenciar perfis culturais.</p>
      </div>
    );
  }

  return (
    <div className="cultural-profiles-manager">
      <div className="cultural-profiles-header">
        <h2>Perfis de Atuação Cultural</h2>
        <button
          type="button"
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="btn-create-profile"
        >
          {showCreateForm ? 'Cancelar' : '+ Criar Perfil Cultural'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showCreateForm && (
        <form onSubmit={handleCreate} className="create-profile-form">
          <div className="form-group">
            <label htmlFor="type">Tipo *</label>
            <select
              id="type"
              value={formData.type}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, type: e.target.value as CulturalProfileType }))
              }
              required
            >
              {CULTURAL_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="display_name">Nome *</label>
            <input
              id="display_name"
              type="text"
              value={formData.display_name}
              onChange={(e) => handleDisplayNameChange(e.target.value)}
              required
              placeholder="Ex: Banda Rock Nacional"
            />
          </div>

          <div className="form-group">
            <label htmlFor="slug">Slug *</label>
            <input
              id="slug"
              type="text"
              value={formData.slug}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, slug: e.target.value.toLowerCase() }))
              }
              required
              pattern="[a-z0-9-]+"
              placeholder="banda-rock-nacional"
            />
            <small>Apenas letras minúsculas, números e hífens</small>
          </div>

          <div className="form-group">
            <label htmlFor="description">Descrição</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={3}
              placeholder="Descreva seu perfil cultural..."
            />
          </div>

          <button type="submit" disabled={creating} className="btn-submit">
            {creating ? 'Criando...' : 'Criar Perfil'}
          </button>
        </form>
      )}

      {loading ? (
        <p>Carregando perfis culturais...</p>
      ) : profiles.length === 0 ? (
        <div className="empty-state">
          <p>Nenhum perfil cultural criado ainda.</p>
          <p>Crie um perfil para começar a organizar eventos culturais.</p>
        </div>
      ) : (
        <div className="profiles-list">
          {profiles.map((profile) => (
            <div key={profile.id} className="profile-card">
              <div className="profile-header">
                <h3>{profile.display_name}</h3>
                <span className="profile-type">{CULTURAL_TYPES.find((t) => t.value === profile.type)?.label}</span>
              </div>
              {profile.description && <p className="profile-description">{profile.description}</p>}
              <div className="profile-meta">
                <span className="profile-slug">@{profile.slug}</span>
                <span className={`profile-status ${profile.active ? 'active' : 'inactive'}`}>
                  {profile.active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}






