// frontend/src/components/layout/RightContextRail.tsx
// Slot de conteúdo CONTEXTUAL (Clayton 2026-07-07). A SELEÇÃO do conteúdo é do BACKEND (por módulo +
// actor + modo + cidade) — este componente só PROJETA os items que recebe. NÃO decide qual banner,
// qual anunciante, qual cidade. Sem items (backend de monetização ainda não pronto): estado RESERVADO
// honesto, claramente rotulado — nunca inventa anunciante nem mostra banner fixo pra "parecer pronto".
import './RightContextRail.css';

export interface RailItem {
  id: string;
  title: string;
  body?: string;
  imageUrl?: string;   // vem do backend; nunca hardcoded aqui
  ctaLabel?: string;
  ctaHref?: string;
  sponsored?: boolean; // o backend marca; a UI só rotula
}

export default function RightContextRail({ module, items, loading }: {
  module: string;              // 'rentals' | 'services' | 'opportunities' — só p/ rótulo/telemetria
  items?: RailItem[];
  loading?: boolean;
}) {
  if (loading) {
    return <div className="rcr rcr--skeleton" aria-hidden="true"><span /><span /><span /></div>;
  }

  if (!items || items.length === 0) {
    // Estado RESERVADO honesto — o slot existe, o conteúdo virá do backend.
    return (
      <div className="rcr rcr--reserved" role="note" data-module={module}>
        <span className="rcr-eyebrow">Espaço contextual</span>
        <p className="rcr-reserved-text">
          Aqui aparece conteúdo da sua região, escolhido pelo backend conforme o módulo, o seu perfil
          e o modo (consumir/operar). Em preparação — nada é decidido pela tela.
        </p>
      </div>
    );
  }

  return (
    <div className="rcr" data-module={module}>
      {items.map((it) => (
        <article key={it.id} className="rcr-card">
          {it.sponsored && <span className="rcr-eyebrow">Patrocinado</span>}
          {it.imageUrl && <img className="rcr-img" src={it.imageUrl} alt="" loading="lazy" />}
          <h3 className="rcr-title">{it.title}</h3>
          {it.body && <p className="rcr-body">{it.body}</p>}
          {it.ctaLabel && it.ctaHref && (
            <a className="rcr-cta" href={it.ctaHref}>{it.ctaLabel}</a>
          )}
        </article>
      ))}
    </div>
  );
}
