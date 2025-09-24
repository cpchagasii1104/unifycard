import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/auth-context.js';
import styles from './signup-page.module.css';

const SignUpPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const refParam = params.get('ref');
  const refFromURL = /^[a-zA-Z0-9]{6,12}$/.test(refParam) ? refParam : '';

  const [step, setStep] = useState(1);
  const [showTerms, setShowTerms] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    primeiro_nome: '',
    sobrenome: '',
    genero: '',
    cpf: '',
    dataNascimento: '',
    email: '',
    confirmarEmail: '',
    telefone: '',
    cep: '',
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    pais: 'Brasil',
    senha: '',
    confirmarSenha: '',
    termos: false,
    consent: false,
    referral_code: refFromURL,
  });

  const sexOptions = [
    { value: '', label: 'Selecione' },
    { value: 'male', label: 'Masculino' },
    { value: 'female', label: 'Feminino' },
    { value: 'not_informed', label: 'Prefiro não informar' },
  ];

  const validateCPF = (cpf) => {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i)) * (10 - i);
    let rest = (sum * 10) % 11;
    if (rest === 10 || rest === 11) rest = 0;
    if (rest !== parseInt(cpf.charAt(9))) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i)) * (11 - i);
    rest = (sum * 10) % 11;
    if (rest === 10 || rest === 11) rest = 0;
    return rest === parseInt(cpf.charAt(10));
  };

  const validateAge = (date) => {
    if (!date) return false;
    const today = new Date();
    const birth = new Date(date);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 14 && age <= 120;
  };

  const validateField = (name, value) => {
    switch (name) {
      case 'primeiro_nome':
      case 'sobrenome':
      case 'genero':
      case 'rua':
      case 'numero':
      case 'bairro':
      case 'cidade':
      case 'estado':
      case 'pais':
        return value.trim() === '' ? 'Campo obrigatório' : '';
      case 'cpf':
        return validateCPF(value) ? '' : 'CPF inválido';
      case 'dataNascimento':
        return validateAge(value) ? '' : 'Idade mínima: 14 anos';
      case 'email':
        return /^\S+@\S+\.\S+$/.test(value) ? '' : 'E-mail inválido';
      case 'confirmarEmail':
        return value === form.email ? '' : 'E-mails não coincidem';
      case 'telefone':
        return value.trim() === '' ? 'Campo obrigatório' : '';
      case 'senha':
        return value.length >= 6 ? '' : 'Senha muito curta';
      case 'confirmarSenha':
        return value === form.senha ? '' : 'Senhas não coincidem';
      case 'termos':
        return form.termos ? '' : 'Você deve aceitar os termos';
      case 'consent':
        return form.consent ? '' : 'Você deve autorizar o uso de dados';
      default:
        return '';
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    setForm({ ...form, [name]: val });
    setErrors({ ...errors, [name]: '' });
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    const error = validateField(name, form[name]);
    setErrors({ ...errors, [name]: error });
  };

  const fetchCEP = async () => {
    const sanitizedCep = form.cep.replace(/\D/g, '');
    if (sanitizedCep.length !== 8) return setErrors({ ...errors, cep: 'CEP inválido' });
    try {
      const res = await fetch(`https://viacep.com.br/ws/${sanitizedCep}/json/`);
      const data = await res.json();
      if (data.erro) return setErrors((prev) => ({ ...prev, cep: 'CEP não encontrado' }));
      setForm((prev) => ({
        ...prev,
        rua: data.logradouro,
        bairro: data.bairro,
        cidade: data.localidade,
        estado: data.uf,
      }));
    } catch {
      setErrors((prev) => ({ ...prev, cep: 'Erro ao buscar o CEP' }));
    }
  };

  const nextStep = () => {
    const required = {
      1: ['primeiro_nome', 'sobrenome', 'genero', 'cpf', 'dataNascimento', 'email', 'confirmarEmail', 'telefone'],
      2: ['cep', 'rua', 'numero', 'bairro', 'cidade', 'estado'],
      3: ['senha', 'confirmarSenha', 'termos', 'consent'],
    };
    const newErrors = {};
    required[step].forEach((field) => {
      const error = validateField(field, form[field]);
      if (error) newErrors[field] = error;
    });
    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      if (step === 3) submit();
      else setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
    else navigate('/');
  };

  const submit = async () => {
    try {
      const referral = form.referral_code?.trim();
      const validReferral = /^[a-zA-Z0-9]{6,12}$/.test(referral) ? referral : null;

      const payload = {
        first_name: form.primeiro_nome,
        last_name: form.sobrenome,
        email: form.email,
        password: form.senha,
        cpf: form.cpf.replace(/\D/g, ''),
        phone_country: '55',
        phone: form.telefone,
        biological_sex: form.genero,
        birth_date: form.dataNascimento,
        cep: form.cep,
        street: form.rua?.trim() || null,
        number: form.numero?.trim() || null,
        complement: form.complemento || null,
        country: form.pais,
        referral_code: validReferral,
        consent_at: form.consent ? new Date().toISOString() : null
      };

      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let data = null;
      try {
        data = await res.json();
      } catch (jsonErr) {
        throw new Error('Erro inesperado do servidor. Tente novamente mais tarde.');
      }

      if (!res.ok) throw new Error(data.message || 'Erro ao cadastrar');

      toast.success('Cadastro realizado com sucesso!');
      login(data.user, data.token);
      navigate('/dashboard');

    } catch (err) {
      toast.error(err.message || 'Erro ao cadastrar usuário');
    }
  };

  const renderInput = (name, label, type = 'text') => (
    <div className={styles['form-group']}>
      <label>{label}</label>
      <input
        type={type}
        name={name}
        value={form[name]}
        onChange={handleChange}
        onBlur={handleBlur}
      />
      {errors[name] && <span className={styles['form-error']}>{errors[name]}</span>}
    </div>
  );

  const renderSelect = (name, label, options, multiple = false) => (
    <div className={styles['form-group']}>
      <label>{label}</label>
      <select
        name={name}
        value={form[name]}
        onChange={handleChange}
        onBlur={handleBlur}
        multiple={multiple}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {errors[name] && <span className={styles['form-error']}>{errors[name]}</span>}
    </div>
  );

  const renderPassword = (name, label) => (
    <div className={styles['form-group']}>
      <label>{label}</label>
      <input
        type={showPassword ? 'text' : 'password'}
        name={name}
        value={form[name]}
        onChange={handleChange}
        onBlur={handleBlur}
      />
      <button type="button" onClick={() => setShowPassword(!showPassword)} className={styles['show-password']}>
        {showPassword ? 'Ocultar' : 'Mostrar'}
      </button>
      {errors[name] && <span className={styles['form-error']}>{errors[name]}</span>}
    </div>
  );

  return (
    <div className={styles['signup-container']}>
      <h2>Cadastro</h2>

      {step === 1 && (
        <>
          {renderInput('primeiro_nome', 'Primeiro Nome')}
          {renderInput('sobrenome', 'Sobrenome')}
          {renderSelect('genero', 'Sexo', sexOptions)}
          {renderInput('cpf', 'CPF')}
          {renderInput('dataNascimento', 'Data de Nascimento', 'date')}
          {renderInput('email', 'E-mail')}
          {renderInput('confirmarEmail', 'Confirmar E-mail')}
          {renderInput('telefone', 'Telefone')}
          {renderInput('referral_code', 'Código de Indicação (opcional)')}
        </>
      )}

      {step === 2 && (
        <>
          {renderInput('cep', 'CEP')}
          <button type="button" onClick={fetchCEP} className={styles['cep-btn']}>Buscar CEP</button>
          {renderInput('rua', 'Rua')}
          {renderInput('numero', 'Número')}
          {renderInput('complemento', 'Complemento')}
          {renderInput('bairro', 'Bairro')}
          {renderInput('cidade', 'Cidade')}
          {renderInput('estado', 'Estado')}
          {renderInput('pais', 'País')}
        </>
      )}

      {step === 3 && (
        <>
          {renderPassword('senha', 'Senha')}
          {renderPassword('confirmarSenha', 'Confirmar Senha')}
          <label>
            <input type="checkbox" name="termos" checked={form.termos} onChange={handleChange} />
            Aceito os termos de uso
          </label>
          {errors.termos && <span className={styles['form-error']}>{errors.termos}</span>}
          <label>
            <input type="checkbox" name="consent" checked={form.consent} onChange={handleChange} />
            Autorizo o uso de dados
          </label>
          {errors.consent && <span className={styles['form-error']}>{errors.consent}</span>}
        </>
      )}

      <div className={styles['form-actions']}>
        <button type="button" onClick={prevStep}>Voltar</button>
        <button type="button" onClick={nextStep}>
          {step < 3 ? 'Avançar' : 'Finalizar Cadastro'}
        </button>
      </div>
    </div>
  );
};

export default SignUpPage;
