// src/pages/VitrineProfilePage.tsx
// F-DISCOVERY-PUBLIC-PROFILE-PAGE — destino do clique no hit GLOBAL da busca (a plaquinha da vitrine).
// Layout estilo rede social (capa + avatar + nome + abas). PROJEÇÃO PURA do backend
// (GET /public-profiles/global/:actorId) — só a plaquinha pública (nome/avatar/capa/bio/tipo),
// cross-tenant por design, anti-PII. Ações cross-tenant (Seguir/Mensagem) ficam "em breve": o
// frontend NÃO cria capability/verdade — quando o backend ligar a ação, o botão liga.

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getGlobalPublicProfile, type GlobalPublicProfile } from '../api/public-profiles';
import './VitrineProfilePage.css';

const TYPE_LABEL: Record<GlobalPublicProfile['profileType'], string> = {
  user: 'Pessoa',
  page: 'Página',
  group: 'Grupo',
  cultural_profile: 'Canal cultural',
};

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

export default function VitrineProfilePage() {
  const { actorId = '' } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<'loading' | 'ready' | 'notfound'>('loading');
  const [profile, setProfile] = useState<GlobalPublicProfile | null>(null);
  const [tab, setTab] = useState<'sobre' | 'publicacoes' | 'fotos'>('sobre');

  useEffect(() => {
    let alive = true;
    setState('loading');
    getGlobalPublicProfile(actorId)
      .then((p) => { if (!alive) return; if (p) { setProfile(p); setState('ready'); } else { setState('notfound'); } })
      .catch(() => { if (alive) setState('notfound'); });
    return () => { alive = false; };
  }, [actorId]);

  if (state === 'loading') {
    return <div className="vitrine-wrap"><div className="vitrine-skeleton" /></div>;
  }

  if (state === 'notfound' || !profile) {
    return (
      <div className="vitrine-wrap">
        <div className="vitrine-empty">
          <h2>Perfil não disponível</h2>
          <p>Este perfil não está público na vitrine (ou foi despublicado).</p>
          <button className="vitrine-btn-secondary" onClick={() => navigate(-1)}>Voltar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="vitrine-wrap">
      <div className="vitrine-card">
        {/* capa */}
        <div
          className="vitrine-cover"
          style={profile.coverUrl ? { backgroundImage: `url(${profile.coverUrl})` } : undefined}
        />

        {/* cabeçalho: avatar + nome + ações */}
        <div className="vitrine-header">
          <div className="vitrine-avatar">
            {profile.avatarUrl
              ? <img src={profile.avatarUrl} alt={profile.displayName} />
              : <span className="vitrine-avatar-initials">{initials(profile.displayName)}</span>}
          </div>

          <div className="vitrine-identity">
            <h1 className="vitrine-name">{profile.displayName}</h1>
            {profile.headline && <p className="vitrine-headline">{profile.headline}</p>}
            <div className="vitrine-meta">
              <span className="vitrine-type">{TYPE_LABEL[profile.profileType]}</span>
              <span className="vitrine-dot">·</span>
              <span className="vitrine-badge">🌐 outra comunidade</span>
            </div>
          </div>

          <div className="vitrine-actions">
            <button className="vitrine-btn-primary" disabled title="Ação entre comunidades — em breve">
              Seguir <span className="vitrine-soon">em breve</span>
            </button>
            <button className="vitrine-btn-secondary" disabled title="Ação entre comunidades — em breve">
              Mensagem <span className="vitrine-soon">em breve</span>
            </button>
          </div>
        </div>

        {/* abas */}
        <nav className="vitrine-tabs">
          <button className={tab === 'sobre' ? 'active' : ''} onClick={() => setTab('sobre')}>Sobre</button>
          <button className={tab === 'publicacoes' ? 'active' : ''} onClick={() => setTab('publicacoes')}>Publicações</button>
          <button className={tab === 'fotos' ? 'active' : ''} onClick={() => setTab('fotos')}>Fotos</button>
        </nav>
      </div>

      {/* conteúdo da aba */}
      <div className="vitrine-content">
        {tab === 'sobre' && (
          <section className="vitrine-panel">
            <h2>Sobre</h2>
            {profile.bio
              ? <p className="vitrine-bio">{profile.bio}</p>
              : <p className="vitrine-bio vitrine-muted">Este perfil ainda não escreveu uma bio.</p>}
            {profile.link && (
              <p className="vitrine-link">
                🔗 <a href={profile.link} target="_blank" rel="noopener noreferrer nofollow">{profile.link.replace(/^https?:\/\//, '')}</a>
              </p>
            )}
            <p className="vitrine-note">
              🌐 Esta é a plaquinha pública de {profile.displayName} em outra comunidade do UnifiCard.
              Só o cartão público (nome, foto e bio) é visível — dados privados, dinheiro e agenda ficam
              protegidos na comunidade de origem.
            </p>
          </section>
        )}
        {tab === 'publicacoes' && (
          <section className="vitrine-panel vitrine-soon-panel">
            <p>As publicações desta comunidade aparecerão aqui em breve.</p>
          </section>
        )}
        {tab === 'fotos' && (
          <section className="vitrine-panel vitrine-soon-panel">
            <p>As fotos desta comunidade aparecerão aqui em breve.</p>
          </section>
        )}
      </div>
    </div>
  );
}
