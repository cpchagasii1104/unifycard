import React, { useEffect, useState } from 'react';
import { getUserProfile, updateUserProfile } from '../../services/user-service';
import { useAuth } from '../../auth/contexts/auth-context';
import { toast } from 'react-toastify';

const moradiaOptions = ['Própria', 'Alugada', 'Financiada', 'Cedida', 'Ocupada', 'Outros'];
const vinculoOptions = ['CLT', 'PJ', 'Autônomo', 'Informal', 'Estudante', 'Aposentado', 'Outro'];

const defaultForm = {
  user_profile_id: '',
  housing_situation: '',
  employment_type: '',
  residents: '',
  dependents_count: '',
  receives_social_benefit: '',
  social_benefit_details: '',
  has_disability: '',
  disability_details: '',
  need_accessibility: '',
  has_children: '',
  children_count: '',
  children_ages: '',
  height_cm: '',
  weight_kg: '',
  is_caregiver: '',
  has_animals: '',
};

const AdditionalInfoStep = () => {
  const { profile, token } = useAuth();
  const [formData, setFormData] = useState(defaultForm);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        console.log('[FETCH PROFILE] ID:', profile.user_profile_id);
        const data = await getUserProfile(token, profile.user_profile_id);
        console.log('[FETCH PROFILE] Dados recebidos:', data);

        setFormData({
          user_profile_id: data.user_profile_id || '',
          housing_situation: data.housing_situation || '',
          employment_type: data.employment_type || '',
          residents: data.residents ?? '',
          dependents_count: data.dependents_count ?? '',
          receives_social_benefit: data.receives_social_benefit ?? '',
          social_benefit_details: data.social_benefit_details || '',
          has_disability: data.has_disability ?? '',
          disability_details: data.disability_details || '',
          need_accessibility: data.need_accessibility ?? '',
          has_children: data.has_children ?? '',
          children_count: data.children_count ?? '',
          children_ages: Array.isArray(data.children_ages) ? data.children_ages.join(', ') : '',
          height_cm: data.height_cm ?? '',
          weight_kg: data.weight_kg ?? '',
          is_caregiver: data.is_caregiver ?? '',
          has_animals: data.has_animals ?? '',
        });
      } catch (error) {
        console.error('Erro ao carregar perfil:', error);
      }
    };
    fetchProfile();
  }, [token, profile.user_profile_id]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    const parsed = type === 'number' ? (value === '' ? '' : parseInt(value, 10)) : value;
    setFormData((prev) => ({ ...prev, [name]: parsed }));
  };

  const handleBooleanSelect = (e) => {
    const { name, value } = e.target;
    let parsed = '';
    if (value === 'true') parsed = true;
    else if (value === 'false') parsed = false;
    setFormData((prev) => ({ ...prev, [name]: parsed }));
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const payload = {
        ...formData,
        residents: formData.residents === '' ? null : Number(formData.residents),
        dependents_count: formData.dependents_count === '' ? null : Number(formData.dependents_count),
        height_cm: formData.height_cm === '' ? null : Number(formData.height_cm),
        weight_kg: formData.weight_kg === '' ? null : Number(formData.weight_kg),
        children_count: formData.children_count === '' ? null : Number(formData.children_count),
        children_ages: formData.children_ages
          ? formData.children_ages.split(',').map((age) => age.trim()).filter(Boolean)
          : [],
      };

      const user_profile_id = profile.user_profile_id || formData.user_profile_id;
      if (!user_profile_id) throw new Error('ID do perfil ausente');

      console.log('════════════════════════════════════════════');
      console.log('[SUBMIT] ID do perfil:', user_profile_id);
      console.log('[SUBMIT] Payload enviado:', payload);
      console.log('════════════════════════════════════════════');

      const updated = await updateUserProfile(user_profile_id, payload, token);

      setFormData({
        ...formData,
        ...updated,
        children_ages: Array.isArray(updated.children_ages) ? updated.children_ages.join(', ') : '',
      });

      toast.success('Informações salvas com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar:', err);
      toast.error('Erro ao salvar informações.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3>Informações Adicionais do Perfil</h3>

      <label>Tipo de Moradia:</label>
      <select name="housing_situation" value={formData.housing_situation} onChange={handleChange}>
        <option value="">Selecione</option>
        {moradiaOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>

      <label>Tipo de Vínculo:</label>
      <select name="employment_type" value={formData.employment_type} onChange={handleChange}>
        <option value="">Selecione</option>
        {vinculoOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>

      <label>Quantidade de Moradores:</label>
      <input type="number" name="residents" value={formData.residents} onChange={handleChange} />

      <label>Quantidade de Dependentes:</label>
      <input type="number" name="dependents_count" value={formData.dependents_count} onChange={handleChange} />

      <label>Recebe Benefício Social?</label>
      <select name="receives_social_benefit" value={String(formData.receives_social_benefit)} onChange={handleBooleanSelect}>
        <option value="">Selecione</option>
        <option value="true">Sim</option>
        <option value="false">Não</option>
      </select>

      <label>Detalhes do Benefício:</label>
      <input type="text" name="social_benefit_details" value={formData.social_benefit_details} onChange={handleChange} />

      <label>Possui Deficiência?</label>
      <select name="has_disability" value={String(formData.has_disability)} onChange={handleBooleanSelect}>
        <option value="">Selecione</option>
        <option value="true">Sim</option>
        <option value="false">Não</option>
      </select>

      <label>Detalhes da Deficiência:</label>
      <input type="text" name="disability_details" value={formData.disability_details} onChange={handleChange} />

      <label>Necessita Acessibilidade?</label>
      <select name="need_accessibility" value={String(formData.need_accessibility)} onChange={handleBooleanSelect}>
        <option value="">Selecione</option>
        <option value="true">Sim</option>
        <option value="false">Não</option>
      </select>

      <label>Tem filhos?</label>
      <select name="has_children" value={String(formData.has_children)} onChange={handleBooleanSelect}>
        <option value="">Selecione</option>
        <option value="true">Sim</option>
        <option value="false">Não</option>
      </select>

      <label>Quantidade de Filhos:</label>
      <input type="number" name="children_count" value={formData.children_count} onChange={handleChange} />

      <label>Idades dos Filhos (vírgula):</label>
      <input type="text" name="children_ages" value={formData.children_ages} onChange={handleChange} />

      <label>Altura (cm):</label>
      <input type="number" name="height_cm" value={formData.height_cm} onChange={handleChange} />

      <label>Peso (kg):</label>
      <input type="number" name="weight_kg" value={formData.weight_kg} onChange={handleChange} />

      <label>É cuidador?</label>
      <select name="is_caregiver" value={String(formData.is_caregiver)} onChange={handleBooleanSelect}>
        <option value="">Selecione</option>
        <option value="true">Sim</option>
        <option value="false">Não</option>
      </select>

      <label>Possui animais?</label>
      <select name="has_animals" value={String(formData.has_animals)} onChange={handleBooleanSelect}>
        <option value="">Selecione</option>
        <option value="true">Sim</option>
        <option value="false">Não</option>
      </select>

      <br />
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? 'Salvando...' : 'Salvar'}
      </button>
    </div>
  );
};

export default AdditionalInfoStep;

