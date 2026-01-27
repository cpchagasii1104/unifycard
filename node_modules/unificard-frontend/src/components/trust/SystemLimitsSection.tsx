// frontend/src/components/trust/SystemLimitsSection.tsx
// CONTINUOUS PRODUCTION: Seção "O que NÃO faz" - SPRINT 12
// Explica limites do sistema de forma clara, sem esconder risco

import './SystemLimitsSection.css';

export default function SystemLimitsSection() {
  return (
    <div className="system-limits-section">
      <h2>O que este sistema NÃO faz</h2>
      
      <div className="system-limits-blocks">
        <div className="system-limits-block">
          <h3>Não decide por você</h3>
          <p>
            O sistema não toma decisões financeiras ou operacionais em seu nome. 
            Você controla suas ações e assume responsabilidade por elas.
          </p>
        </div>

        <div className="system-limits-block">
          <h3>Não esconde ações</h3>
          <p>
            Tudo é registrado, mas isso não significa que você verá tudo imediatamente. 
            A timeline mostra o que é relevante para você, não tudo que acontece no sistema.
          </p>
        </div>

        <div className="system-limits-block">
          <h3>Não promete ganhos</h3>
          <p>
            O sistema não garante lucro, sucesso ou resultado financeiro. 
            Ele apenas registra e distribui o que acontece, conforme as regras configuradas.
          </p>
        </div>

        <div className="system-limits-block">
          <h3>Não remove conflitos humanos</h3>
          <p>
            Disputas e desacordos continuam existindo. O sistema oferece ferramentas 
            para revisão e reversão, mas não elimina a necessidade de diálogo e resolução humana.
          </p>
        </div>

        <div className="system-limits-block">
          <h3>Não garante segurança absoluta</h3>
          <p>
            O sistema registra e audita ações, mas não pode prevenir todos os erros 
            ou abusos. A responsabilidade institucional é compartilhada entre usuários e administradores.
          </p>
        </div>
      </div>
    </div>
  );
}







