// src/components/PublicProfileVisibilityCard.tsx
// F-DISCOVERY-PUBLIC-PROFILE-SLICE-B + CARD — "quem pode me encontrar" (visibilidade) + o CARTÃO
// PÚBLICO (o usuário escolhe, campo a campo, o que aparece na sua página pública, estilo rede social).
// Projeção pura do backend: visibilidade via GET /mine + POST /publish; cartão via GET/PUT
// /public-profiles/mine/card (canRepresentActor server-side). Anti-PII por construção (só foto/bio/
// autodescrição/link — nunca CPF/nascimento/dinheiro). Zero verdade local: re-lido do servidor.

import { useCallback, useEffect, useState } from 'react';
import {
  getMyPublicProfile, publishMyProfile, getMyPublicCard, updateMyPublicCard,
  type MyPublicProfile, type PublicCard,
} from '../api/public-profiles';
import { showToast } from './common/Toast';

const DEFAULT_CARD: PublicCard = { showAvatar: true, showBio: true, headline: null, link: null };

export default function PublicProfileVisibilityCard() {
  const [profile, setProfile] = useState<MyPublicProfile | null>(null);
  const [card, setCard] = useState<PublicCard>(DEFAULT_CARD);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCard, setSavingCard] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([getMyPublicProfile(), getMyPublicCard().catch(() => DEFAULT_CARD)]);
      setProfile(p);
      setCard(c);
    } catch {
      /* fail-soft: mantém defaults */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isPublic = profile?.visibility === 'public';

  const setVisibility = async (visibility: 'public' | 'private') => {
    if (saving) return;
    setSaving(true);
    try {
      setProfile(await publishMyProfile(visibility));
      showToast(visibility === 'public'
        ? 'Perfil publicado — qualquer pessoa acha você na busca (só o que você escolheu mostrar).'
        : 'Perfil despublicado — você saiu da vitrine pública.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao alterar visibilidade', 'error');
    } finally { setSaving(false); }
  };

  const saveCard = async () => {
    if (savingCard) return;
    setSavingCard(true);
    try {
      await updateMyPublicCard(card);
      const c = await getMyPublicCard(); // re-lê a verdade do servidor
      setCard(c);
      showToast('Cartão público atualizado — é isso que as outras pessoas veem.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao salvar o cartão', 'error');
    } finally { setSavingCard(false); }
  };

  const wrap: React.CSSProperties = {
    background: '#fff', border: '1px solid #e2e4ea', borderRadius: 12,
    padding: '1rem 1.25rem', marginBottom: '1rem',
  };
  const rowTop: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap',
  };
  const pill = (active: boolean, color: string, bg: string): React.CSSProperties => ({
    padding: '0.45rem 1rem', borderRadius: 999,
    border: active ? `1.5px solid ${color}` : '1px solid #e2e4ea',
    background: active ? bg : '#fff', color: active ? color : '#5a5f73',
    fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
  });

  return (
    <div style={wrap} data-testid="public-profile-visibility-card">
      {/* visibilidade */}
      <div style={rowTop}>
        <div style={{ minWidth: 240, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#23263b' }}>🔎 Quem pode me encontrar</div>
          <div style={{ fontSize: '0.8rem', color: '#5a5f73', marginTop: 2 }}>
            {loading ? 'Carregando…' : isPublic
              ? 'Seu perfil está na vitrine pública. Escolha abaixo o que aparece na sua página.'
              : 'Só você: seu perfil não aparece na busca. Dinheiro e dados privados ficam protegidos sempre.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" disabled={saving || loading || isPublic} onClick={() => setVisibility('public')}
            style={pill(!!isPublic, '#2f7a3f', '#e4f1e6')}>🌐 Público</button>
          <button type="button" disabled={saving || loading || !isPublic} onClick={() => setVisibility('private')}
            style={pill(!isPublic, '#4f5bd5', '#eaecfb')}>🔒 Só eu</button>
        </div>
      </div>

      {/* cartão público — o que aparece */}
      {isPublic && !loading && (
        <div style={{ marginTop: '1rem', borderTop: '1px solid #eef0f4', paddingTop: '0.9rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#23263b', marginBottom: 2 }}>
            O que aparece na minha página pública
          </div>
          <div style={{ fontSize: '0.75rem', color: '#8a8d91', marginBottom: '0.8rem' }}>
            Você controla cada informação. Seu nome sempre aparece (é como te acham); o resto é sua escolha.
          </div>

          {/* foto */}
          <FieldToggle
            label="📷 Foto de perfil"
            value={card.showAvatar}
            onChange={(v) => setCard((c) => ({ ...c, showAvatar: v }))}
          />
          {/* bio */}
          <FieldToggle
            label="📝 Apresentação (bio)"
            value={card.showBio}
            onChange={(v) => setCard((c) => ({ ...c, showBio: v }))}
          />

          {/* headline */}
          <label style={{ display: 'block', marginTop: '0.7rem' }}>
            <span style={{ fontSize: '0.78rem', color: '#5a5f73', fontWeight: 600 }}>Uma linha sobre você (aparece publicamente)</span>
            <input
              type="text" maxLength={120}
              placeholder="Ex.: Criador de conteúdo digital · Curitiba"
              value={card.headline ?? ''}
              onChange={(e) => setCard((c) => ({ ...c, headline: e.target.value || null }))}
              style={{ width: '100%', marginTop: 4, padding: '0.5rem 0.7rem', borderRadius: 8, border: '1px solid #e2e4ea', fontSize: '0.85rem' }}
            />
          </label>

          {/* link */}
          <label style={{ display: 'block', marginTop: '0.6rem' }}>
            <span style={{ fontSize: '0.78rem', color: '#5a5f73', fontWeight: 600 }}>Link (site, portfólio — opcional)</span>
            <input
              type="text" maxLength={200}
              placeholder="mercadoeshop.com"
              value={card.link ?? ''}
              onChange={(e) => setCard((c) => ({ ...c, link: e.target.value || null }))}
              style={{ width: '100%', marginTop: 4, padding: '0.5rem 0.7rem', borderRadius: 8, border: '1px solid #e2e4ea', fontSize: '0.85rem' }}
            />
          </label>

          <div style={{ marginTop: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <button type="button" disabled={savingCard} onClick={saveCard}
              style={{ padding: '0.5rem 1.2rem', borderRadius: 8, border: 'none', background: '#4f5bd5', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: savingCard ? 'default' : 'pointer', opacity: savingCard ? 0.7 : 1 }}>
              {savingCard ? 'Salvando…' : 'Salvar o que aparece'}
            </button>
            <span style={{ fontSize: '0.72rem', color: '#8a8d91' }}>
              🔒 CPF, nascimento, dinheiro e agenda NUNCA aparecem — nem aqui, nem na vitrine.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.35rem 0' }}>
      <span style={{ fontSize: '0.85rem', color: '#23263b' }}>{label}</span>
      <div style={{ display: 'flex', gap: '0.35rem' }}>
        <button type="button" onClick={() => onChange(true)}
          style={{ padding: '0.28rem 0.7rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
            border: value ? '1.5px solid #2f7a3f' : '1px solid #e2e4ea', background: value ? '#e4f1e6' : '#fff', color: value ? '#2f7a3f' : '#8a8d91' }}>
          Mostrar
        </button>
        <button type="button" onClick={() => onChange(false)}
          style={{ padding: '0.28rem 0.7rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
            border: !value ? '1.5px solid #4f5bd5' : '1px solid #e2e4ea', background: !value ? '#eaecfb' : '#fff', color: !value ? '#4f5bd5' : '#8a8d91' }}>
          Ocultar
        </button>
      </div>
    </div>
  );
}
