// frontend/src/pages/public/PropostaPage.tsx
// Página pública "/proposta" — a visão em linguagem leiga.
// Que problema o UnifiCard enfrenta, o que ele propõe e por que é diferente.
// Só experiência pública pré-login.

import PublicChrome from './PublicChrome';

export default function PropostaPage() {
  return (
    <PublicChrome current="proposta">
      <section className="ucland-pagehero ucland-reveal">
        <p className="ucland-kicker">Objetivo</p>
        <h1 className="ucland-h2">Fazer o valor voltar para as pessoas e região dos usuários.</h1>
        <p className="ucland-lead">
          Com a tecnologia de hoje, não faz mais sentido quem trabalha, compra e vende continuar
          enriquecendo bilionários que nem conhece — só porque, até agora, eles controlavam o
          caminho entre as pontas. Isso pode mudar: se a sociedade se organizar, dá para
          prosperar junto, sem depender deles.
        </p>
        <p className="ucland-lead ucland-lead-soft">
          O UnifiCard nasce dessa ideia: organizar a vida econômica e social de um jeito em que
          quem participa ganha mais — e o valor gerado fica mais perto de quem o criou.
        </p>
      </section>

      {/* O problema */}
      <section className="ucland-section ucland-reveal">
        <p className="ucland-kicker">O problema</p>
        <h2 className="ucland-h2">Você gera valor todos os dias. Boa parte dele vai embora.</h2>
        <p className="ucland-lead">
          Todos os dias, pessoas e pequenos negócios movimentam a economia: compram, vendem,
          trabalham, produzem, transportam, prestam serviços. Mas grande parte das
          oportunidades, das conexões e do valor gerado acaba capturada por intermediários
          distantes — que controlam quem encontra quem, quem aparece, quanto se paga e para
          onde o dinheiro vai.
        </p>
        <p className="ucland-lead ucland-lead-soft">
          O alvo não é quem faz trabalho de verdade. Comerciantes, profissionais, entregadores,
          produtores e prestadores de serviço são essenciais — eles criam valor. O que o
          UnifiCard quer reduzir é a intermediação que cobra caro só por controlar o caminho
          obrigatório entre as pessoas.
        </p>
      </section>

      {/* A virada */}
      <section className="ucland-section ucland-idea ucland-reveal">
        <p className="ucland-kicker">A virada</p>
        <h2 className="ucland-h2">E se essa infraestrutura fosse das próprias pessoas?</h2>
        <p className="ucland-lead">
          Em vez de apenas viver dentro de sistemas criados por outros, a sociedade passa a
          ter uma ferramenta para se organizar com menos dependência de quem só captura valor.
          Uma rede onde pessoas, profissionais, empresas, produtores e comunidades podem
          encontrar umas às outras, realizar atividades e criar oportunidades.
        </p>
        <p className="ucland-lead ucland-lead-soft">
          Uma lógica parecida com a do cooperativismo — quem participa se beneficia do
          resultado — mas sem obrigar ninguém e sem tirar a liberdade de cada um. Você continua
          dono do seu trabalho, da sua empresa, dos seus bens, do seu dinheiro e das suas
          escolhas.
        </p>
        <p className="ucland-lead ucland-lead-soft">
          Acredite: você só vai fazer parte do UnifiCard porque, para você, isso vai fazer
          sentido. Chega de ilusão e de desconexão à toa.
        </p>
      </section>

      {/* Por que é diferente */}
      <section className="ucland-section ucland-reveal">
        <p className="ucland-kicker">Por que é diferente</p>
        <h2 className="ucland-h2">Uma rede que cresce com você, não às suas custas.</h2>
        <p className="ucland-lead">
          Muitas plataformas ficam maiores concentrando a relação, os dados e parte
          significativa do valor criado pelas pessoas. O UnifiCard nasce com outra proposta:
          crescer fortalecendo também quem participa.
        </p>
        <div className="ucland-navcards">
          <div className="ucland-navcard" style={{ cursor: 'default' }}>
            <h3 className="ucland-navcard-title">Modelo comum</h3>
            <p className="ucland-navcard-text">As pessoas geram valor → a plataforma concentra e o dinheiro se afasta da região.</p>
          </div>
          <div className="ucland-navcard" style={{ cursor: 'default' }}>
            <h3 className="ucland-navcard-title">Proposta UnifiCard</h3>
            <p className="ucland-navcard-text">As pessoas geram valor → participantes, negócios e a própria região ganham mais capacidade.</p>
          </div>
        </div>
      </section>

      {/* Honestidade */}
      <section className="ucland-section ucland-stage ucland-reveal">
        <p className="ucland-kicker">Com honestidade</p>
        <h2 className="ucland-h2">É uma construção — e você pode acompanhar cada passo.</h2>
        <p className="ucland-lead">
          O projeto está em desenvolvimento. Parte das atividades já funciona; outras estão
          sendo construídas. Não inventamos números de usuários, parceiros ou resultados que
          ainda não aconteceram. A força desta proposta vem da clareza da ideia e da
          transparência sobre o estágio atual.
        </p>
      </section>
    </PublicChrome>
  );
}
