// frontend/src/pages/public/ParticiparPage.tsx
// Página pública "/participar" — o funil de conversão, depois da compreensão.
// "Criar conta" e "Entrar" apontam para os fluxos existentes (/register, /login).
// Sem formulário novo, sem lista de espera falsa. Só experiência pública pré-login.

import { useNavigate } from 'react-router-dom';
import PublicChrome, { Icon } from './PublicChrome';

export default function ParticiparPage() {
  const navigate = useNavigate();

  return (
    <PublicChrome showCta={false}>
      <section className="ucland-pagehero ucland-reveal">
        <p className="ucland-kicker">Faça parte</p>
        <h1 className="ucland-h2">Uma nova rede começa quando as pessoas decidem participar.</h1>
        <p className="ucland-lead">
          O UnifiCard está sendo construído para pessoas, profissionais, empresas e
          comunidades. Você pode conhecer, acompanhar e fazer parte dessa construção — desde o
          começo, perto de onde você vive.
        </p>
      </section>

      {/* Recapitulação honesta */}
      <section className="ucland-section ucland-reveal">
        <div className="ucland-grid-cards ucland-grid-4">
          <article className="ucland-activity">
            <span className="ucland-activity-icon"><Icon name="check" /></span>
            <h3 className="ucland-activity-title">O que já dá pra fazer</h3>
            <p className="ucland-activity-text">Comprar e vender, contratar e prestar serviços, alugar recursos, carteira, eventos, grupos e mais.</p>
          </article>
          <article className="ucland-activity">
            <span className="ucland-activity-icon"><Icon name="construir" /></span>
            <h3 className="ucland-activity-title">O que está vindo</h3>
            <p className="ucland-activity-text">Mais verticais, votação nos grupos, transparência com números e o fundo mais perto, no bairro.</p>
          </article>
          <article className="ucland-activity">
            <span className="ucland-activity-icon"><Icon name="regiao" /></span>
            <h3 className="ucland-activity-title">Por que vale a pena</h3>
            <p className="ucland-activity-text">Quanto mais gente participa, mais oportunidades para cada um — e mais força para a sua região.</p>
          </article>
          <article className="ucland-activity">
            <span className="ucland-activity-icon"><Icon name="acompanhar" /></span>
            <h3 className="ucland-activity-title">Com transparência</h3>
            <p className="ucland-activity-text">Sem prometer o que não existe. Você acompanha a construção e participa dela.</p>
          </article>
        </div>
      </section>

      {/* CTA final */}
      <section className="ucland-final ucland-reveal">
        <h2 className="ucland-final-title">Pronto para fazer parte?</h2>
        <p className="ucland-final-sub">
          Crie a sua conta para entrar na rede, ou volte a explorar a proposta com calma. Sem
          pressa — o importante é que faça sentido para a sua vida.
        </p>
        <div className="ucland-cta-row ucland-cta-center">
          <button className="ucland-btn ucland-btn-primary ucland-btn-lg" onClick={() => navigate('/register')}>
            Criar conta
          </button>
          <button className="ucland-btn ucland-btn-soft ucland-btn-lg" onClick={() => navigate('/')}>
            Voltar ao início
          </button>
        </div>
        <p className="ucland-note ucland-note-center">
          Já tem conta? <button className="ucland-navlink" style={{ padding: '0 0.2rem' }} onClick={() => navigate('/login')}>Entrar</button>
        </p>
      </section>
    </PublicChrome>
  );
}
