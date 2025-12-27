// src/components/FullScreenLoading.tsx
// Loading fullscreen para bootstrap de sessão

import './FullScreenLoading.css';

export default function FullScreenLoading() {
  return (
    <div className="fullscreen-loading">
      <div className="loading-content">
        <div className="loading-spinner"></div>
        <p>Carregando...</p>
      </div>
    </div>
  );
}








