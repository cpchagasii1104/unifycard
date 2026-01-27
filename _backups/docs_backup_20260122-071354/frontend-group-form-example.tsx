// Exemplo de implementação do campo audience_description no formulário de criação de grupos
// Este é um exemplo de referência - adapte ao seu framework/biblioteca de formulários

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Schema de validação (deve corresponder ao backend)
const createGroupSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().min(1).max(2000),
  audience_description: z.string().max(500).optional(), // NOVO CAMPO
  category_id: z.string().uuid(),
  visibility: z.enum(['public', 'private', 'secret']).optional().default('public'),
  scope: z.enum(['national', 'state', 'city', 'neighborhood']).optional().default('national'),
  country_id: z.string().uuid(),
  state_id: z.string().uuid().optional(),
  city_id: z.string().uuid().optional(),
  neighborhood: z.string().max(255).optional(),
  // ... outros campos
});

type CreateGroupFormData = z.infer<typeof createGroupSchema>;

export function CreateGroupForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateGroupFormData>({
    resolver: zodResolver(createGroupSchema),
  });

  const onSubmit = async (data: CreateGroupFormData) => {
    // O campo audience_description será enviado automaticamente
    // como parte do objeto data
    const response = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        // audience_description já está incluído em data
      }),
    });
    // ... tratamento da resposta
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Campos anteriores */}
      
      {/* Campo Description */}
      <div className="form-field">
        <label htmlFor="description">
          Descrição <span className="required">*</span>
        </label>
        <textarea
          id="description"
          {...register('description')}
          rows={4}
          placeholder="Descreva o grupo"
          className={errors.description ? 'error' : ''}
        />
        {errors.description && (
          <span className="error-message">{errors.description.message}</span>
        )}
      </div>

      {/* NOVO CAMPO: Audience Description */}
      <div className="form-field">
        <label htmlFor="audience_description">
          Público-alvo
        </label>
        <textarea
          id="audience_description"
          {...register('audience_description')}
          rows={3}
          placeholder="Descreva brevemente o público-alvo do grupo"
          maxLength={500}
          className={errors.audience_description ? 'error' : ''}
        />
        {errors.audience_description && (
          <span className="error-message">{errors.audience_description.message}</span>
        )}
        <span className="field-hint">Máximo de 500 caracteres (opcional)</span>
      </div>

      {/* Campos seguintes */}
      
      <button type="submit">Criar Grupo</button>
    </form>
  );
}

// ============================================================
// Exemplo alternativo usando Formik
// ============================================================

import { Formik, Form, Field, ErrorMessage } from 'formik';

export function CreateGroupFormFormik() {
  return (
    <Formik
      initialValues={{
        name: '',
        description: '',
        audience_description: '', // NOVO CAMPO
        category_id: '',
        // ... outros campos
      }}
      validationSchema={createGroupSchema}
      onSubmit={async (values) => {
        // Enviar para o backend
        // audience_description já está incluído em values
        await fetch('/api/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });
      }}
    >
      {({ values, errors, touched }) => (
        <Form>
          {/* Campo Description */}
          <div className="form-field">
            <label htmlFor="description">
              Descrição <span className="required">*</span>
            </label>
            <Field
              as="textarea"
              id="description"
              name="description"
              rows={4}
              placeholder="Descreva o grupo"
              className={errors.description && touched.description ? 'error' : ''}
            />
            <ErrorMessage name="description" component="span" className="error-message" />
          </div>

          {/* NOVO CAMPO: Audience Description */}
          <div className="form-field">
            <label htmlFor="audience_description">
              Público-alvo
            </label>
            <Field
              as="textarea"
              id="audience_description"
              name="audience_description"
              rows={3}
              placeholder="Descreva brevemente o público-alvo do grupo"
              maxLength={500}
              className={errors.audience_description && touched.audience_description ? 'error' : ''}
            />
            <ErrorMessage name="audience_description" component="span" className="error-message" />
            <span className="field-hint">Máximo de 500 caracteres (opcional)</span>
          </div>

          {/* Campos seguintes */}
          
          <button type="submit">Criar Grupo</button>
        </Form>
      )}
    </Formik>
  );
}

// ============================================================
// Exemplo usando componente de formulário customizado
// ============================================================

interface FormFieldProps {
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'select';
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  rows?: number;
  optional?: boolean;
}

export function FormField({
  name,
  label,
  type = 'text',
  placeholder,
  required = false,
  maxLength,
  rows = 3,
  optional = false,
}: FormFieldProps) {
  return (
    <div className="form-field">
      <label htmlFor={name}>
        {label}
        {required && <span className="required">*</span>}
        {optional && <span className="optional">(opcional)</span>}
      </label>
      {type === 'textarea' ? (
        <textarea
          id={name}
          name={name}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={rows}
        />
      ) : (
        <input
          type={type}
          id={name}
          name={name}
          placeholder={placeholder}
          maxLength={maxLength}
        />
      )}
      {maxLength && (
        <span className="field-hint">Máximo de {maxLength} caracteres</span>
      )}
    </div>
  );
}

// Uso do componente
export function CreateGroupFormCustom() {
  return (
    <form>
      {/* Campos anteriores */}
      
      <FormField
        name="description"
        label="Descrição"
        type="textarea"
        required
        rows={4}
        placeholder="Descreva o grupo"
      />

      {/* NOVO CAMPO */}
      <FormField
        name="audience_description"
        label="Público-alvo"
        type="textarea"
        placeholder="Descreva brevemente o público-alvo do grupo"
        maxLength={500}
        rows={3}
        optional
      />

      {/* Campos seguintes */}
    </form>
  );
}





