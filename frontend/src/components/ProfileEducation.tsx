// src/components/ProfileEducation.tsx
// Componente de perfil educacional - MODELO 100% EVENT-BASED
// Visualização temporal + criação de eventos (append-only)
//
// 🔴 BLINDAGEM CRÍTICA: Este componente NÃO pode ser transformado em sistema decisório.
// - Educação não gera score, não filtra, não bloqueia, não decide
// - Linha do tempo é apenas cronológica (sem hierarquia ou importância)
// - Cores são apenas diferenciação visual, não semântica
// - Eventos são append-only (não editáveis, não deletáveis)

import { useEffect } from 'react';
import {
  getEducationProfile,
  createEducationEvent,
  type CreateEducationEventInput,
} from '../api/education';
import { useSession } from '../contexts/SessionProvider';
import NotApplicableMessage from './NotApplicableMessage';
import { useProfileEducationState } from '../hooks/useProfileEducationState';
import { useProfileEducationLogic } from '../hooks/useProfileEducationLogic';
import ProfileEducationForm from './ProfileEducationForm';
import './ProfileEducation.css';

export default function ProfileEducation() {
  const { activeActor } = useSession();

  // FIX 2.c — defesa em profundidade (DECISION-0043 pendente, princípios 4 e 5)
  if (activeActor && activeActor.actor_type !== 'user') {
    return <NotApplicableMessage actor={activeActor} tab="educação" />;
  }

  const {
    profile,
    setProfile,
    isLoading,
    setIsLoading,
    error,
    setError,
    isCreating,
    setIsCreating,
    showCreateForm,
    setShowCreateForm,
    formEventType,
    setFormEventType,
    formType,
    setFormType,
    formInstitution,
    setFormInstitution,
    formCourse,
    setFormCourse,
    formStartDate,
    setFormStartDate,
    formEndDate,
    setFormEndDate,
    formDescription,
    setFormDescription,
    formReason,
    setFormReason,
    formEducationId,
    setFormEducationId,
    formAuthorName,
    setFormAuthorName,
    formAuthorRelation,
    setFormAuthorRelation,
    formContext,
    setFormContext,
  } = useProfileEducationState();
  const {
    isValidEventType,
    isThirdPartyEvent,
    validateForm,
    getEventTypeLabel,
    getEventTypeColor,
    formatDate,
    CANONICAL_EVENT_TYPES,
  } = useProfileEducationLogic();
  const { sessionReady } = useSession();

  useEffect(() => {
    // GUARD: Não fazer chamadas de API antes de sessionReady
    if (!sessionReady) {
      setIsLoading(false);
      return;
    }
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady]);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getEducationProfile();
      setProfile(data);
    } catch (err) {
      console.error('Erro ao carregar perfil educacional:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar perfil educacional');
    } finally {
      setIsLoading(false);
    }
  };


  const handleCreateEvent = async () => {
    const validationError = validateForm(formEventType, formAuthorName, formAuthorRelation, formContext);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsCreating(true);
      setError(null);

      // 🔴 BLINDAGEM: Construir payload apenas com campos permitidos
      const payload: CreateEducationEventInput['payload'] = {
        educationId: formEducationId || undefined,
        type: formType,
        institution: formInstitution || undefined,
        course: formCourse || undefined,
        startDate: formStartDate || undefined,
        endDate: formEndDate || null,
        description: formDescription || undefined,
        reason: formReason || undefined,
      };

      // 🔴 EVENTOS DE TERCEIROS: Adicionar campos obrigatórios
      if (isThirdPartyEvent(formEventType)) {
        payload.validator = formAuthorName;
        payload.evidence = formContext;
        // Relação com Actor armazenada em metadata (não no payload principal)
      }

      const input: CreateEducationEventInput = {
        eventType: formEventType,
        payload,
      };

      await createEducationEvent(input);
      
      // Recarregar perfil após criar evento
      await loadProfile();
      
      // Limpar formulário
      setShowCreateForm(false);
      resetForm();
    } catch (err) {
      console.error('Erro ao criar evento educacional:', err);
      setError(err instanceof Error ? err.message : 'Erro ao criar evento educacional');
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setFormEventType('educacao.declarada');
    setFormType('formal');
    setFormInstitution('');
    setFormCourse('');
    setFormStartDate('');
    setFormEndDate(null);
    setFormDescription('');
    setFormReason('');
    setFormEducationId('');
    setFormAuthorName('');
    setFormAuthorRelation('');
    setFormContext('');
  };


  if (isLoading) {
    return (
      <div className="profile-education-container">
        <div className="loading-message">Carregando perfil educacional...</div>
      </div>
    );
  }

  return (
    <ProfileEducationForm
      profile={profile}
      error={error}
      showCreateForm={showCreateForm}
      setShowCreateForm={setShowCreateForm}
      formEventType={formEventType}
      setFormEventType={setFormEventType}
      formType={formType}
      setFormType={setFormType}
      formInstitution={formInstitution}
      setFormInstitution={setFormInstitution}
      formCourse={formCourse}
      setFormCourse={setFormCourse}
      formStartDate={formStartDate}
      setFormStartDate={setFormStartDate}
      formEndDate={formEndDate}
      setFormEndDate={setFormEndDate}
      formDescription={formDescription}
      setFormDescription={setFormDescription}
      formReason={formReason}
      setFormReason={setFormReason}
      formEducationId={formEducationId}
      setFormEducationId={setFormEducationId}
      formAuthorName={formAuthorName}
      setFormAuthorName={setFormAuthorName}
      formAuthorRelation={formAuthorRelation}
      setFormAuthorRelation={setFormAuthorRelation}
      formContext={formContext}
      setFormContext={setFormContext}
      isCreating={isCreating}
      isValidEventType={isValidEventType}
      isThirdPartyEvent={isThirdPartyEvent}
      getEventTypeLabel={getEventTypeLabel}
      getEventTypeColor={getEventTypeColor}
      formatDate={formatDate}
      CANONICAL_EVENT_TYPES={CANONICAL_EVENT_TYPES}
      resetForm={resetForm}
      handleCreateEvent={handleCreateEvent}
    />
  );
}
