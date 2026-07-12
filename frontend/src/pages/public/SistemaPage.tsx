// frontend/src/pages/public/SistemaPage.tsx
// Página pública "/o-que-da-pra-fazer" — o sistema conectado, em linguagem leiga.
// Direcionada ao sistema REAL: mostra o que já funciona hoje (selo "Disponível")
// e o que está sendo construído (selo "Em construção"), sem prometer o que não existe.
// Só experiência pública pré-login.

import PublicChrome, { Icon, type IconName } from './PublicChrome';

type Feature = { icon: IconName; titulo: string; texto: string; live: boolean };

// "live" = há superfície viva no app hoje (fonte: rotas e módulos do próprio sistema).
// "em construção" = existe no horizonte, mas ainda não está disponível — não prometer.
const FEATURES: Feature[] = [
  { icon: 'comprar', titulo: 'Comprar em um mercado local', texto: 'Navegar por categorias e lojas, montar carrinho e finalizar a compra — mais perto de você.', live: true },
  { icon: 'vender', titulo: 'Abrir sua loja e vender', texto: 'Criar uma loja, publicar produtos e receber pedidos, sem depender de tantos intermediários.', live: true },
  { icon: 'servicos', titulo: 'Contratar e prestar serviços', texto: 'Descobrir um profissional, reservar um horário, o prestador aceita e o pedido vira uma ordem acompanhada até o pagamento.', live: true },
  { icon: 'trabalhar', titulo: 'Publicar demanda e achar trabalho', texto: 'Quem precisa publica o que quer; quem faz responde. Um mercado de mão dupla entre quem oferece e quem procura.', live: true },
  { icon: 'alugar', titulo: 'Alugar e disponibilizar recursos', texto: 'Encontrar equipamentos e espaços para alugar — ou cadastrar os seus, com agenda e cobrança, para renderem em vez de ficarem parados.', live: true },
  { icon: 'balcao', titulo: 'Vender no balcão (PDV)', texto: 'Um ponto de venda para quem atende presencialmente: abre o caixa, vende por item ou por peso e fecha a conta.', live: true },
  { icon: 'carteira', titulo: 'Carteira e transferências', texto: 'Ver saldo e extrato, enviar valores para outras pessoas e fazer doações dentro da própria rede.', live: true },
  { icon: 'eventos', titulo: 'Organizar e participar de eventos', texto: 'Criar um evento, divulgar e cuidar da participação das pessoas em um mesmo lugar.', live: true },
  { icon: 'grupos', titulo: 'Grupos, comunidades e feed', texto: 'Reunir pessoas em grupos, acompanhar iniciativas e conversar — o tecido social que conecta tudo o mais.', live: true },
  { icon: 'empresa', titulo: 'Abrir e gerir uma empresa', texto: 'Registrar uma empresa e ganhar catálogo, estoque, serviços e agenda para operar dentro da rede.', live: true },
  { icon: 'dirigir', titulo: 'Mobilidade e entregas', texto: 'Transporte de pessoas e coisas, aproveitando o tempo e a capacidade de quem já está na rua. Está no horizonte, ainda em construção.', live: false },
  { icon: 'produzir', titulo: 'Novas verticais da região', texto: 'Comida, saúde, educação, agro e outros setores podem entrar aos poucos, conforme cada cidade estiver pronta.', live: false },
];

export default function SistemaPage() {
  return (
    <PublicChrome current="sistema">
      <section className="ucland-pagehero ucland-reveal">
        <p className="ucland-kicker">O que dá pra fazer</p>
        <h1 className="ucland-h2">Muitas atividades do dia a dia, na mesma rede.</h1>
        <p className="ucland-lead">
          A ideia não é ter mais um aplicativo para cada coisa. É aproximar boa parte do que
          você já faz em um só lugar — sem recriar a sua vida em cada plataforma. Veja o que já
          funciona hoje e o que está sendo construído.
        </p>
      </section>

      <section className="ucland-section ucland-reveal">
        <div className="ucland-grid-cards">
          {FEATURES.map((f) => (
            <article className="ucland-activity" key={f.titulo}>
              <span className="ucland-activity-icon"><Icon name={f.icon} /></span>
              <h3 className="ucland-activity-title">{f.titulo}</h3>
              <p className="ucland-activity-text">{f.texto}</p>
              <span className={`ucland-tag ${f.live ? 'ucland-tag-live' : 'ucland-tag-soon'}`}>
                {f.live ? 'Já funciona' : 'Em construção'}
              </span>
            </article>
          ))}
        </div>
        <p className="ucland-note">
          Os selos são honestos: o que está marcado como “já funciona” está disponível na rede;
          o que está “em construção” é intenção real, mas ainda não pronto — não prometemos o
          que não existe.
        </p>
      </section>

      {/* A ideia que conecta */}
      <section className="ucland-section ucland-idea ucland-reveal">
        <p className="ucland-kicker">O que conecta tudo</p>
        <h2 className="ucland-h2">Uma experiência integrada, sem começar do zero a cada vez.</h2>
        <p className="ucland-lead">
          A mesma pessoa pode ser cliente em um momento e prestadora em outro; pode ter uma
          loja, participar de um grupo e alugar um equipamento — sem virar vários cadastros
          soltos. Quando as atividades conversam entre si, aparecem oportunidades que, separadas,
          ninguém enxerga.
        </p>
        <p className="ucland-lead ucland-lead-soft">
          É essa proximidade entre as coisas — trabalho, comércio, serviços, recursos e
          comunidade — que faz o valor circular perto de quem participou.
        </p>
      </section>
    </PublicChrome>
  );
}
