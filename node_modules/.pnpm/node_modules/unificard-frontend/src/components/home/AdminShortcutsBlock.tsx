// src/components/home/AdminShortcutsBlock.tsx
// Bloco de atalhos administrativos

import './AdminShortcutsBlock.css';

export default function AdminShortcutsBlock() {
  // Dados mockados
  const shortcuts = [
    {
      id: 'bank',
      title: 'Banco',
      description: 'Acesse sua conta e transações',
      icon: '🏦',
      path: '/banco',
    },
    {
      id: 'companies',
      title: 'Empresas',
      description: 'Gerencie suas empresas',
      icon: '🏢',
      path: '/empresas',
    },
    {
      id: 'settings',
      title: 'Configurações',
      description: 'Ajuste suas preferências',
      icon: '⚙️',
      path: '/dashboard',
    },
    {
      id: 'admin',
      title: 'Admin',
      description: 'Painel administrativo',
      icon: '🔧',
      path: '/validation',
    },
  ];

  return (
    <div className="admin-shortcuts-block">
      <h2 className="admin-shortcuts-title">Atalhos rápidos</h2>
      <div className="admin-shortcuts-grid">
        {shortcuts.map((shortcut) => (
          <div key={shortcut.id} className="admin-shortcut-card">
            <div className="admin-shortcut-icon">{shortcut.icon}</div>
            <h3 className="admin-shortcut-title">{shortcut.title}</h3>
            <p className="admin-shortcut-description">{shortcut.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}








