import { useState } from 'react';
import type { EducationProfile, EducationEventType, EducationType } from '../api/education';

export function useProfileEducationState() {
  const [profile, setProfile] = useState<EducationProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formEventType, setFormEventType] = useState<EducationEventType>('educacao.declarada');
  const [formType, setFormType] = useState<EducationType>('formal');
  const [formInstitution, setFormInstitution] = useState('');
  const [formCourse, setFormCourse] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState<string | null>(null);
  const [formDescription, setFormDescription] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formEducationId, setFormEducationId] = useState('');
  const [formAuthorName, setFormAuthorName] = useState('');
  const [formAuthorRelation, setFormAuthorRelation] = useState('');
  const [formContext, setFormContext] = useState('');

  return {
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
  };
}



