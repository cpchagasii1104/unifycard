// frontend/src/pages/public/PublicChrome.tsx
// Casca compartilhada do site público pré-login do UnifiCard:
// cabeçalho + navegação entre páginas + rodapé + faixa de CTA + ícones.
//
// ESCOPO: só experiência pública (antes do login). "Entrar" → /login e
// "Criar conta" → /register (fluxos existentes, destinos inalterados).
// Classes com prefixo isolado `ucland-` (não vaza estilo para pós-login).

import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import './public-site.css';

/* ---------- helpers ---------- */

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && !!window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ---------- ícones (SVG inline, traço = currentColor) ---------- */

export type IconName =
  | 'comprar' | 'vender' | 'servicos' | 'trabalhar' | 'produzir' | 'dirigir'
  | 'alugar' | 'carteira' | 'balcao' | 'eventos' | 'grupos' | 'empresa'
  | 'buscar' | 'comunidade' | 'acompanhar' | 'participar' | 'construir'
  | 'pessoa' | 'regiao' | 'planeta' | 'check' | 'seta';

export function Icon({ name, size = 26 }: { name: IconName; size?: number }) {
  const c = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.7,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
  };
  switch (name) {
    case 'comprar': return (<svg {...c}><path d="M6 8h12l-1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>);
    case 'vender': return (<svg {...c}><path d="M20 12.5 12.5 20a2 2 0 0 1-2.8 0l-5.7-5.7a2 2 0 0 1 0-2.8L11.5 4 20 4v8.5Z" /><circle cx="15.5" cy="8.5" r="1.3" /></svg>);
    case 'servicos': return (<svg {...c}><path d="M14.5 5.5a3.5 3.5 0 0 0-4.8 4.6L4 15.8V20h4.2l5.7-5.7a3.5 3.5 0 0 0 4.6-4.8l-2.3 2.3-2.5-.5-.5-2.5 2.3-2.3Z" /></svg>);
    case 'trabalhar': return (<svg {...c}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M3 12h18" /></svg>);
    case 'produzir': return (<svg {...c}><path d="M12 21c0-4 0-6-2-8s-5-2-5-2 0 3 2 5 5 2 5 2Z" /><path d="M12 21c0-5 .5-8 3.5-10.5C18 8.5 19 6 19 6s-3 0-5.5 2.5C11 11 11 15 12 21Z" /><path d="M12 21v-3" /></svg>);
    case 'dirigir': return (<svg {...c}><path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13" /><path d="M4 13h16v4a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H7v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4Z" /><path d="M7 16h.01M17 16h.01" /></svg>);
    case 'alugar': return (<svg {...c}><circle cx="8" cy="14" r="3.2" /><path d="M10.2 11.8 20 2m-3 0h3v3" /><path d="M15.5 6.5 18 9" /></svg>);
    case 'carteira': return (<svg {...c}><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18" /><circle cx="16.5" cy="14" r="1.2" /></svg>);
    case 'balcao': return (<svg {...c}><path d="M4 9h16l-1-4H5L4 9Z" /><path d="M5 9v10h14V9" /><path d="M9 19v-4h6v4" /></svg>);
    case 'eventos': return (<svg {...c}><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 9h18M8 3v4M16 3v4" /><path d="M8 13h3M8 16.5h5" /></svg>);
    case 'grupos': return (<svg {...c}><circle cx="9" cy="9" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 8.5a3 3 0 0 1 0 5.4" /><path d="M17.5 19a5.5 5.5 0 0 0-2.3-4.5" /></svg>);
    case 'empresa': return (<svg {...c}><path d="M4 20V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14" /><path d="M14 10h4a2 2 0 0 1 2 2v8" /><path d="M3 20h18" /><path d="M7 8h3M7 12h3M7 16h3" /></svg>);
    case 'buscar': return (<svg {...c}><circle cx="11" cy="11" r="6.2" /><path d="m20 20-3.4-3.4" /></svg>);
    case 'comunidade': return (<svg {...c}><path d="M12 20s-6.5-4.4-8.6-8.2A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.6 4.8C18.5 15.6 12 20 12 20Z" /></svg>);
    case 'acompanhar': return (<svg {...c}><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="2.7" /></svg>);
    case 'participar': return (<svg {...c}><path d="M20 14.5a2 2 0 0 1-2 2H8l-4 3.2V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8.5Z" /><path d="M8.5 10h7M8.5 13h4" /></svg>);
    case 'construir': return (<svg {...c}><path d="M12 3 3 7.7l9 4.7 9-4.7L12 3Z" /><path d="m3 12.3 9 4.7 9-4.7" /><path d="m3 16.8 9 4.7 9-4.7" /></svg>);
    case 'pessoa': return (<svg {...c}><circle cx="12" cy="8" r="3.4" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>);
    case 'regiao': return (<svg {...c}><path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10Z" /><circle cx="12" cy="11" r="2.3" /></svg>);
    case 'planeta': return (<svg {...c}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" /></svg>);
    case 'check': return (<svg {...c}><path d="m5 12 4.5 4.5L19 7" /></svg>);
    case 'seta': return (<svg {...c}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
  }
}

/* ---------- navegação entre páginas ---------- */

const PAGES: { key: string; label: string; path: string }[] = [
  { key: 'proposta', label: 'A proposta', path: '/proposta' },
  { key: 'sistema', label: 'O que dá pra fazer', path: '/o-que-da-pra-fazer' },
  { key: 'para-voce', label: 'Para você', path: '/para-voce' },
  { key: 'autogestao', label: 'Autogestão', path: '/autogestao' },
];

/* ---------- hook: revelação suave ao rolar + scroll ao topo ---------- */

function useChromeEffects(rootRef: React.RefObject<HTMLDivElement>) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion() || !rootRef.current) return;
    const root = rootRef.current;
    root.classList.add('ucland--motion');
    const targets = Array.from(root.querySelectorAll<HTMLElement>('.ucland-reveal'));
    if (!('IntersectionObserver' in window)) { targets.forEach((t) => t.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [rootRef]);

  return scrolled;
}

/* ---------- componente ---------- */

export default function PublicChrome({
  current, showCta = true, children,
}: {
  current?: string;
  showCta?: boolean;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const scrolled = useChromeEffects(rootRef);

  const go = (path: string) => { setMenuOpen(false); navigate(path); };

  return (
    <div className="ucland-root" ref={rootRef}>
      <header className={`ucland-header ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="ucland-header-inner">
          <button className="ucland-brand" onClick={() => go('/')} aria-label="UnifiCard — início">
            <span className="ucland-logo" aria-hidden="true">
              <span className="ucland-logo-core" />
              <span className="ucland-logo-ring ucland-logo-ring-1" />
              <span className="ucland-logo-ring ucland-logo-ring-2" />
            </span>
            <span className="ucland-brandname">UnifiCard</span>
          </button>

          <nav className="ucland-nav-desktop" aria-label="Seções do site">
            {PAGES.map((p) => (
              <button
                key={p.key}
                className={`ucland-navlink ${current === p.key ? 'is-active' : ''}`}
                onClick={() => go(p.path)}
              >
                {p.label}
              </button>
            ))}
          </nav>

          <div className="ucland-header-actions">
            <button className="ucland-btn ucland-btn-ghost ucland-hide-sm" onClick={() => go('/login')}>Entrar</button>
            <button className="ucland-btn ucland-btn-primary" onClick={() => go('/register')}>Criar conta</button>
            <button
              className="ucland-menu-toggle"
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span /><span /><span />
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="ucland-nav-mobile" aria-label="Seções do site">
            {PAGES.map((p) => (
              <button
                key={p.key}
                className={`ucland-navlink-mobile ${current === p.key ? 'is-active' : ''}`}
                onClick={() => go(p.path)}
              >
                {p.label}
              </button>
            ))}
            <button className="ucland-navlink-mobile" onClick={() => go('/participar')}>Faça parte</button>
            <button className="ucland-navlink-mobile" onClick={() => go('/login')}>Entrar</button>
          </nav>
        )}
      </header>

      <main className="ucland-main">{children}</main>

      {showCta && (
        <section className="ucland-ctaband">
          <div className="ucland-ctaband-inner ucland-reveal">
            <h2>Uma nova rede começa quando as pessoas decidem participar.</h2>
            <p>
              O UnifiCard está sendo construído com as pessoas. Você pode conhecer, acompanhar
              e fazer parte dessa construção desde o início.
            </p>
            <div className="ucland-cta-row ucland-cta-center">
              <button className="ucland-btn ucland-btn-primary ucland-btn-lg" onClick={() => go('/participar')}>
                Quero fazer parte
              </button>
              <button className="ucland-btn ucland-btn-soft ucland-btn-lg" onClick={() => go('/o-que-da-pra-fazer')}>
                Ver o que dá pra fazer
              </button>
            </div>
          </div>
        </section>
      )}

      <footer className="ucland-footer">
        <div className="ucland-footer-inner">
          <button className="ucland-brand ucland-brand-footer" onClick={() => go('/')}>
            <span className="ucland-logo" aria-hidden="true">
              <span className="ucland-logo-core" />
              <span className="ucland-logo-ring ucland-logo-ring-1" />
              <span className="ucland-logo-ring ucland-logo-ring-2" />
            </span>
            <span className="ucland-brandname">UnifiCard</span>
          </button>
          <p className="ucland-footer-note">
            Uma rede construída com as pessoas. Nasce perto de você, cresce com os resultados.
          </p>
          <div className="ucland-footer-actions">
            <button className="ucland-btn ucland-btn-ghost" onClick={() => go('/login')}>Entrar</button>
            <button className="ucland-btn ucland-btn-primary" onClick={() => go('/register')}>Criar conta</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export { Fragment };
