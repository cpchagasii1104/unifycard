// src/pages/TransparencyPage.tsx
//
// Página placeholder honesta para rota /transparencia.
// Resolve DT-UX-GHOST-ROUTE-TRANSPARENCIA: link existia mas rota não, gerando
// tela em branco.
//
// NÃO busca backend. NÃO inventa números. NÃO simula dados.
// Quando o módulo de Transparência existir como contrato real, esta página
// vira a porta de entrada substituindo o placeholder.

import { useNavigate } from 'react-router-dom';

export default function TransparencyPage() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        padding: '2.5rem 2rem',
        maxWidth: 720,
        margin: '0 auto',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>
        Transparência
      </h1>
      <p style={{ color: '#475569', lineHeight: 1.6, marginBottom: '1.5rem' }}>
        O módulo de Transparência está em preparação. Quando houver operação
        real (movimentações, prestação de contas, indicadores), os dados serão
        exibidos aqui — sempre com origem rastreável e sem números inventados.
      </p>
      <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '2rem' }}>
        Por enquanto, nenhuma operação rastreável existe para mostrar.
      </p>
      <button
        type="button"
        onClick={() => navigate('/home')}
        style={{
          padding: '0.6rem 1.4rem',
          background: '#0ea5e9',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: '1rem',
        }}
      >
        Voltar para a Home
      </button>
    </div>
  );
}
