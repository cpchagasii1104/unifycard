// frontend/src/components/trust/HowItWorksSection.tsx
// CONTINUOUS PRODUCTION: Seção "Como Funciona" - SPRINT 12
// Explica de forma humana como o sistema opera, sem marketing

import './HowItWorksSection.css';

export default function HowItWorksSection() {
  return (
    <div className="how-it-works-section">
      <h2>Como o sistema funciona</h2>
      
      <div className="how-it-works-blocks">
        <div className="how-it-works-block">
          <h3>Quem age</h3>
          <p>
            Pessoas físicas executam ações. Você sempre sabe quem fez o quê, 
            porque cada ação registra quem a executou e quando.
          </p>
        </div>

        <div className="how-it-works-block">
          <h3>Em nome de quem</h3>
          <p>
            Você pode agir em seu próprio nome (pessoa física) ou em nome de 
            empresas, grupos e projetos. A delegação é explícita e auditável.
          </p>
        </div>

        <div className="how-it-works-block">
          <h3>Como o dinheiro circula</h3>
          <p>
            Toda transação financeira é registrada no Unify Bank. Você pode ver 
            para onde vai cada centavo: prestadores, grupos, fundo regional, taxas. 
            Nada é escondido.
          </p>
        </div>

        <div className="how-it-works-block">
          <h3>Como decisões são registradas</h3>
          <p>
            Toda ação importante aparece na timeline institucional. Você vê quem 
            executou, em nome de quem, com qual autoridade e quando. 
            Nada desaparece.
          </p>
        </div>

        <div className="how-it-works-block">
          <h3>Como conflitos são tratados</h3>
          <p>
            Se algo não está certo, você pode solicitar revisão. A disputa fica 
            registrada e pode ser resolvida por administradores. Em casos de erro, 
            transações podem ser revertidas tecnicamente.
          </p>
        </div>
      </div>
    </div>
  );
}







