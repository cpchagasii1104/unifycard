// frontend/src/pages/WelcomePage.tsx
// 2026-05-19 — Start inicial público (antes de login/registro).
//
// Tese: UnifiCard não é "super app". É infraestrutura de coordenação
// econômica e social orientada por actor. Esta página comunica isso
// honestamente antes de pedir uma conta.
//
// Princípios materializados:
//   - Actor-first / capability-additive (uma identidade ganha modos)
//   - Lego primeiro (núcleo único + módulos orbitando)
//   - Cooperativismo de participação / zero=zero
//   - Agenda universal como percepção temporal compartilhada
//   - Honestidade sobre o estado material (não prometer o que não existe)

import { useNavigate } from 'react-router-dom';
import './WelcomePage.css';

export default function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div className="welcome-root">
      <header className="welcome-header">
        <div className="welcome-brand">
          <div className="welcome-logo" aria-hidden="true">
            <span className="welcome-logo-core" />
            <span className="welcome-logo-ring welcome-logo-ring-1" />
            <span className="welcome-logo-ring welcome-logo-ring-2" />
          </div>
          <span className="welcome-brandname">UnifiCard</span>
        </div>
        <nav className="welcome-nav">
          <button
            type="button"
            className="welcome-btn welcome-btn-ghost"
            onClick={() => navigate('/login')}
          >
            Entrar
          </button>
          <button
            type="button"
            className="welcome-btn welcome-btn-primary"
            onClick={() => navigate('/register')}
          >
            Criar conta
          </button>
        </nav>
      </header>

      <main className="welcome-main">
        <section className="welcome-hero">
          <p className="welcome-eyebrow">Infraestrutura, não vitrine</p>
          <h1 className="welcome-title">
            Uma base única para a sua vida<br />econômica e social.
          </h1>
          <p className="welcome-subtitle">
            Não é app de finança. Não é rede social. É a camada que
            conecta as duas — pelo lado da pessoa, não da plataforma.
          </p>
          <div className="welcome-cta-row">
            <button
              type="button"
              className="welcome-btn welcome-btn-primary welcome-btn-lg"
              onClick={() => navigate('/register')}
            >
              Começar
            </button>
            <button
              type="button"
              className="welcome-btn welcome-btn-ghost welcome-btn-lg"
              onClick={() => navigate('/login')}
            >
              Já tenho conta
            </button>
          </div>
        </section>

        <section className="welcome-principles">
          <article className="welcome-card">
            <div className="welcome-card-icon" aria-hidden="true">◯</div>
            <h2 className="welcome-card-title">Núcleo único, modos contextuais</h2>
            <p className="welcome-card-body">
              Uma identidade. Vários jeitos de operar — pessoa, profissional,
              empresa, banda, coletivo. Sem trocar de conta. Sem fragmentar
              quem você é.
            </p>
          </article>

          <article className="welcome-card">
            <div className="welcome-card-icon" aria-hidden="true">◷</div>
            <h2 className="welcome-card-title">Agenda como linguagem comum</h2>
            <p className="welcome-card-body">
              O tempo da sua vida pessoal e do seu trabalho falando o mesmo
              idioma. Coordenação real entre pessoas, serviços e recursos.
            </p>
          </article>

          <article className="welcome-card">
            <div className="welcome-card-icon" aria-hidden="true">⇄</div>
            <h2 className="welcome-card-title">Cooperativismo de participação</h2>
            <p className="welcome-card-body">
              Quem usa participa do resultado. Zero a zero — sem taxa escondida,
              sem extração silenciosa, sem economia de atenção.
            </p>
          </article>
        </section>

        <section className="welcome-how">
          <h2 className="welcome-section-title">Como funciona</h2>
          <ol className="welcome-steps">
            <li>
              <span className="welcome-step-num">1</span>
              <div>
                <h3>Você cria sua identidade pessoal.</h3>
                <p>Uma conta. Sua. Soberana. Sem distinção de "tipo" no começo.</p>
              </div>
            </li>
            <li>
              <span className="welcome-step-num">2</span>
              <div>
                <h3>Conforme precisar, adiciona modos.</h3>
                <p>
                  Empresa, banda, comunidade, prestador de serviço, organizador
                  de eventos. Cada modo desbloqueia recursos próprios sem desfazer
                  o que veio antes.
                </p>
              </div>
            </li>
            <li>
              <span className="welcome-step-num">3</span>
              <div>
                <h3>O sistema se adapta ao contexto.</h3>
                <p>
                  Atuando como você, sua empresa ou seu coletivo, o ambiente
                  prioriza o que faz sentido naquele momento — sem isolar o
                  resto da sua vida.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section className="welcome-honesty">
          <h2 className="welcome-section-title">Em construção, com método.</h2>
          <p>
            Este sistema está sendo construído em camadas. Não promete o que
            ainda não existe materialmente. Cada parte que você encontra aqui
            foi pensada para encaixar nas outras — núcleo único, módulos
            orbitando.
          </p>
        </section>

        <section className="welcome-cta-final">
          <h2>Pronto para começar?</h2>
          <div className="welcome-cta-row">
            <button
              type="button"
              className="welcome-btn welcome-btn-primary welcome-btn-lg"
              onClick={() => navigate('/register')}
            >
              Criar conta
            </button>
            <button
              type="button"
              className="welcome-btn welcome-btn-ghost welcome-btn-lg"
              onClick={() => navigate('/login')}
            >
              Entrar
            </button>
          </div>
        </section>
      </main>

      <footer className="welcome-footer">
        <span>UnifiCard · ambiente de desenvolvimento</span>
        <span>2026</span>
      </footer>
    </div>
  );
}
