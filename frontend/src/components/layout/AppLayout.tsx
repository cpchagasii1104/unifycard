// src/components/layout/AppLayout.tsx
// 2026-05-15: sidebar local removida — agora usa GlobalSidebar unificada.

import { Outlet } from 'react-router-dom';
import GlobalSidebar from './GlobalSidebar';
import './AppLayout.css';

export default function AppLayout() {
  return (
    <div className="app-layout">
      <GlobalSidebar />
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
