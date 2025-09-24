import React, { useState, useEffect, useCallback } from 'react';
import styles from '../styles/user-account-page.module.css';
import { useAuth } from '../../auth/contexts/auth-context';
import { useNavigate } from 'react-router-dom';
import ProfessionalStep from '../../components/professional-step';
import HobbyStep from '../../components/hobby-step';
import AdditionalInfoStep from '../components/additional-info-step';
import { toast } from 'react-toastify';
import axios from 'axios';
import DashboardLayout from '../../dashboard/components/dashboard-layout';

const genderLabels = {
  male: 'Masculino',
  female: 'Feminino',
  non_binary: 'Não binário',
  trans_woman: 'Mulher trans',
  trans_man: 'Homem trans',
  travesti: 'Travesti',
  agender: 'Agênero',
  genderfluid: 'Gênero fluido',
  other: 'Outro',
  prefer_not_to_say: 'Prefiro não dizer',
};

const genderOptionsList = Object.keys(genderLabels).map(key => ({
  value: key,
  label: genderLabels[key],
}));

const UserAccountPage = () => {
  const navigate = useNavigate();
  const { profile, token, setProfile, setUser } = useAuth();

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dados');

  const [editable, setEditable] = useState({
    birth_date: '',
    phone: '',
    biological_sex: '',
    gender_identity: '',
    street: '',
    number: '',
    complement: '',
    cep: '',
    function_codes: [],
    hobby_codes: [],
    preferences: '',
  });

  useEffect(() => {
    if (profile) {
      setEditable(prev => ({
        ...prev,
        birth_date: profile.birth_date?.slice(0, 10) || '',
        phone: profile.phone || '',
        biological_sex: profile.biological_sex || '',
        gender_identity: profile.gender_identity || '',
        street: profile.street || '',
        number: profile.number || '',
        complement: profile.complement || '',
        cep: profile.cep || '',
        function_codes: Array.isArray(profile.function_codes) ? profile.function_codes : [],
        hobby_codes: Array.isArray(profile.hobby_codes) ? profile.hobby_codes : [],
        preferences: profile.preferences || '',
      }));
    }
  }, [profile]);

  const refreshProfile = async () => {
    try {
      const res = await axios.get('/api/user/dashboard', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const raw = res.data?.profile;
      if (raw?.user_id) {
        const simplifiedUser = {
          user_id: raw.user_id,
          email: raw.email,
          referral_code: raw.referral_code || '',
          regional_account_id: raw.regional_account_id || '',
          unify_bank_account_id: raw.unify_bank_account_id || '',
          card_id: raw.card_id || '',
        };

        const mappedProfile = {
          ...raw,
          cpf: raw.masked_cpf || '',
          birth_date: raw.birth_date || '',
          gender_identity: raw.gender_identity || '',
          biological_sex: raw.biological_sex || '',
          function_codes: Array.isArray(raw.function_codes) ? raw.function_codes : [],
          hobby_codes: Array.isArray(raw.hobby_codes) ? raw.hobby_codes : [],
          preferences: raw.preferences || '',
          neighborhood: raw.neighborhood || '',
          city_name: raw.city_name || '',
          state_name: raw.state_name || '',
          street: raw.street || '',
          number: raw.number || '',
          complement: raw.complement || '',
          cep: raw.cep || '',
          referral_code: raw.referral_code || '',
        };

        setUser(simplifiedUser);
        setProfile(mappedProfile);
        localStorage.setItem('user', JSON.stringify(simplifiedUser));
        localStorage.setItem('profile', JSON.stringify(mappedProfile));
      }
    } catch (err) {
      console.error('[refreshProfile] Erro ao atualizar dados:', err);
    }
  };

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setEditable(prev => ({ ...prev, [name]: value }));
  }, []);

  const calculateCompletion = () => {
    let percent = 0;
    if (profile?.first_name && profile?.last_name && profile?.cpf) percent += 25;
    if (editable.phone && editable.birth_date) percent += 15;
    if (editable.function_codes?.length > 0 && editable.gender_identity) percent += 30;
    return percent;
  };

  const saveChanges = async () => {
    try {
      if (!editable.birth_date || !editable.phone) return;
      setLoading(true);
      const res = await fetch(`/api/user-profile/${profile.user_profile_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editable),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro ao salvar');
      toast.success('Alterações salvas com sucesso!');
      await refreshProfile();
    } catch (err) {
      console.error('Erro ao salvar alterações:', err.message);
      toast.error('Erro ao salvar alterações.');
    } finally {
      setLoading(false);
    }
  };

  const renderPersonalInfo = () => {
    const progress = calculateCompletion();

    return (
      <section className={styles.block}>
        <button className={styles.backButton} onClick={() => navigate('/dashboard')}>← Voltar</button>
        <h3>Dados Pessoais</h3>
        <div className={styles.progressBarWrapper}>
          <div className={styles.progressBar}>
            <div className={styles.progress} style={{ width: `${progress}%` }}></div>
          </div>
          <p>{progress}% concluído</p>
        </div>

        <p><strong>Nome:</strong> {profile.first_name} {profile.last_name} <em>(alterável apenas presencialmente)</em></p>
        <p><strong>CPF:</strong> {profile.cpf || '(não informado)'} <em>(alterável apenas presencialmente)</em></p>
        <p>
          <strong>Endereço:</strong><br />
          Rua {profile.street}, {profile.number}
          {profile.complement ? `, ${profile.complement}` : ''},<br />
          Bairro: {profile.neighborhood}, Cidade: {profile.city_name}, Estado: {profile.state_name}, CEP: {profile.cep}<br />
          <em>(alterável apenas presencialmente)</em>
        </p>

        <p><strong>Data de nascimento:</strong> <input type="date" name="birth_date" value={editable.birth_date} onChange={handleChange} /></p>
        <p><strong>Telefone:</strong> <input type="text" name="phone" value={editable.phone} onChange={handleChange} /></p>
        <p><strong>Sexo biológico:</strong> {genderLabels[editable.biological_sex] || '—'}</p>
        <p>
          <strong>Identidade de gênero:</strong>{' '}
          <select name="gender_identity" value={editable.gender_identity} onChange={handleChange}>
            <option value="">Selecione</option>
            {genderOptionsList.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </p>

        <p><strong>Código de indicação:</strong> {profile.referral_code || '—'}
          <button onClick={() => navigator.clipboard.writeText(profile.referral_code || '')} className={styles.copyButton}>Copiar</button>
        </p>

        <button onClick={saveChanges} disabled={loading || !editable.birth_date || !editable.phone}>
          {loading ? 'Salvando...' : 'Salvar'}
        </button>
      </section>
    );
  };

  const renderPreferences = () => (
    <section className={styles.block}>
      <h3>Preferências e Hobbies</h3>
      <HobbyStep editable={editable} setEditable={setEditable} />
      <label><strong>Conte-nos mais:</strong></label>
      <textarea
        name="preferences"
        rows={4}
        value={editable.preferences}
        onChange={handleChange}
        placeholder="Conte-nos mais sobre seus interesses, hobbies e preferências..."
      />
      <button onClick={saveChanges} disabled={loading}>
        {loading ? 'Salvando...' : 'Salvar'}
      </button>
    </section>
  );

  const renderProfession = () => (
    <section className={styles.block}>
      <h3>Dados Profissionais</h3>
      <ProfessionalStep editable={editable} setEditable={setEditable} />
      <button onClick={saveChanges} disabled={loading}>
        {loading ? 'Salvando...' : 'Salvar'}
      </button>
    </section>
  );

  const renderAdditionalInfo = () => (
    <section className={styles.block}>
      <AdditionalInfoStep />
    </section>
  );

  if (!profile) return <div className={styles.error}>Erro ao carregar dados da conta.</div>;

  return (
    <DashboardLayout>
      <div className={styles.container}>
        <h2>Minha Conta</h2>
        <nav className={styles.tabs}>
          <button onClick={() => setActiveTab('dados')} className={activeTab === 'dados' ? styles.active : ''}>Dados Pessoais</button>
          <button onClick={() => setActiveTab('profissionais')} className={activeTab === 'profissionais' ? styles.active : ''}>Dados Profissionais</button>
          <button onClick={() => setActiveTab('preferencias')} className={activeTab === 'preferencias' ? styles.active : ''}>Preferências e Hobbies</button>
          <button onClick={() => setActiveTab('adicionais')} className={activeTab === 'adicionais' ? styles.active : ''}>Informações Adicionais</button>
        </nav>
        <div className={styles.tabContent}>
          {activeTab === 'dados' && renderPersonalInfo()}
          {activeTab === 'profissionais' && renderProfession()}
          {activeTab === 'preferencias' && renderPreferences()}
          {activeTab === 'adicionais' && renderAdditionalInfo()}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default UserAccountPage;
