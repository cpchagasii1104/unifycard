import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/dashboard-page.module.css';
import { useAuth } from '../../auth/contexts/auth-context';

const DashboardPage = () => {
  const { profile, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();

if (!profile) {
  return (
    <div className={styles.loading}>
      <p>Carregando dados do usuário...</p>
    </div>
  );
}

  const profissaoList = profile.function_codes || [];
  const hobbiesList = profile.hobby_codes || [];

  return (
    <div className={styles.dashboardGrid}>
      {/* Menu lateral esquerdo */}
      <aside className={styles.sidebar}>
        <p className={styles.menuLink} onClick={() => navigate('/minha-conta')}>Minha conta</p>
        <p className={styles.menuLink}>Quero vender</p>
        <p className={styles.menuLink}>Quero prestar serviços</p>
        <p className={styles.menuLink}>Projetos</p>
        <p className={styles.menuLink}>Votação</p>
        <p className={styles.menuLink}>Pedir comida</p>
        <p className={styles.menuLink}>Comprar</p>
        <p className={styles.menuLink}>Solicitar um carro</p>

        {/* ✅ Acesso à empresa */}
        {profile?.companyId && (
          <>
            <hr className={styles.separator} />
            <p className={styles.menuLink} onClick={() => navigate('/empresa/produtos')}>Produtos</p>
            <p className={styles.menuLink} onClick={() => navigate('/empresa/permissoes')}>Permissões</p>
            <p className={styles.menuLink} onClick={() => navigate('/agenda')}>Agenda</p>
          </>
        )}
      </aside>

      {/* Conteúdo principal */}
      <div>
        {/* Cabeçalho fixo */}
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

        {/* Endereço e CPF */}
        <div className={styles.addressBox}>
          <strong>
            Rua {profile.street}, {profile.number}, Bairro: {profile.neighborhood}, Cidade: {profile.city_name}, Estado: {profile.state_name}, CEP: {profile.cep}
          </strong>
          {profile.cpf && (
            <p className={styles.maskedCpf}>CPF: {profile.cpf}</p>
          )}
          {!profile.cpf && (
            <p className={styles.maskedCpf}>CPF não disponível</p>
          )}
          <button className={styles.refreshBtn} onClick={refreshProfile}>Atualizar dados</button>
        </div>

        {/* Slides */}
        <section className={styles.slideInfo}>
          <h4><strong>Slide de informações da região/parceiros:</strong></h4>
          <div className={styles.slideCarousel}>
            <div className={styles.slideCard}>
              <strong>Loja Validadora {profile.city_name}</strong>
              <p>A unidade de {profile.city_name} fará a validação de documentos presenciais na Loja ABC.</p>
            </div>
            <div className={styles.slideCard}>
              <strong>Parceria Cultural {profile.city_name}</strong>
              <p>Benefícios em teatros da cidade para usuários verificados.</p>
            </div>
            <div className={styles.slideCard}>
              <strong>Feira de Projetos</strong>
              <p>Participe da feira anual de projetos comunitários em {profile.city_name}.</p>
            </div>
          </div>
          <p className={styles.warning}>
            Lembrando que o CPF é o que dá identidade ao usuário. Se ele fizer algo errado e tentar voltar, devemos manter sua reputação registrada no sistema. Não pode sair livre dos erros.
          </p>
        </section>

        {/* Feed */}
        <div className={styles.feedBox}>
          <h4>Feed de notícias:</h4>
          <p>Postagens de amigos, projetos em andamento, votações e iniciativas locais.</p>
          <p className={styles.note}>Esta rede é feita para transformar comunidades.</p>
        </div>

        {/* Saldos */}
        <div className={styles.balancesBox}>
          <h4><strong>Saldos:</strong></h4>
          <ul>
            <li>Pessoal: R$ 0,00</li>
            <li>Conta regional: R$ 0,00</li>
            <li>Grupo 1: R$ 0,00</li>
            <li>Grupo 2: R$ 0,00</li>
            <li>Grupo 3: R$ 0,00</li>
          </ul>
        </div>

        {/* Profissões */}
        <div className={styles.professionsBox}>
          <h4>Profissões cadastradas:</h4>
          <ul>
            {profissaoList.length > 0 ? (
              profissaoList.map((code, index) => <li key={index}>{code}</li>)
            ) : (
              <li>Nenhuma profissão cadastrada.</li>
            )}
          </ul>
        </div>

        {/* Hobbies */}
        <div className={styles.hobbiesBox}>
          <h4>Hobbies cadastrados:</h4>
          <ul>
            {hobbiesList.length > 0 ? (
              hobbiesList.map((code, index) => <li key={index}>{code}</li>)
            ) : (
              <li>Nenhum hobby cadastrado.</li>
            )}
          </ul>
        </div>

        {/* Banner */}
        <div className={styles.bannerBox}>
          <h4>Banner patrocinado por região</h4>
          <div className={styles.bannerArea}>
            {/* Conteúdo dinâmico futuro */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
