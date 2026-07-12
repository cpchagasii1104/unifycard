// frontend/src/pages/public/ParaVocePage.tsx
// Página pública "/para-voce" — para quem é o UnifiCard.
// Mostra o que muda para cada público, sem parecer sistemas separados.
// Só experiência pública pré-login.

import PublicChrome, { Icon, type IconName } from './PublicChrome';

type Aud = { icon: IconName; nome: string; quer: string; texto: string };

const AUDIENCIAS: Aud[] = [
  {
    icon: 'pessoa', nome: 'Pessoa', quer: 'Comprar melhor e encontrar oportunidades',
    texto: 'Encontrar produtos, serviços e profissionais mais perto, participar de grupos e ver a sua vida econômica em um lugar só.',
  },
  {
    icon: 'servicos', nome: 'Profissional e trabalhador', quer: 'Clientes, renda e reconhecimento',
    texto: 'Mostrar o que você sabe fazer, organizar sua disponibilidade, receber pedidos e depender menos de plataformas caras.',
  },
  {
    icon: 'balcao', nome: 'Comércio e empresa', quer: 'Vender e reduzir custos',
    texto: 'Abrir loja, vender no balcão, achar fornecedores e clientes e gerir catálogo, estoque e agenda — fortalecendo a sua região.',
  },
  {
    icon: 'produzir', nome: 'Produtor e criador', quer: 'Chegar mais direto a quem compra',
    texto: 'Aproximar quem cria de quem consome, com menos etapas no caminho e uma fatia maior do valor que você produziu.',
  },
  {
    icon: 'grupos', nome: 'Comunidade e grupo', quer: 'Transformar atividade em capacidade local',
    texto: 'Reunir pessoas em torno de objetivos comuns e acompanhar o que a atividade da rede pode gerar para o território.',
  },
  {
    icon: 'comunidade', nome: 'Sua cidade', quer: 'Que o valor circule por perto',
    texto: 'Quando a atividade acontece dentro da rede, ela pode fortalecer negócios e oportunidades no próprio lugar onde as pessoas vivem.',
  },
];

export default function ParaVocePage() {
  return (
    <PublicChrome current="para-voce">
      <section className="ucland-pagehero ucland-reveal">
        <p className="ucland-kicker">Para você</p>
        <h1 className="ucland-h2">Uma rede para quem faz a economia acontecer.</h1>
        <p className="ucland-lead">
          A pessoa comum, o profissional, o comércio, o produtor e a comunidade fazem parte da
          mesma rede — não de sistemas separados. Veja o que pode mudar para cada um.
        </p>
      </section>

      <section className="ucland-section ucland-reveal">
        <div className="ucland-grid-cards">
          {AUDIENCIAS.map((a) => (
            <article className="ucland-audience" key={a.nome}>
              <div className="ucland-audience-head">
                <span className="ucland-audience-icon"><Icon name={a.icon} /></span>
                <div>
                  <p className="ucland-audience-name">{a.nome}</p>
                  <p className="ucland-audience-want">{a.quer}</p>
                </div>
              </div>
              <p className="ucland-audience-text">{a.texto}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="ucland-section ucland-band ucland-reveal">
        <p className="ucland-kicker">A mesma rede</p>
        <h2 className="ucland-h2">A mesma pessoa pode ser cliente e prestadora — sem virar dois cadastros.</h2>
        <p className="ucland-lead">
          Você não precisa escolher um único papel. Em um momento você contrata; em outro, você
          atende. Hoje você compra; amanhã você vende ou aluga algo seu. É a mesma identidade
          ganhando novas formas de participar, conforme a sua vida pede.
        </p>
        <p className="ucland-lead ucland-lead-soft">
          É isso que faz a rede ser útil para todo mundo ao mesmo tempo: quanto mais gente
          participa, de quantas formas participa, mais oportunidades aparecem para cada um.
        </p>
      </section>
    </PublicChrome>
  );
}
