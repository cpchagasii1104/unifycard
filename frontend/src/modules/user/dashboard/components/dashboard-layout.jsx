import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/contexts/auth-context';
import styles from '../styles/dashboard-page.module.css'; // ✅ Caminho CSS corrigido

const DashboardLayout = ({ children }) => {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  if (!profile) {
    return <div className={styles.error}>Erro ao carregar o layout.</div>;
  }

  return (
    <div className={styles.dashboardGrid}>
      {/* Menu lateral */}
      <aside className={styles.sidebar}>
        <p className={styles.menuLink} onClick={() => navigate('/minha-conta')}>Minha conta</p>
        <p className={styles.menuLink}>Quero vender</p>
        <p className={styles.menuLink}>Quero prestar serviços</p>
        <p className={styles.menuLink}>Projetos</p>
        <p className={styles.menuLink}>Votação</p>
        <p className={styles.menuLink}>Pedir comida</p>
        <p className={styles.menuLink}>Comprar</p>
        <p className={styles.menuLink}>Solicitar um carro</p>
      </aside>

      {/* Cabeçalho e conteúdo */}
      <div>
        <header className={styles.header}>
          <div className={styles.logoBox} onClick={() => navigate('/dashboard')}>
            <img src="/logo.png" alt="UnifyCard" />
          </div>
          <input type="text" placeholder="Pesquisar..." className={styles.searchInput} />
          <span className={styles.referralText}>
            Código: <strong>{profile.referral_code || '—'}</strong>
            <button
              className={styles.copyBtn}
              onClick={() => navigator.clipboard.writeText(profile.referral_code || '')}
            >
              Copiar
            </button>
          </span>
          <div className={styles.actions}>
            <button className={styles.backBtn} onClick={() => navigate('/dashboard')}>Início</button>
            <button className={styles.dashboardLogoutBtn} onClick={logout}>Sair</button>
          </div>
        </header>

        {/* Área de conteúdo da página */}
        <main className={styles.mainContent}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
