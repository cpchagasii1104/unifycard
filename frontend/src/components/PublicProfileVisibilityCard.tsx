// src/components/PublicProfileVisibilityCard.tsx
// F-DISCOVERY-PUBLIC-PROFILE-SLICE-B — o toggle "quem pode me encontrar" do perfil.
// Projeção pura do backend (GET /public-profiles/mine); a escolha grava via POST /publish
// (canRepresentActor server-side). Visibilidade NUNCA concede autoridade (desenho selado
// VISIBILIDADE_E_DESCOBERTA_DESENHO_CANONICO.md). Zero verdade local: nada persistido no
// navegador; estado re-lido do servidor após cada mudança.

import { useCallback, useEffect, useState } from 'react';
import { getMyPublicProfile, publishMyProfile, type MyPublicProfile } from '../api/public-profiles';
import { showToast } from './common/Toast';

export default function PublicProfileVisibilityCard() {
  const [profile, setProfile] = useState<MyPublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProfile(await getMyPublicProfile());
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar visibilidade do perfil');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isPublic = profile?.visibility === 'public';

  const setVisibility = async (visibility: 'public' | 'private') => {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await publishMyProfile(visibility);
      setProfile(updated);
      showToast(
        visibility === 'public'
          ? 'Perfil publicado — agora você pode ser encontrado na busca por qualquer pessoa.'
          : 'Perfil despublicado — você saiu da vitrine pública.',
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'Erro ao alterar visibilidade', 'error');
    } finally {
      setSaving(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #e2e4ea',
    borderRadius: 12,
    padding: '1rem 1.25rem',
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
  };

  return (
    <div style={cardStyle} data-testid="public-profile-visibility-card">
      <div style={{ minWidth: 240, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#23263b' }}>
          🔎 Quem pode me encontrar
        </div>
        <div style={{ fontSize: '0.8rem', color: '#5a5f73', marginTop: 2 }}>
          {loading
            ? 'Carregando…'
            : error
              ? error
              : isPublic
                ? 'Seu perfil está na vitrine pública: qualquer pessoa acha você na busca (nome, foto e bio — nunca seus dados privados).'
                : 'Só você: seu perfil não aparece na busca de outras pessoas. Dinheiro e dados privados ficam protegidos sempre, em qualquer opção.'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          disabled={saving || loading || isPublic}
          onClick={() => setVisibility('public')}
          style={{
            padding: '0.45rem 1rem',
            borderRadius: 999,
            border: isPublic ? '1.5px solid #2f7a3f' : '1px solid #e2e4ea',
            background: isPublic ? '#e4f1e6' : '#fff',
            color: isPublic ? '#2f7a3f' : '#5a5f73',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: isPublic ? 'default' : 'pointer',
          }}
        >
          🌐 Público
        </button>
        <button
          type="button"
          disabled={saving || loading || !isPublic}
          onClick={() => setVisibility('private')}
          style={{
            padding: '0.45rem 1rem',
            borderRadius: 999,
            border: !isPublic ? '1.5px solid #4f5bd5' : '1px solid #e2e4ea',
            background: !isPublic ? '#eaecfb' : '#fff',
            color: !isPublic ? '#4f5bd5' : '#5a5f73',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: !isPublic ? 'default' : 'pointer',
          }}
        >
          🔒 Só eu
        </button>
      </div>
    </div>
  );
}
