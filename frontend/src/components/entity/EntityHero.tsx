// frontend/src/components/entity/EntityHero.tsx
// Primitivo "lego" universal — cabeçalho de entidade (2026-05-15).
// Pedido Clayton: "primeiro o lego, depois esculpe". Estrutura padrão para
// perfil/empresa/grupo/canal/evento/página: capa + avatar + nome + descrição +
// badge + stats + trust + ações.
//
// Usado por:
//   - ProfilePage (usuário)
//   - CompanyPage (empresa)
//   - GrupoDetailPage (grupo) — quando refatorada
//   - EventDetailPage (evento) — quando refatorada
//   - VenuePublicPage (venue) — quando refatorada
//
// Substitui código duplicado entre ProfilePage e CompanyPage (~95% paralelo
// antes do refactor).

import './EntityHero.css';

export interface EntityHeroStat {
  label: string;
  value: number | string;
}

export interface EntityHeroAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export interface EntityHeroProps {
  /** URL da imagem de capa. Se ausente, mostra placeholder. */
  coverUrl?: string | null;
  /** Texto do placeholder quando capa ausente. */
  coverPlaceholder?: string;
  /** URL do avatar/logo/foto principal. Se ausente, usa initialLetter. */
  avatarUrl?: string | null;
  /** Letra(s) usada(s) como fallback no avatar quando avatarUrl ausente. */
  avatarFallback?: string;
  /** Nome (ou razão social, título do evento, etc.). */
  displayName: string;
  /** Descrição/bio/sobre. */
  bio?: string | null;
  /** Badge opcional (ex: "Ativo na comunidade"). */
  badge?: {
    text: string;
    variant?: 'active' | 'verified' | 'new';
  };
  /** Estatísticas resumidas (até 4). */
  stats?: EntityHeroStat[];
  /** Texto curto de confiança/reputação (ex: "Membro ativo"). */
  trustText?: string | null;
  /** Ações primária e secundárias (até 3 botões). */
  actions?: EntityHeroAction[];
  /** Botão "voltar" — função; se omitido, botão não aparece. */
  onBack?: () => void;
  /** Variante visual — tonalidade de placeholders. */
  variant?: 'profile' | 'company' | 'group' | 'event' | 'channel' | 'page';
}

const VARIANT_PLACEHOLDERS: Record<NonNullable<EntityHeroProps['variant']>, string> = {
  profile: 'Capa',
  company: 'Capa da Empresa',
  group: 'Capa do Grupo',
  event: 'Capa do Evento',
  channel: 'Capa do Canal',
  page: 'Capa da Página',
};

export default function EntityHero({
  coverUrl,
  coverPlaceholder,
  avatarUrl,
  avatarFallback,
  displayName,
  bio,
  badge,
  stats = [],
  trustText,
  actions = [],
  onBack,
  variant = 'profile',
}: EntityHeroProps) {
  const placeholderText = coverPlaceholder ?? VARIANT_PLACEHOLDERS[variant];
  const fallbackLetter = (avatarFallback ?? displayName?.[0] ?? '?').toUpperCase();

  return (
    <div className={`eh-root eh-variant-${variant}`}>
      {onBack && (
        <div className="eh-back">
          <button onClick={onBack} className="eh-back-button" type="button">
            ← Voltar
          </button>
        </div>
      )}

      <div className="eh-cover">
        {coverUrl ? (
          <img src={coverUrl} alt="Capa" />
        ) : (
          <div className="eh-cover-placeholder">{placeholderText}</div>
        )}
      </div>

      <div className="eh-header">
        <div className="eh-avatar-section">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="eh-avatar" />
          ) : (
            <div className="eh-avatar-placeholder" aria-hidden="true">
              {fallbackLetter}
            </div>
          )}
        </div>

        <div className="eh-info">
          <div className="eh-name-row">
            <h1 className="eh-name">{displayName}</h1>
            {badge && (
              <span className={`eh-badge eh-badge--${badge.variant ?? 'active'}`}>
                {badge.text}
              </span>
            )}
          </div>

          {bio && <p className="eh-bio">{bio}</p>}

          {stats.length > 0 && (
            <div className="eh-stats">
              {stats.map((s, i) => (
                <span key={i} className="eh-stat">
                  <strong>{s.value}</strong> {s.label}
                </span>
              ))}
            </div>
          )}

          {trustText && <p className="eh-trust">{trustText}</p>}

          {actions.length > 0 && (
            <div className="eh-actions">
              {actions.map((a, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={a.onClick}
                  disabled={a.disabled}
                  className={`eh-action eh-action--${a.variant ?? 'primary'}`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
