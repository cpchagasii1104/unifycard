// src/pages/GruposPage.tsx
// Página de listagem de grupos

import { Link } from 'react-router-dom';

export default function GruposPage() {
  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Grupos</h1>
        <Link 
          to="/grupos/novo" 
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#2563eb',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '0.375rem',
            fontWeight: 500
          }}
        >
          Criar Grupo
        </Link>
      </div>
      <p>Lista de grupos será implementada aqui.</p>
    </div>
  );
}

