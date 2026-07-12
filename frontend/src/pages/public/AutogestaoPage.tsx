// frontend/src/pages/public/AutogestaoPage.tsx
// Página pública "/autogestao" — como o valor circula, os fundos da região,
// a participação da população e a visão de longo prazo. Linguagem leiga e honesta.
//
// Cuidados de honestidade (fonte: documentos do próprio projeto):
//  - percentuais são apresentados como ILUSTRATIVOS/ajustáveis, não como promessa;
//  - fundo de bairro ainda está sendo preparado (começo por níveis maiores);
//  - grupos hoje permitem ACOMPANHAR; a votação de gastos está em construção;
//  - sem linguagem de investimento, rendimento, token ou partido.
// Só experiência pública pré-login.

import PublicChrome, { Icon, type IconName } from './PublicChrome';

type Nivel = { icon: IconName; nome: string; desc: string; hold?: boolean };
const NIVEIS: Nivel[] = [
  { icon: 'planeta', nome: 'Planeta', desc: 'A base mais ampla de todos' },
  { icon: 'regiao', nome: 'País', desc: 'O seu país' },
  { icon: 'regiao', nome: 'Estado', desc: 'O seu estado' },
  { icon: 'regiao', nome: 'Cidade', desc: 'A sua cidade' },
  { icon: 'comunidade', nome: 'Bairro', desc: 'Em preparação', hold: true },
];

const CIRCULA: string[] = [
  'Uma atividade acontece na rede (uma compra, um serviço, uma venda).',
  'Uma parte pequena — a comissão da rede — é separada.',
  'Em vez de ir embora, ela pode voltar para a base de quem participou.',
  'Uma fatia fica na sua região; outra pode fortalecer grupos que você acompanha.',
];

export default function AutogestaoPage() {
  return (
    <PublicChrome current="autogestao">
      <section className="ucland-pagehero ucland-reveal">
        <p className="ucland-kicker">Autogestão e região</p>
        <h1 className="ucland-h2">Quando o valor circula perto, a comunidade ganha força.</h1>
        <p className="ucland-lead">
          Aqui está a parte que torna o UnifiCard diferente de um marketplace com discurso
          social: a proposta de que a atividade econômica de hoje ajude a construir capacidade
          para a sua região — com participação e transparência.
        </p>
      </section>

      {/* Como o valor circula */}
      <section className="ucland-section ucland-reveal">
        <p className="ucland-kicker">Como o valor circula</p>
        <h2 className="ucland-h2">Parte do valor pode voltar para onde ele foi criado.</h2>
        <p className="ucland-lead">
          Em muitas plataformas, o que você movimenta se afasta da sua cidade. A ideia aqui é a
          oposta: quando uma atividade acontece na rede, parte do valor pode retornar para a
          base econômica de quem participou.
        </p>
        <ol className="ucland-cycle-steps">
          {CIRCULA.map((c, i) => (
            <li key={c}>
              <span className="ucland-cycle-num">{i + 1}</span>
              <span className="ucland-cycle-text">{c}</span>
            </li>
          ))}
        </ol>
        <p className="ucland-note">
          Os percentuais exatos são ilustrativos e poderão ser ajustados com transparência. A
          intenção firme é simples: uma parte relevante permanece na sua região, e a divisão é
          pública e acompanhável.
        </p>
      </section>

      {/* Fundos territoriais */}
      <section className="ucland-section ucland-band ucland-reveal">
        <p className="ucland-kicker">A região é a sua</p>
        <h2 className="ucland-h2">O valor volta para a sua região — não para onde o gasto aconteceu.</h2>
        <p className="ucland-lead">
          A região que se fortalece é a de quem participa. Se você é da sua cidade e faz uma
          compra em outro lugar, a parte que retorna é organizada em níveis, do maior para o
          mais próximo de você:
        </p>
        <div className="ucland-ladder">
          {NIVEIS.map((n) => (
            <div className={`ucland-ladder-row ${n.hold ? 'is-hold' : ''}`} key={n.nome}>
              <span className="ucland-ladder-ic"><Icon name={n.icon} size={22} /></span>
              <span className="ucland-ladder-name">{n.nome}</span>
              <span className="ucland-ladder-desc">{n.desc}</span>
            </div>
          ))}
        </div>
        <p className="ucland-note">
          Estamos começando pelos níveis maiores e por uma primeira cidade, com cuidado. O fundo
          de bairro depende de um mapa oficial de bairros para não criar divisões erradas — por
          isso entra depois. Crescer devagar e certo é parte da proposta.
        </p>
      </section>

      {/* Participação e transparência */}
      <section className="ucland-section ucland-reveal">
        <p className="ucland-kicker">Participação e transparência</p>
        <h2 className="ucland-h2">A população não é apenas usuária.</h2>
        <p className="ucland-lead">
          A proposta é que as pessoas possam fazer mais do que usar serviços: acompanhar
          informações, participar de grupos e ajudar a construir decisões que afetam a sua
          comunidade.
        </p>
        <div className="ucland-grid-cards ucland-grid-4">
          <article className="ucland-activity">
            <span className="ucland-activity-icon"><Icon name="acompanhar" /></span>
            <h3 className="ucland-activity-title">Acompanhar</h3>
            <p className="ucland-activity-text">Ver, de forma mais clara, o que a rede gera perto de você.</p>
            <span className="ucland-tag ucland-tag-live">Já começa a existir</span>
          </article>
          <article className="ucland-activity">
            <span className="ucland-activity-icon"><Icon name="grupos" /></span>
            <h3 className="ucland-activity-title">Fiscalizar em grupo</h3>
            <p className="ucland-activity-text">Participar de grupos e acompanhar como os recursos são usados.</p>
            <span className="ucland-tag ucland-tag-live">Já começa a existir</span>
          </article>
          <article className="ucland-activity">
            <span className="ucland-activity-icon"><Icon name="participar" /></span>
            <h3 className="ucland-activity-title">Decidir junto</h3>
            <p className="ucland-activity-text">Escolher prioridades e destinos de recursos, com voto transparente.</p>
            <span className="ucland-tag ucland-tag-soon">Em construção</span>
          </article>
          <article className="ucland-activity">
            <span className="ucland-activity-icon"><Icon name="construir" /></span>
            <h3 className="ucland-activity-title">Construir</h3>
            <p className="ucland-activity-text">Ajudar a transformar atividade econômica em capacidade para o futuro.</p>
            <span className="ucland-tag ucland-tag-soon">Em construção</span>
          </article>
        </div>
        <p className="ucland-note ucland-note-strong">
          Regra que orienta tudo: 1 pessoa = 1 voto — não é peso por quanto se gasta. Sem venda
          de dados e sem anúncios que perseguem você.
        </p>
      </section>

      {/* Longo prazo */}
      <section className="ucland-section ucland-reveal">
        <div className="ucland-dark">
          <p className="ucland-kicker">Além de hoje</p>
          <h2 className="ucland-h2">Pensado para durar mais do que um ciclo curto.</h2>
          <p className="ucland-lead">
            Governos mudam a cada eleição. A proposta do UnifiCard é ajudar a construir
            mecanismos que fortaleçam pessoas e comunidades por muitos anos — não depender de
            ideologia, e sim da participação real das pessoas.
          </p>
          <ul className="ucland-dark-list">
            <li>Crescimento cidade por cidade, no ritmo de cada comunidade</li>
            <li>Participação popular nas decisões, com voto transparente</li>
            <li>Uma reserva pensada para o futuro, que se protege ao longo do tempo</li>
            <li>Governança cada vez mais comunitária, difícil de capturar</li>
          </ul>
          <p className="ucland-dark-quote">
            A ideia não é substituir governos nem prometer um país perfeito por software. É
            transformar bons mecanismos de organização em ferramentas acessíveis às pessoas.
          </p>
        </div>
      </section>

      {/* Honestidade */}
      <section className="ucland-section ucland-stage ucland-reveal">
        <p className="ucland-kicker">Com honestidade</p>
        <h2 className="ucland-h2">Boa parte disso ainda está sendo construída.</h2>
        <p className="ucland-lead">
          A estrutura que devolve valor para a região já começa a existir; acompanhar grupos já
          é possível. A votação de como cada grupo usa os recursos, a transparência com números
          públicos e os níveis mais próximos, como o bairro, estão em construção. Preferimos
          dizer isso com clareza a prometer o que ainda não roda.
        </p>
      </section>
    </PublicChrome>
  );
}
