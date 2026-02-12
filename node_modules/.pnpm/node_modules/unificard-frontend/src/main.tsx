import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/global.css';

// Verificar se o elemento root existe
const rootElement = document.getElementById('root');
if (!rootElement) {
  document.body.innerHTML = '<h1 style="color: red; padding: 2rem;">Erro: Elemento #root não encontrado</h1>';
  throw new Error('Elemento #root não encontrado no DOM');
}

console.log('🚀 Inicializando React...');

try {
  const root = ReactDOM.createRoot(rootElement);
  console.log('✅ Root criado com sucesso');
  
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
  
  console.log('✅ App renderizado com sucesso');
} catch (error) {
  console.error('❌ Erro ao inicializar React:', error);
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 2rem; text-align: center; font-family: system-ui, sans-serif; background: #fee2e2; min-height: 100vh;">
        <h1 style="color: #dc2626; margin-bottom: 1rem;">❌ Erro ao carregar aplicação</h1>
        <p style="color: #991b1b; margin-bottom: 1rem; font-weight: 500;">
          ${error instanceof Error ? error.message : 'Erro desconhecido'}
        </p>
        <pre style="background: white; padding: 1rem; border-radius: 0.5rem; text-align: left; max-width: 800px; margin: 0 auto; overflow: auto; font-size: 0.875rem;">
          ${error instanceof Error ? error.stack : JSON.stringify(error, null, 2)}
        </pre>
        <button 
          onclick="window.location.reload()" 
          style="padding: 0.75rem 1.5rem; background-color: #2563eb; color: white; border: none; border-radius: 0.375rem; cursor: pointer; margin-top: 1rem; font-size: 1rem;">
          Recarregar Página
        </button>
      </div>
    `;
  }
}






