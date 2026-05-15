// src/components/layout/BankLayout.tsx
// 2026-05-15: sidebar local removida — agora usa GlobalSidebar unificada.

import { Outlet } from 'react-router-dom';
import HeaderGlobal from './HeaderGlobal';
import GlobalSidebar from './GlobalSidebar';
import './BankLayout.css';

export default function BankLayout() {
  return (
    <div className="bank-layout">
      <HeaderGlobal />
      <div className="bank-layout-content">
        <GlobalSidebar />
        <main className="bank-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
