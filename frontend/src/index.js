import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app.jsx';
import './index.css';

import { AuthProvider } from './modules/user/auth/contexts/auth-context';
import SessionLoader from './modules/user/auth/components/session-loader';

const root = document.getElementById('root');

if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <AuthProvider>
        <SessionLoader>
          <App />
        </SessionLoader>
      </AuthProvider>
    </React.StrictMode>
  );
} else {
  console.error("Elemento #root não encontrado no HTML.");
}
