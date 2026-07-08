// Modal de PERFIL PÚBLICO — abre no lugar (não navega), para não tirar o dono/consumidor do fluxo de
// confirmação. Projeta a MESMA fonte da vitrine (GET /public-profiles/global/:actorId); zero verdade
// paralela. Quem quiser o perfil completo tem o link "Ver vitrine completa".
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGlobalPublicProfile, type GlobalPublicProfile } from '../../api/public-profiles';
import './ActorProfileModal.css';

export default function ActorProfileModal({ actorId, onClose }: { actorId: string; onClose: () => void }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<GlobalPublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    getGlobalPublicProfile(actorId)
      .then((p) => { if (alive) setProfile(p); })
      .catch((e) => { if (alive) setError(e?.message || 'Não foi possível carregar o perfil.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [actorId]);

  const TYPE_LABEL: Record<string, string> = { user: 'Pessoa Física', page: 'Empresa', group: 'Grupo', cultural_profile: 'Perfil cultural' };

  return (
    <div className="apm-overlay" onClick={onClose}>
      <div className="apm-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="apm-x" onClick={onClose} aria-label="Fechar">✕</button>
        {loading && <p className="apm-status">Carregando perfil…</p>}
        {error && <p className="apm-status apm-error">{error}</p>}
        {profile && (
          <>
            <div className="apm-cover" style={profile.coverUrl ? { backgroundImage: `url(${profile.coverUrl})` } : undefined} />
            <div className="apm-head">
              {profile.avatarUrl
                ? <img className="apm-avatar" src={profile.avatarUrl} alt="" />
                : <span className="apm-avatar apm-avatar-fallback">{profile.displayName.charAt(0).toUpperCase()}</span>}
              <div>
                <h3 className="apm-name">{profile.displayName}</h3>
                <span className="apm-type">{TYPE_LABEL[profile.profileType] ?? profile.profileType}</span>
              </div>
            </div>
            {profile.headline && <p className="apm-headline">{profile.headline}</p>}
            {profile.bio && <p className="apm-bio">{profile.bio}</p>}
            {/* Reputação/histórico ainda dormente — estado honesto, sem score inventado. */}
            <p className="apm-trust">🔒 Reputação e histórico de negócios ainda não disponíveis.</p>
            <div className="apm-actions">
              <button type="button" className="apm-secondary" onClick={onClose}>Fechar</button>
              <button type="button" className="apm-primary" onClick={() => { onClose(); navigate(`/vitrine/${profile.actorId}`); }}>Ver vitrine completa →</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
