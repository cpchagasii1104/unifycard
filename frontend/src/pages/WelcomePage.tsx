// frontend/src/pages/WelcomePage.tsx
// Home pública do UnifiCard (rota `/`, antes do login).
//
// Missão: fazer qualquer pessoa entender, em linguagem leiga, que está surgindo
// uma nova forma de organizar a vida econômica e social — e convidá-la a navegar
// pelo site (páginas públicas) antes de criar conta. Jornada:
//   "Isso pode me ajudar." → "Isso pode ajudar minha cidade." →
//   "Isso pode mudar a forma como a sociedade se organiza."
//
// Linguagem leiga, porém DIRECIONADA ao sistema real e ao que será possível fazer.
// Honestidade de estágio: o que já funciona x o que está sendo construído.
//
// ESCOPO: só experiência pública pré-login. "Entrar"/"Criar conta" apontam para
// os fluxos existentes. Nada depois do login é alterado.

import { useNavigate } from 'react-router-dom';
import PublicChrome, { Icon, type IconName } from './public/PublicChrome';

const ATIVIDADES: { icon: IconName; titulo: string; texto: string }[] = [
  { icon: 'comprar', titulo: 'Comprar e vender', texto: 'Uma loja e um mercado para encontrar produtos, serviços e pessoas mais perto de você.' },
  { icon: 'servicos', titulo: 'Contratar e prestar serviços', texto: 'Descobrir um profissional, reservar um horário e acompanhar do pedido ao pagamento.' },
  { icon: 'trabalhar', titulo: 'Achar trabalho e clientes', texto: 'Publicar o que você precisa — ou responder a quem precisa do que você faz.' },
  { icon: 'alugar', titulo: 'Alugar e disponibilizar', texto: 'Equipamentos, espaços e recursos com agenda e cobrança, para render em vez de parar.' },
  { icon: 'carteira', titulo: 'Carteira e transferências', texto: 'Saldo, extrato e envio de valores entre pessoas, dentro da própria rede.' },
  { icon: 'grupos', titulo: 'Grupos e comunidades', texto: 'Reunir pessoas, acompanhar iniciativas e fortalecer o que importa para a sua região.' },
];

const CICLO: string[] = [
  'Você participa.',
  'Uma atividade acontece.',
  'Outra pessoa encontra uma oportunidade.',
  'Mais valor circula perto de você.',
  'A rede fica mais útil.',
  'Novas pessoas participam.',
];

export default function WelcomePage() {
  const navigate = useNavigate();

  return (
    <PublicChrome current="home">
      {/* ============ HERO ============ */}
      <section className="ucland-hero ucland-hero-centered">
        <p className="ucland-eyebrow">Está surgindo algo novo</p>
        <h1 className="ucland-hero-title">
          Uma nova forma de comprar, vender, trabalhar — e fazer o valor voltar para o
          lugar onde você vive.
        </h1>
        <p className="ucland-hero-sub">
          O UnifiCard está sendo construído para conectar pessoas, negócios, trabalho,
          serviços e comunidades em uma rede onde a participação de cada pessoa pode gerar
          mais oportunidades para todos — e mais força para a sua região.
        </p>
        <div className="ucland-cta-row ucland-cta-center">
          <button className="ucland-btn ucland-btn-primary ucland-btn-lg" onClick={() => navigate('/o-que-da-pra-fazer')}>
            Ver o que dá pra fazer
          </button>
          <button className="ucland-btn ucland-btn-soft ucland-btn-lg" onClick={() => navigate('/proposta')}>
            Entenda a proposta
          </button>
        </div>
      </section>

      {/* ============ A GRANDE IDEIA ============ */}
      <section className="ucland-section ucland-reveal">
        <div className="ucland-idea">
          <p className="ucland-kicker">A ideia em uma frase</p>
          <h2 className="ucland-h2">Fazer mais do valor que você gera ficar com você e com a sua região.</h2>
          <p className="ucland-lead">
            Hoje, quando você compra, trabalha ou vende, boa parte do valor acaba indo para
            intermediários distantes. O UnifiCard está sendo construído para aproximar essas
            atividades em uma única rede — para que mais desse valor fique com quem participa
            e circule de volta onde ele foi criado.
          </p>
          <p className="ucland-lead ucland-lead-soft">
            Você continua dono do seu trabalho, da sua empresa, dos seus bens e das suas
            escolhas. A proposta é dar às pessoas uma ferramenta melhor para se encontrar,
            negociar, trabalhar e colaborar.
          </p>
        </div>
      </section>

      {/* ============ O QUE DÁ PRA FAZER ============ */}
      <section className="ucland-section ucland-reveal">
        <p className="ucland-kicker">Na prática</p>
        <h2 className="ucland-h2">Muitas atividades do dia a dia, na mesma rede.</h2>
        <p className="ucland-lead">
          Não é preciso recriar a sua vida em cada aplicativo. Aqui, boa parte do que você já
          faz pode acontecer no mesmo lugar — e parte disso já funciona hoje.
        </p>
        <div className="ucland-grid-cards">
          {ATIVIDADES.map((a) => (
            <article className="ucland-activity" key={a.titulo}>
              <span className="ucland-activity-icon"><Icon name={a.icon} /></span>
              <h3 className="ucland-activity-title">{a.titulo}</h3>
              <p className="ucland-activity-text">{a.texto}</p>
            </article>
          ))}
        </div>
        <div className="ucland-cta-row ucland-mt">
          <button className="ucland-btn ucland-btn-soft" onClick={() => navigate('/o-que-da-pra-fazer')}>
            Ver tudo o que dá pra fazer
          </button>
        </div>
      </section>

      {/* ============ A PARTICIPAÇÃO MOVE A REDE ============ */}
      <section className="ucland-section ucland-band ucland-reveal">
        <p className="ucland-kicker">Como a rede cresce</p>
        <h2 className="ucland-h2">A rede fica mais forte quando as pessoas participam.</h2>
        <p className="ucland-lead">
          Uma pessoa cadastrada, mas sem realizar nenhuma atividade, não movimenta a rede.
          Mas quando alguém compra, vende, trabalha, presta um serviço, aluga ou produz,
          novas conexões começam a surgir — e a rede passa a ser mais útil para todo mundo.
        </p>
        <ol className="ucland-cycle-steps">
          {CICLO.map((c, i) => (
            <li key={c}>
              <span className="ucland-cycle-num">{i + 1}</span>
              <span className="ucland-cycle-text">{c}</span>
            </li>
          ))}
        </ol>
        <p className="ucland-note ucland-note-strong">
          O crescimento não depende apenas de cadastros. Depende do que as pessoas conseguem
          realizar juntas.
        </p>
      </section>

      {/* ============ APROFUNDE (navegação) ============ */}
      <section className="ucland-section ucland-reveal">
        <p className="ucland-kicker">Conheça a fundo</p>
        <h2 className="ucland-h2">Antes de criar conta, você pode entender a proposta inteira.</h2>
        <div className="ucland-navcards">
          <button className="ucland-navcard" onClick={() => navigate('/proposta')}>
            <h3 className="ucland-navcard-title">A proposta</h3>
            <p className="ucland-navcard-text">Que problema o UnifiCard enfrenta e por que ele é diferente de mais uma plataforma.</p>
            <span className="ucland-navcard-more">Entenda a proposta →</span>
          </button>
          <button className="ucland-navcard" onClick={() => navigate('/o-que-da-pra-fazer')}>
            <h3 className="ucland-navcard-title">O que dá pra fazer</h3>
            <p className="ucland-navcard-text">As atividades que já funcionam hoje e as que estão sendo construídas.</p>
            <span className="ucland-navcard-more">Ver na prática →</span>
          </button>
          <button className="ucland-navcard" onClick={() => navigate('/para-voce')}>
            <h3 className="ucland-navcard-title">Para você</h3>
            <p className="ucland-navcard-text">O que muda para a pessoa, o profissional, o comércio, o produtor e a comunidade.</p>
            <span className="ucland-navcard-more">Ver para quem é →</span>
          </button>
          <button className="ucland-navcard" onClick={() => navigate('/autogestao')}>
            <h3 className="ucland-navcard-title">Autogestão e região</h3>
            <p className="ucland-navcard-text">Como o valor pode circular perto, fortalecer a sua região e ser acompanhado pelas pessoas.</p>
            <span className="ucland-navcard-more">Ver como o valor circula →</span>
          </button>
        </div>
      </section>

      {/* ============ TRANSPARÊNCIA DE ESTÁGIO ============ */}
      <section className="ucland-section ucland-stage ucland-reveal">
        <p className="ucland-kicker">Onde estamos</p>
        <h2 className="ucland-h2">Está começando. E você pode acompanhar desde o início.</h2>
        <p className="ucland-lead">
          O UnifiCard está em desenvolvimento. Parte das atividades já funciona; outras estão
          sendo construídas, testadas e preparadas passo a passo. Preferimos crescer perto das
          pessoas, cidade por cidade, a prometer o que ainda não existe.
        </p>
        <p className="ucland-lead ucland-lead-soft">
          Não queremos apenas apresentar um produto pronto. Queremos reunir pessoas que
          acreditam que a economia pode funcionar de uma forma mais próxima, participativa e
          duradoura.
        </p>
      </section>
    </PublicChrome>
  );
}
